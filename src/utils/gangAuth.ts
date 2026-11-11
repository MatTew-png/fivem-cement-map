// ระบบความปลอดภัยและ Session ผ่าน Cloudflare Worker API สำหรับแก๊ง FiveM (รันทุกเวิบ COOLDOWN)

export interface GangSession {
  gangId: string;
  gangName: string;
  memberName: string;
  authDate: string; // YYYY-MM-DD (Asia/Bangkok)
  authenticatedAt: number;
  isMaster: boolean;
  token?: string;
  channelKey?: string;
}

export interface ActivityLog {
  id: string;
  memberName: string;
  action:
    | 'login'
    | 'cooldown_start'
    | 'cooldown_cancel'
    | 'pin_copied'
    | 'spot_add'
    | 'spot_update'
    | 'spot_delete'
    | 'spot_move';
  details?: string;
  timestamp: number;
}

export interface UpcomingPinDay {
  dateStr: string;
  dayName: string;
  pins: Record<string, string>;
  isToday: boolean;
}

const SESSION_STORAGE_KEY = 'runthukverb_gang_session_v6';
const ACTIVITY_LOGS_KEY = 'runthukverb_activity_logs_v5';

export interface BranchInfo {
  id: string;
  num: number;
  name: string;
}

export const AVAILABLE_BRANCHES: BranchInfo[] = [
  { id: 'branch_1', num: 1, name: 'สาขา 1' },
  { id: 'branch_2', num: 2, name: 'สาขา 2' },
  { id: 'branch_3', num: 3, name: 'สาขา 3' },
  { id: 'branch_4', num: 4, name: 'สาขา 4' },
  { id: 'branch_5', num: 5, name: 'สาขา 5' },
];

export function parseBranch(input?: string | null): BranchInfo {
  if (!input) return AVAILABLE_BRANCHES[0];
  const str = String(input).trim().toLowerCase();

  for (let i = 0; i < AVAILABLE_BRANCHES.length; i += 1) {
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

  return AVAILABLE_BRANCHES[0];
}

export function normalizeGangId(name: string): string {
  return parseBranch(name).id;
}

// Clear insecure legacy client-auth keys once if running in browser
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('runthukverb_gang_session');
    localStorage.removeItem('runthukverb_gang_session_v2');
    localStorage.removeItem('runthukverb_gang_session_v3');
    localStorage.removeItem('runthukverb_gang_session_v5');
    localStorage.removeItem('runthukverb_master_pin');
    localStorage.removeItem('runthukverb_activity_logs');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns YYYY-MM-DD in Asia/Bangkok (UTC+7), matching the Worker backend.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const bangkokMs = date.getTime() + 7 * 60 * 60 * 1000;
  return new Date(bangkokMs).toISOString().slice(0, 10);
}

export interface VerifyPinResult {
  success: boolean;
  isMaster: boolean;
  session?: GangSession;
  error?: string;
  locked?: boolean;
  banned?: boolean;
  retryAfterSec?: number;
  remainingAttempts?: number;
}

export async function verifyPIN(
  inputPin: string,
  memberName: string,
  branchInput: string = 'สาขา 1'
): Promise<VerifyPinResult> {
  const cleanPin = inputPin.trim();
  const cleanName = memberName.trim();
  const branch = parseBranch(branchInput);

  if (!cleanName) {
    return { success: false, isMaster: false, error: 'กรุณากรอกชื่อเล่น' };
  }
  if (!cleanPin) {
    return { success: false, isMaster: false, error: 'กรุณากรอกรหัสผ่าน' };
  }

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: cleanPin,
        memberName: cleanName,
        branchId: branch.id,
      }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      error?: string;
      locked?: boolean;
      banned?: boolean;
      retryAfterSec?: number;
      remainingAttempts?: number;
      token?: string;
      channelKey?: string;
      session?: GangSession;
    };

    if (!res.ok || !data.success || !data.session || !data.token) {
      return {
        success: false,
        isMaster: false,
        locked: data.locked,
        banned: data.banned,
        retryAfterSec: data.retryAfterSec,
        remainingAttempts: data.remainingAttempts,
        error: data.error || `รหัสผ่านของ ${branch.name} ไม่ถูกต้อง`,
      };
    }

    const session: GangSession = {
      ...data.session,
      gangId: data.session.isMaster ? branch.id : normalizeGangId(data.session.gangId),
      gangName: data.session.isMaster ? `${branch.name} (Master Boss)` : branch.name,
      token: data.token,
      channelKey: data.channelKey,
    };

    saveGangSession(session);
    logActivity(
      cleanName,
      'login',
      session.isMaster
        ? `เข้าสู่ระบบด้วย Master PIN (${branch.name})`
        : `เข้าสู่ระบบด้วยรหัสผ่านประจำวัน (${branch.name})`,
      session.gangId
    );

    return {
      success: true,
      isMaster: session.isMaster,
      session,
    };
  } catch {
    return {
      success: false,
      isMaster: false,
      error: 'ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง',
    };
  }
}

export async function verifySessionWithServer(
  session: GangSession
): Promise<{
  valid: boolean;
  banned?: boolean;
  banReason?: string;
  session?: GangSession;
}> {
  if (!session.token) {
    return { valid: false };
  }

  try {
    const res = await fetch('/api/session', {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    });

    const data = (await res.json()) as {
      valid?: boolean;
      banned?: boolean;
      banReason?: string;
      channelKey?: string;
      session?: GangSession;
    };

    if (res.status === 403 && data.banned) {
      return { valid: false, banned: true, banReason: data.banReason };
    }

    if (!res.ok || !data.valid) {
      return { valid: false };
    }

    const updated: GangSession = {
      ...session,
      ...(data.session ?? {}),
      gangId: session.gangId,
      gangName: session.gangName,
      token: session.token,
      channelKey: data.channelKey ?? session.channelKey,
    };
    saveGangSession(updated);
    return { valid: true, session: updated };
  } catch {
    // Keep active local session if offline momentarily; server check retries periodically
    return { valid: true, session };
  }
}

