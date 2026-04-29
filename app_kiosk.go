package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

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

// EntranceConfig holds the full config for a single Entrance Kiosk
type EntranceConfig struct {
	IP                string `json:"ip"`
	DeviceName        string `json:"deviceName"`
	GateNo            string `json:"gateNo"`
	PlcIP             string `json:"plcIp"`
	ParkingCode       string `json:"parkingCode"`
	PaymentTicket     string `json:"paymentTicket"`
	ServerURL         string `json:"serverUrl"`
	LocalServerURL    string `json:"localServerUrl"`
	VehicleMode       string `json:"vehicleMode"`
	IsSpecialEntrance bool   `json:"isSpecialEntrance"`
	PaymentApiVersion string `json:"paymentApiVersion"`
	ApiMode           string `json:"apiMode"`
	ScreenTimeoutSec  int    `json:"screenTimeoutSec"`
	ZoningMode        string `json:"zoningMode"`
	ZoningCode        string `json:"zoningCode"`
	ZoningGateNo      string `json:"zoningGateNo"`
}

// ExitConfig holds the full config for a single Exit Kiosk
type ExitConfig struct {
	IP               string `json:"ip"`
	DeviceName       string `json:"deviceName"`
	GateNo           string `json:"gateNo"`
	PlcIP            string `json:"plcIp"`
	ParkingCode      string `json:"parkingCode"`
	ProjectCode      string `json:"projectCode"`
	PaymentTicket    string `json:"paymentTicket"`
	ServerURL        string `json:"serverUrl"`
	LocalServerURL   string `json:"localServerUrl"`
	VehicleMode      string `json:"vehicleMode"`
	ApiMode          string `json:"apiMode"`
	ZoningMode       string `json:"zoningMode"`
	ZoningCode       string `json:"zoningCode"`
	ZoningGateNo     string `json:"zoningGateNo"`
	NextZoningCode   string `json:"nextZoningCode"`
	NextZoningGateNo string `json:"nextZoningGateNo"`
	IsCash           bool   `json:"isCash"`
	IsQR             bool   `json:"isQR"`
	TicketMode       string `json:"ticketMode"`
}

// ParkingNameResponse handles the API response for fetching parking names
type ParkingNameResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ParkID     int    `json:"park_id"`
		ParkNameTH string `json:"park_name_th"`
		ParkNameEN string `json:"park_name_en"`
	} `json:"data"`
}

// fetchParkingName calls the API to get TH and EN parking names
func fetchParkingName(serverURL, parkingCode string) (string, string) {
	if serverURL == "" || parkingCode == "" {
		return "", ""
	}
	serverURL = strings.TrimRight(serverURL, "/")
	url := fmt.Sprintf("%s/api/v1-202402/parkings/get-parking-name?parking_code=%s", serverURL, parkingCode)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", ""
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", ""
	}

	var res ParkingNameResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return "", ""
	}

	if res.Status {
		return res.Data.ParkNameTH, res.Data.ParkNameEN
	}
	return "", ""
}

// GracePeriodResponse handles the API response for fetching grace periods
type GracePeriodResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ParkGracePeriod int `json:"park_grace_period"`
		ParkGraceExit   int `json:"park_grace_exit"`
	} `json:"data"`
}

// fetchGracePeriod calls the API to get grace periods
func fetchGracePeriod(serverURL, parkingCode string) (string, string) {
	if serverURL == "" || parkingCode == "" {
		return "", ""
	}
	serverURL = strings.TrimRight(serverURL, "/")
	url := fmt.Sprintf("%s/api/v1-202402/parkings/get-park-grace-period?parking_code=%s", serverURL, parkingCode)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", ""
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", ""
	}

	var res GracePeriodResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return "", ""
	}

	if res.Status {
		return fmt.Sprintf("%d", res.Data.ParkGracePeriod), fmt.Sprintf("%d", res.Data.ParkGraceExit)
	}
	return "", ""
}

