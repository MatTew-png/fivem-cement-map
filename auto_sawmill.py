import time
import random
import os
import math
import ctypes
import cv2
import numpy as np
import mss
import pydirectinput
import keyboard
import requests
from rapidocr_onnxruntime import RapidOCR

# ==========================================
# ⚙️ SYSTEM SETTINGS & CONFIGURATION
# ==========================================
user32 = ctypes.windll.user32
pydirectinput.FAILSAFE = False  # ป้องกันแครชจากเมาส์ชนขอบจอในระบบ Multi-Monitor
pydirectinput.PAUSE = 0.02

# Discord Webhook สำหรับแจ้งเตือน (ส่งเตือนเข้ามือถือเมื่อไม้หมดหรือเกิดปัญหา)
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1563002079969280040/2VG12Di0pUSx_-NrcNAJR6HNgvkcrcgD45ilT0qP9ij9wqaxMCVjB3pSDzqccQwUbKPF"
DISCORD_USER_ID = "422611554475835394"

DIR_PATH = os.path.dirname(os.path.abspath(__file__))

PATH_SAWMILL_HEADER = os.path.join(DIR_PATH, "target_sawmill_header.png")
PATH_WOOD_PLANK = os.path.join(DIR_PATH, "target_wood_plank.png")
PATH_TIMBER_LOG = os.path.join(DIR_PATH, "target_timber_log.png")
PATH_CONFIRM_BTN = os.path.join(DIR_PATH, "target_confirm_btn.png")
PATH_TERMINUS_TRUNK = os.path.join(DIR_PATH, "target_terminus_open_trunk.png")

# ค่าความแม่นยำ Template Matching (0.0 - 1.0)
CONF_SAWMILL = 0.75
CONF_ITEM_TEMPLATE = 0.70
CONF_POPUP = 0.70

# 🪵 จำนวนไม้ท่อนที่จะเบิกในแต่ละรอบ (Sawmill ใช้รอบละ 30 ท่อน = 15 KG พอดีกับช่องว่างในตัว)
WOOD_BATCH_SIZE = 30

# วิธีปิดหน้าต่างคลัง/กระเป๋า: 'esc' (กดปุ่ม ESC) หรือ 'click_outside' (คลิกที่พิกัด 50, 500)
CLOSE_INVENTORY_METHOD = 'esc'

# พื้นที่สแกน (ROI บนจอหลัก 1920x1080)
# 1. กรอบแสดงสถานะ Sawmill ทางขวามือ
ROI_SAWMILL = {"left": 1580, "top": 430, "width": 330, "height": 330}
# 2. เมนูเลือกรถ WOOD PROCESS (YOUR COLLECTION) หลังกด H
ROI_VEHICLE_MENU = {"left": 200, "top": 300, "width": 800, "height": 350}
# 3. ท้ายรถ Terminus ฝั่งซ้าย (TRUNK VBDH 634)
ROI_VAULT = {"left": 100, "top": 200, "width": 840, "height": 750}
# 4. กระเป๋าตัวละครฝั่งขวา (INVENTORY)
ROI_INVENTORY = {"left": 960, "top": 200, "width": 860, "height": 750}
# 5. หน้าต่างป๊อปอัปยืนยันจำนวน (STORE / WITHDRAW MODAL)
ROI_STORE_MODAL = {"left": 750, "top": 400, "width": 450, "height": 300}
# 6. หลอดและตัวเลขน้ำหนักท้ายรถ (ซ้ายล่าง)
ROI_TRUNK_WEIGHT = {"left": 580, "top": 855, "width": 330, "height": 35}
# 7. หลอดและตัวเลขน้ำหนักในตัว (ขวาล่าง)
ROI_INV_WEIGHT = {"left": 1410, "top": 855, "width": 330, "height": 35}

# 🎯 พิกัดปล่อยไอเทม (Calibrated Empty Slots 100%)
# - ฝั่งซ้าย: ปล่อยลงพื้นที่ว่างของท้ายรถ (Row 3 ช่องว่าง)
VAULT_DROP_X = 480
VAULT_DROP_Y = 550
# - ฝั่งขวา: ปล่อยลงช่องว่างแถวล่างสุดของกระเป๋า (Row 4 ช่องว่างแน่นอน ไม่ทับ Faggio/ไอเทมอื่น)
INVENTORY_DROP_X = 1370
INVENTORY_DROP_Y = 780

