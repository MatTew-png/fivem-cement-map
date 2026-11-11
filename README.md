# 🧱 FiveM Cement Map & Landmark Tracker (RunThukVerb)

> แผนที่ GTA V แบบอินเทอร์แอคทีฟสำหรับ FiveM Roleplay (ปักหมุดจุดจกปูน, จุดขายยา, ฟาร์ม, แลนด์มาร์ค, คำนวณพิกัดเกม `[X, Y, Z]`, ระบบคูลดาวน์เรียลไทม์ผ่าน MQTT, วัดระยะทางตามถนน, และระบบยืนยันตัวตนผ่าน Cloudflare Workers)

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 🎮 **แผนที่ GTA V High-Res Tiles**: รองรับทั้งโหมด Dark Game, Satellite และ Print/Blueprint (`Leaflet` + Custom GTA V Cartesian CRS)
- 🔒 **Cloudflare Worker Authentication & Security**:
  - ตรวจสอบ PIN ประจำวันรายสาขา (`branch_1` – `branch_5`) และ `MASTER_PIN` บน Edge Worker ด้วย HMAC-SHA256 + `timingSafeEqual` (ไม่ฝัง Secret ไว้ในโค้ดฝั่ง Client)
  - ออก Token เซสชั่นแบบลงนาม HMAC-SHA256, Rate Limiting (ล็อก 5 นาทีเมื่อใส่ผิด 5 ครั้ง), ระบบแบน IP ฝั่งเซิร์ฟเวอร์, Force-Logout ทั้งระบบ และแจ้งเตือนผ่าน Discord Webhook
- ⚡ **Live Cooldown & Gang Presence (MQTT)**: ซิงค์ตัวจับเวลาคูลดาวน์ หมุดที่ปักเอง และรายชื่อสมาชิกออนไลน์แยกตามสาขาแบบเรียลไทม์
- 🛣️ **GTA V Road Routing & Distance Tool**: คำนวณระยะทางเป็นเส้นตรงหรือตามโครงข่ายถนนจริงของ GTA V (`public/gta5_road_network.json`, โหลดเฉพาะตอนเปิดใช้งานโหมดวัดระยะถนน)
- 💾 **Export / Import & Auto-Backup**: ส่งออกเป็น JSON, FiveM Lua Table (`Config.CementSpots`), `/tp x y z`, `vec3(...)`, และระบบกู้คืน Auto-Backup ในเครื่อง

---

## 🛠️ เทคโนโลยี (Tech Stack)

- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Leaflet + Lucide React
- **Edge Backend / Static Hosting**: Cloudflare Workers + Static Assets (`wrangler` v4) + Workers KV (`GANG_VAULT`, Optional)
- **Lint & Test**: `oxlint`, `tsc` (app + worker), Node 24 built-in test runner (`node --test`)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml` ใช้ `cloudflare/wrangler-action@v3`)

---

## 🚀 การรันในเครื่อง (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. สร้างไฟล์ Secrets สำหรับรัน Local
คัดลอก `.dev.vars.example` เป็น `.dev.vars` (ไฟล์นี้ถูก ignore ใน `.gitignore` ห้าม commit ขึ้น Git):
```bash
cp .dev.vars.example .dev.vars
```
แก้ไขค่าใน `.dev.vars`:
```dotenv
MASTER_PIN=123456
GANG_SECRET_SEED=your-random-32-char-secret-seed
SESSION_SECRET=your-random-hmac-session-secret
DISCORD_WEBHOOK_URL=
```

### 3. รัน Worker + Vite Dev Server
เปิด 2 เทอร์มินัล:
```bash
# Terminal 1: Cloudflare Worker API (http://127.0.0.1:8787)
npm run dev:worker

