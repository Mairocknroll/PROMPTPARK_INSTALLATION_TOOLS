package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

type ValidationIssue struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Level   string `json:"level"`
}

type ValidationReport struct {
	OK       bool              `json:"ok"`
	Issues   []ValidationIssue `json:"issues"`
	Warnings []ValidationIssue `json:"warnings"`
}

type PreflightCheck struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
	Detail  string `json:"detail"`
}

type InstallationProfile struct {
	Name      string          `json:"name"`
	UpdatedAt string          `json:"updatedAt"`
	Data      json.RawMessage `json:"data"`
}

type DeploymentHistoryRecord struct {
	Timestamp  string `json:"timestamp"`
	Server     string `json:"server"`
	TargetPath string `json:"targetPath"`
	Status     string `json:"status"`
	Message    string `json:"message"`
	EnvContent string `json:"envContent"`
}

var (
	reIPv4Like   = regexp.MustCompile(`^(\d{1,3}\.){3}\d{1,3}$`)
	reLaneKey    = regexp.MustCompile(`^(ENT|EXT)_GATE_(\d+)$`)
	reDeviceKey  = regexp.MustCompile(`^(LPR|LIC|DRI)_(IN|OUT)_(\d+)$`)
	reLEDKey     = regexp.MustCompile(`^HIK_LED_MAIN_(ENT|EXT)_(\d+)$`)
	rePortNumber = regexp.MustCompile(`^\d+$`)
)

func newReport() ValidationReport {
	return ValidationReport{OK: true, Issues: []ValidationIssue{}, Warnings: []ValidationIssue{}}
}

func (r *ValidationReport) addIssue(field, message string) {
	r.OK = false
	r.Issues = append(r.Issues, ValidationIssue{Field: field, Message: message, Level: "error"})
}

func (r *ValidationReport) addWarning(field, message string) {
	r.Warnings = append(r.Warnings, ValidationIssue{Field: field, Message: message, Level: "warning"})
}

func formatValidationIssues(report ValidationReport) string {
	parts := make([]string, 0, len(report.Issues))
	for _, issue := range report.Issues {
		parts = append(parts, issue.Field+" "+issue.Message)
	}
	return strings.Join(parts, "; ")
}

func parseEnvContent(envContent string) map[string]string {
	values := map[string]string{}
	for _, line := range strings.Split(envContent, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		values[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}
	return values
}

func isValidIPv4(ip string) bool {
	if !reIPv4Like.MatchString(ip) {
		return false
	}
	parsed := net.ParseIP(ip)
	return parsed != nil && parsed.To4() != nil
}

func validateIPField(report *ValidationReport, field, value string, required bool) {
	if value == "" {
		if required {
			report.addIssue(field, "required")
		}
		return
	}
	if !isValidIPv4(value) {
		report.addIssue(field, "must be a valid IPv4 address")
	}
}

func validateHTTPURL(report *ValidationReport, field, value string, required bool) {
	if value == "" {
		if required {
			report.addIssue(field, "required")
		}
		return
	}
	u, err := url.ParseRequestURI(value)
	if err != nil || u.Scheme == "" || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		report.addIssue(field, "must be a valid http/https URL")
		return
	}
	if strings.HasSuffix(value, "/") {
		report.addWarning(field, "trailing slash may produce unexpected upstream paths")
	}
}

func validatePort(report *ValidationReport, field, value string, required bool) {
	if value == "" {
		if required {
			report.addIssue(field, "required")
		}
		return
	}
	if !rePortNumber.MatchString(value) {
		report.addIssue(field, "must be a number")
		return
	}
	n, _ := strconv.Atoi(value)
	if n < 1 || n > 65535 {
		report.addIssue(field, "must be between 1 and 65535")
	}
}

func validatePositiveInt(report *ValidationReport, field, value string, required bool) {
	if value == "" {
		if required {
			report.addIssue(field, "required")
		}
		return
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		report.addIssue(field, "must be a positive number")
	}
}

