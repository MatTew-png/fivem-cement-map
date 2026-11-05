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

# Discord Webhook สำหรับแจ้งเตือนเข้ามือถือ
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1563002079969280040/2VG12Di0pUSx_-NrcNAJR6HNgvkcrcgD45ilT0qP9ij9wqaxMCVjB3pSDzqccQwUbKPF"
DISCORD_USER_ID = "422611554475835394"

DIR_PATH = os.path.dirname(os.path.abspath(__file__))

PATH_BOUQUET = os.path.join(DIR_PATH, "target_bouquet.png")
PATH_BOUQUET_BOX = os.path.join(DIR_PATH, "target_bouquet_box.png")
PATH_CONFIRM_BTN = os.path.join(DIR_PATH, "target_confirm_btn.png")
PATH_TERMINUS_TRUNK = os.path.join(DIR_PATH, "target_terminus_open_trunk.png")

# ค่าความแม่นยำ Template Matching
CONF_ITEM_TEMPLATE = 0.70
CONF_POPUP = 0.70

# 🌸 จำนวนช่อดอกไม้ Bouquet ที่จะเบิกต่อรอบ (รอบละ 30 ชิ้น = 15 KG พอดีกับช่องว่างในตัว)
BOUQUET_BATCH_SIZE = 30

# 🚗 ชื่อรถที่ใช้เปิดท้ายเก็บของ
VEHICLE_TARGET_NAME = "Terminus"

# 🔘 วิธีการปิดหน้าต่าง: 'esc' หรือ 'click_outside'
CLOSE_INVENTORY_METHOD = 'esc'

# ==========================================
# 📐 SCREEN REGIONS (1920x1080)
# ==========================================
# 1. กรอบแสดงสถานะ Pack Bouquet ทางขวามือ
ROI_PROCESS_WIDGET = {"left": 1580, "top": 430, "width": 330, "height": 330}
# 2. เมนูเลือกรถ WOOD/FLOWER PROCESS หลังกด H
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

# 🎯 พิกัดปล่อยไอเทม
# - ฝั่งซ้าย: ปล่อยลงพื้นที่ว่างท้ายรถ Terminus (Row 3 ว่าง 100%)
VAULT_DROP_X = 480
VAULT_DROP_Y = 550
# - ฝั่งขวา: ปล่อยลงช่องว่างแถว 4 ของกระเป๋าตัวละคร (ว่าง 100% ไม่ทับไอเทมอื่น)
INVENTORY_DROP_X = 1370
INVENTORY_DROP_Y = 780

# พิกัดกล่องกรอกตัวเลข Amount และปุ่มยืนยัน
AMOUNT_INPUT_X = 935
AMOUNT_INPUT_Y = 532
ALL_DEAD_CENTER_X = 1077
ALL_DEAD_CENTER_Y = 530
CONFIRM_DEAD_CENTER_X = 961
CONFIRM_DEAD_CENTER_Y = 613

# พิกัดปุ่ม OPEN TRUNK ของ Terminus
TERMINUS_OPEN_TRUNK_X = 495
TERMINUS_OPEN_TRUNK_Y = 553

# พิกัดคลิกนอกกรอบเพื่อปิดหน้าต่าง
OUTSIDE_CLICK_X = 50
OUTSIDE_CLICK_Y = 500

# ==========================================
# 🔔 DISCORD NOTIFICATION
# ==========================================
def send_discord_alert(message, attach_screen=False, tag_user=False):
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
# 🚀 WIN32 NATIVE MOUSE & KEYBOARD
# ==========================================
def win32_move(x, y):
    safe_x = max(10, min(1910, int(x)))
    safe_y = max(10, min(1070, int(y)))
    user32.SetCursorPos(safe_x, safe_y)
    user32.mouse_event(0x0001, 0, 0, 0, 0)

def win32_click(x, y, hold=0.08):
    win32_move(x, y)
    time.sleep(0.06)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(hold)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.06)

def press_key(key, hold=0.08):
    pydirectinput.keyDown(key)
    time.sleep(hold)
    pydirectinput.keyUp(key)
    time.sleep(0.08)

def smooth_drag_and_drop(start_x, start_y, end_x, end_y, steps=40):
    start_x = max(10, min(1910, int(start_x)))
    start_y = max(10, min(1070, int(start_y)))
    end_x = max(10, min(1910, int(end_x)))
    end_y = max(10, min(1070, int(end_y)))

    win32_move(start_x, start_y)
    time.sleep(random.uniform(0.10, 0.14))
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(random.uniform(0.08, 0.12))

    dx = end_x - start_x
    dy = end_y - start_y
    dist = max(1.0, math.hypot(dx, dy))
    duration = random.uniform(0.40, 0.52)
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
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(random.uniform(0.12, 0.18))

def handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.5):
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
                all_x = conf_x + 116
                all_y = conf_y - 83
                win32_click(all_x, all_y, hold=0.07)
                time.sleep(0.06)
                win32_click(all_x, all_y, hold=0.07)
            else:
                input_x = conf_x - 26
                input_y = conf_y - 81
                win32_click(input_x, input_y, hold=0.08)
                time.sleep(0.08)
                pydirectinput.keyDown('ctrl')
                pydirectinput.press('a')
                pydirectinput.keyUp('ctrl')
                time.sleep(0.04)
                press_key('backspace')
                time.sleep(0.04)
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
    time.sleep(random.uniform(0.3, 0.5))
    if method == 'esc':
        print("[*] กำลังกดปุ่ม 'ESC' เพื่อปิดหน้าต่างคลัง...")
        press_key('esc')
    elif method == 'click_outside':
        print(f"[*] กำลังคลิกนอกกรอบที่ ({OUTSIDE_CLICK_X}, {OUTSIDE_CLICK_Y}) เพื่อปิดหน้าต่าง...")
        win32_click(OUTSIDE_CLICK_X, OUTSIDE_CLICK_Y, hold=0.08)
    time.sleep(random.uniform(0.6, 0.8))

# ==========================================
# 🔍 COMPUTER VISION (FLOWER & WEIGHT)
# ==========================================
def is_pack_bouquet_done(sct, ocr_engine):
    """
    ตรวจสอบสถานะการแพ็กดอกไม้ทางขวาจอ:
    - คืนค่า True: เมื่อขึ้น Ready หรือ Pack Bouquet หรือตัวเลขเหลือ 0
    - คืนค่า False: เมื่อระบบยังคง Processing แปรรูปอยู่
    """
    crop = np.array(sct.grab(ROI_PROCESS_WIDGET))
    bgr = cv2.cvtColor(crop, cv2.COLOR_BGRA2BGR)
    try:
        res, _ = ocr_engine(bgr)
        if not res:
            return False

        texts = [t[1].lower() for t in res]
        full_text = " ".join(texts)

        if any(k in full_text for k in ["processing", "frocecsing"]):
            return False
        if any(k in full_text for k in ["ready", "roay", "pack", "pwck", "process"]):
            return True
        for t in texts:
            if t in ["x0", "x 0", "0"]:
                return True
    except Exception:
        pass
    return False

def is_trunk_full(sct):
    """ตรวจสอบว่าท้ายรถเต็ม 150/150 KG หรือไม่ (ตรวจหลอดสีแดง)"""
    try:
        crop_tw = np.array(sct.grab(ROI_TRUNK_WEIGHT))
        b, g, r = crop_tw[:, :, 0], crop_tw[:, :, 1], crop_tw[:, :, 2]
        red_mask = (r > 170) & (g < 110) & (b < 110)
        return np.sum(red_mask) > 200
    except Exception:
        return False

def click_terminus_open_trunk(sct, ocr_engine):
    """ค้นหารถ Terminus แล้วคลิกปุ่ม OPEN TRUNK"""
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
                    if b_cy > t_cy:
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
    """อ่านค่าน้ำหนักหลอดล่างของทั้ง 2 ฝั่ง"""
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

