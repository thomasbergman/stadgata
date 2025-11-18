<script lang="ts">
  import { streetData } from '../stores/streetData.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let searchQuery = '';
  let showResults = false;
  let isExpanded = false;
  let searchInput: HTMLInputElement;
  let filteredStreets: Array<{ street: typeof $streetData[0]; index: number; segmentCount: number }> = [];
  let totalMatches = 0;
  
  function toggleSearch() {
    isExpanded = !isExpanded;
    if (isExpanded && searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    } else {
      searchQuery = '';
      showResults = false;
    }
  }
  
  // Search function - group by street name to avoid duplicates
  function handleSearch() {
    if (!searchQuery.trim()) {
      filteredStreets = [];
      showResults = false;
      totalMatches = 0;
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const streetMap = new Map<string, { street: typeof $streetData[0]; index: number; segmentCount: number }>();
    
    $streetData.forEach((street, index) => {
      if (street.streetName.toLowerCase().includes(query)) {
        const streetName = street.streetName;
        // If we already have this street, increment segment count
        if (streetMap.has(streetName)) {
          const existing = streetMap.get(streetName)!;
          existing.segmentCount++;
        } else {
          // First occurrence of this street name
          streetMap.set(streetName, { street, index, segmentCount: 1 });
        }
      }
    });
    
    totalMatches = streetMap.size;
    // Convert map to array and limit to 10 results
    filteredStreets = Array.from(streetMap.values()).slice(0, 10);
    showResults = filteredStreets.length > 0 && searchQuery.length > 0;
  }
  
  function selectStreet(street: typeof $streetData[0]) {
    if (street.coordinates.length > 0) {
      const [lng, lat] = street.coordinates[0];
      dispatch('streetSelected', { lat, lng, street });
      searchQuery = '';
      showResults = false;
      isExpanded = false;
    }
  }
  
  $: if (searchQuery) {
    handleSearch();
  } else {
    showResults = false;
  }
</script>

<div class="search-container">
  {#if !isExpanded}
    <button
      class="search-toggle-button"
      on:click={toggleSearch}
      aria-label="Sök gata"
      title="Sök gata"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  {:else}
    <div class="search-expanded">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input
          bind:this={searchInput}
          type="text"
          placeholder="Sök gata..."
          bind:value={searchQuery}
          on:focus={() => showResults = filteredStreets.length > 0 && searchQuery.length > 0}
          on:blur={(e) => {
            // Don't close if clicking on results
            if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('.search-results')) {
              // Small delay to allow click events on results
              setTimeout(() => {
                if (!showResults || filteredStreets.length === 0) {
                  // Only auto-close if no results are showing
                }
              }, 200);
            }
          }}
          class="search-input"
        />
        {#if searchQuery}
          <button 
            class="clear-button"
            on:click={() => { searchQuery = ''; showResults = false; }}
            aria-label="Rensa sökning"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
        <button
          class="close-button"
          on:click={toggleSearch}
          aria-label="Stäng sökning"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      
      {#if showResults && filteredStreets.length > 0}
        <div class="search-results">
          {#each filteredStreets as { street, index, segmentCount }}
            <button
              class="search-result-item"
              on:click={() => selectStreet(street)}
              type="button"
            >
              <div class="result-street-name">
                {street.streetName}
                {#if segmentCount > 1}
                  <span class="segment-count">({segmentCount} segment)</span>
                {/if}
              </div>
              {#if street.addressRange}
                <div class="result-address">{street.addressRange}</div>
              {/if}
            </button>
          {/each}
          {#if totalMatches > 10}
            <div class="result-footer">
              Visar första 10 av {totalMatches} gator
            </div>
          {/if}
        </div>
      {:else if searchQuery && filteredStreets.length === 0}
        <div class="search-results no-results">
          <div class="result-footer">Inga gator hittades</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
  }

  .search-toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    color: hsl(var(--foreground));
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .search-toggle-button:hover {
    background: hsl(var(--accent));
    border-color: hsl(var(--border));
  }

  .search-toggle-button:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  .search-toggle-button .icon {
    width: 1.25rem;
    height: 1.25rem;
    color: hsl(var(--foreground));
  }

  .search-expanded {
    position: relative;
    width: 100%;
    max-width: 400px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    width: 1rem;
    height: 1rem;
    color: hsl(var(--muted-foreground));
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 2.75rem 0.5rem 2.5rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .search-input::placeholder {
    color: hsl(var(--muted-foreground));
  }

  .search-input:focus {
    outline: none;
    border-color: hsl(var(--ring));
    box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
  }

  .clear-button,
  .close-button {
    position: absolute;
    right: 2.5rem;
    background: none;
    border: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    padding: 0.25rem;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    border-radius: 0.25rem;
  }

  .close-button {
    right: 0.5rem;
  }

  .clear-button:hover,
  .close-button:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--accent));
  }

  .clear-button svg,
  .close-button svg {
    width: 1rem;
    height: 1rem;
  }

  .search-results {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background: hsl(var(--popover));
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 2000;
  }

  .search-result-item {
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid hsl(var(--border));
    cursor: pointer;
    transition: background-color 0.2s;
    color: hsl(var(--foreground));
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .search-result-item:hover {
    background: hsl(var(--accent));
  }

  .result-street-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: hsl(var(--foreground));
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .segment-count {
    font-weight: 400;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .result-address {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .result-footer {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    text-align: center;
    border-top: 1px solid hsl(var(--border));
  }

  .no-results {
    padding: 1rem;
  }
</style>

