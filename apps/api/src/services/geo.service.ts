import type { GeoSearchResponse, GeoSearchResult } from "@ai-shturman/shared";
import { TtlCache } from "../utils/ttl-cache.js";
import { geocode as yandexGeocode, reverseGeocode as yandexReverseGeocode } from "./yandex.service.js";

const cache = new TtlCache<GeoSearchResult[]>(24 * 60 * 60 * 1000, 1_000);

export async function searchGeo(query: string): Promise<GeoSearchResponse> {
  const normalized = query.trim();
  if (!normalized) throw serviceError("q is required", 400);
  const key = normalized.toLowerCase();
  let results = cache.get(key);
  if (!results) {
    try { results = await yandexGeocode(normalized); }
    catch (error) {
      console.warn("[geo] Yandex unavailable, using Nominatim fallback", error instanceof Error ? error.message : error);
      results = await nominatimSearch(normalized);
    }
    cache.set(key, results);
  }
  return { ok: true, query: normalized, results: results.map((item) => ({ ...item, title: item.name })) };
}

export async function reverseGeo(lat: number, lon: number): Promise<GeoSearchResult> {
  try {
    const result = await yandexReverseGeocode(lat, lon);
    if (result) return result;
  } catch (error) {
    console.warn("[geo] Yandex reverse unavailable, using Nominatim fallback", error instanceof Error ? error.message : error);
  }
  return nominatimReverse(lat, lon);
}

export async function getFirstGeoResult(query: string): Promise<GeoSearchResult> {
  const first = (await searchGeo(query)).results[0];
  if (!first) throw serviceError(`Location not found: ${query}`, 400);
  return first;
}

async function nominatimSearch(query: string): Promise<GeoSearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query); url.searchParams.set("format", "jsonv2"); url.searchParams.set("limit", "5"); url.searchParams.set("countrycodes", "ru");
  const response = await fetch(url, { headers: { "user-agent": "AI-Shturman/1.2", "accept-language": "ru" } });
  if (!response.ok) throw serviceError(`Nominatim responded with HTTP ${response.status}`, 502);
  const payload = await response.json() as Array<{ lat: string; lon: string; display_name: string; name?: string }>;
  return payload.map((item) => ({ name: item.name || item.display_name.split(",")[0], address: item.display_name, lat: Number(item.lat), lon: Number(item.lon) }));
}

async function nominatimReverse(lat: number, lon: number): Promise<GeoSearchResult> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat)); url.searchParams.set("lon", String(lon)); url.searchParams.set("format", "jsonv2");
  const response = await fetch(url, { headers: { "user-agent": "AI-Shturman/1.2", "accept-language": "ru" } });
  if (!response.ok) throw serviceError(`Nominatim responded with HTTP ${response.status}`, 502);
  const item = await response.json() as { display_name?: string; name?: string };
  const address = item.display_name || `${lat}, ${lon}`;
  return { name: item.name || address.split(",")[0], address, lat, lon };
}

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
