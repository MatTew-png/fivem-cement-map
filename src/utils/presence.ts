// Realtime Presence & Gang Activity Hub
// รองรับทั้ง Cross-device WebSockets (ntfy.sh) และ Local Cross-tab (BroadcastChannel)

import type { GangSession, ActivityLog } from './gangAuth';
import { logActivity, getActivityLogs } from './gangAuth';

export interface OnlineMember {
  clientId: string;
  memberName: string;
  isMaster: boolean;
  joinedAt: number;
  lastSeen: number;
  device?: string;
}

export type PresenceListener = (members: OnlineMember[], logs: ActivityLog[]) => void;
export type CooldownSyncListener = (data: { spotId: string; spotName: string; durationMinutes: number; action: 'start' | 'cancel'; memberName: string }) => void;

const PRESENCE_TOPIC = 'runthukverb_gang_presence_hub_v1';
const WS_ENDPOINT = `wss://ntfy.sh/${PRESENCE_TOPIC}/ws`;
const POST_ENDPOINT = `https://ntfy.sh/${PRESENCE_TOPIC}`;
const BROADCAST_CHANNEL_NAME = 'runthukverb_presence_bc';

class GangPresenceManager {
  private clientId: string = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private session: GangSession | null = null;
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private membersMap: Map<string, OnlineMember> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private cdListeners: Set<CooldownSyncListener> = new Set();
  private isConnected: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.bc.onmessage = (e) => this.handleMessage(e.data);
    }
  }

  // เริ่มระบบ Presence สำหรับสมาชิกที่ล็อกอินแล้ว
  public start(session: GangSession) {
    this.session = session;
    this.addSelfMember();
    this.connectWebSocket();

    // ส่ง Heartbeat ทุกๆ 15 วินาที
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 15000);

    // ตรวจสอบและตัดรายชื่อคนที่ขาดการเชื่อมต่อเกิน 45 วินาที (Prune inactive)
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = window.setInterval(() => {
      this.pruneInactiveMembers();
    }, 5000);

    // ส่งสัญญาณก่อนปิดหน้าต่าง
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // ส่ง Ping แรกทันที
    this.sendHeartbeat();
  }

  // หยุดระบบเมื่อออกจากระบบ
  public stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.sendLeave();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    this.membersMap.clear();
    this.notifyListeners();
  }

  public subscribe(callback: PresenceListener): () => void {
    this.listeners.add(callback);
    callback(this.getOnlineMembers(), getActivityLogs());
    return () => this.listeners.delete(callback);
  }

  public subscribeCooldownSync(callback: CooldownSyncListener): () => void {
    this.cdListeners.add(callback);
    return () => this.cdListeners.delete(callback);
  }

  // สมาชิกกดจับเวลาปูน ให้กระจายแจ้งเตือนทั้งแก๊ง
  public broadcastCooldown(spotId: string, spotName: string, durationMinutes: number, action: 'start' | 'cancel') {
    if (!this.session) return;
    const payload = {
      type: 'cooldown_sync',
      spotId,
      spotName,
      durationMinutes,
      action,
      memberName: this.session.memberName,
      timestamp: Date.now(),
    };
    this.publish(payload);

    if (action === 'start') {
      logActivity(this.session.memberName, 'cooldown_start', `เริ่มจับเวลาจุด ${spotName} (${durationMinutes} นาที)`);
      this.notifyListeners();
    }
  }

  public getOnlineMembers(): OnlineMember[] {
    const now = Date.now();
    const list = Array.from(this.membersMap.values()).filter(
      (m) => now - m.lastSeen < 45000
    );

    // เรียง: หัวหน้าขึ้นก่อน แล้วตามด้วยเวลาที่ออนไลน์
    return list.sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return a.joinedAt - b.joinedAt;
    });
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private addSelfMember() {
    if (!this.session) return;
    const selfMember: OnlineMember = {
      clientId: this.clientId,
      memberName: this.session.memberName,
      isMaster: this.session.isMaster,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    };
    this.membersMap.set(this.clientId, selfMember);
    this.notifyListeners();
  }

  private connectWebSocket() {
    if (typeof window === 'undefined' || !this.session) return;

    try {
      this.ws = new WebSocket(WS_ENDPOINT);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event === 'message' && raw.message) {
            const data = JSON.parse(raw.message);
            this.handleMessage(data);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        // พยายามต่อใหม่ใน 8 วินาที
        this.reconnectTimer = window.setTimeout(() => {
          if (this.session) this.connectWebSocket();
        }, 8000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      this.isConnected = false;
    }
  }

  private publish(data: object) {
    const jsonStr = JSON.stringify(data);

    // ส่งในแท็บเครื่องเดียวกันผ่าน BroadcastChannel
    if (this.bc) {
      try {
        this.bc.postMessage(data);
      } catch {
        // Ignore
      }
    }

    // ส่งข้ามเครื่องผ่าน ntfy.sh
    fetch(POST_ENDPOINT, {
      method: 'POST',
      body: jsonStr,
      headers: {
        'Title': 'Gang Presence Event',
      },
    }).catch(() => {
      // Ignore network errors
    });
  }

  private sendHeartbeat() {
    if (!this.session) return;

    // อัปเดตเวลาตัวเราเอง
    const self = this.membersMap.get(this.clientId);
    if (self) {
      self.lastSeen = Date.now();
    } else {
      this.addSelfMember();
    }

    const payload = {
      type: 'presence_ping',
      clientId: this.clientId,
      memberName: this.session.memberName,
      isMaster: this.session.isMaster,
      joinedAt: self?.joinedAt || Date.now(),
      lastSeen: Date.now(),
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    };

    this.publish(payload);
    this.notifyListeners();
  }

  private sendLeave() {
    if (!this.session) return;
    const payload = {
      type: 'presence_leave',
      clientId: this.clientId,
      memberName: this.session.memberName,
    };
    this.publish(payload);
  }

  private handleBeforeUnload = () => {
    this.sendLeave();
  };

  private handleMessage(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'presence_ping') {
      if (data.clientId === this.clientId) return; // ตัวเอง

      const existing = this.membersMap.get(data.clientId);
      const isNewMember = !existing;

      this.membersMap.set(data.clientId, {
        clientId: data.clientId,
        memberName: data.memberName,
        isMaster: !!data.isMaster,
        joinedAt: data.joinedAt || Date.now(),
        lastSeen: Date.now(),
        device: data.device || 'Desktop',
      });

      if (isNewMember) {
        logActivity(data.memberName, 'login', 'ออนไลน์เปิดใช้งานแผนที่');
      }

      this.notifyListeners();
    } else if (data.type === 'presence_leave') {
      if (data.clientId === this.clientId) return;
      this.membersMap.delete(data.clientId);
      this.notifyListeners();
    } else if (data.type === 'cooldown_sync') {
      if (data.memberName === this.session?.memberName) return; // ทำเองไม่ต้องซ้ำ
      this.cdListeners.forEach((cb) => cb(data));
    }
  }

  private pruneInactiveMembers() {
    const now = Date.now();
    let changed = false;

    this.membersMap.forEach((member, id) => {
      if (id !== this.clientId && now - member.lastSeen > 45000) {
        this.membersMap.delete(id);
        changed = true;
      }
    });

    if (changed) {
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    const members = this.getOnlineMembers();
    const logs = getActivityLogs();
    this.listeners.forEach((cb) => cb(members, logs));
  }
}

export const gangPresence = new GangPresenceManager();