# พิกัดกล่องกรอกตัวเลข Amount บนป๊อปอัป
AMOUNT_INPUT_X = 935
AMOUNT_INPUT_Y = 532

# พิกัดกึ่งกลางของปุ่ม ALL และ Confirm บนป๊อปอัป (Calibrated Dead-Center)
ALL_DEAD_CENTER_X = 1077
ALL_DEAD_CENTER_Y = 530
CONFIRM_DEAD_CENTER_X = 961
CONFIRM_DEAD_CENTER_Y = 613

# พิกัดปุ่ม OPEN TRUNK ของ Terminus (Calibrated Dead-Center)
TERMINUS_OPEN_TRUNK_X = 495
TERMINUS_OPEN_TRUNK_Y = 553

# พิกัดคลิกนอกกรอบเพื่อปิดหน้าต่าง
OUTSIDE_CLICK_X = 50
OUTSIDE_CLICK_Y = 500

# ==========================================
# 🔔 DISCORD NOTIFICATION HELPER
# ==========================================
def send_discord_alert(message, attach_screen=False, tag_user=False):
    """ส่งข้อความแจ้งเตือนเข้า Discord พร้อมแท็กผู้ใช้"""
    if not DISCORD_WEBHOOK_URL or "discord.com" not in DISCORD_WEBHOOK_URL:
        return

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
                    return
            except Exception:
                pass

        requests.post(DISCORD_WEBHOOK_URL, json={"content": full_content}, timeout=5)
    except Exception as e:
        print(f"[!] ส่ง Discord ไม่สำเร็จ: {e}")

# ==========================================
# 🚀 WIN32 NATIVE MOUSE & KEYBOARD HELPERS
# ==========================================
def win32_move(x, y):
    """เลื่อนเมาส์ผ่าน Win32 API โดยตรง พร้อมจำกัดขอบเขต ป้องกันเมาส์หลุดจอหรือไป (0,0)"""
    safe_x = max(10, min(1910, int(x)))
    safe_y = max(10, min(1070, int(y)))
    user32.SetCursorPos(safe_x, safe_y)
    user32.mouse_event(0x0001, 0, 0, 0, 0)  # MOUSEEVENTF_MOVE

def win32_click(x, y, hold=0.08):
    """คลิกผ่าน Win32 API แท้ เพื่อให้ Chromium NUI ใน FiveM รับสัญญาณคลิกชัวร์ 100%"""
    win32_move(x, y)
    time.sleep(0.06)
    user32.mouse_event(0x0002, 0, 0, 0, 0)  # Left Down
    time.sleep(hold)
    user32.mouse_event(0x0004, 0, 0, 0, 0)  # Left Up
    time.sleep(0.06)

def press_key(key, hold=0.08):
    """กดปุ่มคีย์บอร์ดพร้อมหน่วงเวลาเล็กน้อย เพื่อให้ FiveM รับสัญญาณได้ 100%"""
    pydirectinput.keyDown(key)
    time.sleep(hold)
    pydirectinput.keyUp(key)
    time.sleep(0.08)

