import { useEffect, useRef, useState, memo } from 'react';
import L from 'leaflet';
import {
  customGTA_CRS,
  gameCoordsToLatLng,
  latLngToGameCoords,
  calculateGameDistance,
  MAP_BOUNDS,
  MAP_MAX_BOUNDS,
} from '../utils/crs';
import type { CementSpot, MapTileLayer, ActiveCooldown, DistancePoint, RoutingMode, TacticalPing } from '../types/map';
import { MAP_LAYERS } from '../data/defaultSpots';
import { soundEffects } from '../utils/sound';
import { coordsBus } from '../utils/coordsBus';
import { escapeHtml } from '../utils/html';
import { getSpotCategoryInfo, isCementSpot } from '../utils/spotCategories';
import { renderSpotIconHtml } from '../utils/spotIcons';
import { computeClusters, createClusterDivIcon, type ClusterItem } from '../utils/clustering';

interface MapViewProps {
  spots: CementSpot[];
  activeLayer: MapTileLayer;
  activeCooldowns: ActiveCooldown[];
  onMapClickToCreatePin: (coords: { x: number; y: number }) => void;
  onCursorMove?: (coords: { x: number; y: number } | null) => void;
  onCenterCoordsChange?: (coords: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onEditSpot: (spot: CementSpot) => void;
  onDeleteSpot: (id: string) => void;
  onStartCooldown: (spot: CementSpot, customMinutes?: number) => void;
  onCancelCooldown: (spotId: string) => void;
  onSpotMoved?: (spotId: string, newCoords: { x: number; y: number }) => void;
  selectedSpot: CementSpot | null;
  sidebarCollapsed: boolean;
  isCompactMode?: boolean;
  isGhostMode?: boolean;
  isCoordsLocked?: boolean;
  lockedCoords?: { x: number; y: number } | null;
  isDistanceMode?: boolean;
  distancePoints?: DistancePoint[];
  routingMode?: RoutingMode;
  roadRouteData?: {
    fullPath: { x: number; y: number }[];
    totalDistance: number;
    segmentDistances: number[];
  } | null;
  onAddDistancePoint?: (point: DistancePoint) => void;
  onStartMeasureFromSpot?: (spot: CementSpot) => void;
  isMaster?: boolean;
  isClusteringEnabled?: boolean;
  onFocusSpot?: (spot: CementSpot) => void;
  onClearSelection?: () => void;
  movingSpot?: CementSpot | null;
  onStartMoveSpot?: (spot: CementSpot) => void;
  tacticalPings?: TacticalPing[];
  onSendTacticalPing?: (spot: CementSpot) => void;
  focusTargetCoords?: { x: number; y: number; key: number } | null;
}

// Helper to generate marker icon with cooldown badge
function getMarkerIcon(
  spot: CementSpot,
  isCurrentSelected: boolean,
  isCompactMode: boolean,
  isGhostMode: boolean,
  activeCd?: ActiveCooldown,
  isMovingThisSpot: boolean = false
): L.DivIcon {
  const cat = getSpotCategoryInfo(spot);
  const now = Date.now();
  const remainingSec = activeCd ? Math.max(0, Math.floor((activeCd.expiresAt - now) / 1000)) : 0;
  const isCooldown = !!activeCd && remainingSec > 0;
  const isUrgent = isCooldown && remainingSec <= 180; // <= 3 minutes (180s)
  const isReady = !!activeCd && remainingSec === 0;

  const cdMinutes = Math.floor(remainingSec / 60);
  const cdSeconds = remainingSec % 60;
  const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

  const spotIcon = spot.icon || cat?.icon || '🧱';
  const spotColor = spot.color || cat?.color || '#f59e0b';
  const safeSpotId = escapeHtml(spot.id);
  const safeSpotName = escapeHtml(spot.name);
  const safeCatName = escapeHtml(cat.name);
  const safeSpotColor = escapeHtml(spotColor);

  const ghostClass = isGhostMode && !isCurrentSelected ? 'opacity-25 pointer-events-none transition-opacity duration-200' : '';

  let markerHtml = '';
  let iconSize: [number, number] = [42, 48];
  let iconAnchor: [number, number] = [21, 48];

  if (isCompactMode) {
    iconSize = [28, 28];
    iconAnchor = [14, 14];
    markerHtml = `
      <div class="custom-compact-marker relative cursor-pointer flex items-center justify-center ${ghostClass}" data-spot-id="${safeSpotId}" style="width: 28px; height: 28px; cursor: ${isMovingThisSpot ? 'grab' : 'pointer'};">
        ${isMovingThisSpot ? `
          <div class="marker-urgent-pulse-ring pointer-events-none" style="border: 2px dashed #f59e0b; width: 36px; height: 36px; margin-top: -18px; margin-left: -18px;"></div>
        ` : isUrgent ? `
          <div class="marker-urgent-pulse-ring pointer-events-none" style="width: 34px; height: 34px; margin-top: -17px; margin-left: -17px;"></div>
          <div class="marker-urgent-pulse-ring-delayed pointer-events-none" style="width: 34px; height: 34px; margin-top: -17px; margin-left: -17px;"></div>
        ` : isReady ? `
          <div class="marker-ready-pulse-ring pointer-events-none" style="width: 34px; height: 34px; margin-top: -17px; margin-left: -17px;"></div>
        ` : isCooldown ? `
          <div class="marker-pulse-ring pointer-events-none" style="width: 34px; height: 34px; margin-top: -17px; margin-left: -17px; border: 2px solid ${safeSpotColor};"></div>
        ` : ''}
        <div 
          class="blip-sprite-inner flex items-center justify-center transition-transform duration-150 hover:scale-125 pointer-events-auto select-none"
          style="
            transform: ${isMovingThisSpot ? 'scale(1.4)' : isCurrentSelected ? 'scale(1.35)' : 'scale(1)'};
            filter: ${isMovingThisSpot ? 'drop-shadow(0 0 8px #f59e0b) drop-shadow(0 2px 5px rgba(0,0,0,0.95))' : isCurrentSelected ? 'drop-shadow(0 0 6px #ffffff) drop-shadow(0 2px 5px rgba(0,0,0,0.95))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))'};
            line-height: 1;
          "
          title="[${safeCatName}] ${safeSpotName} (${spot.x}, ${spot.y})"
        >
          ${renderSpotIconHtml(spotIcon, 'w-[24px] h-[24px]')}
        </div>
        ${isMovingThisSpot ? `
          <div class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-40 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black font-sans text-[10px] shadow-lg shadow-amber-500/80 border border-yellow-200 animate-bounce">
            <span>🧭 ย้ายพิกัด</span>
          </div>
        ` : isUrgent ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white font-mono font-black text-[10px] shadow-lg shadow-red-600/70 border border-yellow-200 animate-pulse">
            <span>🔥</span>
            <span id="marker-cd-text-${safeSpotId}">${cdTimeStr}</span>
          </div>
        ` : isReady ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold font-sans text-[10px] shadow-lg shadow-emerald-500/70 border border-emerald-300 animate-pulse">
            <span>✅ เกิดแล้ว!</span>
          </div>
        ` : isCooldown ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-amber-300 font-bold font-mono text-[10px] shadow-md border border-amber-500/50">
            <span>⏱️</span>
            <span id="marker-cd-text-${safeSpotId}">${cdTimeStr}</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    markerHtml = `
      <div class="custom-pin-marker relative cursor-pointer ${isUrgent ? 'urgent-pin-highlight' : ''} ${ghostClass}" data-spot-id="${safeSpotId}" style="width: 42px; height: 48px; cursor: ${isMovingThisSpot ? 'grab' : 'pointer'};">
        ${isMovingThisSpot ? `
          <div class="marker-urgent-pulse-ring pointer-events-none" style="border: 2px dashed #f59e0b; width: 44px; height: 44px; margin-top: -22px; margin-left: -22px;"></div>
        ` : isUrgent ? `
          <div class="marker-urgent-pulse-ring pointer-events-none"></div>
          <div class="marker-urgent-pulse-ring-delayed pointer-events-none"></div>
        ` : isReady ? `
          <div class="marker-ready-pulse-ring pointer-events-none"></div>
        ` : isCooldown ? `
          <div class="marker-pulse-ring pointer-events-none" style="border: 2px solid ${safeSpotColor};"></div>
        ` : ''}

        ${isMovingThisSpot ? `
          <div class="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-40 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black font-sans text-[10px] shadow-lg shadow-amber-500/80 border border-yellow-200 animate-bounce">
            <span>🧭 ย้ายพิกัด</span>
          </div>
        ` : isUrgent ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white font-black font-mono text-[10px] shadow-lg shadow-red-600/80 border border-yellow-200 animate-pulse">
            <span>🔥</span>
            <span id="marker-cd-text-${safeSpotId}">${cdTimeStr}</span>
          </div>
        ` : isReady ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold font-sans text-[10px] shadow-lg shadow-emerald-500/80 border border-emerald-300 animate-pulse">
            <span>✅ เกิดแล้ว!</span>
          </div>
        ` : isCooldown ? `
          <div id="marker-cd-badge-${safeSpotId}" class="marker-cd-badge pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-amber-300 font-bold font-mono text-[10px] shadow-md border border-amber-500/50">
            <span>⏱️</span>
            <span id="marker-cd-text-${safeSpotId}">${cdTimeStr}</span>
          </div>
        ` : ''}

        <div class="relative flex flex-col items-center pointer-events-auto select-none">
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl border-2 transition-transform duration-200"
            style="
              background-color: ${isUrgent ? '#ef4444' : safeSpotColor};
              border-color: ${isMovingThisSpot ? '#f59e0b' : isUrgent ? '#fde047' : isCurrentSelected ? '#ffffff' : '#0f172a'};
              transform: ${isMovingThisSpot ? 'scale(1.3)' : isCurrentSelected || isUrgent ? 'scale(1.2)' : 'scale(1)'};
              box-shadow: ${isMovingThisSpot ? '0 0 16px rgba(245, 158, 11, 0.9)' : isUrgent ? '0 0 16px rgba(239, 68, 68, 0.9)' : '0 4px 12px rgba(0,0,0,0.5)'};
              font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif;
              line-height: 1;
            "
          >
            ${renderSpotIconHtml(spotIcon, 'w-5 h-5')}
          </div>
          <div 
            class="w-0 h-0 border-x-4 border-x-transparent border-t-[6px] -mt-0.5"
            style="border-top-color: ${isUrgent ? '#ef4444' : safeSpotColor};"
          ></div>
        </div>
      </div>
    `;
  }

  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: markerHtml,
    iconSize,
    iconAnchor,
    popupAnchor: [0, -iconAnchor[1]],
  });
}

// Helper to construct interactive Leaflet popup DOM with event handlers
function createPopupNode(
  spot: CementSpot,
  activeCd: ActiveCooldown | undefined,
  callbacksRef: React.MutableRefObject<{
    onEditSpot: (spot: CementSpot) => void;
    onStartCooldown: (spot: CementSpot, customMinutes?: number) => void;
    onCancelCooldown: (spotId: string) => void;
    onStartMeasureFromSpot?: (spot: CementSpot) => void;
    onAddDistancePoint?: (point: DistancePoint) => void;
    isDistanceMode?: boolean;
    distancePoints?: DistancePoint[];
    onClearSelection?: () => void;
    onStartMoveSpot?: (spot: CementSpot) => void;
    onSendTacticalPing?: (spot: CementSpot) => void;
  }>,
  marker: L.Marker
): HTMLElement {
  const cat = getSpotCategoryInfo(spot);
  const spotIcon = spot.icon || cat?.icon || '🧱';
  const spotColor = spot.color || cat?.color || '#f59e0b';
  const safeSpotId = escapeHtml(spot.id);
  const safeSpotName = escapeHtml(spot.name);
  const safeCatName = escapeHtml(cat.name);
  const safeSpotColor = escapeHtml(spotColor);
  const safePostal = spot.postal ? escapeHtml(spot.postal) : '';
  const safeYield = spot.yieldDescription ? escapeHtml(spot.yieldDescription) : '';
  const safeNotes = spot.notes ? escapeHtml(spot.notes) : '';
  const safeTags = Array.isArray(spot.tags) ? spot.tags.map((t) => escapeHtml(t)).filter(Boolean) : [];

  const isCement = isCementSpot(spot);
  const lastUsedMins = (() => {
    try {
      const val = parseInt(localStorage.getItem('fivem_map_last_cd_mins') || '', 10);
      return Number.isFinite(val) && val > 0 && val <= 180 ? val : null;
    } catch {
      return null;
    }
  })();

  const metaHtml =
    safeYield || safeNotes || safeTags.length > 0
      ? `
      <div class="mb-2 space-y-1 text-[11px] bg-slate-950/60 border border-slate-800/80 rounded-xl px-2.5 py-2">
        ${safeYield ? `<div class="text-emerald-300 font-medium flex items-start gap-1.5"><span class="shrink-0">📦</span><span class="break-words">${safeYield}</span></div>` : ''}
        ${safeNotes ? `<div class="text-slate-300 flex items-start gap-1.5"><span class="shrink-0">📝</span><span class="break-words">${safeNotes}</span></div>` : ''}
        ${
          safeTags.length > 0
            ? `<div class="flex flex-wrap gap-1 pt-0.5">${safeTags
                .map((t) => `<span class="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono text-[9px]">#${t}</span>`)
                .join('')}</div>`
            : ''
        }
      </div>
    `
      : '';

  const actionRowHtml = `
      <div class="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/80">
        <button
          type="button"
          data-popup-action="measure"
          class="flex-1 py-1 px-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-300 hover:text-amber-200 text-[10px] font-semibold transition-colors border border-amber-500/30 flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="ตั้ง GPS นำทางจากจุดนี้"
        >
          <span>🧭</span>
          <span>GPS</span>
        </button>
        <button
          type="button"
          data-popup-action="ping-gang"
          class="flex-1 py-1 px-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 text-cyan-300 hover:text-cyan-200 text-[10px] font-semibold transition-colors border border-cyan-500/35 flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="ปิงเรียกเพื่อนในสาขาให้มาดูจุดนี้"
        >
          <span>📣</span>
          <span>ปิง</span>
        </button>
        <button
          type="button"
          data-popup-action="move-pin"
          class="flex-1 py-1 px-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-300 hover:text-amber-200 text-[10px] font-semibold transition-colors border border-amber-500/35 flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="ย้ายตำแหน่งหมุดนี้"
        >
          <span>📍</span>
          <span>ย้าย</span>
        </button>
        ${
          callbacksRef.current.isDistanceMode &&
          callbacksRef.current.distancePoints &&
          callbacksRef.current.distancePoints.length >= 1 &&
          callbacksRef.current.distancePoints[0].spotId !== spot.id
            ? `
          <button
            type="button"
            data-popup-action="nav-target"
            class="flex-1 py-1 px-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 text-cyan-300 hover:text-cyan-200 text-[10px] font-semibold transition-colors border border-cyan-500/30 flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap"
            title="ตั้งเป็นจุดหมายปลายทาง"
          >
            <span>🎯</span>
            <span>นำทาง</span>
          </button>
        `
            : ''
        }
        <button
          type="button"
          data-popup-action="edit"
          class="flex-1 py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-[10px] transition-colors border border-slate-700 flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="แก้ไขข้อมูลหมุด"
        >
          <span>✏️</span>
          <span>แก้</span>
        </button>
      </div>
  `;

  const now = Date.now();
  const remainingSec = activeCd ? Math.max(0, Math.floor((activeCd.expiresAt - now) / 1000)) : 0;
  const isCooldown = !!activeCd && remainingSec > 0;
  const isUrgent = isCooldown && remainingSec <= 180;
  const isReady = !!activeCd && remainingSec === 0;

  const cdMinutes = Math.floor(remainingSec / 60);
  const cdSeconds = remainingSec % 60;
  const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

  const popupNode = document.createElement('div');
  popupNode.className = 'p-0.5 text-slate-200 text-xs font-sans w-[250px] max-w-[82vw] max-h-[calc(100vh-140px)] overflow-y-auto';

  // Prevent map drag/click when interacting inside popup
  L.DomEvent.disableClickPropagation(popupNode);
  L.DomEvent.disableScrollPropagation(popupNode);

  if (isCooldown || isReady) {
    popupNode.innerHTML = `
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/80 mb-1.5 pr-5">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold" style="background-color: ${safeSpotColor}22; color: ${safeSpotColor}; border: 1px solid ${safeSpotColor}55;">
          ${renderSpotIconHtml(spotIcon, 'w-3.5 h-3.5')}
          <span>${safeCatName}</span>
        </span>
        ${safePostal ? `<span class="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">📮 ${safePostal}</span>` : ''}
      </div>

      <h4 class="font-bold text-sm text-white mb-2 leading-snug flex items-center gap-1.5">
        <span class="text-base flex items-center justify-center">${renderSpotIconHtml(spotIcon, 'w-5 h-5')}</span>
        <span>${safeSpotName}</span>
      </h4>

      ${metaHtml}

      <div class="flex items-center justify-between mb-2 gap-2">
        <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
          <span>⏱️</span>
          <span>สถานะคูลดาวน์${activeCd?.startedBy ? ` <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(activeCd.startedBy)})</span>` : ''}</span>
        </span>
        <div id="popup-cd-status-box-${safeSpotId}">
          ${isUrgent ? `
            <span id="popup-cd-status-${safeSpotId}" class="text-[11px] font-mono font-black text-red-400 animate-pulse">
              🔥 ใกล้เกิด: <span id="popup-cd-time-${safeSpotId}">${cdTimeStr}</span>
            </span>
          ` : isReady ? `
            <span id="popup-cd-status-${safeSpotId}" class="text-[11px] font-bold text-emerald-400 animate-pulse">
              ✅ ถึงเวลาเกิดแล้ว!
            </span>
          ` : `
            <span id="popup-cd-status-${safeSpotId}" class="text-[11px] font-mono font-bold text-amber-400">
              ⏳ เหลือ <span id="popup-cd-time-${safeSpotId}">${cdTimeStr}</span>
            </span>
          `}
        </div>
      </div>

      <div class="flex items-center gap-1.5 mb-2">
        <button
          data-popup-action="cancel-cd"
          type="button"
          class="flex-1 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-red-300 border border-red-500/40 text-[11px] font-bold transition-all text-center cursor-pointer shadow-sm"
        >
          🛑 ยกเลิกจับเวลา
        </button>
        <button
          data-popup-action="reset-cd"
          type="button"
          class="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 text-[11px] font-medium transition-all cursor-pointer"
          title="กดเพื่อตั้งเวลาใหม่"
        >
          🔄 ตั้งเวลาใหม่
        </button>
      </div>

      ${actionRowHtml}
    `;
  } else {
    popupNode.innerHTML = `
      <div class="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800/80 mb-1.5 pr-5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="shrink-0 flex items-center justify-center">${renderSpotIconHtml(spotIcon, 'w-4 h-4')}</span>
          <span class="font-bold text-xs text-white truncate">${safeSpotName}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${safePostal ? `<span class="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-500/40">📮 ${safePostal}</span>` : ''}
          <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold" style="background-color: ${safeSpotColor}22; color: ${safeSpotColor}; border: 1px solid ${safeSpotColor}55;">
            ${safeCatName}
          </span>
        </div>
      </div>

      ${metaHtml}

      ${isCement ? `
      <div data-popup-role="timer-panel">
        <div class="flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700/90 mb-1.5 shadow-inner gap-1">
          <div class="flex items-baseline gap-1 min-w-0">
            <span data-popup-role="numpad-display" class="text-lg font-mono font-black text-slate-600">_</span>
            <span class="text-[11px] text-slate-400">นาที</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${lastUsedMins ? `
              <button
                type="button"
                data-preset-minutes="${lastUsedMins}"
                class="preset-cd-btn text-[10px] font-mono font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-400 hover:text-slate-950 border border-amber-500/40 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                title="เริ่มจับเวลาซ้ำ ${lastUsedMins} นาทีทันที"
              >
                🔁 ${lastUsedMins}น.
              </button>
            ` : ''}
            <button
              type="button"
              data-popup-action="clear-numpad"
              class="text-[10px] text-slate-400 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕ ล้าง
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-1 mb-1.5 select-none">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => `
            <button
              type="button"
              class="numpad-key py-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 active:scale-95 text-white font-mono font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm"
              data-key="${num}"
            >
              ${num}
            </button>
          `).join('')}
          <button
            type="button"
            class="numpad-key py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 active:scale-95 text-slate-400 font-mono font-bold text-[11px] border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="C"
            title="ล้างตัวเลข"
          >
            C
          </button>
          <button
            type="button"
            class="numpad-key py-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 active:scale-95 text-white font-mono font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="0"
          >
            0
          </button>
          <button
            type="button"
            class="numpad-key py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 active:scale-95 text-slate-400 font-mono font-bold text-[11px] border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="BACK"
            title="ลบตัวล่าสุด"
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          data-popup-action="start-numpad"
          class="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1 transition-all mb-1.5 cursor-pointer"
        >
          <span>⏱️</span>
          <span>เริ่มจับเวลา</span>
        </button>
      </div>
      ` : ''}

