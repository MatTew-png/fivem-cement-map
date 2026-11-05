import time
import random
import os
import re
import math
import cv2
import numpy as np
import mss
import pydirectinput
import keyboard
import requests
from rapidocr_onnxruntime import RapidOCR

# ==========================================
# ⚙️ SYSTEM SETTINGS
# ==========================================
pydirectinput.FAILSAFE = False  # ป้องกันแครชจากเมาส์ชนมุมจอในระบบ Multi-Monitor
pydirectinput.PAUSE = 0.02

# Discord Webhook สำหรับแจ้งเตือนเข้ามือถือ
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1563002079969280040/2VG12Di0pUSx_-NrcNAJR6HNgvkcrcgD45ilT0qP9ij9wqaxMCVjB3pSDzqccQwUbKPF"
DISCORD_USER_ID = "422611554475835394"  # ไอดี Discord สำหรับแท็กเรียกโดยตรง

DIR_PATH = os.path.dirname(__file__)

PATH_MINING = os.path.join(DIR_PATH, "target.png")
PATH_TRUNK_BTN = os.path.join(DIR_PATH, "target_trunk.png")
PATH_TRUNK_HEADER = os.path.join(DIR_PATH, "target_trunk_header.png")
PATH_STONE = os.path.join(DIR_PATH, "target_stone.png")
PATH_ALL_BTN = os.path.join(DIR_PATH, "target_all_btn.png")
PATH_CONFIRM_BTN = os.path.join(DIR_PATH, "target_confirm_btn.png")

# ค่าขีดจำกัดจำนวนหินที่ขุดได้
MAX_STONE_LIMIT = 60          # หากขุดได้ >= 60 ก้อน ให้กด X ยกเลิก
OCR_CHECK_INTERVAL = 1.5      # ตรวจสอบตัวเลขหินทุกๆ 1.5 วินาทีขณะขุด

# ค่าความแม่นยำในการเทียบภาพ (0.0 - 1.0)
CONF_MINING = 0.72
CONF_TRUNK_BTN = 0.70
CONF_TRUNK_HEADER = 0.75
CONF_STONE = 0.75
CONF_POPUP = 0.70

# พื้นที่สแกน (ROI บนจอ Primary 1920x1080)
ROI_MINING = {"left": 1200, "top": 300, "width": 720, "height": 500}
ROI_TRUNK_BTN = {"left": 300, "top": 480, "width": 300, "height": 180}
ROI_TRUNK_HEADER = {"left": 100, "top": 150, "width": 300, "height": 150}
ROI_INVENTORY = {"left": 960, "top": 250, "width": 960, "height": 700}
ROI_STORE_MODAL = {"left": 750, "top": 400, "width": 450, "height": 300}
ROI_STONE_COUNT = {"left": 1580, "top": 560, "width": 320, "height": 120}
ROI_TRUNK_WEIGHT_BAR = {"left": 540, "top": 860, "width": 320, "height": 30} # หลอดความจุท้ายรถ

# พิกัดสำหรับปล่อยของลงท้ายรถ (ฝั่งซ้าย)
TRUNK_DROP_X = 380
TRUNK_DROP_Y = 600

# พิกัดกึ่งกลางที่แท้จริงของปุ่ม ALL และ Confirm (Calibrated 100%)
ALL_DEAD_CENTER_X = 1077
ALL_DEAD_CENTER_Y = 530
CONFIRM_DEAD_CENTER_X = 961
CONFIRM_DEAD_CENTER_Y = 613

# พิกัดคลิกนอกกรอบเพื่อปิด/Unfocus หน้าต่างกระเป๋า
OUTSIDE_CLICK_X = 50
OUTSIDE_CLICK_Y = 500