func (a *App) ValidateProxyEnv(envContent string) ValidationReport {
	report := newReport()
	values := parseEnvContent(envContent)

	for _, key := range []string{"SERVER_URL", "PARKING_CODE", "ADDR", "CAMERA_USER", "CAMERA_PASS"} {
		if values[key] == "" {
			report.addIssue(key, "required")
		}
	}
	validateHTTPURL(&report, "SERVER_URL", values["SERVER_URL"], true)

	if addr := values["ADDR"]; addr != "" {
		_, port, err := net.SplitHostPort(addr)
		if err != nil {
			report.addIssue("ADDR", "must be in host:port format, e.g. 0.0.0.0:8000")
		} else {
			validatePort(&report, "ADDR port", port, true)
		}
	}

	validatePort(&report, "MODBUS_PORT", values["MODBUS_PORT"], false)
	validatePositiveInt(&report, "MODBUS_TIMEOUT_MS", values["MODBUS_TIMEOUT_MS"], false)
	validatePositiveInt(&report, "MODBUS_PULSE_MS", values["MODBUS_PULSE_MS"], false)
	validatePositiveInt(&report, "MODBUS_SLAVE_ID", values["MODBUS_SLAVE_ID"], false)

	lanes := map[string]bool{}
	for key, value := range values {
		switch {
		case reLaneKey.MatchString(key):
			m := reLaneKey.FindStringSubmatch(key)
			laneID := m[1] + "_" + m[2]
			if lanes[laneID] {
				report.addIssue(key, "duplicate lane definition")
			}
			lanes[laneID] = true
			validateIPField(&report, key, value, true)
		case reDeviceKey.MatchString(key), reLEDKey.MatchString(key):
			validateIPField(&report, key, value, false)
		}
	}

	if len(lanes) == 0 {
		report.addIssue("lanes", "at least one ENT/EXT gate is required")
	}
	return report
}

func sshAddress(ip string) string {
	if strings.Contains(ip, ":") {
		return ip
	}
	return ip + ":22"
}

func sshConfig(username, password string, timeout time.Duration) *ssh.ClientConfig {
	return &ssh.ClientConfig{
		User:            username,
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         timeout,
	}
}

func runRemote(client *ssh.Client, cmd string) (string, error) {
	sess, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer sess.Close()
	out, err := sess.CombinedOutput(cmd)
	return strings.TrimSpace(string(out)), err
}