      ${actionRowHtml}
    `;
  }

  let enteredMinutes = '';
  const displayEl = popupNode.querySelector('[data-popup-role="numpad-display"]') as HTMLElement | null;

  const updateDisplay = () => {
    if (displayEl) {
      if (enteredMinutes) {
        displayEl.textContent = enteredMinutes;
        displayEl.className = 'text-xl font-mono font-black text-amber-400';
      } else {
        displayEl.textContent = '_';
        displayEl.className = 'text-xl font-mono font-bold text-slate-600';
      }
    }
  };

  const handleDigit = (digit: string) => {
    if (enteredMinutes.length >= 3) return;
    if (enteredMinutes === '' && digit === '0') return;
    enteredMinutes += digit;
    updateDisplay();
  };

  const handleClear = () => {
    enteredMinutes = '';
    updateDisplay();
  };

  const handleBackspace = () => {
    enteredMinutes = enteredMinutes.slice(0, -1);
    updateDisplay();
  };

  const startCooldownWithMinutes = (mins: number) => {
    try {
      localStorage.setItem('fivem_map_last_cd_mins', String(mins));
    } catch {}
    callbacksRef.current.onStartCooldown(spot, mins);
    const updatedCd: ActiveCooldown = {
      spotId: spot.id,
      startedAt: Date.now(),
      expiresAt: Date.now() + mins * 60 * 1000,
      durationSeconds: mins * 60,
    };
    marker.setPopupContent(createPopupNode(spot, updatedCd, callbacksRef, marker));
    marker.closePopup();
    callbacksRef.current.onClearSelection?.();
  };

  const handleStart = () => {
    const mins = parseInt(enteredMinutes, 10);
    if (!mins || mins <= 0) {
      if (displayEl) {
        displayEl.textContent = 'กดเลขก่อน';
        displayEl.className = 'text-sm font-sans font-bold text-red-400 animate-pulse';
        setTimeout(() => {
          if (displayEl.isConnected) updateDisplay();
        }, 800);
      }
      return;
    }
    startCooldownWithMinutes(mins);
  };

  popupNode.querySelectorAll('.preset-cd-btn').forEach((presetBtn) => {
    (presetBtn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const mins = parseInt(presetBtn.getAttribute('data-preset-minutes') || '0', 10);
      if (mins > 0) startCooldownWithMinutes(mins);
    };
  });

  popupNode.querySelectorAll('.numpad-key').forEach((keyBtn) => {
    (keyBtn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const k = keyBtn.getAttribute('data-key');
      if (k === 'C') handleClear();
      else if (k === 'BACK') handleBackspace();
      else if (k) handleDigit(k);
    };
  });

  const bindAction = (action: string, handler: (el: HTMLElement) => void) => {
    const btn = popupNode.querySelector(`[data-popup-action="${action}"]`) as HTMLElement | null;
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        handler(btn);
      };
    }
  };

  bindAction('clear-numpad', handleClear);
  bindAction('start-numpad', handleStart);
  bindAction('reset-cd', () => {
    marker.setPopupContent(createPopupNode(spot, undefined, callbacksRef, marker));
  });
  bindAction('cancel-cd', () => {
    callbacksRef.current.onCancelCooldown(spot.id);
    marker.setPopupContent(createPopupNode(spot, undefined, callbacksRef, marker));
  });
  bindAction('measure', () => {
    marker.closePopup();
    callbacksRef.current.onStartMeasureFromSpot?.(spot);
  });
  bindAction('nav-target', () => {
    marker.closePopup();
    callbacksRef.current.onAddDistancePoint?.({
      x: spot.x,
      y: spot.y,
      label: spot.name,
      spotId: spot.id,
    });
    soundEffects.playPinPlaced();
  });
  bindAction('edit', () => {
    callbacksRef.current.onEditSpot(spot);
    marker.closePopup();
  });
  bindAction('move-pin', () => {
    marker.closePopup();
    callbacksRef.current.onStartMoveSpot?.(spot);
  });
  bindAction('ping-gang', (pingBtn) => {
    callbacksRef.current.onSendTacticalPing?.(spot);
    pingBtn.innerHTML = '<span>📣</span><span>ปิงแล้ว!</span>';
    pingBtn.classList.add('bg-cyan-500', 'text-slate-950');
    setTimeout(() => {
      if (pingBtn.isConnected) {
        pingBtn.innerHTML = '<span>📣</span><span>เรียกเพื่อน</span>';
        pingBtn.classList.remove('bg-cyan-500', 'text-slate-950');
      }
    }, 1500);
  });

  if (isCement) {
    popupNode.tabIndex = 0;
    popupNode.onkeydown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.stopPropagation();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.stopPropagation();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        handleStart();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        marker.closePopup();
      }
    };
  }

  return popupNode;
}

function createClusterPopupNode(
  cluster: ClusterItem,
  callbacksRef: React.MutableRefObject<{
    onFocusSpot?: (spot: CementSpot) => void;
    activeCooldowns?: ActiveCooldown[];
    spotsById?: Map<string, CementSpot>;
  }>,
  marker: L.Marker
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'p-1 text-slate-200 text-xs font-sans min-w-[260px] max-w-[320px]';
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);

  const count = cluster.spots.length;

  container.innerHTML = `
    <div class="flex items-center justify-between pb-2 border-b border-slate-700/80 mb-2">
      <div class="flex items-center gap-1.5 font-bold text-white text-xs">
        <span class="text-sm">📦</span>
        <span>กลุ่มหมุดใกล้กัน</span>
      </div>
      <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
        ${count} จุด
      </span>
    </div>

