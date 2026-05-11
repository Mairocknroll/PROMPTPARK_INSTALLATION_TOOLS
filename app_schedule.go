package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// ScheduledDeploy represents a deployment scheduled for a future time.
type ScheduledDeploy struct {
	ID          string `json:"id"`
	SiteName    string `json:"siteName"`
	Server      string `json:"server"`
	Username    string `json:"username"`
	TargetPath  string `json:"targetPath"`
	EnvContent  string `json:"envContent"`
	DeployType  string `json:"deployType"`  // "restart" or "build"
	ScheduledAt string `json:"scheduledAt"` // RFC3339 in client local timezone
	CreatedAt   string `json:"createdAt"`
	Status      string `json:"status"`      // pending | running | success | failed | cancelled
	StatusMsg   string `json:"statusMsg"`
	CompletedAt string `json:"completedAt"`
}

func schedulesFile() string {
	return filepath.Join(dataDir(), "scheduled-deploys.json")
}

func loadSchedules() []ScheduledDeploy {
	var schedules []ScheduledDeploy
	if b, err := os.ReadFile(schedulesFile()); err == nil {
		_ = json.Unmarshal(b, &schedules)
	}
	if schedules == nil {
		schedules = []ScheduledDeploy{}
	}
	return schedules
}

func saveSchedules(schedules []ScheduledDeploy) error {
	b, _ := json.MarshalIndent(schedules, "", "  ")
	return os.WriteFile(schedulesFile(), b, 0644)
}

func findScheduleIdx(schedules []ScheduledDeploy, id string) int {
	for i, s := range schedules {
		if s.ID == id {
			return i
		}
	}
	return -1
}

