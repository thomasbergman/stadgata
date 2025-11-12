const CACHE_PREFIX = 'stockholm-street-data';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data if it exists and is still valid (within 24 hours)
 * @param key - Cache key
 * @returns Cached data or null if not found or expired
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}-${key}`);
    if (!cached) return null;

    const parsed: CachedData<T> = JSON.parse(cached);
    const now = Date.now();

    if (now - parsed.timestamp > CACHE_DURATION_MS) {
      // Cache expired, remove it
      localStorage.removeItem(`${CACHE_PREFIX}-${key}`);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

/**
 * Estimate the size of data in bytes when serialized to JSON
 */
function estimateDataSize<T>(data: T): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/**
 * Store data in cache with timestamp
 * @param key - Cache key
 * @param data - Data to cache
 * @returns true if successfully cached, false otherwise
 */
export function setCachedData<T>(key: string, data: T): boolean {
  // Estimate data size before attempting to cache
  const dataSize = estimateDataSize(data);
  const estimatedSizeMB = (dataSize / (1024 * 1024)).toFixed(2);
  
  // localStorage typically has a 5-10MB limit, warn if data is very large
  if (dataSize > 5 * 1024 * 1024) {
    console.warn(`Data size (${estimatedSizeMB}MB) is very large, caching may fail due to localStorage quota limits`);
  }
  
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_PREFIX}-${key}`, JSON.stringify(cached));
    return true;
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn(`Cache storage quota exceeded for data size: ${estimatedSizeMB}MB`);
      
      // Only try to clear and retry if the data isn't obviously too large
      // If data is > 8MB, it's likely too large even after clearing
      if (dataSize < 8 * 1024 * 1024) {
        try {
          clearCache();
          // Retry once after clearing
          localStorage.setItem(`${CACHE_PREFIX}-${key}`, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
          console.log('Successfully cached data after clearing old cache');
          return true;
        } catch (retryError) {
          console.warn(`Unable to cache data (${estimatedSizeMB}MB) even after clearing old cache. Data is too large for localStorage.`);
          return false;
        }
      } else {
        console.warn(`Data (${estimatedSizeMB}MB) is too large to cache even after clearing. Skipping cache.`);
        return false;
      }
    }
    console.error('Error writing cache:', error);
    return false;
  }
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