# ==========================================
# 🔔 DISCORD NOTIFICATION HELPER
# ==========================================
def send_discord_alert(message, attach_screen=True, tag_user=True):
    """ส่งข้อความแจ้งเตือนและภาพหน้าจอสดเข้า Discord บนมือถือ พร้อมแท็กไอดี"""
    if not DISCORD_WEBHOOK_URL or "discord.com" not in DISCORD_WEBHOOK_URL:
        return

    # ใส่แท็ก @user ด้านหน้าข้อความเพื่อให้ Discord เด้งกระดิ่งแจ้งเตือนทันที
    full_content = f"<@{DISCORD_USER_ID}> {message}" if (tag_user and DISCORD_USER_ID) else message

    try:
        if attach_screen:
            try:
                with mss.mss() as sct_local:
                    mon = sct_local.monitors[1]
                    raw = np.array(sct_local.grab(mon))
                    bgr = cv2.cvtColor(raw, cv2.COLOR_BGRA2BGR)
                    small = cv2.resize(bgr, (1280, 720))
                    _, buf = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    
                    requests.post(
                        DISCORD_WEBHOOK_URL,
                        data={"content": full_content},
                        files={"file": ("screenshot.jpg", buf.tobytes(), "image/jpeg")},
                        timeout=5
                    )
                    print("[🔔 Discord] ส่งข้อความพร้อมภาพหน้าจอและแท็กคุณเรียบร้อย!")
                    return
            except Exception:
                pass

        # Fallback ส่งเฉพาะข้อความ
        requests.post(DISCORD_WEBHOOK_URL, json={"content": full_content}, timeout=5)
        print("[🔔 Discord] ส่งข้อความแจ้งเตือนและแท็กคุณเรียบร้อย!")
    except Exception as e:
        print(f"[!] ส่งแจ้งเตือน Discord ไม่สำเร็จ: {e}")

# ==========================================
# 🚀 HELPER FUNCTIONS
# ==========================================
def click_with_hold(x, y, hold=0.08):
    """คลิกแบบกดค้างเล็กน้อย เพื่อให้ NUI (Chromium/CEF) ตรวจจับ Event ได้ 100%"""
    pydirectinput.moveTo(x, y)
    time.sleep(0.10)
    pydirectinput.mouseDown()
    time.sleep(hold)
    pydirectinput.mouseUp()
    time.sleep(0.10)

def smooth_drag_and_drop(start_x, start_y, end_x, end_y, steps=50):
    """ลากเมาส์แบบมนุษย์จริง: เส้นโค้งธรรมชาติ (Bézier Curve) + อัตราเร่งและผ่อนแรง (Ease-In-Out)"""
    pydirectinput.moveTo(start_x, start_y)
    time.sleep(random.uniform(0.12, 0.18))
    pydirectinput.mouseDown()
    time.sleep(random.uniform(0.08, 0.12))

    # คำนวณระยะทางและสร้างความโค้งธรรมชาติ (Natural Arc)
    dx = end_x - start_x
    dy = end_y - start_y
    dist = math.hypot(dx, dy)
    duration = random.uniform(0.48, 0.62)

    # สุ่มความโค้งของมือเล็กน้อย เพื่อให้การลากแต่ละครั้งไม่เป็นเส้นตรงทื่อๆ
    arc_height = random.uniform(15, 30) * (1 if random.random() < 0.5 else -1)

    # จุดควบคุม Control Points สำหรับ Cubic Bézier
    p1_x = start_x + dx * 0.3 + (-dy / dist) * arc_height * 0.7
    p1_y = start_y + dy * 0.3 + (dx / dist) * arc_height * 0.7
    p2_x = start_x + dx * 0.7 + (-dy / dist) * arc_height * 0.85
    p2_y = start_y + dy * 0.7 + (dx / dist) * arc_height * 0.85

    step_delay = duration / steps

    for i in range(1, steps + 1):
        p = i / steps
        # Easing: ผ่อนแรงตอนออกตัวและตอนลงจอด (Smoothstep Cosine)
        t = (1.0 - math.cos(p * math.pi)) / 2.0
        u = 1.0 - t

        curr_x = int((u**3) * start_x + 3 * (u**2) * t * p1_x + 3 * u * (t**2) * p2_x + (t**3) * end_x)
        curr_y = int((u**3) * start_y + 3 * (u**2) * t * p1_y + 3 * u * (t**2) * p2_y + (t**3) * end_y)

        pydirectinput.moveTo(curr_x, curr_y)
        time.sleep(step_delay)

    # พักเล็กน้อยก่อนปล่อย เพื่อให้ไอเทมเข้าช่องอย่างนุ่มนวล
    time.sleep(random.uniform(0.10, 0.15))
    pydirectinput.mouseUp()
    time.sleep(random.uniform(0.15, 0.22))

