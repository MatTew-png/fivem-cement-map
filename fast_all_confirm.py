import time
import random
import math
import ctypes
import keyboard

# ==========================================
# ⚙️ HUMANIZED MACRO CONFIGURATION
# ==========================================
user32 = ctypes.windll.user32

# 🕹️ ปุ่มสำหรับกดใช้งานบนคีย์บอร์ด (ล็อกเฉพาะปุ่ม C ทางกายภาพระดับ Hardware VK)
VK_C = 0x43       # Physical 'C' key (0x43) - ป้องกันบั๊กภาษาไทยของปุ่ม 'ใ' เด็ดขาด
VK_F10 = 0x79     # ปุ่ม F10 สำหรับปิดโปรแกรม

# 🖱️ ปิดการทำงานของปุ่มเมาส์ทั้งหมด (ตามคำสั่ง: ใช้เฉพาะปุ่ม C)
USE_MOUSE_MIDDLE = False
USE_MOUSE_SIDE = False

# 🎯 พิกัดปุ่มบนจอ 1920x1080 (Calibrated Dead-Center)
ALL_X = 1077
ALL_Y = 530

CONFIRM_X = 961
CONFIRM_Y = 613

# 👤 ตัวเลือกความเนียนแบบมนุษย์จริง (Human-like)
RETURN_MOUSE = True   # เลื่อนเมาส์กลับมาที่ตำแหน่งเดิมอย่างนุ่มนวล
USE_PIXEL_JITTER = True # สุ่มพิกัดคลิกเล็กน้อย +/- 3~5 พิกเซล (ไม่คลิกซ้ำจุดเดิมเป๊ะๆ ป้องกันการตรวจจับ)

# ==========================================
# 🚀 WIN32 NATIVE & SMOOTH HUMAN HELPERS
# ==========================================
class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

VK_MBUTTON = 0x04   # ปุ่มกลาง (ลูกกลิ้ง)
VK_XBUTTON1 = 0x05  # ปุ่มข้างเมาส์ 1 (Mouse 4)
VK_XBUTTON2 = 0x06  # ปุ่มข้างเมาส์ 2 (Mouse 5)

def is_key_pressed(vk):
    return (user32.GetAsyncKeyState(vk) & 0x8000) != 0

def win32_move(x, y):
    safe_x = max(10, min(1910, int(x)))
    safe_y = max(10, min(1070, int(y)))
    user32.SetCursorPos(safe_x, safe_y)
    user32.mouse_event(0x0001, 0, 0, 0, 0)

def human_click(hold=None):
    """คลิกแบบมนุษย์จริง มีระยะเวลากดค้างที่เป็นธรรมชาติ (45 - 65 ms)"""
    if hold is None:
        hold = random.uniform(0.045, 0.065)
    user32.mouse_event(0x0002, 0, 0, 0, 0)  # Left Down
    time.sleep(hold)
    user32.mouse_event(0x0004, 0, 0, 0, 0)  # Left Up

def human_move(start_x, start_y, end_x, end_y, duration=0.12, steps=15):
    """
    เลื่อนเมาส์แบบธรรมชาติ:
    - ผ่อนแรงออกตัวและลงจอด (Smooth Cosine Easing)
    - ไม่วาร์ป ไม่กระตุก ดูเหมือนมือคนลากจริง 100%
    """
    step_delay = duration / steps
    for i in range(1, steps + 1):
        t = i / steps
        ease = (1.0 - math.cos(t * math.pi)) / 2.0
        cur_x = int(start_x + (end_x - start_x) * ease)
        cur_y = int(start_y + (end_y - start_y) * ease)
        win32_move(cur_x, cur_y)
        time.sleep(step_delay)

