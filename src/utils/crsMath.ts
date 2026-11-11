export const GTA5_MAP_SIZE = {
  width: 16384,
  height: 24576,
} as const;

export const GTA5_BOUNDS = {
  minX: -4140,
  maxX: 4860,
  minY: -5100,
  maxY: 8400,
} as const;

export const MAX_ZOOM = 10;
export const MAX_NATIVE_ZOOM = 7;
export const MIN_ZOOM = 1;

export function gameCoordsToLatLngTuple(gameX: number, gameY: number): [number, number] {
  const safeX = typeof gameX === 'number' && Number.isFinite(gameX) ? gameX : 0;
  const safeY = typeof gameY === 'number' && Number.isFinite(gameY) ? gameY : 0;

  const px =
    ((safeX - GTA5_BOUNDS.minX) / (GTA5_BOUNDS.maxX - GTA5_BOUNDS.minX)) *
    GTA5_MAP_SIZE.width;
  const py =
    ((GTA5_BOUNDS.maxY - safeY) / (GTA5_BOUNDS.maxY - GTA5_BOUNDS.minY)) *
    GTA5_MAP_SIZE.height;

  const lng = px / 128;
  const lat = -py / 128;
  return [lat, lng];
}

export function latLngTupleToGameCoords(lat: number, lng: number): { x: number; y: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { x: 0, y: 0 };
  }

  const px = lng * 128;
  const py = -lat * 128;

  const x =
    GTA5_BOUNDS.minX +
    (px / GTA5_MAP_SIZE.width) * (GTA5_BOUNDS.maxX - GTA5_BOUNDS.minX);
  const y =
    GTA5_BOUNDS.maxY -
    (py / GTA5_MAP_SIZE.height) * (GTA5_BOUNDS.maxY - GTA5_BOUNDS.minY);

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

export function calculateGameDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.round(Math.hypot(dx, dy));
}

export function parseFiveMCoords(input: string): { x: number; y: number; z: number } | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  const namedMatch = str.match(
    /x\s*[:=]\s*([-+]?(?:\d+\.?\d*|\.\d+))[,\s]+y\s*[:=]\s*([-+]?(?:\d+\.?\d*|\.\d+))(?:[,\s]+z\s*[:=]\s*([-+]?(?:\d+\.?\d*|\.\d+)))?/i
  );
  if (namedMatch) {
    const x = parseFloat(namedMatch[1]);
    const y = parseFloat(namedMatch[2]);
    const z = namedMatch[3] ? parseFloat(namedMatch[3]) : 30.0;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        z: Math.round((Number.isFinite(z) ? z : 30.0) * 10) / 10,
      };
    }
  }

  const clean = str
    .replace(/(?:vector[34]|vec3|\/tp)/gi, '')
    .replace(/[()[\]{}]/g, ' ')
    .trim();

  const numbers = clean.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g);
  if (numbers && numbers.length >= 2) {
    const x = parseFloat(numbers[0]);
    const y = parseFloat(numbers[1]);
    const z = numbers.length >= 3 ? parseFloat(numbers[2]) : 30.0;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        z: Math.round((Number.isFinite(z) ? z : 30.0) * 10) / 10,
      };
    }
  }

  return null;
}
