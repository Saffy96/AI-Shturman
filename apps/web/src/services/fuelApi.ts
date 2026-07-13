import type {
  GeoSearchResponse,
  GeoSearchResult,
  NearbyFuelParams,
  NearbyFuelResponse,
  RouteFuelParams,
  RouteFuelResponse,
  StationDetailsResponse
} from "../types/fuel";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 12_000;

export type FuelApiErrorKind =
  | "backend-unavailable"
  | "timeout"
  | "bad-response"
  | "rate-limited"
  | "route-service";

export class FuelApiError extends Error {
  constructor(
    message: string,
    readonly kind: FuelApiErrorKind,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "FuelApiError";
  }
}

export async function fetchNearbyFuel(params: NearbyFuelParams): Promise<NearbyFuelResponse> {
  const url = new URL("/api/fuel/nearby", API_BASE_URL);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lon", String(params.lon));
  url.searchParams.set("radiusKm", String(params.radiusKm));
  url.searchParams.set("fuel", params.fuel);

  return requestJson<NearbyFuelResponse>(url);
}

export async function fetchRouteFuel(params: RouteFuelParams): Promise<RouteFuelResponse> {
  const endpoint = params.mode === "approx" ? "/api/fuel/route" : "/api/fuel/route-real";
  const url = new URL(endpoint, API_BASE_URL);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  url.searchParams.set("corridorKm", String(params.corridorKm));
  url.searchParams.set("fuel", params.fuel);

  if (
    params.fromLat != null &&
    params.fromLon != null &&
    params.toLat != null &&
    params.toLon != null
  ) {
    url.searchParams.set("fromLat", String(params.fromLat));
    url.searchParams.set("fromLon", String(params.fromLon));
    url.searchParams.set("toLat", String(params.toLat));
    url.searchParams.set("toLon", String(params.toLon));
  }

  return requestJson<RouteFuelResponse>(url);
}

export async function searchGeo(query: string): Promise<GeoSearchResponse> {
  const url = new URL("/api/geo/search", API_BASE_URL);
  url.searchParams.set("q", query);

  return requestJson<GeoSearchResponse>(url);
}

export async function fetchStationDetails(osmId: string): Promise<StationDetailsResponse> {
  const url = new URL(`/api/fuel/stations/${encodeURIComponent(osmId)}/details`, API_BASE_URL);
  return requestJson<StationDetailsResponse>(url);
}

export async function reverseGeo(lat: number, lon: number): Promise<GeoSearchResult> {
  const url = new URL("/api/geo/reverse", API_BASE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const payload = await requestJson<{ ok: true; result: GeoSearchResult }>(url);
  return payload.result;
}

async function requestJson<T extends { ok: true }>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);

      if (response.status === 429) {
        throw new FuelApiError(message ?? "Сервис временно ограничил запросы.", "rate-limited", response.status);
      }

      if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 503) {
        throw new FuelApiError(message ?? "Сервис маршрутов недоступен.", "route-service", response.status);
      }

      throw new FuelApiError(message ?? "Backend unavailable", "backend-unavailable", response.status);
    }

    const payload = (await response.json()) as T;

    if (!payload.ok) {
      throw new FuelApiError("Unexpected backend response", "bad-response");
    }

    return payload;
  } catch (error) {
    if (error instanceof FuelApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FuelApiError("Backend request timed out", "timeout");
    }

    throw new FuelApiError("Backend unavailable", "backend-unavailable");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { error?: { message?: unknown } };
    const message = payload.error?.message;
    return typeof message === "string" && message.trim() ? message.trim() : null;
  } catch {
    return null;
  }
}
