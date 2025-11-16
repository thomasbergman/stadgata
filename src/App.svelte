<script lang="ts">
  import { onMount } from 'svelte';
  import Map from './components/Map.svelte';
  import DatePicker from './components/DatePicker.svelte';
  import LocationButton from './components/LocationButton.svelte';
  import StreetSearch from './components/StreetSearch.svelte';
  import Legend from './components/Legend.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { selectedDate } from './stores/selectedDate.js';
  import { streetData, isLoading, error, isLoadingViewport, viewportError } from './stores/streetData.js';
  import { theme } from './stores/theme.js';
  import { fetchStreetData } from './lib/api/stockholm.js';
  import type { StreetSegment } from './lib/api/stockholm.js';

  let mapComponent: Map;

  onMount(() => {
    // Start background fetch of full dataset for search functionality
    // This is non-blocking - the map will load viewport data immediately
    fetchStreetData()
      .then((data) => {
        streetData.set(data);
        console.log('Full dataset loaded in background for search');
      })
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : 'Okänt fel vid hämtning av data';
        error.set(errorMessage);
        console.error('Failed to load full street data:', err);
      });
  });

  function handleLocationFound(event: CustomEvent<{ lat: number; lng: number }>) {
    if (mapComponent) {
      mapComponent.centerMap(event.detail.lat, event.detail.lng);
    }
  }

  function handleLocationError(event: CustomEvent<string>) {
    // Error is already displayed in LocationButton component
    console.error('Location error:', event.detail);
  }

  function handleStreetSelected(event: CustomEvent<{ lat: number; lng: number; street: StreetSegment }>) {
    if (mapComponent) {
      mapComponent.focusOnStreet(event.detail.street);
    }
  }
</script>

<div class="app-container">
  <header class="app-header">
    <div class="header-content">
      <h1>Stockholmsparkering</h1>
      <p class="subtitle">Se vilka gator som är tillgängliga för parkering</p>
    </div>
    <div class="header-actions">
      <StreetSearch on:streetSelected={handleStreetSelected} />
      <DatePicker />
      <LocationButton
        on:locationFound={handleLocationFound}
        on:error={handleLocationError}
      />
      <ThemeToggle />
    </div>
  </header>

  <div class="map-wrapper">
    {#if $isLoadingViewport}
      <div class="loading-overlay">
        <div class="spinner">⟳</div>
        <p>Hämtar gatudata för området...</p>
      </div>
    {:else if $viewportError}
      <div class="error-overlay">
        <p>❌ {$viewportError}</p>
        <button on:click={() => window.location.reload()}>Försök igen</button>
      </div>
    {/if}
    
    <Map
      bind:this={mapComponent}
      selectedDate={$selectedDate}
      theme={$theme}
    />
  </div>

  <aside class="sidebar">
    <Legend />
  </aside>
</div>

<style>
  :global(:root) {
    /* Dark theme colors (shadcn-inspired) */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }

  :global([data-theme='light']) {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 224.3 76.3% 48%;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    transition: background-color 0.3s, color 0.3s;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: hsl(var(--background));
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: hsl(var(--card));
    border-bottom: 1px solid hsl(var(--border));
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    transition: background-color 0.3s, border-color 0.3s;
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: hsl(var(--foreground));
    line-height: 1.2;
  }

  .subtitle {
    margin: 0.125rem 0 0 0;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    line-height: 1.2;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .map-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
    z-index: 1;
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(17, 24, 39, 0.95);
    z-index: 1000;
    gap: 1rem;
    color: #f9fafb;
    transition: background-color 0.3s, color 0.3s;
  }

  :global([data-theme='light']) .loading-overlay,
  :global([data-theme='light']) .error-overlay {
    background: rgba(249, 250, 251, 0.95);
    color: #111827;
  }

  .spinner {
    font-size: 2rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .error-overlay {
    color: #ef4444;
  }

  .error-overlay button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .error-overlay button:hover {
    background: #2563eb;
  }

  .sidebar {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 2000;
    max-width: 250px;
  }

  @media (max-width: 768px) {
    .app-header {
      flex-direction: column;
      align-items: flex-start;
      padding: 0.75rem;
    }

    .header-content {
      width: 100%;
    }

    .app-header h1 {
      font-size: 1.125rem;
    }

    .subtitle {
      font-size: 0.6875rem;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .sidebar {
      position: relative;
      top: auto;
      right: auto;
      max-width: 100%;
      padding: 1rem;
    }
  }
</style>
