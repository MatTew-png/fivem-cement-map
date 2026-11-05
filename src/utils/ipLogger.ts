import mqtt, { type MqttClient } from 'mqtt';
import { GANG_SECRET_SEED } from './gangAuth';

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

const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const SECURITY_TOPIC = 'fivem/runthukverb_global_security_v3';
const SECURITY_RETAINED_LOGS_TOPIC = 'fivem/runthukverb_global_security_retained_v3';
const SECURITY_RETAINED_BANS_TOPIC = 'fivem/runthukverb_global_bans_retained_v3';
const SECURITY_BC_NAME = 'runthukverb_security_bc_v1';

// E2EE Symmetric Encryption สำหรับปกป้องข้อมูล Telemetry / IP Logs บน Public MQTT Broker
function encryptSecurityPayload(data: object): string {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(`${GANG_SECRET_SEED}_SEC_VAULT_2026`);
    const cipherBytes = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      cipherBytes[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    let binary = '';
    for (let i = 0; i < cipherBytes.byteLength; i++) {
      binary += String.fromCharCode(cipherBytes[i]);
    }
    return 'SEC_ENC:' + btoa(binary);
  } catch {
    return JSON.stringify(data);
  }
}

function decryptSecurityPayload(raw: string): any {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('SEC_ENC:')) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    const base64Data = raw.slice(8);
    const binary = atob(base64Data);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }
    const keyBytes = new TextEncoder().encode(`${GANG_SECRET_SEED}_SEC_VAULT_2026`);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const jsonStr = new TextDecoder().decode(plainBytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

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
  securityMqtt.broadcastBan(clean);
}

// ปลดแบน IP
export function unbanIp(ip: string): void {
  const clean = ip.trim();
  const list = getBannedIps().filter((item) => item !== clean);
  localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(list));
  securityMqtt.broadcastUnban(clean);
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
  securityMqtt.notify();
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

  // ส่งข้อมูลแบบเรียลไทม์ข้ามเครื่องผ่าน MQTT ให้ทุกคนที่เปิดหน้าจอเห็นทันที
  securityMqtt.broadcastLog(fullEntry);

  // ส่งแจ้งเตือน Discord Webhook ทันที (ถ้าหัวหน้าแก๊งตั้งค่าไว้)
  sendDiscordWebhookAlert(fullEntry);

  return fullEntry;
}

export type SecurityLogListener = (logs: IpLogEntry[], bannedIps: string[]) => void;

class SecurityMqttManager {
  private client: MqttClient | null = null;
  private bc: BroadcastChannel | null = null;
  private listeners: Set<SecurityLogListener> = new Set();
  private outgoingQueue: Array<{ topic: string; payload: string; options: any }> = [];
  private isConnecting: boolean = false;
  private hasRequestedSync: boolean = false;
  private clientId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  public init() {
    if (typeof window === 'undefined') return;
    if (this.client || this.isConnecting) return;

    if ('BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(SECURITY_BC_NAME);
        this.bc.onmessage = (e) => this.handleMessage(e.data);
      } catch {}
    }