// autoAllowPermissionDialogs uses UIAutomator to detect and auto-click OK/Allow
// buttons on USB permission dialogs. It polls for a specified duration.
func autoAllowPermissionDialogs(adbPath, devAddr string, durationSec int, emitFn func(string)) {
	// Button texts to look for (English and Thai)
	allowTexts := []string{"OK", "ok", "Ok", "ALLOW", "Allow", "allow", "ตกลง", "อนุญาต", "YES", "Yes", "Accept", "START", "Start", "เริ่ม", "Go", "เริ่มต้นใช้งาน", "ยืนยัน"}

	endTime := time.Now().Add(time.Duration(durationSec) * time.Second)
	dialogCount := 0

	for time.Now().Before(endTime) {
		// Dump current UI hierarchy to a file (more stable than /dev/tty)
		exec.Command(adbPath, "-s", devAddr, "shell", "uiautomator dump /sdcard/view.xml").Run()
		out, err := exec.Command(adbPath, "-s", devAddr, "shell", "cat /sdcard/view.xml").CombinedOutput()
		if err != nil || len(out) < 50 {
			time.Sleep(2 * time.Second)
			continue
		}

		uiDump := string(out)

		// Look for any allow/ok button in the UI
		found := false
		for _, btnText := range allowTexts {
			// Search for pattern: text="OK" ... bounds="[x1,y1][x2,y2]"
			searchPattern := `text="` + btnText + `"`
			idx := strings.Index(uiDump, searchPattern)
			if idx < 0 {
				continue
			}

			// Find the bounds attribute near this text
			substr := uiDump[idx:]
			boundsIdx := strings.Index(substr, `bounds="[`)
			if boundsIdx < 0 {
				continue
			}

			// Parse bounds="[x1,y1][x2,y2]"
			boundsStr := substr[boundsIdx+len(`bounds="`):]
			endIdx := strings.Index(boundsStr, `"`)
			if endIdx < 0 {
				continue
			}
			boundsStr = boundsStr[:endIdx]

			// Parse [x1,y1][x2,y2]
			var x1, y1, x2, y2 int
			n, parseErr := fmt.Sscanf(boundsStr, "[%d,%d][%d,%d]", &x1, &y1, &x2, &y2)
			if parseErr != nil || n != 4 {
				continue
			}

			// Tap center of the button
			centerX := (x1 + x2) / 2
			centerY := (y1 + y2) / 2

			dialogCount++
			if emitFn != nil {
				emitFn(fmt.Sprintf("🤖 Auto-clicking '%s' button #%d at (%d, %d)", btnText, dialogCount, centerX, centerY))
			}

			exec.Command(adbPath, "-s", devAddr, "shell", fmt.Sprintf("input tap %d %d", centerX, centerY)).Run()
			found = true
			time.Sleep(1 * time.Second) // Wait for dialog to dismiss and next one to appear
			break
		}

		if !found {
			// Also check for the "always allow" checkbox and tick it
			for _, checkText := range []string{"Always allow", "always allow", "ใช้เป็นค่าเริ่มต้น", "อนุญาตเสมอ"} {
				searchPattern := `text="` + checkText + `"`
				idx := strings.Index(uiDump, searchPattern)
				if idx < 0 {
					continue
				}
				substr := uiDump[idx:]
				boundsIdx := strings.Index(substr, `bounds="[`)
				if boundsIdx < 0 {
					continue
				}
				boundsStr := substr[boundsIdx+len(`bounds="`):]
				endIdx := strings.Index(boundsStr, `"`)
				if endIdx < 0 {
					continue
				}
				boundsStr = boundsStr[:endIdx]
				var x1, y1, x2, y2 int
				n, parseErr := fmt.Sscanf(boundsStr, "[%d,%d][%d,%d]", &x1, &y1, &x2, &y2)
				if parseErr != nil || n != 4 {
					continue
				}
				centerX := (x1 + x2) / 2
				centerY := (y1 + y2) / 2
				if emitFn != nil {
					emitFn(fmt.Sprintf("🤖 Ticking '%s' checkbox at (%d, %d)", checkText, centerX, centerY))
				}
				exec.Command(adbPath, "-s", devAddr, "shell", fmt.Sprintf("input tap %d %d", centerX, centerY)).Run()
				time.Sleep(500 * time.Millisecond)
			}
		}

		time.Sleep(2 * time.Second)
	}

	if emitFn != nil {
		if dialogCount > 0 {
			emitFn(fmt.Sprintf("✅ Auto-allowed %d permission dialog(s)", dialogCount))
		} else {
			emitFn("ℹ️ No permission dialogs detected (may already be granted)")
		}
	}
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
	if report := a.ValidateEntranceKioskConfig(config); !report.OK {
		a.emitEvent("kiosk-progress", 0, "Validation failed: "+formatValidationIssues(report))
		return
	}

	adbPath, err := findADB()
	if err != nil {
		a.emitEvent("kiosk-progress", 0, "❌ "+err.Error())
		return
	}
	a.emitEvent("kiosk-progress", 5, "✅ ADB found: "+adbPath)

	total := len(config.Devices)
	for i, dev := range config.Devices {
		progress := int((float64(i)/float64(total))*90) + 5
		devAddr := dev.IP + ":5555"

		// Step 1: ADB connect
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📡 Connecting to %s (%s)...", dev.DeviceName, dev.IP))
		out, err := exec.Command(adbPath, "connect", devAddr).CombinedOutput()
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to connect %s: %s", dev.IP, string(out)))
			continue
		}
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ Connected to %s: %s", dev.IP, strings.TrimSpace(string(out))))

		// Detect actual package name from the APK file
		pkgName := "com.example.entrancekiosk" // default
		if config.APKPath != "" {
			sdkRoot := os.Getenv("ANDROID_HOME")
			if sdkRoot == "" { sdkRoot = os.Getenv("ANDROID_SDK_ROOT") }
			if sdkRoot == "" { sdkRoot = `C:\Users\` + os.Getenv("USERNAME") + `\AppData\Local\Android\Sdk` }
			btDir := filepath.Join(sdkRoot, "build-tools")
			if entries, err := os.ReadDir(btDir); err == nil {
				for i := len(entries) - 1; i >= 0; i-- {
					candidate := filepath.Join(btDir, entries[i].Name(), "aapt2.exe")
					if _, err := os.Stat(candidate); err == nil {
						aaptOut, _ := exec.Command(candidate, "dump", "badging", config.APKPath).CombinedOutput()
						for _, line := range strings.Split(string(aaptOut), "\n") {
							if strings.HasPrefix(line, "package:") {
								parts := strings.Split(line, "'")
								if len(parts) >= 2 { pkgName = parts[1] }
								break
							}
						}
						break
					}
				}
			}
		}

		// Step 2: Install APK (Aggressive)
		if config.APKPath != "" {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📦 Preparing to install %s...", pkgName))
			
			// Uninstall old versions to be sure
			exec.Command(adbPath, "-s", devAddr, "uninstall", pkgName).Run()
			exec.Command(adbPath, "-s", devAddr, "uninstall", "mrta.kiosk.entrance_kiosk").Run()
			
			a.emitEvent("kiosk-progress", progress, "📦 Installing APK (Fresh)...")
			// -r: replace, -t: allow test, -g: grant all permissions
			out, err = exec.Command(adbPath, "-s", devAddr, "install", "-r", "-t", "-g", config.APKPath).CombinedOutput()
			installOutput := strings.TrimSpace(string(out))
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📋 Install output: %s", installOutput))
			
			if !strings.Contains(installOutput, "Success") {
				a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Install failed: %s", installOutput))
				continue
			}
			a.emitEvent("kiosk-progress", progress, "✅ APK installed successfully")
		}
		
		// Verify and wait
		time.Sleep(3 * time.Second)
		pmCheck, _ := exec.Command(adbPath, "-s", devAddr, "shell", "pm path "+pkgName).CombinedOutput()
		if strings.TrimSpace(string(pmCheck)) == "" {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚠️ Package '%s' not visible via pm path yet, but continuing anyway...", pkgName))
			// Let's try to see what's actually there one more time
			list, _ := exec.Command(adbPath, "-s", devAddr, "shell", "pm list packages | grep -E 'kiosk|entrance'").CombinedOutput()
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("🔍 Current packages: [%s]", strings.TrimSpace(string(list))))
		}

		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ Using package: %s", pkgName))
		
		// Auto-grant permissions
		a.emitEvent("kiosk-progress", progress, "🔑 Granting File & Media permissions...")
		exec.Command(adbPath, "-s", devAddr, "shell", "pm grant "+pkgName+" android.permission.READ_EXTERNAL_STORAGE").Run()
		exec.Command(adbPath, "-s", devAddr, "shell", "pm grant "+pkgName+" android.permission.WRITE_EXTERNAL_STORAGE").Run()
		exec.Command(adbPath, "-s", devAddr, "shell", "appops set "+pkgName+" MANAGE_EXTERNAL_STORAGE allow").Run()

		// Lock screen rotation
		exec.Command(adbPath, "-s", devAddr, "shell", "settings put system accelerometer_rotation 0").Run()
		exec.Command(adbPath, "-s", devAddr, "shell", "settings put system user_rotation 0").Run()

		// Step 3: Build and push SharedPreferences
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚙️ Writing SharedPreferences on %s...", dev.DeviceName))

		isSpecial := "false"
		if config.IsSpecialEntrance {
			isSpecial = "true"
		}

		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("🌐 Fetching parking info for %s...", config.ParkingCode))
		parkNameTH, _ := fetchParkingName(config.ServerURL, config.ParkingCode)
		gracePeriod, graceExit := fetchGracePeriod(config.ServerURL, config.ParkingCode)

		xmlContent := fmt.Sprintf(`<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="deviceNameConfig">%s</string>
    <string name="parkingCodeConfig">%s</string>
    <string name="parkingNameConfig">%s</string>
    <string name="parkGracePeriodConfig">%s</string>
    <string name="parkGraceExitConfig">%s</string>
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
			dev.DeviceName, config.ParkingCode, parkNameTH, gracePeriod, graceExit, config.PaymentTicket,
			config.ServerURL, config.LocalServerURL, dev.PlcIP,
			dev.GateNo, config.VehicleMode, isSpecial,
			config.PaymentApiVersion, config.ZoningMode,
			config.ZoningCode, config.ZoningGateNo,
			config.ApiMode, config.ScreenTimeoutSec*1000,
		)

		tmpFile, err := os.CreateTemp("", "prefs-*.xml")
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to create temp file: %v", err))
			continue
		}
		tmpFile.WriteString(xmlContent)
		tmpFile.Close()

		out, err = exec.Command(adbPath, "-s", devAddr, "push", tmpFile.Name(), "/data/local/tmp/prefs.xml").CombinedOutput()
		os.Remove(tmpFile.Name())
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to push prefs to %s: %s", dev.IP, string(out)))
			continue
		}

		// Try run-as first (debug APK), fallback to direct copy (release APK)
		exec.Command(adbPath, "-s", devAddr, "shell", "run-as "+pkgName+" mkdir -p shared_prefs").Run()
		cpOut, _ := exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as "+pkgName+" cp /data/local/tmp/prefs.xml shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
		cpResult := strings.TrimSpace(string(cpOut))

		if strings.Contains(cpResult, "not debuggable") || strings.Contains(cpResult, "No such file") || strings.Contains(cpResult, "couldn't stat") {
			a.emitEvent("kiosk-progress", progress, "📋 Release APK detected, using direct path method...")
			appDataPath := fmt.Sprintf("/data/data/%s/shared_prefs/", pkgName)
			exec.Command(adbPath, "-s", devAddr, "shell", "mkdir -p "+appDataPath).Run()
			directOut, _ := exec.Command(adbPath, "-s", devAddr, "shell",
				"cp /data/local/tmp/prefs.xml "+appDataPath+"PromptParkConfiguration.xml").CombinedOutput()
			directResult := strings.TrimSpace(string(directOut))

			if directResult != "" && strings.Contains(directResult, "denied") {
				// Last resort: push to /sdcard/
				exec.Command(adbPath, "-s", devAddr, "shell", "cp /data/local/tmp/prefs.xml /sdcard/PromptParkConfiguration.xml").Run()
				a.emitEvent("kiosk-progress", progress, "📁 Config saved to /sdcard/PromptParkConfiguration.xml")
				a.emitEvent("kiosk-progress", progress, "⚠️ Release APK without root: build with debuggable=true in build.gradle for full automation")
			} else {
				a.emitEvent("kiosk-progress", progress, "✅ Config written via direct path")
			}
		} else {
			exec.Command(adbPath, "-s", devAddr, "shell",
				"run-as "+pkgName+" chmod 660 shared_prefs/PromptParkConfiguration.xml").Run()
			a.emitEvent("kiosk-progress", progress, "✅ Config written via run-as")
		}

		exec.Command(adbPath, "-s", devAddr, "shell", "rm /data/local/tmp/prefs.xml").Run()
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("✅ Config pushed to %s (Gate %s)", dev.DeviceName, dev.GateNo))

		// Step 4: Restart App (use am start to avoid monkey rotation issue)
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("🚀 Restarting App on %s...", dev.DeviceName))
		exec.Command(adbPath, "-s", devAddr, "shell", "am force-stop "+pkgName).Run()

		// Resolve main activity and launch
		launchOut, _ := exec.Command(adbPath, "-s", devAddr, "shell",
			"cmd package resolve-activity --brief "+pkgName+" | tail -n 1").CombinedOutput()
		launchActivity := strings.TrimSpace(string(launchOut))

		if launchActivity != "" && strings.Contains(launchActivity, "/") {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📱 Launching: %s", launchActivity))
			exec.Command(adbPath, "-s", devAddr, "shell", "am start -n "+launchActivity).Run()
		} else {
			exec.Command(adbPath, "-s", devAddr, "shell", "monkey -p "+pkgName+" --pct-rotation 0 -c android.intent.category.LAUNCHER 1").Run()
		}

		// Step 5: Auto-allow USB permission dialogs
		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("🤖 Watching for USB permission dialogs on %s (30s)...", dev.DeviceName))
		autoAllowPermissionDialogs(adbPath, devAddr, 30, func(msg string) {
			a.emitEvent("kiosk-progress", progress, msg)
		})
	}

	a.emitEvent("kiosk-progress", 100, "✅ Done deploying to all devices.")
}

