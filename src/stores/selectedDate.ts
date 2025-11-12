import { writable } from 'svelte/store';

export const selectedDate = writable<Date>(new Date());

