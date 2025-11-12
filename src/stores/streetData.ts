import { writable } from 'svelte/store';
import type { StreetSegment } from '../lib/api/stockholm.js';

export const streetData = writable<StreetSegment[]>([]);
export const isLoading = writable<boolean>(false);
export const error = writable<string | null>(null);