export async function fetchUpcomingPINs(session: GangSession): Promise<UpcomingPinDay[]> {
  if (!session.isMaster || !session.token) {
    throw new Error('เฉพาะ Master Boss เท่านั้นที่ดูตารางรหัสผ่านได้');
  }

  const res = await fetch('/api/pins/upcoming', {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'ไม่สามารถโหลดตารางรหัสผ่านจากเซิร์ฟเวอร์ได้');
  }

  const data = (await res.json()) as {
    schedule: Array<{ date: string; pins: Record<string, string> }>;
  };

  const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const todayStr = getLocalDateString();

  return (data.schedule || []).map((item) => {
    const [year, month, day] = item.date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    const dayName = daysOfWeek[utcDate.getUTCDay()] || '';
    return {
      dateStr: item.date,
      dayName: `${dayName} (${day}/${month})`,
      pins: item.pins || {},
      isToday: item.date === todayStr,
    };
  });
}

export function formatPINsForDiscord(
  branchInput: string,
  upcomingDays: UpcomingPinDay[]
): string {
  const branch = parseBranch(branchInput);
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://runthukverb-auth-api.workers.dev';

  let text = `👑 **[${branch.name} - แผนที่ COOLDOWN] - ตารางรหัสผ่านประจำวัน** 🔒\n`;
  text += `> ⚠️ ห้ามส่งต่อให้คนนอกสาขาเด็ดขาด รหัสจะเปลี่ยนอัตโนมัติทุก 00:00 น.\n\n`;

  upcomingDays.forEach((item) => {
    const pin = item.pins[branch.id] || '------';
    if (item.isToday) {
      text += `🔥 **วันนี้ ${item.dayName}:** \`${pin}\`  *(ใช้งานอยู่)*\n`;
    } else {
      text += `📅 ${item.dayName}: \`${pin}\`\n`;
    }
  });

  text += `\n🌐 ลิงก์แผนที่เฉพาะสาขา: ${origin}/?branch=${branch.num}`;
  return text;
}

export async function triggerServerForceLogout(session: GangSession): Promise<boolean> {
  if (!session.isMaster || !session.token) return false;
  try {
    const res = await fetch('/api/admin/force-logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

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

function isValidLocalSession(session: GangSession | null, todayStr: string): session is GangSession {
  if (!session || typeof session.token !== 'string' || !session.token.includes('.')) {
    return false;
  }
  if (!session.isMaster && session.authDate !== todayStr) {
    return false;
  }
  return true;
}

export function getGangSession(targetBranchInput?: string | null): GangSession | null {
  try {
    const targetBranch = targetBranchInput
      ? parseBranch(targetBranchInput)
      : getTargetBranchFromUrl();
    const todayStr = getLocalDateString();

    const masterData = localStorage.getItem(`${SESSION_STORAGE_KEY}_master`);
    if (masterData) {
      try {
        const masterSession = JSON.parse(masterData) as GangSession;
        if (masterSession.isMaster && isValidLocalSession(masterSession, todayStr)) {
          const branch = targetBranch || parseBranch(masterSession.gangId || masterSession.gangName);
          const nextMaster: GangSession = {
            ...masterSession,
            gangId: branch.id,
            gangName: `${branch.name} (Master Boss)`,
          };
          saveGangSession(nextMaster);
          return nextMaster;
        }
      } catch {
        // Ignore corrupt master cache
      }
    }

    if (targetBranch) {
      const branchSpecificData = localStorage.getItem(`${SESSION_STORAGE_KEY}_${targetBranch.id}`);
      if (branchSpecificData) {
        try {
          const bSession = JSON.parse(branchSpecificData) as GangSession;
          if (isValidLocalSession(bSession, todayStr)) {
            return {
              ...bSession,
              gangId: targetBranch.id,
              gangName: targetBranch.name,
            };
          }
        } catch {
          // Ignore corrupt branch cache
        }
      }

      const mainData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (mainData) {
        try {
          const mainSession = JSON.parse(mainData) as GangSession;
          if (isValidLocalSession(mainSession, todayStr)) {
            const mainBranch = parseBranch(mainSession.gangId || mainSession.gangName);
            if (mainBranch.id === targetBranch.id) {
              return {
                ...mainSession,
                gangId: targetBranch.id,
                gangName: targetBranch.name,
              };
            }
          }
        } catch {
          // Ignore corrupt main cache
        }
      }

      return null;
    }

    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!data) return null;
    const session = JSON.parse(data) as GangSession;
    if (!isValidLocalSession(session, todayStr)) {
      logoutGang();
      return null;
    }

    const branch = parseBranch(session.gangId || session.gangName);
    return {
      ...session,
      gangId: branch.id,
      gangName: session.isMaster ? `${branch.name} (Master Boss)` : branch.name,
    };
  } catch {
    return null;
  }
}

export function isSessionValidToday(): boolean {
  return getGangSession() !== null;
}

export function logoutGang(targetBranchId?: string): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(`${SESSION_STORAGE_KEY}_master`);
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

