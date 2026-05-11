# Release Notes — v1.1.0

**Release Date:** 2026-05-11  
**Build:** promptpark-installation-tools v1.1.0.0

---

## ✨ New Features

### ⏰ Scheduled Deploy (Release Time)
- **ตั้งเวลา deploy ล่วงหน้า** — กำหนดวันเวลาที่ต้องการ deploy และระบบจะทำงานอัตโนมัติเมื่อถึงเวลา
- **ทำงานต่อได้แม้ปิด app** — ใช้ remote crontab บน Linux server
- **รองรับ 2 deploy type:**
  - `Restart Only` — docker compose down → up -d
  - `Build & Restart` — docker compose down → up -d --build
- **Countdown timer** — แสดงเวลานับถอยหลังแบบ real-time
- **ตรวจสอบ status** — กด Refresh Status เพื่อดูว่า deploy สำเร็จหรือไม่ (pending → running → success/failed)
- **ดู deploy log** — อ่าน execution log จาก server
- **ยกเลิกได้** — กด Cancel เพื่อลบ cron job และ cleanup
- **Timezone** — ใช้เวลาฝั่ง client (Windows) พร้อมคำนวณ offset กับ server clock

### 📦 Config Preview ใน Schedule Tab
- แสดงตัวอย่าง .env ที่จะถูก deploy พร้อม validation status
- ปุ่มลิงก์ "ไปแก้ไข Config" สลับไปแท็บ Config ได้ทันที

---

## 🐛 Bug Fixes

### SSH Authentication Fix
- เพิ่ม `keyboard-interactive` auth method ให้ทุก SSH connection
- แก้ปัญหา `unable to authenticate, attempted methods [none password]` บน SSH server ที่ไม่ support password auth โดยตรง (เช่น Ubuntu ใหม่ๆ)
- **มีผลกับทุก SSH function**: Deploy, Redeploy, Rollback, Logs, Preflight, Schedule

### SSH Credential Validation on Site Open
- เพิ่มการตรวจสอบ SSH ก่อนเปิด site — ถ้า password ผิดจะไม่เปิด site (เดิม password ผิดก็เข้าได้)
- ป้องกันปัญหา password ผิดถูกเก็บใน state แล้วใช้ใน deploy/schedule ภายหลัง

---

## 📁 Changed Files

| File | Change |
|---|---|
| `app_schedule.go` | **NEW** — Scheduled deploy backend (cron management, status, cancel) |
| `app_proxy.go` | **MODIFIED** — เพิ่ม keyboard-interactive SSH auth (8 จุด) |
| `app_validation.go` | **MODIFIED** — เพิ่ม keyboard-interactive ใน sshConfig helper |
| `frontend/src/components/ProxyInstall.jsx` | **MODIFIED** — Schedule tab, deploy panel, SSH validation |
| `frontend/src/components/Sidebar.jsx` | **MODIFIED** — Version v1.1.0 |
| `wails.json` | **MODIFIED** — Product version 1.1.0.0 |
| `frontend/wailsjs/go/main/App.js` | **MODIFIED** — Wails bindings (5 new functions) |
| `frontend/wailsjs/go/main/App.d.ts` | **MODIFIED** — TypeScript declarations |

---

## 🔧 Technical Notes

- Schedule ใช้ remote crontab — สร้าง script + cron entry บน Linux server
- Status tracking ผ่าน `/tmp/promptpark-deploy-{id}.status` บน server
- Cron entry จะ self-cleanup หลัง execute เสร็จ
- Schedule data เก็บใน `.promptpark-tool/scheduled-deploys.json`
