// ระบบความปลอดภัยและรหัสผ่านประจำวันสำหรับแก๊ง FiveM (รันทุกเวิบ COOLDOWN)

export interface GangSession {
  gangId: string; // e.g. "soydark" (normalized lowercase for keying / topics)
  gangName: string; // e.g. "Soydark" (display name)
  memberName: string;
  authDate: string; // YYYY-MM-DD
  authenticatedAt: number; // timestamp
  isMaster: boolean;
}

export interface ActivityLog {
  id: string;
  memberName: string;
  action: 'login' | 'cooldown_start' | 'cooldown_cancel' | 'pin_copied' | 'spot_add' | 'spot_update' | 'spot_delete' | 'spot_move';
  details?: string;
  timestamp: number;
}

export const GANG_SECRET_SEED = 'RV_Z98X_7K2Q_GANG_VAULT_SEED_2026';
const MASTER_PIN_KEY = 'runthukverb_master_pin';
const SESSION_STORAGE_KEY = 'runthukverb_gang_session_v5';
const ACTIVITY_LOGS_KEY = 'runthukverb_activity_logs_v5';

export interface BranchInfo {
  id: string; // 'branch_1', 'branch_2', 'branch_3', 'branch_4', 'branch_5'
  num: number; // 1, 2, 3, 4, 5
  name: string; // 'สาขา 1', 'สาขา 2', 'สาขา 3', 'สาขา 4', 'สาขา 5'
}

export const AVAILABLE_BRANCHES: BranchInfo[] = [
  { id: 'branch_1', num: 1, name: 'สาขา 1' },
  { id: 'branch_2', num: 2, name: 'สาขา 2' },
  { id: 'branch_3', num: 3, name: 'สาขา 3' },
  { id: 'branch_4', num: 4, name: 'สาขา 4' },
  { id: 'branch_5', num: 5, name: 'สาขา 5' },
];

// แปลง Input เป็นข้อมูลสาขา 1-5 (รองรับ "1", "gang-1", "gang1", "branch-1", "branch1", "สาขา 1")
export function parseBranch(input?: string | null): BranchInfo {
  if (!input) return AVAILABLE_BRANCHES[0];
  const str = String(input).trim().toLowerCase();

  for (let i = 0; i < AVAILABLE_BRANCHES.length; i++) {
    const b = AVAILABLE_BRANCHES[i];
    if (
      str === String(b.num) ||
      str === b.id ||
      str === `branch${b.num}` ||
      str === `branch-${b.num}` ||
      str === `branch_${b.num}` ||
      str === `gang${b.num}` ||
      str === `gang-${b.num}` ||
      str === `gang_${b.num}` ||
      str === `gang ${b.num}` ||
      str === b.name.toLowerCase() ||
      str === `สาขา${b.num}` ||
      str === `สาขา-${b.num}` ||
      str === `สาขา ${b.num}` ||
      str.includes(`gang-${b.num}`) ||
      str.includes(`branch-${b.num}`) ||
      str.includes(`gang${b.num}`) ||
      str.includes(`branch${b.num}`) ||
      str.includes(b.name.toLowerCase()) ||
      str.includes(`สาขา${b.num}`)
    ) {
      return b;
    }
  }

  // Fallback defaults to Branch 1
  return AVAILABLE_BRANCHES[0];
}

// Helper to sanitize gang/branch ID
export function normalizeGangId(name: string): string {
  return parseBranch(name).id;
}

// เวลาอ้างอิงสำหรับการรีเซ็ตรหัสผ่านและเตะสมาชิกออกจากระบบทั้งหมด
export const FORCE_RESET_TIMESTAMP = 1791702500000;

// ป้องกันการส่องรหัส 222547 จากหน้าเว็บด้วยการเก็บเป็น Salted Hash แทน Plaintext
const DEFAULT_MASTER_PIN_HASH = '1f9a5d0f804fc1';