def handle_store_popup(sct, tmpl_all, tmpl_confirm, timeout=2.5):
    """รอให้ป๊อปอัป STORE ITEM ขึ้นมา -> กด ALL ตรงกลางเป๊ะ 100% -> กด Confirm"""
    print("[*] กำลังตรวจหาหน้าต่าง 'STORE ITEM'...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        screen_modal = np.array(sct.grab(ROI_STORE_MODAL))
        gray_modal = cv2.cvtColor(screen_modal, cv2.COLOR_BGRA2GRAY)

        res_conf = cv2.matchTemplate(gray_modal, tmpl_confirm, cv2.TM_CCOEFF_NORMED)
        _, max_conf_val, _, max_conf_loc = cv2.minMaxLoc(res_conf)

        if max_conf_val >= CONF_POPUP:
            conf_x = ROI_STORE_MODAL["left"] + max_conf_loc[0] + (tmpl_confirm.shape[1] // 2)
            conf_y = ROI_STORE_MODAL["top"] + max_conf_loc[1] + (tmpl_confirm.shape[0] // 2)

            all_x = conf_x + 116
            all_y = conf_y - 83

            print(f"[*] พบป๊อปอัป! กำลังคลิกกลางเป๊ะ [ALL] (พิกัด: {all_x}, {all_y})...")
            time.sleep(random.uniform(0.15, 0.25))
            click_with_hold(all_x, all_y, hold=0.08)
            time.sleep(0.08)
            click_with_hold(all_x, all_y, hold=0.08)

            time.sleep(random.uniform(0.25, 0.4))
            print(f"[*] กำลังคลิกกลางเป๊ะ [Confirm] (พิกัด: {conf_x}, {conf_y})...")
            click_with_hold(conf_x, conf_y, hold=0.08)

            print("[*] ยืนยันฝากของทั้งหมดเรียบร้อย!\n")
            return True

        time.sleep(0.1)

    print("[?] ไม่พบป๊อปอัปยืนยัน (อาจเป็นเพราะเก็บเข้าทันที หรือท้ายรถเต็ม)")
    return False

def complete_loop_actions():
    """ขั้นตอนจบลูป: คลิกนอกกรอบ 1 ครั้ง -> กดเลข 1 เพื่อเตรียมพร้อมรอบถัดไป"""
    time.sleep(random.uniform(0.5, 0.8))
    
    print(f"[*] กำลังคลิกนอกกรอบที่ ({OUTSIDE_CLICK_X}, {OUTSIDE_CLICK_Y}) เพื่อปิด/Unfocus หน้าต่าง...")
    pydirectinput.moveTo(OUTSIDE_CLICK_X, OUTSIDE_CLICK_Y)
    time.sleep(0.1)
    pydirectinput.click()

    time.sleep(random.uniform(0.4, 0.7))
    print("[*] กำลังกดปุ่ม '1' (สลับอุปกรณ์/เริ่มขุด)...")
    pydirectinput.press("1")

    print("\n" + "=" * 55)
    print("  🎉 ครบ 1 Loop สมบูรณ์! ระบบพร้อมเริ่มรอบใหม่")
    print("=" * 55 + "\n")
    time.sleep(1.5)

def is_trunk_full(sct):
    """ตรวจสอบว่าท้ายรถเต็มหรือไม่ (ตรวจจับหลอดสีแดง 150/150 KG)"""
    try:
        raw = np.array(sct.grab(ROI_TRUNK_WEIGHT_BAR))
        b, g, r = raw[:, :, 0], raw[:, :, 1], raw[:, :, 2]
        red_mask = (r > 175) & (g < 110) & (b < 110)
        red_count = np.sum(red_mask)
        return red_count > 80
    except Exception:
        return False

def wait_for_user_resume_final():
    """เมื่อฟาร์มรอบสุดท้ายเสร็จสิ้น (เต็มทั้งท้ายรถและในตัว): แจ้งเตือน Discord + หยุดพักรอผู้ใช้กด '1'"""
    print("\n" + "=" * 68)
    print("  🛑 [ALL FULL & STOPPED] จบการฟาร์มรอบสุดท้ายเรียบร้อย!")
    print("  📦 สถานะ: ท้ายรถเต็ม (150/150 KG) + กระเป๋าตัวละครเต็ม")
    print("  ⏸️  ไม่กด 'H' ต่อแล้ว -> ระบบหยุดพักการทำงาน (PAUSED)")
    print("  👉  กรุณานำของไปเท/ขาย เมื่อพร้อมเริ่มลูปใหม่ ให้กดปุ่ม [ 1 ] บนคีย์บอร์ด")
    print("=" * 68 + "\n")

    # ส่งแจ้งเตือนพร้อมรูปถ่ายหน้าจอเข้า Discord ทันที!
    send_discord_alert(
        "🛑 **[FiveM Alert] ขุดแร่เสร็จสมบูรณ์!**\n"
        "📦 สถานะ: ท้ายรถเต็ม (150/150 KG) + หินเต็มตัวแล้ว\n"
        "⏸️ สคริปต์หยุดพักเรียบร้อย (ไม่กด H แล้ว)\n"
        "👉 นำของไปเท/ขายเสร็จแล้ว กดปุ่ม **[ 1 ]** บนคีย์บอร์ดเพื่อเริ่มรอบใหม่ได้เลยครับ!",
        attach_screen=True
    )

    time.sleep(0.5)
    while True:
        if keyboard.is_pressed("f10"):
            print("\n[!] ปิดโปรแกรมเรียบร้อย (F10)")
            exit(0)
        if keyboard.is_pressed("1"):
            print("\n[RESUMED] ตรวจพบคุณกดเลข '1' แล้ว! -> เริ่มต้นลูปการทำงานใหม่...\n")
            send_discord_alert("▶️ **[FiveM Alert] ได้รับคำสั่งกดปุ่ม 1 แล้ว!**\nระบบเริ่มลูปขุดแร่อีกครั้ง", attach_screen=False)
            time.sleep(1.2)
            break
        time.sleep(0.1)

def get_mining_stone_count(sct, ocr_engine):
    """อ่านตัวเลขจำนวนหินหลังตัว 'x' เช่น x22, x60 โดยใช้ RapidOCR"""
    try:
        raw = np.array(sct.grab(ROI_STONE_COUNT))
        bgr = cv2.cvtColor(raw, cv2.COLOR_BGRA2BGR)
        results, _ = ocr_engine(bgr)
        if not results:
            return None
        for box, text, score in results:
            t = text.strip()
            if 'mining' in t.lower():
                continue
            m = re.search(r'[xX*]?\s*(\d+)', t)
            if m:
                return int(m.group(1))
    except Exception:
        pass
    return None

def find_raw_stone_in_inventory(sct, tmpl_stone, ocr_engine):
    """ค้นหาตำแหน่ง Raw Stone ที่ถูกต้องในกระเป๋าขวา (Dual-Check: Template + OCR)"""
    screen_inv = np.array(sct.grab(ROI_INVENTORY))

    # 1. Template Matching
    if tmpl_stone is not None:
        gray_inv = cv2.cvtColor(screen_inv, cv2.COLOR_BGRA2GRAY)
        res_stone = cv2.matchTemplate(gray_inv, tmpl_stone, cv2.TM_CCOEFF_NORMED)
        _, max_stone_val, _, max_stone_loc = cv2.minMaxLoc(res_stone)

        if max_stone_val >= CONF_STONE:
            stone_x = ROI_INVENTORY["left"] + max_stone_loc[0] + (tmpl_stone.shape[1] // 2)
            stone_y = ROI_INVENTORY["top"] + max_stone_loc[1] + (tmpl_stone.shape[0] // 2)
            return stone_x, stone_y, f"Template ({max_stone_val:.2f})"

    # 2. OCR Search
    if ocr_engine is not None:
        try:
            bgr_inv = cv2.cvtColor(screen_inv, cv2.COLOR_BGRA2BGR)
            ocr_res, _ = ocr_engine(bgr_inv)
            if ocr_res:
                for box, text, score in ocr_res:
                    t = text.lower()
                    if "stone" in t or "raw" in t or "ram" in t:
                        cx = int(sum(p[0] for p in box) / 4)
                        cy = int(sum(p[1] for p in box) / 4)
                        stone_x = ROI_INVENTORY["left"] + cx
                        stone_y = ROI_INVENTORY["top"] + cy - 40
                        return stone_x, stone_y, f"OCR Text '{text}'"
        except Exception:
            pass

    return None, None, None

# ==========================================
# 🚀 INITIALIZATION
# ==========================================
def load_img(path):
    return cv2.imread(path, cv2.IMREAD_GRAYSCALE) if os.path.exists(path) else None

print("[*] กำลังเตรียมระบบ RapidOCR Engine...")
ocr_engine = RapidOCR()

tmpl_mining = load_img(PATH_MINING)
tmpl_trunk_btn = load_img(PATH_TRUNK_BTN)
tmpl_trunk_header = load_img(PATH_TRUNK_HEADER)
tmpl_stone = load_img(PATH_STONE)
tmpl_all = load_img(PATH_ALL_BTN)
tmpl_confirm = load_img(PATH_CONFIRM_BTN)

print("=" * 70)
print("  ⛏️  FiveM Assistant (Discord Mobile Alert Enabled)")
print("=" * 70)
print(f"[*] 1. ตรวจจับ Mining (Auto)       : {'พร้อม' if tmpl_mining is not None else 'ไม่พบ'}")
print(f"[*] 2. ตรวจนับหิน OCR (เกิน {MAX_STONE_LIMIT} ก้อน) : พร้อม (กด 'X' เพื่อรีเซ็ตรอบ)")
print(f"[*] 3. ตรวจจับคลิก 'OPEN TRUNK'    : {'พร้อม' if tmpl_trunk_btn is not None else 'ไม่พบ'}")
print(f"[*] 4. ค้นหาหิน Raw Stone ในตัว    : {'พร้อม (Template + OCR)' if tmpl_stone is not None else 'ไม่พบ'}")
print(f"[*] 5. ป้องกันท้ายรถเต็ม (150/150) : กด 1 ทำรอบสุดท้าย -> จบรอบแล้วหยุดพักรอคุณกด 1")
print(f"[*] 6. ออโต้คลิก [ALL] + [Confirm] : พร้อม (กลางเป๊ะ X={ALL_DEAD_CENTER_X}, Y={ALL_DEAD_CENTER_Y})")
print(f"[*] 7. ระบบแจ้งเตือน Discord       : เชื่อมต่อ Webhook แล้ว (เตือนเข้ามือถือ)")
print("[*] ปุ่มควบคุม:")
print("    - [F9]  : หยุดชั่วคราว / ทำงานต่อ (Pause / Resume)")
print("    - [F10] : ออกจากโปรแกรมทันที (Exit)")
print("=" * 70)

is_paused = False
is_final_round = False
missing_mining_counter = 0
last_ocr_time = 0
sct = mss.mss()

try:
    while True:
        if keyboard.is_pressed("f10"):
            print("\n[!] ปิดโปรแกรมเรียบร้อย (F10)")
            break

        if keyboard.is_pressed("f9"):
            is_paused = not is_paused
            state = "PAUSED (หยุดชั่วคราว)" if is_paused else "RESUMED (ทำงานต่อ)"
            print(f"\n[F9] สถานะ: {state}")
            time.sleep(0.5)

        if is_paused:
            time.sleep(0.3)
            continue

        # ------------------------------------------------------------------
        # 1. ตรวจสอบว่าหน้าต่างท้ายรถ (TRUNK) เปิดอยู่หรือไม่
        # ------------------------------------------------------------------
        if tmpl_trunk_header is not None:
            screen_header = np.array(sct.grab(ROI_TRUNK_HEADER))
            gray_header = cv2.cvtColor(screen_header, cv2.COLOR_BGRA2GRAY)
            res_header = cv2.matchTemplate(gray_header, tmpl_trunk_header, cv2.TM_CCOEFF_NORMED)
            _, max_header_val, _, _ = cv2.minMaxLoc(res_header)

            if max_header_val >= CONF_TRUNK_HEADER:
                trunk_full = is_trunk_full(sct)

                if not trunk_full:
                    stone_x, stone_y, method = find_raw_stone_in_inventory(sct, tmpl_stone, ocr_engine)

                    if stone_x is not None and stone_y is not None:
                        print(f"\n[{time.strftime('%H:%M:%S')}] พบ Raw Stone จริง! ด้วย {method} (พิกัด: {stone_x}, {stone_y})")
                        print(f"[*] กำลังลากหินไปยังท้ายรถ (พิกัด: {TRUNK_DROP_X}, {TRUNK_DROP_Y})...")
                        
                        time.sleep(random.uniform(0.3, 0.6))
                        smooth_drag_and_drop(stone_x, stone_y, TRUNK_DROP_X, TRUNK_DROP_Y)
                        
                        if tmpl_confirm is not None:
                            handle_store_popup(sct, tmpl_all, tmpl_confirm)
                        
                        time.sleep(0.5)
                        trunk_full = is_trunk_full(sct)

                if trunk_full:
                    is_final_round = True
                    print("\n" + "=" * 65)
                    print("  🚨 [TRUNK FULL] ท้ายรถเต็ม 150/150 KG แล้ว!")
                    print("  ⛏️  เริ่ม 'ฟาร์มรอบสุดท้าย': คลิกนอกกรอบ + กด '1' เพื่อขุดรอบสุดท้ายให้เต็มตัว...")
                    print("=" * 65)
                    
                    # แจ้งเตือน Discord
                    send_discord_alert("🚨 **[FiveM] ท้ายรถเต็ม 150/150 KG แล้ว!**\n⛏️ สคริปต์กำลังขุดรอบสุดท้ายให้เต็มกระเป๋าตัวละคร...", attach_screen=False)
                    
                    complete_loop_actions()
                    continue

                complete_loop_actions()
                continue

        # ------------------------------------------------------------------
        # 2. ตรวจสอบปุ่ม OPEN TRUNK ในหน้าต่างเมนูรถ (MINE LOTS)
        # ------------------------------------------------------------------
        if tmpl_trunk_btn is not None:
            screen_trunk_btn = np.array(sct.grab(ROI_TRUNK_BTN))
            gray_trunk_btn = cv2.cvtColor(screen_trunk_btn, cv2.COLOR_BGRA2GRAY)
            res_trunk_btn = cv2.matchTemplate(gray_trunk_btn, tmpl_trunk_btn, cv2.TM_CCOEFF_NORMED)
            _, max_btn_val, _, max_btn_loc = cv2.minMaxLoc(res_trunk_btn)

            if max_btn_val >= CONF_TRUNK_BTN:
                click_x = ROI_TRUNK_BTN["left"] + max_btn_loc[0] + (tmpl_trunk_btn.shape[1] // 2)
                click_y = ROI_TRUNK_BTN["top"] + max_btn_loc[1] + (tmpl_trunk_btn.shape[0] // 2)

                print(f"\n[{time.strftime('%H:%M:%S')}] พบปุ่ม 'OPEN TRUNK' -> คลิกอัตโนมัติ")
                time.sleep(random.uniform(0.3, 0.6))
                click_with_hold(click_x, click_y, hold=0.08)
                print("[*] คลิก OPEN TRUNK เรียบร้อย รอย้ายหน้าต่าง...")
                time.sleep(2.0)
                continue

        # ------------------------------------------------------------------
        # 3. ตรวจสอบการขุดแร่ Mining (Auto) + เช็คตัวเลขหิน
        # ------------------------------------------------------------------
        if tmpl_mining is not None:
            screen_mining = np.array(sct.grab(ROI_MINING))
            gray_mining = cv2.cvtColor(screen_mining, cv2.COLOR_BGRA2GRAY)
            res_mining = cv2.matchTemplate(gray_mining, tmpl_mining, cv2.TM_CCOEFF_NORMED)
            _, max_mine_val, _, _ = cv2.minMaxLoc(res_mining)

            if max_mine_val >= CONF_MINING:
                missing_mining_counter = 0

                now = time.time()
                stone_count = None
                if now - last_ocr_time >= OCR_CHECK_INTERVAL:
                    last_ocr_time = now
                    stone_count = get_mining_stone_count(sct, ocr_engine)

                count_display = f" | หิน: x{stone_count}" if stone_count is not None else ""
                round_mode = " [รอบสุดท้าย]" if is_final_round else ""
                print(f"\r[STATUS] Mining Active ({max_mine_val:.2f}){count_display}{round_mode} | กำลังขุด... ", end="", flush=True)

                if stone_count is not None and stone_count >= MAX_STONE_LIMIT:
                    print(f"\n\n[{time.strftime('%H:%M:%S')}] 🚨 หินขุดได้ x{stone_count} (ถึงขีดจำกัด {MAX_STONE_LIMIT} แล้ว!)")
                    time.sleep(random.uniform(0.3, 0.6))
                    
                    print("[*] กำลังกดปุ่ม 'X' เพื่อยกเลิกการขุด...")
                    pydirectinput.press("x")
                    
                    if is_final_round:
                        is_final_round = False
                        time.sleep(1.0)
                        wait_for_user_resume_final()
                        continue
                    else:
                        wait_cancel = random.uniform(1.2, 1.8)
                        print(f"[*] รอยกเลิกเสร็จสิ้น {wait_cancel:.2f} วิ...")
                        time.sleep(wait_cancel)

                        print("[*] กำลังกดปุ่ม 'H' เพื่อเริ่มขุดรอบใหม่ทันที...")
                        pydirectinput.press("h")
                        
                        time.sleep(random.uniform(2.5, 3.5))
                        last_ocr_time = time.time()
                        continue

                time.sleep(0.5)
            else:
                missing_mining_counter += 1
                print(f"\r[ALERT] ไม่พบ Mining UI ({missing_mining_counter}/2) ... ", end="", flush=True)

                if missing_mining_counter >= 2:
                    if is_final_round:
                        print(f"\n[{time.strftime('%H:%M:%S')}] >> Mining (Auto) สิ้นสุดลงในรอบสุดท้าย <<")
                        is_final_round = False
                        missing_mining_counter = 0
                        time.sleep(1.0)
                        wait_for_user_resume_final()
                        continue
                    else:
                        print(f"\n[{time.strftime('%H:%M:%S')}] >> หยุดขุด -> เตรียมกดปุ่ม H <<")
                        time.sleep(random.uniform(0.6, 1.2))
                        pydirectinput.press("h")
                        print("[*] กดปุ่ม 'H' สำเร็จ รอรอบใหม่เริ่ม...")
                        time.sleep(random.uniform(2.5, 3.5))
                        missing_mining_counter = 0

except KeyboardInterrupt:
    print("\nปิดโปรแกรมโดยผู้ใช้ (Ctrl+C)")
