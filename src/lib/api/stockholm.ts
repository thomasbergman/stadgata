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
    console.log('Fetching street data from API...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: StockholmAPIResponse = await response.json();
    
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
        // The API seems to use uppercase keys like STREET_NAME
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
        
        // Debug: Log all property keys for first few streets to find cleaning day
        if (streets.length < 3) {
          console.log(`Properties for street ${streets.length}:`, {
            allKeys: Object.keys(props),
            values: Object.entries(props).slice(0, 10).map(([k, v]) => ({ key: k, value: v }))
          });
        }
        
        // The API uses START_WEEKDAY for the cleaning day (e.g., 'måndag', 'tisdag', etc.)
        // Try direct access first, then fallback to searching
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
        
        // Debug: Log what we found
        if (streets.length < 3) {
          console.log(`Cleaning day for street ${streets.length}:`, {
            startWeekdayDirect: props.START_WEEKDAY,
            cleaningDay,
            streetName,
            allProps: Object.keys(props)
          });
        }

        // Handle different geometry types
        let coordinates: number[][] = [];
        const coords = geometry.coordinates;
        
        if (geometry.type === 'LineString' || geometry.type === 'LINESTRING') {
          // LineString: coordinates is array of [x, y] pairs
          if (Array.isArray(coords) && coords.length > 0) {
            if (Array.isArray(coords[0])) {
              coordinates = coords as number[][];
            } else {
              // Single coordinate pair (shouldn't happen but handle it)
              coordinates = [coords as unknown as number[]];
            }
          }
        } else if (geometry.type === 'MultiLineString' || geometry.type === 'MULTILINESTRING') {
          // MultiLineString: coordinates is array of LineString coordinate arrays
          if (Array.isArray(coords) && Array.isArray(coords[0])) {
            coordinates = (coords as unknown as number[][][]).flat();
          }
        } else {
          // Fallback: try to use coordinates as-is
          if (Array.isArray(coords) && coords.length > 0) {
            if (Array.isArray(coords[0])) {
              coordinates = coords as number[][];
            } else {
              coordinates = [coords as unknown as number[]];
            }
          }
        }

        if (coordinates.length < 2) continue;

        // Debug: Log first few raw coordinates before transformation
        if (streets.length < 3) {
          console.log(`Raw SWEREF99 coordinates (street ${streets.length}):`, {
            streetName,
            firstCoord: coordinates[0],
            firstCoordValues: `[${coordinates[0][0]}, ${coordinates[0][1]}]`,
            lastCoord: coordinates[coordinates.length - 1],
            lastCoordValues: `[${coordinates[coordinates.length - 1][0]}, ${coordinates[coordinates.length - 1][1]}]`,
            totalCoords: coordinates.length
          });
        }

        // Transform coordinates from SWEREF99 to WGS84
        const wgs84Coords = transformCoordinates(coordinates);
        
        // Debug: Log transformed coordinates with actual values
        if (streets.length < 3) {
          console.log(`Transformed WGS84 coordinates (street ${streets.length}):`, {
            streetName,
            firstCoord: wgs84Coords[0],
            firstCoordValues: `[${wgs84Coords[0][0]}, ${wgs84Coords[0][1]}] (lng, lat)`,
            lastCoord: wgs84Coords[wgs84Coords.length - 1],
            lastCoordValues: `[${wgs84Coords[wgs84Coords.length - 1][0]}, ${wgs84Coords[wgs84Coords.length - 1][1]}] (lng, lat)`,
            isValid: wgs84Coords.every(([lng, lat]) => lat >= 58 && lat <= 60.5 && lng >= 17 && lng <= 19.5)
          });
        }

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