// ScheduleDeploy creates a scheduled deployment via remote crontab.
// scheduledAt is in "2006-01-02T15:04" format (client local time from datetime-local input).
func (a *App) ScheduleDeploy(siteName, server, username, password, targetPath, envContent, deployType, scheduledAt string) (*ScheduledDeploy, error) {
	if server == "" || username == "" || password == "" || targetPath == "" {
		return nil, fmt.Errorf("server connection fields are required")
	}
	if envContent == "" {
		return nil, fmt.Errorf("env content is required")
	}
	if deployType != "restart" && deployType != "build" {
		return nil, fmt.Errorf("deployType must be 'restart' or 'build'")
	}

	// Parse as client local time
	scheduledTime, err := time.ParseInLocation("2006-01-02T15:04", scheduledAt, time.Local)
	if err != nil {
		scheduledTime, err = time.ParseInLocation("2006-01-02T15:04:05", scheduledAt, time.Local)
		if err != nil {
			return nil, fmt.Errorf("invalid scheduledAt format: %v", err)
		}
	}

	if scheduledTime.Before(time.Now().Add(1 * time.Minute)) {
		return nil, fmt.Errorf("scheduled time must be at least 1 minute in the future")
	}

	id := fmt.Sprintf("%s%d", sanitizeFileName(siteName)[:min(6, len(sanitizeFileName(siteName)))], time.Now().UnixMilli()%100000)

	// Connect SSH
	client, err := ssh.Dial("tcp", sshAddress(server), sshConfig(username, password, 10*time.Second))
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed: %v", err)
	}
	defer client.Close()

	// Get server epoch to calculate clock offset
	serverTimeStr, err := runRemote(client, "date +%s")
	if err != nil {
		return nil, fmt.Errorf("failed to get server time: %v", err)
	}
	serverEpoch, err := strconv.ParseInt(strings.TrimSpace(serverTimeStr), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse server time: %v", err)
	}

	// Calculate: when client reaches scheduledTime, how many seconds from now?
	clientEpoch := time.Now().Unix()
	delaySeconds := scheduledTime.Unix() - clientEpoch
	// Server target epoch = server's current time + same delay
	serverTargetEpoch := serverEpoch + delaySeconds

	// Get cron time fields in server's local timezone
	cronTimeStr, err := runRemote(client, fmt.Sprintf("date -d @%d '+%%M %%H %%d %%m'", serverTargetEpoch))
	if err != nil {
		return nil, fmt.Errorf("failed to calculate server cron time: %v", err)
	}
	cronFields := strings.TrimSpace(cronTimeStr) // "MM HH DD MM"

	// Step 1: Backup existing .env and upload new one
	backupCmd := fmt.Sprintf("cd %s && if [ -f .env ]; then cp .env .env.backup.$(date +%%Y%%m%%d%%H%%M%%S); fi", shellQuote(targetPath))
	_, _ = runRemote(client, backupCmd)

	sess, err := client.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %v", err)
	}
	sess.Stdin = strings.NewReader(envContent)
	err = sess.Run(fmt.Sprintf("cat > %s/.env", shellQuote(targetPath)))
	sess.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to write .env: %v", err)
	}

	// Step 2: Create deploy script on remote server
	dockerCmd := buildDockerCmd(username, password, deployType)

	scriptContent := fmt.Sprintf(`#!/bin/bash
echo "running" > /tmp/promptpark-deploy-%s.status
echo "$(date): Starting scheduled deployment (type=%s)..." > /tmp/promptpark-deploy-%s.log
cd %s
%s >> /tmp/promptpark-deploy-%s.log 2>&1
if [ $? -eq 0 ]; then
  echo "success" > /tmp/promptpark-deploy-%s.status
  echo "$(date): Deployment successful" >> /tmp/promptpark-deploy-%s.log
else
  echo "failed" > /tmp/promptpark-deploy-%s.status
  echo "$(date): Deployment failed" >> /tmp/promptpark-deploy-%s.log
fi
# Self-cleanup crontab entry
crontab -l 2>/dev/null | grep -v "promptpark-deploy-%s" | crontab -
`, id, deployType, id, shellQuote(targetPath), dockerCmd, id, id, id, id, id, id)

	sessScript, err := client.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create session for script: %v", err)
	}
	sessScript.Stdin = strings.NewReader(scriptContent)
	scriptPath := fmt.Sprintf("/tmp/promptpark-deploy-%s.sh", id)
	err = sessScript.Run(fmt.Sprintf("cat > %s && chmod +x %s", scriptPath, scriptPath))
	sessScript.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to create deploy script: %v", err)
	}

	// Step 3: Add cron entry
	cronEntry := fmt.Sprintf("%s * /bin/bash %s # promptpark-deploy-%s", cronFields, scriptPath, id)
	cronCmd := fmt.Sprintf("(crontab -l 2>/dev/null; echo '%s') | crontab -", cronEntry)
	if _, err := runRemote(client, cronCmd); err != nil {
		return nil, fmt.Errorf("failed to create cron job: %v", err)
	}

	schedule := ScheduledDeploy{
		ID:          id,
		SiteName:    siteName,
		Server:      server,
		Username:    username,
		TargetPath:  targetPath,
		EnvContent:  maskEnvContent(envContent),
		DeployType:  deployType,
		ScheduledAt: scheduledTime.Format(time.RFC3339),
		CreatedAt:   time.Now().Format(time.RFC3339),
		Status:      "pending",
		StatusMsg:   fmt.Sprintf("Cron scheduled at server time: %s (cron: %s)", cronFields, cronEntry),
	}

	schedules := loadSchedules()
	schedules = append([]ScheduledDeploy{schedule}, schedules...)
	if err := saveSchedules(schedules); err != nil {
		return nil, fmt.Errorf("failed to save schedule: %v", err)
	}

	return &schedule, nil
}

func buildDockerCmd(username, password, deployType string) string {
	upCmd := "docker compose up -d"
	if deployType == "build" {
		upCmd = "docker compose up -d --build"
	}
	if username != "root" {
		safePass := strings.ReplaceAll(password, "'", "'\\''")
		return fmt.Sprintf("echo '%s' | sudo -S docker compose down && echo '%s' | sudo -S %s", safePass, safePass, upCmd)
	}
	return "docker compose down && " + upCmd
}

