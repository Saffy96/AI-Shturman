import type { GeoSearchResponse, GeoSearchResult } from "@ai-shturman/shared";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";

interface NominatimSearchResult {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

const geoCache = new TtlCache<GeoSearchResult[]>(24 * 60 * 60 * 1000);
let nominatimQueue: Promise<void> = Promise.resolve();
let nextNominatimRequestAt = 0;

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

  const results = await scheduleNominatimRequest(() => fetchNominatim(normalizedQuery));
  geoCache.set(cacheKey, results);

  return {
    ok: true,
    query: normalizedQuery,
    results
  };
}

function scheduleNominatimRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, nextNominatimRequestAt - Date.now());

    if (waitMs > 0) {
      await delay(waitMs);
    }

    try {
      return await task();
    } finally {
      nextNominatimRequestAt = Date.now() + 1100;
    }
  });

  nominatimQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getFirstGeoResult(query: string): Promise<GeoSearchResult> {
  const response = await searchGeo(query);
  const first = response.results[0];

  if (!first) {
    throw validationError(`Location not found: ${query}`);
  }

  return first;
}

async function fetchNominatim(query: string): Promise<GeoSearchResult[]> {
  const url = new URL("/search", env.nominatimBaseUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.nominatimTimeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": env.nominatimUserAgent
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw serviceError(`Nominatim responded with HTTP ${response.status}`, response.status);
    }

    const payload = (await response.json()) as NominatimSearchResult[];

    if (!Array.isArray(payload)) {
      throw serviceError("Nominatim returned unexpected response", 502);
    }

    return payload
      .map((item) => {
        const lat = Number(item.lat);
        const lon = Number(item.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }

        const address = item.display_name?.trim() || item.name?.trim() || query;

        return {
          name: item.name?.trim() || address.split(",")[0]?.trim() || query,
          address,
          lat,
          lon
        };
      })
      .filter((item): item is GeoSearchResult => item !== null);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw serviceError("Nominatim request timed out", 504);
    }

    if (isHttpError(error)) {
      throw error;
    }

    throw serviceError("Nominatim request failed", 502);
  } finally {
    clearTimeout(timeoutId);
  }
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
