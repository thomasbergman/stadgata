import { getCachedData, setCachedData } from './cache.js';
import { transformCoordinates } from '../utils/coordinateUtils.js';
import { getStreetCache, getViewportCacheKey, getPrefetchManager } from './viewportCache.js';

// Get API key from environment variable
// In Vite, environment variables must be prefixed with VITE_ to be exposed to the client
const API_KEY = import.meta.env.VITE_STOCKHOLM_API_KEY;

if (!API_KEY) {
  console.error('VITE_STOCKHOLM_API_KEY is not set. Please create a .env.local file with your API key.');
}

// Always use proxy to avoid CORS issues in production
// The proxy is handled by Vite dev server in development and Vercel serverless function in production
const BASE_URL = '/api';

export interface StreetSegment {
  id: string;
  streetName: string;
  addressRange: string;
  cleaningDay: string;
  coordinates: [number, number][]; // WGS84 coordinates [lon, lat]
  geometry?: {
    type: string;
    coordinates: number[][]; // Original SWEREF99 coordinates
  };
}

export interface StockholmAPIResponse {
  features?: Array<{
    properties: {
      gatunamn?: string;
      fromtom?: string;
      servicedag?: string;
      [key: string]: any;
    };
    geometry?: {
      type: string;
      coordinates: number[][];
    };
  }>;
  [key: string]: any;
}

/**
 * Fetch street cleaning data from Stockholm API
 * Uses cache if available and valid (24 hours)
 */
export async function fetchStreetData(): Promise<StreetSegment[]> {
  const cacheKey = 'all-streets';
  
  // Check cache first
  const cached = getCachedData<StreetSegment[]>(cacheKey);
  if (cached) {
    console.log('Using cached street data');
    return cached;
  }

  try {
    // Fetch from API via proxy (API key is handled server-side)
    const url = `${BASE_URL}/all?outputFormat=json`;
    console.log('Fetching street data from API...', url);
    
    // Add timeout for mobile networks (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error('Fetch timeout after 30 seconds');
          throw new Error('Begäran tog för lång tid. Kontrollera din internetanslutning.');
        }
        // Check for network errors
        if (fetchError.message.includes('Failed to fetch') || 
            fetchError.message.includes('NetworkError') ||
            fetchError.message.includes('Network request failed')) {
          console.error('Network error:', fetchError.message);
          throw new Error('Nätverksfel. Kontrollera din internetanslutning och försök igen.');
        }
      }
      throw fetchError;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500)
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // Check if response has content
    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      console.error('Empty response from API');
      throw new Error('Empty response from API');
    }

    let data: StockholmAPIResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', {
        responsePreview: responseText.substring(0, 500),
        error: parseError
      });
      throw new Error('Invalid JSON response from API');
    }
    
    // Debug: Log the structure of the first feature to understand the API response format
    if (data.features && Array.isArray(data.features) && data.features.length > 0) {
      const firstFeature = data.features[0];
      console.log('First feature sample:', {
        properties: firstFeature.properties,
        allPropertyKeys: Object.keys(firstFeature.properties || {}),
        geometryType: firstFeature.geometry?.type,
        firstCoord: firstFeature.geometry?.coordinates?.[0],
        rawFeature: firstFeature
      });
      
      // Also check if properties might be at the root level
      console.log('Full first feature structure:', JSON.stringify(firstFeature, null, 2).substring(0, 500));
    }
    
    // Transform API response to our format
    const streets = transformAPIResponse(data);

    console.log(`Fetched ${streets.length} street segments`);
    
    // Cache the transformed data (may fail if data is too large)
    const cached = setCachedData(cacheKey, streets);
    if (!cached) {
      console.log('Data not cached due to storage limitations, but fetched successfully');
    }
    
    return streets;
  } catch (error) {
    console.error('Error fetching street data:', error);
    throw error;
  }
}

/**
 * Transform API response features to StreetSegment array
 * Shared logic between fetchStreetData and fetchStreetDataByViewport
 */
