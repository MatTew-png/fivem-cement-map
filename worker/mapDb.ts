import { sanitizeText } from './authCore.ts';
import type { SupabaseRestClient } from './supabaseRest.ts';

export interface StoredSpot {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  z?: number;
  postal?: string;
  cooldownMinutes: number;
  yieldDescription?: string;
  notes?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface StoredCooldown {
  spotId: string;
  spotName: string;
  startedBy?: string;
  startedAt: number;
  expiresAt: number;
  durationSeconds: number;
}

export interface StoredActivityLog {
  id: string;
  memberName: string;
  action: string;
  details?: string;
  timestamp: number;
}

export interface StoredBackupSnapshot {
  id: string;
  timestamp: number;
  dateStr: string;
  reason: string;
  spotsCount: number;
  spots: StoredSpot[];
}

interface DbSpotRow {
  branch_id: string;
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  z: number;
  postal: string;
  cooldown_minutes: number;
  yield_description: string;
  notes: string;
  tags: string[];
  created_by: string;
  created_at: number;
  updated_at: number;
}

interface DbCooldownRow {
  branch_id: string;
  spot_id: string;
  spot_name: string;
  started_by: string;
  started_at: number;
  expires_at: number;
  duration_seconds: number;
}

interface DbActivityRow {
  id: string;
  branch_id: string;
  member_name: string;
  action: string;
  details: string;
  created_at: number;
}

interface DbBackupRow {
  id: string;
  branch_id: string;
  reason: string;
  spot_count: number;
  spots: StoredSpot[];
  created_by: string;
  created_at: number;
}

function toDbSpotRow(branchId: string, spot: StoredSpot): DbSpotRow {
  const now = Date.now();
  return {
    branch_id: branchId,
    id: sanitizeText(spot.id, 80) || `spot_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: sanitizeText(spot.name, 80) || 'จุดปักหมุด',
    category: sanitizeText(spot.category, 40) || 'landmark',
    icon: sanitizeText(spot.icon, 200) || '📍',
    color: sanitizeText(spot.color, 24) || '#f59e0b',
    x: Number.isFinite(spot.x) ? Number(spot.x) : 0,
    y: Number.isFinite(spot.y) ? Number(spot.y) : 0,
    z: Number.isFinite(spot.z) ? Number(spot.z) : 30.0,
    postal: sanitizeText(spot.postal, 24),
    cooldown_minutes: Math.max(1, Math.min(240, Math.round(Number(spot.cooldownMinutes) || 10))),
    yield_description: sanitizeText(spot.yieldDescription, 180),
    notes: sanitizeText(spot.notes, 300),
    tags: Array.isArray(spot.tags)
      ? spot.tags.map((t) => sanitizeText(t, 32)).filter(Boolean).slice(0, 12)
      : [],
    created_by: sanitizeText(spot.createdBy, 32),
    created_at: Number.isFinite(spot.createdAt) ? Number(spot.createdAt) : now,
    updated_at: Number.isFinite(spot.updatedAt) ? Number(spot.updatedAt) : now,
  };
}

function fromDbSpotRow(row: DbSpotRow): StoredSpot {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    icon: row.icon,
    color: row.color,
    x: Number(row.x),
    y: Number(row.y),
    z: Number(row.z ?? 30.0),
    postal: row.postal || undefined,
    cooldownMinutes: Number(row.cooldown_minutes || 10),
    yieldDescription: row.yield_description || undefined,
    notes: row.notes || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdBy: row.created_by || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapBackupRow(bk: DbBackupRow): StoredBackupSnapshot {
  const ts = Number(bk.created_at);
  return {
    id: bk.id,
    timestamp: ts,
    dateStr: new Date(ts).toLocaleString('th-TH'),
    reason: bk.reason,
    spotsCount: Number(bk.spot_count),
    spots: Array.isArray(bk.spots) ? bk.spots : [],
  };
}

export async function getMapStateFromDb(db: SupabaseRestClient, branchId: string) {
  const b = encodeURIComponent(branchId);
  const cutoff = Date.now() - 120_000;
  const [groupRows, spotRows, cdRows, logRows, backupRows] = await Promise.all([
    db.select<{ spots_seeded?: boolean }>('groups', `id=eq.${b}&select=spots_seeded`),
    db.select<DbSpotRow>('spots', `branch_id=eq.${b}&order=created_at.desc`),
    db.select<DbCooldownRow>('active_cooldowns', `branch_id=eq.${b}&expires_at=gt.${cutoff}`),
    db.select<DbActivityRow>('activity_logs', `branch_id=eq.${b}&order=created_at.desc&limit=100`),
    db.select<DbBackupRow>('spot_backups', `branch_id=eq.${b}&order=created_at.desc&limit=15`),
  ]);

  const spotsSeeded = Boolean(groupRows[0]?.spots_seeded) || spotRows.length > 0;
  return {
    spotsSeeded,
    spots: spotRows.map(fromDbSpotRow),
    activeCooldowns: cdRows.map((c) => ({
      spotId: c.spot_id,
      spotName: c.spot_name,
      startedBy: c.started_by || undefined,
      startedAt: Number(c.started_at),
      expiresAt: Number(c.expires_at),
      durationSeconds: Number(c.duration_seconds),
    })),
    activityLogs: logRows.map((l) => ({
      id: l.id,
      memberName: l.member_name,
      action: l.action,
      details: l.details || undefined,
      timestamp: Number(l.created_at),
    })),
    backups: backupRows.map(mapBackupRow),
  };
}

export async function seedBranchSpotsInDb(
  db: SupabaseRestClient,
  branchId: string,
  spots: StoredSpot[],
  replace = false
): Promise<{ seeded: boolean; spots: StoredSpot[] }> {
  const b = encodeURIComponent(branchId);
  const [groupRows, existingRows] = await Promise.all([
    db.select<{ spots_seeded?: boolean }>('groups', `id=eq.${b}&select=spots_seeded`),
    db.select<DbSpotRow>('spots', `branch_id=eq.${b}&order=created_at.desc`),
  ]);

  if (!replace && (groupRows[0]?.spots_seeded || existingRows.length > 0)) {
    return { seeded: false, spots: existingRows.map(fromDbSpotRow) };
  }

  const rows = spots.map((s) => toDbSpotRow(branchId, s));
  if (replace) {
    await db.deleteRows('spots', `branch_id=eq.${b}`);
  }
  if (rows.length > 0) {
    await db.upsert('spots', rows, 'branch_id,id');
  }
  await db.patch('groups', `id=eq.${b}`, {
    spots_seeded: true,
    updated_at: new Date().toISOString(),
  });
  return { seeded: true, spots: rows.map(fromDbSpotRow) };
}

export async function upsertSpotInDb(
  db: SupabaseRestClient,
  branchId: string,
  spot: StoredSpot
): Promise<StoredSpot> {
  const row = toDbSpotRow(branchId, spot);
  const [saved] = await db.upsert<DbSpotRow>('spots', [row], 'branch_id,id');
  await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
    spots_seeded: true,
    updated_at: new Date().toISOString(),
  });
  return fromDbSpotRow(saved ?? row);
}

export async function deleteSpotInDb(
  db: SupabaseRestClient,
  branchId: string,
  spotId: string
): Promise<void> {
  const b = encodeURIComponent(branchId);
  const s = encodeURIComponent(spotId);
  await Promise.all([
    db.deleteRows('spots', `branch_id=eq.${b}&id=eq.${s}`),
    db.deleteRows('active_cooldowns', `branch_id=eq.${b}&spot_id=eq.${s}`),
  ]);
}

export async function replaceSpotsWithBackupInDb(
  db: SupabaseRestClient,
  branchId: string,
  nextSpots: StoredSpot[],
  reason: string,
  createdBy: string
): Promise<{ spots: StoredSpot[]; backups: StoredBackupSnapshot[] }> {
  const b = encodeURIComponent(branchId);
  const currentRows = await db.select<DbSpotRow>('spots', `branch_id=eq.${b}&order=created_at.desc`);
  if (currentRows.length > 0) {
    const prevSpots = currentRows.map(fromDbSpotRow);
    const now = Date.now();
    await db.insert('spot_backups', [
      {
        id: `bk_${now}_${Math.random().toString(36).slice(2, 7)}`,
        branch_id: branchId,
        reason: sanitizeText(reason, 100) || 'ก่อนนำเข้า / รีเซ็ตจุด',
        spot_count: prevSpots.length,
        spots: prevSpots,
        created_by: sanitizeText(createdBy, 32),
        created_at: now,
      },
    ]);
  }

  await db.deleteRows('spots', `branch_id=eq.${b}`);
  const rows = nextSpots.map((s) => toDbSpotRow(branchId, s));
  if (rows.length > 0) {
    await db.upsert('spots', rows, 'branch_id,id');
  }
  await db.patch('groups', `id=eq.${b}`, {
    spots_seeded: true,
    updated_at: new Date().toISOString(),
  });

  const backupRows = await db.select<DbBackupRow>(
    'spot_backups',
    `branch_id=eq.${b}&order=created_at.desc&limit=15`
  );
  return {
    spots: rows.map(fromDbSpotRow),
    backups: backupRows.map(mapBackupRow),
  };
}

export async function upsertCooldownInDb(
  db: SupabaseRestClient,
  branchId: string,
  cooldown: StoredCooldown
): Promise<void> {
  const row: DbCooldownRow = {
    branch_id: branchId,
    spot_id: sanitizeText(cooldown.spotId, 80),
    spot_name: sanitizeText(cooldown.spotName, 80) || 'จุดปูน',
    started_by: sanitizeText(cooldown.startedBy, 32),
    started_at: Number.isFinite(cooldown.startedAt) ? Number(cooldown.startedAt) : Date.now(),
    expires_at: Number(cooldown.expiresAt),
    duration_seconds: Math.max(1, Math.round(Number(cooldown.durationSeconds) || 600)),
  };
  await db.upsert('active_cooldowns', [row], 'branch_id,spot_id');
}

export async function deleteCooldownInDb(
  db: SupabaseRestClient,
  branchId: string,
  spotId: string
): Promise<void> {
  await db.deleteRows(
    'active_cooldowns',
    `branch_id=eq.${encodeURIComponent(branchId)}&spot_id=eq.${encodeURIComponent(spotId)}`
  );
}

export async function appendActivityLogInDb(
  db: SupabaseRestClient,
  branchId: string,
  entry: Omit<StoredActivityLog, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<void> {
  const now = Number.isFinite(entry.timestamp) ? Number(entry.timestamp) : Date.now();
  await db.upsert(
    'activity_logs',
    [
      {
        id: sanitizeText(entry.id, 64) || `act_${now}_${Math.random().toString(36).slice(2, 7)}`,
        branch_id: branchId,
        member_name: sanitizeText(entry.memberName, 32) || 'สมาชิก',
        action: sanitizeText(entry.action, 32) || 'spot_update',
        details: sanitizeText(entry.details, 200),
        created_at: now,
      },
    ],
    'id'
  );
}

export async function clearActivityLogsInDb(
  db: SupabaseRestClient,
  branchId: string
): Promise<void> {
  await db.deleteRows('activity_logs', `branch_id=eq.${encodeURIComponent(branchId)}`);
}
