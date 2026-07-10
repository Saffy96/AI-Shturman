import type { GeoSearchResult } from "@ai-shturman/shared";
import { env } from "../config/env.js";

interface YandexResponse {
  response?: { GeoObjectCollection?: { featureMember?: Array<{ GeoObject?: YandexGeoObject }> } };
}

interface YandexGeoObject {
  name?: string;
  description?: string;
  metaDataProperty?: { GeocoderMetaData?: { text?: string } };
  Point?: { pos?: string };
}

export async function geocode(query: string): Promise<GeoSearchResult[]> {
  return requestYandex(query);
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoSearchResult | null> {
  const results = await requestYandex(`${lon},${lat}`, 1);
  return results[0] ?? null;
}

async function requestYandex(geocodeValue: string, results = 5): Promise<GeoSearchResult[]> {
  if (!env.yandexApiKey) throw serviceError("YANDEX_API_KEY is not configured.", 503);
  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", env.yandexApiKey);
  url.searchParams.set("geocode", geocodeValue);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", String(results));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.yandexTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw serviceError(`Yandex Geocoder responded with HTTP ${response.status}`, response.status);
    const payload = (await response.json()) as YandexResponse;
    return (payload.response?.GeoObjectCollection?.featureMember ?? [])
      .map((member) => normalize(member.GeoObject))
      .filter((value): value is GeoSearchResult => value !== null);
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) throw error;
    if (error instanceof Error && error.name === "AbortError") throw serviceError("Yandex Geocoder request timed out.", 504);
    throw serviceError("Yandex Geocoder request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(object?: YandexGeoObject): GeoSearchResult | null {
  const [lonRaw, latRaw] = object?.Point?.pos?.split(" ") ?? [];
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = object?.metaDataProperty?.GeocoderMetaData?.text?.trim()
    || [object?.name, object?.description].filter(Boolean).join(", ");
  return { name: object?.name?.trim() || address.split(",")[0] || "Точка", address, lat, lon };
}

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
