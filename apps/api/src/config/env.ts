import "dotenv/config";

export const env = {
  port: getNumberEnv("PORT", 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  gdebenzBaseUrl: process.env.GDEBENZ_BASE_URL ?? "https://gdebenz.ru/api",
  gdebenzTimeoutMs: getNumberEnv("GDEBENZ_TIMEOUT_MS", 8_000),
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