// ListScheduledDeploys returns all scheduled deployments from local store.
func (a *App) ListScheduledDeploys() []ScheduledDeploy {
	return loadSchedules()
}

// GetScheduleStatus checks the real-time status of a scheduled deploy via SSH.
func (a *App) GetScheduleStatus(id, server, username, password string) (*ScheduledDeploy, error) {
	schedules := loadSchedules()
	idx := findScheduleIdx(schedules, id)
	if idx == -1 {
		return nil, fmt.Errorf("schedule not found")
	}

	schedule := &schedules[idx]

	// If already terminal, just return
	if schedule.Status == "success" || schedule.Status == "failed" || schedule.Status == "cancelled" {
		return schedule, nil
	}

	client, err := ssh.Dial("tcp", sshAddress(server), sshConfig(username, password, 10*time.Second))
	if err != nil {
		return schedule, fmt.Errorf("SSH failed: %v", err)
	}
	defer client.Close()

	statusStr, _ := runRemote(client, fmt.Sprintf("cat /tmp/promptpark-deploy-%s.status 2>/dev/null || echo 'pending'", id))
	statusStr = strings.TrimSpace(statusStr)

	if statusStr == "running" || statusStr == "success" || statusStr == "failed" {
		schedule.Status = statusStr
		if statusStr == "success" || statusStr == "failed" {
			schedule.CompletedAt = time.Now().Format(time.RFC3339)
		}
		logStr, _ := runRemote(client, fmt.Sprintf("cat /tmp/promptpark-deploy-%s.log 2>/dev/null", id))
		schedule.StatusMsg = logStr
	}

	_ = saveSchedules(schedules)
	return schedule, nil
}

// GetScheduleLog reads the deploy log from the remote server.
func (a *App) GetScheduleLog(id, server, username, password string) (string, error) {
	client, err := ssh.Dial("tcp", sshAddress(server), sshConfig(username, password, 10*time.Second))
	if err != nil {
		return "", fmt.Errorf("SSH failed: %v", err)
	}
	defer client.Close()

	logStr, _ := runRemote(client, fmt.Sprintf("cat /tmp/promptpark-deploy-%s.log 2>/dev/null || echo 'No log available yet.'", id))
	return logStr, nil
}

// CancelScheduledDeploy removes the cron job and cleans up remote files.
func (a *App) CancelScheduledDeploy(id, server, username, password string) error {
	schedules := loadSchedules()
	idx := findScheduleIdx(schedules, id)
	if idx == -1 {
		return fmt.Errorf("schedule not found")
	}

	schedule := &schedules[idx]
	if schedule.Status != "pending" {
		return fmt.Errorf("can only cancel pending schedules (current: %s)", schedule.Status)
	}

	client, err := ssh.Dial("tcp", sshAddress(server), sshConfig(username, password, 10*time.Second))
	if err != nil {
		return fmt.Errorf("SSH failed: %v", err)
	}
	defer client.Close()

	// Remove cron entry
	cronRemoveCmd := fmt.Sprintf("crontab -l 2>/dev/null | grep -v 'promptpark-deploy-%s' | crontab -", id)
	_, _ = runRemote(client, cronRemoveCmd)

	// Cleanup temp files
	cleanupCmd := fmt.Sprintf("rm -f /tmp/promptpark-deploy-%s.sh /tmp/promptpark-deploy-%s.status /tmp/promptpark-deploy-%s.log", id, id, id)
	_, _ = runRemote(client, cleanupCmd)

	schedule.Status = "cancelled"
	schedule.CompletedAt = time.Now().Format(time.RFC3339)
	schedule.StatusMsg = "Cancelled by user"

	return saveSchedules(schedules)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
