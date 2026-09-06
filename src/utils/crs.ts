import L from 'leaflet';

/**
 * GTA V map constants matching GTALens (gtalens.com/map) and Rockstar Social Club.
 * Official tile dimension: 16384 x 24576 px at max zoom (zoom 7).
 * Tile size: 256x256.
 * Zoom 7 tile count: 64 columns x 96 rows.
 */
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

export const MAX_ZOOM = 7;
export const MIN_ZOOM = 1;

/** Leaflet LatLng bounds for the full GTA V map at maxZoom 7 */
export const MAP_BOUNDS = L.latLngBounds([-192, 0], [0, 128]);
export const MAP_MAX_BOUNDS = L.latLngBounds([-210, -15], [15, 145]);

export const customGTA_CRS: L.CRS = L.CRS.Simple;

/**
 * Convert GTA V in-game coordinates (x, y) to Leaflet LatLng.
 * Matching the exact formula used by GTALens:
 *   px = ((gameX - minX) / (maxX - minX)) * mapWidth
 *   py = ((maxY - gameY) / (maxY - minY)) * mapHeight
 *   lng = px / (2 ^ maxZoom) = px / 128
 *   lat = -py / (2 ^ maxZoom) = -py / 128
 */
export function gameCoordsToLatLng(gameX: number, gameY: number): L.LatLng {
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
  return L.latLng(lat, lng);
}

/**
 * Convert Leaflet LatLng to GTA V in-game coordinates { x, y }
 */
export function latLngToGameCoords(latLng: L.LatLng): { x: number; y: number } {
  if (!latLng || !Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) {
    return { x: 0, y: 0 };
  }

  const px = latLng.lng * 128;
  const py = -latLng.lat * 128;

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

/**
 * Calculate Euclidean distance in GTA V game units (meters)
 */
export function calculateGameDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.round(Math.hypot(dx, dy));
}