    <p class="text-[10px] text-slate-400 mb-2">
      คลิก "เลือก" เพื่อโฟกัสหรือเปิดดูรายละเอียดของจุดนั้น
    </p>

    <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
      ${cluster.spots
        .map((spot) => {
          const liveSpot = callbacksRef.current.spotsById?.get(spot.id) ?? spot;
          const cat = getSpotCategoryInfo(liveSpot);
          const icon = liveSpot.icon || cat?.icon || '🧱';
          const safeId = escapeHtml(liveSpot.id);
          const safeName = escapeHtml(liveSpot.name);
          const activeCd = callbacksRef.current.activeCooldowns?.find(
            (c) => c.spotId === liveSpot.id
          );
          const now = Date.now();
          const remSec = activeCd ? Math.max(0, Math.floor((activeCd.expiresAt - now) / 1000)) : 0;
          const isUrgent = remSec > 0 && remSec <= 180;
          const cdMinutes = Math.floor(remSec / 60);
          const cdSeconds = remSec % 60;
          const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

          return `
          <div class="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/40 transition-colors flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="shrink-0 flex items-center justify-center">${renderSpotIconHtml(icon, 'w-4 h-4')}</span>
              <div class="min-w-0">
                <div class="font-bold text-white truncate text-[11px] leading-tight">${safeName}</div>
                <div class="text-[10px] text-slate-400 font-mono">
                  ${
                    remSec > 0
                      ? `<span class="${isUrgent ? 'text-red-400 font-bold animate-pulse' : 'text-amber-300 font-semibold'}">⏱️ ${cdTimeStr}</span>`
                      : liveSpot.postal
                      ? `📮 #${escapeHtml(liveSpot.postal)}`
                      : escapeHtml(cat.name)
                  }
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" data-cluster-spot-id="${safeId}" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors shadow-sm cursor-pointer">
                เลือก
              </button>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;

  // Attach click listeners using data attribute (safe for any spot id characters)
  const spotMap = new Map(cluster.spots.map((s) => [s.id, callbacksRef.current.spotsById?.get(s.id) ?? s]));
  container.querySelectorAll('[data-cluster-spot-id]').forEach((btn) => {
    const id = btn.getAttribute('data-cluster-spot-id');
    const targetSpot = id ? spotMap.get(id) : undefined;
    if (targetSpot) {
      (btn as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        marker.closePopup();
        callbacksRef.current.onFocusSpot?.(targetSpot);
        soundEffects.playPinPlaced();
      };
    }
  });

  return container;
}

export const MapView = memo(({
  spots,
  activeLayer,
  activeCooldowns,
  onMapClickToCreatePin,
  onCursorMove,
  onCenterCoordsChange,
  onZoomChange,
  onEditSpot,
  onDeleteSpot,
  onStartCooldown,
  onCancelCooldown,
  onSpotMoved,
  selectedSpot,
  sidebarCollapsed,
  isCompactMode = false,
  isGhostMode = false,
  isCoordsLocked = false,
  lockedCoords = null,
  isDistanceMode = false,
  distancePoints = [],
  routingMode = 'road',
  roadRouteData = null,
  onAddDistancePoint,
  onStartMeasureFromSpot,
  isMaster = false,
  isClusteringEnabled = true,
  onFocusSpot,
  onClearSelection,
  movingSpot,
  onStartMoveSpot,
  tacticalPings = [],
  onSendTacticalPing,
  focusTargetCoords,
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const lockedLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const pingsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const ghostMoveMarkerRef = useRef<L.Marker | null>(null);
  const rubberbandPolylineRef = useRef<L.Polyline | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [currentMapZoom, setCurrentMapZoom] = useState<number>(3);

  const initialLayerRef = useRef(activeLayer);
  const activeCooldownsRef = useRef(activeCooldowns);
  const selectedSpotRef = useRef(selectedSpot);
  const prevActiveCooldownsRef = useRef<ActiveCooldown[]>(activeCooldowns);
  const spotsByIdRef = useRef<Map<string, CementSpot>>(new Map());
  const lastFlewSpotIdRef = useRef<string | null>(null);

  // Store callbacks and mutable snapshots in refs via effect (avoids render-time ref mutation)
  const callbacksRef = useRef({
    onMapClickToCreatePin,
    onCursorMove,
    onCenterCoordsChange,
    onZoomChange,
    onEditSpot,
    onDeleteSpot,
    onStartCooldown,
    onCancelCooldown,
    onSpotMoved,
    isCoordsLocked,
    lockedCoords,
    isDistanceMode,
    distancePoints,
    routingMode,
    onAddDistancePoint,
    onStartMeasureFromSpot,
    onFocusSpot,
    onClearSelection,
    movingSpot,
    onStartMoveSpot,
    onSendTacticalPing,
    activeCooldowns,
    spotsById: new Map<string, CementSpot>(),
  });

  useEffect(() => {
    const spotsMap = new Map(spots.map((s) => [s.id, s]));
    spotsByIdRef.current = spotsMap;
    activeCooldownsRef.current = activeCooldowns;
    selectedSpotRef.current = selectedSpot;
    callbacksRef.current = {
      onMapClickToCreatePin,
      onCursorMove,
      onCenterCoordsChange,
      onZoomChange,
      onEditSpot,
      onDeleteSpot,
      onStartCooldown,
      onCancelCooldown,
      onSpotMoved,
      isCoordsLocked,
      lockedCoords,
      isDistanceMode,
      distancePoints,
      routingMode,
      onAddDistancePoint,
      onStartMeasureFromSpot,
      onFocusSpot,
      onClearSelection,
      movingSpot,
      onStartMoveSpot,
      onSendTacticalPing,
      activeCooldowns,
      spotsById: spotsMap,
    };
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const markersMap = markersMapRef.current;
    const clusterMarkersMap = clusterMarkersMapRef.current;

    const layerConfig = MAP_LAYERS.find((l) => l.id === initialLayerRef.current) || MAP_LAYERS[0];

    const initialCenter = gameCoordsToLatLng(0, 0);

    const map = L.map(mapContainerRef.current, {
      crs: customGTA_CRS,
      minZoom: 1,
      maxZoom: 10,
      zoom: 3,
      center: initialCenter,
      maxBounds: MAP_MAX_BOUNDS,
      maxBoundsViscosity: 0.8,
      attributionControl: false,
      zoomControl: false,
      doubleClickZoom: false,
      closePopupOnClick: true,
    });

    // Add custom zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Set map background
    map.getContainer().style.backgroundColor = layerConfig.bgColor;

    // Create Base Tile Layer
    const tileLayer = L.tileLayer(layerConfig.url, {
      noWrap: true,
      tms: layerConfig.tms,
      minZoom: layerConfig.minZoom,
      maxZoom: layerConfig.maxZoom || 10,
      maxNativeZoom: layerConfig.maxNativeZoom || 7,
      bounds: MAP_BOUNDS,
      className: layerConfig.className || '',
    });
    tileLayer.addTo(map);
    currentTileLayerRef.current = tileLayer;

    // Create layer groups for markers, locked target & distance route
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    const lockedGroup = L.layerGroup().addTo(map);
    lockedLayerGroupRef.current = lockedGroup;

    const distanceGroup = L.layerGroup().addTo(map);
    distanceLayerGroupRef.current = distanceGroup;

    const pingsGroup = L.layerGroup().addTo(map);
    pingsLayerGroupRef.current = pingsGroup;

    mapInstanceRef.current = map;
    setMapReady(true);

    // Zoom listener
    const handleZoomEnd = () => {
      const z = map.getZoom();
      setCurrentMapZoom(z);
      callbacksRef.current.onZoomChange(z);
    };
    map.on('zoomend', handleZoomEnd);
    setCurrentMapZoom(map.getZoom());
    callbacksRef.current.onZoomChange(map.getZoom());

    // Center coordinates listener (for Pin at Crosshair)
    const handleMapMove = () => {
      const centerCoords = latLngToGameCoords(map.getCenter());
      callbacksRef.current.onCenterCoordsChange?.(centerCoords);
    };
    map.on('move', handleMapMove);
    map.on('moveend', handleMapMove);
    handleMapMove();

    // Throttled mouse move listener for live coordinates (rAF prevents render thrashing)
    let rafId: number | null = null;
    let lastCoords: { x: number; y: number } | null = null;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (callbacksRef.current.isDistanceMode && callbacksRef.current.distancePoints.length > 0) {
        const pts = callbacksRef.current.distancePoints;
        const lastPt = pts[pts.length - 1];
        const startLatLng = gameCoordsToLatLng(lastPt.x, lastPt.y);
        const currentLatLng = e.latlng;

        if (!rubberbandPolylineRef.current) {
          rubberbandPolylineRef.current = L.polyline([startLatLng, currentLatLng], {
            color: '#fbbf24',
            weight: 2,
            dashArray: '4, 6',
            opacity: 0.75,
            interactive: false,
          }).addTo(map);
        } else {
          rubberbandPolylineRef.current.setLatLngs([startLatLng, currentLatLng]);
          if (!map.hasLayer(rubberbandPolylineRef.current)) {
            rubberbandPolylineRef.current.addTo(map);
          }
        }
      } else if (rubberbandPolylineRef.current && map.hasLayer(rubberbandPolylineRef.current)) {
        map.removeLayer(rubberbandPolylineRef.current);
      }

      // Ghost Pin Preview while in Move Mode
      const activeMoving = callbacksRef.current.movingSpot;
      if (activeMoving) {
        const iconHtml = renderSpotIconHtml(activeMoving.icon || '📍', 'w-5 h-5');
        if (!ghostMoveMarkerRef.current) {
          const ghostIcon = L.divIcon({
            className: 'custom-leaflet-div-icon',
            html: `
              <div class="pointer-events-none flex flex-col items-center -translate-x-1/2 -translate-y-1/2 opacity-75">
                <div class="w-8 h-8 rounded-full bg-amber-500/25 border-2 border-dashed border-amber-300 flex items-center justify-center shadow-lg">
                  ${iconHtml}
                </div>
                <span class="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/90 border border-amber-400/50 text-amber-300 font-sans font-bold text-[9px] whitespace-nowrap">
                  คลิกเพื่อวางที่นี่
                </span>
              </div>
            `,
            iconSize: [0, 0],
          });
          ghostMoveMarkerRef.current = L.marker(e.latlng, {
            icon: ghostIcon,
            interactive: false,
            zIndexOffset: 4800,
          }).addTo(map);
        } else {
          ghostMoveMarkerRef.current.setLatLng(e.latlng);
          if (!map.hasLayer(ghostMoveMarkerRef.current)) {
            ghostMoveMarkerRef.current.addTo(map);
          }
        }
      } else if (ghostMoveMarkerRef.current && map.hasLayer(ghostMoveMarkerRef.current)) {
        map.removeLayer(ghostMoveMarkerRef.current);
        ghostMoveMarkerRef.current = null;
      }

      if (callbacksRef.current.isCoordsLocked) return;

      lastCoords = latLngToGameCoords(e.latlng);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (lastCoords) {
            coordsBus.emit(lastCoords);
            callbacksRef.current.onCursorMove?.(lastCoords);
          }
          rafId = null;
        });
      }
    };

    const handleMouseLeave = () => {
      if (rubberbandPolylineRef.current && map.hasLayer(rubberbandPolylineRef.current)) {
        map.removeLayer(rubberbandPolylineRef.current);
      }
      if (ghostMoveMarkerRef.current && map.hasLayer(ghostMoveMarkerRef.current)) {
        map.removeLayer(ghostMoveMarkerRef.current);
        ghostMoveMarkerRef.current = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    map.on('mousemove', handleMouseMove);
    map.getContainer().addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      map.off('zoomend', handleZoomEnd);
      map.off('move', handleMapMove);
      map.off('moveend', handleMapMove);
      map.off('mousemove', handleMouseMove);
      map.getContainer().removeEventListener('mouseleave', handleMouseLeave);
      if (rubberbandPolylineRef.current && map.hasLayer(rubberbandPolylineRef.current)) {
        map.removeLayer(rubberbandPolylineRef.current);
        rubberbandPolylineRef.current = null;
      }
      if (ghostMoveMarkerRef.current && map.hasLayer(ghostMoveMarkerRef.current)) {
        map.removeLayer(ghostMoveMarkerRef.current);
        ghostMoveMarkerRef.current = null;
      }
      markersMap.clear();
      clusterMarkersMap.clear();
      markersLayerGroupRef.current = null;
      lockedLayerGroupRef.current = null;
      distanceLayerGroupRef.current = null;
      pingsLayerGroupRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Invalidate map size when sidebar collapses or opens
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 320);
    return () => clearTimeout(timer);
  }, [sidebarCollapsed]);

  // Update Base Tile Layer when activeLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layerConfig = MAP_LAYERS.find((l) => l.id === activeLayer);
    if (!layerConfig) return;

    // Change background color
    map.getContainer().style.backgroundColor = layerConfig.bgColor;

    // Replace tile layer
    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(layerConfig.url, {
      noWrap: true,
      tms: layerConfig.tms,
      minZoom: layerConfig.minZoom,
      maxZoom: layerConfig.maxZoom || 10,
      maxNativeZoom: layerConfig.maxNativeZoom || 7,
      bounds: MAP_BOUNDS,
      className: layerConfig.className || '',
    });
    newTileLayer.addTo(map);
    currentTileLayerRef.current = newTileLayer;
  }, [activeLayer]);

  // Handle map events (single unified double-click + fast double-tap pin creation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let lastTriggerTime = 0;
    const triggerCreatePin = (coords: { x: number; y: number }) => {
      const now = Date.now();
      if (now - lastTriggerTime < 450) return;
      lastTriggerTime = now;
      soundEffects.playPinPlaced();
      callbacksRef.current.onMapClickToCreatePin(coords);
    };

    let lastClickTime = 0;
    let lastClickCoords: { x: number; y: number } | null = null;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const target = (e.originalEvent?.target as HTMLElement) || null;
      if (
        target?.closest('.leaflet-popup') ||
        target?.closest('.leaflet-control') ||
        target?.closest('.custom-pin-marker') ||
        target?.closest('.custom-compact-marker') ||
        target?.closest('input') ||
        target?.closest('button')
      ) {
        return;
      }

      if (callbacksRef.current.movingSpot) {
        const coords = latLngToGameCoords(e.latlng);
        callbacksRef.current.onSpotMoved?.(callbacksRef.current.movingSpot.id, coords);
        soundEffects.playPinPlaced();
        return;
      }

      map.closePopup();
      callbacksRef.current.onClearSelection?.();

      if (callbacksRef.current.isDistanceMode) {
        const coords = latLngToGameCoords(e.latlng);
        const nextIdx = callbacksRef.current.distancePoints.length + 1;
        callbacksRef.current.onAddDistancePoint?.({
          x: coords.x,
          y: coords.y,
          label: `จุดที่ ${nextIdx}`,
        });
        soundEffects.playPinPlaced();
        return;
      }

      const now = Date.now();
      const coords = latLngToGameCoords(e.latlng);
      if (
        now - lastClickTime < 400 &&
        lastClickCoords &&
        Math.hypot(coords.x - lastClickCoords.x, coords.y - lastClickCoords.y) < 150
      ) {
        lastClickTime = 0;
        lastClickCoords = null;
        triggerCreatePin(coords);
        return;
      }
      lastClickTime = now;
      lastClickCoords = coords;
    };

    const container = map.getContainer();
    const handleNativeDblClick = (e: MouseEvent) => {
      if (!e.shiftKey && !e.altKey && !isGhostMode) {
        const target = e.target as HTMLElement | null;
        if (
          target?.closest('.leaflet-popup') ||
          target?.closest('.leaflet-control') ||
          target?.closest('.custom-pin-marker') ||
          target?.closest('.custom-compact-marker') ||
          target?.closest('button')
        ) {
          return;
        }
      }
      const latlng = map.mouseEventToLatLng(e);
      const coords = latLngToGameCoords(latlng);
      triggerCreatePin(coords);
    };

    map.on('click', handleMapClick);
    container.addEventListener('dblclick', handleNativeDblClick);

    return () => {
      map.off('click', handleMapClick);
      container.removeEventListener('dblclick', handleNativeDblClick);
    };
  }, [mapReady, isGhostMode]);

  const selectedSpotId = selectedSpot?.id ?? null;
  const movingSpotId = movingSpot?.id ?? null;

  // Synchronize Markers & Clusters on Map (only when spots, clusters, mode, or selection changes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    const clusters = computeClusters(
      map,
      spots,
      currentMapZoom,
      activeCooldowns,
      selectedSpotId ?? undefined,
      isClusteringEnabled
    );

    const activeSingleSpotIds = new Set<string>();
    const activeClusterIds = new Set<string>();

    clusters.forEach((item) => {
      if (item.isCluster) {
        activeClusterIds.add(item.id);
      } else {
        activeSingleSpotIds.add(item.spots[0].id);
      }
    });

    markersMapRef.current.forEach((marker, id) => {
      if (!activeSingleSpotIds.has(id)) {
        group.removeLayer(marker);
        markersMapRef.current.delete(id);
      }
    });

    clusterMarkersMapRef.current.forEach((marker, id) => {
      if (!activeClusterIds.has(id)) {
        group.removeLayer(marker);
        clusterMarkersMapRef.current.delete(id);
      }
    });

    clusters.forEach((item) => {
      if (!item.isCluster) {
        const spot = item.spots[0];
        const spotId = spot.id;
        const latlng = item.latlng;
        const isCurrentSelected = selectedSpotId === spotId;
        const isMovingThisSpot = movingSpotId === spotId;
        const activeCd = activeCooldowns.find((c) => c.spotId === spotId);
        const icon = getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, activeCd, isMovingThisSpot);
        const zIndexOffset = isMovingThisSpot ? 5000 : isCurrentSelected ? 2000 : activeCd ? 300 : 0;
        const canDrag = isMovingThisSpot || isCurrentSelected;

        const existing = markersMapRef.current.get(spotId);
        if (existing) {
          if (!group.hasLayer(existing)) {
            group.addLayer(existing);
          }
          existing.setLatLng(latlng);
          existing.setIcon(icon);
          existing.setZIndexOffset(existing.isPopupOpen() ? 3500 : zIndexOffset);

          if (isMovingThisSpot && existing.isPopupOpen()) {
            existing.closePopup();
          } else if (existing.isPopupOpen()) {
            existing.setPopupContent(createPopupNode(spot, activeCd, callbacksRef, existing));
          }

          if (canDrag) {
            if (!existing.dragging?.enabled()) existing.dragging?.enable();
          } else {
            if (existing.dragging?.enabled()) existing.dragging?.disable();
          }
        } else {
          const marker = L.marker(latlng, {
            icon,
            draggable: canDrag,
            zIndexOffset,
          });

          marker.bindPopup(
            () => {
              const liveSpot = spotsByIdRef.current.get(spotId) ?? spot;
              const cd = activeCooldownsRef.current.find((c) => c.spotId === spotId);
              return createPopupNode(liveSpot, cd, callbacksRef, marker);
            },
            {
              maxWidth: 280,
              minWidth: 235,
              className: 'custom-fivem-popup',
              autoClose: false,
              closeOnClick: true,
              autoPan: true,
              autoPanPaddingTopLeft: L.point(16, 84),
              autoPanPaddingBottomRight: L.point(16, 72),
            }
          );

          marker.on('click', (e) => {
            const liveSpot = spotsByIdRef.current.get(spotId) ?? spot;
            if (callbacksRef.current.isDistanceMode) {
              L.DomEvent.stopPropagation(e);
              marker.closePopup();
              callbacksRef.current.onAddDistancePoint?.({
                x: liveSpot.x,
                y: liveSpot.y,
                label: liveSpot.name,
                spotId: liveSpot.id,
              });
              soundEffects.playPinPlaced();
              return;
            }
            callbacksRef.current.onFocusSpot?.(liveSpot);
          });

          marker.on('popupopen', () => {
            if (callbacksRef.current.isDistanceMode) {
              marker.closePopup();
              return;
            }
            markersMapRef.current.forEach((otherMarker, otherId) => {
              if (otherId !== spotId && otherMarker.isPopupOpen()) {
                otherMarker.closePopup();
              }
            });
            clusterMarkersMapRef.current.forEach((cMarker) => {
              if (cMarker.isPopupOpen()) cMarker.closePopup();
            });
            marker.setZIndexOffset(3500);
          });

          marker.on('popupclose', () => {
            const currentCd = activeCooldownsRef.current.find((c) => c.spotId === spotId);
            const isSelected = selectedSpotRef.current?.id === spotId;
            const isMoving = callbacksRef.current.movingSpot?.id === spotId;
            marker.setZIndexOffset(isMoving ? 5000 : isSelected ? 2000 : currentCd ? 300 : 0);
            if (isSelected && !isMoving) {
              callbacksRef.current.onClearSelection?.();
            }
          });

          marker.on('dragstart', () => {
            if (marker.isPopupOpen()) marker.closePopup();
          });

          marker.on('dragend', () => {
            const newLatLng = marker.getLatLng();
            const newCoords = latLngToGameCoords(newLatLng);
            callbacksRef.current.onSpotMoved?.(spotId, newCoords);
            soundEffects.playPinPlaced();
          });

          group.addLayer(marker);
          markersMapRef.current.set(spotId, marker);
        }
      } else {
        const cluster = item;
        const icon = createClusterDivIcon(cluster);
        const zIndexOffset = cluster.urgentCooldown ? 1500 : cluster.hasActiveCooldown ? 800 : 100;

        const existingCluster = clusterMarkersMapRef.current.get(cluster.id);
        if (existingCluster) {
          if (!group.hasLayer(existingCluster)) {
            group.addLayer(existingCluster);
          }
          existingCluster.setLatLng(cluster.latlng);
          existingCluster.setIcon(icon);
          existingCluster.setZIndexOffset(zIndexOffset);

          if (existingCluster.isPopupOpen()) {
            existingCluster.setPopupContent(createClusterPopupNode(cluster, callbacksRef, existingCluster));
          }
        } else {
          const clusterMarker = L.marker(cluster.latlng, {
            icon,
            zIndexOffset,
          });

          clusterMarker.bindPopup(
            () => createClusterPopupNode(cluster, callbacksRef, clusterMarker),
            {
              maxWidth: 320,
              minWidth: 250,
              className: 'custom-fivem-popup',
              autoClose: false,
              closeOnClick: true,
              autoPan: true,
              autoPanPaddingTopLeft: L.point(16, 84),
              autoPanPaddingBottomRight: L.point(16, 72),
            }
          );

          clusterMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            soundEffects.playPinPlaced();

            const currentZ = map.getZoom();
            const lls = cluster.spots.map((s) => gameCoordsToLatLng(s.x, s.y));
            const bounds = L.latLngBounds(lls);

            if (currentZ < 8 && bounds.isValid() && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 0.04) {
              map.flyToBounds(bounds, {
                padding: [70, 70],
                maxZoom: Math.min(10, currentZ + 2),
                duration: 0.45,
              });
            } else {
              clusterMarker.openPopup();
            }
          });

          clusterMarker.on('popupopen', () => {
            markersMapRef.current.forEach((otherMarker) => {
              if (otherMarker.isPopupOpen()) otherMarker.closePopup();
            });
            clusterMarkersMapRef.current.forEach((otherCMarker, cId) => {
              if (cId !== cluster.id && otherCMarker.isPopupOpen()) {
                otherCMarker.closePopup();
              }
            });
          });

          group.addLayer(clusterMarker);
          clusterMarkersMapRef.current.set(cluster.id, clusterMarker);
        }
      }
    });
  }, [
    mapReady,
    spots,
    selectedSpotId,
    movingSpotId,
    isCompactMode,
    isGhostMode,
    isMaster,
    currentMapZoom,
    isClusteringEnabled,
    activeCooldowns,
  ]);

  // Synchronize cooldown marker badges ONLY when activeCooldowns actually changes for a spot
  useEffect(() => {
    const prevCds = prevActiveCooldownsRef.current;
    prevActiveCooldownsRef.current = activeCooldowns;

    const changedSpotIds = new Set<string>();
    activeCooldowns.forEach((cd) => {
      const old = prevCds.find((p) => p.spotId === cd.spotId);
      if (!old || old.expiresAt !== cd.expiresAt) {
        changedSpotIds.add(cd.spotId);
      }
    });
    prevCds.forEach((old) => {
      if (!activeCooldowns.some((c) => c.spotId === old.spotId)) {
        changedSpotIds.add(old.spotId);
      }
    });

    changedSpotIds.forEach((spotId) => {
      const marker = markersMapRef.current.get(spotId);
      const spot = spots.find((s) => s.id === spotId);
      if (!marker || !spot) return;
      const activeCd = activeCooldowns.find((c) => c.spotId === spot.id);
      const isCurrentSelected = selectedSpotId === spot.id;
      marker.setIcon(getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, activeCd));
      const zIndex = marker.isPopupOpen() ? 3500 : isCurrentSelected ? 2000 : activeCd ? 300 : 0;
      marker.setZIndexOffset(zIndex);
      if (marker.isPopupOpen()) {
        marker.setPopupContent(createPopupNode(spot, activeCd, callbacksRef, marker));
      }
    });
  }, [activeCooldowns, spots, selectedSpotId, isCompactMode, isGhostMode]);

  // Dedicated 1-second real-time countdown updater
  useEffect(() => {
    if (activeCooldowns.length === 0) return;

    const urgentSpots = new Set<string>();
    const readySpots = new Set<string>();
    activeCooldowns.forEach((cd) => {
      const rem = Math.max(0, Math.floor((cd.expiresAt - Date.now()) / 1000));
      if (rem > 0 && rem <= 180) urgentSpots.add(cd.spotId);
      if (rem === 0) readySpots.add(cd.spotId);
    });

    const interval = setInterval(() => {
      const now = Date.now();

      activeCooldowns.forEach((cd) => {
        const remainingSec = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
        const isUrgent = remainingSec > 0 && remainingSec <= 180;
        const isReady = remainingSec === 0;
        const cdMinutes = Math.floor(remainingSec / 60);
        const cdSeconds = remainingSec % 60;
        const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

        const badgeText = document.getElementById(`marker-cd-text-${cd.spotId}`);
        if (badgeText) {
          badgeText.textContent = cdTimeStr;
        }

        const wasUrgent = urgentSpots.has(cd.spotId);
        const wasReady = readySpots.has(cd.spotId);
        if (isUrgent !== wasUrgent || isReady !== wasReady) {
          if (isUrgent) urgentSpots.add(cd.spotId);
          else urgentSpots.delete(cd.spotId);

          if (isReady) readySpots.add(cd.spotId);
          else readySpots.delete(cd.spotId);

          const marker = markersMapRef.current.get(cd.spotId);
          const spot = spots.find((s) => s.id === cd.spotId);
          if (marker && spot) {
            const isCurrentSelected = selectedSpotId === spot.id;
            marker.setIcon(getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, cd));
          }
        }

        const timerSpan = document.getElementById(`popup-cd-time-${cd.spotId}`);
        if (timerSpan) {
          timerSpan.textContent = cdTimeStr;
        }
        const statusBox = document.getElementById(`popup-cd-status-box-${cd.spotId}`);
        if (statusBox) {
          const safeSpotId = escapeHtml(cd.spotId);
          if (isReady && !statusBox.innerHTML.includes('ถึงเวลาเกิดแล้ว')) {
            statusBox.innerHTML = `<span id="popup-cd-status-${safeSpotId}" class="text-[11px] font-bold text-emerald-400 animate-pulse">✅ ถึงเวลาเกิดแล้ว!</span>`;
          } else if (isUrgent && !statusBox.innerHTML.includes('ใกล้เกิด')) {
            statusBox.innerHTML = `
              <span id="popup-cd-status-${safeSpotId}" class="text-[11px] font-mono font-bold text-red-400 animate-pulse">
                🔥 ใกล้เกิด: <span id="popup-cd-time-${safeSpotId}">${cdTimeStr}</span>
              </span>
            `;
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCooldowns, spots, selectedSpotId, isCompactMode, isGhostMode]);

  // Pan to selected spot safely and open popup (starts from null, so any selection is explicit)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!selectedSpot) {
      lastFlewSpotIdRef.current = null;
      return;
    }

    const isMovingThisSpot = callbacksRef.current.movingSpot?.id === selectedSpot.id;
    const isSameSpotUpdate = lastFlewSpotIdRef.current === selectedSpot.id;

    if (Number.isFinite(selectedSpot.x) && Number.isFinite(selectedSpot.y)) {
      try {
        const latlng = gameCoordsToLatLng(selectedSpot.x, selectedSpot.y);
        const currentZoom = map.getZoom();
        const pt = map.latLngToContainerPoint(latlng);
        const size = map.getSize();
        const needsFly =
          !isSameSpotUpdate &&
          (currentZoom < 4 ||
            pt.x < 60 ||
            pt.x > size.x - 60 ||
            pt.y < 140 ||
            pt.y > size.y - 90);

        if (needsFly) {
          map.flyTo(latlng, Math.max(currentZoom, 4), {
            duration: 0.45,
          });
        }
        lastFlewSpotIdRef.current = selectedSpot.id;

        if (isMovingThisSpot) {
          const marker = markersMapRef.current.get(selectedSpot.id);
          if (marker?.isPopupOpen()) {
            marker.closePopup();
          }
          return;
        }

        // Open popup of selected marker (autoPan will keep it safely below top HUD)
        const openPopup = () => {
          if (callbacksRef.current.movingSpot?.id === selectedSpot.id) return;
          const marker = markersMapRef.current.get(selectedSpot.id);
          if (marker && !marker.isPopupOpen()) {
            marker.openPopup();
          }
        };
        openPopup();
        const timer = setTimeout(openPopup, needsFly ? 480 : 120);
        return () => clearTimeout(timer);
      } catch (err) {
        console.error('Failed to flyTo spot:', err);
      }
    }
  }, [selectedSpot]);

  // Clear ghost move preview marker whenever move mode exits
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!movingSpot && ghostMoveMarkerRef.current) {
      if (map && map.hasLayer(ghostMoveMarkerRef.current)) {
        map.removeLayer(ghostMoveMarkerRef.current);
      }
      ghostMoveMarkerRef.current = null;
    }
  }, [movingSpot]);

  // Pan to explicit target coordinates (e.g., Tactical Ping focus)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusTargetCoords) return;
    if (Number.isFinite(focusTargetCoords.x) && Number.isFinite(focusTargetCoords.y)) {
      const latlng = gameCoordsToLatLng(focusTargetCoords.x, focusTargetCoords.y);
      map.flyTo(latlng, Math.max(map.getZoom(), 4), { duration: 0.6 });
    }
  }, [focusTargetCoords]);

  // Render Tactical Gang Pings
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = pingsLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    tacticalPings.forEach((ping) => {
      const latlng = gameCoordsToLatLng(ping.x, ping.y);
      const safeMember = escapeHtml(ping.memberName);
      const safeLabel = escapeHtml(ping.label);
      const pingIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: `
          <div class="pointer-events-none relative flex items-center justify-center" style="width: 52px; height: 52px;">
            <div class="marker-urgent-pulse-ring" style="border-color: #22d3ee; box-shadow: 0 0 16px #22d3ee;"></div>
            <div class="marker-urgent-pulse-ring-delayed" style="border-color: #38bdf8; box-shadow: 0 0 12px #38bdf8;"></div>
            <div class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#22d3ee]"></div>
            <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-950/95 text-cyan-300 font-sans font-bold text-[10px] shadow-xl border border-cyan-400/70 flex items-center gap-1">
              <span>📣</span>
              <span>${safeMember}: ${safeLabel}</span>
            </div>
          </div>
        `,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });
      group.addLayer(L.marker(latlng, { icon: pingIcon, interactive: false, zIndexOffset: 4500 }));
    });
  }, [tacticalPings]);

  // Render Locked Coordinates Target Beacon
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = lockedLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!isCoordsLocked || !lockedCoords) return;

    const latlng = gameCoordsToLatLng(lockedCoords.x, lockedCoords.y);
    const beaconHtml = `
      <div class="locked-beacon-marker relative flex items-center justify-center pointer-events-none" style="width: 44px; height: 44px;">
        <div class="locked-pulse-ring"></div>
        <div class="w-7 h-7 rounded-full border border-dashed border-cyan-300 animate-spin" style="animation-duration: 5s;"></div>
        <div class="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-[0_0_10px_#22d3ee]"></div>
        <div class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-950/95 text-cyan-300 font-mono font-bold text-[10px] shadow-lg border border-cyan-500/60 flex items-center gap-1">
          <span>🔒</span>
          <span>(${lockedCoords.x.toFixed(1)}, ${lockedCoords.y.toFixed(1)})</span>
        </div>
      </div>
    `;

    const beaconIcon = L.divIcon({
      className: 'custom-leaflet-div-icon',
      html: beaconHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker(latlng, {
      icon: beaconIcon,
      zIndexOffset: 3000,
      interactive: false,
    });

    group.addLayer(marker);
  }, [isCoordsLocked, lockedCoords]);

  // Render Distance Measurement & Farming Route Polylines + Numbered Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = distanceLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!isDistanceMode || distancePoints.length === 0) return;

    const latlngs = distancePoints.map((p) => gameCoordsToLatLng(p.x, p.y));

    // 1. Draw polyline if 2+ points
    if (latlngs.length > 1) {
      const isRoadMode = routingMode === 'road' && roadRouteData && roadRouteData.fullPath.length > 1;

      if (isRoadMode) {
        const roadLatLngs = roadRouteData.fullPath.map((p) => gameCoordsToLatLng(p.x, p.y));

        // Outer Dark Shadow Casing
        const shadowPolyline = L.polyline(roadLatLngs, {
          color: '#030712',
          weight: 7.5,
          opacity: 0.85,
          interactive: false,
        });
        group.addLayer(shadowPolyline);

        // Neon Blue/Cyan GTA Style GPS Line
        const polyline = L.polyline(roadLatLngs, {
          color: '#38bdf8',
          weight: 4.5,
          opacity: 0.95,
          interactive: false,
        });
        group.addLayer(polyline);

        // Road segment badges
        for (let i = 0; i < distancePoints.length - 1; i++) {
          const p1 = distancePoints[i];
          const p2 = distancePoints[i + 1];
          const segDist = roadRouteData.segmentDistances[i] ?? calculateGameDistance(p1, p2);
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const midLatLng = gameCoordsToLatLng(midX, midY);

          const distText =
            segDist >= 1000
              ? `${(segDist / 1000).toFixed(2)} กม. (ถนน)`
              : `${segDist} ม. (ถนน)`;

          const badgeIcon = L.divIcon({
            className: 'custom-leaflet-div-icon',
            html: `
              <div class="pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                <span class="bg-slate-950/95 text-cyan-300 font-mono font-black text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/60 shadow-lg shadow-cyan-500/20 whitespace-nowrap backdrop-blur-sm">
                  ${distText}
                </span>
              </div>
            `,
            iconSize: [0, 0],
          });

          const badgeMarker = L.marker(midLatLng, {
            icon: badgeIcon,
            interactive: false,
            zIndexOffset: 1500,
          });
          group.addLayer(badgeMarker);
        }
      } else {
        // Straight line mode (Original Air Distance)
        const shadowPolyline = L.polyline(latlngs, {
          color: '#020617',
          weight: 6,
          opacity: 0.75,
          interactive: false,
        });
        group.addLayer(shadowPolyline);

        // Inner glowing amber dashed polyline
        const polyline = L.polyline(latlngs, {
          color: '#f59e0b',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.95,
          interactive: false,
        });
        group.addLayer(polyline);

        // Midpoint distance badges for each segment
        for (let i = 0; i < distancePoints.length - 1; i++) {
          const p1 = distancePoints[i];
          const p2 = distancePoints[i + 1];
          const segDist = calculateGameDistance(p1, p2);
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const midLatLng = gameCoordsToLatLng(midX, midY);

          const distText =
            segDist >= 1000
              ? `${(segDist / 1000).toFixed(2)} กม. (เส้นตรง)`
              : `${segDist} ม. (เส้นตรง)`;

          const badgeIcon = L.divIcon({
            className: 'custom-leaflet-div-icon',
            html: `
              <div class="pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                <span class="bg-slate-950/95 text-amber-300 font-mono font-black text-[10px] px-2 py-0.5 rounded-full border border-amber-500/60 shadow-lg shadow-amber-500/20 whitespace-nowrap backdrop-blur-sm">
                  ${distText}
                </span>
              </div>
            `,
            iconSize: [0, 0],
          });

          const badgeMarker = L.marker(midLatLng, {
            icon: badgeIcon,
            interactive: false,
            zIndexOffset: 1500,
          });
          group.addLayer(badgeMarker);
        }
      }
    }

    // 2. Draw Numbered Waypoint Markers
    distancePoints.forEach((pt, index) => {
      const latlng = gameCoordsToLatLng(pt.x, pt.y);
      const isStart = index === 0;
      const isEnd = index === distancePoints.length - 1 && distancePoints.length > 1;

      const markerHtml = `
        <div class="pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <div class="w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-xs border-2 border-white shadow-xl ${
            isStart
              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/80 shadow-emerald-500/40'
              : isEnd
              ? 'bg-red-500 text-white ring-2 ring-red-400/80 shadow-red-500/40'
              : 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/80 shadow-amber-500/40'
          }">
            ${index + 1}
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: markerHtml,
        iconSize: [0, 0],
      });

      const ptMarker = L.marker(latlng, {
        icon: markerIcon,
        interactive: false,
        zIndexOffset: 2500 + index,
      });

      ptMarker.bindTooltip(escapeHtml(pt.label || `จุดที่ ${index + 1}`), {
        permanent: true,
        direction: 'top',
        offset: [0, -14],
        className:
          'bg-slate-950/95 text-amber-300 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-amber-500/50 shadow-md whitespace-nowrap',
      });

      group.addLayer(ptMarker);
    });
  }, [isDistanceMode, distancePoints, routingMode, roadRouteData]);

  return (
    <div
      className={`w-full h-full relative ${
        isDistanceMode || movingSpot ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Keep ref element's className static so React never strips Leaflet's .leaflet-container classes */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
});
