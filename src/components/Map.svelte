<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { StreetSegment } from '../lib/api/stockholm.js';
  import { getAvailabilityColor, daysUntilCleaning } from '../lib/utils/dateUtils.js';
  import type { Theme } from '../stores/theme.js';
  import { getViewportCenterAndRadius, hasViewportChangedSignificantly } from '../lib/utils/coordinateUtils.js';
  import { fetchStreetDataByViewport } from '../lib/api/stockholm.js';
  import { viewportStreets, isLoadingViewport, viewportError } from '../stores/streetData.js';

  export let selectedDate: Date = new Date();
  export let theme: Theme = 'dark';

  let mapContainer: HTMLDivElement;
  let map: L.Map;
  let streetLayers: L.Polyline[] = [];
  let tileLayer: L.TileLayer | null = null;
  let currentViewport: { center: [number, number]; radius: number } | null = null;
  let viewportUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  // Stockholm coordinates
  const STOCKHOLM_CENTER: [number, number] = [59.3293, 18.0686];

  onMount(() => {
    // Initialize map with zoom 15 for faster initial load
    map = L.map(mapContainer, {
      center: STOCKHOLM_CENTER,
      zoom: 15
    });

    // Add initial tile layer based on theme
    updateTileLayer();

    // Load initial viewport data
    loadViewportData();

    // Listen to map movement events
    map.on('moveend', handleViewportChange);
    map.on('zoomend', handleViewportChange);
  });

  async function loadViewportData() {
    if (!map) return;

    const bounds = map.getBounds();
    const viewport = getViewportCenterAndRadius(bounds);

    // Check if viewport changed significantly
    if (!hasViewportChangedSignificantly(currentViewport, viewport)) {
      return; // Skip if viewport hasn't changed much
    }

    currentViewport = viewport;

    try {
      isLoadingViewport.set(true);
      viewportError.set(null);

      const streets = await fetchStreetDataByViewport(viewport.center, viewport.radius);
      viewportStreets.set(streets);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel vid hämtning av data';
      viewportError.set(errorMessage);
      console.error('Failed to load viewport street data:', err);
    } finally {
      isLoadingViewport.set(false);
    }
  }

  function handleViewportChange() {
    // Debounce viewport changes (wait 300ms after user stops panning/zooming)
    if (viewportUpdateTimeout) {
      clearTimeout(viewportUpdateTimeout);
    }
    
    viewportUpdateTimeout = setTimeout(() => {
      loadViewportData();
    }, 300);
  }

  // Update tile layer when theme changes
  function updateTileLayer() {
    if (!map) return;

    // Remove existing tile layer
    if (tileLayer) {
      map.removeLayer(tileLayer);
    }

    // Add new tile layer based on theme
    const tileUrl = theme === 'dark' 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    tileLayer = L.tileLayer(tileUrl, {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 21,
      subdomains: 'abcd'
    }).addTo(map);
  }

  // React to theme changes - update tile layer
  $: if (map && theme) {
    updateTileLayer();
  }

  // Update street layers when viewport streets, date, or theme changes
  $: if (map && $viewportStreets && selectedDate) {
    updateStreetLayers();
  }

  function updateStreetLayers() {
    if (!map) {
      console.log('Map not ready yet');
      return;
    }

    const streets = $viewportStreets;
    console.log(`Updating street layers: ${streets.length} streets, date: ${selectedDate.toISOString()}`);

    // Remove existing layers
    streetLayers.forEach(layer => map.removeLayer(layer));
    streetLayers = [];

    if (streets.length === 0) {
      console.log('No streets to render');
      return;
    }

    let validStreets = 0;
    let invalidStreets = 0;

    // Add new layers
    streets.forEach((street, index) => {
      if (street.coordinates.length < 2) return;

      const color = getAvailabilityColor(street.cleaningDay, selectedDate);
      const daysUntil = daysUntilCleaning(street.cleaningDay, selectedDate);

      // Leaflet expects [lat, lng] but we have [lng, lat], so swap them
      const latLngCoords: [number, number][] = street.coordinates
        .map((coord) => {
          // Ensure we have valid coordinates
          if (!Array.isArray(coord) || coord.length < 2) return null;
          const [lng, lat] = coord;
          // Validate coordinates are numbers
          if (typeof lng !== 'number' || typeof lat !== 'number') return null;
          if (isNaN(lng) || isNaN(lat)) return null;
          // Swap to [lat, lng] for Leaflet
          return [lat, lng] as [number, number];
        })
        .filter((coord): coord is [number, number] => coord !== null);

      if (latLngCoords.length < 2) {
        invalidStreets++;
        return;
      }

      // Convert to Leaflet LatLng objects explicitly
      const latLngPoints = latLngCoords.map(([lat, lng]) => L.latLng(lat, lng));

      // Validate coordinates are within reasonable bounds for Stockholm area
      // Stockholm area: lat ~59.2-59.4, lng ~17.8-18.2 (but allow wider range)
      const allValid = latLngPoints.every(point => {
        const lat = point.lat;
        const lng = point.lng;
        // Wider bounds to catch any valid Stockholm coordinates
        return lat >= 58 && lat <= 60.5 && lng >= 17 && lng <= 19.5 && !isNaN(lat) && !isNaN(lng);
      });

      if (!allValid) {
        invalidStreets++;
        if (index < 3) {
          const firstPoint = latLngPoints[0];
          const lastPoint = latLngPoints[latLngPoints.length - 1];
          const invalidPoints = latLngPoints.filter((point, i) => {
            const lat = point.lat;
            const lng = point.lng;
            return !(lat >= 58 && lat <= 60.5 && lng >= 17 && lng <= 19.5 && !isNaN(lat) && !isNaN(lng));
          });
          console.warn(`Invalid coordinates for street ${index}:`, {
            streetName: street.streetName,
            cleaningDay: street.cleaningDay,
            originalCoords: street.coordinates.slice(0, 2),
            firstLatLng: firstPoint ? { lat: firstPoint.lat, lng: firstPoint.lng } : 'null',
            firstLatLngValues: firstPoint ? `lat: ${firstPoint.lat}, lng: ${firstPoint.lng}` : 'null',
            lastLatLng: lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : 'null',
            lastLatLngValues: lastPoint ? `lat: ${lastPoint.lat}, lng: ${lastPoint.lng}` : 'null',
            totalPoints: latLngPoints.length,
            invalidPointsSample: invalidPoints.slice(0, 3).map(p => ({ lat: p.lat, lng: p.lng, latValue: p.lat, lngValue: p.lng }))
          });
        }
        return;
      }

      validStreets++;

      // Log first few streets for debugging
      if (index < 3) {
        console.log(`Street ${index}:`, {
          name: street.streetName,
          cleaningDay: street.cleaningDay,
          color: color,
          coords: latLngPoints.length,
          firstPoint: latLngPoints[0],
          bounds: L.latLngBounds(latLngPoints).toBBoxString()
        });
      }

      const polyline = L.polyline(latLngPoints, {
        color: color,
        weight: 4,
        opacity: 0.9
      }).addTo(map);

      // Add popup with street information
      const popupClassName = theme === 'dark' ? 'dark-popup' : 'light-popup';
      const textColor = theme === 'dark' ? '#f9fafb' : '#111827';
      const secondaryColor = theme === 'dark' ? '#d1d5db' : '#6b7280';
      
      const popupContent = `
        <div style="min-width: 200px; color: ${textColor};">
          <strong style="color: ${textColor};">${street.streetName}</strong><br/>
          ${street.addressRange ? `<span style="color: ${secondaryColor};">Adress: ${street.addressRange}</span><br/>` : ''}
          <span style="color: ${secondaryColor};">Städning: ${street.cleaningDay}</span><br/>
          ${daysUntil === 0 
            ? '<span style="color: #ef4444;">Ej tillgänglig idag</span>' 
            : `<span style="color: ${secondaryColor};">Tillgänglig i ${daysUntil} dag${daysUntil > 1 ? 'ar' : ''}</span>`
          }
        </div>
      `;

      polyline.bindPopup(popupContent, {
        className: popupClassName
      });
      streetLayers.push(polyline);
    });

    console.log(`Rendered ${validStreets} valid streets, ${invalidStreets} invalid streets, total layers: ${streetLayers.length}`);
  }

  export function centerMap(lat: number, lng: number) {
    if (map) {
      map.setView([lat, lng], 15);
      // Trigger viewport update after map moves
      // The moveend event will be fired automatically
    }
  }

  export function focusOnStreet(street: StreetSegment) {
    if (!map || street.coordinates.length < 2) return;
    
    const latLngCoords: [number, number][] = street.coordinates
      .map((coord) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const [lng, lat] = coord;
        if (typeof lng !== 'number' || typeof lat !== 'number') return null;
        if (isNaN(lng) || isNaN(lat)) return null;
        return [lat, lng] as [number, number];
      })
      .filter((coord): coord is [number, number] => coord !== null);
    
    if (latLngCoords.length < 2) return;
    
    const latLngPoints = latLngCoords.map(([lat, lng]) => L.latLng(lat, lng));
    const bounds = L.latLngBounds(latLngPoints);
    
    // Find and highlight the street's polyline
    const streetLayer = streetLayers.find((layer, index) => {
      const layerBounds = layer.getBounds();
      return bounds.intersects(layerBounds);
    });
    
    if (streetLayer) {
      // Open popup and highlight
      streetLayer.openPopup();
      streetLayer.setStyle({ weight: 6 });
      setTimeout(() => {
        streetLayer.setStyle({ weight: 4 });
      }, 2000);
    }
    
    map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 });
  }

  export function getMap(): L.Map | null {
    return map || null;
  }

  onDestroy(() => {
    if (viewportUpdateTimeout) {
      clearTimeout(viewportUpdateTimeout);
    }
    if (map) {
      map.off('moveend', handleViewportChange);
      map.off('zoomend', handleViewportChange);
      map.remove();
    }
  });
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 500px;
  }

  :global(.dark-popup .leaflet-popup-content-wrapper) {
    background: #1f2937;
    color: #f9fafb;
    border: 1px solid #374151;
  }

  :global(.dark-popup .leaflet-popup-tip) {
    background: #1f2937;
    border: 1px solid #374151;
  }

  :global(.dark-popup .leaflet-popup-close-button) {
    color: #9ca3af;
  }

  :global(.dark-popup .leaflet-popup-close-button:hover) {
    color: #f9fafb;
  }

  /* Light theme popup styles */
  :global(.light-popup .leaflet-popup-content-wrapper) {
    background: #ffffff;
    color: #111827;
    border: 1px solid #e5e7eb;
  }

  :global(.light-popup .leaflet-popup-tip) {
    background: #ffffff;
    border: 1px solid #e5e7eb;
  }

  :global(.light-popup .leaflet-popup-close-button) {
    color: #6b7280;
  }

  :global(.light-popup .leaflet-popup-close-button:hover) {
    color: #111827;
  }
</style>