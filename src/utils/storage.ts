import type { CementSpot, ActiveCooldown } from '../types/map';
import { DEFAULT_SPOTS } from '../data/defaultSpots.ts';
import { normalizeGangId } from './gangAuth.ts';
import { isImageIconString, sanitizeIconUrl } from './html.ts';

const DEFAULT_BRANCH_ID = 'branch_1';

function resolveNormBranch(gangId?: string): string {
  return gangId ? normalizeGangId(gangId) : DEFAULT_BRANCH_ID;
}

export function getSpotsKey(gangId?: string): string {
  return `fivem_cement_spots_${resolveNormBranch(gangId)}_v7`;
}

export function getCooldownsKey(gangId?: string): string {
  return `fivem_cement_cooldowns_${resolveNormBranch(gangId)}_v7`;
}

function escapeLuaString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

export function loadSpotsFromStorage(gangId?: string): CementSpot[] | null {
  try {
    const key = getSpotsKey(gangId);
    const officialSpotIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    const raw = localStorage.getItem(key);

    if (!raw) {
      const v6Raw = localStorage.getItem('fivem_cement_spots_v6');
      if (v6Raw) {
        try {
          const v6Parsed = JSON.parse(v6Raw);
          if (Array.isArray(v6Parsed)) {
            const customSpots = v6Parsed.filter(
              (s: CementSpot) => s && typeof s.id === 'string' && !officialSpotIds.has(s.id)
            );
            const merged = [...DEFAULT_SPOTS, ...customSpots];
            localStorage.setItem(key, JSON.stringify(merged));
            return merged;
          }
        } catch {
          // Ignore malformed legacy storage
        }
      }
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const existingMap = new Map<string, CementSpot>();
    for (const item of parsed) {
      if (item && typeof item.id === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y)) {
        existingMap.set(item.id, item as CementSpot);
      }
    }

    let modified = existingMap.size !== parsed.length;
    for (const defSpot of DEFAULT_SPOTS) {
      const existing = existingMap.get(defSpot.id);
      if (!existing) {
        existingMap.set(defSpot.id, defSpot);
        modified = true;
      } else if (existing.category !== defSpot.category || existing.icon !== defSpot.icon) {
        existingMap.set(defSpot.id, {
          ...existing,
          category: defSpot.category,
          icon: defSpot.icon,
        });
        modified = true;
      }
    }

    const processed = Array.from(existingMap.values());
    if (modified) {
      localStorage.setItem(key, JSON.stringify(processed));
    }
    return processed;
  } catch (err) {
    console.error('Failed to load spots from storage:', err);
  }
  return null;
}

const BACKUP_STORAGE_KEY = 'fivem_map_auto_backups_v1';

export interface SpotBackupSnapshot {
  id: string;
  timestamp: number;
  dateStr: string;
  spotsCount: number;
  spots: CementSpot[];
}

