import L from 'leaflet';
import type { CementSpot, ActiveCooldown } from '../types/map';
import { isCementSpot } from '../data/defaultSpots';
import { gameCoordsToLatLng } from './crs';

export type QuickCategory = 'cement' | 'lands' | 'fuel' | 'services';

export function getSpotQuickCategory(spot: CementSpot): QuickCategory {
  if (isCementSpot(spot)) return 'cement';
  if (spot.name.startsWith('แลน') || (spot.icon && spot.icon.includes('player_king'))) return 'lands';
  if (spot.name.includes('น้ำมัน') || (spot.icon && spot.icon.includes('jerry_can'))) return 'fuel';
  return 'services';
}

export interface ClusterItem {
  id: string;
  isCluster: boolean;
  latlng: L.LatLng;
  spots: CementSpot[];
  hasActiveCooldown: boolean;
  urgentCooldown: boolean;
}

/**
 * Deterministic spatial cluster calculation for GTA V map in L.CRS.Simple
 */
export function computeClusters(
  map: L.Map,
  spots: CementSpot[],
  zoom: number,
  activeCooldowns: ActiveCooldown[],
  selectedSpotId?: string | null,
  isClusteringEnabled = true
): ClusterItem[] {
  const now = Date.now();

  if (!isClusteringEnabled || spots.length <= 1) {
    return spots.map((spot) => {
      const activeCd = activeCooldowns.find((c) => c.spotId === spot.id);
      const rem = activeCd ? Math.max(0, Math.floor((activeCd.expiresAt - now) / 1000)) : -1;
      return {
        id: spot.id,
        isCluster: false,
        latlng: gameCoordsToLatLng(spot.x, spot.y),
        spots: [spot],
        hasActiveCooldown: !!activeCd && rem > 0,
        urgentCooldown: rem > 0 && rem <= 180,
      };
    });
  }

  // Pixel radius on screen for grouping
  let clusterRadiusPx = 50;
  if (zoom <= 3) clusterRadiusPx = 60;
  else if (zoom <= 5) clusterRadiusPx = 48;
  else if (zoom <= 7) clusterRadiusPx = 36;
  else if (zoom <= 8) clusterRadiusPx = 24;
  else clusterRadiusPx = 10;

  // Spots that should never be clustered into a group:
  // 1. Currently selected spot (must always be prominent)
  // 2. Active cooldown or ready spots (must always be prominent with floating timer badge)
  const isExcludedFromCluster = (spot: CementSpot) => {
    if (selectedSpotId && spot.id === selectedSpotId) return true;
    const cd = activeCooldowns.find((c) => c.spotId === spot.id);
    if (cd) {
      const rem = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
      if (rem >= 0) return true;
    }
    return false;
  };

  const isolatedSpots: ClusterItem[] = [];
  const clusterableSpots: Array<{
    spot: CementSpot;
    latlng: L.LatLng;
    pt: L.Point;
    hasCd: boolean;
    isUrgent: boolean;
  }> = [];

  spots.forEach((spot) => {
    const latlng = gameCoordsToLatLng(spot.x, spot.y);
    const cd = activeCooldowns.find((c) => c.spotId === spot.id);
    const rem = cd ? Math.max(0, Math.floor((cd.expiresAt - now) / 1000)) : -1;
    const hasCd = rem > 0;
    const isUrgent = rem > 0 && rem <= 180;

    if (isExcludedFromCluster(spot)) {
      isolatedSpots.push({
        id: spot.id,
        isCluster: false,
        latlng,
        spots: [spot],
        hasActiveCooldown: hasCd,
        urgentCooldown: isUrgent,
      });
    } else {
      clusterableSpots.push({
        spot,
        latlng,
        pt: map.project(latlng, zoom),
        hasCd,
        isUrgent,
      });
    }
  });

  const clusters: ClusterItem[] = [...isolatedSpots];
  const visited = new Set<string>();

  for (let i = 0; i < clusterableSpots.length; i++) {
    const p1 = clusterableSpots[i];
    if (visited.has(p1.spot.id)) continue;
    visited.add(p1.spot.id);

    const groupSpots: CementSpot[] = [p1.spot];
    let totalLat = p1.latlng.lat;
    let totalLng = p1.latlng.lng;
    let hasActiveCooldown = p1.hasCd;
    let urgentCooldown = p1.isUrgent;

    for (let j = i + 1; j < clusterableSpots.length; j++) {
      const p2 = clusterableSpots[j];
      if (visited.has(p2.spot.id)) continue;

      const dist = p1.pt.distanceTo(p2.pt);
      if (dist <= clusterRadiusPx) {
        visited.add(p2.spot.id);
        groupSpots.push(p2.spot);
        totalLat += p2.latlng.lat;
        totalLng += p2.latlng.lng;
        if (p2.hasCd) hasActiveCooldown = true;
        if (p2.isUrgent) urgentCooldown = true;
      }
    }

    if (groupSpots.length === 1) {
      clusters.push({
        id: p1.spot.id,
        isCluster: false,
        latlng: p1.latlng,
        spots: groupSpots,
        hasActiveCooldown,
        urgentCooldown,
      });
    } else {
      const count = groupSpots.length;
      const clusterId = `cluster-${groupSpots.map((s) => s.id).sort().join('_')}`;
      clusters.push({
        id: clusterId,
        isCluster: true,
        latlng: L.latLng(totalLat / count, totalLng / count),
        spots: groupSpots,
        hasActiveCooldown,
        urgentCooldown,
      });
    }
  }

  return clusters;
}

