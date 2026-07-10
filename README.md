# AI-Shturman v1.2

MVP PWA assistant for checking nearby fuel availability on the road.

Current implementation:

- `apps/web` - React + Vite + TypeScript + Tailwind PWA
- `apps/api` - Node.js + Express + TypeScript backend proxy
- `packages/gdebenz-client` - typed client for `gdebenz.ru` internal API
- `packages/shared` - shared normalized station types and utilities

## Environment

`apps/api/.env`:

```env
YANDEX_API_KEY=your_yandex_geocoder_key
OPENROUTESERVICE_API_KEY=your_openrouteservice_key
```

`apps/web/.env`:

```env
VITE_YANDEX_MAPS_API_KEY=your_yandex_javascript_api_key
VITE_API_BASE_URL=http://localhost:4000
```

The backend uses Yandex Geocoder first and Nominatim as a fallback.