export function saveBackupSnapshot(spots: CementSpot[], gangId?: string): void {
  try {
    if (!spots || spots.length === 0) return;
    const norm = resolveNormBranch(gangId);
    const backupKey = `${BACKUP_STORAGE_KEY}_${norm}`;
    const raw = localStorage.getItem(backupKey);
    const backups: SpotBackupSnapshot[] = raw ? JSON.parse(raw) : [];

    const last = backups[0];
    if (last && last.spotsCount === spots.length && Date.now() - last.timestamp < 30000) {
      return;
    }

    const newSnapshot: SpotBackupSnapshot = {
      id: `backup_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('th-TH'),
      spotsCount: spots.length,
      spots,
    };

    const updated = [newSnapshot, ...backups].slice(0, 15);
    localStorage.setItem(backupKey, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save backup snapshot:', err);
  }
}

export function getBackupSnapshots(gangId?: string): SpotBackupSnapshot[] {
  try {
    const norm = resolveNormBranch(gangId);
    const backupKey = `${BACKUP_STORAGE_KEY}_${norm}`;
    const raw = localStorage.getItem(backupKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function restoreBackupSnapshot(id: string, gangId?: string): CementSpot[] | null {
  try {
    const backups = getBackupSnapshots(gangId);
    const target = backups.find((b) => b.id === id);
    if (target && Array.isArray(target.spots) && target.spots.length > 0) {
      saveSpotsToStorage(target.spots, gangId);
      return target.spots;
    }
  } catch (err) {
    console.error('Failed to restore backup snapshot:', err);
  }
  return null;
}

export function saveSpotsToStorage(spots: CementSpot[], gangId?: string): void {
  try {
    const key = getSpotsKey(gangId);
    localStorage.setItem(key, JSON.stringify(spots));
    saveBackupSnapshot(spots, gangId);
  } catch (err) {
    console.error('Failed to save spots to storage:', err);
  }
}

export function clearAllSpotsFromStorage(gangId?: string): void {
  try {
    const key = getSpotsKey(gangId);
    const cdKey = getCooldownsKey(gangId);
    localStorage.removeItem(key);
    localStorage.removeItem(cdKey);
  } catch (err) {
    console.error('Failed to clear spots from storage:', err);
  }
}

export function loadCooldownsFromStorage(gangId?: string): ActiveCooldown[] {
  try {
    const key = getCooldownsKey(gangId);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const v6Raw = localStorage.getItem('fivem_cement_cooldowns_v6');
      if (v6Raw) {
        localStorage.setItem(key, v6Raw);
        raw = v6Raw;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      // Keep only cooldowns that are still active or recently expired
      return parsed.filter((c: ActiveCooldown) => c.expiresAt > now - 60000);
    }
  } catch (err) {
    console.error('Failed to load cooldowns from storage:', err);
  }
  return [];
}

export function saveCooldownsToStorage(cooldowns: ActiveCooldown[], gangId?: string): void {
  try {
    const key = getCooldownsKey(gangId);
    localStorage.setItem(key, JSON.stringify(cooldowns));
  } catch (err) {
    console.error('Failed to save cooldowns to storage:', err);
  }
}

export function exportSpotsToJSON(spots: CementSpot[], filename = 'fivem_cement_spots.json'): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(spots, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function parseImportedSpots(jsonString: string): CementSpot[] {
  const parsed = JSON.parse(jsonString);
  if (!Array.isArray(parsed)) {
    throw new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง (ต้องเป็น Array ของหมุด)');
  }
  return parsed.map((rawItem, index) => {
    const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`หมุดลำดับที่ ${index + 1} ไม่มีพิกัด X หรือ Y ที่ถูกต้อง`);
    }

    const rawName = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `จุดปูน #${index + 1}`;
    const rawZ = Number(item.z);
    const rawCooldown = Number(item.cooldownMinutes);
    const rawIcon = typeof item.icon === 'string' ? item.icon.trim() : undefined;
    const safeIcon = rawIcon
      ? isImageIconString(rawIcon)
        ? sanitizeIconUrl(rawIcon)
        : rawIcon.slice(0, 16)
      : undefined;

    const tags = Array.isArray(item.tags)
      ? item.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
      : undefined;

    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `spot-${Date.now()}-${index}`,
      name: rawName.slice(0, 80),
      category:
        typeof item.category === 'string' && item.category.trim()
          ? item.category.trim()
          : rawName === 'ปูน'
            ? 'cement_mine'
            : 'landmark',
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      z: Number.isFinite(rawZ) ? Math.round(rawZ * 10) / 10 : 30.0,
      postal: typeof item.postal === 'string' ? item.postal.trim().slice(0, 24) : '',
      cooldownMinutes:
        Number.isFinite(rawCooldown) && rawCooldown >= 0
          ? Math.min(60, Math.round(rawCooldown))
          : 10,
      yieldDescription: typeof item.yieldDescription === 'string' ? item.yieldDescription.trim() : '',
      requiredItems: Array.isArray(item.requiredItems)
        ? item.requiredItems.filter((r): r is string => typeof r === 'string')
        : [],
      notes: typeof item.notes === 'string' ? item.notes.trim() : '',
      color: typeof item.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(item.color.trim())
        ? item.color.trim()
        : '#f59e0b',
      icon: safeIcon,
      tags: tags && tags.length > 0 ? tags : undefined,
      createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    };
  });
}

export function formatFiveMCommand(spot: CementSpot): string {
  const z = spot.z !== undefined ? spot.z.toFixed(1) : '30.0';
  return `/tp ${spot.x.toFixed(1)} ${spot.y.toFixed(1)} ${z}`;
}

export function formatFiveMVector(spot: CementSpot): string {
  const z = spot.z !== undefined ? spot.z.toFixed(2) : '30.0';
  return `vec3(${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${z})`;
}

export function formatFiveMLuaTable(spots: CementSpot[]): string {
  const lines = [
    '-- FiveM Cement Spots Configuration',
    '-- Generated by FiveM Cement Map Tracker',
    'Config = Config or {}',
    'Config.CementSpots = {',
  ];

  spots.forEach((spot) => {
    const z = spot.z !== undefined ? spot.z.toFixed(2) : '30.0';
    lines.push(`    {`);
    lines.push(`        name = "${escapeLuaString(spot.name)}",`);
    lines.push(`        category = "${escapeLuaString(spot.category || 'landmark')}",`);
    lines.push(`        coords = vector3(${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${z}),`);
    if (spot.postal) lines.push(`        postal = "${escapeLuaString(spot.postal)}",`);
    if (spot.cooldownMinutes) lines.push(`        cooldown = ${spot.cooldownMinutes * 60}, -- seconds`);
    lines.push(`    },`);
  });

  lines.push('}');
  return lines.join('\n');
}