// ReadEntranceKioskConfig connects to the device via ADB and reads the SharedPreferences XML
func (a *App) ReadEntranceKioskConfig(ip string) (map[string]string, error) {
	adbPath, err := findADB()
	if err != nil {
		return nil, fmt.Errorf("ADB not found: %v", err)
	}

	devAddr := ip + ":5555"

	// Connect
	exec.Command(adbPath, "connect", devAddr).Run()

	// Verify connection
	out, _ := exec.Command(adbPath, "devices").CombinedOutput()
	if !strings.Contains(string(out), devAddr) {
		return nil, fmt.Errorf("failed to connect to %s", ip)
	}

	// Read shared_prefs via run-as
	out, err = exec.Command(adbPath, "-s", devAddr, "shell",
		"run-as com.example.entrancekiosk cat shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to read config on %s (is the app installed?): %s", ip, string(out))
	}

	xmlData := string(out)

	// Parse XML (simple string parsing since it's a flat map of strings and booleans)
	result := make(map[string]string)

	lines := strings.Split(xmlData, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "<string name=\"") {
			parts := strings.SplitN(line, "\"", 3)
			if len(parts) >= 3 {
				key := parts[1]
				valParts := strings.SplitN(parts[2], ">", 2)
				if len(valParts) >= 2 {
					val := strings.SplitN(valParts[1], "<", 2)[0]
					result[key] = val
				}
			}
		} else if strings.HasPrefix(line, "<boolean name=\"") {
			parts := strings.Split(line, "\"")
			if len(parts) >= 5 {
				key := parts[1]
				val := parts[3]
				result[key] = val
			}
		} else if strings.HasPrefix(line, "<long name=\"") {
			parts := strings.Split(line, "\"")
			if len(parts) >= 5 {
				key := parts[1]
				val := parts[3]
				result[key] = val
			}
		}
	}

	return result, nil
}

