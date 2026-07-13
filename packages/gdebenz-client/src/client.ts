import { GdebenzClientError } from "./errors.js";
import type {
  GdebenzBBoxStationRaw,
  GdebenzClientOptions,
  GdebenzNearbyResponse,
  GdebenzRecentResponseRaw,
  GdebenzStationDetailsRaw,
  NearbyStationsParams,
  StationsBBoxParams
} from "./types.js";

const DEFAULT_BASE_URL = "https://gdebenz.ru/api";
const DEFAULT_TIMEOUT_MS = 8_000;

export async function getNearbyStations(
  params: NearbyStationsParams,
  options: GdebenzClientOptions = {}
): Promise<GdebenzNearbyResponse> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    radius_km: String(params.radiusKm)
  });

  return requestJson<GdebenzNearbyResponse>(`/nearby?${query.toString()}`, options);
}

export async function getStationsByBBox(
  params: StationsBBoxParams,
  options: GdebenzClientOptions = {}
): Promise<GdebenzBBoxStationRaw[]> {
  const query = new URLSearchParams({
    lat1: String(params.lat1),
    lon1: String(params.lon1),
    lat2: String(params.lat2),
    lon2: String(params.lon2)
  });

  return requestJson<GdebenzBBoxStationRaw[]>(`/stations?${query.toString()}`, options);
}

export async function getStationDetails(
  osmId: number | string,
  fingerprint?: string,
  options: GdebenzClientOptions = {}
): Promise<GdebenzStationDetailsRaw> {
  const query = new URLSearchParams();

  if (fingerprint) {
    query.set("fp", fingerprint);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestJson<GdebenzStationDetailsRaw>(`/comments/${encodeURIComponent(String(osmId))}${suffix}`, options);
}

export async function getStationRecent(
  osmId: number | string,
  limit = 30,
  fingerprint?: string,
  options: GdebenzClientOptions = {}
): Promise<GdebenzRecentResponseRaw> {
  const query = new URLSearchParams({ limit: String(limit) });

  if (fingerprint) {
    query.set("fp", fingerprint);
  }

  return requestJson<GdebenzRecentResponseRaw>(
    `/comments/${encodeURIComponent(String(osmId))}/recent?${query.toString()}`,
    options
  );
}

async function requestJson<T>(path: string, options: GdebenzClientOptions): Promise<T> {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "AI-Shturman-MVP/0.1",
        ...options.headers
      },
      signal: controller.signal
    });

    const body = await response.text();

    if (!response.ok) {
      throw new GdebenzClientError(`gdebenz responded with HTTP ${response.status}`, {
        statusCode: response.status,
        cause: body.slice(0, 300)
      });
    }

    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new GdebenzClientError("gdebenz returned invalid JSON", { cause: error });
    }
  } catch (error) {
    if (error instanceof GdebenzClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new GdebenzClientError("gdebenz request timed out", { isTimeout: true, cause: error });
    }

    throw new GdebenzClientError("gdebenz request failed", { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}
