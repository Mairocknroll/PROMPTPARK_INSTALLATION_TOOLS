package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
