<script lang="ts">
  import { selectedDate } from '../stores/selectedDate.js';

  $: currentDate = $selectedDate;

  function handleDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      selectedDate.set(new Date(target.value));
    }
  }

  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  $: dateValue = formatDateForInput(currentDate);
</script>

<div class="date-picker-container">
  <input
    id="date-input"
    type="date"
    bind:value={dateValue}
    on:change={handleDateChange}
    class="date-input"
    title="Välj datum"
  />
</div>

<style>
  .date-picker-container {
    display: flex;
    align-items: center;
  }

  .date-input {
    padding: 0.5rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    width: auto;
    min-width: 140px;
  }

  .date-input:hover {
    border-color: hsl(var(--input));
  }

  .date-input:focus {
    outline: none;
    border-color: hsl(var(--ring));
    box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
  }

  /* Style the date picker icon */
  .date-input::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.7;
    filter: invert(0.5);
  }

  :global([data-theme='light']) .date-input::-webkit-calendar-picker-indicator {
    filter: invert(0);
  }
</style>

