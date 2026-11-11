import mqtt, { type MqttClient } from 'mqtt';
import type { CementSpot, ActiveCooldown } from '../types/map';
import type { GangSession, ActivityLog } from './gangAuth';
import {
  logActivity,
  getActivityLogs,
  clearActivityLogs,
  logoutGang,
  normalizeGangId,
  verifySessionWithServer,
} from './gangAuth';

export interface OnlineMember {
  clientId: string;
  memberName: string;
  isMaster: boolean;
  joinedAt: number;
  lastSeen: number;
  device?: string;
}

export type SpotSyncAction = 'add' | 'update' | 'delete' | 'move';

export interface SpotSyncEvent {
  action: SpotSyncAction;
  spot?: CementSpot;
  spotId?: string;
  memberName: string;
  timestamp: number;
}

export type SpotSyncListener = (event: SpotSyncEvent) => void;

export interface GangNotification {
  id: string;
  type: 'member_join' | 'cooldown_start' | 'cooldown_cancel' | 'spot_add' | 'spot_update' | 'spot_delete' | 'spot_move';
  title: string;
  subtitle?: string;
  timestamp: number;
  icon?: string;
}

export type NotificationListener = (notification: GangNotification) => void;
export type PresenceListener = (members: OnlineMember[], logs: ActivityLog[]) => void;
export type CooldownSyncListener = (data: { spotId: string; spotName: string; durationMinutes: number; action: 'start' | 'cancel'; memberName: string }) => void;
export type SpotManifestListener = (customSpots: CementSpot[], senderName: string) => void;
export type CooldownManifestListener = (activeCooldowns: ActiveCooldown[], senderName: string) => void;
export type SyncRequestListener = () => void;

const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

function encryptPayload(data: object, secretKey: string): string {
  try {
    const jsonStr = JSON.stringify(data);
    if (!secretKey) return jsonStr;
    const bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(secretKey);
    const cipherBytes = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      cipherBytes[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    let binary = '';
    const len = cipherBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(cipherBytes[i]);
    }
    return 'GANG_ENC:' + btoa(binary);
  } catch {
    return JSON.stringify(data);
  }
}

function decryptPayload(raw: string, secretKey: string): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('GANG_ENC:')) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!secretKey) return null;
  try {
    const base64Data = raw.slice(9);
    const binary = atob(base64Data);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }
    const keyBytes = new TextEncoder().encode(secretKey);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const jsonStr = new TextDecoder().decode(plainBytes);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

class GangPresenceManager {
  private clientId: string = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private session: GangSession | null = null;
  private client: MqttClient | null = null;
  private bc: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private membersMap: Map<string, OnlineMember> = new Map();
  private memberSessions: Map<string, { firstJoined: number; lastSeen: number; lastNotifiedJoin: number }> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private cdListeners: Set<CooldownSyncListener> = new Set();
  private spotListeners: Set<SpotSyncListener> = new Set();
  private notifListeners: Set<NotificationListener> = new Set();
  private manifestListeners: Set<SpotManifestListener> = new Set();
  private cdManifestListeners: Set<CooldownManifestListener> = new Set();
  private syncRequestListeners: Set<SyncRequestListener> = new Set();
  private outgoingQueue: Array<{ topic: string; payload: string; options?: mqtt.IClientPublishOptions }> = [];
  private isConnected: boolean = false;

  public getGangId(): string {
    return normalizeGangId(this.session?.gangId || 'branch_1');
  }

  private getChannelSecret(): string {
    const channelKey = this.session?.channelKey || this.session?.authDate || '';
    return `${channelKey}_${this.getGangId()}`;
  }

  private getChannelNamespace(): string {
    const key = this.session?.channelKey ? `${this.session.channelKey.slice(0, 8)}_` : '';
    return `${key}${this.getGangId()}`;
  }

  public getMqttTopic(): string {
    return `fivem/gang_v5_${this.getChannelNamespace()}/events`;
  }

  public getSpotsRetainedTopic(): string {
    return `fivem/gang_v5_${this.getChannelNamespace()}/spots_manifest_retained`;
  }

  public getCooldownsRetainedTopic(): string {
    return `fivem/gang_v5_${this.getChannelNamespace()}/cooldowns_manifest_retained`;
  }

