# AI Shturman Deploy Guide

This repository is a monorepo:

```txt
apps/
  api/                 # Express backend
  web/                 # Vite PWA frontend
packages/
  gdebenz-client/      # gdebenz.ru API client
  shared/              # shared types and deterministic advice logic
```

## Local Checks

Run from the repository root:

```bash
npm install
npm run build
npm run lint
```

Useful local commands:

```bash
npm run dev:api
npm run dev:web
npm run start:api
```

The backend healthcheck must return `{ "ok": true }`:

```bash
curl http://localhost:4000/health
```

## A. Push To GitHub

If the repository is not initialized yet:

```bash
git init
git add .
git commit -m "Prepare AI Shturman MVP for deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If the repository already exists, use the existing remote and push the current branch.

## B. Deploy Backend On Render

Create a new Render Web Service from the GitHub repository.

Recommended settings:

```txt
Root Directory: apps/api
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
Health Check Path: /health
```

Environment variables:

```txt
NODE_ENV=production
PORT=4000
FRONTEND_ORIGIN=https://FRONTEND_URL
GDEBENZ_BASE_URL=https://gdebenz.ru/api
GDEBENZ_TIMEOUT_MS=8000
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_TIMEOUT_MS=8000
NOMINATIM_USER_AGENT=AI-Shturman/0.1 (personal MVP; contact: your-email@example.com)
CACHE_TTL_MS=60000
```

Render may inject its own `PORT`; the API reads `process.env.PORT`, so use the platform value if Render provides it.

Alternative monorepo-root settings:

```txt
Root Directory: .
Build Command: npm install && npm run build:api
Start Command: npm run start:api
Health Check Path: /health
```

After deploy, open:

```txt
https://BACKEND_URL/health
```

Expected response:

```json
{ "ok": true }
```

Useful backend endpoints:

```txt
GET /health
GET /api/geo/search?q=Казань
GET /api/fuel/nearby?lat=55.796127&lon=49.106414&radiusKm=50&fuel=95
GET /api/fuel/route?from=Казань&to=Таймурзино&fuel=95&corridorKm=50
```

## C. Deploy Frontend On Vercel

Import the GitHub repository in Vercel.

Recommended settings:

```txt
Root Directory: apps/web
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Environment variables:

```txt
VITE_API_BASE_URL=https://BACKEND_URL
```

Alternative monorepo-root settings:

```txt
Root Directory: .
Build Command: npm run build:web
Output Directory: apps/web/dist
```

The frontend must call only the backend URL from `VITE_API_BASE_URL`.

## D. Verify Production

1. Open `https://BACKEND_URL/health`.
2. Open `https://FRONTEND_URL`.
3. Click `Получить геопозицию`.
4. If desktop geolocation fails, use `Использовать Казань`.
5. Click `Проверить АЗС`.
6. Click `Совет штурмана`.

If browser requests are blocked by CORS, set backend `FRONTEND_ORIGIN` to the exact Vercel origin, for example:

```txt
FRONTEND_ORIGIN=https://ai-shturman.vercel.app
```

## E. Add PWA To iPhone

1. Open `https://FRONTEND_URL` in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open `AI Штурман` from the Home Screen.

For real iPhone geolocation, use HTTPS. Local network HTTP URLs are not reliable for browser geolocation.