function hashPinWithSalt(pin: string): string {
  const salt = 'RV_MASTER_KEY_PROTECTOR_9843';
  const str = pin + ':' + salt;
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ล้างเซสชั่นเก่าและรหัสผ่านเดิม 999999 ทันทีที่เข้าสู่ระบบใหม่
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('runthukverb_gang_session');
    localStorage.removeItem('runthukverb_gang_session_v2');
    localStorage.removeItem('runthukverb_gang_session_v3');
    localStorage.removeItem('runthukverb_activity_logs');
    if (localStorage.getItem(MASTER_PIN_KEY) === '999999') {
      localStorage.removeItem(MASTER_PIN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// Default Master PIN ว่างไว้ ไม่ให้มีเลข 222547 ติดในโค้ดฝั่ง Client
export const DEFAULT_MASTER_PIN = '';

// ฟังก์ชันแปลง Date เป็นสตริง YYYY-MM-DD ในเขตเวลาท้องถิ่น (Local Time)
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// DJB2 Hash Algorithm สำหรับสร้างรหัส 6 หลักที่แน่นอนในแต่ละวันแยกตามสาขา 1-5
export function hashDateToPIN(dateStr: string, branchInput: string = 'branch_1'): string {
  const branch = parseBranch(branchInput);
  const input = `${dateStr}_${branch.id}_${GANG_SECRET_SEED}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const pinNum = (Math.abs(hash) % 900000) + 100000;
  return String(pinNum);
}

// คืนค่ารหัสประจำวันของวันที่ระบุสำหรับสาขาที่เลือก
export function getDailyPIN(date: Date = new Date(), branchInput: string = 'branch_1'): string {
  return hashDateToPIN(getLocalDateString(date), branchInput);
}

// ตรวจสอบ Master PIN โดยไม่ให้มีตัวเลข Plaintext ปรากฏในบันเดิลโค้ด
export function isMasterPIN(inputPin: string, branchInput: string = 'branch_1'): boolean {
  const branch = parseBranch(branchInput);
  const gangCustomKey = `${MASTER_PIN_KEY}_${branch.id}`;
  const custom = typeof localStorage !== 'undefined'
    ? (localStorage.getItem(gangCustomKey) || localStorage.getItem(MASTER_PIN_KEY))
    : null;
  if (custom && custom !== '999999' && custom.length >= 6) {
    return inputPin === custom;
  }
  return hashPinWithSalt(inputPin) === DEFAULT_MASTER_PIN_HASH;
}

// คืนค่า Master PIN ของหัวหน้าสาขา (ถ้ามีบันทึกแบบ Custom ไว้)
export function getMasterPIN(branchInput: string = 'branch_1'): string {
  const branch = parseBranch(branchInput);
  const gangCustomKey = `${MASTER_PIN_KEY}_${branch.id}`;
  const custom = typeof localStorage !== 'undefined'
    ? (localStorage.getItem(gangCustomKey) || localStorage.getItem(MASTER_PIN_KEY))
    : null;
  if (custom && custom !== '999999' && custom.length >= 6) {
    return custom;
  }
  return '';
}

// บันทึก Master PIN ใหม่ (สำหรับหัวหน้าสาขานั้นๆ)
export function setMasterPIN(newPin: string, branchInput: string = 'branch_1'): boolean {
  if (!newPin || newPin.length < 6) return false;
  if (typeof localStorage !== 'undefined') {
    const branch = parseBranch(branchInput);
    localStorage.setItem(`${MASTER_PIN_KEY}_${branch.id}`, newPin);
    localStorage.setItem(MASTER_PIN_KEY, newPin);
  }
  return true;
}

// ดึงตารางรหัสผ่านล่วงหน้า X วัน สำหรับสาขาที่ระบุ
export function getUpcomingPINs(days: number = 7, branchInput: string = 'branch_1'): Array<{
  dateStr: string;
  dayName: string;
  pin: string;
  isToday: boolean;
}> {
  const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const result = [];
  const todayStr = getLocalDateString();
  const branch = parseBranch(branchInput);

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    const dayName = daysOfWeek[d.getDay()];
    const pin = hashDateToPIN(dateStr, branch.id);

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
export function formatPINsForDiscord(branchInput: string = 'branch_1'): string {
  const branch = parseBranch(branchInput);
  const pins = getUpcomingPINs(7, branch.id);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://runthukverb-cooldown.surge.sh';
  let text = `👑 **[${branch.name} - แผนที่ COOLDOWN] - ตารางรหัสผ่านประจำวัน** 🔒\n`;
  text += `> ⚠️ ห้ามส่งต่อให้คนนอกสาขาเด็ดขาด รหัสจะเปลี่ยนอัตโนมัติทุก 00:00 น.\n\n`;

  pins.forEach((item) => {
    if (item.isToday) {
      text += `🔥 **วันนี้ ${item.dayName}:** \`${item.pin}\`  *(ใช้งานอยู่)*\n`;
    } else {
      text += `📅 ${item.dayName}: \`${item.pin}\`\n`;
    }
  });

  text += `\n🌐 ลิงก์แผนที่เฉพาะสาขา: ${origin}/?branch=${branch.num}`;
  return text;
}

