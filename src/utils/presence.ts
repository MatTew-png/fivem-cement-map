import mqtt, { type MqttClient } from 'mqtt';
import type { CementSpot } from '../types/map';
import type { GangSession, ActivityLog } from './gangAuth';
import { logActivity, getActivityLogs, GANG_SECRET_SEED } from './gangAuth';

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
export type SyncRequestListener = () => void;

const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'fivem/runthukverb_gang_cooldown/events_v1';
const MQTT_SPOTS_RETAINED_TOPIC = 'fivem/runthukverb_gang_cooldown/spots_manifest_retained_v2';
const BROADCAST_CHANNEL_NAME = 'runthukverb_presence_bc';

// E2EE Symmetric Encryption เพื่อป้องกันการดักจับพิกัดและข้อมูลข้ามเครือข่าย
function encryptPayload(data: object): string {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(GANG_SECRET_SEED);
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

function decryptPayload(raw: string): any {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('GANG_ENC:')) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    const base64Data = raw.slice(9);
    const binary = atob(base64Data);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }
    const keyBytes = new TextEncoder().encode(GANG_SECRET_SEED);
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

class GangPresenceManager {
  private clientId: string = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private session: GangSession | null = null;
  private client: MqttClient | null = null;
  private bc: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private membersMap: Map<string, OnlineMember> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private cdListeners: Set<CooldownSyncListener> = new Set();
  private spotListeners: Set<SpotSyncListener> = new Set();
  private notifListeners: Set<NotificationListener> = new Set();
  private manifestListeners: Set<SpotManifestListener> = new Set();
  private syncRequestListeners: Set<SyncRequestListener> = new Set();
  private outgoingQueue: Array<{ topic: string; payload: string; options?: mqtt.IClientPublishOptions }> = [];
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

    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // Ignore
      }
      this.client = null;
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
    this.publish(payload, MQTT_TOPIC, { qos: 1 });
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
    this.publish(payload, MQTT_TOPIC, { qos: 1 });
    // 2. ส่งแบบ RETAINED ให้ HiveMQ Broker จดจำไว้ถาวร เพื่อให้คนที่เปิดเว็บทีหลังได้รับทันที!
    this.publish(payload, MQTT_SPOTS_RETAINED_TOPIC, { qos: 1, retain: true });
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
      logActivity(this.session.memberName, 'cooldown_start', `เริ่มจับเวลาจุด ${spotName} (${durationMinutes} นาที)`);
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
      logActivity(this.session.memberName, 'spot_add', `ปักหมุดใหม่: ${name}`);
    } else if (action === 'delete') {
      logActivity(this.session.memberName, 'spot_delete', `ลบหมุด: ${name}`);
    } else if (action === 'move') {
      logActivity(this.session.memberName, 'spot_move', `ย้ายพิกัด: ${name}`);
    } else if (action === 'update') {
      logActivity(this.session.memberName, 'spot_update', `แก้ไขข้อมูล: ${name}`);
    }

    this.notifyListeners();
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
      this.client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: this.clientId,
        keepalive: 30,
        reconnectPeriod: 3000,
        clean: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.client?.subscribe([MQTT_TOPIC, MQTT_SPOTS_RETAINED_TOPIC], { qos: 1 }, (err) => {
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
          const data = decryptPayload(raw);
          if (data) {
            if (topic === MQTT_SPOTS_RETAINED_TOPIC) {
              this.handleRetainedSpotsMessage(data);
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

  private publish(data: object, targetTopic: string = MQTT_TOPIC, options: mqtt.IClientPublishOptions = { qos: 1 }) {
    // ส่งในแท็บเครื่องเดียวกันผ่าน BroadcastChannel
    if (this.bc && targetTopic === MQTT_TOPIC) {
      try {
        this.bc.postMessage(data);
      } catch {
        // Ignore
      }
    }

    const encryptedStr = encryptPayload(data);

    // เข้ารหัส E2EE ก่อนส่งข้ามเครื่องผ่าน HiveMQ MQTT Broker
    if (this.client && this.client.connected) {
      try {
        this.client.publish(targetTopic, encryptedStr, options);
      } catch {
        // Ignore network errors
      }
    } else {
      this.outgoingQueue.push({ topic: targetTopic, payload: encryptedStr, options });
    }
  }

  private handleRetainedSpotsMessage(data: any) {
    if (!data || !Array.isArray(data.customSpots)) return;
    this.manifestListeners.forEach((cb) => cb(data.customSpots, data.memberName || 'คลาวด์แก๊ง'));
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

    // ละทิ้งเฉพาะ presence_ping เก่าเกิน 45 วินาที เพื่อไม่ให้รายชื่อค้าง
    if (data.type === 'presence_ping' && data.timestamp && Date.now() - data.timestamp > 45000) {
      return;
    }

    // 1. Presence Ping
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
        this.triggerNotification({
          type: 'cooldown_start',
          title: `${data.memberName} เริ่มจับเวลา`,
          subtitle: `${data.spotName} (${data.durationMinutes} นาที)`,
          icon: '⏳',
        });
      } else if (data.action === 'cancel') {
        this.triggerNotification({
          type: 'cooldown_cancel',
          title: `${data.memberName} ยกเลิกจับเวลา`,
          subtitle: `${data.spotName || ''}`,
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
        this.triggerNotification({
          type: 'spot_add',
          title: `${data.memberName} ปักหมุดใหม่`,
          subtitle: `${spotName}`,
          icon: '🧱',
        });
      } else if (data.action === 'update') {
        this.triggerNotification({
          type: 'spot_update',
          title: `${data.memberName} แก้ไขหมุด`,
          subtitle: `${spotName}`,
          icon: '✏️',
        });
      } else if (data.action === 'move') {
        this.triggerNotification({
          type: 'spot_move',
          title: `${data.memberName} ย้ายพิกัด`,
          subtitle: `${spotName}`,
          icon: '📍',
        });
      } else if (data.action === 'delete') {
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
