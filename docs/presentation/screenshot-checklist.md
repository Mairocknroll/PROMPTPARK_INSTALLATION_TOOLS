# Screenshot Checklist for Marp

แคปภาพหน้าจอจริงของโปรแกรม แล้ววางไว้ในโฟลเดอร์ `docs/presentation/images` ด้วยชื่อไฟล์ต่อไปนี้

แนะนำขนาดหน้าต่าง: 1440 x 1000 หรือใกล้เคียง เพื่อให้ภาพในสไลด์สัดส่วนสม่ำเสมอ

## ภาพรวม

- `01-sidebar-overview.png` - หน้าแรกพร้อม sidebar

## Install Local Proxy

- `02-proxy-site-list.png` - เมนู Install Local Proxy หน้า Site List
- `03-proxy-step-site-data.png` - New Install step 1 Site Data
- `04-proxy-step-lanes.png` - New Install step 2 Lanes
- `05-proxy-step-server-check.png` - New Install step 3 Server Check
- `06-proxy-deploy.png` - หน้า Deploy หรือ tab Deploy ของ site
- `07-proxy-logs.png` - tab Logs

## HIK LPR Config

- `08-hik-main.png` - หน้า HIK LPR Config หลัก
- `09-hik-add-camera.png` - popup Add LPR Camera
- `10-hik-apply.png` - หลังเพิ่มกล้อง และพร้อมกด Apply to All Cameras

## Entrance Kiosk Installation

- `11-entrance-install.png` - tab New Install
- `12-entrance-add-device.png` - popup Add Kiosk Device
- `13-entrance-deploy.png` - หลังเพิ่ม device และพร้อม Deploy All
- `14-entrance-read-edit.png` - tab Read & Edit Config

## Exit Kiosk Installation

- `15-exit-install.png` - tab New Install
- `16-exit-add-device.png` - popup Add Exit Kiosk Device
- `17-exit-deploy.png` - หลังเพิ่ม device และพร้อม Deploy All
- `18-exit-read-edit.png` - tab Read & Edit Config

## Integration Tools

- `19-integration-tools.png` - หน้า Integration Tools พร้อม Target Endpoint และ License Plate

## วิธี export Marp

ถ้ามี Marp CLI แล้ว ให้รันจาก root project:

```powershell
npx @marp-team/marp-cli docs\presentation\promptpark-installation-tools.md --html --pptx
```

หรือ export เป็น PDF:

```powershell
npx @marp-team/marp-cli docs\presentation\promptpark-installation-tools.md --html --pdf
```
