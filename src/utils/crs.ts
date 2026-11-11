import L from 'leaflet';
import {
  gameCoordsToLatLngTuple,
  latLngTupleToGameCoords,
  GTA5_BOUNDS,
  GTA5_MAP_SIZE,
  MAX_NATIVE_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  calculateGameDistance,
  parseFiveMCoords,
} from './crsMath.ts';

export {
  GTA5_BOUNDS,
  GTA5_MAP_SIZE,
  MAX_NATIVE_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  calculateGameDistance,
  parseFiveMCoords,
};

/** Leaflet LatLng bounds for the full GTA V map at maxZoom 7 */
export const MAP_BOUNDS = L.latLngBounds([-192, 0], [0, 128]);
export const MAP_MAX_BOUNDS = L.latLngBounds([-210, -15], [15, 145]);

export const customGTA_CRS: L.CRS = L.CRS.Simple;

export function gameCoordsToLatLng(gameX: number, gameY: number): L.LatLng {
  const [lat, lng] = gameCoordsToLatLngTuple(gameX, gameY);
  return L.latLng(lat, lng);
}

export function latLngToGameCoords(latLng: L.LatLng): { x: number; y: number } {
  if (!latLng) return { x: 0, y: 0 };
  return latLngTupleToGameCoords(latLng.lat, latLng.lng);
}
