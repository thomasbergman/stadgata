/**
 * Swedish day names mapping to JavaScript day indices
 */
const DAY_MAP: Record<string, number> = {
  'Måndag': 1,
  'Tisdag': 2,
  'Onsdag': 3,
  'Torsdag': 4,
  'Fredag': 5,
  'Lördag': 6,
  'Söndag': 0,
  'M': 1,
  'T': 2,
  'O': 3,
  'To': 4,
  'F': 5,
  'L': 6,
  'S': 0
};

/**
 * Get the day index (0-6) for a Swedish day name
 * @param cleaningDay - Swedish day name (e.g., "Måndag" or "måndag")
 * @returns Day index (0 = Sunday, 1 = Monday, etc.)
 */
export function getDayIndex(cleaningDay: string): number {
  const normalized = cleaningDay.trim();
  // Try exact match first
  if (DAY_MAP[normalized]) {
    return DAY_MAP[normalized];
  }
  // Try case-insensitive match by capitalizing first letter
  // API returns lowercase 'måndag', but DAY_MAP has 'Måndag'
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return DAY_MAP[capitalized] ?? -1;
}

/**
 * Calculate days until next cleaning day
 * @param cleaningDay - Swedish day name
 * @param selectedDate - Date to check from
 * @returns Number of days until next cleaning (0 = today is cleaning day)
 */
export function daysUntilCleaning(cleaningDay: string, selectedDate: Date): number {
  const cleaningDayIndex = getDayIndex(cleaningDay);
  
  if (cleaningDayIndex === -1) {
    // Invalid cleaning day, assume available
    return 7;
  }

  const currentDayIndex = selectedDate.getDay();
  let daysUntil = cleaningDayIndex - currentDayIndex;
  
  // If cleaning day is today, return 0 (unavailable)
  if (daysUntil === 0) {
    return 0;
  }
  
  // If cleaning day has passed this week, calculate for next week
  if (daysUntil < 0) {
    daysUntil += 7;
  }
  
  return daysUntil;
}

/**
 * Get availability status for a street
 * @param cleaningDay - Swedish day name
 * @param selectedDate - Date to check
 * @returns 'available' | 'limited' | 'unavailable'
 */
export function getAvailabilityStatus(cleaningDay: string, selectedDate: Date): 'available' | 'limited' | 'unavailable' {
  const daysUntil = daysUntilCleaning(cleaningDay, selectedDate);
  
  if (daysUntil === 0) {
    return 'unavailable';
  } else if (daysUntil <= 2) {
    return 'limited';
  } else {
    return 'available';
  }
}

/**
 * Get color code for a street based on availability
 * @param cleaningDay - Swedish day name
 * @param selectedDate - Date to check
 * @returns Color hex code
 */
export function getAvailabilityColor(cleaningDay: string, selectedDate: Date): string {
  const status = getAvailabilityStatus(cleaningDay, selectedDate);
  
  switch (status) {
    case 'available':
      return '#22c55e'; // Green - 3+ days available
    case 'limited':
      return '#eab308'; // Yellow - 1-2 days available
    case 'unavailable':
      return '#ef4444'; // Red - unavailable today
    default:
      return '#6b7280'; // Gray - unknown
  }
}

/**
 * Format Swedish day name for display
 */
export function formatCleaningDay(cleaningDay: string): string {
  return cleaningDay.trim();
}

