package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/icholy/digest"
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

// ConfigureHikvisionISAPI connects to each camera via Digest Auth and sets the HTTP Host
func (a *App) ConfigureHikvisionISAPI(config HikvisionConfig) {
	if report := a.ValidateHikvisionConfig(config); !report.OK {
		a.emitEvent("hik-progress", 0, "Validation failed: "+formatValidationIssues(report))
		return
	}

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
