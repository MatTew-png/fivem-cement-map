import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { CoordinatesHUD } from './components/CoordinatesHUD';
import { LayerSwitcher } from './components/LayerSwitcher';
import { CooldownTracker } from './components/CooldownTracker';
import { GtaCrosshair } from './components/GtaCrosshair';
import { DistanceTool, type RouteSegment } from './components/DistanceTool';
import { MapQuickFilters } from './components/MapQuickFilters';
import { ConfirmModal } from './components/ConfirmModal';
import { Volume2, VolumeX } from 'lucide-react';
import type { CementSpot, MapTileLayer, ActiveCooldown, DistancePoint, RoutingMode } from './types/map';
import { gtaRoadRouter } from './utils/gtaRouter';
import { DEFAULT_SPOTS, MAP_LAYERS } from './data/defaultSpots';
import {
  INITIAL_QUICK_CATEGORIES_STATE,
  buildEmptyQuickCategoryCounts,
  getSpotQuickCategory,
  isCementSpot,
  type QuickCategory,
} from './utils/spotCategories';
import {
  loadSpotsFromStorage,
  saveSpotsToStorage,
  loadCooldownsFromStorage,
  saveCooldownsToStorage,
} from './utils/storage';
import { calculateGameDistance } from './utils/crs';
import { soundEffects } from './utils/sound';
import { coordsBus } from './utils/coordsBus';
import { GangAuthModal } from './components/GangAuthModal';
import { GangToast } from './components/GangToast';
import { GangWatermark } from './components/GangWatermark';
import { gangPresence, type OnlineMember, type GangNotification } from './utils/presence';
import {
  getGangSession,
  logoutGang,
  parseBranch,
  verifySessionWithServer,
  type GangSession,
  type ActivityLog,
} from './utils/gangAuth';
import { detectClientIp, reportVisitToServer } from './utils/ipLogger';

const MapView = lazy(() => import('./components/MapView').then((m) => ({ default: m.MapView })));
const Sidebar = lazy(() => import('./components/Sidebar').then((m) => ({ default: m.Sidebar })));
const PinModal = lazy(() => import('./components/PinModal').then((m) => ({ default: m.PinModal })));
const ExportImportModal = lazy(() =>
  import('./components/ExportImportModal').then((m) => ({ default: m.ExportImportModal }))
);
const GangPresenceModal = lazy(() =>
  import('./components/GangPresenceModal').then((m) => ({ default: m.GangPresenceModal }))
);
const GangBentoModal = lazy(() =>
  import('./components/GangBentoModal').then((m) => ({ default: m.GangBentoModal }))
);

