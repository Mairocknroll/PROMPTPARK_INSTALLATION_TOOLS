package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

//go:embed proxy_api_template
var proxyAPI embed.FS

func (a *App) SaveEnvConfig(envContent string) string {
	// เขียนลงไฟล์ .env ใน Folder ปัจจุบันก่อน
	err := os.WriteFile(".env.output", []byte(envContent), 0644)
	if err != nil {
		return "Error: " + err.Error()
	}

	return "บันทึกลงไฟล์ .env.output เรียบร้อยแล้ว!"
}

// CheckSSHConnection attempts to connect to the SSH server.
func (a *App) CheckSSHConnection(ip, username, password string) string {
	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		return "Error: " + err.Error()
	}
	defer client.Close()
	return "Success"
}

func (a *App) ReadRemoteEnv(ip, username, password, targetPath string) (string, error) {
	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		return "", fmt.Errorf("ssh connection failed: %v", err)
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("session failed: %v", err)
	}
	defer sess.Close()

	out, err := sess.CombinedOutput(fmt.Sprintf("cat %s/.env", targetPath))
	if err != nil {
		return "", fmt.Errorf("read failed: %s", string(out))
	}
	return string(out), nil
}

func (a *App) SaveRemoteEnv(ip, username, password, targetPath, envContent string) error {
	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		return fmt.Errorf("ssh connection failed: %v", err)
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("session failed: %v", err)
	}
	defer sess.Close()
	sess.Stdin = strings.NewReader(envContent)
	err = sess.Run(fmt.Sprintf("cat > %s/.env", targetPath))
	if err != nil {
		return fmt.Errorf("write failed: %v", err)
	}
	return nil
}

func (a *App) RedeployProxy(ip, username, password, targetPath string) error {
	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		return fmt.Errorf("ssh connection failed: %v", err)
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("session failed: %v", err)
	}
	defer sess.Close()
	
	cmd := "docker compose down && docker compose up -d"
	if username != "root" {
		safePass := strings.ReplaceAll(password, "'", "'\\''")
		cmd = fmt.Sprintf("echo '%s' | sudo -S docker compose down && echo '%s' | sudo -S docker compose up -d", safePass, safePass)
	}

	fullCmd := fmt.Sprintf("cd %s && %s", targetPath, cmd)
	out, err := sess.CombinedOutput(fullCmd)
	if err != nil {
		return fmt.Errorf("redeploy failed: %s", string(out))
	}
	return nil
}

// CheckPortInUse attempts to connect to the SSH server and checks if the given port is in use.
func (a *App) CheckPortInUse(ip, username, password string, port int) bool {
	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		return false
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return false
	}
	defer sess.Close()

	// Check if port is in use using ss (does not require sudo just to list ports)
	cmd := fmt.Sprintf("ss -tuln | grep -q ':%d '", port)
	err = sess.Run(cmd)

	// grep -q returns exit status 0 if a match is found (port in use), 1 if not found.
	return err == nil
}

func tarFS(fsys fs.FS, baseDir string) ([]byte, error) {
	buf := new(bytes.Buffer)
	gw := gzip.NewWriter(buf)
	tw := tar.NewWriter(gw)

	err := fs.WalkDir(fsys, baseDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		content, err := fs.ReadFile(fsys, path)
		if err != nil {
			return err
		}

		f, err := d.Info()
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(f, f.Name())
		if err != nil {
			return err
		}

		relPath := strings.TrimPrefix(path, baseDir+"/")
		if strings.HasSuffix(relPath, "tmpl_go.mod") {
			relPath = strings.TrimSuffix(relPath, "tmpl_go.mod") + "go.mod"
		} else if strings.HasSuffix(relPath, "tmpl_go.sum") {
			relPath = strings.TrimSuffix(relPath, "tmpl_go.sum") + "go.sum"
		}
		header.Name = relPath

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		_, err = tw.Write(content)
		return err
	})

	if err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (a *App) DeployToServer(ip, username, password, targetPath, envContent string) string {
	a.emitEvent("deploy-progress",5, "Initializing deployment...")

	if !strings.Contains(ip, ":") {
		ip = ip + ":22"
	}
	config := &ssh.ClientConfig{
		User: username,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	a.emitEvent("deploy-progress",10, "Compressing embedded source code (tar.gz)...")
	// 1. Tar.gz the embedded files
	tarData, err := tarFS(proxyAPI, "proxy_api_template")
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error compressing files")
		return "Error compressing files: " + err.Error()
	}

	a.emitEvent("deploy-progress",20, "Connecting to SSH server...")
	client, err := ssh.Dial("tcp", ip, config)
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error connecting SSH")
		return "Error connecting SSH: " + err.Error()
	}
	defer client.Close()

	// Step 2.1: Create dir
	a.emitEvent("deploy-progress",30, "Creating target directory on server...")
	sess1, _ := client.NewSession()
	_ = sess1.Run(fmt.Sprintf("mkdir -p %s", targetPath))
	sess1.Close()

	// Step 2.2: Upload tar.gz
	a.emitEvent("deploy-progress",40, "Uploading source code to server...")
	sess2, err := client.NewSession()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error session 2")
		return "Error session 2: " + err.Error()
	}
	sess2.Stdin = bytes.NewReader(tarData)
	err = sess2.Run(fmt.Sprintf("cat > %s/deploy.tar.gz", targetPath))
	sess2.Close()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error uploading tar.gz")
		return "Error uploading tar.gz: " + err.Error()
	}

	// Step 2.3: Untar
	a.emitEvent("deploy-progress",60, "Extracting source code on server...")
	sess3, err := client.NewSession()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error session 3")
		return "Error session 3: " + err.Error()
	}
	out, err := sess3.CombinedOutput(fmt.Sprintf("cd %s && tar -xzf deploy.tar.gz && rm deploy.tar.gz", targetPath))
	sess3.Close()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error extracting tar.gz")
		return "Error extracting tar.gz: " + string(out) + " | " + err.Error()
	}

	// Step 2.4: Upload .env
	a.emitEvent("deploy-progress",70, "Writing environment configuration (.env)...")
	sess4, err := client.NewSession()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error session 4")
		return "Error session 4: " + err.Error()
	}
	sess4.Stdin = strings.NewReader(envContent)
	err = sess4.Run(fmt.Sprintf("cat > %s/.env", targetPath))
	sess4.Close()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error writing .env")
		return "Error writing .env: " + err.Error()
	}

	// Step 2.5: Docker Compose
	a.emitEvent("deploy-progress",80, "Building Docker image & starting container... (This may take a while)")
	sess5, err := client.NewSession()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error session 5")
		return "Error session 5: " + err.Error()
	}
	dockerCmd := "docker compose up -d --build"
	if username != "root" {
		safePass := strings.ReplaceAll(password, "'", "'\\''")
		dockerCmd = fmt.Sprintf("echo '%s' | sudo -S docker compose up -d --build", safePass)
	}
	out, err = sess5.CombinedOutput(fmt.Sprintf("cd %s && %s", targetPath, dockerCmd))
	sess5.Close()
	if err != nil {
		a.emitEvent("deploy-progress",0, "Error docker compose")
		return "Error docker compose: " + string(out) + " | " + err.Error()
	}

	a.emitEvent("deploy-progress", 100, "Deployment successful!")
	return "Deployed successfully!\n" + string(out)
}
