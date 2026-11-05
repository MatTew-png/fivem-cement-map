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
pydirectinput.FAILSAFE = False
pydirectinput.PAUSE = 0.02

DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1563002079969280040/2VG12Di0pUSx_-NrcNAJR6HNgvkcrcgD45ilT0qP9ij9wqaxMCVjB3pSDzqccQwUbKPF"
DISCORD_USER_ID = "422611554475835394"

DIR_PATH = os.path.dirname(os.path.abspath(__file__))

PATH_WOOD_PLANK = os.path.join(DIR_PATH, "target_wood_plank.png")
PATH_TIMBER_LOG = os.path.join(DIR_PATH, "target_timber_log.png")
PATH_CONFIRM_BTN = os.path.join(DIR_PATH, "target_confirm_btn.png")

CONF_ITEM_TEMPLATE = 0.70
CONF_POPUP = 0.70

ROI_VAULT = {"left": 100, "top": 200, "width": 840, "height": 750}
ROI_INVENTORY = {"left": 960, "top": 200, "width": 860, "height": 750}
ROI_STORE_MODAL = {"left": 750, "top": 400, "width": 450, "height": 300}

VAULT_DROP_X = 480
VAULT_DROP_Y = 550
INVENTORY_DROP_X = 1370
INVENTORY_DROP_Y = 780

ALL_DEAD_CENTER_X = 1077
ALL_DEAD_CENTER_Y = 530
CONFIRM_DEAD_CENTER_X = 961
CONFIRM_DEAD_CENTER_Y = 613

# ==========================================
# 🚀 WIN32 NATIVE MOUSE HELPERS
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

def handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2):
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
            time.sleep(random.uniform(0.10, 0.16))
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
                pydirectinput.press('backspace')
                time.sleep(0.04)
                pydirectinput.press('backspace')
                time.sleep(0.04)
                for ch in str(amount):
                    pydirectinput.press(ch)
                    time.sleep(0.05)

            time.sleep(random.uniform(0.15, 0.22))
            win32_click(conf_x, conf_y, hold=0.08)
            time.sleep(0.15)
            return True
        time.sleep(0.08)
    return False

def find_item_in_roi(sct, roi, item_name_keywords, tmpl_item, ocr_engine):
    screen_crop = np.array(sct.grab(roi))
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

    if tmpl_item is not None:
        gray_crop = cv2.cvtColor(screen_crop, cv2.COLOR_BGRA2GRAY)
        res = cv2.matchTemplate(gray_crop, tmpl_item, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val >= CONF_ITEM_TEMPLATE:
            target_x = roi["left"] + max_loc[0] + (tmpl_item.shape[1] // 2)
            target_y = roi["top"] + max_loc[1] + (tmpl_item.shape[0] // 2)
            return target_x, target_y, f"Template ({max_val:.2f})"

    return None, None, None

def run_transfer_cycle(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm):
    print("\n" + "=" * 60)
    print("  🚀 เริ่มสลับไอเทม (เบิก Timber Log 30 ท่อน -> ฝาก Wood Plank ทั้งหมด)")
    print("=" * 60)

    # 1. เบิก Timber Log 30 ท่อน
    lx, ly, method = find_item_in_roi(sct, ROI_VAULT, ["timber", "log"], tmpl_log, ocr_engine)
    if lx is not None:
        print(f"[*] [Timber Log] พบที่ ({lx}, {ly}) ผ่าน {method} -> กำลังเบิก 30 ท่อน...")
        smooth_drag_and_drop(lx, ly, INVENTORY_DROP_X, INVENTORY_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount=30, timeout=2.2)
        print("[✓] เบิก Timber Log 30 ท่อน เรียบร้อย!")
    else:
        print("[-] ไม่พบ Timber Log ในคลัง")

    time.sleep(random.uniform(0.3, 0.5))

    # 2. ฝาก Wood Plank
    wood_transferred = 0
    for attempt in range(10):
        wx, wy, method = find_item_in_roi(sct, ROI_INVENTORY, ["wood", "plank"], tmpl_wood, ocr_engine)
        if wx is None:
            break
        print(f"[*] [Wood Plank] พบที่ ({wx}, {wy}) -> กำลังฝากเข้าคลัง...")
        smooth_drag_and_drop(wx, wy, VAULT_DROP_X, VAULT_DROP_Y)
        handle_amount_popup(sct, tmpl_confirm, amount="ALL", timeout=2.2)
        wood_transferred += 1
        time.sleep(random.uniform(0.25, 0.4))

    print(f"[✓] สลับไอเทมเรียบร้อย! (ฝาก Wood Plank {wood_transferred} รายการ)\n")

def main():
    def load_gray(p):
        return cv2.imread(p, cv2.IMREAD_GRAYSCALE) if os.path.exists(p) else None

    print("[*] กำลังโหลด RapidOCR Engine...")
    ocr_engine = RapidOCR()

    tmpl_wood = load_gray(PATH_WOOD_PLANK)
    tmpl_log = load_gray(PATH_TIMBER_LOG)
    tmpl_confirm = load_gray(PATH_CONFIRM_BTN)

    print("=" * 68)
    print("  🪵 FiveM Wood Transfer Tool (Win32 Native Mouse Anti-Glitch)")
    print("=" * 68)
    print("    👉 กด [ F7 ]  : ทำงาน 1 ครั้งทันที")
    print("    👉 กด [ F8 ]  : เปิด/ปิด โหมดออโต้ต่อเนื่อง")
    print("    👉 กด [ F9 ]  : หยุดชั่วคราว / ทำงานต่อ")
    print("    👉 กด [ F10 ] : ปิดโปรแกรมทันที (Exit)")
    print("=" * 68)

    auto_mode = False
    is_paused = False
    sct = mss.mss()
    last_auto_time = 0

    try:
        while True:
            if keyboard.is_pressed("f10"):
                print("\n[!] ปิดโปรแกรมเรียบร้อย (F10)")
                break

            if keyboard.is_pressed("f9"):
                is_paused = not is_paused
                print(f"\n[F9] สถานะ: {'PAUSED' if is_paused else 'RESUMED'}")
                time.sleep(0.4)

            if is_paused:
                time.sleep(0.2)
                continue

            if keyboard.is_pressed("f7"):
                print("\n[F7] คำสั่งย้ายไอเทม 1 รอบ...")
                run_transfer_cycle(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm)
                time.sleep(0.6)

            if keyboard.is_pressed("f8"):
                auto_mode = not auto_mode
                print(f"\n[F8] โหมดออโต้: {'เปิดใช้งาน' if auto_mode else 'ปิดใช้งาน'}")
                time.sleep(0.5)

            if auto_mode and (time.time() - last_auto_time > 3.0):
                wx, _, _ = find_item_in_roi(sct, ROI_INVENTORY, ["wood", "plank"], tmpl_wood, ocr_engine)
                lx, _, _ = find_item_in_roi(sct, ROI_VAULT, ["timber", "log"], tmpl_log, ocr_engine)
                if wx is not None or lx is not None:
                    run_transfer_cycle(sct, ocr_engine, tmpl_wood, tmpl_log, tmpl_confirm)
                last_auto_time = time.time()

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n[!] ออกจากโปรแกรม")

if __name__ == "__main__":
    main()
