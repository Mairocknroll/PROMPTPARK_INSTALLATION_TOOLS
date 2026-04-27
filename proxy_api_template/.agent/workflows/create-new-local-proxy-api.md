---
description: สร้าง Local Proxy API ใหม่ด้วย Clean Architecture และ SSE แทน WebSocket
---

# Workflow: Create New Local Proxy API

## Overview
สร้างโปรเจค Go API ใหม่สำหรับ Local Proxy Server ที่มี:
- Clean Architecture แยก layer ชัดเจน
- SSE (Server-Sent Events) แทน WebSocket
- Shared domain models สำหรับ Hikvision camera XML parsing
- Barrier Manager ใน utils
- Flexible Image Handler

## Reference Files
อ้างอิง codebase เดิมที่ `d:\Implement\GO_LANG_WORKSPACE`:
- `internal/order/handler.go` - Logic สำหรับ entrance/exit
- `internal/zoning/handler.go` - Logic สำหรับ zoning
- `internal/barrier_v2/handler.go` - Modbus barrier control
- `internal/image_v2/handler.go` - Image fetching
- `internal/ws/hub.go` - WebSocket hub (เปลี่ยนเป็น SSE)
- `internal/utils/*` - Utility functions
- `internal/config/config.go` - Configuration
- `cmd/server/main.go` - Entry point

---

## Phase 1: Project Setup

### Step 1.1: Create new project directory
// turbo
```bash
mkdir -p d:\Implement\new-local-proxy-api
cd d:\Implement\new-local-proxy-api
```

### Step 1.2: Initialize Go module
// turbo
```bash
go mod init new-local-proxy-api
```

### Step 1.3: Create folder structure
// turbo
```bash
mkdir -p cmd/server
mkdir -p internal/config
mkdir -p internal/domain/camera
mkdir -p internal/domain/vehicle
mkdir -p internal/entrance
mkdir -p internal/exit
mkdir -p internal/zoning
mkdir -p internal/proxy
mkdir -p internal/barrier
mkdir -p internal/image
mkdir -p internal/sse
mkdir -p internal/mqtt
mkdir -p internal/middleware
mkdir -p pkg/utils
```

### Step 1.4: Create .env.example
สร้างไฟล์ `.env.example` โดยคัดลอกโครงสร้างจาก `d:\Implement\GO_LANG_WORKSPACE\.env`

### Step 1.5: Copy .env
// turbo
```bash
copy d:\Implement\GO_LANG_WORKSPACE\.env d:\Implement\new-local-proxy-api\.env
```

---

## Phase 2: Utils Layer (pkg/utils)

### Step 2.1: Create barrier_manager.go
สร้าง `pkg/utils/barrier_manager.go` ที่มี:
- Modbus TCP client functions
- `OpenBarrier(direction, gate string) error`
- `CloseBarrier(direction, gate string) error`
- `OpenZoning(direction, gate string) error`
- `CloseZoning(direction, gate string) error`

อ้างอิง logic จาก `d:\Implement\GO_LANG_WORKSPACE\internal\barrier_v2\handler.go`:
- ดูฟังก์ชัน `toggleCoil`, `getDeviceIP`, environment variable helpers
- ย้าย `OpenBarrierByGate`, `OpenZoningByGate` มาเป็น public functions

### Step 2.2: Create deduper.go
คัดลอก `d:\Implement\GO_LANG_WORKSPACE\internal\utils\deuper.go` ไปที่ `pkg/utils/deduper.go`

### Step 2.3: Create display.go และ display_helper.go
คัดลอกไฟล์ display จาก utils เดิม:
- `pkg/utils/display.go`
- `pkg/utils/display_helper.go`

### Step 2.4: Create province_helper.go
คัดลอก `d:\Implement\GO_LANG_WORKSPACE\internal\utils\province_helper.go` ไปที่ `pkg/utils/province_helper.go`

### Step 2.5: Create vehicle.go
คัดลอก `d:\Implement\GO_LANG_WORKSPACE\internal\utils\vehicle.go` ไปที่ `pkg/utils/vehicle.go`

### Step 2.6: Create http_helper.go
สร้าง HTTP client helpers สำหรับ:
- JSON GET/POST requests
- Digest authentication for cameras

---

## Phase 3: Config Layer (internal/config)

### Step 3.1: Create config.go
สร้าง `internal/config/config.go` โดยอ้างอิงจาก `d:\Implement\GO_LANG_WORKSPACE\internal\config\config.go`:
- Load environment variables
- Config struct with all settings
- Camera host resolution methods
- HTTP transport configuration