  public getBroadcastChannelName(): string {
    return `fivem_gang_${this.getGangId()}_bc`;
  }

  // เริ่มระบบ Presence สำหรับสมาชิกที่ล็อกอินแล้ว
  public start(session: GangSession) {
    this.session = session;

    if (this.bc) {
      try {
        this.bc.close();
      } catch {}
      this.bc = null;
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(this.getBroadcastChannelName());
      this.bc.onmessage = (e) => this.handleMessage(e.data);
    }

    this.addSelfMember();
    this.connectWebSocket();

    // ส่ง Heartbeat ทุกๆ 15 วินาที
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 15000);

    // ตรวจสอบและตัดรายชื่อคนที่ขาดการเชื่อมต่อเกิน 90 วินาที (Prune inactive)
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = window.setInterval(() => {
      this.pruneInactiveMembers();
    }, 5000);

    // ตรวจจับเมื่อผู้ใช้สลับกลับมาที่แท็บ ให้ส่ง Heartbeat และขอซิงค์หมุดทันที
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    // ส่ง Ping แรกทันที
    this.sendHeartbeat();
  }

  // หยุดระบบเมื่อออกจากระบบ
  public stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    this.sendLeave();

    if (this.bc) {
      try {
        this.bc.close();
      } catch {}
      this.bc = null;
    }

    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // Ignore
      }
      this.client = null;
    }

    this.membersMap.clear();
    this.memberSessions.clear();
    this.notifyListeners();
  }

  public subscribe(callback: PresenceListener): () => void {
    this.listeners.add(callback);
    callback(this.getOnlineMembers(), getActivityLogs(this.session?.gangId));
    return () => this.listeners.delete(callback);
  }

  public subscribeCooldownSync(callback: CooldownSyncListener): () => void {
    this.cdListeners.add(callback);
    return () => this.cdListeners.delete(callback);
  }

  public subscribeSpotSync(callback: SpotSyncListener): () => void {
    this.spotListeners.add(callback);
    return () => this.spotListeners.delete(callback);
  }

  public subscribeNotification(callback: NotificationListener): () => void {
    this.notifListeners.add(callback);
    return () => this.notifListeners.delete(callback);
  }

  public subscribeSpotManifest(callback: SpotManifestListener): () => void {
    this.manifestListeners.add(callback);
    return () => this.manifestListeners.delete(callback);
  }

  public subscribeCooldownManifest(callback: CooldownManifestListener): () => void {
    this.cdManifestListeners.add(callback);
    return () => this.cdManifestListeners.delete(callback);
  }

  public subscribeSyncRequest(callback: SyncRequestListener): () => void {
    this.syncRequestListeners.add(callback);
    return () => this.syncRequestListeners.delete(callback);
  }

  // ส่งสัญญาณขอซิงค์ข้อมูลหมุดจากเพื่อนที่ออนไลน์อยู่
  public requestSync() {
    if (!this.session) return;
    const payload = {
      type: 'sync_request',
      clientId: this.clientId,
      memberName: this.session.memberName,
      timestamp: Date.now(),
    };
    this.publish(payload, this.getMqttTopic(), { qos: 1 });
  }

  // ส่งสำเนาหมุดทั้งหมดที่มีการปักหรืออัปเดต เพื่อให้สมาชิกใหม่และคนที่เข้าทีหลังได้รับข้อมูลครบถ้วนตลอดไป
  public broadcastSpotManifest(customSpots: CementSpot[]) {
    if (!this.session || customSpots.length === 0) return;
    const payload = {
      type: 'spot_manifest',
      clientId: this.clientId,
      memberName: this.session.memberName,
      customSpots,
      timestamp: Date.now(),
    };
    // 1. ส่งแจ้งเตือน Real-time ให้เพื่อนที่กำลังเปิดเว็บอยู่
    this.publish(payload, this.getMqttTopic(), { qos: 1 });
    // 2. ส่งแบบ RETAINED ให้ HiveMQ Broker จดจำไว้ถาวร เพื่อให้คนที่เปิดเว็บทีหลังได้รับทันที!
    this.publish(payload, this.getSpotsRetainedTopic(), { qos: 1, retain: true });
  }

  // ส่งสำเนาคูลดาวน์ทั้งหมดที่กำลังนับถอยหลัง เพื่อให้สมาชิกที่เปิดเว็บทีหลังได้รับทันที
  public broadcastCooldownManifest(activeCooldowns: ActiveCooldown[]) {
    if (!this.session) return;
    const now = Date.now();
    // เก็บเฉพาะคูลดาวน์ที่ยังไม่หมดอายุ (หรือเพิ่งหมดอายุไม่เกิน 60 วินาที)
    const valid = activeCooldowns.filter((c) => c && c.expiresAt > now - 60000);
    const payload = {
      type: 'cooldown_manifest',
      clientId: this.clientId,
      memberName: this.session.memberName,
      cooldowns: valid,
      timestamp: now,
    };
    // 1. ส่งแจ้งเตือน Real-time ให้เพื่อนที่กำลังเปิดเว็บอยู่
    this.publish(payload, this.getMqttTopic(), { qos: 1 });
    // 2. ส่งแบบ RETAINED ให้ HiveMQ Broker จดจำไว้ถาวร เพื่อให้คนที่เปิดเว็บทีหลังได้รับทันที!
    this.publish(payload, this.getCooldownsRetainedTopic(), { qos: 1, retain: true });
  }

  public triggerNotification(notif: Omit<GangNotification, 'id' | 'timestamp'>) {
    const fullNotif: GangNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    this.notifListeners.forEach((cb) => cb(fullNotif));
  }

  // สมาชิกกดจับเวลาปูน ให้กระจายแจ้งเตือนทั้งแก๊ง
  public broadcastCooldown(spotId: string, spotName: string, durationMinutes: number, action: 'start' | 'cancel') {
    if (!this.session) return;
    const payload = {
      type: 'cooldown_sync',
      clientId: this.clientId,
      spotId,
      spotName,
      durationMinutes,
      action,
      memberName: this.session.memberName,
      timestamp: Date.now(),
    };
    this.publish(payload);

    if (action === 'start') {
      logActivity(this.session.memberName, 'cooldown_start', `เริ่มจับเวลาจุด ${spotName} (${durationMinutes} นาที)`, this.session.gangId);
      this.notifyListeners();
    }
  }

  // สมาชิกปักจุด / แก้ไข / ลบ / ย้ายหมุด ให้กระจายอัปเดตทั้งแก๊งสดๆ ทันที
  public broadcastSpotChange(action: SpotSyncAction, spot?: CementSpot, spotId?: string) {
    if (!this.session) return;
    const id = spotId || spot?.id || '';
    const name = spot?.name || 'จุดมาร์คเกอร์';

    const payload = {
      type: 'spot_sync',
      clientId: this.clientId,
      action,
      spot,
      spotId: id,
      memberName: this.session.memberName,
      timestamp: Date.now(),
    };

    this.publish(payload);

    // บันทึก Activity Log
    if (action === 'add') {
      logActivity(this.session.memberName, 'spot_add', `ปักหมุดใหม่: ${name}`, this.session.gangId);
    } else if (action === 'delete') {
      logActivity(this.session.memberName, 'spot_delete', `ลบหมุด: ${name}`, this.session.gangId);
    } else if (action === 'move') {
      logActivity(this.session.memberName, 'spot_move', `ย้ายพิกัด: ${name}`, this.session.gangId);
    } else if (action === 'update') {
      logActivity(this.session.memberName, 'spot_update', `แก้ไขข้อมูล: ${name}`, this.session.gangId);
    }

    this.notifyListeners();
  }

  public getOnlineMembers(): OnlineMember[] {
    const now = Date.now();
    // รองรับแท็บเบื้องหลัง (Background Tab Throttling) โดยขยายเป็น 90 วินาที
    const list = Array.from(this.membersMap.values()).filter(
      (m) => now - m.lastSeen < 90000
    );

    // รวมสมาชิกที่ชื่อเดียวกัน (ป้องกันกรณีเปิดหลายแท็บ หรือมี clientId ค้างชั่วคราว)
    const uniqueMap = new Map<string, OnlineMember>();
    for (const member of list) {
      const key = (member.memberName || '').toLowerCase().trim();
      const existing = uniqueMap.get(key);
      if (!existing || member.lastSeen > existing.lastSeen) {
        uniqueMap.set(key, member);
      }
    }

    const uniqueList = Array.from(uniqueMap.values());

    // เรียง: หัวหน้าขึ้นก่อน แล้วตามด้วยเวลาที่ออนไลน์
    return uniqueList.sort((a, b) => {
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
    const now = Date.now();
    const selfMember: OnlineMember = {
      clientId: this.clientId,
      memberName: this.session.memberName,
      isMaster: this.session.isMaster,
      joinedAt: now,
      lastSeen: now,
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    };
    this.membersMap.set(this.clientId, selfMember);

    const normName = this.session.memberName.toLowerCase().trim();
    this.memberSessions.set(normName, {
      firstJoined: now,
      lastSeen: now,
      lastNotifiedJoin: now,
    });

    this.notifyListeners();
  }

  private connectWebSocket() {
    if (typeof window === 'undefined' || !this.session) return;

    try {
      this.client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: this.clientId,
        keepalive: 30,
        reconnectPeriod: 3000,
        clean: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.client?.subscribe([this.getMqttTopic(), this.getSpotsRetainedTopic(), this.getCooldownsRetainedTopic()], { qos: 1 }, (err) => {
          if (!err) {
            this.sendHeartbeat();
            this.flushOutgoingQueue();
            this.requestSync();
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const raw = payload.toString();
          const data = decryptPayload(raw, this.getChannelSecret());
          if (data) {
            if (topic === this.getSpotsRetainedTopic()) {
              this.handleRetainedSpotsMessage(data);
            } else if (topic === this.getCooldownsRetainedTopic()) {
              this.handleRetainedCooldownsMessage(data);
            } else {
              this.handleMessage(data);
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  private flushOutgoingQueue() {
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

  private publish(data: object, targetTopic?: string, options: mqtt.IClientPublishOptions = { qos: 1 }) {
    const topic = targetTopic || this.getMqttTopic();
    // ส่งในแท็บเครื่องเดียวกันผ่าน BroadcastChannel
    if (this.bc && topic === this.getMqttTopic()) {
      try {
        this.bc.postMessage(data);
      } catch {
        // Ignore
      }
    }

    const encrypted = encryptPayload(data, this.getChannelSecret());
    if (this.client && this.client.connected) {
      try {
        this.client.publish(topic, encrypted, options);
      } catch {
        // Ignore
      }
    } else {
      this.outgoingQueue.push({ topic, payload: encrypted, options });
    }
  }


  private handleRetainedSpotsMessage(data: any) {
    if (!data || !Array.isArray(data.customSpots)) return;
    this.manifestListeners.forEach((cb) => cb(data.customSpots, data.memberName || 'คลาวด์แก๊ง'));
  }

  private handleRetainedCooldownsMessage(data: any) {
    if (!data || !Array.isArray(data.cooldowns)) return;
    const now = Date.now();
    const valid = data.cooldowns.filter((c: ActiveCooldown) => c && c.expiresAt > now - 60000);
    this.cdManifestListeners.forEach((cb) => cb(valid, data.memberName || 'คลาวด์แก๊ง'));
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

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.session) {
      this.sendHeartbeat();
      this.requestSync();
    }
  };

  private handleMessage(data: any) {
    if (!data || !data.type) return;

    // ละทิ้งเฉพาะ presence_ping เก่าเกิน 90 วินาที เพื่อไม่ให้รายชื่อค้าง
    if (data.type === 'presence_ping' && data.timestamp && Date.now() - data.timestamp > 90000) {
      return;
    }

    // 1. Presence Ping
    if (data.type === 'presence_ping') {
      if (data.clientId === this.clientId) return; // ตัวเอง

      const normName = (data.memberName || '').toLowerCase().trim();
      if (!normName) return;

      const now = Date.now();
      const existingSession = this.memberSessions.get(normName);

      // ถือเป็น "สมาชิกใหม่เข้าสู่ระบบ" ก็ต่อเมื่อ:
      // - ไม่เคยมีประวัติชื่อนี้ในเซสชั่นนี้มาก่อน
      // - หรือ ขาดการติดต่อเกิน 15 นาที (900,000 ms)
      // (หากเน็ตหลุด/ต่อใหม่, สลับแท็บ, หรือรีเฟรช จะไม่นับเป็น Login ใหม่เด็ดขาด เพื่อป้องกันแจ้งเตือนและประวัติรก)
      const isGenuineNewJoin = !existingSession || (now - existingSession.lastSeen > 15 * 60 * 1000);

      if (isGenuineNewJoin) {
        this.memberSessions.set(normName, {
          firstJoined: data.joinedAt || now,
          lastSeen: now,
          lastNotifiedJoin: now,
        });
      } else {
        existingSession.lastSeen = now;
      }

      // หากมี clientId เก่าของคนเดิมค้างอยู่ใน Map (เช่น รีเฟรชหน้าเว็บ หรือเปิดหลายแท็บ) ให้ลบออก
      this.membersMap.forEach((m, cId) => {
        if (cId !== data.clientId && (m.memberName || '').toLowerCase().trim() === normName) {
          this.membersMap.delete(cId);
        }
      });

      this.membersMap.set(data.clientId, {
        clientId: data.clientId,
        memberName: data.memberName,
        isMaster: !!data.isMaster,
        joinedAt: isGenuineNewJoin ? (data.joinedAt || now) : (existingSession?.firstJoined || data.joinedAt || now),
        lastSeen: now,
        device: data.device || 'Desktop',
      });

      if (isGenuineNewJoin) {
        logActivity(data.memberName, 'login', 'ออนไลน์เปิดใช้งานแผนที่', this.getGangId());
        this.triggerNotification({
          type: 'member_join',
          title: `${data.memberName} เข้าสู่ระบบ`,
          subtitle: `ออนไลน์จาก ${data.device || 'อุปกรณ์'}`,
          icon: '🟢',
        });
        // ส่ง Heartbeat ตอบกลับ เพื่อให้สมาชิกใหม่เห็นเราทันทีในรายชื่อ
        this.sendHeartbeat();
        // ส่งสำเนาหมุดที่มี ให้สมาชิกใหม่ทันที!
        this.syncRequestListeners.forEach((cb) => cb());
      }

      this.notifyListeners();
    }
    // 2. Presence Leave
    else if (data.type === 'presence_leave') {
      if (data.clientId === this.clientId) return;
      this.membersMap.delete(data.clientId);
      this.notifyListeners();
    }
    // 3. Cooldown Sync
    else if (data.type === 'cooldown_sync') {
      if (data.clientId === this.clientId) return; // ตัวเอง
      this.cdListeners.forEach((cb) => cb(data));

      if (data.action === 'start') {
        const spotTitle = data.spotName || 'จุดปูน';
        logActivity(
          data.memberName,
          'cooldown_start',
          `เริ่มจับเวลาจุด ${spotTitle} (${data.durationMinutes} นาที)`,
          this.getGangId()
        );
        this.notifyListeners();
        this.triggerNotification({
          type: 'cooldown_start',
          title: `${data.memberName} เริ่มจับเวลา`,
          subtitle: `${spotTitle} (${data.durationMinutes} นาที)`,
          icon: '⏳',
        });
      } else if (data.action === 'cancel') {
        const spotTitle = data.spotName || 'จุดปูน';
        logActivity(
          data.memberName,
          'cooldown_cancel',
          `ยกเลิกจับเวลาจุด ${spotTitle}`,
          this.getGangId()
        );
        this.notifyListeners();
        this.triggerNotification({
          type: 'cooldown_cancel',
          title: `${data.memberName} ยกเลิกจับเวลา`,
          subtitle: `${spotTitle}`,
          icon: '⏹️',
        });
      }
    }
    // 4. Spot Sync (ปักจุด / แก้ไข / ลบ / ย้ายหมุด แบบ Real-time)
    else if (data.type === 'spot_sync') {
      if (data.clientId === this.clientId) return; // ตัวเอง
      this.spotListeners.forEach((cb) => cb(data));

      const spotName = data.spot?.name || data.spotId || 'จุดมาร์คเกอร์';
      if (data.action === 'add') {
        logActivity(data.memberName, 'spot_add', `ปักหมุดใหม่: ${spotName}`, this.getGangId());
        this.notifyListeners();
        this.triggerNotification({
          type: 'spot_add',
          title: `${data.memberName} ปักหมุดใหม่`,
          subtitle: `${spotName}`,
          icon: '🧱',
        });
      } else if (data.action === 'update') {
        logActivity(data.memberName, 'spot_update', `แก้ไขหมุด: ${spotName}`, this.getGangId());
        this.notifyListeners();
        this.triggerNotification({
          type: 'spot_update',
          title: `${data.memberName} แก้ไขหมุด`,
          subtitle: `${spotName}`,
          icon: '✏️',
        });
      } else if (data.action === 'move') {
        logActivity(data.memberName, 'spot_move', `ย้ายพิกัด: ${spotName}`, this.getGangId());
        this.notifyListeners();
        this.triggerNotification({
          type: 'spot_move',
          title: `${data.memberName} ย้ายพิกัด`,
          subtitle: `${spotName}`,
          icon: '📍',
        });
      } else if (data.action === 'delete') {
        logActivity(data.memberName, 'spot_delete', `ลบหมุด: ${spotName}`, this.getGangId());
        this.notifyListeners();
        this.triggerNotification({
          type: 'spot_delete',
          title: `${data.memberName} ลบหมุด`,
          subtitle: `${spotName}`,
          icon: '🗑️',
        });
      }
    }
    // 5. Spot Manifest Sync (เมื่อสมาชิกเข้ามาใหม่ ได้รับชุดหมุดที่เพื่อนๆ อัปเดตไว้)
    else if (data.type === 'spot_manifest') {
      if (data.clientId === this.clientId) return; // ตัวเอง
      if (Array.isArray(data.customSpots) && data.customSpots.length > 0) {
        this.manifestListeners.forEach((cb) => cb(data.customSpots, data.memberName || 'สมาชิกแก๊ง'));
      }
    }
    // 6. Sync Request (สมาชิกที่เพิ่งต่อเน็ต ร้องขอข้อมูลหมุดสดๆ จากคนในแก๊ง)
    else if (data.type === 'sync_request') {
      if (data.clientId === this.clientId) return; // ตัวเอง
      this.syncRequestListeners.forEach((cb) => cb());
    }
    // 7. Cooldown Manifest Sync (เมื่อสมาชิกเข้ามาใหม่ ได้รับชุดคูลดาวน์ที่เพื่อนๆ กำลังนับอยู่)
    else if (data.type === 'cooldown_manifest') {
      if (data.clientId === this.clientId) return; // ตัวเอง
      if (Array.isArray(data.cooldowns)) {
        const now = Date.now();
        const valid = data.cooldowns.filter((c: ActiveCooldown) => c && c.expiresAt > now - 60000);
        this.cdManifestListeners.forEach((cb) => cb(valid, data.memberName || 'สมาชิกแก๊ง'));
      }
    }
    // 8. Verified Session Check / Force Logout (ตรวจสอบสิทธิ์กับ Worker API ก่อนออกจากระบบ)
    else if (data.type === 'force_logout' || data.type === 'session_check') {
      const currentSession = this.session;
      if (!currentSession || currentSession.isMaster) return;
      void verifySessionWithServer(currentSession).then((result) => {
        if (!result.valid) {
          logoutGang();
          this.session = null;
          this.stop();
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      });
    }
  }

  private pruneInactiveMembers() {
    const now = Date.now();
    let changed = false;

    this.membersMap.forEach((member, id) => {
      // ขยายเวลา prune เป็น 90 วินาที เพื่อไม่ให้แท็บเบื้องหลังหลุดบ่อย
      if (id !== this.clientId && now - member.lastSeen > 90000) {
        this.membersMap.delete(id);
        changed = true;
      }
    });

    if (changed) {
      this.notifyListeners();
    }
  }

  // ล้างประวัติกิจกรรมทั้งหมด และแจ้งเตือน UI ให้รีเฟรชทันที
  public clearLogs() {
    clearActivityLogs(this.session?.gangId);
    this.notifyListeners();
  }

  // ส่งสัญญาณบังคับให้อุปกรณ์ทุกเครื่องเตะผู้ใช้ออกจากระบบทันที
  public broadcastForceLogout(reason: string = 'หัวหน้าแก๊งรีเซ็ตรหัสผ่านใหม่') {
    const payload = {
      type: 'force_logout',
      reason,
      timestamp: Date.now(),
      clientId: this.clientId,
    };
    this.publish(payload, this.getMqttTopic(), { qos: 1 });
  }

  private notifyListeners() {
    const members = this.getOnlineMembers();
    const logs = getActivityLogs(this.session?.gangId);
    this.listeners.forEach((cb) => cb(members, logs));
  }
}

export const gangPresence = new GangPresenceManager();