/**
 * Create a cyberpunk / GTA Radar styled cluster DivIcon
 */
export function createClusterDivIcon(cluster: ClusterItem): L.DivIcon {
  const count = cluster.spots.length;
  const hasUrgent = cluster.urgentCooldown;
  const hasCd = cluster.hasActiveCooldown;

  let cementCount = 0;
  let landsCount = 0;
  let fuelCount = 0;
  let servicesCount = 0;

  cluster.spots.forEach((s) => {
    const cat = getSpotQuickCategory(s);
    if (cat === 'cement') cementCount++;
    else if (cat === 'lands') landsCount++;
    else if (cat === 'fuel') fuelCount++;
    else servicesCount++;
  });

  const size = count >= 50 ? 46 : count >= 15 ? 40 : 34;
  const half = Math.floor(size / 2);

  let iconEmoji = '🧱';
  let borderColor = 'border-amber-400';
  let bgGradient = 'from-amber-950/90 to-slate-900/95';
  let textColor = 'text-amber-300';
  let glowColor = 'rgba(245, 158, 11, 0.45)';

  if (hasUrgent) {
    iconEmoji = '🔥';
    borderColor = 'border-red-500 animate-pulse';
    bgGradient = 'from-red-950/95 to-slate-900/95';
    textColor = 'text-red-400';
    glowColor = 'rgba(239, 68, 68, 0.7)';
  } else if (hasCd) {
    iconEmoji = '⏰';
    borderColor = 'border-amber-300';
    bgGradient = 'from-amber-950/90 to-slate-900/95';
    textColor = 'text-amber-200';
    glowColor = 'rgba(245, 158, 11, 0.6)';
  } else if (landsCount > cementCount && landsCount >= fuelCount) {
    iconEmoji = '👑';
    borderColor = 'border-indigo-400';
    bgGradient = 'from-indigo-950/90 to-slate-900/95';
    textColor = 'text-indigo-300';
    glowColor = 'rgba(129, 140, 248, 0.45)';
  } else if (fuelCount > cementCount) {
    iconEmoji = '⛽';
    borderColor = 'border-cyan-400';
    bgGradient = 'from-cyan-950/90 to-slate-900/95';
    textColor = 'text-cyan-300';
    glowColor = 'rgba(34, 211, 238, 0.45)';
  } else if (servicesCount > cementCount) {
    iconEmoji = '🏥';
    borderColor = 'border-emerald-400';
    bgGradient = 'from-emerald-950/90 to-slate-900/95';
    textColor = 'text-emerald-300';
    glowColor = 'rgba(52, 211, 153, 0.45)';
  }

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer select-none transition-transform hover:scale-110 active:scale-95" style="width: ${size}px; height: ${size}px;">
      ${hasUrgent ? '<div class="absolute -inset-1 rounded-full bg-red-500/40 animate-ping pointer-events-none"></div>' : ''}
      <div class="w-full h-full rounded-full bg-gradient-to-br ${bgGradient} border-2 ${borderColor} shadow-xl flex flex-col items-center justify-center p-0.5" style="box-shadow: 0 0 14px ${glowColor};">
        <span class="text-[8px] leading-none mb-0.5 select-none">${iconEmoji}</span>
        <span class="font-mono font-black text-xs ${textColor} leading-none tracking-tight select-none">${count}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'magic-cluster-marker',
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}
