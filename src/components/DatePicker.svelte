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
  <label for="date-input" class="date-label">Välj datum:</label>
  <input
    id="date-input"
    type="date"
    bind:value={dateValue}
    on:change={handleDateChange}
    class="date-input"
  />
</div>

<style>
  .date-picker-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .date-picker-container {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .date-label {
    font-weight: 500;
    color: #f9fafb;
    font-size: 0.875rem;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .date-label {
    color: #111827;
  }

  .date-input {
    padding: 0.5rem;
    border: 1px solid #4b5563;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    background: #111827;
    color: #f9fafb;
    transition: background-color 0.3s, border-color 0.3s, color 0.3s;
  }

  :global([data-theme='light']) .date-input {
    background: #ffffff;
    border: 1px solid #d1d5db;
    color: #111827;
  }

  .date-input:hover {
    border-color: #6b7280;
  }

  :global([data-theme='light']) .date-input:hover {
    border-color: #9ca3af;
  }

  .date-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
</style>