func (a *App) RunServerPreflight(ip, username, password, targetPath, serverURL string, port int) []PreflightCheck {
	checks := []PreflightCheck{}
	add := func(name string, ok bool, message, detail string) {
		checks = append(checks, PreflightCheck{Name: name, OK: ok, Message: message, Detail: detail})
	}

	if ip == "" || username == "" || password == "" || targetPath == "" {
		add("required-fields", false, "missing server connection fields", "")
		return checks
	}

	client, err := ssh.Dial("tcp", sshAddress(ip), sshConfig(username, password, 8*time.Second))
	if err != nil {
		add("ssh", false, "SSH connection failed", err.Error())
		return checks
	}
	defer client.Close()
	add("ssh", true, "SSH connection successful", "")

	out, err := runRemote(client, "command -v docker")
	add("docker", err == nil && out != "", "docker CLI available", out)

	out, err = runRemote(client, "docker compose version")
	add("docker-compose", err == nil, "docker compose available", out)

	out, err = runRemote(client, fmt.Sprintf("mkdir -p %s && test -w %s && echo writable", shellQuote(targetPath), shellQuote(targetPath)))
	add("target-path", err == nil && strings.Contains(out, "writable"), "target path writable", out)

	out, err = runRemote(client, fmt.Sprintf("ss -tuln | grep -q ':%d ' && echo in-use || echo free", port))
	add("port", err == nil && strings.Contains(out, "free"), fmt.Sprintf("port %d availability", port), out)

	if username == "root" {
		add("privilege", true, "running as root", "")
	} else {
		out, err = runRemote(client, "sudo -n true 2>/dev/null && echo passwordless || groups | grep -q docker && echo docker-group || echo sudo-password-required")
		add("privilege", err == nil && (strings.Contains(out, "passwordless") || strings.Contains(out, "docker-group")), "docker privilege check", out)
	}

	if serverURL != "" {
		out, err = runRemote(client, fmt.Sprintf("wget -q --spider --timeout=5 %s && echo reachable || echo unreachable", shellQuote(serverURL)))
		add("cloud", err == nil && strings.Contains(out, "reachable"), "cloud API reachable from server", out)
	}

	return checks
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

func (a *App) RunProxyHealthCheck(ip string, port int) ValidationReport {
	report := newReport()
	if ip == "" {
		report.addIssue("ip", "required")
		return report
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://%s:%d/healthz", ip, port), nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		report.addIssue("healthz", err.Error())
		return report
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		report.addIssue("healthz", fmt.Sprintf("unexpected HTTP status %d", resp.StatusCode))
	}
	return report
}

func (a *App) ValidateHikvisionConfig(config HikvisionConfig) ValidationReport {
	report := newReport()
	validateIPField(&report, "targetIp", config.TargetIP, true)
	validatePort(&report, "targetPort", config.TargetPort, true)
	if len(config.Cameras) == 0 {
		report.addIssue("cameras", "at least one camera is required")
	}
	seen := map[string]bool{}
	for i, cam := range config.Cameras {
		prefix := fmt.Sprintf("cameras[%d]", i)
		validateIPField(&report, prefix+".ip", cam.IP, true)
		if cam.Username == "" {
			report.addIssue(prefix+".username", "required")
		}
		if cam.Password == "" {
			report.addIssue(prefix+".password", "required")
		}
		if cam.Type != "ENTRY" && cam.Type != "EXIT" {
			report.addIssue(prefix+".type", "must be ENTRY or EXIT")
		}
		if _, err := strconv.Atoi(cam.GateNo); err != nil || cam.GateNo == "" {
			report.addIssue(prefix+".gateNo", "must be numeric")
		}
		key := cam.Type + ":" + cam.GateNo + ":" + cam.IP
		if seen[key] {
			report.addIssue(prefix, "duplicate camera")
		}
		seen[key] = true
	}
	return report
}

func (a *App) ValidateEntranceKioskConfig(config KioskDeployConfig) ValidationReport {
	report := validateKioskCommon(config.Devices, config.ParkingCode, config.PaymentTicket, config.ServerURL, config.LocalServerURL, config.VehicleMode, config.ApiMode)
	if config.ScreenTimeoutSec <= 0 {
		report.addIssue("screenTimeoutSec", "must be a positive number")
	}
	return report
}

func (a *App) ValidateExitKioskConfig(config ExitKioskDeployConfig) ValidationReport {
	return validateExitKioskCommon(config.Devices, config.ParkingCode, config.PaymentTicket, config.ServerURL, config.LocalServerURL, config.VehicleMode, config.ApiMode)
}

func validateKioskCommon(devices []KioskDevice, parkingCode, paymentTicket, serverURL, localServerURL, vehicleMode, apiMode string) ValidationReport {
	report := newReport()
	if parkingCode == "" {
		report.addIssue("parkingCode", "required")
	}
	validateHTTPURL(&report, "paymentTicket", paymentTicket, true)
	validateHTTPURL(&report, "serverUrl", serverURL, true)
	validateHTTPURL(&report, "localServerUrl", localServerURL, true)
	if vehicleMode == "" {
		report.addIssue("vehicleMode", "required")
	}
	if apiMode == "" {
		report.addIssue("apiMode", "required")
	}
	if len(devices) == 0 {
		report.addIssue("devices", "at least one device is required")
	}
	seen := map[string]bool{}
	for i, dev := range devices {
		prefix := fmt.Sprintf("devices[%d]", i)
		validateIPField(&report, prefix+".ip", dev.IP, true)
		validateIPField(&report, prefix+".plcIp", dev.PlcIP, true)
		if dev.DeviceName == "" {
			report.addIssue(prefix+".deviceName", "required")
		}
		if _, err := strconv.Atoi(dev.GateNo); err != nil || dev.GateNo == "" {
			report.addIssue(prefix+".gateNo", "must be numeric")
		}
		if seen[dev.IP] {
			report.addIssue(prefix+".ip", "duplicate device IP")
		}
		seen[dev.IP] = true
	}
	return report
}

func validateExitKioskCommon(devices []ExitKioskDevice, parkingCode, paymentTicket, serverURL, localServerURL, vehicleMode, apiMode string) ValidationReport {
	converted := make([]KioskDevice, len(devices))
	for i, dev := range devices {
		converted[i] = KioskDevice{IP: dev.IP, DeviceName: dev.DeviceName, GateNo: dev.GateNo, PlcIP: dev.PlcIP}
	}
	return validateKioskCommon(converted, parkingCode, paymentTicket, serverURL, localServerURL, vehicleMode, apiMode)
}

func (a *App) CheckADBAvailability() string {
	adbPath, err := findADB()
	if err != nil {
		return "Error: " + err.Error()
	}
	return adbPath
}

func (a *App) DiagnoseADBDevice(ip, packageName string) []PreflightCheck {
	checks := []PreflightCheck{}
	add := func(name string, ok bool, message, detail string) {
		checks = append(checks, PreflightCheck{Name: name, OK: ok, Message: message, Detail: detail})
	}
	adbPath, err := findADB()
	if err != nil {
		add("adb", false, "ADB not found", err.Error())
		return checks
	}
	add("adb", true, "ADB found", adbPath)
	if !isValidIPv4(ip) {
		add("device-ip", false, "invalid device IP", ip)
		return checks
	}
	devAddr := ip + ":5555"
	out, err := exec.Command(adbPath, "connect", devAddr).CombinedOutput()
	add("connect", err == nil, "ADB connect", strings.TrimSpace(string(out)))
	out, _ = exec.Command(adbPath, "devices").CombinedOutput()
	online := strings.Contains(string(out), devAddr) && !strings.Contains(string(out), devAddr+"\tunauthorized")
	add("online", online, "device online and authorized", strings.TrimSpace(string(out)))
	if packageName != "" {
		out, err = exec.Command(adbPath, "-s", devAddr, "shell", "run-as "+packageName+" pwd").CombinedOutput()
		add("run-as", err == nil, "package installed and run-as allowed", strings.TrimSpace(string(out)))
	}
	return checks
}

func dataDir() string {
	dir := ".promptpark-tool"
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func (a *App) SaveInstallationProfile(profile InstallationProfile) error {
	if strings.TrimSpace(profile.Name) == "" {
		return fmt.Errorf("profile name is required")
	}
	profile.UpdatedAt = time.Now().Format(time.RFC3339)
	name := sanitizeFileName(profile.Name)
	b, _ := json.MarshalIndent(profile, "", "  ")
	return os.WriteFile(filepath.Join(dataDir(), name+".json"), b, 0644)
}

func (a *App) ListInstallationProfiles() ([]InstallationProfile, error) {
	files, err := os.ReadDir(dataDir())
	if err != nil {
		return nil, err
	}
	profiles := []InstallationProfile{}
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(f.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dataDir(), f.Name()))
		if err != nil {
			continue
		}
		var p InstallationProfile
		if json.Unmarshal(b, &p) == nil && p.Name != "" {
			profiles = append(profiles, p)
		}
	}
	sort.Slice(profiles, func(i, j int) bool { return profiles[i].UpdatedAt > profiles[j].UpdatedAt })
	return profiles, nil
}

