import type { CementSpot, ActiveCooldown } from '../types/map';
import { DEFAULT_SPOTS } from '../data/defaultSpots';

const SPOTS_STORAGE_KEY = 'fivem_cement_spots_v6';
const COOLDOWNS_STORAGE_KEY = 'fivem_cement_cooldowns_v6';

export function loadSpotsFromStorage(): CementSpot[] | null {
  try {
    // Clean up older version keys if present
    localStorage.removeItem('fivem_cement_spots_v1');
    localStorage.removeItem('fivem_cement_spots_v2');
    localStorage.removeItem('fivem_cement_spots_v3');
    localStorage.removeItem('fivem_cement_spots_v4');
    localStorage.removeItem('fivem_farm_spots_clean_v1');
    localStorage.removeItem('fivem_farm_cooldowns_v1');
    localStorage.removeItem('fivem_farm_loops_v1');

    const officialSpotIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    let raw = localStorage.getItem(SPOTS_STORAGE_KEY);

    // If upgrading to v6: automatically merge latest DEFAULT_SPOTS with any custom spots created by user!
    if (!raw) {
      const v5Raw = localStorage.getItem('fivem_cement_spots_v5');
      if (v5Raw) {
        try {
          const v5Parsed = JSON.parse(v5Raw) as CementSpot[];
          const customSpots = v5Parsed.filter((s) => !officialSpotIds.has(s.id));
          const merged = [...DEFAULT_SPOTS, ...customSpots];
          localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(merged));
          localStorage.removeItem('fivem_cement_spots_v5');
          return merged;
        } catch {}
      }
      return null;
    }

    const parsed = JSON.parse(raw);
    const existingMap = new Map<string, CementSpot>(parsed.map((s: CementSpot) => [s.id, s]));

    // Ensure all official DEFAULT_SPOTS are present and up to date
    let modified = false;
    DEFAULT_SPOTS.forEach((defSpot) => {
      const existing = existingMap.get(defSpot.id);
      if (!existing) {
        existingMap.set(defSpot.id, defSpot);
        modified = true;
      } else {
        // ซิงค์หมวดหมู่และไอคอนทางการให้ตรงกับส่วนกลางล่าสุดเสมอ
        if (existing.category !== defSpot.category || existing.icon !== defSpot.icon) {
          existing.category = defSpot.category;
          existing.icon = defSpot.icon;
          modified = true;
        }
      }
    });

    const ORIGINAL_LAN_SPOTS: Record<string, { name: string; icon: string; color: string }> = {
      'spot-1789097466769': { name: 'แลนน้ำตาล', icon: '/blips/radar_player_king_brown.png', color: '#b45309' },
      'spot-1789097316804': { name: 'แลนส้ม', icon: '/blips/radar_player_king_orange.png', color: '#f59e0b' },
      'spot-1789097276171': { name: 'แลนม่วง', icon: '/blips/radar_player_king_purple.png', color: '#a855f7' },
      'spot-1789096983908': { name: 'แลนเหลือง', icon: '/blips/radar_player_king_yellow.png', color: '#eab308' },
      'spot-1789096945374': { name: 'แลนขาว', icon: '/blips/radar_player_king_white.png', color: '#ffffff' },
      'spot-1789096643659': { name: 'แลนแดง', icon: '/blips/radar_player_king_red.png', color: '#ef4444' },
      'spot-1789096538636': { name: 'แลนชมพู', icon: '/blips/radar_player_king_pink.png', color: '#ec4899' },
      'spot-1789096402896': { name: 'แลนเขียว', icon: '/blips/radar_player_king_green.png', color: '#22c55e' },
      'spot-1789096384446': { name: 'แลนมิ้น', icon: '/blips/radar_player_king_mint.png', color: '#2dd4bf' },
      'spot-1789096326164': { name: 'แลนน้ำเงิน', icon: '/blips/radar_player_king_blue.png', color: '#3b82f6' },
      'spot-1789096309666': { name: 'แลนฟ้า', icon: '/blips/radar_player_king_cyan.png', color: '#06b6d4' },
    };

    const processed = Array.from(existingMap.values()).map((item: CementSpot) => {
      const current = { ...item };
      // คืนค่าจุดแลนทั้ง 11 จุดให้กลับเป็นชื่อและไอคอนเดิมอย่างแน่นอน
      if (ORIGINAL_LAN_SPOTS[current.id]) {
        const orig = ORIGINAL_LAN_SPOTS[current.id];
        if (current.name !== orig.name || current.icon !== orig.icon || current.color !== orig.color) {
          current.name = orig.name;
          current.icon = orig.icon;
          current.color = orig.color;
          current.category = 'landmark';
          current.notes = '';
          delete current.tags;
          modified = true;
        }
      }
      return current;
    });

    if (modified) {
      localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(processed));
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

export function saveBackupSnapshot(spots: CementSpot[]): void {
  try {
    if (!spots || spots.length === 0) return;
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
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
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save backup snapshot:', err);
  }
}

export function getBackupSnapshots(): SpotBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function restoreBackupSnapshot(id: string): CementSpot[] | null {
  try {
    const backups = getBackupSnapshots();
    const target = backups.find((b) => b.id === id);
    if (target && Array.isArray(target.spots) && target.spots.length > 0) {
      saveSpotsToStorage(target.spots);
      return target.spots;
    }
  } catch (err) {
    console.error('Failed to restore backup snapshot:', err);
  }
  return null;
}

export function saveSpotsToStorage(spots: CementSpot[]): void {
  try {
    localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(spots));
    saveBackupSnapshot(spots);
  } catch (err) {
    console.error('Failed to save spots to storage:', err);
  }
}

