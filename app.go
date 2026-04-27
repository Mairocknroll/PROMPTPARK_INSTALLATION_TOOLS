package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/icholy/digest"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/ssh"
)

// HikCamera struct for configuring ISAPI
type HikCamera struct {
	IP       string `json:"ip"`
	Username string `json:"username"`
	Password string `json:"password"`
	Type     string `json:"type"`   // "ENTRY" or "EXIT"
	GateNo   string `json:"gateNo"` // "1", "2", etc.
}

// HikvisionConfig struct to hold all data from UI
type HikvisionConfig struct {
	TargetIP   string      `json:"targetIp"`
	TargetPort string      `json:"targetPort"`
	Cameras    []HikCamera `json:"cameras"`
}

// KioskDevice represents a single Android Kiosk device
type KioskDevice struct {
	IP         string `json:"ip"`
	DeviceName string `json:"deviceName"`
	GateNo     string `json:"gateNo"`
	PlcIP      string `json:"plcIp"`
}

// KioskDeployConfig holds all data from the Kiosk Deploy UI
type KioskDeployConfig struct {
	APKPath           string        `json:"apkPath"`
	Devices           []KioskDevice `json:"devices"`
	ParkingCode       string        `json:"parkingCode"`
	PaymentTicket     string        `json:"paymentTicket"`
	ServerURL         string        `json:"serverUrl"`
	LocalServerURL    string        `json:"localServerUrl"`
	VehicleMode       string        `json:"vehicleMode"`
	IsSpecialEntrance bool          `json:"isSpecialEntrance"`
	PaymentApiVersion string        `json:"paymentApiVersion"`
	ApiMode           string        `json:"apiMode"`
	ScreenTimeoutSec  int           `json:"screenTimeoutSec"`
	ZoningMode        string        `json:"zoningMode"`
	ZoningCode        string        `json:"zoningCode"`
	ZoningGateNo      string        `json:"zoningGateNo"`
}

// ExitKioskDevice holds per-device config for Exit Kiosk
type ExitKioskDevice struct {
	IP         string `json:"ip"`
	DeviceName string `json:"deviceName"`
	GateNo     string `json:"gateNo"`
	PlcIP      string `json:"plcIp"`
}

// ExitKioskDeployConfig holds all data from the Exit Kiosk Deploy UI
type ExitKioskDeployConfig struct {
	ApkPath          string            `json:"apkPath"`
	Devices          []ExitKioskDevice `json:"devices"`
	ParkingCode      string            `json:"parkingCode"`
	ProjectCode      string            `json:"projectCode"`
	PaymentTicket    string            `json:"paymentTicket"`
	ServerURL        string            `json:"serverUrl"`
	LocalServerURL   string            `json:"localServerUrl"`
	VehicleMode      string            `json:"vehicleMode"`
	ApiMode          string            `json:"apiMode"`
	ZoningMode       string            `json:"zoningMode"`
	ZoningCode       string            `json:"zoningCode"`
	ZoningGateNo     string            `json:"zoningGateNo"`
	NextZoningCode   string            `json:"nextZoningCode"`
	NextZoningGateNo string            `json:"nextZoningGateNo"`
	IsCash           bool              `json:"isCash"`
	IsQR             bool              `json:"isQR"`
	TicketMode       string            `json:"ticketMode"`
}

//go:embed proxy_api_template
var proxyAPI embed.FS

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

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

