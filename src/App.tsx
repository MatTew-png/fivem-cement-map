import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { CoordinatesHUD } from './components/CoordinatesHUD';
import { LayerSwitcher } from './components/LayerSwitcher';
import { PinModal } from './components/PinModal';
import { CooldownTracker } from './components/CooldownTracker';
import { DistanceTool } from './components/DistanceTool';
import { ExportImportModal } from './components/ExportImportModal';
import { GtaCrosshair } from './components/GtaCrosshair';
import type { CementSpot, MapTileLayer, ActiveCooldown } from './types/map';
import { DEFAULT_SPOTS, MAP_LAYERS } from './data/defaultSpots';
import {
  loadSpotsFromStorage,
  saveSpotsToStorage,
  loadCooldownsFromStorage,
  saveCooldownsToStorage,
} from './utils/storage';
import { soundEffects } from './utils/sound';
import { calculateGameDistance } from './utils/crs';

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

  // State: Distance measurement tool
  const [isDistanceMode, setIsDistanceMode] = useState(false);
  const [distancePoints, setDistancePoints] = useState<{ x: number; y: number }[]>([]);

  // State: Coordinates HUD & Zoom
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const cursorCoordsRef = useRef(cursorCoords);
  cursorCoordsRef.current = cursorCoords;
  const [zoom, setZoom] = useState(3);

  // State: Modals & Sidebar
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Partial<CementSpot> | null>(null);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<CementSpot | null>(() => {
    const loaded = loadSpotsFromStorage() || DEFAULT_SPOTS;
    return loaded.length > 0 ? loaded[0] : null;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-save spots
  useEffect(() => {
    saveSpotsToStorage(spots);
  }, [spots]);

  // Auto-save cooldowns
  useEffect(() => {
    saveCooldownsToStorage(activeCooldowns);
  }, [activeCooldowns]);

  // Clean expired cooldowns periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveCooldowns((prev) => prev.filter((c) => c.expiresAt > now - 120000));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Distance calculation
  const totalDistance = useMemo(() => {
    if (distancePoints.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < distancePoints.length - 1; i++) {
      dist += calculateGameDistance(distancePoints[i], distancePoints[i + 1]);
    }
    return dist;
  }, [distancePoints]);

  const handleAddDistancePoint = useCallback((pt: { x: number; y: number }) => {
    setDistancePoints((prev) => [...prev, pt]);
  }, []);

  const handleClearDistance = useCallback(() => {
    setDistancePoints([]);
  }, []);

  const handleToggleDistance = useCallback(() => {
    setIsDistanceMode((prev) => {
      if (prev) {
        setDistancePoints([]);
      }
      return !prev;
    });
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
      />

      {/* Main Map Area */}
      <main
        className={`flex-1 h-full relative transition-all duration-300 ${
          sidebarCollapsed ? 'ml-0' : 'ml-0 md:ml-80 lg:ml-96'
        }`}
      >
        {/* Leaflet Map Engine */}
        <MapView
          spots={spots}
          activeLayer={activeLayer}
          activeCooldowns={activeCooldowns}
          isDistanceMode={isDistanceMode}
          distancePoints={distancePoints}
          onAddDistancePoint={handleAddDistancePoint}
          onMapClickToCreatePin={handleMapClickToCreatePin}
          onCursorMove={setCursorCoords}
          onZoomChange={setZoom}
          onEditSpot={handleEditSpot}
          onDeleteSpot={handleDeleteSpot}
          onStartCooldown={handleStartCooldown}
          onCancelCooldown={handleCancelCooldown}
          selectedSpot={selectedSpot}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* GTA V In-Game Reticle / Crosshair */}
        <GtaCrosshair visible={showCrosshair} />

        {/* Top Right: Layer Switcher */}
        <LayerSwitcher
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
        />

        {/* Distance Tool Toggle & Info */}
        <DistanceTool
          isActive={isDistanceMode}
          onToggle={handleToggleDistance}
          points={distancePoints}
          totalDistance={totalDistance}
          onClear={handleClearDistance}
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
          cursorCoords={cursorCoords}
          zoom={zoom}
          activeLayerName={activeLayerConfig.name.split(' ')[0]}
          showCrosshair={showCrosshair}
          onToggleCrosshair={() => setShowCrosshair((prev) => !prev)}
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
