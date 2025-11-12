import { writable } from 'svelte/store';

export type Theme = 'dark' | 'light';

// Initialize theme from localStorage or default to 'dark'
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark';
}

export const theme = writable<Theme>(getInitialTheme());

// Update localStorage when theme changes
theme.subscribe((value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }
});

// Initialize on first load
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', getInitialTheme());
}

