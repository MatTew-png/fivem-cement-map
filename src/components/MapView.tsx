import { useEffect, useRef } from 'react';
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
  onZoomChange: (zoom: number) => void;
  onEditSpot: (spot: CementSpot) => void;
  onDeleteSpot: (id: string) => void;
  onStartCooldown: (spot: CementSpot) => void;
  selectedSpot: CementSpot | null;
  sidebarCollapsed: boolean;
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
  onZoomChange,
  onEditSpot,
  onDeleteSpot,
  onStartCooldown,
  selectedSpot,
  sidebarCollapsed,
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Store callbacks in ref to avoid re-binding map events on parent re-renders
  const callbacksRef = useRef({
    onAddDistancePoint,
    onMapClickToCreatePin,
    onCursorMove,
    onZoomChange,
    onEditSpot,
    onDeleteSpot,
    onStartCooldown,
  });

  useEffect(() => {
    callbacksRef.current = {
      onAddDistancePoint,
      onMapClickToCreatePin,
      onCursorMove,
      onZoomChange,
      onEditSpot,
      onDeleteSpot,
      onStartCooldown,
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
      maxZoom: 7,
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
      maxZoom: layerConfig.maxZoom,
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
      maxZoom: layerConfig.maxZoom,
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
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('.leaflet-popup') ||
        target?.closest('.leaflet-control') ||
        target?.closest('.custom-pin-marker') ||
        target?.closest('button')
      ) {
        return;
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
  }, [isDistanceMode]);

  // Render Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    spots.forEach((spot) => {
      const latlng = gameCoordsToLatLng(spot.x, spot.y);
      const cat = CATEGORIES[spot.category] || CATEGORIES.cement_mine;
      const isCooldown = activeCooldowns.some((c) => c.spotId === spot.id);
      const isCurrentSelected = selectedSpot?.id === spot.id;

      const spotIcon = spot.icon || cat?.icon || '🧱';
      const spotColor = spot.color || cat?.color || '#f59e0b';

      // Custom HTML Marker Icon
      const markerHtml = `
        <div class="custom-pin-marker relative cursor-pointer" style="width: 36px; height: 42px;">
          ${isCooldown ? `<div class="marker-pulse-ring" style="border: 2px solid ${spotColor};"></div>` : ''}
          <div class="relative flex flex-col items-center">
            <div 
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl border-2 transition-transform duration-200"
              style="
                background-color: ${spotColor};
                border-color: ${isCurrentSelected ? '#ffffff' : '#0f172a'};
                transform: ${isCurrentSelected ? 'scale(1.2)' : 'scale(1)'};
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              "
            >
              <span>${spotIcon}</span>
            </div>
            <div 
              class="w-0 h-0 border-x-4 border-x-transparent border-t-[6px] -mt-0.5"
              style="border-top-color: ${spotColor};"
            ></div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: markerHtml,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
        popupAnchor: [0, -42],
      });

      const marker = L.marker(latlng, { icon });

      // Build popup content
      const cmd = formatFiveMCommand(spot);

      const popupNode = document.createElement('div');
      popupNode.className = 'p-1 text-slate-200 text-xs font-sans min-w-[240px] max-w-[300px]';
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

        <div class="flex items-center gap-1.5 pt-1 border-t border-slate-800">
          ${spot.cooldownMinutes ? `
            <button id="popup-cooldown-${spot.id}" class="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] text-center transition-colors">
              ${isCooldown ? '⏳ กำลังคูลดาวน์' : `⏱️ เริ่มคูลดาวน์ (${spot.cooldownMinutes}น.)`}
            </button>
          ` : ''}
          <button id="popup-edit-${spot.id}" class="p-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700">
            แก้ไข
          </button>
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

        const cdBtn = document.getElementById(`popup-cooldown-${spot.id}`);
        if (cdBtn) {
          cdBtn.onclick = () => {
            callbacksRef.current.onStartCooldown(spot);
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
  }, [spots, activeCooldowns, selectedSpot]);

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
