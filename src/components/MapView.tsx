import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  customGTA_CRS,
  gameCoordsToLatLng,
  latLngToGameCoords,
  MAP_BOUNDS,
  MAP_MAX_BOUNDS,
} from '../utils/crs';
import type { CementSpot, MapTileLayer, ActiveCooldown } from '../types/map';
import { MAP_LAYERS, CATEGORIES } from '../data/defaultSpots';
import { formatFiveMCommand } from '../utils/storage';
import { soundEffects } from '../utils/sound';

interface MapViewProps {
  spots: CementSpot[];
  activeLayer: MapTileLayer;
  activeCooldowns: ActiveCooldown[];
  isDistanceMode: boolean;
  distancePoints: { x: number; y: number }[];
  onAddDistancePoint: (pt: { x: number; y: number }) => void;
  onMapClickToCreatePin: (coords: { x: number; y: number }) => void;
  onCursorMove: (coords: { x: number; y: number } | null) => void;
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
}

// Helper to generate marker icon with cooldown badge
function getMarkerIcon(
  spot: CementSpot,
  isCurrentSelected: boolean,
  isCompactMode: boolean,
  isGhostMode: boolean,
  activeCd?: ActiveCooldown
): L.DivIcon {
  const cat = CATEGORIES[spot.category] || CATEGORIES.cement_mine;
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

  const ghostClass = isGhostMode && !isCurrentSelected ? 'opacity-25 pointer-events-none transition-opacity duration-200' : '';

  let markerHtml = '';
  let iconSize: [number, number] = [42, 48];
  let iconAnchor: [number, number] = [21, 48];

  if (isCompactMode) {
    iconSize = [20, 20];
    iconAnchor = [10, 10];
    markerHtml = `
      <div class="custom-compact-marker relative cursor-pointer flex items-center justify-center ${ghostClass}" data-spot-id="${spot.id}" style="width: 20px; height: 20px;">
        ${isUrgent ? `
          <div class="marker-urgent-pulse-ring pointer-events-none" style="width: 26px; height: 26px; margin-top: -13px; margin-left: -13px;"></div>
        ` : ''}
        <div 
          class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] shadow-lg border-2 transition-transform duration-200 hover:scale-125 pointer-events-auto select-none"
          style="
            background-color: ${isUrgent ? '#ef4444' : spotColor};
            border-color: ${isCurrentSelected ? '#ffffff' : '#0f172a'};
            transform: ${isCurrentSelected ? 'scale(1.35)' : 'scale(1)'};
            box-shadow: ${isCurrentSelected ? '0 0 10px #ffffff' : '0 2px 6px rgba(0,0,0,0.6)'};
            font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif;
            line-height: 1;
          "
          title="${spot.name} (${spot.x}, ${spot.y})"
        >
          <span>${spotIcon}</span>
        </div>
        ${isUrgent ? `
          <div id="marker-cd-badge-${spot.id}" class="marker-cd-badge pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-1 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[9px] shadow border border-yellow-200">
            🔥 <span id="marker-cd-text-${spot.id}">${cdTimeStr}</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    markerHtml = `
      <div class="custom-pin-marker relative cursor-pointer ${isUrgent ? 'urgent-pin-highlight' : ''} ${ghostClass}" data-spot-id="${spot.id}" style="width: 42px; height: 48px;">
        ${isUrgent ? `
          <div class="marker-urgent-pulse-ring pointer-events-none"></div>
          <div class="marker-urgent-pulse-ring-delayed pointer-events-none"></div>
        ` : isReady ? `
          <div class="marker-ready-pulse-ring pointer-events-none"></div>
        ` : isCooldown ? `
          <div class="marker-pulse-ring pointer-events-none" style="border: 2px solid ${spotColor};"></div>
        ` : ''}

        <!-- Floating Countdown Badge above teardrop (pointer-events-none prevents blocking neighbor pin clicks!) -->
        ${isUrgent ? `
          <div id="marker-cd-badge-${spot.id}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white font-black font-mono text-[10px] shadow-lg shadow-red-600/80 border border-yellow-200 animate-bounce">
            <span>🔥</span>
            <span id="marker-cd-text-${spot.id}">${cdTimeStr}</span>
          </div>
        ` : isReady ? `
          <div id="marker-cd-badge-${spot.id}" class="marker-cd-badge pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold font-sans text-[10px] shadow-lg shadow-emerald-500/80 border border-emerald-300 animate-pulse">
            <span>✅ เกิดแล้ว!</span>
          </div>
        ` : isCooldown ? `
          <div id="marker-cd-badge-${spot.id}" class="marker-cd-badge pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-amber-300 font-bold font-mono text-[10px] shadow-md border border-amber-500/50">
            <span>⏱️</span>
            <span id="marker-cd-text-${spot.id}">${cdTimeStr}</span>
          </div>
        ` : ''}

        <div class="relative flex flex-col items-center pointer-events-auto select-none">
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl border-2 transition-transform duration-200"
            style="
              background-color: ${isUrgent ? '#ef4444' : spotColor};
              border-color: ${isUrgent ? '#fde047' : isCurrentSelected ? '#ffffff' : '#0f172a'};
              transform: ${isCurrentSelected || isUrgent ? 'scale(1.2)' : 'scale(1)'};
              box-shadow: ${isUrgent ? '0 0 16px rgba(239, 68, 68, 0.9)' : '0 4px 12px rgba(0,0,0,0.5)'};
              font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif;
              line-height: 1;
            "
          >
            <span>${spotIcon}</span>
          </div>
          <div 
            class="w-0 h-0 border-x-4 border-x-transparent border-t-[6px] -mt-0.5"
            style="border-top-color: ${isUrgent ? '#ef4444' : spotColor};"
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
  }>,
  marker: L.Marker
): HTMLElement {
  const cat = CATEGORIES[spot.category] || CATEGORIES.cement_mine;
  const spotIcon = spot.icon || cat?.icon || '🧱';
  const spotColor = spot.color || cat?.color || '#f59e0b';
  const cmd = formatFiveMCommand(spot);

  const now = Date.now();
  const remainingSec = activeCd ? Math.max(0, Math.floor((activeCd.expiresAt - now) / 1000)) : 0;
  const isCooldown = !!activeCd && remainingSec > 0;
  const isUrgent = isCooldown && remainingSec <= 180;
  const isReady = !!activeCd && remainingSec === 0;

  const cdMinutes = Math.floor(remainingSec / 60);
  const cdSeconds = remainingSec % 60;
  const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

  const popupNode = document.createElement('div');
  popupNode.className = 'p-1 text-slate-200 text-xs font-sans min-w-[250px] max-w-[320px]';

  // Prevent map drag/click when interacting inside popup
  L.DomEvent.disableClickPropagation(popupNode);
  L.DomEvent.disableScrollPropagation(popupNode);

  popupNode.innerHTML = `
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-700/80 mb-2">
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background-color: ${spotColor}22; color: ${spotColor}; border: 1px solid ${spotColor}55;">
        ${spotIcon} ${cat.name}
      </span>
      ${spot.postal ? `<span class="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">📮 ${spot.postal}</span>` : ''}
    </div>

    <h4 class="font-bold text-sm text-white mb-1.5 leading-snug flex items-center gap-1.5">
      <span class="text-base">${spotIcon}</span>
      <span>${spot.name}</span>
    </h4>

    ${spot.yieldDescription ? `
      <div class="text-[11px] text-emerald-300 mb-1 flex items-start gap-1">
        <span>📦</span> <span>${spot.yieldDescription}</span>
      </div>
    ` : ''}

    ${spot.requiredItems && spot.requiredItems.length > 0 ? `
      <div class="text-[11px] text-purple-300 mb-1 flex items-start gap-1">
        <span>🔧</span> <span>ต้องใช้: ${spot.requiredItems.join(', ')}</span>
      </div>
    ` : ''}

    ${spot.notes ? `
      <p class="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 my-1.5 leading-relaxed">
        ${spot.notes}
      </p>
    ` : ''}

    <div class="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 font-mono text-[11px] my-2 text-slate-300 flex items-center justify-between">
      <span>X: <strong class="text-emerald-400">${spot.x.toFixed(1)}</strong> Y: <strong class="text-emerald-400">${spot.y.toFixed(1)}</strong></span>
      <button id="popup-copy-cmd-${spot.id}" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-[10px] text-slate-300 border border-slate-700 transition-colors">
        Copy /tp
      </button>
    </div>

    <!-- Cooldown Section -->
    <div class="mt-2 pt-2 border-t border-slate-700/80">
      ${isCooldown || isReady ? `
        <!-- Active Cooldown Running View -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
            <span>⏱️</span>
            <span>สถานะคูลดาวน์</span>
          </span>
          <div id="popup-cd-status-box-${spot.id}">
            ${isUrgent ? `
              <span id="popup-cd-status-${spot.id}" class="text-[11px] font-mono font-black text-red-400 animate-pulse">
                🔥 ใกล้เกิด: <span id="popup-cd-time-${spot.id}">${cdTimeStr}</span>
              </span>
            ` : isReady ? `
              <span id="popup-cd-status-${spot.id}" class="text-[11px] font-bold text-emerald-400 animate-pulse">
                ✅ ถึงเวลาเกิดแล้ว!
              </span>
            ` : `
              <span id="popup-cd-status-${spot.id}" class="text-[11px] font-mono font-bold text-amber-400">
                ⏳ เหลือ <span id="popup-cd-time-${spot.id}">${cdTimeStr}</span>
              </span>
            `}
          </div>
        </div>

        <div class="flex items-center gap-1.5 mb-2">
          <button 
            id="popup-cancel-cd-${spot.id}" 
            type="button"
            class="flex-1 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-red-300 border border-red-500/40 text-[11px] font-bold transition-all text-center cursor-pointer shadow-sm"
          >
            🛑 ยกเลิกจับเวลา
          </button>
          <button 
            id="popup-reset-cd-${spot.id}" 
            type="button"
            class="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 text-[11px] font-medium transition-all cursor-pointer"
            title="กดเพื่อตั้งเวลาใหม่"
          >
            🔄 ตั้งเวลาใหม่
          </button>
        </div>
      ` : `
        <!-- Interactive Numpad Cooldown View (No default time) -->
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
            <span>⏱️</span>
            <span>จับเวลาคูลดาวน์</span>
          </span>
          <span class="text-[10px] text-slate-400">กดเลขเวลาเอง (นาที)</span>
        </div>

        <!-- Numpad Display Screen -->
        <div class="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/90 mb-2 shadow-inner">
          <div class="flex items-baseline gap-1">
            <span id="numpad-display-${spot.id}" class="text-xl font-mono font-black text-slate-600">_</span>
            <span class="text-xs text-slate-400">นาที</span>
          </div>
          <button 
            type="button" 
            id="numpad-btn-clear-${spot.id}" 
            class="text-[10px] text-slate-400 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕ ล้าง
          </button>
        </div>

        <!-- 3x4 Numpad Keypad -->
        <div class="grid grid-cols-3 gap-1 mb-2 select-none">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => `
            <button 
              type="button" 
              class="numpad-key py-2 rounded-lg bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 active:scale-95 text-white font-mono font-bold text-sm border border-slate-700 transition-all cursor-pointer shadow-sm"
              data-key="${num}"
            >
              ${num}
            </button>
          `).join('')}
          <button 
            type="button" 
            class="numpad-key py-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 active:scale-95 text-slate-400 font-mono font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="C"
            title="ล้างตัวเลข"
          >
            C
          </button>
          <button 
            type="button" 
            class="numpad-key py-2 rounded-lg bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 active:scale-95 text-white font-mono font-bold text-sm border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="0"
          >
            0
          </button>
          <button 
            type="button" 
            class="numpad-key py-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 active:scale-95 text-slate-400 font-mono font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm"
            data-key="BACK"
            title="ลบตัวล่าสุด"
          >
            ⌫
          </button>
        </div>

        <!-- Big Start Cooldown Button -->
        <button 
          type="button" 
          id="numpad-btn-start-${spot.id}" 
          class="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all mb-2 cursor-pointer"
        >
          <span>⏱️</span>
          <span>เริ่มจับเวลา</span>
        </button>
      `}

      <!-- Edit Spot Button -->
      <div class="flex items-center justify-end">
        <button 
          type="button"
          id="popup-edit-${spot.id}" 
          class="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700 cursor-pointer"
        >
          ✏️ แก้ไขข้อมูลหมุด
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  const copyBtn = popupNode.querySelector(`#popup-copy-cmd-${spot.id}`) as HTMLElement | null;
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cmd);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy /tp';
      }, 1800);
    };
  }

  // Interactive Numpad Logic
  let enteredMinutes = '';
  const displayEl = popupNode.querySelector(`#numpad-display-${spot.id}`) as HTMLElement | null;

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
    if (enteredMinutes.length >= 3) return; // Limit to 3 digits (e.g. up to 999 mins)
    if (enteredMinutes === '' && digit === '0') return; // Disallow leading zero
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

  const handleStart = () => {
    const mins = parseInt(enteredMinutes, 10);
    if (!mins || mins <= 0) {
      if (displayEl) {
        displayEl.textContent = 'กดเลขก่อน';
        displayEl.className = 'text-sm font-sans font-bold text-red-400 animate-pulse';
        setTimeout(updateDisplay, 800);
      }
      return;
    }
    callbacksRef.current.onStartCooldown(spot, mins);
    const updatedCd: ActiveCooldown = {
      spotId: spot.id,
      startedAt: Date.now(),
      expiresAt: Date.now() + mins * 60 * 1000,
      durationSeconds: mins * 60,
    };
    marker.setPopupContent(createPopupNode(spot, updatedCd, callbacksRef, marker));
  };

  const numpadKeys = popupNode.querySelectorAll('.numpad-key');
  numpadKeys.forEach((keyBtn) => {
    (keyBtn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const k = keyBtn.getAttribute('data-key');
      if (k === 'C') handleClear();
      else if (k === 'BACK') handleBackspace();
      else if (k) handleDigit(k);
    };
  });

  const clearBtn = popupNode.querySelector(`#numpad-btn-clear-${spot.id}`) as HTMLElement | null;
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleClear();
    };
  }

  const startBtn = popupNode.querySelector(`#numpad-btn-start-${spot.id}`) as HTMLElement | null;
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleStart();
    };
  }

  const resetBtn = popupNode.querySelector(`#popup-reset-cd-${spot.id}`) as HTMLElement | null;
  if (resetBtn) {
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      marker.setPopupContent(createPopupNode(spot, undefined, callbacksRef, marker));
    };
  }

  const cancelBtn = popupNode.querySelector(`#popup-cancel-cd-${spot.id}`) as HTMLElement | null;
  if (cancelBtn) {
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      callbacksRef.current.onCancelCooldown(spot.id);
      marker.setPopupContent(createPopupNode(spot, undefined, callbacksRef, marker));
    };
  }

  const editBtn = popupNode.querySelector(`#popup-edit-${spot.id}`) as HTMLElement | null;
  if (editBtn) {
    editBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      callbacksRef.current.onEditSpot(spot);
      marker.closePopup();
    };
  }

  // Keyboard support when popup has focus
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

  return popupNode;
}