def smooth_drag_and_drop(start_x, start_y, end_x, end_y, steps=40):
    """
    ลากเมาส์เลียนแบบมนุษย์จริงด้วย Win32 API 100%:
    - Bézier Curve + Ease-In-Out
    - ล็อกพิกัดไม่ให้หลุดออกนอกจอ
    - แก้บัคเมาส์เด้งไปมุมซ้ายบน (0,0) อย่างถาวร
    """
    start_x = max(10, min(1910, int(start_x)))
    start_y = max(10, min(1070, int(start_y)))
    end_x = max(10, min(1910, int(end_x)))
    end_y = max(10, min(1070, int(end_y)))

    # เลื่อนไปยังจุดเริ่มต้น
    win32_move(start_x, start_y)
    time.sleep(random.uniform(0.10, 0.14))

    # กดคลิกซ้ายค้างที่จุดไอเทม
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(random.uniform(0.08, 0.12))

    dx = end_x - start_x
    dy = end_y - start_y
    dist = max(1.0, math.hypot(dx, dy))
    duration = random.uniform(0.40, 0.52)

    # สุ่มความโค้งของมือเล็กน้อย
    arc_height = random.uniform(15, 26) * (1 if random.random() < 0.5 else -1)

    p1_x = start_x + dx * 0.3 + (-dy / dist) * arc_height * 0.7
    p1_y = start_y + dy * 0.3 + (dx / dist) * arc_height * 0.7
    p2_x = start_x + dx * 0.7 + (-dy / dist) * arc_height * 0.85
    p2_y = start_y + dy * 0.7 + (dx / dist) * arc_height * 0.85

    step_delay = duration / steps

    for i in range(1, steps + 1):
        p = i / steps
        t = (1.0 - math.cos(p * math.pi)) / 2.0
        u = 1.0 - t

        curr_x = int((u**3) * start_x + 3 * (u**2) * t * p1_x + 3 * u * (t**2) * p2_x + (t**3) * end_x)
        curr_y = int((u**3) * start_y + 3 * (u**2) * t * p1_y + 3 * u * (t**2) * p2_y + (t**3) * end_y)

        win32_move(curr_x, curr_y)
        time.sleep(step_delay)

    time.sleep(random.uniform(0.08, 0.12))
    # ปล่อยคลิกซ้าย
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(random.uniform(0.12, 0.18))

def handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.5):
    """
    จัดการหน้าต่างป๊อปอัปยืนยันจำนวน:
    - ถ้า amount = 'ALL': กดปุ่ม ALL -> Confirm (สำหรับฝาก Wood Plank)
    - ถ้า amount = ตัวเลข (เช่น 30): พิมพ์ตัวเลข 30 -> Confirm (สำหรับเบิก Timber Log)
    """
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        screen_modal = np.array(sct.grab(ROI_STORE_MODAL))
        gray_modal = cv2.cvtColor(screen_modal, cv2.COLOR_BGRA2GRAY)

        conf_found = False
        conf_x, conf_y = CONFIRM_DEAD_CENTER_X, CONFIRM_DEAD_CENTER_Y

        if tmpl_confirm is not None:
            res_conf = cv2.matchTemplate(gray_modal, tmpl_confirm, cv2.TM_CCOEFF_NORMED)
            _, max_conf_val, _, max_conf_loc = cv2.minMaxLoc(res_conf)
            if max_conf_val >= CONF_POPUP:
                conf_x = ROI_STORE_MODAL["left"] + max_conf_loc[0] + (tmpl_confirm.shape[1] // 2)
                conf_y = ROI_STORE_MODAL["top"] + max_conf_loc[1] + (tmpl_confirm.shape[0] // 2)
                conf_found = True
        else:
            conf_found = True

        if conf_found:
            time.sleep(random.uniform(0.12, 0.18))

            if str(amount).upper() == "ALL":
                # กดปุ่ม ALL
                all_x = conf_x + 116
                all_y = conf_y - 83
                win32_click(all_x, all_y, hold=0.07)
                time.sleep(0.06)
                win32_click(all_x, all_y, hold=0.07)
            else:
                # คลิกกล่อง Amount แล้วพิมพ์จำนวนที่กำหนด
                input_x = conf_x - 26
                input_y = conf_y - 81
                win32_click(input_x, input_y, hold=0.08)
                time.sleep(0.08)
                # ล้างตัวเลขเดิม
                pydirectinput.keyDown('ctrl')
                pydirectinput.press('a')
                pydirectinput.keyUp('ctrl')
                time.sleep(0.04)
                press_key('backspace')
                time.sleep(0.04)
                # พิมพ์ตัวเลขทีละหลัก
                for ch in str(amount):
                    press_key(ch)
                    time.sleep(0.05)

            time.sleep(random.uniform(0.15, 0.22))
            win32_click(conf_x, conf_y, hold=0.08)
            time.sleep(0.15)
            return True

        time.sleep(0.08)

    return False

def close_inventory_window(method=CLOSE_INVENTORY_METHOD):
    """ปิดหน้าต่างกระเป๋า/ท้ายรถ"""
    time.sleep(random.uniform(0.3, 0.5))
    if method == 'esc':
        print("[*] กำลังกดปุ่ม 'ESC' เพื่อปิดหน้าต่างคลัง...")
        press_key('esc')
    elif method == 'click_outside':
        print(f"[*] กำลังคลิกนอกกรอบที่ ({OUTSIDE_CLICK_X}, {OUTSIDE_CLICK_Y}) เพื่อปิดหน้าต่าง...")
        win32_click(OUTSIDE_CLICK_X, OUTSIDE_CLICK_Y, hold=0.08)
    elif method == 'both':
        win32_click(OUTSIDE_CLICK_X, OUTSIDE_CLICK_Y, hold=0.08)
        time.sleep(0.2)
        press_key('esc')
    time.sleep(random.uniform(0.6, 0.8))

# ==========================================
# 🔍 COMPUTER VISION & WEIGHT STATUS
# ==========================================
def is_timber_log_zero(sct, ocr_engine):
    """
    ตรวจสอบสถานะ Sawmill ขวาจอ:
    - คืนค่า True: เมื่อ Timber Log เหลือ 0 (สถานะขึ้น Ready หรือ Process Timber Log)
    - คืนค่า False: เมื่อระบบยังคง Processing แปรรูปไม้อยู่
    """
    crop = np.array(sct.grab(ROI_SAWMILL))
    bgr = cv2.cvtColor(crop, cv2.COLOR_BGRA2BGR)
    try:
        res, _ = ocr_engine(bgr)
        if not res:
            return False

        texts = [t[1].lower() for t in res]
        full_text = " ".join(texts)

        # หากมีคำว่า processing แสดงว่ายังแปรรูปไม่เสร็จ
        if "processing" in full_text or "frocecsing" in full_text or "froceeirg" in full_text:
            return False

        # หากขึ้น Ready หรือ Process Timber Log
        if any(k in full_text for k in ["ready", "roay", "process", "peocass"]):
            return True

        # หากพบ x0 ชัดเจน
        for t in texts:
            if t in ["x0", "x 0", "0"]:
                return True
    except Exception:
        pass

    return False

def is_trunk_full(sct):
    """
    ตรวจสอบว่าท้ายรถเต็ม 150/150 KG หรือไม่ (ตรวจจับพิกเซลสีแดงของหลอดน้ำหนักท้ายรถ)
    - คืนค่า True: ถ้าหลอดเป็นสีแดง (น้ำหนักเต็ม 150/150 KG ไม่สามารถฝากของเข้าได้)
    - คืนค่า False: ถ้ามีพื้นที่ว่าง (สามารถฝากของเข้าได้)
    """
    try:
        crop_tw = np.array(sct.grab(ROI_TRUNK_WEIGHT))
        b, g, r = crop_tw[:, :, 0], crop_tw[:, :, 1], crop_tw[:, :, 2]
        red_mask = (r > 170) & (g < 110) & (b < 110)
        red_pixels = np.sum(red_mask)
        return red_pixels > 200
    except Exception:
        return False

def click_terminus_open_trunk(sct, ocr_engine):
    """
    ค้นหารถ 'Terminus' ในหน้า WOOD PROCESS แล้วคลิกปุ่ม OPEN TRUNK ด้านล่าง
    """
    print("[*] กำลังตรวจหาตัวเลือกรถ 'Terminus'...")
    crop = np.array(sct.grab(ROI_VEHICLE_MENU))
    bgr = cv2.cvtColor(crop, cv2.COLOR_BGRA2BGR)

    target_x = TERMINUS_OPEN_TRUNK_X
    target_y = TERMINUS_OPEN_TRUNK_Y

    try:
        res, _ = ocr_engine(bgr)
        if res:
            terminus_box = None
            open_trunk_boxes = []

            for box, text, _ in res:
                t = text.lower()
                if "terminus" in t:
                    terminus_box = box
                if "trunk" in t or "open" in t:
                    open_trunk_boxes.append(box)

            if terminus_box is not None and open_trunk_boxes:
                t_cx = sum(p[0] for p in terminus_box) / 4
                t_cy = sum(p[1] for p in terminus_box) / 4
                best_btn = None
                min_dist = 9999

                for b in open_trunk_boxes:
                    b_cx = sum(p[0] for p in b) / 4
                    b_cy = sum(p[1] for p in b) / 4
                    if b_cy > t_cy:  # ปุ่มอยู่ใต้ Terminus
                        dist = abs(b_cx - t_cx)
                        if dist < min_dist:
                            min_dist = dist
                            best_btn = (b_cx, b_cy)

                if best_btn:
                    target_x = int(ROI_VEHICLE_MENU["left"] + best_btn[0])
                    target_y = int(ROI_VEHICLE_MENU["top"] + best_btn[1])
                    print(f"[*] พบตำแหน่งปุ่ม OPEN TRUNK ใต้ Terminus ที่ ({target_x}, {target_y})")
    except Exception:
        pass

    print(f"[*] กำลังคลิกปุ่ม 'OPEN TRUNK' ของ Terminus ที่ ({target_x}, {target_y})...")
    win32_click(target_x, target_y, hold=0.08)
    time.sleep(random.uniform(1.0, 1.3))

def read_weight_status(sct, ocr_engine):
    """อ่านค่าน้ำหนักหลอดล่างของทั้ง 2 ฝั่ง (ท้ายรถซ้าย และ กระเป๋าขวา)"""
    trunk_weight_str = "150/150 KG" if is_trunk_full(sct) else "มีที่ว่าง"
    inv_weight_str = "N/A"

    try:
        crop_iw = np.array(sct.grab(ROI_INV_WEIGHT))
        bgr_iw = cv2.cvtColor(crop_iw, cv2.COLOR_BGRA2BGR)
        res_iw, _ = ocr_engine(bgr_iw)
        if res_iw:
            inv_weight_str = res_iw[0][1]
    except Exception:
        pass

    return trunk_weight_str, inv_weight_str

def find_item_in_roi(sct, roi, item_name_keywords, tmpl_item, ocr_engine):
    """ค้นหาไอเทมในพื้นที่ ROI ที่กำหนด ด้วย Dual-Check (OCR + Template)"""
    screen_crop = np.array(sct.grab(roi))

    # 1. ค้นหาด้วย RapidOCR
    if ocr_engine is not None:
        try:
            bgr_crop = cv2.cvtColor(screen_crop, cv2.COLOR_BGRA2BGR)
            ocr_results, _ = ocr_engine(bgr_crop)
            if ocr_results:
                for box, text, _ in ocr_results:
                    t = text.lower()
                    if any(k in t for k in item_name_keywords):
                        cx = int(sum(p[0] for p in box) / 4)
                        cy = int(sum(p[1] for p in box) / 4)
                        target_x = roi["left"] + cx
                        target_y = roi["top"] + cy - 45
                        return target_x, target_y, f"OCR '{text}'"
        except Exception:
            pass

    # 2. Template Matching สำรอง
    if tmpl_item is not None:
        gray_crop = cv2.cvtColor(screen_crop, cv2.COLOR_BGRA2GRAY)
        res = cv2.matchTemplate(gray_crop, tmpl_item, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val >= CONF_ITEM_TEMPLATE:
            target_x = roi["left"] + max_loc[0] + (tmpl_item.shape[1] // 2)
            target_y = roi["top"] + max_loc[1] + (tmpl_item.shape[0] // 2)
            return target_x, target_y, f"Template ({max_val:.2f})"

    return None, None, None

# ==========================================
# 🔄 SMART SWAP ROUTINE (แก้ปัญหา That container is full 100%)
# ==========================================
def execute_wood_swap(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm):
    """
    ขั้นตอนสลับไอเทมแบบปลอดภัย 100% แก้ปัญหา 'That container is full':
    1. ตรวจสอบสถานะท้ายรถ Terminus:
       - ถ้าท้ายรถเต็ม 150/150 KG (หลอดแดง): ห้ามฝาก Wood Plank เด็ดขาด!
       - ต้องเบิก Timber Log 30 ท่อน ออกมาที่ช่องว่างแถว 4 ของกระเป๋าก่อนเสมอ!
    2. เมื่อเบิก Timber Log 30 ท่อน สำเร็จ:
       - ท้ายรถจะเปิดพื้นที่ว่างทันที 15 KG
    3. จากนั้นจึงฝาก Wood Plank จากตัว (30 แผ่น = 15 KG) เข้าท้ายรถ Terminus
       - จะลงในช่องว่าง 15 KG พอดี 100% โดยไม่ขึ้น 'That container is full'
    4. ตรวจสอบความปลอดภัย: ฝั่งขวา 'ต้องไม่เหลือ Wood Plank'
    """
    print("\n" + "=" * 70)
    print("  🪵 สลับไม้แบบปลอดภัย (เบิก Timber Log ก่อน -> ฝาก Wood Plank ทีหลัง)")
    print("=" * 70)

    # 1. ตรวจสอบสถานะท้ายรถ
    trunk_full = is_trunk_full(sct)
    print(f"[*] สถานะท้ายรถ Terminus เริ่มต้น: {'⚠️ เต็ม 150/150 KG (ต้องเบิกไม้ท่อนก่อน)' if trunk_full else '🟢 มีที่ว่าง'}")

    # ----------------------------------------------------
    # ส่วนที่ 1: เบิก Timber Log จากท้ายรถซ้าย มาที่ช่องว่างกระเป๋าขวา
    # ----------------------------------------------------
    lx, ly, method = find_item_in_roi(sct, ROI_VAULT, ["timber", "log"], tmpl_log, ocr_engine)
    if lx is None:
        print("[🛑 ALERT] ไม่พบ Timber Log ในท้ายรถ Terminus! (ไม้ท่อนในรถหมดแล้ว)")
        return False

    print(f"[*] [Timber Log] พบที่ ({lx}, {ly}) ผ่าน {method}")
    print(f"    -> กำลังลากไปลง 'ช่องว่างแถว 4 ในกระเป๋า' ({INVENTORY_DROP_X}, {INVENTORY_DROP_Y})...")
    # ลากไปที่ (1370, 780) ซึ่งเป็นช่องว่าง 100% ไม่ทับไอเทมอื่น
    smooth_drag_and_drop(lx, ly, INVENTORY_DROP_X, INVENTORY_DROP_Y)

    # กรอกจำนวน 30 ท่อน (15 KG) พอดีกับ Sawmill
    popup_ok = handle_amount_popup(sct, tmpl_confirm, amount=WOOD_BATCH_SIZE, timeout=2.5)
    time.sleep(0.5)

    # ตรวจสอบว่าเบิกสำเร็จและเปิดพื้นที่ท้ายรถจริงหรือไม่
    trunk_still_full = is_trunk_full(sct)
    if trunk_still_full and not popup_ok:
        print("[⚠️] การเบิก Timber Log ไม่สำเร็จ! ท้ายรถยังคงเต็ม 150/150 KG")
        print("    -> ข้ามการฝาก Wood Plank ทันที เพื่อป้องกันการเกิด 'That container is full'")
        return False

    print(f"[✓] เบิก Timber Log {WOOD_BATCH_SIZE} ท่อน สำเร็จ! (ท้ายรถเปิดพื้นที่ว่าง 15 KG แล้ว)")
    time.sleep(random.uniform(0.35, 0.55))

    # ----------------------------------------------------
    # ส่วนที่ 2: ฝาก Wood Plank จากตัวขวา เข้าท้ายรถซ้าย (ที่เพิ่งเปิดพื้นที่ 15 KG)
    # ----------------------------------------------------
    wood_stored_count = 0
    max_wood_attempts = 5

    for attempt in range(max_wood_attempts):
        wx, wy, method = find_item_in_roi(sct, ROI_INVENTORY, ["wood", "plank"], tmpl_wood, ocr_engine)
        if wx is None:
            print("[-] ไม่มี Wood Plank ในตัว (พร้อมแปรรูปต่อ)")
            break

        print(f"[*] [Wood Plank] พบในตัวที่ ({wx}, {wy}) ผ่าน {method}")
        print(f"    -> กำลังลากฝากเข้าพื้นที่ว่างท้ายรถ ({VAULT_DROP_X}, {VAULT_DROP_Y})...")
        smooth_drag_and_drop(wx, wy, VAULT_DROP_X, VAULT_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2)
        wood_stored_count += 1
        time.sleep(random.uniform(0.3, 0.45))

    # ----------------------------------------------------
    # ส่วนที่ 3: ตรวจสอบความปลอดภัย "ฝั่งขวาต้องไม่เหลือ Wood Plank"
    # ----------------------------------------------------
    time.sleep(0.25)
    verify_wx, _, _ = find_item_in_roi(sct, ROI_INVENTORY, ["wood", "plank"], tmpl_wood, ocr_engine)
    if verify_wx is None:
        print("  ✅ [ตรวจสอบสมบูรณ์] ฝั่งขวาไม่เหลือ Wood Plank ตกค้าง (0 ชิ้น)")
    else:
        print("  ⚠️ [แจ้งเตือน] ยังตรวจพบ Wood Plank ตกค้างในตัว! กำลังลากเก็บซ้ำ...")
        smooth_drag_and_drop(verify_wx, wy, VAULT_DROP_X, VAULT_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2)

    # ----------------------------------------------------
    # ส่วนที่ 4: ตรวจสอบค่าน้ำหนักหลอดล่าง
    # ----------------------------------------------------
    trunk_wt, inv_wt = read_weight_status(sct, ocr_engine)
    print(f"  📊 สถานะน้ำหนัก: ท้ายรถ Terminus [{trunk_wt}] | กระเป๋าในตัว [{inv_wt}]")
    print("=" * 70 + "\n")

    return True

# ==========================================
# 🏁 MAIN AUTONOMOUS SAWMILL BOT
# ==========================================
def main():
    def load_gray(p):
        return cv2.imread(p, cv2.IMREAD_GRAYSCALE) if os.path.exists(p) else None

    print("[*] กำลังเตรียมระบบ RapidOCR Engine...")
    ocr_engine = RapidOCR()

    tmpl_wood = load_gray(PATH_WOOD_PLANK)
    tmpl_log = load_gray(PATH_TIMBER_LOG)
    tmpl_confirm = load_gray(PATH_CONFIRM_BTN)

    print("=" * 75)
    print("  🌲 FiveM Autonomous Sawmill Bot (Smart Container Guard V3)")
    print("=" * 75)
    print("🛡️ ระบบความปลอดภัย & การแก้ปัญหา:")
    print("    1. เมาส์ Win32 Native API: ล็อกพิกัด ไม่กระโดดไปมุมซ้ายบน (0,0) แน่นอน 100%")
    print(f"    2. ลากลงช่องว่างแท้จริง: ปล่อยลงช่องว่างแถว 4 ({INVENTORY_DROP_X}, {INVENTORY_DROP_Y}) ไม่ทับไอเทมอื่น")
    print("    3. ป้องกัน 'That container is full': ตรวจเช็คหลอดแดงท้ายรถก่อนเสมอ")
    print(f"    4. เบิก Timber Log {WOOD_BATCH_SIZE} ท่อน เพื่อเปิดพื้นที่ 15 KG ก่อน จึงฝาก Wood Plank ตามเข้าไป")
    print("-" * 75)
    print("🕹️  ปุ่มควบคุม:")
    print("    👉 กด [ F8 ]  : เริ่มต้น / หยุด ระบบออโต้ลูป Sawmill (Auto-Loop)")
    print("    👉 กด [ F7 ]  : ทดสอบสลับไม้ 1 ครั้งแบบ Manual")
    print("    👉 กด [ F9 ]  : หยุดชั่วคราว / ทำงานต่อ (Pause / Resume)")
    print("    👉 กด [ F10 ] : ออกจากโปรแกรมทันที (Emergency Exit)")
    print("=" * 75)
    print("[*] ระบบสแตนด์บาย... สลับเข้าเกม FiveM ยืนหน้า Sawmill แล้วกด [ F8 ] ได้เลยครับ!\n")

    is_running = False
    is_paused = False
    sct = mss.mss()
    round_count = 0

    try:
        while True:
            # ปุ่มออกฉุกเฉิน
            if keyboard.is_pressed("f10"):
                print("\n[!] ปิดโปรแกรมเรียบร้อย (F10)")
                break

            # ปุ่มหยุดชั่วคราว
            if keyboard.is_pressed("f9"):
                is_paused = not is_paused
                print(f"\n[F9] สถานะ: {'PAUSED (หยุดชั่วคราว)' if is_paused else 'RESUMED (ทำงานต่อ)'}")
                time.sleep(0.4)

            if is_paused:
                time.sleep(0.2)
                continue

            # สลับสถานะเปิด/ปิด โหมดออโต้ด้วย F8
            if keyboard.is_pressed("f8"):
                is_running = not is_running
                status_str = "🟢 เริ่มการทำงาน (AUTO RUNNING)" if is_running else "🔴 หยุดการทำงาน (STOPPED)"
                print(f"\n[F8] ระบบออโต้ Sawmill: {status_str}")
                time.sleep(0.5)

            # โหมด Manual 1 รอบ ด้วย F7
            if keyboard.is_pressed("f7"):
                print("\n[F7] ได้รับคำสั่งทดสอบย้ายไม้ 1 รอบ...")
                execute_wood_swap(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm)
                time.sleep(0.6)

            # ----------------------------------------------------
            # 🔁 FULL AUTONOMOUS SAWMILL LOOP
            # ----------------------------------------------------
            if is_running:
                # 1. ตรวจสอบว่า Timber Log เหลือ 0 หรือยัง (ขึ้น Ready / Process Timber Log)
                is_ready = is_timber_log_zero(sct, ocr_engine)

                if not is_ready:
                    print("[⏳ Sawmill] กำลังแปรรูปไม้อยู่... (รอจนกว่า Timber Log จะเหลือ 0)", end="\r")
                    time.sleep(1.2)
                    continue

                # 2. เมื่อ Timber Log เหลือ 0 แล้ว!
                round_count += 1
                print(f"\n\n🎯 [รอบที่ {round_count}] ตรวจพบ Timber Log เหลือ 0 แล้ว! (แปรรูปเสร็จสิ้น)")
                time.sleep(random.uniform(0.4, 0.7))

                # 3. กดปุ่ม 'H' เพื่อเปิดเมนูรถ
                print("[1/5] 🚚 กำลังกดปุ่ม 'H' เพื่อเปิดเมนูรถ...")
                press_key('h')
                time.sleep(random.uniform(0.9, 1.2))

                # 4. เลือกคลิก 'OPEN TRUNK' ของรถ 'Terminus'
                print("[2/5] 🚗 กำลังเลือกคลิก 'OPEN TRUNK' ของรถ 'Terminus'...")
                click_terminus_open_trunk(sct, ocr_engine)
                time.sleep(random.uniform(1.0, 1.3))

                # 5. สลับไม้แบบปลอดภัย ป้องกัน That container is full
                print("[3/5] 🪵 กำลังดำเนินการสลับไม้...")
                swap_ok = execute_wood_swap(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm)

                if not swap_ok:
                    print("\n" + "=" * 65)
                    print("  🛑 [ALERT] การสลับไม้ไม่สำเร็จ หรือไม้ท่อนใน Terminus หมด!")
                    print("  ⏸️  ระบบหยุดพักการทำงานชั่วคราว เพื่อป้องกันการกดลูปเปล่า")
                    print("  👉  กรุณาตรวจสอบท้ายรถ แล้วกด [ F8 ] เพื่อทำงานต่อ")
                    print("=" * 65 + "\n")
                    send_discord_alert(
                        "🛑 **[FiveM Alert] ระบบสลับไม้หยุดทำงาน!**\n"
                        f"📊 แปรรูปสำเร็จไปทั้งหมด: {round_count} รอบ\n"
                        "⏸️ บอทหยุดพักอัตโนมัติ กรุณาตรวจสอบท้ายรถ Terminus แล้วกด F8 เพื่อทำงานต่อ",
                        attach_screen=True,
                        tag_user=True
                    )
                    is_running = False
                    continue

                # 6. กดปิดหน้าต่าง
                print(f"[4/5] ❌ กำลังปิดหน้าต่างท้ายรถ...")
                close_inventory_window(CLOSE_INVENTORY_METHOD)
                time.sleep(random.uniform(0.6, 0.9))

                # 7. กดปุ่ม 'E' เพื่อเริ่มแปรรูปไม้อีกครั้ง
                print("[5/5] ⚙️ กำลังกดปุ่ม 'E' เพื่อเริ่มแปรรูปไม้ที่โต๊ะ Sawmill...")
                press_key('e')
                time.sleep(random.uniform(2.0, 2.5))

                print(f"[✓] เริ่มแปรรูปรอบที่ {round_count + 1} เรียบร้อย! วนลูปกลับไปเฝ้าดู Sawmill...\n")

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n[!] ออกจากโปรแกรม")

if __name__ == "__main__":
    main()
