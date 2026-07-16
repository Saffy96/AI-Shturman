import type { GeoSearchResult } from "@ai-shturman/shared";
import { env } from "../config/env.js";

export interface GeoapifySearchOptions {
  limit?: number;
  countryCode?: string;
  bias?: { lat: number; lon: number };
}

interface GeoapifyItem {
  name?: unknown;
  formatted?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  city?: unknown;
  street?: unknown;
  housenumber?: unknown;
  state?: unknown;
  county?: unknown;
  country?: unknown;
  lat?: unknown;
  lon?: unknown;
  result_type?: unknown;
  place_id?: unknown;
  rank?: { confidence?: unknown };
}

interface GeoapifyResponse { results?: GeoapifyItem[] }
type GeoapifyOperation = "autocomplete" | "search" | "reverse";

export class GeoapifyError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "GeoapifyError";
  }
}

export function autocompleteGeoapify(query: string, options?: GeoapifySearchOptions): Promise<GeoSearchResult[]> {
  return requestGeoapify("autocomplete", { text: query }, options);
}

export function searchGeoapify(query: string, options?: GeoapifySearchOptions): Promise<GeoSearchResult[]> {
  return requestGeoapify("search", { text: query }, options);
}

export async function reverseGeoapify(lat: number, lon: number): Promise<GeoSearchResult | null> {
  const results = await requestGeoapify("reverse", { lat: String(lat), lon: String(lon) }, { limit: 1 });
  return results[0] ?? null;
}

export function normalizeGeoapifyResults(items: GeoapifyItem[] = []): GeoSearchResult[] {
  const results: GeoSearchResult[] = [];
  const placeIds = new Set<string>();
  const addresses = new Set<string>();
  const coordinates: Array<{ lat: number; lon: number }> = [];

  for (const item of items) {
    const lat = finiteNumber(item.lat);
    const lon = finiteNumber(item.lon);
    if (lat === null || lon === null) continue;

    const placeId = clean(item.place_id);
    const formatted = clean(item.formatted);
    const addressLine1 = clean(item.address_line1);
    const addressLine2 = clean(item.address_line2);
    const streetAndHouse = [clean(item.street), clean(item.housenumber)].filter(Boolean).join(" ");
    const fallbackArea = [clean(item.city), clean(item.state), clean(item.country)].filter(Boolean).join(", ");
    const address = formatted
      || [addressLine1, addressLine2].filter(Boolean).join(", ")
      || fallbackArea
      || `${lat}, ${lon}`;
    const name = clean(item.name)
      || addressLine1
      || streetAndHouse
      || clean(item.city)
      || formatted.split(",")[0]?.trim()
      || "Точка";
    const normalizedAddress = address.toLocaleLowerCase("ru-RU");
    const duplicate = (placeId && placeIds.has(placeId))
      || addresses.has(normalizedAddress)
      || coordinates.some((point) => Math.abs(point.lat - lat) <= 0.00001 && Math.abs(point.lon - lon) <= 0.00001);
    if (duplicate) continue;

    if (placeId) placeIds.add(placeId);
    addresses.add(normalizedAddress);
    coordinates.push({ lat, lon });
    const confidence = Number(item.rank?.confidence);
    results.push({
      name,
      title: name,
      address,
      lat,
      lon,
      provider: "geoapify",
      ...(placeId ? { placeId } : {}),
      ...(clean(item.result_type) ? { resultType: clean(item.result_type) } : {}),
      ...(Number.isFinite(confidence) ? { confidence } : {})
    });
  }
  return results;
}

async function requestGeoapify(
  operation: GeoapifyOperation,
  parameters: Record<string, string>,
  options: GeoapifySearchOptions = {}
): Promise<GeoSearchResult[]> {
  if (!env.geoapifyApiKey) throw new GeoapifyError("Geoapify API key is not configured", 503);
  const url = new URL(`/v1/geocode/${operation}`, ensureTrailingSlash(env.geoapifyBaseUrl));
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru");
  url.searchParams.set("limit", String(options.limit ?? (operation === "reverse" ? 1 : 7)));
  if (operation !== "reverse") {
    url.searchParams.set("filter", `countrycode:${options.countryCode ?? "ru"}`);
    if (options.bias) url.searchParams.set("bias", `proximity:${options.bias.lon},${options.bias.lat}`);
  }
  url.searchParams.set("apiKey", env.geoapifyApiKey);

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.geoapifyTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw upstreamError(response.status);
    const payload = await response.json() as GeoapifyResponse;
    const results = normalizeGeoapifyResults(Array.isArray(payload.results) ? payload.results : []);
    logDevelopment(`${operation} success`, `${operation === "reverse" ? "" : `query=${JSON.stringify(parameters.text)} `}results=${results.length} duration=${Date.now() - startedAt}ms`);
    return results;
  } catch (error) {
    if (error instanceof GeoapifyError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      logDevelopment("timeout", `operation=${operation}`);
      throw new GeoapifyError("Geoapify request timed out", 504);
    }
    throw new GeoapifyError("Geoapify service is temporarily unavailable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function upstreamError(status: number): GeoapifyError {
  if (status === 401 || status === 403) return new GeoapifyError("Geoapify authentication failed", 502);
  if (status === 429) {
    logDevelopment("rate limited");
    return new GeoapifyError("Geoapify rate limit exceeded", 429);
  }
  if (status >= 500) return new GeoapifyError("Geoapify service is temporarily unavailable", 502);
  return new GeoapifyError("Geoapify request failed", 502);
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function logDevelopment(event: string, details = ""): void {
  if (env.nodeEnv === "development") console.info(`[geoapify] ${event}${details ? ` ${details}` : ""}`);
}
