<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './ui/button.svelte';

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
  <Button
    on:click={findLocation}
    disabled={isLoading}
    size="icon"
    variant="outline"
    title="Hitta min plats"
    aria-label="Hitta min plats"
  >
    {#if isLoading}
      <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32" stroke-dashoffset="32">
          <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
        </circle>
      </svg>
    {:else}
      <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
      </svg>
    {/if}
  </Button>
  {#if error}
    <div class="error-message">{error}</div>
  {/if}
</div>

<style>
  .location-button-container {
    position: relative;
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
    color: hsl(var(--foreground));
  }

  .spinner-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: hsl(var(--foreground));
  }

  .error-message {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    font-size: 0.75rem;
    color: hsl(var(--destructive));
    padding: 0.5rem;
    background: hsl(var(--destructive) / 0.1);
    border-radius: 0.375rem;
    max-width: 200px;
    border: 1px solid hsl(var(--destructive) / 0.2);
    z-index: 1000;
    white-space: nowrap;
  }
</style>

