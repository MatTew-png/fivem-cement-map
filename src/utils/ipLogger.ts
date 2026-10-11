// ระบบตรวจจับ บันทึก IP และป้องกันการเข้าถึงที่ไม่ได้รับอนุญาต (IP Access Logging & Security Vault)

export interface IpLogEntry {
  id: string;
  ip: string;
  city?: string;
  country?: string;
  isp?: string;
  device: string;
  timestamp: number;
  action: 'visit' | 'login_success' | 'login_fail' | 'banned_blocked';
  memberName?: string;
  attemptedPin?: string;
  isMaster?: boolean;
}

export interface IpInfo {
  ip: string;
  city?: string;
  country?: string;
  isp?: string;
}

const IP_LOGS_KEY = 'runthukverb_ip_logs_v1';
const BANNED_IPS_KEY = 'runthukverb_banned_ips_v1';
const DISCORD_WEBHOOK_KEY = 'runthukverb_discord_webhook_url';

let cachedIpInfo: IpInfo | null = null;
let fetchingPromise: Promise<IpInfo> | null = null;

// ตรวจจับ IP จริงของผู้ใช้ผ่าน Multi-endpoint Edge Fallback
export async function detectClientIp(): Promise<IpInfo> {
  if (cachedIpInfo && cachedIpInfo.ip !== 'Unknown') return cachedIpInfo;
  if (fetchingPromise) return fetchingPromise;

  fetchingPromise = (async () => {
    // 1. ipwho.is (ให้ข้อมูล IP, จังหวัด, ประเทศ, ISP ละเอียดและเร็ว)
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.ip) {
          cachedIpInfo = {
            ip: data.ip,
            city: data.city || '',
            country: data.country || 'TH',
            isp: data.connection?.isp || data.connection?.org || '',
          };
          return cachedIpInfo;
        }
      }
    } catch {}

    // 2. api.ipify.org
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          cachedIpInfo = { ip: data.ip, country: 'TH' };
          return cachedIpInfo;
        }
      }
    } catch {}

    // 3. Cloudflare Edge Trace
    try {
      const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const text = await res.text();
        const ipMatch = text.match(/ip=([^\n]+)/);
        if (ipMatch && ipMatch[1]) {
          cachedIpInfo = { ip: ipMatch[1].trim(), country: 'TH' };
          return cachedIpInfo;
        }
      }
    } catch {}

    cachedIpInfo = { ip: 'Unknown' };
    return cachedIpInfo;
  })();

  return fetchingPromise;
}

// ตรวจจับประเภทอุปกรณ์
export function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Mobile';
  if (/Android/i.test(ua)) return 'Android Mobile';
  if (/Macintosh/i.test(ua)) return 'macOS';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desktop';
}

