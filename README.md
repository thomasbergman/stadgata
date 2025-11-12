# Stockholm Parkering - Gata Städning Karta

A web-based parking availability map for Stockholm that visualizes which streets are available for parking on any given date based on street cleaning schedules.

## Features

- 🗺️ **Interactive Map**: Leaflet-based map centered on Stockholm with OpenStreetMap tiles
- 🎨 **Color-Coded Streets**: 
  - 🟢 **Green**: Available for 3+ days
  - 🟡 **Yellow**: Available for 1-2 days  
  - 🔴 **Red**: Unavailable today (cleaning day)
- 📅 **Date Picker**: Check parking availability for any date
- 📍 **Find My Location**: Center map on your current position
- 💾 **24-Hour Cache**: API data is cached locally to minimize API calls
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Setup

### Prerequisites

- Node.js (v20+ recommended)
- npm

### Installation

1. Clone or navigate to the project directory:
```bash
cd stadgata
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Server

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

### Build for Production

To create a production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Usage

1. **View the Map**: The map loads automatically centered on Stockholm
2. **Select a Date**: Use the date picker to check availability for different dates
3. **Click Streets**: Click on any colored street segment to see:
   - Street name
   - Address range
   - Cleaning day
   - Days until next cleaning
4. **Find Your Location**: Click "Hitta min plats" to center the map on your current position
5. **View Legend**: Check the legend to understand the color codes

## Technical Details

### Architecture

- **Framework**: Svelte 5 with TypeScript
- **Build Tool**: Vite
- **Map Library**: Leaflet
- **Tile Provider**: OpenStreetMap (no API key required)
- **Coordinate System**: Transforms SWEREF99 18 00 (EPSG:3011) to WGS84 (EPSG:4326)

### Project Structure

```
src/
  components/
    Map.svelte          # Main map component with Leaflet
    DatePicker.svelte   # Date selection component
    LocationButton.svelte # Geolocation button
    Legend.svelte       # Color code legend
  lib/
    api/
      stockholm.ts      # API client for Stockholm parking data
      cache.ts          # 24-hour caching utilities
    utils/
      coordinateUtils.ts # SWEREF99 to WGS84 transformation
      dateUtils.ts      # Date calculations and availability logic
  stores/
    selectedDate.ts     # Svelte store for selected date
    streetData.ts       # Svelte store for street data
  App.svelte           # Main application component
  main.ts              # Application entry point
```

### API Integration

The application fetches data from Stockholm's open parking API:
- **Endpoint**: `https://openparking.stockholm.se/LTF-Tolken/v1/servicedagar/all`
- **API Key**: Included in the code (provided by Stockholm stad)
- **Caching**: Data is cached in localStorage for 24 hours
- **Coordinate System**: API returns SWEREF99 coordinates which are transformed to WGS84 for Leaflet

### Data Processing

- Street cleaning schedules are processed to calculate availability
- Days until next cleaning are calculated based on the selected date
- Streets are color-coded based on availability status
- Popups show detailed information for each street segment

## Browser Compatibility

- Modern browsers with ES6+ support
- Geolocation API support for "Find My Location" feature
- LocalStorage support for caching

## Development

### Code Style

- TypeScript for type safety
- Svelte 5 runes for reactivity
- Component-scoped styles
- Clean, commented code following best practices

### Linting

Run type checking:
```bash
npm run check
```

## License

This project is open source and available for use.

## Credits

- **Data Source**: [Stockholm Open Parking API](https://openparking.stockholm.se/LTF-Tolken/v1/servicedagar/help)
- **Map Tiles**: OpenStreetMap contributors
- **Map Library**: Leaflet
- **Framework**: Svelte

## Notes

- The application runs entirely client-side (no backend required)
- API data is cached for 24 hours to minimize API calls
- Coordinate transformations are handled automatically
- The map works offline once data is cached
