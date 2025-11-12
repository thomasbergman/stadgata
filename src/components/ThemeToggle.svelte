<script lang="ts">
  import { theme } from '../stores/theme.js';
  
  function toggleTheme() {
    theme.update(current => current === 'dark' ? 'light' : 'dark');
  }
</script>

<button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
  <span class="toggle-icon">
    {$theme === 'dark' ? '☀️' : '🌙'}
  </span>
  <span class="toggle-label">
    {$theme === 'dark' ? 'Ljus' : 'Mörk'}
  </span>
</button>

<style>
  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    color: #f9fafb;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .theme-toggle:hover {
    background: #4b5563;
    border-color: #6b7280;
  }

  .toggle-icon {
    font-size: 1.125rem;
  }

  .toggle-label {
    font-size: 0.875rem;
  }

  /* Light mode styles */
  :global([data-theme='light']) .theme-toggle {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
  }

  :global([data-theme='light']) .theme-toggle:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
  }
</style>

