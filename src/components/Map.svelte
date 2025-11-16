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
  import { getStreetCache, getViewportCacheKey } from '../lib/api/viewportCache.js';

  export let selectedDate: Date = new Date();
  export let theme: Theme = 'dark';

  let mapContainer: HTMLDivElement;
  let map: L.Map;
  let streetLayers: L.Polyline[] = [];
  let tileLayer: L.TileLayer | null = null;
  let currentViewport: { center: [number, number]; radius: number } | null = null;
  let viewportUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let loadViewportRetryCount = 0;
  const MAX_RETRIES = 10;
  let cachedStreetsForCurrentView: StreetSegment[] = [];

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

    // On mobile, the map container might not have proper dimensions yet
    // Wait for the map to be ready and ensure it has valid bounds
    map.whenReady(() => {
      // Invalidate size to ensure Leaflet recalculates dimensions (important for mobile)
      map.invalidateSize();
      
      // Small delay to ensure bounds are calculated properly on mobile
      setTimeout(() => {
        // Load initial viewport data
        loadViewportData();

        // Listen to map movement events
        map.on('moveend', handleViewportChange);
        map.on('zoomend', handleViewportChange);
      }, 100);
    });

    // Handle window resize (important for mobile when address bar shows/hides)
    const handleResize = () => {
      if (map) {
        // Small delay to let the resize complete
        setTimeout(() => {
          map.invalidateSize();
          // Reload viewport data if map size changed significantly
          loadViewportData();
        }, 150);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  });

  async function loadViewportData() {
    if (!map) return;

    // Ensure map has valid bounds (important for mobile)
    const bounds = map.getBounds();
    if (!bounds) {
      if (loadViewportRetryCount < MAX_RETRIES) {
        loadViewportRetryCount++;
        console.warn(`Map bounds not available yet, retrying... (${loadViewportRetryCount}/${MAX_RETRIES})`);
        // Retry after a short delay if bounds aren't available
        setTimeout(() => loadViewportData(), 200);
        return;
      } else {
        console.error('Failed to get map bounds after maximum retries');
        viewportError.set('Kunde inte ladda kartan. Försök ladda om sidan.');
        isLoadingViewport.set(false);
        return;
      }
    }

    // Check if bounds have valid coordinates
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (!ne || !sw || 
        isNaN(ne.lat) || isNaN(ne.lng) || 
        isNaN(sw.lat) || isNaN(sw.lng) ||
        ne.lat === sw.lat || ne.lng === sw.lng) {
      if (loadViewportRetryCount < MAX_RETRIES) {
        loadViewportRetryCount++;
        console.warn(`Map bounds not valid yet, retrying... (${loadViewportRetryCount}/${MAX_RETRIES})`, { ne, sw });
        // Retry after a short delay if bounds aren't valid
        setTimeout(() => loadViewportData(), 200);
        return;
      } else {
        console.error('Invalid map bounds after maximum retries');
        viewportError.set('Kunde inte ladda kartan. Försök ladda om sidan.');
        isLoadingViewport.set(false);
        return;
      }
    }

    const viewport = getViewportCenterAndRadius(bounds);

    // Validate viewport values
    if (!viewport || !viewport.center || !viewport.radius || 
        isNaN(viewport.center[0]) || isNaN(viewport.center[1]) || 
        isNaN(viewport.radius) || viewport.radius <= 0) {
      if (loadViewportRetryCount < MAX_RETRIES) {
        loadViewportRetryCount++;
        console.warn(`Invalid viewport calculated, retrying... (${loadViewportRetryCount}/${MAX_RETRIES})`, viewport);
        setTimeout(() => loadViewportData(), 200);
        return;
      } else {
        console.error('Invalid viewport after maximum retries');
        viewportError.set('Kunde inte beräkna kartområde. Försök ladda om sidan.');
        isLoadingViewport.set(false);
        return;
      }
    }

    // Reset retry count on success (all validations passed)
    loadViewportRetryCount = 0;

    // Check if viewport changed significantly
    if (!hasViewportChangedSignificantly(currentViewport, viewport)) {
      // Viewport hasn't changed much, but check if we have cached data for current view
      const cache = getStreetCache();
      const cacheKey = getViewportCacheKey(viewport.center, viewport.radius);
      if (cache.hasViewport(cacheKey)) {
        const cachedStreets = cache.getStreetsForViewport(cacheKey);
        if (cachedStreets.length > 0) {
          viewportStreets.set(cachedStreets);
          cachedStreetsForCurrentView = cachedStreets;
        }
      }
      return; // Skip if viewport hasn't changed much
    }

    currentViewport = viewport;

    // Check cache first - if we have data, use it immediately without showing loading
    const cache = getStreetCache();
    const cacheKey = getViewportCacheKey(viewport.center, viewport.radius);
    
    if (cache.hasViewport(cacheKey)) {
      const cachedStreets = cache.getStreetsForViewport(cacheKey);
      console.log(`Using cached data for viewport: ${cachedStreets.length} streets`);
      viewportStreets.set(cachedStreets);
      cachedStreetsForCurrentView = cachedStreets;
      // Don't set loading state if we have cached data
      return;
    }

    // Also check if we can merge data from nearby cached viewports
    // This helps when scrolling to areas we've partially cached
    const allCachedStreets = cache.getAllStreets();
    if (allCachedStreets.length > 0) {
      // Filter streets that are likely visible in current viewport
      const visibleCached = allCachedStreets.filter(street => {
        if (street.coordinates.length === 0) return false;
        // Check if any coordinate is within the viewport bounds
        return street.coordinates.some(([lng, lat]) => {
          return lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng;
        });
      });
      
      if (visibleCached.length > 0) {
        console.log(`Using ${visibleCached.length} cached streets from nearby viewports`);
        viewportStreets.set(visibleCached);
        cachedStreetsForCurrentView = visibleCached;
        // Still fetch in background to get complete data, but don't block UI
      }
    }

    try {
      // Only show loading if we don't have any cached data
      if (cachedStreetsForCurrentView.length === 0) {
        isLoadingViewport.set(true);
      }
      viewportError.set(null);

      console.log('Starting fetch for viewport:', {
        center: viewport.center,
        radius: viewport.radius,
        url: `/api/within?radius=${viewport.radius}&lat=${viewport.center[0]}&lng=${viewport.center[1]}&outputFormat=json`
      });

      // Increase radius by 50% to fetch more data and reduce future requests
      const expandedRadius = Math.round(viewport.radius * 1.5);
      const streets = await fetchStreetDataByViewport(viewport.center, expandedRadius);
      
      console.log('Successfully fetched streets:', streets.length);
      
      // Merge with any existing cached streets for this view
      const streetMap = new Map<string, StreetSegment>();
      // Add existing cached streets
      cachedStreetsForCurrentView.forEach(street => {
        streetMap.set(street.id || `${street.streetName}-${street.addressRange}`, street);
      });
      // Add newly fetched streets (will overwrite duplicates)
      streets.forEach(street => {
        streetMap.set(street.id || `${street.streetName}-${street.addressRange}`, street);
      });
      
      const mergedStreets = Array.from(streetMap.values());
      viewportStreets.set(mergedStreets);
      cachedStreetsForCurrentView = mergedStreets;
    } catch (err) {
      console.error('Failed to load viewport street data:', {
        error: err,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        viewport: viewport
      });
      
      // Only show error if we don't have cached data to fall back to
      if (cachedStreetsForCurrentView.length === 0) {
        let errorMessage = 'Okänt fel vid hämtning av data';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        viewportError.set(errorMessage);
      }
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