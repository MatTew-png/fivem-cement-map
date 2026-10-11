import type { CementSpot } from '../types/map';

/**
 * แปลงหมุดให้อยู่ในฟอร์แมต JSON ที่ตรงกับ src/data/fivemSpots.json ในโปรเจกต์ epic-euclid
 */
export function formatSpotToEuclidObject(spot: CementSpot) {
  return {
    id: spot.id,
    name: spot.name,
    category: spot.category || 'other',
    icon: spot.icon || '/blips/radar_destination.png',
    color: spot.color || '#eab308',
    x: Number(spot.x.toFixed(1)),
    y: Number(spot.y.toFixed(1)),
    z: Number((spot.z ?? 30).toFixed(1)),
    postal: spot.postal || '',
    cooldownMinutes: spot.cooldownMinutes ?? 10,
    yieldDescription: spot.yieldDescription || '',
    requiredItems: spot.requiredItems || [],
    notes: spot.notes || '',
    createdAt: spot.createdAt || Date.now(),
    updatedAt: spot.updatedAt || Date.now(),
  };
}

/**
 * แปลงรายการหมุดทั้งหมดเป็น JSON String สำหรับ fivemSpots.json ของ epic-euclid
 */
export function formatSpotsToEuclidJSON(spots: CementSpot[]): string {
  const formatted = spots.map(formatSpotToEuclidObject);
  return JSON.stringify(formatted, null, 2);
}

/**
 * แปลงหมุดให้อยู่ในรูปแบบ Record/Object สำหรับ spotsData ใน map.astro ของ epic-euclid
 */
export function formatSpotsToAstroRecord(spots: CementSpot[]): string {
  const lines: string[] = ['// === วางใน const spotsData: Record<string, any> = { ... } ใน map.astro ==='];

  spots.forEach((spot) => {
    const safeKey = spot.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const zVal = (spot.z ?? 30).toFixed(1);
    const coordsStr = `X: ${spot.x.toFixed(1)}, Y: ${spot.y.toFixed(1)}, Z: ${zVal}`;
    const zoneStr = spot.postal ? `POSTAL: ${spot.postal} · COOLDOWN: ${spot.cooldownMinutes ?? 10} MIN` : `COOLDOWN: ${spot.cooldownMinutes ?? 10} MIN`;
    const label = spot.name;

    lines.push(`  '${safeKey}': {`);
    lines.push(`    id: '${spot.id}',`);
    lines.push(`    title: '${spot.name.replace(/'/g, "\\'")}',`);
    lines.push(`    desc: '${(spot.notes || spot.yieldDescription || spot.name).replace(/'/g, "\\'")}',`);
    lines.push(`    coords: '${coordsStr}',`);
    lines.push(`    zone: '${zoneStr}',`);
    lines.push(`    x: ${spot.x.toFixed(1)}, y: ${spot.y.toFixed(1)},`);
    lines.push(`    status: 'ONLINE 🟢',`);
    lines.push(`    statusClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',`);
    lines.push(`    group: '${spot.category || 'general'}',`);
    lines.push(`    color: '${spot.color || '#f59e0b'}',`);
    lines.push(`    icon: '${spot.icon || '📍'}',`);
    lines.push(`    label: '${label.replace(/'/g, "\\'")}',`);
    lines.push(`    cdMinutes: ${spot.cooldownMinutes ?? 10}`);
    lines.push(`  },`);
  });

  return lines.join('\n');
}

/**
 * แปลงพิกัดเป็น FiveM vector3
 */
export function formatSpotToVector3(spot: CementSpot): string {
  const z = (spot.z ?? 30).toFixed(1);
  return `vector3(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}, ${z})`;
}

/**
 * คัดลอกข้อความไปยังคลิปบอร์ดพร้อม fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