// DeployExitKioskAPK automates ADB installation and Exit Kiosk SharedPreferences config push
func (a *App) DeployExitKioskAPK(config ExitKioskDeployConfig) {
	if report := a.ValidateExitKioskConfig(config); !report.OK {
		a.emitEvent("exit-kiosk-progress", 0, "Validation failed: "+formatValidationIssues(report))
		return
	}

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

		// Use run-as to copy into app's shared_prefs (create dir first for fresh installs)
		exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.exitkiosk mkdir -p shared_prefs").Run()
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

// ReadExitKioskConfig connects to the device via ADB and reads the Exit Kiosk SharedPreferences XML
func (a *App) ReadExitKioskConfig(ip string) (map[string]string, error) {
	adbPath, err := findADB()
	if err != nil {
		return nil, fmt.Errorf("ADB not found: %v", err)
	}

	devAddr := ip + ":5555"

	// Connect
	exec.Command(adbPath, "connect", devAddr).Run()

	// Verify connection
	out, _ := exec.Command(adbPath, "devices").CombinedOutput()
	if !strings.Contains(string(out), devAddr) {
		return nil, fmt.Errorf("failed to connect to %s", ip)
	}

	// Read shared_prefs via run-as
	out, err = exec.Command(adbPath, "-s", devAddr, "shell",
		"run-as com.example.exitkiosk cat shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to read config on %s (is the app installed?): %s", ip, string(out))
	}

	xmlData := string(out)

	// Parse XML
	result := make(map[string]string)

	lines := strings.Split(xmlData, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "<string name=\"") {
			parts := strings.SplitN(line, "\"", 3)
			if len(parts) >= 3 {
				key := parts[1]
				valParts := strings.SplitN(parts[2], ">", 2)
				if len(valParts) >= 2 {
					val := strings.SplitN(valParts[1], "<", 2)[0]
					result[key] = val
				}
			}
		} else if strings.HasPrefix(line, "<boolean name=\"") {
			parts := strings.Split(line, "\"")
			if len(parts) >= 5 {
				key := parts[1]
				val := parts[3]
				result[key] = val
			}
		}
	}

	return result, nil
}

