export type SpotCategory = string;

export interface SpotCategoryInfo {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  group?: string;
}

export interface CementSpot {
  id: string;
  name: string;
  category: SpotCategory;
  x: number;
  y: number;
  z?: number;
  postal?: string;
  cooldownMinutes?: number;
  yieldDescription?: string;   // เช่น "ปูนซีเมนต์ 5-10 ถุง"
  requiredItems?: string[];    // เช่น ["พลั่ว", "ถุงกระสอบ"]
  notes?: string;
  color?: string;
  icon?: string;               // เช่น "🧱", "👑", "⭐", "🚗"
  createdAt: number;
  updatedAt: number;
}

export interface ActiveCooldown {
  spotId: string;
  startedAt: number;
  expiresAt: number;
  durationSeconds: number;
}

export type MapTileLayer = 'gtalens_game' | 'gtalens_satellite' | 'gtalens_print';

export interface MapLayerConfig {
  id: MapTileLayer;
  name: string;
  description: string;
  url: string;
  tms: boolean;
  minZoom: number;
  maxZoom: number;
  bgColor: string;
  className?: string;
}
