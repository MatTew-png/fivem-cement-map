import { useState, useEffect, useRef } from 'react';
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
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Timer tick for real-time cooldown countdown updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (activeCooldowns.length === 0) return;
    const interval = setInterval(() => {
      setTick((t) => (t + 1) % 1000000);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCooldowns.length]);

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

    // Create layer groups for markers & distance
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    const distanceGroup = L.layerGroup().addTo(map);
    distanceLayerGroupRef.current = distanceGroup;

    mapInstanceRef.current = map;

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
      callbacksRef.current.onCursorMove(null);
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
      map.remove();
      mapInstanceRef.current = null;
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
  }, [isDistanceMode, isGhostMode]);

  // Render Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    spots.forEach((spot) => {
      const latlng = gameCoordsToLatLng(spot.x, spot.y);
      const cat = CATEGORIES[spot.category] || CATEGORIES.cement_mine;
      const isCurrentSelected = selectedSpot?.id === spot.id;

      // Cooldown calculations
      const activeCd = activeCooldowns.find((c) => c.spotId === spot.id);
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
          <div class="custom-compact-marker relative cursor-pointer flex items-center justify-center ${ghostClass}" style="width: 20px; height: 20px;">
            ${isUrgent ? `
              <div class="marker-urgent-pulse-ring" style="width: 26px; height: 26px; margin-top: -13px; margin-left: -13px;"></div>
            ` : ''}
            <div 
              class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] shadow-lg border-2 transition-transform duration-200 hover:scale-125"
              style="
                background-color: ${isUrgent ? '#ef4444' : spotColor};
                border-color: ${isCurrentSelected ? '#ffffff' : '#0f172a'};
                transform: ${isCurrentSelected ? 'scale(1.35)' : 'scale(1)'};
                box-shadow: ${isCurrentSelected ? '0 0 10px #ffffff' : '0 2px 6px rgba(0,0,0,0.6)'};
              "
              title="${spot.name} (${spot.x}, ${spot.y})"
            >
              ${spotIcon}
            </div>
            ${isUrgent ? `
              <div class="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-1 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[9px] shadow border border-yellow-200">
                🔥 ${cdTimeStr}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        markerHtml = `
          <div class="custom-pin-marker relative cursor-pointer ${isUrgent ? 'urgent-pin-highlight' : ''} ${ghostClass}" style="width: 42px; height: 48px;">
            ${isUrgent ? `
              <div class="marker-urgent-pulse-ring"></div>
              <div class="marker-urgent-pulse-ring-delayed"></div>
            ` : isReady ? `
              <div class="marker-ready-pulse-ring"></div>
            ` : isCooldown ? `
              <div class="marker-pulse-ring" style="border: 2px solid ${spotColor};"></div>
            ` : ''}

            <!-- Floating Countdown Badge above teardrop -->
            ${isUrgent ? `
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white font-black font-mono text-[10px] shadow-lg shadow-red-600/80 border border-yellow-200 animate-bounce">
                <span>🔥</span>
                <span>${cdTimeStr}</span>
              </div>
            ` : isReady ? `
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold font-sans text-[10px] shadow-lg shadow-emerald-500/80 border border-emerald-300 animate-pulse">
                <span>✅ เกิดแล้ว!</span>
              </div>
            ` : isCooldown ? `
              <div class="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 text-amber-300 font-bold font-mono text-[10px] shadow-md border border-amber-500/50">
                <span>⏱️</span>
                <span>${cdTimeStr}</span>
              </div>
            ` : ''}

            <div class="relative flex flex-col items-center">
              <div 
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl border-2 transition-transform duration-200"
                style="
                  background-color: ${isUrgent ? '#ef4444' : spotColor};
                  border-color: ${isUrgent ? '#fde047' : isCurrentSelected ? '#ffffff' : '#0f172a'};
                  transform: ${isCurrentSelected || isUrgent ? 'scale(1.2)' : 'scale(1)'};
                  box-shadow: ${isUrgent ? '0 0 16px rgba(239, 68, 68, 0.9)' : '0 4px 12px rgba(0,0,0,0.5)'};
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

      const icon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: markerHtml,
        iconSize,
        iconAnchor,
        popupAnchor: [0, -iconAnchor[1]],
      });

      const marker = L.marker(latlng, {
        icon,
        draggable: isCurrentSelected,
        zIndexOffset: isUrgent ? 2000 : isCurrentSelected ? 1500 : isReady ? 1000 : 0,
      });

      if (isCurrentSelected) {
        marker.on('dragend', () => {
          const newLatLng = marker.getLatLng();
          const newCoords = latLngToGameCoords(newLatLng);
          callbacksRef.current.onSpotMoved?.(spot.id, newCoords);
          soundEffects.playPinPlaced();
        });
      }

      // Build popup content
      const cmd = formatFiveMCommand(spot);

      const popupNode = document.createElement('div');
      popupNode.className = 'p-1 text-slate-200 text-xs font-sans min-w-[250px] max-w-[320px]';
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

        <!-- Cooldown Selection & Status Section -->
        <div class="mt-2 pt-2 border-t border-slate-700/80">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
              <span>⏱️</span>
              <span>จับเวลาคูลดาวน์</span>
            </span>
            ${isCooldown ? `
              <span class="text-[11px] font-mono font-bold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'}">
                ${isUrgent ? '🔥 ใกล้เกิด: ' : '⏳ เหลือ '}${cdTimeStr}
              </span>
            ` : isReady ? `
              <span class="text-[11px] font-bold text-emerald-400 animate-pulse">✅ ถึงเวลาเกิดแล้ว!</span>
            ` : `
              <span class="text-[10px] text-slate-400">ค่าเริ่มต้น: ${spot.cooldownMinutes || 10}น.</span>
            `}
          </div>

          <!-- Quick Preset Chips -->
          <div class="text-[10px] text-slate-400 mb-1 font-medium">เลือกเวลานับถอยหลังทันที:</div>
          <div class="grid grid-cols-4 gap-1 mb-2">
            ${[3, 5, 8, 10, 15, 20, 30, 60].map((m) => `
              <button 
                type="button" 
                class="popup-preset-cd-btn py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 font-mono font-bold text-[11px] transition-all border border-slate-700/80 ${m <= 3 ? 'hover:bg-red-500 hover:text-white border-red-500/30' : ''}" 
                data-minutes="${m}"
              >
                ${m <= 3 ? '🔥 ' : ''}${m}น.
              </button>
            `).join('')}
          </div>

          <!-- Custom Minutes Input Row -->
          <div class="flex items-center gap-1.5 mb-2">
            <div class="relative flex-1">
              <input 
                type="number" 
                id="popup-custom-min-input-${spot.id}" 
                min="1" 
                max="180" 
                placeholder="นาที เช่น 8 หรือ 20" 
                value="${spot.cooldownMinutes || 10}" 
                class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <span class="absolute right-2 top-1 text-[10px] text-slate-400 pointer-events-none">นาที</span>
            </div>
            <button 
              id="popup-start-custom-cd-${spot.id}" 
              class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-sm"
            >
              เริ่มนับ
            </button>
          </div>

          <!-- Action buttons: Cancel & Edit -->
          <div class="flex items-center gap-1.5">
            ${isCooldown || isReady ? `
              <button 
                id="popup-cancel-cd-${spot.id}" 
                class="flex-1 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-medium transition-colors text-center"
              >
                ยกเลิกการนับ
              </button>
            ` : ''}
            <button id="popup-edit-${spot.id}" class="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700">
              แก้ไขหมุด
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupNode, {
        maxWidth: 320,
        className: 'custom-fivem-popup',
      });

      // Attach event listeners when popup opens
      marker.on('popupopen', () => {
        const copyBtn = document.getElementById(`popup-copy-cmd-${spot.id}`);
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(cmd);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = 'Copy /tp';
            }, 1800);
          };
        }

        // Preset cooldown buttons click handler
        const presetBtns = popupNode.querySelectorAll('.popup-preset-cd-btn');
        presetBtns.forEach((btn) => {
          (btn as HTMLElement).onclick = () => {
            const mins = parseInt(btn.getAttribute('data-minutes') || '10', 10);
            callbacksRef.current.onStartCooldown(spot, mins);
            marker.closePopup();
          };
        });

        // Custom minute input submit
        const customInput = document.getElementById(`popup-custom-min-input-${spot.id}`) as HTMLInputElement | null;
        const customBtn = document.getElementById(`popup-start-custom-cd-${spot.id}`);
        if (customBtn && customInput) {
          customBtn.onclick = () => {
            const mins = Math.max(1, parseInt(customInput.value, 10) || 10);
            callbacksRef.current.onStartCooldown(spot, mins);
            marker.closePopup();
          };
        }

        // Cancel button
        const cancelBtn = document.getElementById(`popup-cancel-cd-${spot.id}`);
        if (cancelBtn) {
          cancelBtn.onclick = () => {
            callbacksRef.current.onCancelCooldown(spot.id);
            marker.closePopup();
          };
        }

        const editBtn = document.getElementById(`popup-edit-${spot.id}`);
        if (editBtn) {
          editBtn.onclick = () => {
            callbacksRef.current.onEditSpot(spot);
            marker.closePopup();
          };
        }
      });

      group.addLayer(marker);
    });
  }, [spots, activeCooldowns, selectedSpot, tick, isCompactMode, isGhostMode]);

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

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative cursor-crosshair transition-all duration-300 ${
        isDistanceMode ? 'cursor-cell' : ''
      }`}
    />
  );
};