export function App() {
  // State: Gang Authentication & Presence (Loaded first to isolate storage & topic per gang)
  const [gangSession, setGangSession] = useState<GangSession | null>(() => getGangSession());

  // State: Spots
  const [spots, setSpots] = useState<CementSpot[]>(() => {
    const session = getGangSession();
    return (session?.gangId ? loadSpotsFromStorage(session.gangId) : loadSpotsFromStorage()) || DEFAULT_SPOTS;
  });

  // State: Active Layer (Default to GTALens Game Map matching user's request)
  const [activeLayer, setActiveLayer] = useState<MapTileLayer>('gtalens_game');

  // State: GTA V Crosshair (ปิดเป็นค่าเริ่มต้นตามคำสั่ง พร้อมบันทึกการตั้งค่าลง localStorage)
  const [showCrosshair, setShowCrosshair] = useState<boolean>(() => {
    const saved = localStorage.getItem('fivem_map_show_crosshair');
    return saved !== null ? saved === 'true' : false;
  });

  const handleToggleCrosshair = useCallback(() => {
    setShowCrosshair((prev) => {
      const next = !prev;
      localStorage.setItem('fivem_map_show_crosshair', String(next));
      return next;
    });
  }, []);

  // State: Active Cooldowns
  const [activeCooldowns, setActiveCooldowns] = useState<ActiveCooldown[]>(() => {
    const session = getGangSession();
    return session?.gangId ? loadCooldownsFromStorage(session.gangId) : loadCooldownsFromStorage();
  });

  // State: Coordinates HUD & Zoom & Lock (Decoupled from root re-renders for buttery 144 FPS)
  const cursorCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const [isCoordsLocked, setIsCoordsLocked] = useState(false);
  const [lockedCoords, setLockedCoords] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(3);
  const [mapCenterCoords, setMapCenterCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    return coordsBus.subscribe((coords) => {
      cursorCoordsRef.current = coords;
    });
  }, []);

  // State: Precision tools (เปิดโหมดหมุดจิ๋วเป็นค่าเริ่มต้นเสมอตามคำสั่ง)
  const [isCompactMode, setIsCompactMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fivem_map_compact_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleCompactMode = useCallback(() => {
    setIsCompactMode((prev) => {
      const next = !prev;
      localStorage.setItem('fivem_map_compact_mode', String(next));
      return next;
    });
  }, []);

  const [isGhostMode, setIsGhostMode] = useState(false);

  // State: Sound Mute / Streamer Mode
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => soundEffects.isMutedState());

  const handleToggleSound = useCallback(() => {
    const next = soundEffects.toggleMuted();
    setIsSoundMuted(next);
    if (!next) {
      soundEffects.playPinPlaced();
    }
  }, []);

  // State: Filter Cement Spots Visibility (Default to true so everyone sees all spots immediately)
  const [showCementSpots, setShowCementSpots] = useState<boolean>(() => {
    const saved = localStorage.getItem('fivem_map_show_cement');
    return saved !== null ? saved === 'true' : true;
  });

  // State: Category Filter Pills on Map
  const [categoriesState, setCategoriesState] = useState<Record<QuickCategory, boolean>>(() => {
    const cementSaved = localStorage.getItem('fivem_map_show_cement');
    const defaults: Record<QuickCategory, boolean> = {
      ...INITIAL_QUICK_CATEGORIES_STATE,
      cement: cementSaved !== null ? cementSaved === 'true' : INITIAL_QUICK_CATEGORIES_STATE.cement,
    };
    try {
      const saved = localStorage.getItem('fivem_map_categories_state_v1');
      if (saved) {
        return { ...defaults, ...(JSON.parse(saved) as Partial<Record<QuickCategory, boolean>>) };
      }
    } catch {
      // Ignore invalid JSON
    }
    return defaults;
  });

  // State: Smart Clustering Engine (Default ON)
  const [isClusteringEnabled, setIsClusteringEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fivem_map_clustering_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const handleToggleCategory = useCallback((cat: QuickCategory) => {
    setCategoriesState((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      localStorage.setItem('fivem_map_categories_state_v1', JSON.stringify(next));
      if (cat === 'cement') {
        setShowCementSpots(next.cement);
        localStorage.setItem('fivem_map_show_cement', String(next.cement));
      }
      return next;
    });
  }, []);

  const handleSetCategoriesState = useCallback((next: Record<QuickCategory, boolean>) => {
    setCategoriesState(next);
    localStorage.setItem('fivem_map_categories_state_v1', JSON.stringify(next));
    setShowCementSpots(next.cement);
    localStorage.setItem('fivem_map_show_cement', String(next.cement));
  }, []);

  const handleToggleClustering = useCallback(() => {
    setIsClusteringEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('fivem_map_clustering_enabled', String(next));
      return next;
    });
  }, []);

  const handleToggleCementSpots = useCallback(() => {
    setShowCementSpots((prev) => {
      const next = !prev;
      localStorage.setItem('fivem_map_show_cement', String(next));
      setCategoriesState((cPrev) => {
        const cNext = { ...cPrev, cement: next };
        localStorage.setItem('fivem_map_categories_state_v1', JSON.stringify(cNext));
        return cNext;
      });
      return next;
    });
  }, []);

  const cementCount = useMemo(() => {
    return spots.filter(isCementSpot).length;
  }, [spots]);

  const spotsRef = useRef<CementSpot[]>(spots);
  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);

  // State: Gang UI Modals, Selection & Members
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Partial<CementSpot> | null>(null);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<CementSpot | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fivem_map_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleCollapseSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fivem_map_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Toggle selection: clicking the same spot again deselects it and clears highlight
  const handleSelectSpot = useCallback((spot: CementSpot | null) => {
    setSelectedSpot((prev) => {
      if (prev && spot && prev.id === spot.id) {
        return null;
      }
      return spot;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSpot(null);
  }, []);

  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState(false);
  const [isBentoModalOpen, setIsBentoModalOpen] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<GangNotification[]>([]);

  // Effect: When gang session changes, sync spots & cooldowns for this specific gang
  useEffect(() => {
    if (gangSession?.gangId) {
      const gangSpots = loadSpotsFromStorage(gangSession.gangId);
      const resolvedSpots = gangSpots && gangSpots.length > 0 ? gangSpots : DEFAULT_SPOTS;
      spotsRef.current = resolvedSpots;
      setSpots(resolvedSpots);
      const gangCooldowns = loadCooldownsFromStorage(gangSession.gangId);
      setActiveCooldowns(gangCooldowns);
    }
  }, [gangSession?.gangId]);

  const handleCopyGangLink = useCallback(() => {
    const branch = parseBranch(gangSession?.gangId || gangSession?.gangName);
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://runthukverb-auth-api.workers.dev';
    const link = `${origin}/?branch=${branch.num}`;
    navigator.clipboard.writeText(link).catch(() => {});
    gangPresence.triggerNotification({
      type: 'spot_add',
      title: 'คัดลอกลิงก์สาขาแล้ว!',
      subtitle: `ส่งลิงก์ ${branch.name} (${link}) ให้เพื่อนเข้าได้ทันที`,
      icon: '🔗',
    });
  }, [gangSession?.gangId, gangSession?.gangName]);

  // State: IP Security & Ban Detection
  const [isBannedClient, setIsBannedClient] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [clientIpAddress, setClientIpAddress] = useState('');

  // Effect: Immediate Visitor IP Tracking & Server-Side Ban Check on Boot
  useEffect(() => {
    let cancelled = false;
    detectClientIp().then((info) => {
      if (cancelled) return;
      setClientIpAddress(info.ip);
      if (info.banned) {
        setIsBannedClient(true);
        setBanReason(info.banReason ?? null);
        logoutGang();
        setGangSession(null);
        return;
      }

      const active = getGangSession();
      reportVisitToServer(active?.memberName || 'Guest', active?.gangId || 'unauthenticated').then((visit) => {
        if (cancelled) return;
        if (visit.ip && visit.ip !== 'unknown') {
          setClientIpAddress(visit.ip);
        }
        if (visit.banned) {
          setIsBannedClient(true);
          setBanReason(visit.banReason ?? null);
          logoutGang();
          setGangSession(null);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Effect: Server-Side Signed Session Verification & Ban Enforcement
  useEffect(() => {
    if (!gangSession) return;
    let cancelled = false;

    const validateWithServer = async () => {
      const result = await verifySessionWithServer(gangSession);
      if (cancelled) return;

      if (result.banned) {
        setIsBannedClient(true);
        setBanReason(result.banReason ?? null);
        logoutGang();
        gangPresence.stop();
        setGangSession(null);
        return;
      }

      if (!result.valid) {
        logoutGang();
        gangPresence.stop();
        setGangSession(null);
        setNotifications((prev) => [
          {
            id: `session-expired-${Date.now()}`,
            type: 'cooldown_cancel',
            title: 'เซสชั่นถูกยกเลิกหรือหมดอายุ',
            subtitle: 'กรุณายืนยันรหัส PIN ใหม่อีกครั้ง',
            icon: '🔒',
            timestamp: Date.now(),
          },
          ...prev.slice(0, 6),
        ]);
        return;
      }

      if (
        result.session &&
        (result.session.channelKey !== gangSession.channelKey ||
          result.session.isMaster !== gangSession.isMaster)
      ) {
        setGangSession(result.session);
      }
    };

    void validateWithServer();
    const serverCheckTimer = setInterval(validateWithServer, 30000);
    return () => {
      cancelled = true;
      clearInterval(serverCheckTimer);
    };
  }, [gangSession]);

  // Effect: Periodic Local Session Validation & URL Branch Sync
  useEffect(() => {
    const syncSession = () => {
      const active = getGangSession();
      if (!active && gangSession) {
        setGangSession(null);
        gangPresence.stop();
      } else if (
        active &&
        (!gangSession ||
          active.gangId !== gangSession.gangId ||
          active.isMaster !== gangSession.isMaster ||
          active.token !== gangSession.token)
      ) {
        setGangSession(active);
      }
    };

    const timer = setInterval(syncSession, 2000);
    window.addEventListener('popstate', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      clearInterval(timer);
      window.removeEventListener('popstate', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [gangSession]);

  // Effect: Connect to gang presence & cooldown & spot synchronization
  useEffect(() => {
    if (!gangSession) return;

    gangPresence.start(gangSession);

    const unsubPresence = gangPresence.subscribe((members, logs) => {
      setOnlineMembers(members);
      setActivityLogs(logs);
    });

    const unsubCdSync = gangPresence.subscribeCooldownSync((syncData) => {
      if (syncData.action === 'start') {
        const durationSeconds = syncData.durationMinutes * 60;
        const now = Date.now();
        const expiresAt = now + durationSeconds * 1000;
        setActiveCooldowns((prev) => {
          const filtered = prev.filter((c) => c.spotId !== syncData.spotId);
          return [...filtered, { spotId: syncData.spotId, spotName: syncData.spotName, startedAt: now, expiresAt, durationSeconds }];
        });
        soundEffects.playCooldownStarted();
      } else if (syncData.action === 'cancel') {
        setActiveCooldowns((prev) => prev.filter((c) => c.spotId !== syncData.spotId));
      }
    });

    const unsubNotification = gangPresence.subscribeNotification((notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 6)]);
    });

    const unsubSpotSync = gangPresence.subscribeSpotSync((event) => {
      if (event.action === 'add' && event.spot) {
        setSpots((prev) => {
          if (prev.some((s) => s.id === event.spot!.id)) return prev;
          return [event.spot!, ...prev];
        });
      } else if (event.action === 'update' && event.spot) {
        setSpots((prev) => prev.map((s) => (s.id === event.spot!.id ? event.spot! : s)));
        setSelectedSpot((prev) => (prev?.id === event.spot!.id ? event.spot! : prev));
      } else if (event.action === 'move' && event.spot) {
        const movedAt = Date.now();
        setSpots((prev) =>
          prev.map((s) =>
            s.id === event.spot!.id
              ? { ...s, x: event.spot!.x, y: event.spot!.y, updatedAt: movedAt }
              : s
          )
        );
        setSelectedSpot((prev) =>
          prev?.id === event.spot!.id
            ? { ...prev, x: event.spot!.x, y: event.spot!.y, updatedAt: movedAt }
            : prev
        );
      } else if (event.action === 'delete') {
        setSpots((prev) => prev.filter((s) => s.id !== event.spotId));
        setActiveCooldowns((prev) => {
          const updated = prev.filter((c) => c.spotId !== event.spotId);
          gangPresence.broadcastCooldownManifest(updated);
          return updated;
        });
        setSelectedSpot((prev) => (prev?.id === event.spotId ? null : prev));
      }
    });

    // Auto-link & Sync all custom spots across all members
    const unsubManifest = gangPresence.subscribeSpotManifest((customSpots, senderName) => {
      setSpots((prev) => {
        const existingMap = new Map(prev.map((s) => [s.id, s]));
        let addedCount = 0;
        customSpots.forEach((cs) => {
          const old = existingMap.get(cs.id);
          if (!old) {
            existingMap.set(cs.id, cs);
            addedCount++;
          } else if (cs.updatedAt > (old.updatedAt || 0)) {
            existingMap.set(cs.id, cs);
          }
        });
        if (addedCount > 0) {
          soundEffects.playPinPlaced();
          gangPresence.triggerNotification({
            type: 'spot_add',
            title: 'ซิงค์จุดจากเพื่อนในแก๊ง',
            subtitle: `ได้รับ ${addedCount} จุดเพิ่มเติมจาก ${senderName}`,
            icon: '🔄',
          });
        }
        return Array.from(existingMap.values());
      });
    });

    // Auto-link & Sync all running cooldowns across all members (คนเข้าหลังได้รับทันที)
    const unsubCdManifest = gangPresence.subscribeCooldownManifest((incomingCds, senderName) => {
      setActiveCooldowns((prev) => {
        const now = Date.now();
        const prevMap = new Map(prev.filter((c) => c.expiresAt > now - 60000).map((c) => [c.spotId, c]));
        let hasChange = false;
        let newCount = 0;

        incomingCds.forEach((ic) => {
          if (!ic || ic.expiresAt <= now - 60000) return;
          const existing = prevMap.get(ic.spotId);
          if (!existing) {
            prevMap.set(ic.spotId, ic);
            hasChange = true;
            newCount++;
          } else if (Math.abs(existing.expiresAt - ic.expiresAt) > 3000) {
            if (ic.startedAt > existing.startedAt) {
              prevMap.set(ic.spotId, ic);
              hasChange = true;
            }
          }
        });

        if (hasChange && newCount > 0) {
          gangPresence.triggerNotification({
            type: 'cooldown_start',
            title: 'ซิงค์คูลดาวน์จากเพื่อนในแก๊ง',
            subtitle: `พบ ${newCount} จุดกำลังนับถอยหลังอยู่ในแก๊ง (จาก ${senderName})`,
            icon: '⏳',
          });
        }

        if (hasChange) {
          return Array.from(prevMap.values());
        }
        return prev;
      });
    });

    // ตอบสนองเมื่อมีเพื่อนในแก๊งร้องขอซิงค์ข้อมูล หรือมีคนเพิ่งต่อเน็ตเข้ามาใหม่
    const unsubSyncReq = gangPresence.subscribeSyncRequest(() => {
      const defIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
      const custom = (loadSpotsFromStorage(gangSession.gangId) || []).filter((s) => !defIds.has(s.id));
      if (custom.length > 0) {
        gangPresence.broadcastSpotManifest(custom);
      }
      // ส่งคูลดาวน์ที่กำลังนับถอยหลัง ให้คนที่เปิดเว็บตามมาทีหลังได้รับทันที
      const currentCds = loadCooldownsFromStorage(gangSession.gangId) || [];
      const now = Date.now();
      const validCds = currentCds.filter((c) => c && c.expiresAt > now - 60000);
      if (validCds.length > 0) {
        gangPresence.broadcastCooldownManifest(validCds);
      }
    });

    // Broadcast our custom spots to any online peer on join & to retained cloud topic
    const defaultIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    const currentCustom = (loadSpotsFromStorage(gangSession.gangId) || []).filter((s) => !defaultIds.has(s.id));
    if (currentCustom.length > 0) {
      gangPresence.broadcastSpotManifest(currentCustom);
    }

    return () => {
      unsubPresence();
      unsubCdSync();
      unsubNotification();
      unsubSpotSync();
      unsubManifest();
      unsubCdManifest();
      unsubSyncReq();
      gangPresence.stop();
    };
  }, [gangSession]);


  // State: Distance Measuring & Farming Route Tool
  const [isDistanceMode, setIsDistanceMode] = useState(false);
  const [distancePoints, setDistancePoints] = useState<DistancePoint[]>([]);
  const [routingMode, setRoutingMode] = useState<RoutingMode>(() => {
    try {
      const saved = localStorage.getItem('fivem_map_routing_mode');
      if (saved === 'road' || saved === 'straight') return saved;
    } catch {}
    return 'road';
  });
  const [roadRouteData, setRoadRouteData] = useState<{
    fullPath: { x: number; y: number }[];
    totalDistance: number;
    segmentDistances: number[];
  } | null>(null);

  // Compute Road Route only when authenticated, in distance mode, and on road routing
  useEffect(() => {
    if (!gangSession || !isDistanceMode || routingMode !== 'road' || distancePoints.length < 2) {
      return;
    }

    let isMounted = true;
    gtaRoadRouter.init().then(() => {
      if (!isMounted) return;
      const res = gtaRoadRouter.calculateMultiPointRoute(distancePoints);
      setRoadRouteData(res);
    });

    return () => {
      isMounted = false;
    };
  }, [gangSession, isDistanceMode, routingMode, distancePoints]);

  const activeRoadRoute =
    routingMode === 'road' && distancePoints.length >= 2 ? roadRouteData : null;

  // Computed: Total Distance & Route Segments (Road or Straight)
  const { totalDistance, segments } = useMemo(() => {
    if (distancePoints.length < 2) {
      return { totalDistance: 0, segments: [] as RouteSegment[] };
    }

    if (routingMode === 'road' && activeRoadRoute) {
      const segs: RouteSegment[] = [];
      for (let i = 0; i < distancePoints.length - 1; i++) {
        const p1 = distancePoints[i];
        const p2 = distancePoints[i + 1];
        const dist = activeRoadRoute.segmentDistances[i] ?? calculateGameDistance(p1, p2);
        segs.push({
          fromLabel: p1.label || `จุดที่ ${i + 1}`,
          toLabel: p2.label || `จุดที่ ${i + 2}`,
          distance: dist,
        });
      }
      return { totalDistance: activeRoadRoute.totalDistance, segments: segs };
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
  }, [distancePoints, routingMode, activeRoadRoute]);

  // Category counts for quick filter pills
  const categoryCounts = useMemo(() => {
    const counts = buildEmptyQuickCategoryCounts();
    spots.forEach((spot) => {
      const cat = getSpotQuickCategory(spot);
      counts[cat]++;
    });
    return counts;
  }, [spots]);

  // Spots visible on map (filters respect category toggles + keeps selected spot always visible)
  const visibleSpotsOnMap = useMemo(() => {
    return spots.filter((spot) => {
      if (selectedSpot?.id === spot.id) return true;
      return Boolean(categoriesState[getSpotQuickCategory(spot)]);
    });
  }, [spots, categoriesState, selectedSpot?.id]);

  // Auto-save spots
  useEffect(() => {
    saveSpotsToStorage(spots, gangSession?.gangId);
  }, [spots, gangSession?.gangId]);

  // Auto-save cooldowns
  useEffect(() => {
    saveCooldownsToStorage(activeCooldowns, gangSession?.gangId);
  }, [activeCooldowns, gangSession?.gangId]);

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
      category: 'landmark',
      icon: '/blips/radar_player_king_white.png',
      color: '#38bdf8',
      cooldownMinutes: 10,
    });
    setIsPinModalOpen(true);
  }, []);

  const handleMapClickToCreatePin = useCallback((coords: { x: number; y: number }) => {
    setEditingSpot({
      x: coords.x,
      y: coords.y,
      z: 30.0,
      category: 'landmark',
      icon: '/blips/radar_player_king_white.png',
      color: '#38bdf8',
      cooldownMinutes: 10,
    });
    setIsPinModalOpen(true);
  }, []);

  const handleEditSpot = useCallback((spot: CementSpot) => {
    setEditingSpot(spot);
    setIsPinModalOpen(true);
  }, []);

  const handleSaveSpot = useCallback((spot: CementSpot) => {
    const prevSpots = spotsRef.current;
    const isNew = !prevSpots.some((s) => s.id === spot.id);
    const nextSpots = isNew
      ? [spot, ...prevSpots]
      : prevSpots.map((s) => (s.id === spot.id ? spot : s));

    spotsRef.current = nextSpots;
    setSpots(nextSpots);
    setSelectedSpot(spot);
    soundEffects.playPinPlaced();

    // มั่นใจว่าหมวดของหมุดที่เพิ่มใหม่จะไม่ถูกซ่อนบนแผนที่ทันที
    const spotCat = getSpotQuickCategory(spot);
    setCategoriesState((prev) => {
      if (!prev[spotCat]) {
        const next = { ...prev, [spotCat]: true };
        try {
          localStorage.setItem('fivem_map_categories_state_v1', JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });

    gangPresence.broadcastSpotChange(isNew ? 'add' : 'update', spot);

    // ส่งชุดหมุดที่อัปเดตแล้วขึ้น HiveMQ Retained Topic ทันที เพื่อให้คนที่เปิดทีหลังได้หมุดนี้ด้วยแน่นอน!
    const defaultIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    const customSpots = nextSpots.filter((s) => !defaultIds.has(s.id));
    gangPresence.broadcastSpotManifest(customSpots);
  }, []);

  const handleDeleteSpot = useCallback((id: string) => {
    const nextSpots = spotsRef.current.filter((s) => s.id !== id);
    spotsRef.current = nextSpots;
    setSpots(nextSpots);
    setActiveCooldowns((prev) => prev.filter((c) => c.spotId !== id));
    setSelectedSpot((prev) => (prev?.id === id ? null : prev));
    gangPresence.broadcastSpotChange('delete', undefined, id);

    // อัปเดตชุดหมุดบน HiveMQ Retained Topic ทันที
    const defaultIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    const customSpots = nextSpots.filter((s) => !defaultIds.has(s.id));
    gangPresence.broadcastSpotManifest(customSpots);
  }, []);

  const handleSpotMoved = useCallback((spotId: string, newCoords: { x: number; y: number }) => {
    let movedSpot: CementSpot | undefined;
    const movedAt = Date.now();
    const nextSpots = spotsRef.current.map((s) => {
      if (s.id === spotId) {
        movedSpot = { ...s, x: newCoords.x, y: newCoords.y, updatedAt: movedAt };
        return movedSpot;
      }
      return s;
    });
    if (!movedSpot) return;

    spotsRef.current = nextSpots;
    setSpots(nextSpots);
    setSelectedSpot((prev) => (prev?.id === spotId ? movedSpot! : prev));
    gangPresence.broadcastSpotChange('move', movedSpot);
    const defaultIds = new Set(DEFAULT_SPOTS.map((s) => s.id));
    const customSpots = nextSpots.filter((s) => !defaultIds.has(s.id));
    gangPresence.broadcastSpotManifest(customSpots);
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
      const updated = [...filtered, { spotId: spot.id, spotName: spot.name, startedAt: now, expiresAt, durationSeconds }];
      gangPresence.broadcastCooldownManifest(updated);
      return updated;
    });

    gangPresence.broadcastCooldown(spot.id, spot.name, mins, 'start');
    soundEffects.playCooldownStarted();
  }, []);

  const handleCancelCooldown = useCallback((spotId: string) => {
    setActiveCooldowns((prev) => {
      const updated = prev.filter((c) => c.spotId !== spotId);
      gangPresence.broadcastCooldownManifest(updated);
      return updated;
    });
    gangPresence.broadcastCooldown(spotId, '', 0, 'cancel');
  }, []);

  const handleFocusSpot = useCallback((spot: CementSpot) => {
    setSelectedSpot(spot);
  }, []);

  const handleImport = useCallback((importedSpots: CementSpot[]) => {
    spotsRef.current = importedSpots;
    setSpots(importedSpots);
    saveSpotsToStorage(importedSpots, gangSession?.gangId);
    soundEffects.playPinPlaced();
  }, [gangSession?.gangId]);

  const handleResetDefault = useCallback(() => {
    spotsRef.current = DEFAULT_SPOTS;
    setSpots(DEFAULT_SPOTS);
    setActiveCooldowns([]);
    saveSpotsToStorage(DEFAULT_SPOTS, gangSession?.gangId);
  }, [gangSession?.gangId]);

  const handleClearAllSpots = useCallback(() => {
    setIsClearConfirmOpen(true);
  }, []);

  const handleConfirmClearAllSpots = useCallback(() => {
    spotsRef.current = [];
    setSpots([]);
    setActiveCooldowns([]);
    saveSpotsToStorage([], gangSession?.gangId);
    setSelectedSpot(null);
    setIsClearConfirmOpen(false);
  }, [gangSession?.gangId]);

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

  const handleToggleRoutingMode = useCallback((mode: RoutingMode) => {
    setRoutingMode(mode);
    try {
      localStorage.setItem('fivem_map_routing_mode', mode);
    } catch {}
  }, []);

  const handleSetRoutePair = useCallback((startSpot: CementSpot, endSpot: CementSpot) => {
    setIsDistanceMode(true);
    setDistancePoints([
      { x: startSpot.x, y: startSpot.y, label: startSpot.name, spotId: startSpot.id },
      { x: endSpot.x, y: endSpot.y, label: endSpot.name, spotId: endSpot.id },
    ]);
    soundEffects.playPinPlaced();
  }, []);

  const activeLayerConfig = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];

  if (isBannedClient) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-4xl mb-4 text-red-500 animate-pulse shadow-xl shadow-red-500/10">
          🚫
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-wide uppercase">ระงับการเข้าถึงเว็บไซต์</h1>
        <p className="text-sm text-slate-400 max-w-md mb-2">
          IP Address ของคุณ (<span className="font-mono text-red-400 font-bold">{clientIpAddress || 'IP ที่ถูกบล็อก'}</span>) ถูกระงับการเข้าใช้งานโดยหัวหน้าแก๊ง
        </p>
        {banReason && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-500/30 rounded-xl px-3 py-1.5 max-w-md mb-3">
            เหตุผล: {banReason}
          </p>
        )}
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อหัวหน้าแก๊งเพื่อขอปลดแบน IP ของคุณ
        </p>
        <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-500 font-mono">
          Security Enforcement • FiveM RunThukVerb
        </div>
      </div>
    );
  }

  if (!gangSession) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
        <GangAuthModal onSuccess={(session) => setGangSession(session)} />
        <GangToast
          notifications={notifications}
          onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Subtle Dynamic Watermark Overlay (Anti-Screenshot/Leak) */}
      <GangWatermark
        memberName={gangSession.memberName}
        gangName={gangSession.gangName}
        authDate={gangSession.authDate}
      />

      {/* Collapsible Left Sidebar (Lazy Loaded after Auth) */}
      <Suspense
        fallback={
          sidebarCollapsed ? null : (
            <aside className="hidden md:block fixed top-0 left-0 bottom-0 z-[1001] w-80 lg:w-96 bg-slate-950 border-r border-slate-800/80 animate-pulse" />
          )
        }
      >
        <Sidebar
          spots={spots}
          activeCooldowns={activeCooldowns}
          onSelectSpot={handleSelectSpot}
          onAddNewSpot={handleAddNewSpot}
          onEditSpot={handleEditSpot}
          onDeleteSpot={handleDeleteSpot}
          onStartCooldown={handleStartCooldown}
          onCancelCooldown={handleCancelCooldown}
          onOpenExportImport={() => setIsExportImportOpen(true)}
          onClearAllSpots={handleClearAllSpots}
          selectedSpotId={selectedSpot?.id}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapseSidebar}
          showCementSpots={showCementSpots}
          onToggleCementSpots={handleToggleCementSpots}
          onlineCount={onlineMembers.length}
          onOpenPresence={() => setIsPresenceModalOpen(true)}
          onOpenBento={() => setIsBentoModalOpen(true)}
          memberName={gangSession.memberName}
          gangName={gangSession.gangName || 'สาขา 1'}
          onCopyGangLink={handleCopyGangLink}
          isMaster={gangSession.isMaster}
        />
      </Suspense>

      {/* Main Map Area */}
      <main
        className={`flex-1 h-full relative transition-all duration-300 ${
          sidebarCollapsed ? 'ml-0' : 'ml-0 md:ml-80 lg:ml-96'
        }`}
      >
        {/* Floating Quick Category & Cluster Filter Pills */}
        <MapQuickFilters
          categoriesState={categoriesState}
          onToggleCategory={handleToggleCategory}
          onSetCategoriesState={handleSetCategoriesState}
          isClusteringEnabled={isClusteringEnabled}
          onToggleClustering={handleToggleClustering}
          counts={categoryCounts}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Leaflet Map Engine (Lazy Loaded after Auth) */}
        <Suspense
          fallback={
            <div className="w-full h-full bg-slate-950 flex items-center justify-center text-xs text-slate-400 font-mono">
              กำลังโหลดเอนจินแผนที่...
            </div>
          }
        >
          <MapView
            spots={visibleSpotsOnMap}
            activeLayer={activeLayer}
            activeCooldowns={activeCooldowns}
            onMapClickToCreatePin={handleMapClickToCreatePin}
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
            routingMode={routingMode}
            roadRouteData={activeRoadRoute}
            onAddDistancePoint={handleAddDistancePoint}
            onStartMeasureFromSpot={handleStartMeasureFromSpot}
            isMaster={gangSession.isMaster}
            isClusteringEnabled={isClusteringEnabled}
            onFocusSpot={handleFocusSpot}
            onClearSelection={handleClearSelection}
          />
        </Suspense>

        {/* GTA V In-Game Reticle / Crosshair */}
        <GtaCrosshair visible={showCrosshair} />

        {/* Top Right: Unified HUD Controls (Distance Tool + Sound Toggle + Layer Switcher) */}
        <div className="absolute top-4 right-4 z-[1000] flex items-start gap-2.5 pointer-events-none select-none">
          {/* Distance Measurement & Farming Route Planner Tool */}
          <DistanceTool
            isActive={isDistanceMode}
            onToggle={handleToggleDistance}
            points={distancePoints}
            totalDistance={totalDistance}
            segments={segments}
            routingMode={routingMode}
            onToggleRoutingMode={handleToggleRoutingMode}
            spots={spots}
            onSetRoutePair={handleSetRoutePair}
            onClear={handleClearDistance}
            onUndo={handleUndoDistancePoint}
            onLoop={handleLoopDistance}
          />

          {/* Sound Mute/Unmute Toggle (Streamer Mode) */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-pressed={isSoundMuted}
            aria-label={isSoundMuted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
            className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xl border cursor-pointer backdrop-blur-md ${
              isSoundMuted
                ? 'bg-red-950/90 text-red-300 border-red-500/80 shadow-red-500/20 hover:bg-red-900/90'
                : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
            }`}
            title={isSoundMuted ? 'เปิดเสียงเอฟเฟกต์ (ขณะนี้ปิดเสียงโหมดสตรีม)' : 'ปิดเสียงเอฟเฟกต์ (เหมาะสำหรับเปิดสตรีม)'}
          >
            {isSoundMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-red-400" />
                <span className="hidden sm:inline">ปิดเสียง (สตรีม)</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">เสียงเปิด</span>
              </>
            )}
          </button>

          {/* Layer Switcher */}
          <LayerSwitcher
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
          />
        </div>

        {/* Active Cooldowns Floating Card */}
        <CooldownTracker
          cooldowns={activeCooldowns}
          spots={spots}
          onCancelCooldown={handleCancelCooldown}
          onFocusSpot={handleFocusSpot}
        />

        {/* Bottom Left: Coordinates HUD */}
        <CoordinatesHUD
          lockedCoords={lockedCoords}
          zoom={zoom}
          activeLayerName={activeLayerConfig.name.split(' ')[0]}
          showCrosshair={showCrosshair}
          onToggleCrosshair={handleToggleCrosshair}
          onPinAtCrosshair={handlePinAtCrosshair}
          isCompactMode={isCompactMode}
          onToggleCompactMode={handleToggleCompactMode}
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

      {/* Lazy-Loaded Modals */}
      {isPinModalOpen && (
        <Suspense fallback={null}>
          <PinModal
            isOpen={isPinModalOpen}
            onClose={() => {
              setIsPinModalOpen(false);
              setEditingSpot(null);
            }}
            onSave={handleSaveSpot}
            initialSpot={editingSpot}
            onDelete={handleDeleteSpot}
            isMaster={gangSession.isMaster}
          />
        </Suspense>
      )}

      {/* GTA V HUD Floating Gang Notifications */}
      <GangToast
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
      />

      {isExportImportOpen && (
        <Suspense fallback={null}>
          <ExportImportModal
            isOpen={isExportImportOpen}
            onClose={() => setIsExportImportOpen(false)}
            spots={spots}
            onImport={handleImport}
            onResetDefault={handleResetDefault}
            isMaster={gangSession.isMaster}
          />
        </Suspense>
      )}

      {isPresenceModalOpen && (
        <Suspense fallback={null}>
          <GangPresenceModal
            isOpen={isPresenceModalOpen}
            onClose={() => setIsPresenceModalOpen(false)}
            onlineMembers={onlineMembers}
            activityLogs={activityLogs}
            currentSession={gangSession}
            onLogout={() => {
              logoutGang(gangSession.gangId);
              gangPresence.stop();
              setGangSession(null);
              setIsPresenceModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {isBentoModalOpen && (
        <Suspense fallback={null}>
          <GangBentoModal
            isOpen={isBentoModalOpen}
            onClose={() => setIsBentoModalOpen(false)}
            spots={spots}
            activeCooldowns={activeCooldowns}
            onlineMembers={onlineMembers}
            activityLogs={activityLogs}
            currentSession={gangSession}
            onOpenPresence={() => {
              setIsBentoModalOpen(false);
              setIsPresenceModalOpen(true);
            }}
          />
        </Suspense>
      )}

      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="ลบหมุดทั้งหมดบนแผนที่?"
        description="คุณต้องการลบหมุดและคูลดาวน์ที่กำลังทำงานทั้งหมดออกจากเครื่องนี้ใช่หรือไม่? (สามารถกดรีเซ็ตกลับเป็นค่าเริ่มต้นได้ภายหลังผ่าน Export / Import)"
        confirmLabel="ยืนยันลบทั้งหมด"
        cancelLabel="ยกเลิก"
        danger
        onConfirm={handleConfirmClearAllSpots}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
}

export default App;
