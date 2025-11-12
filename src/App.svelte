<script lang="ts">
  import { onMount } from 'svelte';
  import Map from './components/Map.svelte';
  import DatePicker from './components/DatePicker.svelte';
  import LocationButton from './components/LocationButton.svelte';
  import StreetSearch from './components/StreetSearch.svelte';
  import Legend from './components/Legend.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { selectedDate } from './stores/selectedDate.js';
  import { streetData, isLoading, error } from './stores/streetData.js';
  import { theme } from './stores/theme.js';
  import { fetchStreetData } from './lib/api/stockholm.js';
  import type { StreetSegment } from './lib/api/stockholm.js';

  let mapComponent: Map;

  onMount(async () => {
    try {
      isLoading.set(true);
      error.set(null);
      const data = await fetchStreetData();
      streetData.set(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel vid hämtning av data';
      error.set(errorMessage);
      console.error('Failed to load street data:', err);
    } finally {
      isLoading.set(false);
    }
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
    <h1>Stockholmsparkering</h1>
    <p class="subtitle">Se vilka gator som är tillgängliga för parkering</p>
  </header>

  <div class="controls-container">
    <StreetSearch on:streetSelected={handleStreetSelected} />
    <DatePicker />
    <LocationButton
      on:locationFound={handleLocationFound}
      on:error={handleLocationError}
    />
    <ThemeToggle />
  </div>

  <div class="map-wrapper">
    {#if $isLoading}
      <div class="loading-overlay">
        <div class="spinner">⟳</div>
        <p>Hämtar gatudata...</p>
      </div>
    {:else if $error}
      <div class="error-overlay">
        <p>❌ {$error}</p>
        <button on:click={() => window.location.reload()}>Försök igen</button>
      </div>
    {/if}
    
    <Map
      bind:this={mapComponent}
      streets={$streetData}
      selectedDate={$selectedDate}
      theme={$theme}
    />
  </div>

  <aside class="sidebar">
    <Legend />
  </aside>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    transition: background-color 0.3s, color 0.3s;
  }

  /* Dark theme (default) */
  :global(body),
  :global([data-theme='dark']) {
    background: #111827;
    color: #f9fafb;
  }

  /* Light theme */
  :global([data-theme='light']) {
    background: #f9fafb;
    color: #111827;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #111827;
    transition: background-color 0.3s;
  }

  :global([data-theme='light']) .app-container {
    background: #f9fafb;
  }

  .app-header {
    padding: 1rem 1.5rem;
    background: #1f2937;
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #374151;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .app-header {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #f9fafb;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .app-header h1 {
    color: #111827;
  }

  .subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: #d1d5db;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .subtitle {
    color: #6b7280;
  }

  .controls-container {
    display: flex;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: #1f2937;
    border-bottom: 1px solid #374151;
    flex-wrap: wrap;
    align-items: center;
    position: relative;
    z-index: 1000;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .controls-container {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
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
    .app-header h1 {
      font-size: 1.25rem;
    }

    .controls-container {
      padding: 0.75rem;
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