// UpdateEntranceKioskConfig pushes XML to multiple devices without installing the APK
func (a *App) UpdateEntranceKioskConfig(configs []EntranceConfig) {
	adbPath, err := findADB()
	if err != nil {
		a.emitEvent("kiosk-progress", 0, "❌ "+err.Error())
		return
	}

	total := len(configs)
	for i, dev := range configs {
		progress := int((float64(i) / float64(total)) * 100)
		devAddr := dev.IP + ":5555"

		a.emitEvent("kiosk-progress", progress, fmt.Sprintf("📡 Connecting to %s (%s)...", dev.DeviceName, dev.IP))
		out, err := exec.Command(adbPath, "connect", devAddr).CombinedOutput()
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to connect %s: %s", dev.IP, string(out)))
			continue
		}

		a.emitEvent("kiosk-progress", progress+2, fmt.Sprintf("⚙️ Writing SharedPreferences on %s...", dev.DeviceName))

		isSpecial := "false"
		if dev.IsSpecialEntrance {
			isSpecial = "true"
		}

		// Fetch Parking Info from API
		a.emitEvent("kiosk-progress", progress+1, fmt.Sprintf("🌐 Fetching parking info for %s...", dev.ParkingCode))
		parkNameTH, _ := fetchParkingName(dev.ServerURL, dev.ParkingCode)
		gracePeriod, graceExit := fetchGracePeriod(dev.ServerURL, dev.ParkingCode)

		xmlContent := fmt.Sprintf(`<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="deviceNameConfig">%s</string>
    <string name="parkingCodeConfig">%s</string>
    <string name="parkingNameConfig">%s</string>
    <string name="parkGracePeriodConfig">%s</string>
    <string name="parkGraceExitConfig">%s</string>
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
			dev.DeviceName, dev.ParkingCode, parkNameTH, gracePeriod, graceExit, dev.PaymentTicket,
			dev.ServerURL, dev.LocalServerURL, dev.PlcIP,
			dev.GateNo, dev.VehicleMode, isSpecial,
			dev.PaymentApiVersion, dev.ZoningMode,
			dev.ZoningCode, dev.ZoningGateNo,
			dev.ApiMode, dev.ScreenTimeoutSec*1000,
		)

		tmpFile, err := os.CreateTemp("", "prefs-*.xml")
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to create temp file: %v", err))
			continue
		}
		tmpFile.WriteString(xmlContent)
		tmpFile.Close()

		out, err = exec.Command(adbPath, "-s", devAddr, "push", tmpFile.Name(), "/data/local/tmp/prefs.xml").CombinedOutput()
		os.Remove(tmpFile.Name())
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("❌ Failed to push prefs to %s: %s", dev.IP, string(out)))
			continue
		}

		// Create shared_prefs dir first (for fresh installs)
		exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.entrancekiosk mkdir -p shared_prefs").Run()
		out, err = exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.entrancekiosk cp /data/local/tmp/prefs.xml shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
		if err != nil {
			a.emitEvent("kiosk-progress", progress, fmt.Sprintf("⚠️ run-as cp failed on %s: %s", dev.IP, string(out)))
			continue
		}

		exec.Command(adbPath, "-s", devAddr, "shell", "run-as com.example.entrancekiosk chmod 660 shared_prefs/PromptParkConfiguration.xml").Run()
		exec.Command(adbPath, "-s", devAddr, "shell", "rm /data/local/tmp/prefs.xml").Run()

		a.emitEvent("kiosk-progress", progress+5, fmt.Sprintf("✅ Config pushed to %s", dev.DeviceName))

		// Step 4: Restart App and bypass to Landing Activity
		a.emitEvent("kiosk-progress", progress+5, fmt.Sprintf("🚀 Restarting App on %s...", dev.DeviceName))
		exec.Command(adbPath, "-s", devAddr, "shell", "am force-stop com.example.entrancekiosk").Run()
		
		// Try to start MainActivity with autoStart flag
		outStart, errStart := exec.Command(adbPath, "-s", devAddr, "shell", "am start -n com.example.entrancekiosk/.ui.main.MainActivity --ez autoStart true").CombinedOutput()
		if errStart != nil || strings.Contains(string(outStart), "Error") || strings.Contains(string(outStart), "Exception") {
			a.emitEvent("kiosk-progress", progress+5, fmt.Sprintf("⚠️ Could not start MainActivity: %s. Starting default screen instead.", strings.TrimSpace(string(outStart))))
			// Fallback: Start the default main activity
			exec.Command(adbPath, "-s", devAddr, "shell", "monkey -p com.example.entrancekiosk -c android.intent.category.LAUNCHER 1").Run()
		}
	}

	a.emitEvent("kiosk-progress", 100, "✅ Done saving to all devices.")
}

// UpdateExitKioskConfig pushes XML to multiple devices without installing the APK
func (a *App) UpdateExitKioskConfig(configs []ExitConfig) {
	adbPath, err := findADB()
	if err != nil {
		a.emitEvent("exit-kiosk-progress", 0, "❌ Error: ADB not found!")
		return
	}

	total := len(configs)
	for i, dev := range configs {
		progress := int((float64(i) / float64(total)) * 100)
		devAddr := dev.IP + ":5555"

		a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("📡 Connecting to %s (%s)...", dev.DeviceName, dev.IP))
		exec.Command(adbPath, "connect", devAddr).Run()

		out, _ := exec.Command(adbPath, "devices").CombinedOutput()
		if !strings.Contains(string(out), devAddr) {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to connect to %s", dev.IP))
			continue
		}

		a.emitEvent("exit-kiosk-progress", progress+2, fmt.Sprintf("⚙️ Writing SharedPreferences on %s...", dev.DeviceName))

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
			dev.DeviceName, dev.ParkingCode, dev.ProjectCode, dev.PaymentTicket,
			dev.ServerURL, dev.LocalServerURL, dev.PlcIP,
			dev.GateNo, dev.VehicleMode, dev.ApiMode, dev.ZoningMode,
			dev.ZoningCode, dev.ZoningGateNo, dev.NextZoningCode, dev.NextZoningGateNo,
			dev.IsCash, dev.IsQR, dev.TicketMode,
		)

		tmpFile, err := os.CreateTemp("", "exit-prefs-*.xml")
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to create temp file: %v", err))
			continue
		}
		tmpFile.WriteString(xmlContent)
		tmpFile.Close()

		out, err = exec.Command(adbPath, "-s", devAddr, "push", tmpFile.Name(), "/data/local/tmp/prefs.xml").CombinedOutput()
		os.Remove(tmpFile.Name())
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("❌ Failed to push prefs to %s: %s", dev.IP, string(out)))
			continue
		}

		// Create shared_prefs dir first (for fresh installs)
		exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.exitkiosk mkdir -p shared_prefs").Run()
		out, err = exec.Command(adbPath, "-s", devAddr, "shell",
			"run-as com.example.exitkiosk cp /data/local/tmp/prefs.xml shared_prefs/PromptParkConfiguration.xml").CombinedOutput()
		if err != nil {
			a.emitEvent("exit-kiosk-progress", progress, fmt.Sprintf("⚠️ run-as cp failed on %s: %s", dev.IP, string(out)))
			continue
		}

		exec.Command(adbPath, "-s", devAddr, "shell", "run-as com.example.exitkiosk chmod 660 shared_prefs/PromptParkConfiguration.xml").Run()
		exec.Command(adbPath, "-s", devAddr, "shell", "rm /data/local/tmp/prefs.xml").Run()

		a.emitEvent("exit-kiosk-progress", progress+5, fmt.Sprintf("✅ Config pushed to %s", dev.DeviceName))
	}

	a.emitEvent("exit-kiosk-progress", 100, "✅ Done saving to all devices.")
}