// ConfigureHikvisionISAPI connects to each camera via Digest Auth and sets the HTTP Host
func (a *App) ConfigureHikvisionISAPI(config HikvisionConfig) {
	for i, cam := range config.Cameras {
		progress := int((float64(i) / float64(len(config.Cameras))) * 100)
		a.emitEvent("hik-progress", progress, fmt.Sprintf("Configuring %s...", cam.IP))

		path := fmt.Sprintf("/api/v2-202402/order/verify-member?gate_no=%s", cam.GateNo)
		if cam.Type == "EXIT" {
			path = fmt.Sprintf("/api/v2-202402/order/verify-license-plate-out?gate_no=%s", cam.GateNo)
		}

		xmlPayload := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<HttpHostNotification>
    <id>1</id>
    <url>%s</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <ipAddress>%s</ipAddress>
    <portNo>%s</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
</HttpHostNotification>
</HttpHostNotificationList>`, path, config.TargetIP, config.TargetPort)

		client := &http.Client{
			Transport: &digest.Transport{
				Username: cam.Username,
				Password: cam.Password,
			},
			Timeout: 10 * time.Second,
		}

		reqURL := fmt.Sprintf("http://%s/ISAPI/Event/notification/httpHosts", cam.IP)
		req, err := http.NewRequest("PUT", reqURL, strings.NewReader(xmlPayload))
		if err != nil {
			a.emitEvent("hik-progress", progress, fmt.Sprintf("❌ Error creating request for %s: %v", cam.IP, err))
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			a.emitEvent("hik-progress", progress, fmt.Sprintf("❌ Error connecting to %s: %v", cam.IP, err))
			continue
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			a.emitEvent("hik-progress", progress, fmt.Sprintf("✅ Successfully configured %s", cam.IP))
		} else {
			body, _ := io.ReadAll(resp.Body)
			a.emitEvent("hik-progress", progress, fmt.Sprintf("⚠️ Failed configuring %s (HTTP %d): %s", cam.IP, resp.StatusCode, string(body)))
		}
		resp.Body.Close()
	}
	a.emitEvent("hik-progress", 100, "✅ Done configuring all cameras.")
}

func (a *App) emitEvent(eventName string, progress int, message string) {
	runtime.EventsEmit(a.ctx, eventName, map[string]interface{}{
		"progress": progress,
		"message":  message,
	})
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

// findADB auto-detects adb.exe from PATH or ANDROID_HOME
func findADB() (string, error) {
	// 1. Try PATH
	if p, err := exec.LookPath("adb"); err == nil {
		return p, nil
	}
	// 2. Try ANDROID_HOME
	home := os.Getenv("ANDROID_HOME")
	if home == "" {
		home = os.Getenv("ANDROID_SDK_ROOT")
	}
	if home != "" {
		p := filepath.Join(home, "platform-tools", "adb.exe")
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	// 3. Try common paths
	for _, candidate := range []string{
		`C:\Users\` + os.Getenv("USERNAME") + `\AppData\Local\Android\Sdk\platform-tools\adb.exe`,
		`C:\Android\platform-tools\adb.exe`,
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("adb not found. Please install Android Platform Tools and add to PATH")
}

// BrowseAPKFile opens a file dialog to select an APK file
func (a *App) BrowseAPKFile() string {
	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select APK File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Android APK (*.apk)", Pattern: "*.apk"},
		},
	})
	if err != nil {
		return ""
	}
	return file
}

// DeployKioskAPK installs APK and pushes SharedPreferences to multiple Android devices
func (a *App) DeployKioskAPK(config KioskDeployConfig) {
	adbPath, err := findADB()
	if err != nil {
		a.emitEvent("kiosk-progress", 0, "❌ "+err.Error())
		return
	}
	a.emitEvent("kiosk-progress", 5, "✅ ADB found: "+adbPath)

	total := len(config.Devices)
	for i, dev := range config.Devices {
		progress := int((float64(i) / float64(total)) * 90) + 5
		devAddr := dev.IP + ":5555"

		// Step 1: ADB connect
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📡 Connecting to %s (%s)...", dev.DeviceName, dev.IP))
		out, err := exec.Command(adbPath, "connect", devAddr).CombinedOutput()
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to connect %s: %s", dev.IP, string(out)))
			continue
		}
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ Connected to %s: %s", dev.IP, strings.TrimSpace(string(out))))

		// Step 2: Install APK
		if config.APKPath != "" {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📦 Installing APK on %s... (this may take a while)", dev.DeviceName))
			out, err = exec.Command(adbPath, "-s", devAddr, "install", "-r", config.APKPath).CombinedOutput()
			if err != nil {
				a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚠️ APK install failed on %s: %s", dev.IP, string(out)))
			} else {
				a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ APK installed on %s", dev.DeviceName))
			}
		}

		// Step 3: Push SharedPreferences
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚙️ Writing SharedPreferences on %s...", dev.DeviceName))

		isSpecial := "false"
		if config.IsSpecialEntrance {
			isSpecial = "true"
		}

		// Build the SharedPreferences XML
		xmlContent := fmt.Sprintf(`<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="deviceNameConfig">%s</string>
    <string name="parkingCodeConfig">%s</string>
    <string name="paymentTicket">%s</string>
    <string name="serverConfig">%s</string>
    <string name="localServerConfig">%s</string>
    <string name="plcIpConfig">%s</string>
    <string name="gateConfig">%s</string>
    <string name="vehicleMode">%s</string>
    <boolean name="isSpecialEntrance" value="%s" />
    <string name="paymentApiVersionConfig">%s</string>
    <string name="zoningMode">%s</string>
    <string name="zoningCode">%s</string>
    <string name="zoningGateNo">%s</string>
    <string name="apiMode">%s</string>
    <long name="setTime" value="%d" />
</map>`,
			dev.DeviceName, config.ParkingCode, config.PaymentTicket,
			config.ServerURL, config.LocalServerURL, dev.PlcIP,
			dev.GateNo, config.VehicleMode, isSpecial,
			config.PaymentApiVersion, config.ZoningMode,
			config.ZoningCode, config.ZoningGateNo,
			config.ApiMode, config.ScreenTimeoutSec*1000,
		)

		// Write XML to temp file
		tmpFile, err := os.CreateTemp("", "prefs-*.xml")
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to create temp file: %v", err))
			continue
		}
		tmpFile.WriteString(xmlContent)
		tmpFile.Close()

		// Push to /data/local/tmp/
		out, err = exec.Command(adbPath, "-s", devAddr, "push", tmpFile.Name(), "/data/local/tmp/prefs.xml").CombinedOutput()
		os.Remove(tmpFile.Name())
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to push prefs to %s: %s", dev.IP, string(out)))
			continue
		}

		// Use run-as to copy into app's shared_prefs (single string to adb shell for correct quoting)
		out, err = exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.entrancekiosk cp /data/local/tmp/prefs.xml shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚠️ run-as cp failed on %s: %s", dev.IP, string(out)))
			continue
		}

		// Set correct permissions
		exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.entrancekiosk chmod 660 shared_prefs/PromptParkConfiguration.xml").Run()

		// Cleanup tmp on device
		exec.Command(adbPath, "-s", devAddr, "shell", "rm /data/local/tmp/prefs.xml").Run()

		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ Config pushed to %s (Gate %s)", dev.DeviceName, dev.GateNo))
	}

	a.emitEvent("kiosk-progress", 100, "✅ Done deploying to all devices.")
}

// DeployExitKioskAPK automates ADB installation and Exit Kiosk SharedPreferences config push
func (a *App) DeployExitKioskAPK(config ExitKioskDeployConfig) {
	adbPath, err := findADB()
	if err != nil {
		a.emitEvent("exit-kiosk-progress", 0, "❌ Error: ADB not found! Please install Android platform-tools.")
		return
	}

	totalSteps := len(config.Devices) * 3 // Connect, Install, Push Config
	if config.ApkPath == "" {
		totalSteps = len(config.Devices) * 2 // Connect, Push Config
	}

	currentStep := 0

	for _, dev := range config.Devices {
		devAddr := dev.IP + ":5555"

		// Step 1: Connect
		currentStep++
		progress := int((float64(currentStep) / float64(totalSteps)) * 100)
		a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("📡 Connecting to %s (%s)...", dev.DeviceName, dev.IP))
		exec.Command(adbPath, "connect", devAddr).Run()

		// Verify connection
		out, _ := exec.Command(adbPath, "devices").CombinedOutput()
		if !strings.Contains(string(out), devAddr) {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to connect to %s", dev.IP))
			continue
		}
		a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("✅ Connected to %s", dev.IP))

		// Step 2: Install APK
		if config.ApkPath != "" {
			currentStep++
			progress = int((float64(currentStep) / float64(totalSteps)) * 100)
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("📦 Installing APK on %s... (this may take a while)", dev.DeviceName))
			out, err = exec.Command(adbPath, "-s", devAddr, "install", "-r", config.ApkPath).CombinedOutput()
			if err != nil {
				a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Install failed on %s: %s", dev.IP, string(out)))
			} else {
				a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("✅ APK installed on %s", dev.DeviceName))
			}
		}

		// Step 3: Write XML and Push via run-as
		currentStep++
		progress = int((float64(currentStep) / float64(totalSteps)) * 100)
		a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("⚙️ Writing SharedPreferences on %s...", dev.DeviceName))

		xmlContent := fmt.Sprintf(`<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="deviceNameConfig">%s</string>
    <string name="parkingCodeConfig">%s</string>
    <string name="projectCodeConfig">%s</string>
    <string name="paymentTicket">%s</string>
    <string name="serverConfig">%s</string>
    <string name="localServerConfig">%s</string>
    <string name="plcIpConfig">%s</string>
    <string name="gateConfig">%s</string>
    <string name="vehicleMode">%s</string>
    <string name="apiMode">%s</string>
    <string name="zoningMode">%s</string>
    <string name="zoningCode">%s</string>
    <string name="zoningGateNo">%s</string>
    <string name="nextZoningCode">%s</string>
    <string name="nextZoningGateNo">%s</string>
    <boolean name="isCash" value="%t" />
    <boolean name="isQR" value="%t" />
    <string name="ticketMode">%s</string>
</map>`,
			dev.DeviceName, config.ParkingCode, config.ProjectCode, config.PaymentTicket,
			config.ServerURL, config.LocalServerURL, dev.PlcIP,
			dev.GateNo, config.VehicleMode, config.ApiMode, config.ZoningMode,
			config.ZoningCode, config.ZoningGateNo, config.NextZoningCode, config.NextZoningGateNo,
			config.IsCash, config.IsQR, config.TicketMode,
		)

		// Write XML to temp file
		tmpFile, err := os.CreateTemp("", "exit-prefs-*.xml")
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to create temp file: %v", err))
			continue
		}
		tmpFile.WriteString(xmlContent)
		tmpFile.Close()

		// Push to /data/local/tmp/
		out, err = exec.Command(adbPath, "-s", devAddr, "push", tmpFile.Name(), "/data/local/tmp/prefs.xml").CombinedOutput()
		os.Remove(tmpFile.Name())
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to push prefs to %s: %s", dev.IP, string(out)))
			continue
		}

		// Use run-as to copy into app's shared_prefs (single string to adb shell for correct quoting)
		out, err = exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.exitkiosk cp /data/local/tmp/prefs.xml shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("⚠️ run-as cp failed on %s: %s", dev.IP, string(out)))
			continue
		}

		// Set correct permissions
		exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.exitkiosk chmod 660 shared_prefs/PromptParkConfiguration.xml").Run()

		// Cleanup tmp on device
		exec.Command(adbPath, "-s", devAddr, "shell", "rm /data/local/tmp/prefs.xml").Run()

		a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("✅ Config pushed to %s (Gate %s)", dev.DeviceName, dev.GateNo))
	}

	a.emitEvent("exit-kiosk-progress", 100, "✅ Done deploying to all devices.")
}
