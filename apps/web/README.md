# AI Shturman Web

React + Vite + TypeScript + Tailwind frontend for the AI Shturman MVP.

## Run

Install dependencies from the repository root:

```bash
npm install
```

Start the backend:

```bash
npm run dev:api
```

Start the frontend:

```bash
npm run dev:web
```

Open:

```bash
http://localhost:5173
```

## API URL

Create `apps/web/.env` from `apps/web/.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

The React app calls only this backend API. It does not call `gdebenz.ru`, Nominatim, or OpenRouteService directly.

## Route Mode

- Enter `Откуда` and `Куда`.
- Click `Построить маршрут`.
- Then click `Проверить АЗС по маршруту`.
- If the real route service is temporarily unavailable, the UI offers approximate fallback mode.

## Build

```bash
npm run build:web
```

From the repository root:

```bash
npm run build
npm run lint
```

## iPhone PWA

For iPhone, open the deployed HTTPS URL in Safari, tap Share, then choose Add to Home Screen.

## MVP Limits

- No map.
- Route mode uses backend route/corridor search and not full turn-by-turn navigation.
- No auth.
- No database.
- No direct frontend calls to third-party APIs.
