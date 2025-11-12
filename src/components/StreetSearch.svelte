<script lang="ts">
  import { streetData } from '../stores/streetData.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let searchQuery = '';
  let showResults = false;
  let filteredStreets: Array<{ street: typeof $streetData[0]; index: number; segmentCount: number }> = [];
  let totalMatches = 0;
  
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
    }
  }
  
  $: if (searchQuery) {
    handleSearch();
  } else {
    showResults = false;
  }
</script>

<div class="search-container">
  <div class="search-input-wrapper">
    <input
      type="text"
      placeholder="Sök gata..."
      bind:value={searchQuery}
      on:focus={() => showResults = filteredStreets.length > 0 && searchQuery.length > 0}
      class="search-input"
    />
    {#if searchQuery}
      <button 
        class="clear-button"
        on:click={() => { searchQuery = ''; showResults = false; }}
        aria-label="Rensa sökning"
      >
        ×
      </button>
    {/if}
  </div>
  
  {#if showResults && filteredStreets.length > 0}
    <div class="search-results">
      {#each filteredStreets as { street, index, segmentCount }}
        <button
          class="search-result-item"
          on:click={() => selectStreet(street)}
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

<style>
  .search-container {
    position: relative;
    width: 100%;
    max-width: 400px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    border: 1px solid #4b5563;
    border-radius: 8px;
    background: #1f2937;
    color: #f9fafb;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s, background-color 0.3s, color 0.3s;
  }

  :global([data-theme='light']) .search-input {
    background: #ffffff;
    border: 1px solid #d1d5db;
    color: #111827;
  }

  .search-input::placeholder {
    color: #9ca3af;
  }

  :global([data-theme='light']) .search-input::placeholder {
    color: #9ca3af;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .clear-button {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: color 0.2s;
  }

  .clear-button:hover {
    color: #f9fafb;
  }

  :global([data-theme='light']) .clear-button:hover {
    color: #111827;
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-height: 300px;
    overflow-y: auto;
    z-index: 2000;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .search-results {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .search-result-item {
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid #374151;
    cursor: pointer;
    transition: background-color 0.2s;
    color: #f9fafb;
  }

  :global([data-theme='light']) .search-result-item {
    color: #111827;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .search-result-item:hover {
    background: #374151;
  }

  :global([data-theme='light']) .search-result-item:hover {
    background: #f3f4f6;
  }

  .result-street-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: #f9fafb;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .result-street-name {
    color: #111827;
  }

  .segment-count {
    font-weight: 400;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .result-address {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .result-footer {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
    border-top: 1px solid #374151;
    transition: border-color 0.3s;
  }

  :global([data-theme='light']) .result-footer {
    border-top: 1px solid #e5e7eb;
  }

  .no-results {
    padding: 1rem;
  }
</style>