function transformAPIResponse(data: StockholmAPIResponse): StreetSegment[] {
  const streets: StreetSegment[] = [];
  
  // Handle GeoJSON format with features array
  if (data.features && Array.isArray(data.features)) {
    for (const feature of data.features) {
      const props = feature.properties || {};
      const geometry = feature.geometry;
      
      if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
        continue;
      }

      // Try multiple property name variations (case-insensitive check)
      const streetNameKey = Object.keys(props).find(k => 
        k.toLowerCase() === 'gatunamn' || 
        k.toLowerCase() === 'street_name' ||
        k.toLowerCase() === 'streetname' ||
        k === 'STREET_NAME'
      );
      const streetName = streetNameKey ? props[streetNameKey] : 
                        (props.gatunamn || props.GATUNAMN || props.STREET_NAME || 'Unknown Street');
      
      const addressRangeKey = Object.keys(props).find(k => 
        k.toLowerCase() === 'fromtom' || 
        k.toLowerCase() === 'from_to' ||
        k === 'FROMTOM' || k === 'FROM_TO'
      );
      const addressRange = addressRangeKey ? props[addressRangeKey] : 
                          (props.fromtom || props.FROMTOM || props.FROM_TO || '');
      
      // The API uses START_WEEKDAY for the cleaning day
      const cleaningDay = props.START_WEEKDAY || 
                         (() => {
                           const key = Object.keys(props).find(k => 
                             k === 'START_WEEKDAY' ||
                             k.toLowerCase() === 'start_weekday' ||
                             k.toLowerCase().includes('weekday') ||
                             k.toLowerCase() === 'servicedag' || 
                             k.toLowerCase() === 'service_day' ||
                             k.toLowerCase() === 'cleaning_day' ||
                             k.toLowerCase() === 'dag' ||
                             k === 'SERVICEDAG' || 
                             k === 'SERVICE_DAY' ||
                             k === 'CLEANING_DAY' ||
                             k === 'DAG'
                           );
                           return key ? props[key] : '';
                         })();

      // Handle different geometry types
      let coordinates: number[][] = [];
      const coords = geometry.coordinates;
      
      if (geometry.type === 'LineString' || geometry.type === 'LINESTRING') {
        if (Array.isArray(coords) && coords.length > 0) {
          if (Array.isArray(coords[0])) {
            coordinates = coords as number[][];
          } else {
            coordinates = [coords as unknown as number[]];
          }
        }
      } else if (geometry.type === 'MultiLineString' || geometry.type === 'MULTILINESTRING') {
        if (Array.isArray(coords) && Array.isArray(coords[0])) {
          coordinates = (coords as unknown as number[][][]).flat();
        }
      } else {
        if (Array.isArray(coords) && coords.length > 0) {
          if (Array.isArray(coords[0])) {
            coordinates = coords as number[][];
          } else {
            coordinates = [coords as unknown as number[]];
          }
        }
      }

      if (coordinates.length < 2) continue;

      // Transform coordinates from SWEREF99 to WGS84
      const wgs84Coords = transformCoordinates(coordinates);

      streets.push({
        id: `${streetName}-${addressRange}-${cleaningDay}-${Math.random()}`,
        streetName,
        addressRange,
        cleaningDay,
        coordinates: wgs84Coords,
        geometry: {
          type: geometry.type || 'LineString',
          coordinates: coordinates
        }
      });
    }
  } else if (Array.isArray(data)) {
    // Handle case where API returns array directly
    for (const item of data) {
      const props = item.properties || item;
      const geometry = item.geometry || item;
      
      if (!geometry || !geometry.coordinates) {
        continue;
      }

      const streetName = props.gatunamn || props.GATUNAMN || 'Unknown Street';
      const addressRange = props.fromtom || props.FROMTOM || '';
      const cleaningDay = props.servicedag || props.SERVICEDAG || '';

      const coordinates = Array.isArray(geometry.coordinates[0])
        ? geometry.coordinates as number[][]
        : [geometry.coordinates as number[]];

      if (coordinates.length < 2) continue;

      const wgs84Coords = transformCoordinates(coordinates);

      streets.push({
        id: `${streetName}-${addressRange}-${cleaningDay}-${Math.random()}`,
        streetName,
        addressRange,
        cleaningDay,
        coordinates: wgs84Coords,
        geometry: {
          type: geometry.type || 'LineString',
          coordinates: coordinates
        }
      });
    }
  }
  
  return streets;
}