export function clearAllSpotsFromStorage(): void {
  try {
    localStorage.removeItem(SPOTS_STORAGE_KEY);
    localStorage.removeItem(COOLDOWNS_STORAGE_KEY);
    localStorage.removeItem('fivem_cement_spots_v1');
    localStorage.removeItem('fivem_cement_spots_v2');
    localStorage.removeItem('fivem_cement_spots_v3');
    localStorage.removeItem('fivem_cement_spots_v4');
    localStorage.removeItem('fivem_cement_spots_v5');
    localStorage.removeItem('fivem_cement_cooldowns_v5');
  } catch (err) {
    console.error('Failed to clear spots from storage:', err);
  }
}

export function loadCooldownsFromStorage(): ActiveCooldown[] {
  try {
    let raw = localStorage.getItem(COOLDOWNS_STORAGE_KEY);
    if (!raw) {
      const v5Raw = localStorage.getItem('fivem_cement_cooldowns_v5');
      if (v5Raw) {
        localStorage.setItem(COOLDOWNS_STORAGE_KEY, v5Raw);
        localStorage.removeItem('fivem_cement_cooldowns_v5');
        raw = v5Raw;
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

export function saveCooldownsToStorage(cooldowns: ActiveCooldown[]): void {
  try {
    localStorage.setItem(COOLDOWNS_STORAGE_KEY, JSON.stringify(cooldowns));
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
  return parsed.map((item, index) => {
    if (typeof item.x !== 'number' || typeof item.y !== 'number') {
      throw new Error(`หมุดลำดับที่ ${index + 1} ไม่มีพิกัด X หรือ Y ที่ถูกต้อง`);
    }
    return {
      id: item.id || `spot-${Date.now()}-${index}`,
      name: item.name || `จุดปูน #${index + 1}`,
      category: item.category || (item.name?.trim() === 'ปูน' ? 'cement_mine' : 'landmark'),
      x: item.x,
      y: item.y,
      z: item.z ?? 30.0,
      postal: item.postal || '',
      cooldownMinutes: item.cooldownMinutes ?? 10,
      yieldDescription: item.yieldDescription || '',
      requiredItems: Array.isArray(item.requiredItems) ? item.requiredItems : [],
      notes: item.notes || '',
      color: item.color || '#f59e0b',
      icon: item.icon || undefined,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
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
    lines.push(`        name = "${spot.name}",`);
    lines.push(`        category = "${spot.category}",`);
    lines.push(`        coords = vector3(${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${z}),`);
    if (spot.postal) lines.push(`        postal = "${spot.postal}",`);
    if (spot.cooldownMinutes) lines.push(`        cooldown = ${spot.cooldownMinutes * 60}, -- seconds`);
    lines.push(`    },`);
  });

  lines.push('}');
  return lines.join('\n');
}
