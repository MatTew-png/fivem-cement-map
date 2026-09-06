# 🧱 FiveM Cement Map & Landmark Tracker (GTA V)

> เว็บแอปพลิเคชันแผนที่ GTA V แบบอินเทอร์แอคทีฟ สำหรับชาว FiveM Roleplay ใช้สำหรับปักหมุดจุดจกปูน, โรงงาน, จุดรับซื้อ, ฟาร์ม, จุดเสี่ยง, และแลนด์มาร์ค พร้อมคำนวณพิกัดเกมแท้ [X, Y, Z], ระบบจับเวลาคูลดาวน์, เครื่องมือวัดระยะทาง, และการแชร์ข้อมูลหมุด

---

## ✨ ฟีเจอร์เด่น (Key Features)

- 🎮 **แผนที่ Rockstar Official HD Tiles (สไตล์ GTALens.com)**:
  - **GTALens Game Dark Map**: แผนที่ธีมดาร์กชาร์โคลคมชัด สบายตา แสดงตึก อาคาร และเส้นทางถนนชัดเจนระดับ Zoom 1 ถึง Zoom 7
  - **GTALens Satellite Map**: ภาพถ่ายดาวเทียมความละเอียดสูงระดับ 4K
  - **GTALens Blueprint/Print Map**: แผนที่แบบแปลนพิมพ์สไตล์คลาสสิกของ GTA V
- 🏷️ **อิสระในการตั้งชื่อหมุดเอง (Custom Spot Naming)**:
  - พิมพ์ตั้งชื่อจุด/สถานที่ได้เอง 100% ตามบริบทของแต่ละเซิร์ฟเวอร์
- 🎨 **คลังไอคอนและอิโมจิเกม FiveM กว่า 50+ รายการ (Custom Icon Picker)**:
  - แบ่งหมวดหมู่อย่างเป็นระเบียบ: ปูน & ก่อสร้าง (🧱, 🏗️, ⛏️), แลนด์มาร์ค & มงกุฎ (👑, 💎, ⭐), เกษตร & สัตว์ (🌾, 🌷, 🐖), ไม้ & เหมือง (🪵, 🪨, ⛏️), ยานยนต์ (🚗, 🏎️, 🏍️, ⛽), ร้านค้า (🏪, 🍔, 💊, 💰), จุดเสี่ยง & อาวุธ (⚠️, 💀, 🔫, 🚨)
  - ช่องพิมพ์หรือวางอิโมจิใดๆ จากแป้นพิมพ์ได้อิสระ
  - 12 จานสียอดนิยมสไตล์ FiveM พร้อม Color Picker แบบปรับค่าสีเอง
  - **Live 3D Pin Preview**: แสดงตัวอย่างหมุดทันทีแบบเรียลไทม์ขณะเลือกไอคอนและสี
- 👆 **ดับเบิ้ลคลิกเพื่อปักหมุด (Double-Click to Mark)**:
  - ดับเบิ้ลคลิกที่ตำแหน่งใดก็ได้บนแผนที่เพื่อดึงพิกัดเกม [X, Y, Z] เข้าสู่ฟอร์มและสร้างหมุดได้ทันที
- ⏱️ **ระบบจับเวลาคูลดาวน์ (Cooldown Tracker)**:
  - นับถอยหลังเวลาเกิดของจุดจกปูนแบบเรียลไทม์ พร้อมแอนิเมชันวงแหวนกระพริบ (Pulse Ring) เตือนบนแผนที่
- 📏 **เครื่องมือวัดระยะทางในเกม (Distance Measurement Tool)**:
  - คลิกจุดเพื่อลากเส้นวัดระยะทางหน่วยเมตร (Meters) และกิโลเมตร (Kilometers) ตามมาตราส่วนของ GTA V
- 🎯 **เป้าเล็งกากบาทกลางจอ (GTA V Reticle / Crosshair)**:
  - เปิด/ปิดเป้าเล็งเพื่อเล็งพิกัดตรงกึ่งกลางแผนที่ได้อย่างแม่นยำ
- 📋 **คัดลอกคำสั่งวาร์ป 1-Click (/tp x y z)**:
  - คัดลอกคำสั่ง `/tp` หรือโค้ด `vec3()` สำหรับ Dev FiveM ไปใช้งานได้ทันที
- 💾 **ระบบบันทึกและแชร์ข้อมูล (Local Storage & JSON Export/Import)**:
  - ข้อมูลหมุดทั้งหมดจะถูกบันทึกลงในเบราว์เซอร์อัตโนมัติ ไม่สูญหายเมื่อรีเฟรช
  - ส่งออก (Export) เป็นไฟล์ JSON หรือแชร์ให้เพื่อนในแก๊งนำเข้า (Import) ได้อย่างง่ายดาย

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Map Engine**: [Leaflet](https://leafletjs.com/) (Custom GTA V Cartesian CRS Projection)
- **Icons**: [Lucide React](https://lucide.dev/) + Native Emojis
- **Effects**: Canvas Confetti & Sound Effects (Web Audio API)

---

## 🚀 การติดตั้งและรันในเครื่อง (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รัน Development Server
```bash
npm run dev
```
เปิดเว็บเบราว์เซอร์ไปที่: `http://localhost:5173`

### 3. บิลด์สำหรับ Production
```bash
npm run build
npm run preview
```

---

## 📜 License

MIT License - ใช้งาน ดัดแปลง และแชร์ได้อย่างอิสระสำหรับคอมมูนิตี้ FiveM
