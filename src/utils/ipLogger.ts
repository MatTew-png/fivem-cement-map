import type { GangSession } from './gangAuth';

export interface IpLogEntry {
  id: string;
  ip: string;
  city?: string;
  country?: string;
  device: string;
  timestamp: number;
  action: 'visit' | 'login_success' | 'login_fail' | 'banned_blocked';
  memberName?: string;
  branchId?: string;
}

export interface BanRecord {
  ip: string;
  reason: string;
  bannedAt: number;
  bannedBy: string;
}

export interface IpInfo {
  ip: string;
  city?: string;
  country?: string;
  banned?: boolean;
  banReason?: string | null;
}

export interface SecuritySnapshot {
  logs: IpLogEntry[];
  bans: BanRecord[];
  webhookConfigured: boolean;
  webhookMasked: string | null;
}

function mapEventToAction(event: string): IpLogEntry['action'] {
  switch (event) {
    case 'login':
      return 'login_success';
    case 'failed_pin':
      return 'login_fail';
    case 'banned_attempt':
      return 'banned_blocked';
    default:
      return 'visit';
  }
}

export async function detectClientIp(): Promise<IpInfo> {
  try {
    const res = await fetch('/api/my-ip', { cache: 'no-store' });
    if (!res.ok) return { ip: 'unknown' };
    const data = (await res.json()) as IpInfo;
    return {
      ip: data.ip || 'unknown',
      city: data.city || '',
      country: data.country || '',
      banned: Boolean(data.banned),
      banReason: data.banReason ?? null,
    };
  } catch {
    return { ip: 'unknown' };
  }
}

export async function reportVisitToServer(
  memberName = 'Guest',
  branchId = 'unauthenticated'
): Promise<{ banned: boolean; banReason?: string | null; ip: string; city?: string; country?: string }> {
  try {
    const res = await fetch('/api/security/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberName, branchId }),
    });
    const data = (await res.json()) as {
      banned?: boolean;
      banReason?: string | null;
      ip?: string;
      city?: string;
      country?: string;
    };
    return {
      banned: res.status === 403 || Boolean(data.banned),
      banReason: data.banReason ?? null,
      ip: data.ip || 'unknown',
      city: data.city,
      country: data.country,
    };
  } catch {
    return { banned: false, ip: 'unknown' };
  }
}

export async function fetchSecuritySnapshot(session: GangSession): Promise<SecuritySnapshot> {
  if (!session.isMaster || !session.token) {
    throw new Error('Forbidden');
  }

  const res = await fetch('/api/security/logs', {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'ไม่สามารถโหลดบันทึกความปลอดภัยได้');
  }

  const data = (await res.json()) as {
    logs: Array<{
      id: string;
      ip: string;
      memberName?: string;
      branchId?: string;
      event: string;
      timestamp: number;
      country?: string;
      city?: string;
      userAgent?: string;
    }>;
    bans: BanRecord[];
    webhookConfigured: boolean;
    webhookMasked: string | null;
  };

  return {
    logs: (data.logs || []).map((item) => ({
      id: item.id,
      ip: item.ip,
      city: item.city,
      country: item.country,
      device: item.userAgent || 'Browser',
      timestamp: item.timestamp,
      action: mapEventToAction(item.event),
      memberName: item.memberName,
      branchId: item.branchId,
    })),
    bans: Array.isArray(data.bans) ? data.bans : [],
    webhookConfigured: Boolean(data.webhookConfigured),
    webhookMasked: data.webhookMasked ?? null,
  };
}

export async function banIpOnServer(
  session: GangSession,
  ip: string,
  reason = 'ถูกแบนโดย Master Boss'
): Promise<BanRecord[]> {
  if (!session.isMaster || !session.token) {
    throw new Error('Forbidden');
  }
  const res = await fetch('/api/security/ban', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ ip, reason }),
  });
  const data = (await res.json().catch(() => ({}))) as { bans?: BanRecord[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'ไม่สามารถแบน IP ได้');
  }
  return data.bans || [];
}

export async function unbanIpOnServer(session: GangSession, ip: string): Promise<BanRecord[]> {
  if (!session.isMaster || !session.token) {
    throw new Error('Forbidden');
  }
  const res = await fetch('/api/security/unban', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ ip }),
  });
  const data = (await res.json().catch(() => ({}))) as { bans?: BanRecord[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'ไม่สามารถปลดแบน IP ได้');
  }
  return data.bans || [];
}

export async function saveDiscordWebhookOnServer(
  session: GangSession,
  webhookUrl: string
): Promise<{ webhookConfigured: boolean; webhookMasked: string | null }> {
  if (!session.isMaster || !session.token) {
    throw new Error('Forbidden');
  }
  const res = await fetch('/api/security/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ webhookUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    webhookConfigured?: boolean;
    webhookMasked?: string | null;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'ไม่สามารถบันทึก Discord Webhook ได้');
  }
  return {
    webhookConfigured: Boolean(data.webhookConfigured),
    webhookMasked: data.webhookMasked ?? null,
  };
}
