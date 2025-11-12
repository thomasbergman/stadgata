<script lang="ts">
  // Legend component explaining color codes
</script>

<div class="legend-container">
  <h3 class="legend-title">Förklaring</h3>
  <div class="legend-items">
    <div class="legend-item">
      <div class="legend-color" style="background-color: #22c55e;"></div>
      <span class="legend-label">Tillgänglig (3+ dagar)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #eab308;"></div>
      <span class="legend-label">Begränsat (1-2 dagar)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #ef4444;"></div>
      <span class="legend-label">Ej tillgänglig idag</span>
    </div>
  </div>
</div>

<style>
  .legend-container {
    padding: 1rem;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
    transition: background-color 0.3s, border-color 0.3s;
  }

  :global([data-theme='light']) .legend-container {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .legend-title {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f9fafb;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .legend-title {
    color: #111827;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-color {
    width: 24px;
    height: 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: 0.75rem;
    color: #d1d5db;
    transition: color 0.3s;
  }

  :global([data-theme='light']) .legend-label {
    color: #6b7280;
  }
</style>