export const MapView = ({
  spots,
  activeLayer,
  activeCooldowns,
  isDistanceMode,
  distancePoints,
  onAddDistancePoint,
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
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const lockedLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const activeCooldownsRef = useRef(activeCooldowns);
  activeCooldownsRef.current = activeCooldowns;
  const selectedSpotRef = useRef(selectedSpot);
  selectedSpotRef.current = selectedSpot;
  const prevActiveCooldownsRef = useRef<ActiveCooldown[]>(activeCooldowns);

  // Store callbacks in ref to avoid re-binding map events on parent re-renders
  const callbacksRef = useRef({
    onAddDistancePoint,
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
  });

  useEffect(() => {
    callbacksRef.current = {
      onAddDistancePoint,
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
    };
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const layerConfig = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];

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

    // Create layer groups for markers & distance & locked target
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    const distanceGroup = L.layerGroup().addTo(map);
    distanceLayerGroupRef.current = distanceGroup;

    const lockedGroup = L.layerGroup().addTo(map);
    lockedLayerGroupRef.current = lockedGroup;

    mapInstanceRef.current = map;
    setMapReady(true);

    // Zoom listener
    map.on('zoomend', () => {
      callbacksRef.current.onZoomChange(map.getZoom());
    });
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
      // If coordinates are locked, freeze coordinate updates
      if (callbacksRef.current.isCoordsLocked) return;

      lastCoords = latLngToGameCoords(e.latlng);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (lastCoords) {
            callbacksRef.current.onCursorMove(lastCoords);
          }
          rafId = null;
        });
      }
    };

    const handleMouseLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Keep last known coordinates active when leaving map so HUD buttons (/tp, pin) remain stable without vanishing or jitter
    };

    map.on('mousemove', handleMouseMove);
    map.getContainer().addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      map.off('move', handleMapMove);
      map.off('moveend', handleMapMove);
      map.getContainer().removeEventListener('mouseleave', handleMouseLeave);
      markersMapRef.current.clear();
      markersLayerGroupRef.current = null;
      distanceLayerGroupRef.current = null;
      lockedLayerGroupRef.current = null;
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

  // Handle map events (single-click for distance tool, double-click for pin creation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Unified trigger with debouncing to prevent double execution
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
      // Ignore click if originating from within a popup, marker, or control
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

      // Close open popup when clicking outside on the map
      map.closePopup();

      if (isDistanceMode) {
        const coords = latLngToGameCoords(e.latlng);
        callbacksRef.current.onAddDistancePoint(coords);
        soundEffects.playPinPlaced();
        return;
      }

      // Fast double-tap / double-click detection (within 400ms)
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

    const handleMapDblClick = (e: L.LeafletMouseEvent) => {
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

      if (!isDistanceMode) {
        const coords = latLngToGameCoords(e.latlng);
        triggerCreatePin(coords);
      }
    };

    // Native DOM double-click handler on map container ensures reliable event capture
    const container = map.getContainer();
    const handleNativeDblClick = (e: MouseEvent) => {
      if (isDistanceMode) return;
      // Allow Shift or Alt key or Ghost Mode to bypass marker hit testing
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
    map.on('dblclick', handleMapDblClick);
    container.addEventListener('dblclick', handleNativeDblClick);

    return () => {
      map.off('click', handleMapClick);
      map.off('dblclick', handleMapDblClick);
      container.removeEventListener('dblclick', handleNativeDblClick);
    };
  }, [mapReady, isDistanceMode, isGhostMode]);

  // Synchronize Markers on Map (only when spots, mode, or selection changes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    const currentSpotIds = new Set(spots.map((s) => s.id));

    // 1. Remove deleted spots
    markersMapRef.current.forEach((marker, id) => {
      if (!currentSpotIds.has(id)) {
        group.removeLayer(marker);
        markersMapRef.current.delete(id);
      }
    });

    // 2. Add or update spots
    spots.forEach((spot) => {
      const latlng = gameCoordsToLatLng(spot.x, spot.y);
      const isCurrentSelected = selectedSpot?.id === spot.id;
      const activeCd = activeCooldowns.find((c) => c.spotId === spot.id);
      const icon = getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, activeCd);
      const zIndexOffset = isCurrentSelected ? 2000 : activeCd ? 300 : 0;

      const existing = markersMapRef.current.get(spot.id);
      if (existing) {
        if (!group.hasLayer(existing)) {
          group.addLayer(existing);
        }
        // Update position and icon
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setZIndexOffset(existing.isPopupOpen() ? 3500 : zIndexOffset);

        // Crucial: Only update popup content if popup is NOT open, so user typing is NEVER lost!
        if (!existing.isPopupOpen()) {
          existing.setPopupContent(createPopupNode(spot, activeCd, callbacksRef, existing));
        }

        // Draggable handling
        if (isCurrentSelected) {
          if (!existing.dragging?.enabled()) existing.dragging?.enable();
        } else {
          if (existing.dragging?.enabled()) existing.dragging?.disable();
        }
      } else {
        // Create new marker
        const marker = L.marker(latlng, {
          icon,
          draggable: isCurrentSelected,
          zIndexOffset,
        });

        marker.bindPopup(createPopupNode(spot, activeCd, callbacksRef, marker), {
          maxWidth: 320,
          minWidth: 260,
          className: 'custom-fivem-popup',
          autoClose: false,
          closeOnClick: true,
          autoPan: false,
        });

        marker.on('popupopen', () => {
          // Cleanly close other popups so only 1 popup is open at a time without race conditions
          markersMapRef.current.forEach((otherMarker, otherId) => {
            if (otherId !== spot.id && otherMarker.isPopupOpen()) {
              otherMarker.closePopup();
            }
          });
          marker.setZIndexOffset(3500);
        });

        marker.on('popupclose', () => {
          const currentCd = activeCooldownsRef.current.find((c) => c.spotId === spot.id);
          const isSelected = selectedSpotRef.current?.id === spot.id;
          marker.setZIndexOffset(isSelected ? 2000 : currentCd ? 300 : 0);
        });

        marker.on('dragend', () => {
          const newLatLng = marker.getLatLng();
          const newCoords = latLngToGameCoords(newLatLng);
          callbacksRef.current.onSpotMoved?.(spot.id, newCoords);
          soundEffects.playPinPlaced();
        });

        group.addLayer(marker);
        markersMapRef.current.set(spot.id, marker);
      }
    });
  }, [mapReady, spots, selectedSpot?.id, isCompactMode, isGhostMode]);

  // Synchronize cooldown marker badges ONLY when activeCooldowns actually changes for a spot
  useEffect(() => {
    const prevCds = prevActiveCooldownsRef.current;
    prevActiveCooldownsRef.current = activeCooldowns;

    // Detect which spot IDs have cooldown changes
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
      const isCurrentSelected = selectedSpot?.id === spot.id;
      marker.setIcon(getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, activeCd));
      const zIndex = marker.isPopupOpen() ? 3500 : isCurrentSelected ? 2000 : activeCd ? 300 : 0;
      marker.setZIndexOffset(zIndex);
      if (!marker.isPopupOpen()) {
        marker.setPopupContent(createPopupNode(spot, activeCd, callbacksRef, marker));
      }
    });
  }, [activeCooldowns, spots, selectedSpot?.id, isCompactMode, isGhostMode]);

  // Dedicated 1-second real-time countdown updater
  // Crucial: Directly updates badge text and popup timer in the DOM!
  // NEVER calls marker.setIcon() on tick, eliminating Leaflet DOM recreation, click loss, and popup auto-close!
  useEffect(() => {
    if (activeCooldowns.length === 0) return;

    // Track urgent spots so we only update icon when crossing <= 180s threshold
    const urgentSpots = new Set<string>();
    activeCooldowns.forEach((cd) => {
      const rem = Math.max(0, Math.floor((cd.expiresAt - Date.now()) / 1000));
      if (rem > 0 && rem <= 180) urgentSpots.add(cd.spotId);
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

        // 1. Direct DOM update for marker badge text (instant, zero DOM thrashing)
        const badgeText = document.getElementById(`marker-cd-text-${cd.spotId}`);
        if (badgeText) {
          badgeText.textContent = cdTimeStr;
        }

        // Only recreate icon when crossing urgent boundary (normal -> urgent)
        const wasUrgent = urgentSpots.has(cd.spotId);
        if (isUrgent !== wasUrgent) {
          if (isUrgent) urgentSpots.add(cd.spotId);
          else urgentSpots.delete(cd.spotId);

          const marker = markersMapRef.current.get(cd.spotId);
          const spot = spots.find((s) => s.id === cd.spotId);
          if (marker && spot) {
            const isCurrentSelected = selectedSpot?.id === spot.id;
            marker.setIcon(getMarkerIcon(spot, isCurrentSelected, isCompactMode, isGhostMode, cd));
          }
        }

        // 2. Direct DOM update for popup countdown text if open
        const timerSpan = document.getElementById(`popup-cd-time-${cd.spotId}`);
        if (timerSpan) {
          timerSpan.textContent = cdTimeStr;
        }
        const statusBox = document.getElementById(`popup-cd-status-box-${cd.spotId}`);
        if (statusBox) {
          if (isReady && !statusBox.innerHTML.includes('ถึงเวลาเกิดแล้ว')) {
            statusBox.innerHTML = `<span id="popup-cd-status-${cd.spotId}" class="text-[11px] font-bold text-emerald-400 animate-pulse">✅ ถึงเวลาเกิดแล้ว!</span>`;
          } else if (isUrgent && !statusBox.innerHTML.includes('ใกล้เกิด')) {
            statusBox.innerHTML = `
              <span id="popup-cd-status-${cd.spotId}" class="text-[11px] font-mono font-bold text-red-400 animate-pulse">
                🔥 ใกล้เกิด: <span id="popup-cd-time-${cd.spotId}">${cdTimeStr}</span>
              </span>
            `;
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCooldowns, spots, selectedSpot?.id, isCompactMode, isGhostMode]);

  // Render Distance Measurement Tool Polyline & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = distanceLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!isDistanceMode || distancePoints.length === 0) return;

    const latlngs = distancePoints.map((p) => gameCoordsToLatLng(p.x, p.y));

    // Draw line
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.9,
      });
      group.addLayer(polyline);
    }

    // Draw point markers
    distancePoints.forEach((pt, index) => {
      const latlng = gameCoordsToLatLng(pt.x, pt.y);
      const circle = L.circleMarker(latlng, {
        radius: 6,
        fillColor: '#f59e0b',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });

      circle.bindTooltip(`จุดที่ ${index + 1}`, {
        permanent: true,
        direction: 'top',
        className: 'bg-slate-900 text-amber-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40',
      });

      group.addLayer(circle);
    });
  }, [isDistanceMode, distancePoints]);

  // Pan to selected spot safely
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedSpot) return;

    if (Number.isFinite(selectedSpot.x) && Number.isFinite(selectedSpot.y)) {
      try {
        const latlng = gameCoordsToLatLng(selectedSpot.x, selectedSpot.y);
        map.flyTo(latlng, Math.max(map.getZoom(), 4), {
          duration: 0.8,
        });
      } catch (err) {
        console.error('Failed to flyTo spot:', err);
      }
    }
  }, [selectedSpot]);

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

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative cursor-crosshair transition-all duration-300 ${
        isDistanceMode ? 'cursor-cell' : ''
      }`}
    />
  );
};