// ดึงรายการ IP ที่ถูกแบน
export function getBannedIps(): string[] {
  try {
    const raw = localStorage.getItem(BANNED_IPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// เช็คว่า IP นี้ถูกแบนหรือไม่
export function isIpBanned(ip: string): boolean {
  if (!ip || ip === 'Unknown') return false;
  const list = getBannedIps();
  return list.includes(ip.trim());
}

// แบน IP
export function banIp(ip: string): void {
  if (!ip || ip === 'Unknown') return;
  const clean = ip.trim();
  const list = getBannedIps();
  if (!list.includes(clean)) {
    list.unshift(clean);
    localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(list));
  }
}

// ปลดแบน IP
export function unbanIp(ip: string): void {
  const clean = ip.trim();
  const list = getBannedIps().filter((item) => item !== clean);
  localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(list));
}

// ดึงประวัติ Logs
export function getIpLogs(): IpLogEntry[] {
  try {
    const raw = localStorage.getItem(IP_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ล้างประวัติ Logs
export function clearIpLogs(): void {
  localStorage.removeItem(IP_LOGS_KEY);
}

// บันทึก Log การเข้าชมหรือความพยายามล็อกอิน
export async function logIpAccess(
  entry: Omit<IpLogEntry, 'id' | 'timestamp' | 'ip' | 'device'> & { ip?: string }
): Promise<IpLogEntry> {
  const info = await detectClientIp();
  const ip = entry.ip || info.ip;

  const fullEntry: IpLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ip,
    city: info.city,
    country: info.country,
    isp: info.isp,
    device: detectDevice(),
    timestamp: Date.now(),
    action: entry.action,
    memberName: entry.memberName,
    attemptedPin: entry.attemptedPin,
    isMaster: entry.isMaster,
  };

  try {
    const existing = getIpLogs();
    // เก็บประวัติสูงสุด 300 รายการล่าสุด
    const updated = [fullEntry, ...existing.slice(0, 299)];
    localStorage.setItem(IP_LOGS_KEY, JSON.stringify(updated));
  } catch {}

  // ส่งแจ้งเตือน Discord Webhook ทันที (ถ้าหัวหน้าแก๊งตั้งค่าไว้)
  sendDiscordWebhookAlert(fullEntry);

  return fullEntry;
}

// ดึง Discord Webhook URL
export function getDiscordWebhookUrl(): string {
  try {
    return localStorage.getItem(DISCORD_WEBHOOK_KEY) || '';
  } catch {
    return '';
  }
}

// บันทึก Discord Webhook URL
export function setDiscordWebhookUrl(url: string): void {
  try {
    localStorage.setItem(DISCORD_WEBHOOK_KEY, url.trim());
  } catch {}
}

// ส่งข้อความแจ้งเตือนลง Discord ทันทีที่มีคนเข้าเว็บหรือรหัสผิด
export async function sendDiscordWebhookAlert(entry: IpLogEntry) {
  const webhookUrl = getDiscordWebhookUrl();
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

  try {
    const isFail = entry.action === 'login_fail';
    const isBanned = entry.action === 'banned_blocked';
    const isSuccess = entry.action === 'login_success';

    let color = 0x3b82f6; // ฟ้า (เปิดดูเว็บ)
    let title = '🌐 มีการเปิดเข้าชมหน้าเว็บ';
    if (isSuccess) {
      color = 0x10b981; // เขียว (ผ่าน)
      title = `✅ เข้าสู่ระบบสำเร็จ: ${entry.memberName || 'ไม่ระบุ'}${entry.isMaster ? ' (👑 หัวหน้า)' : ''}`;
    } else if (isFail) {
      color = 0xef4444; // แดง (รหัสผิด)
      title = `🚨 รหัสผ่านผิด! (ต้องสงสัย): ${entry.memberName || 'ไม่ระบุ'}`;
    } else if (isBanned) {
      color = 0x7f1d1d; // แดงเข้ม (แบน)
      title = `⛔ บล็อกการเข้าถึงจาก IP ที่ถูกแบน: ${entry.ip}`;
    }

    const d = new Date(entry.timestamp);
    const timeStr = `${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH')} น.`;

    const fields = [
      { name: '🌐 IP Address', value: `\`${entry.ip}\``, inline: true },
      { name: '📍 พิกัด / ผู้ให้บริการ', value: `${entry.city || '-'} (${entry.isp || '-'})`, inline: true },
      { name: '📱 อุปกรณ์', value: entry.device || '-', inline: true },
      { name: '👤 ชื่อที่กรอก', value: entry.memberName || '-', inline: true },
      { name: '⏰ เวลา', value: timeStr, inline: true },
    ];

    if (entry.attemptedPin) {
      fields.push({ name: '🔑 รหัสที่กรอก', value: `\`${entry.attemptedPin}\``, inline: true });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            color,
            fields,
            footer: { text: 'ระบบตรวจจับความปลอดภัย - รันทุกเวิบ COOLDOWN' },
            timestamp: new Date(entry.timestamp).toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Ignore webhook network errors
  }
}