---

## Phase 4: Domain Layer (internal/domain)

### Step 4.1: Create camera/event.go
สร้าง `internal/domain/camera/event.go`:

```go
package camera

import "encoding/xml"

// EventNotificationAlert - Hikvision camera XML with namespace
type EventNotificationAlert struct {
    XMLName   xml.Name `xml:"http://www.isapi.org/ver20/XMLSchema EventNotificationAlert"`
    UUID      string   `xml:"UUID"`
    DateTime  string   `xml:"dateTime"`
    IPAddress string   `xml:"ipAddress"`
    ANPR      ANPRData `xml:"ANPR"`
}

// EventNotificationAlertNoNS - Fallback without namespace
type EventNotificationAlertNoNS struct {
    XMLName   xml.Name `xml:"EventNotificationAlert"`
    UUID      string   `xml:"UUID"`
    DateTime  string   `xml:"dateTime"`
    IPAddress string   `xml:"ipAddress"`
    ANPR      ANPRData `xml:"ANPR"`
}

type ANPRData struct {
    LicensePlate   string `xml:"licensePlate"`
    VehicleType    string `xml:"vehicleType"`
    TailandStateID string `xml:"tailandStateID"`
}
```

### Step 4.2: Create camera/parser.go
สร้าง `internal/domain/camera/parser.go`:

```go
package camera

import (
    "encoding/xml"
    "fmt"
    "strings"
)

type ParsedEvent struct {
    LicensePlate string
    UUID         string
    DateTime     string
    IPAddress    string
    VehicleType  string
    ProvinceID   string
}

func ParseXML(data []byte) (*ParsedEvent, error) {
    // Try with namespace first
    var ev EventNotificationAlert
    if err := xml.Unmarshal(data, &ev); err == nil {
        if plate := strings.TrimSpace(ev.ANPR.LicensePlate); plate != "" {
            return &ParsedEvent{
                LicensePlate: plate,
                UUID:         strings.TrimSpace(ev.UUID),
                DateTime:     strings.TrimSpace(ev.DateTime),
                IPAddress:    strings.TrimSpace(ev.IPAddress),
                VehicleType:  strings.TrimSpace(ev.ANPR.VehicleType),
                ProvinceID:   strings.TrimSpace(ev.ANPR.TailandStateID),
            }, nil
        }
    }
    
    // Fallback to no namespace
    var ev2 EventNotificationAlertNoNS
    if err := xml.Unmarshal(data, &ev2); err == nil {
        if plate := strings.TrimSpace(ev2.ANPR.LicensePlate); plate != "" {
            return &ParsedEvent{
                LicensePlate: plate,
                UUID:         strings.TrimSpace(ev2.UUID),
                DateTime:     strings.TrimSpace(ev2.DateTime),
                IPAddress:    strings.TrimSpace(ev2.IPAddress),
                VehicleType:  strings.TrimSpace(ev2.ANPR.VehicleType),
                ProvinceID:   strings.TrimSpace(ev2.ANPR.TailandStateID),
            }, nil
        }
    }
    
    return nil, fmt.Errorf("failed to parse XML or license plate empty")
}
```

### Step 4.3: Create vehicle/types.go
สร้าง `internal/domain/vehicle/types.go`:
- VehicleType function (อ้างอิงจาก utils เดิม)
- Province helper (อ้างอิงจาก utils เดิม)

---

## Phase 5: SSE Module (internal/sse)

### Step 5.1: Create sse/hub.go
สร้าง SSE Hub ที่จัดการ client connections และ broadcasts:

```go
package sse

import (
    "log"
    "sync"
)

type Client struct {
    ID       string
    Group    string
    Messages chan []byte
}

type Hub struct {
    mu         sync.RWMutex
    clients    map[string]map[*Client]bool
    register   chan *Client
    unregister chan *Client
    broadcast  chan Message
}

type Message struct {
    Group string
    Data  []byte
}

func NewHub() *Hub { ... }
func (h *Hub) Run() { ... }
func (h *Hub) Register(client *Client) { ... }
func (h *Hub) Unregister(client *Client) { ... }
func (h *Hub) Broadcast(group string, data []byte) { ... }
```

อ้างอิง pattern จาก `d:\Implement\GO_LANG_WORKSPACE\internal\ws\hub.go` แต่ปรับเป็น SSE

