import type { GeoSearchResponse, GeoSearchResult } from "@ai-shturman/shared";
import { TtlCache } from "../utils/ttl-cache.js";
import {
  autocompleteGeoapify,
  reverseGeoapify,
  searchGeoapify,
  type GeoapifySearchOptions
} from "./geoapify.service.js";

const autocompleteCache = new TtlCache<GeoSearchResult[]>(10 * 60 * 1000, 1_000);
const searchCache = new TtlCache<GeoSearchResult[]>(24 * 60 * 60 * 1000, 1_000);
const reverseCache = new TtlCache<GeoSearchResult>(24 * 60 * 60 * 1000, 3_000);
const pendingAutocompleteRequests = new Map<string, Promise<GeoSearchResult[]>>();
const pendingSearchRequests = new Map<string, Promise<GeoSearchResult[]>>();
const pendingReverseRequests = new Map<string, Promise<GeoSearchResult>>();

export async function autocompleteGeo(query: string, options: GeoapifySearchOptions = {}): Promise<GeoSearchResponse> {
  const normalized = normalizeQuery(query);
  const key = searchKey("autocomplete", normalized, options);
  const results = await cachedRequest(key, autocompleteCache, pendingAutocompleteRequests, () => autocompleteGeoapify(normalized, options));
  return { ok: true, query: normalized, results };
}

export async function searchGeo(query: string, options: GeoapifySearchOptions = {}): Promise<GeoSearchResponse> {
  const normalized = normalizeQuery(query);
  const key = searchKey("search", normalized, options);
  const results = await cachedRequest(key, searchCache, pendingSearchRequests, () => searchGeoapify(normalized, options));
  return { ok: true, query: normalized, results };
}

export async function reverseGeo(lat: number, lon: number): Promise<GeoSearchResult> {
  const key = `reverse:${lat.toFixed(5)}:${lon.toFixed(5)}`;
  return cachedRequest(key, reverseCache, pendingReverseRequests, async () => {
    const result = await reverseGeoapify(lat, lon);
    return result ?? { name: "Точка", title: "Точка", address: `${lat}, ${lon}`, lat, lon };
  });
}

export async function getFirstGeoResult(query: string): Promise<GeoSearchResult> {
  const first = (await searchGeo(query)).results[0];
  if (!first) throw serviceError(`Location not found: ${query}`, 400);
  return first;
}

async function cachedRequest<T>(
  key: string,
  cache: TtlCache<T>,
  pending: Map<string, Promise<T>>,
  requestFactory: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== null) {
    if (process.env.NODE_ENV === "development") console.info(`[geoapify] cache hit key=${JSON.stringify(key)}`);
    return cached;
  }
  const existing = pending.get(key);
  if (existing) return existing;
  const request = requestFactory()
    .then((value) => {
      cache.set(key, value);
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function normalizeQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) throw serviceError("q is required", 400);
  return normalized;
}

function searchKey(prefix: "autocomplete" | "search", query: string, options: GeoapifySearchOptions): string {
  const country = (options.countryCode ?? "ru").toLowerCase();
  const bias = options.bias ? `${options.bias.lat.toFixed(5)}:${options.bias.lon.toFixed(5)}` : "none";
  return `${prefix}:${query.toLocaleLowerCase("ru-RU")}:${country}:${bias}`;
}

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
