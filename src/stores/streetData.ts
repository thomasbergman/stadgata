import { writable } from 'svelte/store';
import type { StreetSegment } from '../lib/api/stockholm.js';

// Viewport streets - what's currently visible on the map
export const viewportStreets = writable<StreetSegment[]>([]);
export const isLoadingViewport = writable<boolean>(false);
export const viewportError = writable<string | null>(null);

// Full dataset - for search functionality (loaded in background)
export const streetData = writable<StreetSegment[]>([]);
export const isLoading = writable<boolean>(false);
export const error = writable<string | null>(null);

