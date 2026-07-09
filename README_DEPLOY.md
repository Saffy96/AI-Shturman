# AI Shturman Deploy Guide

This repository is a monorepo:

```txt
apps/
  api/                 # Express backend
  web/                 # Vite PWA frontend
packages/
  gdebenz-client/      # gdebenz.ru API client
  shared/              # shared types, route utils, advice logic
```

## Local Checks

Run from the repository root:

```bash
npm install
npm run build
npm run lint
npm run build:api
npm run build:web
```

If shared tests are available:

```bash
npm run test:advice -w @ai-shturman/shared
```

Healthcheck:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{ "ok": true }
```

## A. Push To GitHub

```bash
git init
git add .
git commit -m "Prepare AI Shturman for deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## B. Deploy Backend On Render

Create a new Render Web Service from the GitHub repository.

Recommended settings:

```txt
Root Directory: .
Build Command: npm install && npm run build:api
Start Command: npm run start:api
Health Check Path: /health
```

Environment variables:

```txt
NODE_ENV=production
FRONTEND_ORIGIN=https://FRONTEND_URL
GDEBENZ_BASE_URL=https://gdebenz.ru/api
GDEBENZ_TIMEOUT_MS=8000
OPENROUTESERVICE_BASE_URL=https://api.openrouteservice.org
OPENROUTESERVICE_API_KEY=YOUR_ORS_KEY
OPENROUTESERVICE_TIMEOUT_MS=12000
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_TIMEOUT_MS=8000
NOMINATIM_USER_AGENT=AI-Shturman/0.1 (personal MVP; contact: your-email@example.com)
CACHE_TTL_MS=60000
```

Render may inject its own `PORT`; the API already reads `process.env.PORT`.

Useful backend endpoints:

```txt
GET /health
GET /api/geo/search?q=Казань
GET /api/fuel/nearby?lat=55.796127&lon=49.106414&radiusKm=50&fuel=95
GET /api/fuel/route-real?from=Казань&to=Дюртюли&fuel=95&corridorKm=5
GET /api/fuel/route?from=Казань&to=Дюртюли&fuel=95&corridorKm=5
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

Environment variable:

```txt
VITE_API_BASE_URL=https://BACKEND_URL
```

## D. Verify Production

1. Open `https://BACKEND_URL/health`.
2. Open `https://FRONTEND_URL`.
3. In route mode, enter `Откуда` and `Куда`.
4. Click `Построить маршрут`.
5. Click `Проверить АЗС по маршруту`.
6. If ORS is unavailable, use the approximate fallback button.
7. On iPhone, geolocation should work after HTTPS deploy.

## E. Add PWA To iPhone

1. Open `https://FRONTEND_URL` in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open `AI Штурман` from the Home Screen.
