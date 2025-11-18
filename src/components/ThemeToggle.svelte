<script lang="ts">
  import { theme } from '../stores/theme.js';
  
  function toggleTheme() {
    theme.update(current => current === 'dark' ? 'light' : 'dark');
  }
</script>

<button 
  class="theme-toggle" 
  on:click={toggleTheme} 
  aria-label={$theme === 'dark' ? 'Växla till ljust tema' : 'Växla till mörkt tema'}
  title={$theme === 'dark' ? 'Ljus' : 'Mörk'}
>
  {#if $theme === 'dark'}
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 1v3m0 16v3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M1 12h3m16 0h3M5.64 18.36l2.12-2.12m8.48-8.48l2.12-2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  {:else}
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
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

  .theme-toggle:hover {
    background: hsl(var(--accent));
    border-color: hsl(var(--border));
  }

  .theme-toggle:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
    color: hsl(var(--foreground));
  }
</style>

