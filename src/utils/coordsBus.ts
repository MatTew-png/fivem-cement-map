// Lightweight Pub/Sub event bus for high-frequency cursor coordinates
// Prevents root App re-renders on mousemove (60-144 FPS)

type CoordsListener = (coords: { x: number; y: number } | null) => void;

class CoordsBus {
  private currentCoords: { x: number; y: number } | null = null;
  private listeners: Set<CoordsListener> = new Set();

  public getCoords(): { x: number; y: number } | null {
    return this.currentCoords;
  }

  public emit(coords: { x: number; y: number } | null): void {
    this.currentCoords = coords;
    this.listeners.forEach((listener) => listener(coords));
  }

  public subscribe(listener: CoordsListener): () => void {
    this.listeners.add(listener);
    listener(this.currentCoords);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const coordsBus = new CoordsBus();
