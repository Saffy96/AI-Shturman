import type { GeoSearchResponse, GeoSearchResult } from "@ai-shturman/shared";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";

interface OrsGeocodeFeature {
  properties?: {
    label?: string;
    name?: string;
  };
  geometry?: {
    coordinates?: unknown;
  };
}

interface OrsGeocodeResponse {
  features?: OrsGeocodeFeature[];
}

const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geoCache = new TtlCache<GeoSearchResult[]>(GEO_CACHE_TTL_MS);
let orsQueue: Promise<void> = Promise.resolve();
let nextOrsRequestAt = 0;

const presetResults = new Map<string, GeoSearchResult>([
  [
    "казань",
    {
      name: "Казань",
      address: "Казань, Республика Татарстан, Россия",
      lat: 55.796127,
      lon: 49.106414
    }
  ],
  [
    "москва",
    {
      name: "Москва",
      address: "Москва, Россия",
      lat: 55.755864,
      lon: 37.617698
    }
  ],
  [
    "дюртюли",
    {
      name: "Дюртюли",
      address: "Дюртюли, Республика Башкортостан, Россия",
      lat: 55.484804,
      lon: 54.868628
    }
  ],
  [
    "чистополь",
    {
      name: "Чистополь",
      address: "Чистополь, Республика Татарстан, Россия",
      lat: 55.36311,
      lon: 50.64244
    }
  ]
]);

export async function searchGeo(query: string): Promise<GeoSearchResponse> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw validationError("q is required");
  }

  const cacheKey = normalizedQuery.toLowerCase();
  const preset = presetResults.get(cacheKey);

  if (preset) {
    const results = [preset];
    geoCache.set(cacheKey, results);

    return {
      ok: true,
      query: normalizedQuery,
      results
    };
  }

  const cached = geoCache.get(cacheKey);

  if (cached) {
    return {
      ok: true,
      query: normalizedQuery,
      results: cached
    };
  }

  const results = await scheduleOrsRequest(() => fetchOrsGeocode(normalizedQuery));
  geoCache.set(cacheKey, results);

  return {
    ok: true,
    query: normalizedQuery,
    results
  };
}

export async function getFirstGeoResult(query: string): Promise<GeoSearchResult> {
  const response = await searchGeo(query);
  const first = response.results[0];

  if (!first) {
    throw validationError(`Location not found: ${query}`);
  }

  return first;
}

function scheduleOrsRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = orsQueue.then(async () => {
    const waitMs = Math.max(0, nextOrsRequestAt - Date.now());

    if (waitMs > 0) {
      await delay(waitMs);
    }

    try {
      return await task();
    } finally {
      nextOrsRequestAt = Date.now() + 350;
    }
  });

  orsQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

async function fetchOrsGeocode(query: string): Promise<GeoSearchResult[]> {
  if (!env.openRouteServiceApiKey) {
    throw serviceError("OPENROUTESERVICE_API_KEY is not configured.", 503);
  }

  const url = new URL("/geocode/search", env.openRouteServiceBaseUrl);
  url.searchParams.set("api_key", env.openRouteServiceApiKey);
  url.searchParams.set("text", query);
  url.searchParams.set("size", "5");
  url.searchParams.set("boundary.country", "RU");
  url.searchParams.set("lang", "ru");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.openRouteServiceTimeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (response.status === 429) {
      throw serviceError("OpenRouteService временно ограничил запросы. Попробуйте позже.", 429);
    }

    if (!response.ok) {
      const responseBody = await safeReadResponseBody(response);
      logOrsGeocodeError(response.status, url, responseBody);
      throw serviceError(`OpenRouteService geocoding responded with HTTP ${response.status}`, response.status);
    }

    const payload = (await response.json()) as OrsGeocodeResponse;

    if (!Array.isArray(payload.features)) {
      throw serviceError("OpenRouteService geocoding returned unexpected response.", 502);
    }

    return payload.features
      .map((feature) => normalizeOrsFeature(feature, query))
      .filter((item): item is GeoSearchResult => item !== null);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw serviceError("OpenRouteService geocoding request timed out.", 504);
    }

    if (isHttpError(error)) {
      throw error;
    }

    throw serviceError("OpenRouteService geocoding request failed.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeOrsFeature(feature: OrsGeocodeFeature, query: string): GeoSearchResult | null {
  const coordinates = feature.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [lonRaw, latRaw] = coordinates;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const address = normalizeString(feature.properties?.label) || normalizeString(feature.properties?.name) || query;
  const name = normalizeString(feature.properties?.name) || address.split(",")[0]?.trim() || query;

  return {
    name,
    address,
    lat,
    lon
  };
}

async function safeReadResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<failed to read body>";
  }
}

function logOrsGeocodeError(status: number, url: URL, responseBody: string): void {
  const safeUrl = new URL(url.toString());
  safeUrl.searchParams.delete("api_key");

  console.error("[geo][ors]", {
    status,
    url: safeUrl.toString(),
    responseBody
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validationError(message: string): Error & { statusCode: number } {
  return serviceError(message, 400);
}

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function isHttpError(error: unknown): error is Error & { statusCode: number } {
  return error instanceof Error && typeof (error as Error & { statusCode?: number }).statusCode === "number";
}
