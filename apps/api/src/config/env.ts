import "dotenv/config";

export const env = {
  port: getNumberEnv("PORT", 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  gdebenzBaseUrl: process.env.GDEBENZ_BASE_URL ?? "https://gdebenz.ru/api",
  gdebenzTimeoutMs: getNumberEnv("GDEBENZ_TIMEOUT_MS", 8_000),
  openRouteServiceBaseUrl: process.env.OPENROUTESERVICE_BASE_URL ?? "https://api.openrouteservice.org",
  openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY ?? "",
  openRouteServiceTimeoutMs: getNumberEnv("OPENROUTESERVICE_TIMEOUT_MS", 12_000),
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org",
  nominatimTimeoutMs: getNumberEnv("NOMINATIM_TIMEOUT_MS", 8_000),
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT ?? "AI-Shturman/0.1 (personal MVP; contact: deploy-owner)",
  cacheTtlMs: getNumberEnv("CACHE_TTL_MS", 60_000),
  nodeEnv: process.env.NODE_ENV ?? "development"
};

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