// ตรวจสอบความถูกต้องของ PIN ประจำสาขา
export function verifyPIN(
  inputPin: string,
  memberName: string,
  branchInput: string = 'สาขา 1'
): { success: boolean; isMaster: boolean; error?: string; session?: GangSession } {
  const cleanPin = inputPin.trim();
  const cleanName = memberName.trim();
  const branch = parseBranch(branchInput);

  if (!cleanName) {
    return { success: false, isMaster: false, error: 'กรุณากรอกชื่อเล่น' };
  }

  const todayPIN = getDailyPIN(new Date(), branch.id);

  if (isMasterPIN(cleanPin, branch.id)) {
    const session: GangSession = {
      gangId: branch.id,
      gangName: branch.name,
      memberName: cleanName,
      authDate: getLocalDateString(),
      authenticatedAt: Date.now(),
      isMaster: true,
    };
    saveGangSession(session);
    logActivity(cleanName, 'login', `เข้าสู่ระบบด้วย Master PIN (${branch.name})`, branch.id);
    return { success: true, isMaster: true, session };
  }

  if (cleanPin === todayPIN) {
    const session: GangSession = {
      gangId: branch.id,
      gangName: branch.name,
      memberName: cleanName,
      authDate: getLocalDateString(),
      authenticatedAt: Date.now(),
      isMaster: false,
    };
    saveGangSession(session);
    logActivity(cleanName, 'login', `เข้าสู่ระบบด้วยรหัสผ่านประจำวัน (${branch.name})`, branch.id);
    return { success: true, isMaster: false, session };
  }

  return { success: false, isMaster: false, error: `รหัสผ่านประจำวันของ ${branch.name} ไม่ถูกต้อง กรุณาเช็คใน Discord` };
}

// ตรวจจับข้อมูลสาขาจากพารามิเตอร์ URL (?branch=X หรือ ?gang=X)
export function getTargetBranchFromUrl(): BranchInfo | null {
  if (typeof window === 'undefined' || !window.location || !window.location.search) {
    return null;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch') || params.get('gang');
    if (branchParam && branchParam.trim()) {
      return parseBranch(branchParam.trim());
    }
  } catch {
    // Ignore URL parse errors
  }
  return null;
}