def execute_humanized_all_confirm():
    """
    ลำดับการทำงานแบบมือคนจริง (รวม ~0.35 - 0.45 วินาที):
    1. เลื่อนเมาส์จากจุดเดิมไปหาปุ่ม ALL อย่างนุ่มนวล
    2. ดับเบิ้ลคลิกปุ่ม ALL ด้วยจังหวะคนกด
    3. เลื่อนเมาส์ลงมาหาปุ่ม Confirm
    4. กด Confirm
    5. เลื่อนเมาส์กลับมาที่ตำแหน่งเดิม
    """
    # บันทึกพิกัดเดิมของเมาส์
    orig_pt = POINT()
    user32.GetCursorPos(ctypes.byref(orig_pt))
    cur_x, cur_y = orig_pt.x, orig_pt.y

    # สุ่มพิกัดเบี่ยงเบนเล็กน้อย เพื่อความสมจริง (ไม่คลิกพิกัดเดิมซ้ำๆ)
    jitter_all_x = ALL_X + (random.randint(-4, 4) if USE_PIXEL_JITTER else 0)
    jitter_all_y = ALL_Y + (random.randint(-3, 3) if USE_PIXEL_JITTER else 0)
    jitter_conf_x = CONFIRM_X + (random.randint(-5, 5) if USE_PIXEL_JITTER else 0)
    jitter_conf_y = CONFIRM_Y + (random.randint(-3, 3) if USE_PIXEL_JITTER else 0)

    # 1. เลื่อนเมาส์ไปยังปุ่ม ALL (ใช้เวลา ~0.10 - 0.14 วิ)
    move_dur_1 = random.uniform(0.10, 0.13)
    human_move(cur_x, cur_y, jitter_all_x, jitter_all_y, duration=move_dur_1, steps=14)
    time.sleep(random.uniform(0.03, 0.05))

    # 2. ดับเบิ้ลคลิก ALL (จังหวะเคาะนิ้วแบบมนุษย์)
    human_click(hold=random.uniform(0.045, 0.060))
    time.sleep(random.uniform(0.050, 0.075))
    human_click(hold=random.uniform(0.040, 0.055))
    time.sleep(random.uniform(0.04, 0.06))

    # 3. เลื่อนเมาส์ลงมาหาปุ่ม Confirm (ใช้เวลา ~0.11 - 0.15 วิ)
    move_dur_2 = random.uniform(0.11, 0.14)
    human_move(jitter_all_x, jitter_all_y, jitter_conf_x, jitter_conf_y, duration=move_dur_2, steps=15)
    time.sleep(random.uniform(0.04, 0.06))

    # 4. คลิกปุ่ม Confirm
    human_click(hold=random.uniform(0.050, 0.070))
    time.sleep(random.uniform(0.04, 0.06))

    # 5. เลื่อนเมาส์กลับไปที่จุดเดิมของคุณอย่างนุ่มนวล
    if RETURN_MOUSE:
        move_dur_3 = random.uniform(0.10, 0.14)
        human_move(jitter_conf_x, jitter_conf_y, orig_pt.x, orig_pt.y, duration=move_dur_3, steps=14)

def main():
    print("=" * 68)
    print("  👤 FiveM Human-Like [ALL + Confirm] Macro")
    print("=" * 68)
    print("[*] ปุ่มกดใช้งาน             : [ C ] เท่านั้น (ระดับ Hardware VK ไม่ซ้อนทับ 'ใ')")
    print("[*] การเคลื่อนที่ของเมาส์    : นุ่มนวล Smooth Easing (ไม่วาร์ป ไม่แข็งทื่อ)")
    print("[*] การสุ่มพิกัด (Anti-Ban)   : เปิด (สุ่มจุดคลิก +/- 3-5px เสมือนคนกดจริง)")
    print("[*] ความเร็วรวม              : ~0.38 - 0.45 วินาที (จังหวะมือโปรเล่นเกม)")
    print("-" * 68)
    print("🕹️  วิธีใช้:")
    print("    1. ลากไอเทมด้วยมือตามปกติ พอหน้าต่างเด้งขึ้นมา")
    print("    2. กดปุ่ม [ C ] บนคีย์บอร์ด")
    print("    -> เมาส์จะเลื่อนไปกด ALL -> ดับเบิ้ลคลิก -> เลื่อนไปกด Confirm -> เลื่อนกลับมาที่เดิม!")
    print("-" * 68)
    print("👉 ปุ่มปิดโปรแกรม : กด [ F10 ]")
    print("=" * 68)
    print("[*] มาโครพร้อมทำงาน... สลับเข้า FiveM ทดสอบได้เลยครับ!\n")

    try:
        while True:
            if is_key_pressed(VK_F10):
                print("\n[!] ปิดมาโครเรียบร้อย (F10)")
                break

            # ล็อกระดับฮาร์ดแวร์ Virtual Key Code (VK_C = 0x43) เฉพาะปุ่ม C ทางกายภาพเท่านั้น
            if is_key_pressed(VK_C):
                execute_humanized_all_confirm()
                print("[👤 HUMAN] กดปุ่ม C -> เลื่อนกด ALL -> Confirm เรียบร้อย!")
                # รอให้ผู้ใช้ปล่อยปุ่ม C เพื่อป้องกันการลั่นซ้ำ
                while is_key_pressed(VK_C):
                    time.sleep(0.01)
                time.sleep(0.08)

            time.sleep(0.005)

    except KeyboardInterrupt:
        print("\n[!] ออกจากโปรแกรม")

if __name__ == "__main__":
    main()
