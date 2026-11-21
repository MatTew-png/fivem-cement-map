import type { ActiveCooldown, CementSpot } from '../types/map';
import type { ActivityLog, GangSession } from './gangAuth';
import type { SpotBackupSnapshot } from './storage';

const WORKER_API_BASE = 'https://runthukverb-cement-cooldown.pages.dev';

function getEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, protocol } = window.location;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.pages.dev') ||
      hostname.endsWith('.workers.dev')
    ) {
      return `${protocol}//${window.location.host}${path}`;
    }
  }
  return `${WORKER_API_BASE}${path}`;
}

export interface ServerMapState {
  enabled: boolean;
  branchId?: string;
  spotsSeeded?: boolean;
  spots?: CementSpot[];
  activeCooldowns?: ActiveCooldown[];
  activityLogs?: ActivityLog[];
  backups?: SpotBackupSnapshot[];
}

export async function fetchServerMapState(session: GangSession): Promise<ServerMapState> {
  if (!session.token) return { enabled: false };
  try {
    const query = session.gangId ? `?branchId=${encodeURIComponent(session.gangId)}` : '';
    const res = await fetch(getEndpoint(`/api/map/state${query}`), {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as ServerMapState;
  } catch {
    return { enabled: false };
  }
}

export async function seedServerSpots(
  session: GangSession,
  spots: CementSpot[],
  replace = false
): Promise<{ enabled: boolean; spots?: CementSpot[] }> {
  if (!session.token) return { enabled: false };
  try {
    const res = await fetch(getEndpoint('/api/map/seed'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, spots, replace }),
    });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as { enabled: boolean; spots?: CementSpot[] };
  } catch {
    return { enabled: false };
  }
}

export async function saveSpotToServer(session: GangSession, spot: CementSpot): Promise<void> {
  if (!session.token) return;
  try {
    await fetch(getEndpoint('/api/map/spots'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, spot }),
    });
  } catch {
    // Offline fallback relies on localStorage + Realtime broadcast
  }
}

export async function deleteSpotOnServer(session: GangSession, spotId: string): Promise<void> {
  if (!session.token) return;
  try {
    await fetch(getEndpoint('/api/map/spots/delete'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, spotId }),
    });
  } catch {
    // Ignore transient network failures
  }
}

export async function bulkReplaceSpotsOnServer(
  session: GangSession,
  action: 'import' | 'restore' | 'reset',
  spots: CementSpot[],
  reason?: string
): Promise<{ spots?: CementSpot[]; backups?: SpotBackupSnapshot[] } | null> {
  if (!session.token) return null;
  try {
    const res = await fetch(getEndpoint('/api/map/spots/bulk'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, action, spots, reason }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { spots?: CementSpot[]; backups?: SpotBackupSnapshot[] };
  } catch {
    return null;
  }
}

export async function syncCooldownToServer(
  session: GangSession,
  payload:
    | { action: 'start'; cooldown: ActiveCooldown }
    | { action: 'cancel'; spotId: string }
): Promise<void> {
  if (!session.token) return;
  try {
    await fetch(getEndpoint('/api/map/cooldowns'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, ...payload }),
    });
  } catch {
    // Best-effort DB persistence alongside Realtime broadcast
  }
}

export async function syncActivityLogToServer(
  session: GangSession,
  payload:
    | { action: 'append'; entry: ActivityLog }
    | { action: 'clear' }
): Promise<void> {
  if (!session.token) return;
  try {
    await fetch(getEndpoint('/api/map/activity'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ branchId: session.gangId, ...payload }),
    });
  } catch {
    // Ignore offline logging error
  }
}
