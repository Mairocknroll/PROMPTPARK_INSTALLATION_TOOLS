package main

import (
	"bytes"
	"embed"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

//go:embed mock_images/anpr.xml mock_images/detectionPicture.jpg mock_images/licensePlatePicture.jpg
var defaultMockImages embed.FS

func mockImagesDir() string {
	return filepath.Join(dataDir(), "mock_images")
}

func ensureDefaultMockAsset(imgDir string, filename string) error {
	targetPath := filepath.Join(imgDir, filename)
	if _, err := os.Stat(targetPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("failed to check mock asset %s: %v", targetPath, err)
	}

	data, err := defaultMockImages.ReadFile(filepath.ToSlash(filepath.Join("mock_images", filename)))
	if err != nil {
		return fmt.Errorf("failed to read embedded mock asset %s: %v", filename, err)
	}
	if err := os.WriteFile(targetPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write mock asset %s: %v", targetPath, err)
	}
	return nil
}

func ensureDefaultMockAssets(imgDir string) error {
	if err := os.MkdirAll(imgDir, 0755); err != nil {
		return fmt.Errorf("failed to create mock_images folder: %v", err)
	}
	for _, filename := range []string{"anpr.xml", "detectionPicture.jpg", "licensePlatePicture.jpg"} {
		if err := ensureDefaultMockAsset(imgDir, filename); err != nil {
			return err
		}
	}
	return nil
}

func buildMockANPRPayload(templatePath string, licensePlate string) (string, error) {
	templateBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read mock XML template %s: %v", templatePath, err)
	}

	xmlPayload := string(templateBytes)
	for _, tagName := range []string{"licensePlate", "originalLicensePlate"} {
		nextPayload, ok := replaceXMLTagContent(xmlPayload, tagName, licensePlate)
		if !ok {
			return "", fmt.Errorf("mock XML template missing <%s> tag", tagName)
		}
		xmlPayload = nextPayload
	}

	nextPayload, ok := replaceXMLTagContent(xmlPayload, "UUID", uuid.NewString())
	if !ok {
		return "", fmt.Errorf("mock XML template missing <UUID> tag")
	}
	xmlPayload = nextPayload
	return xmlPayload, nil
}

func replaceXMLTagContent(xmlPayload string, tagName string, value string) (string, bool) {
	tagPattern := regexp.MustCompile(`(?s)<` + tagName + `>.*?</` + tagName + `>`)
	if !tagPattern.MatchString(xmlPayload) {
		return xmlPayload, false
	}
	replacement := fmt.Sprintf("<%s>%s</%s>", tagName, escapeXMLText(value), tagName)
	return tagPattern.ReplaceAllStringFunc(xmlPayload, func(string) string { return replacement }), true
}

func escapeXMLText(value string) string {
	var buffer bytes.Buffer
	_ = xml.EscapeText(&buffer, []byte(value))
	return buffer.String()
}

func (a *App) SendMockCameraEvent(url string, licensePlate string) (string, error) {
	imgDir := mockImagesDir()
	if err := ensureDefaultMockAssets(imgDir); err != nil {
		return "", err
	}

	xmlTemplatePath := filepath.Join(imgDir, "anpr.xml")
	detPicPath := filepath.Join(imgDir, "detectionPicture.jpg")
	licPicPath := filepath.Join(imgDir, "licensePlatePicture.jpg")

	xmlPayload, err := buildMockANPRPayload(xmlTemplatePath, licensePlate)
	if err != nil {
		return "", err
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add xml_file
	part, err := writer.CreateFormFile("xml_file", "anpr.xml")
	if err != nil {
		return "", err
	}
	_, err = io.Copy(part, strings.NewReader(xmlPayload))
	if err != nil {
		return "", err
	}

	// Add detectionPicture.jpg
	file1, err := os.Open(detPicPath)
	if err != nil {
		return "", err
	}
	defer file1.Close()
	part1, err := writer.CreateFormFile("image_file", "detectionPicture.jpg")
	if err != nil {
		return "", err
	}
	_, err = io.Copy(part1, file1)
	if err != nil {
		return "", err
	}

	// Add licensePlatePicture.jpg
	file2, err := os.Open(licPicPath)
	if err != nil {
		return "", err
	}
	defer file2.Close()
	part2, err := writer.CreateFormFile("image_file", "licensePlatePicture.jpg")
	if err != nil {
		return "", err
	}
	_, err = io.Copy(part2, file2)
	if err != nil {
		return "", err
	}

	err = writer.Close()
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	return fmt.Sprintf("Status: %s\n\nBody: %s", resp.Status, string(respBody)), nil
}