def find_item_in_roi(sct, roi, item_type, tmpl_item, ocr_engine):
    """
    ค้นหาไอเทมตาม 'ชื่อไอเทมจริง' (Dynamic OCR) ร่วมกับ 'ภาพไอคอน' (Template Matching):
    - ไม่จำตำแหน่งคงที่ ทำให้ไอเทมสลับไปอยู่ช่องไหน แถวไหน ก็ตรวจจับได้ถูกต้อง 100%
    - แยกแยะ 'Bouquet' และ 'Bouquet Box' ออกจาก 'Lucky Box / Event Box' ป้องกันข้อผิดพลาด 'That cannot go in there.'
    """
    screen_crop = np.array(sct.grab(roi))

    # 1. ค้นหาด้วย RapidOCR จากตัวหนังสือชื่อไอเทมใต้ช่อง (แม่นยำที่สุด)
    if ocr_engine is not None:
        try:
            bgr_crop = cv2.cvtColor(screen_crop, cv2.COLOR_BGRA2BGR)
            ocr_results, _ = ocr_engine(bgr_crop)
            if ocr_results:
                for box, text, _ in ocr_results:
                    t = text.lower()
                    matched = False
                    
                    if item_type == 'bouquet':
                        # ต้องเป็นช่อดอกไม้ และต้องไม่มีคำว่า box เด็ดขาด
                        if any(k in t for k in ["bouquet", "bouqunt", "bcurunt", "bouqast", "bouq", "ช่อ"]) and "box" not in t:
                            matched = True
                    elif item_type == 'bouquet_box':
                        # ต้องเป็นกล่องดอกไม้ และต้องไม่ใช่ Lucky Box หรือ Event Box
                        if "lucky" in t or "event" in t:
                            continue
                        if any(k in t for k in ["bouquet box", "bouqast box", "bouqunt box"]) or ("box" in t and any(b in t for b in ["bouq", "bcur", "flower"])):
                            matched = True

                    if matched:
                        cx = int(sum(p[0] for p in box) / 4)
                        cy = int(sum(p[1] for p in box) / 4)
                        target_x = roi["left"] + cx
                        target_y = roi["top"] + cy - 45
                        return target_x, target_y, f"OCR '{text}'"
        except Exception:
            pass

    # 2. ค้นหาด้วยภาพไอคอน (Template Matching สำรองกรณีอ่านตัวอักษรไม่ออก)
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
# 🔄 SMART SWAP ROUTINE (BOUQUET <-> BOUQUET BOX)
# ==========================================
def execute_flower_swap(sct, ocr_engine, tmpl_bouquet, tmpl_box, tmpl_confirm):
    """
    ขั้นตอนสลับดอกไม้แบบปลอดภัย 100%:
    1. ตรวจสอบสถานะท้ายรถ Terminus
    2. เบิก Bouquet 30 ชิ้น (15 KG) จากท้ายรถซ้าย -> มาลงช่องว่างแถว 4 ในกระเป๋า (1370, 780)
       -> เปิดพื้นที่ว่างในท้ายรถทันที 15 KG
    3. ฝาก Bouquet Box ทั้งหมดจากกระเป๋าขวา -> เข้าท้ายรถ Terminus ซ้าย
       -> เติมลงในพื้นที่ว่าง 15 KG ที่เพิ่งเปิดพอดีเป๊ะ
    4. Guard Check: ฝั่งขวาต้องไม่เหลือ Bouquet Box ตกค้าง
    """
    print("\n" + "=" * 70)
    print(f"  🌸 สลับดอกไม้ (เบิก Bouquet {BOUQUET_BATCH_SIZE} ชิ้น -> ฝาก Bouquet Box ทั้งหมด)")
    print("=" * 70)

    trunk_full = is_trunk_full(sct)
    print(f"[*] สถานะท้ายรถ Terminus เริ่มต้น: {'⚠️ เต็ม 150/150 KG (ต้องเบิก Bouquet ก่อน)' if trunk_full else '🟢 มีที่ว่าง'}")

    # ----------------------------------------------------
    # ส่วนที่ 1: เบิก Bouquet จากท้ายรถซ้าย มาที่ช่องว่างกระเป๋าขวา (แถว 4)
    # ----------------------------------------------------
    bx, by, method = find_item_in_roi(sct, ROI_VAULT, 'bouquet', tmpl_bouquet, ocr_engine)
    if bx is None:
        print("[🛑 ALERT] ไม่พบ 'Bouquet' ในท้ายรถ Terminus! (ช่อดอกไม้หมดแล้ว)")
        return False

    print(f"[*] [Bouquet] พบที่ ({bx}, {by}) ผ่าน {method}")
    print(f"    -> กำลังลากไปลง 'ช่องว่างแถว 4 ในกระเป๋า' ({INVENTORY_DROP_X}, {INVENTORY_DROP_Y})...")
    smooth_drag_and_drop(bx, by, INVENTORY_DROP_X, INVENTORY_DROP_Y)

    # กรอกจำนวน 30 ชิ้น (15 KG)
    popup_ok = handle_amount_popup(sct, tmpl_confirm, amount=BOUQUET_BATCH_SIZE, timeout=2.5)
    time.sleep(0.5)

    trunk_still_full = is_trunk_full(sct)
    if trunk_still_full and not popup_ok:
        print("[⚠️] การเบิก Bouquet ไม่สำเร็จ! ท้ายรถยังคงเต็ม 150/150 KG")
        print("    -> ข้ามการฝาก Bouquet Box ทันที เพื่อป้องกันการเกิด 'That container is full'")
        return False

    print(f"[✓] เบิก Bouquet {BOUQUET_BATCH_SIZE} ชิ้น สำเร็จ! (ท้ายรถเปิดพื้นที่ว่าง 15 KG แล้ว)")
    time.sleep(random.uniform(0.35, 0.55))

    # ----------------------------------------------------
    # ส่วนที่ 2: ฝาก Bouquet Box จากตัวขวา เข้าท้ายรถซ้าย
    # ----------------------------------------------------
    box_stored_count = 0
    max_box_attempts = 5

    for attempt in range(max_box_attempts):
        box_x, box_y, method = find_item_in_roi(sct, ROI_INVENTORY, 'bouquet_box', tmpl_box, ocr_engine)
        if box_x is None:
            print("[-] ไม่มี Bouquet Box ในตัว (พร้อมแปรรูปต่อ)")
            break

        print(f"[*] [Bouquet Box] พบในตัวที่ ({box_x}, {box_y}) ผ่าน {method}")
        print(f"    -> กำลังลากฝากเข้าพื้นที่ว่างท้ายรถ ({VAULT_DROP_X}, {VAULT_DROP_Y})...")
        smooth_drag_and_drop(box_x, box_y, VAULT_DROP_X, VAULT_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2)
        box_stored_count += 1
        time.sleep(random.uniform(0.3, 0.45))

    # ----------------------------------------------------
    # ส่วนที่ 3: ตรวจสอบความปลอดภัย "ฝั่งขวาต้องไม่เหลือ Bouquet Box"
    # ----------------------------------------------------
    time.sleep(0.25)
    verify_box_x, _, _ = find_item_in_roi(sct, ROI_INVENTORY, 'bouquet_box', tmpl_box, ocr_engine)
    if verify_box_x is None:
        print("  ✅ [ตรวจสอบสมบูรณ์] ฝั่งขวาไม่เหลือ Bouquet Box ตกค้าง (0 ชิ้น)")
    else:
        print("  ⚠️ [แจ้งเตือน] ยังตรวจพบ Bouquet Box ตกค้างในตัว! กำลังลากเก็บซ้ำ...")
        smooth_drag_and_drop(verify_box_x, box_y, VAULT_DROP_X, VAULT_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2)

    # ----------------------------------------------------
    # ส่วนที่ 4: ตรวจสอบค่าน้ำหนักหลอดล่าง
    # ----------------------------------------------------
    trunk_wt, inv_wt = read_weight_status(sct, ocr_engine)
    print(f"  📊 สถานะน้ำหนัก: ท้ายรถ Terminus [{trunk_wt}] | กระเป๋าในตัว [{inv_wt}]")
    print("=" * 70 + "\n")

    return True

