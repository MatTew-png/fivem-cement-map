// ระบบความปลอดภัยและรหัสผ่านประจำวันสำหรับแก๊ง FiveM (รันทุกเวิบ COOLDOWN)

export interface GangSession {
  memberName: string;
  authDate: string; // YYYY-MM-DD
  authenticatedAt: number; // timestamp
  isMaster: boolean;
}

export interface ActivityLog {
  id: string;
  memberName: string;
  action: 'login' | 'cooldown_start' | 'pin_copied';
  details?: string;
  timestamp: number;
}

const GANG_SECRET_SEED = 'RUNTHUKVERB_GANG_SECRET_KEY_2026';
const MASTER_PIN_KEY = 'runthukverb_master_pin';
const SESSION_STORAGE_KEY = 'runthukverb_gang_session';
const ACTIVITY_LOGS_KEY = 'runthukverb_activity_logs';

// Default Master PIN สำหรับหัวหน้าแก๊ง (สามารถใช้เข้าได้ทุกวันและดูตารางรหัส)
export const DEFAULT_MASTER_PIN = '999999';

// ฟังก์ชันแปลง Date เป็นสตริง YYYY-MM-DD ในเขตเวลาท้องถิ่น (Local Time)
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// DJB2 Hash Algorithm สำหรับสร้างรหัส 6 หลักที่แน่นอนในแต่ละวัน
function hashDateToPIN(dateStr: string): string {
  const input = `${dateStr}_${GANG_SECRET_SEED}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const pinNum = (Math.abs(hash) % 900000) + 100000;
  return String(pinNum);
}

// คืนค่ารหัสประจำวันของวันที่ระบุ
export function getDailyPIN(date: Date = new Date()): string {
  return hashDateToPIN(getLocalDateString(date));
}

// คืนค่า Master PIN ของหัวหน้าแก๊ง
export function getMasterPIN(): string {
  return localStorage.getItem(MASTER_PIN_KEY) || DEFAULT_MASTER_PIN;
}

// บันทึก Master PIN ใหม่ (สำหรับหัวหน้า)
export function setMasterPIN(newPin: string): boolean {
  if (!newPin || newPin.length < 6) return false;
  localStorage.setItem(MASTER_PIN_KEY, newPin);
  return true;
}

// ดึงตารางรหัสผ่านล่วงหน้า X วัน (สำหรับหัวหน้าเอาไปโพสต์ใน Discord)
export function getUpcomingPINs(days: number = 7): Array<{
  dateStr: string;
  dayName: string;
  pin: string;
  isToday: boolean;
}> {
  const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const result = [];
  const todayStr = getLocalDateString();

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    const dayName = daysOfWeek[d.getDay()];
    const pin = hashDateToPIN(dateStr);

    result.push({
      dateStr,
      dayName: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
      pin,
      isToday: dateStr === todayStr,
    });
  }

  return result;
}

// ฟอร์แมตข้อความตารางรหัสผ่านสำหรับกด Copy ไปวางใน Discord ได้ทันที
export function formatPINsForDiscord(): string {
  const pins = getUpcomingPINs(7);
  let text = `👑 **[รันทุกเวิบ COOLDOWN] - ตารางรหัสผ่านประจำวันของแก๊ง** 🔒\n`;
  text += `> ⚠️ ห้ามส่งต่อให้คนนอกแก๊งเด็ดขาด รหัสจะเปลี่ยนอัตโนมัติทุก 00:00 น.\n\n`;

  pins.forEach((item) => {
    if (item.isToday) {
      text += `🔥 **วันนี้ ${item.dayName}:** \`${item.pin}\`  *(ใช้งานอยู่)*\n`;
    } else {
      text += `📅 ${item.dayName}: \`${item.pin}\`\n`;
    }
  });

  text += `\n🌐 ลิงก์แผนที่แก๊ง: https://runthukverb-cooldown.surge.sh`;
  return text;
}

// ตรวจสอบความถูกต้องของ PIN
export function verifyPIN(
  inputPin: string,
  memberName: string
): { success: boolean; isMaster: boolean; error?: string } {
  const cleanPin = inputPin.trim();
  const cleanName = memberName.trim();

  if (!cleanName) {
    return { success: false, isMaster: false, error: 'กรุณากรอกชื่อเล่นหรือเลขสมาชิกในแก๊ง' };
  }

  const todayPIN = getDailyPIN();
  const masterPIN = getMasterPIN();

  if (cleanPin === masterPIN) {
    const session: GangSession = {
      memberName: cleanName,
      authDate: getLocalDateString(),
      authenticatedAt: Date.now(),
      isMaster: true,
    };
    saveGangSession(session);
    logActivity(cleanName, 'login', 'เข้าสู่ระบบด้วย Master PIN (หัวหน้าแก๊ง)');
    return { success: true, isMaster: true };
  }

  if (cleanPin === todayPIN) {
    const session: GangSession = {
      memberName: cleanName,
      authDate: getLocalDateString(),
      authenticatedAt: Date.now(),
      isMaster: false,
    };
    saveGangSession(session);
    logActivity(cleanName, 'login', 'เข้าสู่ระบบด้วยรหัสผ่านประจำวัน');
    return { success: true, isMaster: false };
  }

  return { success: false, isMaster: false, error: 'รหัสผ่านไม่ถูกต้อง กรุณาเช็คใน Discord แก๊ง' };
}

// บันทึก Session
export function saveGangSession(session: GangSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

// ดึง Session ปัจจุบัน
export function getGangSession(): GangSession | null {
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!data) return null;
    const session: GangSession = JSON.parse(data);

    // ตรวจสอบว่าวันที่บันทึกไว้ตรงกับวันนี้หรือไม่ (ถ้าข้ามวันแล้ว ต้องล็อกอินใหม่)
    const todayStr = getLocalDateString();
    if (session.authDate !== todayStr) {
      // หมดอายุแล้ว
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ตรวจสอบว่า Session ยังใช้ได้ในวันนี้หรือไม่
export function isSessionValidToday(): boolean {
  return getGangSession() !== null;
}

// ออกจากระบบ
export function logoutGang(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// บันทึก Activity Log ลง LocalStorage
export function logActivity(memberName: string, action: ActivityLog['action'], details?: string): void {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOGS_KEY);
    const logs: ActivityLog[] = raw ? JSON.parse(raw) : [];

    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memberName,
      action,
      details,
      timestamp: Date.now(),
    };

    // เก็บประวัติย้อนหลังสูงสุด 50 รายการ
    const updated = [newLog, ...logs].slice(0, 50);
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

// ดึง Activity Logs
export function getActivityLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
