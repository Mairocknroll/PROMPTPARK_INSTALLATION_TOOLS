package main

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (a *App) SendMockCameraEvent(url string, licensePlate string) (string, error) {
	// Create mock_images folder if not exists
	imgDir := "mock_images"
	if err := os.MkdirAll(imgDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create mock_images folder: %v", err)
	}

	detPicPath := filepath.Join(imgDir, "detectionPicture.jpg")
	licPicPath := filepath.Join(imgDir, "licensePlatePicture.jpg")

	// Create dummy image files if they don't exist
	for _, path := range []string{detPicPath, licPicPath} {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			if err := os.WriteFile(path, []byte("dummy image content"), 0644); err != nil {
				return "", fmt.Errorf("failed to create dummy image %s: %v", path, err)
			}
		}
	}

	xmlPayload := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<EventNotificationAlert version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<ipAddress>172.20.16.40</ipAddress>
<ipv6Address>::</ipv6Address>
<protocol>HTTP</protocol>
<macAddress>44:a6:42:f3:2a:d7</macAddress>
<dynChannelID>1</dynChannelID>
<channelID>1</channelID>
<dateTime>2024-05-07T17:48:03.847+07:00</dateTime>
<activePostCount>80</activePostCount>
<eventType>ANPR</eventType>
<eventState>active</eventState>
<eventDescription>ANPR</eventDescription>
<channelName>IP CAPTURE CAMERA</channelName>
<deviceID>88</deviceID>
<ANPR>
<country>64</country>
<licensePlate>%s</licensePlate>
<line>1</line>
<direction>forward</direction>
<confidenceLevel>98</confidenceLevel>
<plateType>unknown</plateType>
<plateColor>unknown</plateColor>
<tailandStateID>1</tailandStateID>
<licenseBright>173</licenseBright>
<pilotsafebelt>unknown</pilotsafebelt>
<vicepilotsafebelt>unknown</vicepilotsafebelt>
<pilotsunvisor>unknown</pilotsunvisor>
<vicepilotsunvisor>unknown</vicepilotsunvisor>
<envprosign>unknown</envprosign>
<dangmark>unknown</dangmark>
<uphone>unknown</uphone>
<pendant>unknown</pendant>
<tissueBox>unknown</tissueBox>
<frontChild>unknown</frontChild>
<label>unknown</label>
<smoking>unknown</smoking>
<perfumeBox>unknown</perfumeBox>
<pdvs>unknown</pdvs>
<helmet>unknown</helmet>
<decoration>unknown</decoration>
<pilotmask></pilotmask>
<vicepilotMask></vicepilotMask>
<plateCharBelieve>99,99,99,99,99,99,99</plateCharBelieve>
<speedLimit>0</speedLimit>
<illegalInfo>
<illegalCode>0</illegalCode>
<illegalName>Normal</illegalName>
<illegalDescription></illegalDescription>
</illegalInfo>
<vehicleType>SUVMPV</vehicleType>
<featurePicFileName>1</featurePicFileName>
<detectDir>8</detectDir>
<relaLaneDirectionType>0</relaLaneDirectionType>
<detectType>2</detectType>
<barrierGateCtrlType>1</barrierGateCtrlType>
<alarmDataType>0</alarmDataType>
<dwIllegalTime>0</dwIllegalTime>
<vehicleInfo>
<index>0</index>
<vehicleType>1</vehicleType>
<colorDepth>0</colorDepth>
<color>unknown</color>
<speed>0</speed>
<length>0</length>
<vehicleLogoRecog>0</vehicleLogoRecog>
<vehileSubLogoRecog>0</vehileSubLogoRecog>
<vehileModel>0</vehileModel>
<CarWindowFeature>
<tempPlate>unknown</tempPlate>
<passCard>unknown</passCard>
<carCard>unknown</carCard>
</CarWindowFeature>
<CarBodyFeature>
<sparetire>unknown</sparetire>
<rack>unknown</rack>
<sunRoof>unknown</sunRoof>
<words>unknown</words>
</CarBodyFeature>
<vehicleUseType>unknown</vehicleUseType>
</vehicleInfo>
<pictureInfoList>
<pictureInfo>
<fileName>detectionPicture.jpg</fileName>
<type>detectionPicture</type>
<dataType>0</dataType>
<absTime>20240507174803847</absTime>
<plateRect>
<X>430</X>
<Y>275</Y>
<width>106</width>
<height>65</height>
</plateRect>
<vehicelRect>
<X>271</X>
<Y>0</Y>
<width>425</width>
<height>426</height>
</vehicelRect>
<PilotRect>
<x>0</x>
<y>0</y>
<width>0</width>
<height>0</height>
</PilotRect>
<VicepilotRect>
<x>0</x>
<y>0</y>
<width>0</width>
<height>0</height>
</VicepilotRect>
<VehicelWindowRect>
<x>0</x>
<y>0</y>
<width>0</width>
<height>0</height>
</VehicelWindowRect>
<capturePicSecurityCode></capturePicSecurityCode>
</pictureInfo>
<pictureInfo>
<fileName>licensePlatePicture.jpg</fileName>
<type>licensePlatePicture</type>
<dataType>0</dataType>
</pictureInfo>
</pictureInfoList>
<listType>temporary</listType>
<originalLicensePlate>%s</originalLicensePlate>
</ANPR>
<UUID>a0fe72d4-3652-464a-aebd-3f9190010236</UUID>
<picNum>2</picNum>
<monitoringSiteID></monitoringSiteID>
<monitorDescription></monitorDescription>
<DeviceGPSInfo>
<longitudeType>E</longitudeType>
<latitudeType>S</latitudeType>
<Longitude>
<degree>0</degree>
<minute>0</minute>
<sec>0.000000</sec>
</Longitude>
<Latitude>
<degree>0</degree>
<minute>0</minute>
<sec>0.000000</sec>
</Latitude>
</DeviceGPSInfo>
<carDirectionType>0</carDirectionType>
<deviceUUID>DS-TCG405-E 20220323AIJ67694167</deviceUUID>
<VehicleGATInfo>
<palteTypeByGAT>2</palteTypeByGAT>
<plateColorByGAT>-1</plateColorByGAT>
<vehicleTypeByGAT>K33</vehicleTypeByGAT>
<colorByGAT>K</colorByGAT>
</VehicleGATInfo>
</EventNotificationAlert>`, licensePlate, licensePlate)

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