# ==========================================
# 🏁 MAIN AUTONOMOUS FLOWER BOT
# ==========================================
def main():
    def load_gray(p):
        return cv2.imread(p, cv2.IMREAD_GRAYSCALE) if os.path.exists(p) else None

    print("[*] กำลังเตรียมระบบ RapidOCR Engine...")
    ocr_engine = RapidOCR()

    tmpl_bouquet = load_gray(PATH_BOUQUET)
    tmpl_box = load_gray(PATH_BOUQUET_BOX)
    tmpl_confirm = load_gray(PATH_CONFIRM_BTN)

    print("=" * 75)
    print("  🌸 FiveM Autonomous Flower Bot (Bouquet -> Bouquet Box)")
    print("=" * 75)
    print("📋 ข้อมูลการทำงาน:")
    print(f"    1. วัตถุดิบ (Raw)      : Bouquet (ช่อดอกไม้) -> เบิกรอบละ {BOUQUET_BATCH_SIZE} ชิ้น")
    print(f"    2. ของแปรรูป (Product) : Bouquet Box (กล่องดอกไม้) -> ฝากท้ายรถทั้งหมด")
    print("    3. ลากลงช่องว่างแท้จริง : แถว 4 ในกระเป๋า (1370, 780) ป้องกันทับไอเทมอื่น")
    print("    4. ป้องกันท้ายรถเต็ม    : เบิก Bouquet เพื่อเปิดพื้นที่ก่อน แล้วฝาก Bouquet Box ตามเข้า")
    print("-" * 75)
    print("🕹️  ปุ่มควบคุม:")
    print("    👉 กด [ F8 ]  : เริ่มต้น / หยุด ระบบออโต้ลูป Pack Bouquet")
    print("    👉 กด [ F7 ]  : ทดสอบสลับดอกไม้ 1 ครั้งแบบ Manual")
    print("    👉 กด [ F9 ]  : หยุดชั่วคราว / ทำงานต่อ (Pause / Resume)")
    print("    👉 กด [ F10 ] : ออกจากโปรแกรมทันที (Emergency Exit)")
    print("=" * 75)
    print("[*] ระบบสแตนด์บาย... สลับเข้าเกม FiveM ยืนหน้าโต๊ะ Pack Bouquet แล้วกด [ F8 ] ได้เลยครับ!\n")

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
                print(f"\n[F8] ระบบออโต้ Pack Bouquet: {status_str}")
                time.sleep(0.5)

            # โหมด Manual 1 รอบ ด้วย F7
            if keyboard.is_pressed("f7"):
                print("\n[F7] ได้รับคำสั่งทดสอบย้ายดอกไม้ 1 รอบ...")
                execute_flower_swap(sct, ocr_engine, tmpl_bouquet, tmpl_box, tmpl_confirm)
                time.sleep(0.6)

            # ----------------------------------------------------
            # 🔁 FULL AUTONOMOUS FLOWER LOOP
            # ----------------------------------------------------
            if is_running:
                # 1. ตรวจสอบว่าแพ็กเสร็จหรือยัง (ขึ้น Ready / Pack Bouquet)
                is_ready = is_pack_bouquet_done(sct, ocr_engine)

                if not is_ready:
                    print("[⏳ Flower] กำลังแพ็กดอกไม้อยู่... (รอจนกว่าจะเสร็จ)", end="\r")
                    time.sleep(1.2)
                    continue

                # 2. เมื่อแพ็กดอกไม้เสร็จสิ้น
                round_count += 1
                print(f"\n\n🎯 [รอบที่ {round_count}] แพ็กดอกไม้เสร็จสิ้น! (เริ่มขั้นตอนเปิดท้ายรถ)")
                time.sleep(random.uniform(0.4, 0.7))

                # 3. กดปุ่ม 'H' เพื่อเปิดเมนูรถ
                print("[1/5] 🚚 กำลังกดปุ่ม 'H' เพื่อเปิดเมนูรถ...")
                press_key('h')
                time.sleep(random.uniform(0.9, 1.2))

                # 4. เลือกคลิก 'OPEN TRUNK' ของรถ 'Terminus'
                print(f"[2/5] 🚗 กำลังเลือกคลิก 'OPEN TRUNK' ของรถ '{VEHICLE_TARGET_NAME}'...")
                click_terminus_open_trunk(sct, ocr_engine)
                time.sleep(random.uniform(1.0, 1.3))

                # 5. สลับดอกไม้ (Bouquet เข้าตัว -> Bouquet Box เข้าท้ายรถ)
                print("[3/5] 🌸 กำลังดำเนินการสลับดอกไม้...")
                swap_ok = execute_flower_swap(sct, ocr_engine, tmpl_bouquet, tmpl_box, tmpl_confirm)

                if not swap_ok:
                    print("\n" + "=" * 65)
                    print(f"  🛑 [ALERT] การสลับของไม่สำเร็จ หรือ Bouquet ใน {VEHICLE_TARGET_NAME} หมด!")
                    print("  ⏸️  ระบบหยุดพักการทำงานชั่วคราว เพื่อป้องกันการกดลูปเปล่า")
                    print(f"  👉  กรุณาเติม Bouquet ใส่รถ {VEHICLE_TARGET_NAME} แล้วกด [ F8 ] เพื่อทำงานต่อ")
                    print("=" * 65 + "\n")
                    send_discord_alert(
                        f"🛑 **[FiveM Alert] ช่อดอกไม้ (Bouquet) ในรถ {VEHICLE_TARGET_NAME} หมดแล้ว!**\n"
                        f"📊 แพ็กสำเร็จไปทั้งหมด: {round_count} รอบ\n"
                        f"⏸️ บอทหยุดพักอัตโนมัติ กรุณาเติม Bouquet ใส่รถแล้วกด F8 ต่อครับ",
                        attach_screen=True,
                        tag_user=True
                    )
                    is_running = False
                    continue

                # 6. กดปิดหน้าต่าง
                print(f"[4/5] ❌ กำลังปิดหน้าต่างท้ายรถ...")
                close_inventory_window(CLOSE_INVENTORY_METHOD)
                time.sleep(random.uniform(0.6, 0.9))

                # 7. กดปุ่ม 'E' เพื่อเริ่มแพ็กดอกไม้อีกครั้ง
                print("[5/5] ⚙️ กำลังกดปุ่ม 'E' เพื่อเริ่มแพ็กดอกไม้ที่โต๊ะ Pack Bouquet...")
                press_key('e')
                time.sleep(random.uniform(2.0, 2.5))

                print(f"[✓] เริ่มแพ็กรอบที่ {round_count + 1} เรียบร้อย! วนลูปกลับไปเฝ้าดูโต๊ะดอกไม้...\n")

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n[!] ออกจากโปรแกรม")

if __name__ == "__main__":
    main()
