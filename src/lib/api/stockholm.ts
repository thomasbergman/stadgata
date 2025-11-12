import { getCachedData, setCachedData } from './cache.js';
import { transformCoordinates } from '../utils/coordinateUtils.js';

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
    
    const response = await fetch(url);
    
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
 * Uses cache if available and valid (24 hours)
 * @param center - [latitude, longitude] of the viewport center
 * @param radius - Radius in meters from the center
 * @returns Array of street segments within the viewport
 */
export async function fetchStreetDataByViewport(
  center: [number, number],
  radius: number
): Promise<StreetSegment[]> {
  const [lat, lng] = center;
  
  // Create cache key based on viewport (rounded to avoid cache fragmentation)
  const roundedLat = Math.round(lat * 100) / 100; // Round to ~1km precision
  const roundedLng = Math.round(lng * 100) / 100;
  const roundedRadius = Math.round(radius / 100) * 100; // Round to 100m precision
  const cacheKey = `viewport-${roundedLat}-${roundedLng}-${roundedRadius}`;
  
  // Check cache first
  const cached = getCachedData<StreetSegment[]>(cacheKey);
  if (cached) {
    console.log(`Using cached viewport data for ${cacheKey}`);
    return cached;
  }

  try {
    // Fetch from API via proxy using 'within' operation
    // API format: /servicedagar/within?radius={RADIUS}&lat={LAT}&lng={LNG}
    const url = `${BASE_URL}/within?radius=${radius}&lat=${lat}&lng=${lng}&outputFormat=json`;
    console.log(`Fetching street data for viewport: center [${lat}, ${lng}], radius ${radius}m...`);
    
    const response = await fetch(url);
    
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
    
    // Cache the transformed data
    const cached = setCachedData(cacheKey, streets);
    if (!cached) {
      console.log('Viewport data not cached due to storage limitations, but fetched successfully');
    }
    
    return streets;
  } catch (error) {
    console.error('Error fetching viewport street data:', error);
    throw error;
  }
}

