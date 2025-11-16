import type { StreetSegment } from './stockholm.js';
import { getCachedData, setCachedData } from './cache.js';

/**
 * Street-level cache that stores streets by ID to avoid duplicates
 * This allows us to merge data from multiple viewports efficiently
 */
class StreetCache {
  private cacheKey = 'street-cache-by-id';
  private streetMap: Map<string, StreetSegment> = new Map();
  private viewportCache: Map<string, Set<string>> = new Map(); // viewport key -> set of street IDs

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load cached streets from localStorage
   */
  private loadFromStorage(): void {
    try {
      const cached = getCachedData<{ streets: Array<[string, StreetSegment]>, viewports: Array<[string, string[]]> }>(this.cacheKey);
      if (cached) {
        this.streetMap = new Map(cached.streets);
        this.viewportCache = new Map(
          cached.viewports.map(([key, ids]) => [key, new Set(ids)])
        );
        console.log(`Loaded ${this.streetMap.size} cached streets from ${this.viewportCache.size} viewports`);
      }
    } catch (error) {
      console.error('Error loading street cache:', error);
    }
  }

  /**
   * Save cached streets to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        streets: Array.from(this.streetMap.entries()),
        viewports: Array.from(this.viewportCache.entries()).map(([key, ids]) => [key, Array.from(ids)])
      };
      setCachedData(this.cacheKey, data);
    } catch (error) {
      console.error('Error saving street cache:', error);
    }
  }

  /**
   * Get streets for a viewport (from cache)
   */
  getStreetsForViewport(viewportKey: string): StreetSegment[] {
    const streetIds = this.viewportCache.get(viewportKey);
    if (!streetIds) return [];

    const streets: StreetSegment[] = [];
    for (const id of streetIds) {
      const street = this.streetMap.get(id);
      if (street) {
        streets.push(street);
      }
    }
    return streets;
  }

  /**
   * Check if viewport is cached
   */
  hasViewport(viewportKey: string): boolean {
    return this.viewportCache.has(viewportKey);
  }

  /**
   * Add streets for a viewport to the cache
   */
  addStreetsForViewport(viewportKey: string, streets: StreetSegment[]): void {
    const streetIds = new Set<string>();
    
    for (const street of streets) {
      // Use street ID if available, otherwise generate one
      const id = street.id || `${street.streetName}-${street.addressRange}-${street.cleaningDay}`;
      street.id = id; // Ensure ID is set
      
      // Store street in map (will overwrite if exists, keeping latest version)
      this.streetMap.set(id, street);
      streetIds.add(id);
    }

    this.viewportCache.set(viewportKey, streetIds);
    this.saveToStorage();
  }

  /**
   * Get all cached streets (useful for merging)
   */
  getAllStreets(): StreetSegment[] {
    return Array.from(this.streetMap.values());
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.streetMap.clear();
    this.viewportCache.clear();
    try {
      localStorage.removeItem(`stockholm-street-data-${this.cacheKey}`);
    } catch (error) {
      console.error('Error clearing street cache:', error);
    }
  }

  /**
   * Get statistics about the cache
   */
  getStats(): { totalStreets: number; totalViewports: number } {
    return {
      totalStreets: this.streetMap.size,
      totalViewports: this.viewportCache.size
    };
  }
}

// Singleton instance
let streetCacheInstance: StreetCache | null = null;

export function getStreetCache(): StreetCache {
  if (!streetCacheInstance) {
    streetCacheInstance = new StreetCache();
  }
  return streetCacheInstance;
}

/**
 * Generate a cache key for a viewport
 */
export function getViewportCacheKey(center: [number, number], radius: number): string {
  const [lat, lng] = center;
  // Round to avoid cache fragmentation (round to ~500m precision)
  const roundedLat = Math.round(lat * 200) / 200; // ~500m precision
  const roundedLng = Math.round(lng * 200) / 200;
  const roundedRadius = Math.round(radius / 500) * 500; // Round to 500m precision
  return `vp-${roundedLat.toFixed(3)}-${roundedLng.toFixed(3)}-${roundedRadius}`;
}

/**
 * Prefetch manager that loads adjacent viewports in the background
 */
class PrefetchManager {
  private activePrefetches: Set<string> = new Set();
  private prefetchQueue: Array<{ center: [number, number]; radius: number }> = [];

  /**
   * Prefetch a viewport in the background
   */
  async prefetchViewport(
    center: [number, number],
    radius: number,
    fetchFn: (center: [number, number], radius: number) => Promise<StreetSegment[]>
  ): Promise<void> {
    const cacheKey = getViewportCacheKey(center, radius);
    const cache = getStreetCache();

    // Skip if already cached or currently prefetching
    if (cache.hasViewport(cacheKey) || this.activePrefetches.has(cacheKey)) {
      return;
    }

    this.activePrefetches.add(cacheKey);

    try {
      const streets = await fetchFn(center, radius);
      cache.addStreetsForViewport(cacheKey, streets);
      console.log(`Prefetched ${streets.length} streets for viewport ${cacheKey}`);
    } catch (error) {
      console.warn(`Failed to prefetch viewport ${cacheKey}:`, error);
    } finally {
      this.activePrefetches.delete(cacheKey);
    }
  }

  /**
   * Prefetch surrounding viewports around a center point
   */
  async prefetchSurrounding(
    center: [number, number],
    radius: number,
    fetchFn: (center: [number, number], radius: number) => Promise<StreetSegment[]>
  ): Promise<void> {
    const [lat, lng] = center;
    const prefetchRadius = radius * 0.8; // Slightly smaller to avoid too much overlap
    
    // Calculate offsets for 8 surrounding directions (N, NE, E, SE, S, SW, W, NW)
    const offsets = [
      [0, 1],      // North
      [0.707, 0.707], // Northeast
      [1, 0],      // East
      [0.707, -0.707], // Southeast
      [0, -1],     // South
      [-0.707, -0.707], // Southwest
      [-1, 0],     // West
      [-0.707, 0.707], // Northwest
    ];

    // Convert radius to degrees (approximate)
    const radiusInDegrees = radius / 111000; // ~111km per degree at this latitude

    const prefetchPromises = offsets.map(([dx, dy]) => {
      const newLat = lat + dy * radiusInDegrees;
      const newLng = lng + dx * radiusInDegrees;
      return this.prefetchViewport([newLat, newLng], prefetchRadius, fetchFn);
    });

    // Prefetch in background (don't await, but limit concurrency)
    Promise.all(prefetchPromises).catch(error => {
      console.warn('Some prefetch operations failed:', error);
    });
  }
}

// Singleton instance
let prefetchManagerInstance: PrefetchManager | null = null;

export function getPrefetchManager(): PrefetchManager {
  if (!prefetchManagerInstance) {
    prefetchManagerInstance = new PrefetchManager();
  }
  return prefetchManagerInstance;
}