# Terminal 2: Vite Frontend (proxy /api ไปยัง 127.0.0.1:8787 อัตโนมัติ)
npm run dev
```

---

## ☁️ การ Deploy ขึ้น Cloudflare Workers + Static Assets

โครงสร้างโปรเจกต์ตั้งค่าใน [`wrangler.jsonc`](wrangler.jsonc) ชื่อ Worker `runthukverb-auth-api` โดยเสิร์ฟไฟล์ Build จาก `./dist` และส่ง `/api/*` เข้า `worker/index.ts` ก่อน (`run_worker_first`)

### ขั้นตอนตั้งค่าครั้งแรก (One-Time Setup)
1. ล็อกอิน Cloudflare CLI:
   ```bash
   npx wrangler login
   ```
2. *(แนะนำสำหรับ Production)* สร้าง KV Namespace สำหรับเก็บ Ban List, Rate Limit, Security Logs, Discord Webhook และ Force-Logout แบบถาวรข้าม Isolate แล้วเพิ่ม binding `GANG_VAULT` ใน `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create GANG_VAULT
   ```
   หากยังไม่ผูก `GANG_VAULT` ระบบ Worker จะทำงานด้วย In-Memory fallback ชั่วคราวต่อ Isolate
3. ตั้งค่า Secrets บน Cloudflare Production:
   ```bash
   npx wrangler secret put MASTER_PIN
   npx wrangler secret put GANG_SECRET_SEED
   npx wrangler secret put SESSION_SECRET
   # (ตัวเลือกเพิ่มเติม)
   npx wrangler secret put DISCORD_WEBHOOK_URL
   ```
4. Deploy จากเครื่องทันที:
   ```bash
   npm run deploy
   ```

### ตั้งค่า Auto-Deploy ผ่าน GitHub Actions
เพิ่ม Repository Secrets ใน GitHub (**Settings → Secrets and variables → Actions**):
- `CLOUDFLARE_API_TOKEN` (สิทธิ์ Edit Cloudflare Workers & Workers KV)
- `CLOUDFLARE_ACCOUNT_ID`

เมื่อ Push โค้ดขึ้น Branch `main` เวิร์กโฟลว์ [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) จะรัน `lint` → `typecheck` → `test` → `build` → Deploy ขึ้น Cloudflare Workers อัตโนมัติ

---

## 🔌 API Endpoints (`worker/index.ts`)

| Endpoint | Method | Access | หน้าที่ |
| --- | --- | --- | --- |
| `/api/health` | `GET` | Public | ตรวจสอบสถานะ Worker, Secrets และการผูก KV |
| `/api/my-ip` | `GET` | Public | ดู IP/ประเทศ และสถานะการถูกแบนของเครื่องผู้เปิด |
| `/api/verify` | `POST` | Public | ยืนยัน `MASTER_PIN` หรือ PIN ประจำวันรายสาขาและออก Bearer Token |
| `/api/session` | `GET` | Bearer | ตรวจสอบความถูกต้องของ Token และรับ `channelKey` ประจำวัน |
| `/api/security/visit` | `POST` | Public | บันทึก Log การเข้าชมและแจ้งเตือนแบน (ถ้ามี) |
| `/api/pins/upcoming` | `GET` | Master | ดูตาราง PIN รายสาขาล่วงหน้า 7 วัน |
| `/api/security/logs` | `GET` | Master | ดึง Security Logs, รายชื่อ Ban และสถานะ Discord Webhook |
| `/api/security/ban` | `POST` | Master | แบน IP ที่ต้องการพร้อมเหตุผล |
| `/api/security/unban` | `POST` | Master | ปลดแบน IP |
| `/api/security/webhook` | `POST` | Master | บันทึก Discord Webhook URL ลงในระบบ |
| `/api/admin/force-logout` | `POST` | Master | บังคับยกเลิก Token สมาชิกที่ไม่ใช่ Master ทั้งหมด |

---

## 🧪 คำสั่งตรวจสอบคุณภาพ (Scripts)

```bash
npm run lint        # Oxlint ตรวจ src/, worker/, tests/
npm run typecheck   # TypeScript check ทั้ง App และ Worker
npm test            # Node 24 native unit tests (tests/*.test.ts)
npm run build       # Build dist/ สำหรับ Cloudflare Assets
```
