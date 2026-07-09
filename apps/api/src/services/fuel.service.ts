import {
  getFreshnessLabel,
  getQueueLabel,
  getRecommendation,
  getStatusLabel,
  hasRequestedFuel,
  detailMentionsQueue,
  normalizeStationStatus,
  parseFuels,
  toNumberOrNull,
  type FuelSummary,
  type NearbyFuelResponse,
  type NormalizedFuelStation
} from "@ai-shturman/shared";
import {
  getNearbyStations,
  type GdebenzNearbyResponse,
  type GdebenzStationRaw
} from "@ai-shturman/gdebenz-client";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";

interface NearbyFuelParams {
  lat: number;
  lon: number;
  radiusKm: number;
  fuel: string;
}

const nearbyCache = new TtlCache<GdebenzNearbyResponse>(env.cacheTtlMs);

export async function getNearbyFuel(params: NearbyFuelParams): Promise<NearbyFuelResponse> {
  const rawResponse = await getCachedNearbyStations(params);
  const stations = rawResponse.stations
    .map((station) => normalizeStation(station, params.fuel))
    .filter((station): station is NormalizedFuelStation => station !== null)
    .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));

  return {
    ok: true,
    source: "gdebenz",
    updatedAt: rawResponse.updated ?? new Date().toISOString(),
    radiusKm: params.radiusKm,
    userLocation: {
      lat: params.lat,
      lon: params.lon
    },
    stations,
    summary: buildSummary(stations)
  };
}

async function getCachedNearbyStations(params: NearbyFuelParams): Promise<GdebenzNearbyResponse> {
  const cacheKey = makeNearbyCacheKey(params.lat, params.lon, params.radiusKm);
  const cached = nearbyCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await getNearbyStations(
    {
      lat: params.lat,
      lon: params.lon,
      radiusKm: params.radiusKm
    },
    {
      baseUrl: env.gdebenzBaseUrl,
      timeoutMs: env.gdebenzTimeoutMs
    }
  );

  nearbyCache.set(cacheKey, response);
  return response;
}

function normalizeStation(raw: GdebenzStationRaw, requestedFuel: string): NormalizedFuelStation | null {
  const lat = toNumberOrNull(raw.lat);
  const lon = toNumberOrNull(raw.lon);

  if (lat == null || lon == null) {
    return null;
  }

  const status = normalizeStationStatus(raw.status);
  const fuels = parseFuels(raw.fuels_now, raw.detail);
  const hasFuel = hasRequestedFuel(fuels, requestedFuel);
  const freshnessLabel = getFreshnessLabel(raw.last_at);
  const hasQueue = raw.conflict === "queue" || detailMentionsQueue(raw.detail);

  return {
    id: `osm:${raw.osm_id}`,
    brand: normalizeString(raw.brand),
    name: normalizeString(raw.name),
    address: normalizeString(raw.addr),
    lat,
    lon,
    distanceKm: toNumberOrNull(raw.distance_km),
    status,
    statusLabel: getStatusLabel(status),
    fuels,
    hasRequestedFuel: hasFuel,
    hasQueue,
    queueLabel: hasQueue ? "Есть очередь" : getQueueLabel(raw.conflict),
    confidence: toNumberOrNull(raw.confidence_base),
    confirmations: toNumberOrNull(raw.confirmations),
    lastUpdatedAt: raw.last_at ?? null,
    freshnessLabel,
    recommendation: getRecommendation({
      status,
      hasRequestedFuel: hasFuel,
      hasQueue,
      freshnessLabel
    }),
    rawDetail: normalizeString(raw.detail)
  };
}

function buildSummary(stations: NormalizedFuelStation[]): FuelSummary {
  return stations.reduce<FuelSummary>(
    (summary, station) => {
      summary.total += 1;

      if (station.status === "yes" || station.status === "low") {
        summary.withFuel += 1;
      }

      if (station.hasRequestedFuel) {
        summary.withRequestedFuel += 1;
      }

      if (station.hasQueue) {
        summary.withQueue += 1;
      }

      if (station.status === "no") {
        summary.withoutFuel += 1;
      }

      if (station.status === "unknown") {
        summary.unknown += 1;
      }

      return summary;
    },
    {
      total: 0,
      withFuel: 0,
      withRequestedFuel: 0,
      withQueue: 0,
      withoutFuel: 0,
      unknown: 0
    }
  );
}

function makeNearbyCacheKey(lat: number, lon: number, radiusKm: number): string {
  return `${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusKm}`;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
