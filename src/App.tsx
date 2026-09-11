import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { CoordinatesHUD } from './components/CoordinatesHUD';
import { LayerSwitcher } from './components/LayerSwitcher';
import { PinModal } from './components/PinModal';
import { CooldownTracker } from './components/CooldownTracker';
import { ExportImportModal } from './components/ExportImportModal';
import { GtaCrosshair } from './components/GtaCrosshair';
import { DistanceTool, type RouteSegment } from './components/DistanceTool';
import type { CementSpot, MapTileLayer, ActiveCooldown, DistancePoint } from './types/map';
import { DEFAULT_SPOTS, MAP_LAYERS } from './data/defaultSpots';
import {
  loadSpotsFromStorage,
  saveSpotsToStorage,
  loadCooldownsFromStorage,
  saveCooldownsToStorage,
} from './utils/storage';
import { calculateGameDistance } from './utils/crs';
import { soundEffects } from './utils/sound';

export function App() {
  // State: Spots
  const [spots, setSpots] = useState<CementSpot[]>(() => {
    return loadSpotsFromStorage() || DEFAULT_SPOTS;
  });

  // State: Active Layer (Default to GTALens Game Map matching user's request)
  const [activeLayer, setActiveLayer] = useState<MapTileLayer>('gtalens_game');

  // State: GTA V Crosshair
  const [showCrosshair, setShowCrosshair] = useState(true);

  // State: Active Cooldowns
  const [activeCooldowns, setActiveCooldowns] = useState<ActiveCooldown[]>(() => {
    return loadCooldownsFromStorage();
  });

  // State: Coordinates HUD & Zoom & Lock
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const cursorCoordsRef = useRef(cursorCoords);
  cursorCoordsRef.current = cursorCoords;
  const [isCoordsLocked, setIsCoordsLocked] = useState(false);
  const [lockedCoords, setLockedCoords] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(3);
  const [mapCenterCoords, setMapCenterCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // State: Precision tools (Compact Mode & Ghost Mode)
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);

  // State: Filter Cement Spots Visibility (Default to false so cement spots don't overlap landmarks)
  const [showCementSpots, setShowCementSpots] = useState<boolean>(() => {
    const saved = localStorage.getItem('fivem_map_show_cement');
    return saved !== null ? saved === 'true' : false;
  });

  const handleToggleCementSpots = useCallback(() => {
    setShowCementSpots((prev) => {
      const next = !prev;
      localStorage.setItem('fivem_map_show_cement', String(next));
      return next;
    });
  }, []);

  const cementCount = useMemo(() => {
    return spots.filter((s) => s.category === 'cement_mine').length;
  }, [spots]);


  // State: Distance Measuring & Farming Route Tool
  const [isDistanceMode, setIsDistanceMode] = useState(false);
  const [distancePoints, setDistancePoints] = useState<DistancePoint[]>([]);

  // Computed: Total Distance & Route Segments
  const { totalDistance, segments } = useMemo(() => {
    if (distancePoints.length < 2) {
      return { totalDistance: 0, segments: [] as RouteSegment[] };
    }
    let total = 0;
    const segs: RouteSegment[] = [];
    for (let i = 0; i < distancePoints.length - 1; i++) {
      const p1 = distancePoints[i];
      const p2 = distancePoints[i + 1];
      const dist = calculateGameDistance(p1, p2);
      total += dist;
      segs.push({
        fromLabel: p1.label || `จุดที่ ${i + 1}`,
        toLabel: p2.label || `จุดที่ ${i + 2}`,
        distance: dist,
      });
    }
    return { totalDistance: total, segments: segs };
  }, [distancePoints]);

  // State: Modals & Sidebar
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Partial<CementSpot> | null>(null);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<CementSpot | null>(() => {
    const loaded = loadSpotsFromStorage() || DEFAULT_SPOTS;
    return loaded.length > 0 ? loaded[0] : null;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Spots visible on map (cement spots hidden by default to keep landmarks clear)
  const visibleSpotsOnMap = useMemo(() => {
    return spots.filter((spot) => {
      const isCement = spot.category === 'cement_mine';
      if (isCement && !showCementSpots && selectedSpot?.id !== spot.id) {
        return false;
      }
      return true;
    });
  }, [spots, showCementSpots, selectedSpot?.id]);

  // Auto-save spots
  useEffect(() => {
    saveSpotsToStorage(spots);
  }, [spots]);

  // Auto-save cooldowns
  useEffect(() => {
    saveCooldownsToStorage(activeCooldowns);
  }, [activeCooldowns]);

  // Clean expired cooldowns periodically (keeps array reference if nothing expired)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveCooldowns((prev) => {
        const filtered = prev.filter((c) => c.expiresAt > now - 120000);
        if (filtered.length === prev.length) return prev;
        return filtered;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Spot handlers
  const handleAddNewSpot = useCallback(() => {
    setEditingSpot({
      x: cursorCoordsRef.current?.x || 0,
      y: cursorCoordsRef.current?.y || 0,
      z: 30.0,
      category: 'cement_mine',
      cooldownMinutes: 10,
    });
    setIsPinModalOpen(true);
  }, []);

  const handleMapClickToCreatePin = useCallback((coords: { x: number; y: number }) => {
    setEditingSpot({
      x: coords.x,
      y: coords.y,
      z: 30.0,
      category: 'cement_mine',
      cooldownMinutes: 10,
    });
    setIsPinModalOpen(true);
  }, []);

  const handleEditSpot = useCallback((spot: CementSpot) => {
    setEditingSpot(spot);
    setIsPinModalOpen(true);
  }, []);

  const handleSaveSpot = useCallback((spot: CementSpot) => {
    setSpots((prev) => {
      const exists = prev.some((s) => s.id === spot.id);
      if (exists) {
        return prev.map((s) => (s.id === spot.id ? spot : s));
      } else {
        return [spot, ...prev];
      }
    });
    setSelectedSpot(spot);
    soundEffects.playPinPlaced();
  }, []);

  const handleDeleteSpot = useCallback((id: string) => {
    setSpots((prev) => prev.filter((s) => s.id !== id));
    setActiveCooldowns((prev) => prev.filter((c) => c.spotId !== id));
    setSelectedSpot((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleSpotMoved = useCallback((spotId: string, newCoords: { x: number; y: number }) => {
    setSpots((prev) =>
      prev.map((s) =>
        s.id === spotId
          ? { ...s, x: newCoords.x, y: newCoords.y, updatedAt: Date.now() }
          : s
      )
    );
  }, []);

  const handlePinAtCrosshair = useCallback(() => {
    handleMapClickToCreatePin(mapCenterCoords);
  }, [mapCenterCoords, handleMapClickToCreatePin]);

  // Coordinate Lock handlers
  const handleToggleLockCoords = useCallback(() => {
    setIsCoordsLocked((prev) => {
      const next = !prev;
      if (next) {
        const coords = cursorCoordsRef.current || mapCenterCoords;
        setLockedCoords(coords);
        soundEffects.playLock();
      } else {
        setLockedCoords(null);
        soundEffects.playUnlock();
      }
      return next;
    });
  }, [mapCenterCoords]);

  const handlePinAtLocked = useCallback(() => {
    if (lockedCoords) {
      handleMapClickToCreatePin(lockedCoords);
    }
  }, [lockedCoords, handleMapClickToCreatePin]);

  // Spacebar hotkey to toggle coordinate lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeEl = document.activeElement;
        const tag = activeEl?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || isPinModalOpen || isExportImportOpen) {
          return;
        }
        e.preventDefault();
        handleToggleLockCoords();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleLockCoords, isPinModalOpen, isExportImportOpen]);

  // Cooldown handlers
  const handleStartCooldown = useCallback((spot: CementSpot, customMinutes?: number) => {
    const mins = customMinutes !== undefined ? customMinutes : (spot.cooldownMinutes || 10);
    if (mins <= 0) return;

    const durationSeconds = mins * 60;
    const now = Date.now();
    const expiresAt = now + durationSeconds * 1000;

    setActiveCooldowns((prev) => {
      const filtered = prev.filter((c) => c.spotId !== spot.id);
      return [...filtered, { spotId: spot.id, startedAt: now, expiresAt, durationSeconds }];
    });

    soundEffects.playCooldownStarted();
  }, []);

  const handleCancelCooldown = useCallback((spotId: string) => {
    setActiveCooldowns((prev) => prev.filter((c) => c.spotId !== spotId));
  }, []);

  const handleFocusSpot = useCallback((spot: CementSpot) => {
    setSelectedSpot(spot);
  }, []);

  const handleImport = useCallback((importedSpots: CementSpot[]) => {
    setSpots(importedSpots);
    saveSpotsToStorage(importedSpots);
    soundEffects.playPinPlaced();
  }, []);

  const handleResetDefault = useCallback(() => {
    setSpots(DEFAULT_SPOTS);
    setActiveCooldowns([]);
    saveSpotsToStorage(DEFAULT_SPOTS);
  }, []);

  const handleClearAllSpots = useCallback(() => {
    if (confirm('คุณต้องการลบหมุดทั้งหมดบนแผนที่ใช่หรือไม่?')) {
      setSpots([]);
      setActiveCooldowns([]);
      saveSpotsToStorage([]);
      setSelectedSpot(null);
    }
  }, []);

  // Distance Tool handlers
  const handleToggleDistance = useCallback(() => {
    setIsDistanceMode((prev) => !prev);
  }, []);

  const handleAddDistancePoint = useCallback((point: DistancePoint) => {
    setDistancePoints((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
          return prev;
        }
      }
      return [...prev, point];
    });
  }, []);

  const handleUndoDistancePoint = useCallback(() => {
    setDistancePoints((prev) => prev.slice(0, -1));
    soundEffects.playUnlock();
  }, []);

  const handleLoopDistance = useCallback(() => {
    setDistancePoints((prev) => {
      if (prev.length < 2) return prev;
      const start = prev[0];
      const last = prev[prev.length - 1];
      if (Math.abs(start.x - last.x) < 0.5 && Math.abs(start.y - last.y) < 0.5) {
        return prev;
      }
      soundEffects.playPinPlaced();
      return [
        ...prev,
        {
          x: start.x,
          y: start.y,
          label: `${start.label || 'จุดที่ 1'} (จบลูป)`,
          spotId: start.spotId,
        },
      ];
    });
  }, []);

  const handleClearDistance = useCallback(() => {
    setDistancePoints([]);
  }, []);

  const handleStartMeasureFromSpot = useCallback((spot: CementSpot) => {
    setIsDistanceMode(true);
    setDistancePoints([
      {
        x: spot.x,
        y: spot.y,
        label: spot.name,
        spotId: spot.id,
      },
    ]);
    soundEffects.playPinPlaced();
  }, []);

  const activeLayerConfig = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        spots={spots}
        activeCooldowns={activeCooldowns}
        onSelectSpot={setSelectedSpot}
        onAddNewSpot={handleAddNewSpot}
        onEditSpot={handleEditSpot}
        onDeleteSpot={handleDeleteSpot}
        onStartCooldown={handleStartCooldown}
        onCancelCooldown={handleCancelCooldown}
        onOpenExportImport={() => setIsExportImportOpen(true)}
        onClearAllSpots={handleClearAllSpots}
        selectedSpotId={selectedSpot?.id}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        showCementSpots={showCementSpots}
        onToggleCementSpots={handleToggleCementSpots}
      />

      {/* Main Map Area */}
      <main
        className={`flex-1 h-full relative transition-all duration-300 ${
          sidebarCollapsed ? 'ml-0' : 'ml-0 md:ml-80 lg:ml-96'
        }`}
      >
        {/* Leaflet Map Engine */}
        <MapView
          spots={visibleSpotsOnMap}
          activeLayer={activeLayer}
          activeCooldowns={activeCooldowns}
          onMapClickToCreatePin={handleMapClickToCreatePin}
          onCursorMove={setCursorCoords}
          onCenterCoordsChange={setMapCenterCoords}
          onZoomChange={setZoom}
          onEditSpot={handleEditSpot}
          onDeleteSpot={handleDeleteSpot}
          onStartCooldown={handleStartCooldown}
          onCancelCooldown={handleCancelCooldown}
          onSpotMoved={handleSpotMoved}
          selectedSpot={selectedSpot}
          sidebarCollapsed={sidebarCollapsed}
          isCompactMode={isCompactMode}
          isGhostMode={isGhostMode}
          isCoordsLocked={isCoordsLocked}
          lockedCoords={lockedCoords}
          isDistanceMode={isDistanceMode}
          distancePoints={distancePoints}
          onAddDistancePoint={handleAddDistancePoint}
          onStartMeasureFromSpot={handleStartMeasureFromSpot}
        />

        {/* GTA V In-Game Reticle / Crosshair */}
        <GtaCrosshair visible={showCrosshair} />

        {/* Top Right: Layer Switcher */}
        <LayerSwitcher
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
        />

        {/* Distance Measurement & Farming Route Planner Tool */}
        <DistanceTool
          isActive={isDistanceMode}
          onToggle={handleToggleDistance}
          points={distancePoints}
          totalDistance={totalDistance}
          segments={segments}
          onClear={handleClearDistance}
          onUndo={handleUndoDistancePoint}
          onLoop={handleLoopDistance}
        />

        {/* Active Cooldowns Floating Card */}
        <CooldownTracker
          cooldowns={activeCooldowns}
          spots={spots}
          onCancelCooldown={handleCancelCooldown}
          onFocusSpot={handleFocusSpot}
        />

        {/* Bottom Left: Coordinates HUD */}
        <CoordinatesHUD
          cursorCoords={isCoordsLocked && lockedCoords ? lockedCoords : cursorCoords}
          zoom={zoom}
          activeLayerName={activeLayerConfig.name.split(' ')[0]}
          showCrosshair={showCrosshair}
          onToggleCrosshair={() => setShowCrosshair((prev) => !prev)}
          onPinAtCrosshair={handlePinAtCrosshair}
          isCompactMode={isCompactMode}
          onToggleCompactMode={() => setIsCompactMode((prev) => !prev)}
          isGhostMode={isGhostMode}
          onToggleGhostMode={() => setIsGhostMode((prev) => !prev)}
          isCoordsLocked={isCoordsLocked}
          onToggleLockCoords={handleToggleLockCoords}
          onPinAtLocked={handlePinAtLocked}
          showCementSpots={showCementSpots}
          onToggleCementSpots={handleToggleCementSpots}
          cementCount={cementCount}
        />
      </main>

      {/* Pin Form Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setEditingSpot(null);
        }}
        onSave={handleSaveSpot}
        initialSpot={editingSpot}
        onDelete={handleDeleteSpot}
      />

      {/* Export / Import Modal */}
      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        spots={spots}
        onImport={handleImport}
        onResetDefault={handleResetDefault}
      />
    </div>
  );
}

export default App;
