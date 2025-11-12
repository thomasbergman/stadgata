<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    locationFound: { lat: number; lng: number };
    error: string;
  }>();

  let isLoading = false;
  let error: string | null = null;

  async function findLocation() {
    if (!navigator.geolocation) {
      error = 'Geolocation stöds inte av din webbläsare';
      dispatch('error', error);
      return;
    }

    isLoading = true;
    error = null;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        isLoading = false;
        dispatch('locationFound', {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (err) => {
        isLoading = false;
        let errorMessage = 'Kunde inte hitta din position';
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Tillstånd nekades. Aktivera plats i webbläsaren.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Platsinformation är inte tillgänglig.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Tidsgräns för platsförfrågan nåddes.';
            break;
        }
        
        error = errorMessage;
        dispatch('error', errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }
</script>

<div class="location-button-container">
  <button
    on:click={findLocation}
    disabled={isLoading}
    class="location-button"
    title="Hitta min plats"
  >
    {#if isLoading}
      <span class="spinner">⟳</span>
      Hittar...
    {:else}
      📍 Hitta min plats
    {/if}
  </button>
  {#if error}
    <div class="error-message">{error}</div>
  {/if}
</div>

<style>
  .location-button-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .location-button {
    padding: 0.625rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  .location-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .location-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
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

  .error-message {
    font-size: 0.75rem;
    color: #ef4444;
    padding: 0.25rem 0.5rem;
    background: #7f1d1d;
    border-radius: 4px;
    max-width: 200px;
    border: 1px solid #991b1b;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .error-message {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }
</style>