    this.isConnecting = true;
    try {
      this.client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: this.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        keepalive: 30,
      });

      this.client.on('connect', () => {
        this.isConnecting = false;
        if (!this.client) return;

        this.client.subscribe(
          [SECURITY_TOPIC, SECURITY_RETAINED_LOGS_TOPIC, SECURITY_RETAINED_BANS_TOPIC],
          { qos: 1 }
        );

        this.flushQueue();

        if (!this.hasRequestedSync) {
          this.hasRequestedSync = true;
          this.publish({ type: 'sec_sync_request', clientId: this.clientId });
        }
      });

      this.client.on('message', (_topic, message) => {
        try {
          const raw = message.toString();
          const data = decryptSecurityPayload(raw);
          if (data) {
            this.handleMessage(data);
          }
        } catch {}
      });

      this.client.on('error', () => {
        this.isConnecting = false;
      });
      this.client.on('close', () => {
        this.isConnecting = false;
      });
    } catch {
      this.isConnecting = false;
    }
  }

  private flushQueue() {
    if (!this.client || !this.client.connected) return;
    while (this.outgoingQueue.length > 0) {
      const item = this.outgoingQueue.shift();
      if (item) {
        try {
          this.client.publish(item.topic, item.payload, item.options || { qos: 1 });
        } catch {}
      }
    }
  }

  public publish(data: object, targetTopic: string = SECURITY_TOPIC, options: any = { qos: 1 }) {
    if (this.bc && targetTopic === SECURITY_TOPIC) {
      try {
        this.bc.postMessage(data);
      } catch {}
    }

    const encrypted = encryptSecurityPayload(data);
    if (this.client && this.client.connected) {
      try {
        this.client.publish(targetTopic, encrypted, options);
      } catch {
        this.outgoingQueue.push({ topic: targetTopic, payload: encrypted, options });
      }
    } else {
      this.outgoingQueue.push({ topic: targetTopic, payload: encrypted, options });
      if (!this.client && !this.isConnecting) {
        this.init();
      }
    }
  }

  private handleMessage(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'ip_log' && data.entry) {
      const incoming: IpLogEntry = data.entry;
      const current = getIpLogs();
      if (!current.some((l) => l.id === incoming.id || (l.ip === incoming.ip && Math.abs(l.timestamp - incoming.timestamp) < 2000))) {
        const updated = [incoming, ...current.slice(0, 299)];
        try {
          localStorage.setItem(IP_LOGS_KEY, JSON.stringify(updated));
        } catch {}
        sendDiscordWebhookAlert(incoming);
        this.notify();
      }
    } else if (data.type === 'ip_ban' && data.ip) {
      const list = getBannedIps();
      if (!list.includes(data.ip.trim())) {
        list.unshift(data.ip.trim());
        try {
          localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(list));
        } catch {}
        this.notify();
        detectClientIp().then((myInfo) => {
          if (myInfo.ip === data.ip.trim() && typeof window !== 'undefined') {
            window.location.reload();
          }
        });
      }
    } else if (data.type === 'ip_unban' && data.ip) {
      const list = getBannedIps().filter((item) => item !== data.ip.trim());
      try {
        localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(list));
      } catch {}
      this.notify();
    } else if (data.type === 'sec_logs_manifest' && Array.isArray(data.logs)) {
      const existing = getIpLogs();
      const existingIds = new Set(existing.map((l) => l.id));
      let added = false;
      data.logs.forEach((incoming: IpLogEntry) => {
        if (!existingIds.has(incoming.id)) {
          existing.push(incoming);
          existingIds.add(incoming.id);
          added = true;
        }
      });
      if (added) {
        existing.sort((a, b) => b.timestamp - a.timestamp);
        try {
          localStorage.setItem(IP_LOGS_KEY, JSON.stringify(existing.slice(0, 300)));
        } catch {}
        this.notify();
      }
    } else if (data.type === 'sec_bans_manifest' && Array.isArray(data.bannedIps)) {
      const existingBans = new Set(getBannedIps());
      let added = false;
      data.bannedIps.forEach((bIp: string) => {
        if (!existingBans.has(bIp)) {
          existingBans.add(bIp);
          added = true;
        }
      });
      if (added) {
        try {
          localStorage.setItem(BANNED_IPS_KEY, JSON.stringify(Array.from(existingBans)));
        } catch {}
        this.notify();
      }
    } else if (data.type === 'sec_sync_request') {
      if (data.clientId === this.clientId) return;
      const logs = getIpLogs();
      const bannedIps = getBannedIps();
      if (logs.length > 0) {
        this.publish({ type: 'sec_logs_manifest', logs: logs.slice(0, 50) });
      }
      if (bannedIps.length > 0) {
        this.publish({ type: 'sec_bans_manifest', bannedIps });
      }
    } else if (data.type === 'sec_webhook_sync' && data.webhookUrl) {
      const current = getDiscordWebhookUrl();
      if (!current && data.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        try {
          localStorage.setItem(DISCORD_WEBHOOK_KEY, data.webhookUrl.trim());
        } catch {}
      }
    }
  }

  public broadcastLog(entry: IpLogEntry) {
    this.publish({ type: 'ip_log', entry, clientId: this.clientId, timestamp: Date.now() });
    const current = getIpLogs();
    const manifest = [entry, ...current.filter((l) => l.id !== entry.id)].slice(0, 50);
    this.publish(
      { type: 'sec_logs_manifest', logs: manifest, timestamp: Date.now() },
      SECURITY_RETAINED_LOGS_TOPIC,
      { qos: 1, retain: true }
    );
  }

  public broadcastBan(ip: string) {
    this.publish({ type: 'ip_ban', ip, clientId: this.clientId, timestamp: Date.now() });
    this.publish(
      { type: 'sec_bans_manifest', bannedIps: getBannedIps(), timestamp: Date.now() },
      SECURITY_RETAINED_BANS_TOPIC,
      { qos: 1, retain: true }
    );
  }

  public broadcastUnban(ip: string) {
    this.publish({ type: 'ip_unban', ip, clientId: this.clientId, timestamp: Date.now() });
    this.publish(
      { type: 'sec_bans_manifest', bannedIps: getBannedIps(), timestamp: Date.now() },
      SECURITY_RETAINED_BANS_TOPIC,
      { qos: 1, retain: true }
    );
  }

  public broadcastWebhook(webhookUrl: string) {
    this.publish({ type: 'sec_webhook_sync', webhookUrl, timestamp: Date.now() });
  }

  public subscribe(cb: SecurityLogListener): () => void {
    this.listeners.add(cb);
    this.init();
    cb(getIpLogs(), getBannedIps());
    return () => this.listeners.delete(cb);
  }

  public notify() {
    const logs = getIpLogs();
    const bans = getBannedIps();
    this.listeners.forEach((cb) => cb(logs, bans));
  }
}

export const securityMqtt = new SecurityMqttManager();

export function subscribeIpLogs(cb: SecurityLogListener): () => void {
  return securityMqtt.subscribe(cb);
}

export function initSecuritySync(): void {
  securityMqtt.init();
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
    const clean = url.trim();
    localStorage.setItem(DISCORD_WEBHOOK_KEY, clean);
    securityMqtt.broadcastWebhook(clean);
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