func (a *App) DeleteInstallationProfile(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("profile name is required")
	}
	path := filepath.Join(dataDir(), sanitizeFileName(name)+".json")
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func sanitizeFileName(s string) string {
	s = strings.TrimSpace(s)
	replacer := strings.NewReplacer("\\", "_", "/", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return replacer.Replace(s)
}

func appendDeploymentHistory(record DeploymentHistoryRecord) {
	record.Timestamp = time.Now().Format(time.RFC3339)
	record.EnvContent = maskEnvContent(record.EnvContent)
	path := filepath.Join(dataDir(), "deployment-history.json")
	var records []DeploymentHistoryRecord
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &records)
	}
	records = append([]DeploymentHistoryRecord{record}, records...)
	if len(records) > 100 {
		records = records[:100]
	}
	b, _ := json.MarshalIndent(records, "", "  ")
	_ = os.WriteFile(path, b, 0644)
}

func maskEnvContent(envContent string) string {
	lines := strings.Split(envContent, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CAMERA_PASS=") || strings.HasPrefix(trimmed, "PASSWORD=") || strings.Contains(trimmed, "_PASS=") {
			key := strings.SplitN(line, "=", 2)[0]
			lines[i] = key + "=***"
		}
	}
	return strings.Join(lines, "\n")
}

func (a *App) ListDeploymentHistory() ([]DeploymentHistoryRecord, error) {
	path := filepath.Join(dataDir(), "deployment-history.json")
	records := []DeploymentHistoryRecord{}
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &records)
	}
	if records == nil {
		records = []DeploymentHistoryRecord{}
	}
	return records, nil
}