// บันทึก Session
export function saveGangSession(session: GangSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    if (session.gangId) {
      localStorage.setItem(`${SESSION_STORAGE_KEY}_${session.gangId}`, JSON.stringify(session));
    }
    if (session.isMaster) {
      localStorage.setItem(`${SESSION_STORAGE_KEY}_master`, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

// ดึง Session ปัจจุบัน (รองรับการตรวจจับสาขาตาม URL ?branch=X หรือ ?gang=X)
export function getGangSession(targetBranchInput?: string | null): GangSession | null {
  try {
    const targetBranch = targetBranchInput ? parseBranch(targetBranchInput) : getTargetBranchFromUrl();
    const todayStr = getLocalDateString();

    // 1. ตรวจสอบ Master Session ข้ามสาขา (หากเป็น Boss เคยเข้าสู่ระบบด้วย 222547 สามารถสลับสาขาตาม URL ได้ทันที)
    const masterData = localStorage.getItem(`${SESSION_STORAGE_KEY}_master`);
    if (masterData) {
      try {
        const masterSession: GangSession = JSON.parse(masterData);
        if (
          masterSession.isMaster &&
          masterSession.authDate === todayStr &&
          masterSession.authenticatedAt >= FORCE_RESET_TIMESTAMP
        ) {
          if (targetBranch) {
            masterSession.gangId = targetBranch.id;
            masterSession.gangName = targetBranch.name;
          } else {
            const b = parseBranch(masterSession.gangId || masterSession.gangName);
            masterSession.gangId = b.id;
            masterSession.gangName = b.name;
          }
          saveGangSession(masterSession);
          return masterSession;
        }
      } catch {}
    }

    // 2. หาก URL มีการระบุสาขาชัดเจน (เช่น ?branch=1 หรือ ?gang=gang-1)
    if (targetBranch) {
      // ตรวจสอบเซสชั่นเฉพาะของสาขานั้น
      const branchSpecificData = localStorage.getItem(`${SESSION_STORAGE_KEY}_${targetBranch.id}`);
      if (branchSpecificData) {
        try {
          const bSession: GangSession = JSON.parse(branchSpecificData);
          if (bSession.authDate === todayStr && bSession.authenticatedAt >= FORCE_RESET_TIMESTAMP) {
            bSession.gangId = targetBranch.id;
            bSession.gangName = targetBranch.name;
            return bSession;
          }
        } catch {}
      }

      // ตรวจสอบเซสชั่นหลักใน SESSION_STORAGE_KEY ว่าเป็นของสาขานี้หรือไม่
      const mainData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (mainData) {
        try {
          const mainSession: GangSession = JSON.parse(mainData);
          if (mainSession.authDate === todayStr && mainSession.authenticatedAt >= FORCE_RESET_TIMESTAMP) {
            if (mainSession.isMaster) {
              mainSession.gangId = targetBranch.id;
              mainSession.gangName = targetBranch.name;
              saveGangSession(mainSession);
              return mainSession;
            }
            const mainBranch = parseBranch(mainSession.gangId || mainSession.gangName);
            if (mainBranch.id === targetBranch.id) {
              mainSession.gangId = targetBranch.id;
              mainSession.gangName = targetBranch.name;
              return mainSession;
            }
          }
        } catch {}
      }

      // ถ้าเปิดลิงก์สาขาที่ไม่ตรงกับเซสชั่นปัจจุบัน และไม่ใช่ Boss -> คืนค่า null เพื่อให้แสดงหน้ากรอกรหัสของสาขานั้น
      return null;
    }

    // 3. กรณี URL ไม่ได้ระบุสาขา (เปิดเว็บตรงๆ) ให้ใช้เซสชั่นล่าสุดที่เปิดค้างไว้
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!data) return null;
    const session: GangSession = JSON.parse(data);

    if (session.authDate !== todayStr) {
      logoutGang();
      return null;
    }

    if (!session.authenticatedAt || session.authenticatedAt < FORCE_RESET_TIMESTAMP) {
      logoutGang();
      return null;
    }

    const branch = parseBranch(session.gangId || session.gangName);
    session.gangId = branch.id;
    session.gangName = branch.name;
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
export function logoutGang(targetBranchId?: string): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(`${SESSION_STORAGE_KEY}_master`);
    localStorage.removeItem('runthukverb_gang_session');
    localStorage.removeItem('runthukverb_gang_session_v3');
    if (targetBranchId) {
      localStorage.removeItem(`${SESSION_STORAGE_KEY}_${targetBranchId}`);
    } else {
      AVAILABLE_BRANCHES.forEach((b) => {
        localStorage.removeItem(`${SESSION_STORAGE_KEY}_${b.id}`);
      });
    }
  } catch {
    // Ignore
  }
}

function getLogKey(gangId?: string): string {
  return gangId ? `${ACTIVITY_LOGS_KEY}_${normalizeGangId(gangId)}` : ACTIVITY_LOGS_KEY;
}

// บันทึก Activity Log ลง LocalStorage พร้อมระบบป้องกันการสแปมบันทึกซ้ำซ้อน
export function logActivity(
  memberName: string,
  action: ActivityLog['action'],
  details?: string,
  gangId?: string
): void {
  try {
    const key = getLogKey(gangId);
    const raw = localStorage.getItem(key);
    const logs: ActivityLog[] = raw ? JSON.parse(raw) : [];

    const now = Date.now();
    const cleanName = memberName.trim();
    const normName = cleanName.toLowerCase();

    // 1. ป้องกันสแปม Login ซ้ำๆ: ถ้าสมาชิกคนเดิมเคยมีบันทึก 'login' ภายใน 15 นาทีที่ผ่านมา ให้ข้าม
    if (action === 'login') {
      const recentLogin = logs.find(
        (l) =>
          l.action === 'login' &&
          (l.memberName || '').toLowerCase().trim() === normName &&
          now - l.timestamp < 15 * 60 * 1000
      );
      if (recentLogin) {
        return; // ไม่บันทึกซ้ำ
      }
    } else {
      // 2. ป้องกันแอ็กชันอื่นๆ ซ้ำติดๆ กัน (ภายใน 20 วินาที)
      const recentSameAction = logs.find(
        (l) =>
          l.action === action &&
          (l.memberName || '').toLowerCase().trim() === normName &&
          l.details === details &&
          now - l.timestamp < 20 * 1000
      );
      if (recentSameAction) {
        return;
      }
    }

    const newLog: ActivityLog = {
      id: `log_${now}_${Math.random().toString(36).slice(2, 6)}`,
      memberName: cleanName,
      action,
      details,
      timestamp: now,
    };

    // เก็บประวัติย้อนหลังสูงสุด 50 รายการ
    const updated = [newLog, ...logs].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

// ล้างประวัติ Activity Logs ทั้งหมดของแก๊ง
export function clearActivityLogs(gangId?: string): void {
  try {
    const key = getLogKey(gangId);
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// ดึง Activity Logs พร้อมทำความสะอาดบันทึกซ้ำซ้อนในอดีต (Auto-Sanitize)
export function getActivityLogs(gangId?: string): ActivityLog[] {
  try {
    const key = getLogKey(gangId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const logs: ActivityLog[] = JSON.parse(raw);
    if (!Array.isArray(logs)) return [];

    // ล้างบันทึก 'login' ที่ซ้ำซ้อนของสมาชิกคนเดิมที่อยู่ใกล้กันเกิน 15 นาทีออก
    let cleaned = false;
    const sanitized: ActivityLog[] = [];
    const lastLoginByMember: Record<string, number> = {};

    for (const log of logs) {
      if (log.action === 'login') {
        const normName = (log.memberName || '').toLowerCase().trim();
        const prevTime = lastLoginByMember[normName];
        if (prevTime !== undefined && Math.abs(prevTime - log.timestamp) < 15 * 60 * 1000) {
          cleaned = true;
          continue; // ข้าม log ที่ซ้ำกัน
        }
        lastLoginByMember[normName] = log.timestamp;
      }
      sanitized.push(log);
    }

    if (cleaned && sanitized.length !== logs.length) {
      try {
        localStorage.setItem(key, JSON.stringify(sanitized.slice(0, 50)));
      } catch {}
    }

    return sanitized.slice(0, 50);
  } catch {
    return [];
  }
}

