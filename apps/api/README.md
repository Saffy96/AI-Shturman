# AI Shturman API

Backend-proxy for the AI Shturman MVP. It receives user coordinates, requests `gdebenz.ru`, normalizes fuel station data, and returns a frontend-friendly response.

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
npm run dev
npm run build
npm run start
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
GDEBENZ_BASE_URL=https://gdebenz.ru/api
GDEBENZ_TIMEOUT_MS=8000
CACHE_TTL_MS=60000
```

## Endpoints

### GET /health

```json
{ "ok": true }
```

### GET /api/fuel/nearby

Example:

```bash
curl "http://localhost:4000/api/fuel/nearby?lat=55.75&lon=37.85&radiusKm=50&fuel=95"
```

Response shape:

```json
{
  "ok": true,
  "source": "gdebenz",
  "updatedAt": "2026-07-09T19:00:00.000Z",
  "radiusKm": 50,
  "userLocation": { "lat": 55.75, "lon": 37.85 },
  "stations": [],
  "summary": {
    "total": 0,
    "withFuel": 0,
    "withRequestedFuel": 0,
    "withQueue": 0,
    "withoutFuel": 0,
    "unknown": 0
  }
}
```

The API keeps a 60 second in-memory cache by rounded coordinates and radius, so repeated frontend refreshes do not hit `gdebenz.ru` unnecessarily.
