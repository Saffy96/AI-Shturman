# AI Shturman Web

React + Vite + TypeScript + Tailwind frontend for the AI Shturman MVP.

## Run

Install dependencies from the repository root:

```bash
npm install
```

Start the backend:

```bash
npm run dev -w @ai-shturman/api
```

Start the frontend:

```bash
npm run dev -w @ai-shturman/web
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

The React app calls only this backend API. It does not call `gdebenz.ru` directly.

## Build

```bash
npm run build -w @ai-shturman/web
```

From the repository root:

```bash
npm run build
npm run lint
```

## iPhone PWA

For iPhone, open the deployed HTTPS URL in Safari, tap Share, then choose Add to Home Screen.

Localhost is useful for development, but iPhone installation needs a reachable HTTPS URL or local network setup.

## MVP limits

- No map.
- No route building.
- No auth.
- No database.
- No direct frontend calls to `gdebenz.ru`.
- Route fields are saved only on the current screen and are used as trip context.
