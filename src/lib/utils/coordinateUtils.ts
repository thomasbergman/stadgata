import proj4 from 'proj4';

// Define SWEREF99 18 00 (EPSG:3011) projection
proj4.defs('EPSG:3011', '+proj=tmerc +lat_0=0 +lon_0=18 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
// Define WGS84 (EPSG:4326) projection
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/**
 * Check if coordinates are already in WGS84 format (small numbers ~17-19 for lon, ~59-60 for lat)
 * vs SWEREF99 format (large numbers ~400000-600000 for easting/northing)
 */
function isAlreadyWGS84(x: number, y: number): boolean {
  // WGS84 coordinates for Stockholm area: lon ~17-19, lat ~59-60
  // SWEREF99 coordinates: easting ~400000-600000, northing ~6570000-6670000
  return (x >= 10 && x <= 30 && y >= 50 && y <= 70) || 
         (y >= 10 && y <= 30 && x >= 50 && x <= 70);
}

/**
 * Transform coordinates from SWEREF99 18 00 (EPSG:3011) to WGS84 (EPSG:4326)
 * @param x - X coordinate (easting in SWEREF99, or longitude if already WGS84)
 * @param y - Y coordinate (northing in SWEREF99, or latitude if already WGS84)
 * @returns [longitude, latitude] in WGS84
 */
export function transformToWGS84(x: number, y: number): [number, number] {
  // Check if coordinates are already in WGS84 format
  if (isAlreadyWGS84(x, y)) {
    // Coordinates appear to already be in WGS84
    // Check if they're in [lon, lat] or [lat, lon] order
    if (x >= 10 && x <= 30 && y >= 50 && y <= 70) {
      // [lon, lat] format - return as-is
      return [x, y] as [number, number];
    } else if (y >= 10 && y <= 30 && x >= 50 && x <= 70) {
      // [lat, lon] format - swap them
      return [y, x] as [number, number];
    }
  }
  
  // Coordinates appear to be in SWEREF99 format, transform them
  // proj4 expects [x, y] which is [easting, northing] for SWEREF99
  // and returns [longitude, latitude] for WGS84
  const result = proj4('EPSG:3011', 'EPSG:4326', [x, y]);
  
  // If the result doesn't make sense for Stockholm (lat ~59, lng ~18),
  // try swapping x and y as the API might be returning them in reverse order
  if (result[1] < 50 || result[1] > 70 || result[0] < 10 || result[0] > 30) {
    // Try swapping: the API might return [northing, easting] instead of [easting, northing]
    const swappedResult = proj4('EPSG:3011', 'EPSG:4326', [y, x]);
    // If swapped result is better (Stockholm should be lat ~59, lng ~18)
    if (swappedResult[1] >= 50 && swappedResult[1] <= 70 && swappedResult[0] >= 10 && swappedResult[0] <= 30) {
      console.log(`Swapped coordinates: [${x}, ${y}] -> [${swappedResult[0]}, ${swappedResult[1]}]`);
      return [swappedResult[0], swappedResult[1]] as [number, number];
    }
  }
  
  return [result[0], result[1]] as [number, number];
}

/**
 * Transform an array of coordinates from SWEREF99 to WGS84
 * @param coordinates - Array of [x, y] pairs in SWEREF99
 * @returns Array of [longitude, latitude] pairs in WGS84
 */
export function transformCoordinates(coordinates: number[][]): [number, number][] {
  return coordinates.map(([x, y]) => transformToWGS84(x, y));
}

