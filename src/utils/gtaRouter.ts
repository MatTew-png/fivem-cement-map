// GTA V Vehicle Road Network Router using A* Algorithm
import { calculateGameDistance } from './crs';

interface RoadNetworkData {
  nodes: [number, number][]; // [x, y]
  edges: number[][];         // adjacency list of neighbor indices
}

class MinHeap {
  private heap: { val: number; priority: number }[] = [];

  push(val: number, priority: number) {
    this.heap.push({ val, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): number | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0].val;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private _bubbleUp(idx: number) {
    while (idx > 0) {
      const pIdx = (idx - 1) >> 1;
      if (this.heap[idx].priority < this.heap[pIdx].priority) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[pIdx];
        this.heap[pIdx] = tmp;
        idx = pIdx;
      } else break;
    }
  }

  private _sinkDown(idx: number) {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = (idx << 1) + 1;
      const right = left + 1;
      if (left < len && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest !== idx) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[smallest];
        this.heap[smallest] = tmp;
        idx = smallest;
      } else break;
    }
  }
}

class GtaRoadRouter {
  private networkData: RoadNetworkData | null = null;
  private isLoaded = false;
  private loadPromise: Promise<boolean> | null = null;

  private cellSize = 100;
  private spatialGrid = new Map<string, number[]>();

  async init(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const base = import.meta.env.BASE_URL || './';
        const cleanBase = base.endsWith('/') ? base : `${base}/`;
        const res = await fetch(`${cleanBase}gta5_road_network.json`);
        if (!res.ok) {
          throw new Error(`Failed to load road network: ${res.status}`);
        }
        const data: RoadNetworkData = await res.json();
        this.networkData = data;

        // Build spatial grid for O(1) nearest node lookups
        this.spatialGrid.clear();
        for (let i = 0; i < data.nodes.length; i++) {
          const [nx, ny] = data.nodes[i];
          const cx = Math.floor(nx / this.cellSize);
          const cy = Math.floor(ny / this.cellSize);
          const key = `${cx},${cy}`;
          let cell = this.spatialGrid.get(key);
          if (!cell) {
            cell = [];
            this.spatialGrid.set(key, cell);
          }
          cell.push(i);
        }

        this.isLoaded = true;
        return true;
      } catch (err) {
        console.error('[GtaRoadRouter] Failed to load GTA V road network:', err);
        this.loadPromise = null;
        return false;
      }
    })();

    return this.loadPromise;
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  findNearestNode(x: number, y: number): number {
    if (!this.networkData) return -1;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let r = 0; r <= 8; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cell = this.spatialGrid.get(key);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              const idx = cell[i];
              const [nx, ny] = this.networkData.nodes[idx];
              const d = Math.hypot(nx - x, ny - y);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = idx;
              }
            }
          }
        }
      }
      if (bestIdx !== -1 && bestDist <= r * this.cellSize) break;
    }
    return bestIdx;
  }

  private aStar(startIdx: number, endIdx: number): number[] | null {
    if (!this.networkData) return null;
    if (startIdx === endIdx) return [startIdx];

    const nodes = this.networkData.nodes;
    const edges = this.networkData.edges;
    const nodeCount = nodes.length;

    const [endX, endY] = nodes[endIdx];
    const gScore = new Float32Array(nodeCount).fill(Infinity);
    const cameFrom = new Int32Array(nodeCount).fill(-1);
    const openSet = new MinHeap();

    gScore[startIdx] = 0;
    openSet.push(startIdx, Math.hypot(nodes[startIdx][0] - endX, nodes[startIdx][1] - endY));

    let iterations = 0;
    const maxIterations = 35000;

    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;
      const current = openSet.pop();
      if (current === null) break;

      if (current === endIdx) {
        // Reconstruct path
        const path: number[] = [current];
        let curr = current;
        while (cameFrom[curr] !== -1) {
          curr = cameFrom[curr];
          path.push(curr);
        }
        return path.reverse();
      }

      const [cx, cy] = nodes[current];
      const currentG = gScore[current];
      const nbrs = edges[current];

      for (let i = 0; i < nbrs.length; i++) {
        const neighbor = nbrs[i];
        const [nx, ny] = nodes[neighbor];
        const dist = Math.hypot(nx - cx, ny - cy);
        const tentativeG = currentG + dist;

        if (tentativeG < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeG;
          const h = Math.hypot(nx - endX, ny - endY);
          openSet.push(neighbor, tentativeG + h);
        }
      }
    }

    return null;
  }

  calculateRouteBetween(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): { path: { x: number; y: number }[]; distance: number } {
    if (!this.isLoaded || !this.networkData) {
      // Fallback straight line
      const d = calculateGameDistance(p1, p2);
      return { path: [p1, p2], distance: d };
    }

    const startNode = this.findNearestNode(p1.x, p1.y);
    const endNode = this.findNearestNode(p2.x, p2.y);

    if (startNode === -1 || endNode === -1) {
      const d = calculateGameDistance(p1, p2);
      return { path: [p1, p2], distance: d };
    }

    const nodePath = this.aStar(startNode, endNode);
    if (!nodePath || nodePath.length === 0) {
      const d = calculateGameDistance(p1, p2);
      return { path: [p1, p2], distance: d };
    }

    const path: { x: number; y: number }[] = [p1];
    let totalDist = 0;

    let prev = p1;
    for (let i = 0; i < nodePath.length; i++) {
      const idx = nodePath[i];
      const [nx, ny] = this.networkData.nodes[idx];
      const pt = { x: nx, y: ny };
      totalDist += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      path.push(pt);
      prev = pt;
    }

    // Connect from last node to p2
    totalDist += Math.hypot(p2.x - prev.x, p2.y - prev.y);
    path.push(p2);

    return {
      path,
      distance: Math.round(totalDist),
    };
  }

  calculateMultiPointRoute(
    waypoints: { x: number; y: number }[]
  ): {
    fullPath: { x: number; y: number }[];
    totalDistance: number;
    segmentDistances: number[];
  } {
    if (waypoints.length < 2) {
      return { fullPath: waypoints, totalDistance: 0, segmentDistances: [] };
    }

    const fullPath: { x: number; y: number }[] = [];
    let totalDistance = 0;
    const segmentDistances: number[] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const result = this.calculateRouteBetween(p1, p2);

      segmentDistances.push(result.distance);
      totalDistance += result.distance;

      if (i === 0) {
        fullPath.push(...result.path);
      } else {
        // Skip duplicate connecting point
        fullPath.push(...result.path.slice(1));
      }
    }

    return {
      fullPath,
      totalDistance,
      segmentDistances,
    };
  }
}

export const gtaRoadRouter = new GtaRoadRouter();