/**
 * Fetch street cleaning data for a specific viewport using the 'within' operation
 * Uses improved street-level cache to avoid duplicates and enable merging
 * @param center - [latitude, longitude] of the viewport center
 * @param radius - Radius in meters from the center
 * @param skipPrefetch - If true, skip background prefetching (for prefetch calls themselves)
 * @returns Array of street segments within the viewport
 */
export async function fetchStreetDataByViewport(
  center: [number, number],
  radius: number,
  skipPrefetch: boolean = false
): Promise<StreetSegment[]> {
  const [lat, lng] = center;
  const cache = getStreetCache();
  const cacheKey = getViewportCacheKey(center, radius);
  
  // Check improved cache first
  if (cache.hasViewport(cacheKey)) {
    const cachedStreets = cache.getStreetsForViewport(cacheKey);
    console.log(`Using cached viewport data for ${cacheKey}: ${cachedStreets.length} streets`);
    
    // Prefetch surrounding areas in background (if not already prefetching)
    if (!skipPrefetch) {
      const prefetchManager = getPrefetchManager();
      prefetchManager.prefetchSurrounding(center, radius, (c, r) => 
        fetchStreetDataByViewport(c, r, true)
      ).catch(err => console.warn('Background prefetch failed:', err));
    }
    
    return cachedStreets;
  }

  try {
    // Fetch from API via proxy using 'within' operation
    // API format: /servicedagar/within?radius={RADIUS}&lat={LAT}&lng={LNG}
    const url = `${BASE_URL}/within?radius=${radius}&lat=${lat}&lng=${lng}&outputFormat=json`;
    console.log(`Fetching street data for viewport: center [${lat}, ${lng}], radius ${radius}m...`);
    
    // Add timeout for mobile networks (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error('Fetch timeout after 30 seconds');
          throw new Error('Begäran tog för lång tid. Kontrollera din internetanslutning.');
        }
        // Check for network errors
        if (fetchError.message.includes('Failed to fetch') || 
            fetchError.message.includes('NetworkError') ||
            fetchError.message.includes('Network request failed')) {
          console.error('Network error:', fetchError.message);
          throw new Error('Nätverksfel. Kontrollera din internetanslutning och försök igen.');
        }
      }
      throw fetchError;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500)
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // Check if response has content
    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      console.error('Empty response from API');
      throw new Error('Empty response from API');
    }

    let data: StockholmAPIResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', {
        responsePreview: responseText.substring(0, 500),
        error: parseError
      });
      throw new Error('Invalid JSON response from API');
    }
    
    // Transform API response to our format
    const streets = transformAPIResponse(data);

    console.log(`Fetched ${streets.length} street segments for viewport`);
    
    // If we got no streets, log a warning but don't throw an error
    // (this might be normal if the viewport has no streets)
    if (streets.length === 0) {
      console.warn('No street segments found for viewport:', {
        center: [lat, lng],
        radius: radius,
        dataFeatures: data.features?.length || 0
      });
    }
    
    // Cache using improved street-level cache
    cache.addStreetsForViewport(cacheKey, streets);
    
    // Prefetch surrounding areas in background (if not already prefetching)
    if (!skipPrefetch) {
      const prefetchManager = getPrefetchManager();
      prefetchManager.prefetchSurrounding(center, radius, (c, r) => 
        fetchStreetDataByViewport(c, r, true)
      ).catch(err => console.warn('Background prefetch failed:', err));
    }
    
    return streets;
  } catch (error) {
    console.error('Error fetching viewport street data:', error);
    throw error;
  }
}

