# AI Shturman API

Backend proxy for the AI Shturman MVP. It receives user coordinates or route points, requests `gdebenz.ru`, optionally builds a real driving route via OpenRouteService, normalizes station data, and returns a frontend-friendly response.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

## Scripts

From the repository root:

```bash
npm run dev:api
npm run build
npm run start:api
npm run lint
```

Or only for the API workspace:

```bash
npm run dev -w @ai-shturman/api
npm run build -w @ai-shturman/api
npm run start -w @ai-shturman/api
npm run lint -w @ai-shturman/api
```

## Environment

```bash
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
GDEBENZ_BASE_URL=https://gdebenz.ru/api
GDEBENZ_TIMEOUT_MS=8000
OPENROUTESERVICE_BASE_URL=https://api.openrouteservice.org
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key
GEOAPIFY_API_KEY=your_geoapify_api_key
GEOAPIFY_BASE_URL=https://api.geoapify.com
GEOAPIFY_TIMEOUT_MS=8000
OPENROUTESERVICE_TIMEOUT_MS=12000
CACHE_TTL_MS=60000
```

## Endpoints

### GET /health

```json
{ "ok": true }
```

### GET /api/fuel/nearby

```bash
curl "http://localhost:4000/api/fuel/nearby?lat=55.796127&lon=49.106414&radiusKm=50&fuel=95"
```

### GET /api/geo/search

```bash
curl "http://localhost:4000/api/geo/search?q=Казань"
```

Uses Geoapify Search with a 24-hour in-memory cache.

### GET /api/geo/autocomplete

```bash
curl "http://localhost:4000/api/geo/autocomplete?q=Казань"
```

Uses Geoapify Autocomplete with a 10-minute in-memory cache. Optional `lat` and `lon` parameters add a proximity bias.

### GET /api/geo/reverse

```bash
curl "http://localhost:4000/api/geo/reverse?lat=55.796127&lon=49.106414"
```

### GET /api/fuel/route-real

Builds a real driving route with OpenRouteService and then looks for stations within the selected corridor.

```bash
curl "http://localhost:4000/api/fuel/route-real?from=Казань&to=Дюртюли&fuel=95&corridorKm=5"
```

If OpenRouteService is unavailable or the API key is missing, the frontend can fall back to:

### GET /api/fuel/route

Approximate route search using segmented bbox requests to `gdebenz.ru`.

```bash
curl "http://localhost:4000/api/fuel/route?from=Казань&to=Дюртюли&fuel=95&corridorKm=5"
```

## Notes

- `gdebenz.ru` requests use in-memory cache to avoid unnecessary repeated calls.
- Geocoding uses backend-only OpenRouteService Geocoding with presets and long-lived cache.
- Long routes are split into smaller bbox chunks so one oversized request does not break the whole response.