### Step 5.2: Create sse/handler.go
สร้าง SSE HTTP handlers:
- `ServeEntranceSSE` - GET /sse/entrance/:gate_no
- `ServeExitSSE` - GET /sse/exit/:gate_no
- `ServeZoningSSE` - GET /sse/zoning/:direction/:zoning_code/:gate_no

ใช้ Gin's `c.SSEvent()` และ `c.Writer.Flush()` สำหรับ streaming

---

## Phase 6: Image Module (internal/image)

### Step 6.1: Create image/types.go
```go
package image

type ImageType string

const (
    ImageTypeLPR    ImageType = "LPR"    // License Plate Recognition camera
    ImageTypeDriver ImageType = "DRIVER" // Driver/face camera
    ImageTypeLPC    ImageType = "LPC"    // License Plate Close-up camera
)

type FetchRequest struct {
    GateNo     string      `json:"gate_no" binding:"required"`
    Direction  string      `json:"direction" binding:"required"`
    ImageTypes []ImageType `json:"image_types" binding:"required"`
}

type FetchResponse struct {
    Status  bool                  `json:"status"`
    Message string                `json:"message"`
    Data    map[ImageType]*string `json:"data"`
}
```

### Step 6.2: Create image/fetcher.go
สร้าง flexible image fetcher:
- `FetchImages(req FetchRequest) map[ImageType]*string`
- Concurrent fetching ด้วย goroutines
- Support LPR, DRIVER, LPC camera types
- Digest authentication

อ้างอิง logic จาก `d:\Implement\GO_LANG_WORKSPACE\internal\utils\fetch_image.go`

### Step 6.3: Create image/handler.go
สร้าง HTTP handlers:
- `GetEntrancePictures` - POST /api/v1/image/entrance
- `GetExitPictures` - POST /api/v1/image/exit

Request body: `{ "gate_no": "1", "image_types": ["LPR", "DRIVER"] }`

---

## Phase 7: Barrier Module (internal/barrier)

### Step 7.1: Create barrier/handler.go
สร้าง HTTP handlers ที่ใช้ barrier manager จาก utils:
- `OpenBarrier` - GET /api/v1/barrier/open/:direction/:gate
- `CloseBarrier` - GET /api/v1/barrier/close/:direction/:gate
- `OpenZoning` - GET /api/v1/barrier/zoning/open/:direction/:gate
- `CloseZoning` - GET /api/v1/barrier/zoning/close/:direction/:gate

เรียกใช้ `pkg/utils.OpenBarrier()`, `pkg/utils.CloseBarrier()`, etc.

---

## Phase 8: Entrance Module (internal/entrance)

### Step 8.1: Create entrance/dto.go
สร้าง request/response DTOs

### Step 8.2: Create entrance/multipart.go
สร้าง multipart parser สำหรับรับ data จากกล้อง:
- Parse XML file
- Parse license plate image
- Parse detected image

อ้างอิงจาก `d:\Implement\GO_LANG_WORKSPACE\internal\order\handler.go` ส่วน multipart parsing

### Step 8.3: Create entrance/service.go
สร้าง business logic:
- `ProcessEntrance(event *camera.ParsedEvent, gateNo string, lpImg []byte) *EntranceResult`
- Call cloud API (get-customer-id)
- Post license plate record
- Display LED

อ้างอิงจาก `VerifyMember` function ใน order handler เดิม

### Step 8.4: Create entrance/handler.go
สร้าง HTTP handler:
- `Verify` - POST /api/v1/entrance/verify?gate_no=1

---

## Phase 9: Exit Module (internal/exit)

### Step 9.1: Create exit/dto.go
สร้าง request/response DTOs

### Step 9.2: Create exit/multipart.go
สร้าง multipart parser (เหมือน entrance)

### Step 9.3: Create exit/service.go
สร้าง business logic:
- `ProcessExit(event *camera.ParsedEvent, gateNo string) *ExitResult`
- Call cloud API (license-plate-exit)
- Handle valet case
- Open barrier on success
- Fetch images
- Display LED
- PD API integration (optional)

อ้างอิงจาก `VerifyLicensePlateOut` function ใน order handler เดิม

### Step 9.4: Create exit/handler.go
สร้าง HTTP handler:
- `Verify` - POST /api/v1/exit/verify?gate_no=1

---

## Phase 10: Zoning Module (internal/zoning)

### Step 10.1: Create zoning/dto.go
### Step 10.2: Create zoning/service.go
### Step 10.3: Create zoning/handler.go

อ้างอิงจาก `d:\Implement\GO_LANG_WORKSPACE\internal\zoning\handler.go`:
- `ZoningEntrance` - POST /api/v1/zoning/entrance/:zoning_code?gate_no=1
- `ZoningExit` - POST /api/v1/zoning/exit/:zoning_code?gate_no=1&next_zone=xxx

---

## Phase 11: Proxy Module (internal/proxy)

### Step 11.1: Create proxy/handler.go
คัดลอกและปรับปรุงจาก `d:\Implement\GO_LANG_WORKSPACE\internal\proxy\handler.go`:
- `ProxyAny` - ANY /api/v1/proxy/*path

---

## Phase 12: MQTT Module (internal/mqtt)

### Step 12.1: Create mqtt/listener.go
คัดลอกและปรับปรุงจาก `d:\Implement\GO_LANG_WORKSPACE\cmd\server\mqtt\listener.go`:
- ใช้ barrier manager จาก utils แทน inline code

---

## Phase 13: Middleware (internal/middleware)

### Step 13.1: Create middleware/logger.go
### Step 13.2: Create middleware/request_id.go

อ้างอิงจาก `d:\Implement\GO_LANG_WORKSPACE\internal\config\config.go` ส่วน middleware

---

## Phase 14: Main Entry Point (cmd/server)

### Step 14.1: Create cmd/server/main.go
สร้าง main.go ที่:
1. Load .env
2. Create config
3. Initialize SSE Hub
4. Start MQTT listener
5. Setup Gin router
6. Register routes:
   - Health: GET /healthz
   - SSE: /sse/entrance/:gate_no, /sse/exit/:gate_no, /sse/zoning/...
   - API v1:
     - Entrance: POST /api/v1/entrance/verify
     - Exit: POST /api/v1/exit/verify
     - Zoning: POST /api/v1/zoning/...
     - Barrier: GET /api/v1/barrier/...
     - Image: POST /api/v1/image/entrance, /api/v1/image/exit
     - Proxy: ANY /api/v1/proxy/*path
7. Start HTTP server with graceful shutdown

อ้างอิงโครงสร้างจาก `d:\Implement\GO_LANG_WORKSPACE\cmd\server\main.go`

---

## Phase 15: Dependencies

### Step 15.1: Install dependencies
// turbo
```bash
cd d:\Implement\new-local-proxy-api
go get github.com/gin-gonic/gin
go get github.com/joho/godotenv
go get github.com/google/uuid
go get github.com/goburrow/modbus
go get github.com/icholy/digest
go get github.com/eclipse/paho.mqtt.golang
go mod tidy
```

---

## Phase 16: Testing

### Step 16.1: Build and run
// turbo
```bash
cd d:\Implement\new-local-proxy-api
go build -o server.exe ./cmd/server
```

### Step 16.2: Run server
```bash
cd d:\Implement\new-local-proxy-api
./server.exe
```

### Step 16.3: Test endpoints
```bash
# Health check
curl http://localhost:8000/healthz

# Test SSE
curl -N http://localhost:8000/sse/entrance/1

# Test image fetch
curl -X POST http://localhost:8000/api/v1/image/exit \
  -H "Content-Type: application/json" \
  -d '{"gate_no": "1", "image_types": ["LPR", "DRIVER"]}'

# Test barrier
curl http://localhost:8000/api/v1/barrier/open/ENT/1
```

---

## Summary

โปรเจคใหม่จะมีโครงสร้างดังนี้:

```
new-local-proxy-api/
├── cmd/server/main.go
├── internal/
│   ├── config/config.go
│   ├── domain/
│   │   ├── camera/event.go, parser.go
│   │   └── vehicle/types.go
│   ├── entrance/handler.go, service.go, dto.go, multipart.go
│   ├── exit/handler.go, service.go, dto.go, multipart.go
│   ├── zoning/handler.go, service.go, dto.go
│   ├── proxy/handler.go
│   ├── barrier/handler.go
│   ├── image/handler.go, fetcher.go, types.go
│   ├── sse/hub.go, handler.go
│   ├── mqtt/listener.go
│   └── middleware/logger.go, request_id.go
├── pkg/utils/
│   ├── barrier_manager.go
│   ├── deduper.go
│   ├── display.go, display_helper.go
│   ├── province_helper.go
│   └── vehicle.go
├── .env
├── go.mod
└── go.sum
```
