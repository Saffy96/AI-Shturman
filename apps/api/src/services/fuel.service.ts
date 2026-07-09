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
  type NormalizedFuelStation,
  type RouteFuelResponse
} from "@ai-shturman/shared";
import {
  getStationsByBBox,
  getNearbyStations,
  type GdebenzBBoxStationRaw,
  type GdebenzNearbyResponse,
  type GdebenzStationRaw
} from "@ai-shturman/gdebenz-client";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";
import { getFirstGeoResult } from "./geo.service.js";

interface NearbyFuelParams {
  lat: number;
  lon: number;
  radiusKm: number;
  fuel: string;
}

interface RouteFuelParams {
  from: string;
  to: string;
  fuel: string;
  corridorKm: number;
}

const nearbyCache = new TtlCache<GdebenzNearbyResponse>(env.cacheTtlMs);
const bboxCache = new TtlCache<GdebenzBBoxStationRaw[]>(env.cacheTtlMs);

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

export async function getRouteFuel(params: RouteFuelParams): Promise<RouteFuelResponse> {
  const [from, to] = await Promise.all([getFirstGeoResult(params.from), getFirstGeoResult(params.to)]);
  const bbox = buildRouteBBox(from, to, params.corridorKm);
  const rawStations = await getCachedBBoxStations(bbox);

  const stations = rawStations
    .map((station) => normalizeStation(station, params.fuel, calculateDistanceKm(from, station)))
    .filter((station): station is NormalizedFuelStation => station !== null)
    .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));

  return {
    ok: true,
    mode: "route_bbox",
    source: "gdebenz",
    updatedAt: new Date().toISOString(),
    from,
    to,
    corridorKm: params.corridorKm,
    stations,
    summary: buildSummary(stations),
    warning: "Маршрут считается приблизительно по прямоугольной области, не по дорожной линии."
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

async function getCachedBBoxStations(params: {
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
}): Promise<GdebenzBBoxStationRaw[]> {
  const cacheKey = `${params.lat1.toFixed(3)}:${params.lon1.toFixed(3)}:${params.lat2.toFixed(3)}:${params.lon2.toFixed(3)}`;
  const cached = bboxCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await getStationsByBBox(params, {
    baseUrl: env.gdebenzBaseUrl,
    timeoutMs: env.gdebenzTimeoutMs
  });

  bboxCache.set(cacheKey, response);
  return response;
}

function normalizeStation(
  raw: GdebenzStationRaw | GdebenzBBoxStationRaw,
  requestedFuel: string,
  fallbackDistanceKm?: number | null
): NormalizedFuelStation | null {
  const lat = toNumberOrNull(raw.lat);
  const lon = toNumberOrNull(raw.lon);

  if (lat == null || lon == null) {
    return null;
  }

  const status = normalizeStationStatus(raw.status);
  const detail = getStringField(raw, "detail");
  const fuels = parseFuels(raw.fuels_now, detail);
  const hasFuel = hasRequestedFuel(fuels, requestedFuel);
  const lastUpdatedAt = getStringField(raw, "last_at");
  const freshnessLabel = getFreshnessLabel(lastUpdatedAt);
  const hasQueue = raw.conflict === "queue" || detailMentionsQueue(detail);

  return {
    id: `osm:${raw.osm_id}`,
    brand: normalizeString(raw.brand),
    name: normalizeString(raw.name),
    address: normalizeString(raw.addr),
    lat,
    lon,
    distanceKm: toNumberOrNull(getUnknownField(raw, "distance_km")) ?? fallbackDistanceKm ?? null,
    status,
    statusLabel: getStatusLabel(status),
    fuels,
    hasRequestedFuel: hasFuel,
    hasQueue,
    queueLabel: hasQueue ? "Есть очередь" : getQueueLabel(raw.conflict),
    confidence: toNumberOrNull(getUnknownField(raw, "confidence_base")),
    confirmations: toNumberOrNull(getUnknownField(raw, "confirmations")),
    lastUpdatedAt,
    freshnessLabel,
    recommendation: getRecommendation({
      status,
      hasRequestedFuel: hasFuel,
      hasQueue,
      freshnessLabel
    }),
    rawDetail: normalizeString(detail)
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

function buildRouteBBox(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  corridorKm: number
): { lat1: number; lon1: number; lat2: number; lon2: number } {
  const avgLatRad = (((from.lat + to.lat) / 2) * Math.PI) / 180;
  const latBuffer = corridorKm / 111;
  const lonBuffer = corridorKm / (111 * Math.max(Math.cos(avgLatRad), 0.2));

  return {
    lat1: clamp(Math.min(from.lat, to.lat) - latBuffer, -90, 90),
    lon1: clamp(Math.min(from.lon, to.lon) - lonBuffer, -180, 180),
    lat2: clamp(Math.max(from.lat, to.lat) + latBuffer, -90, 90),
    lon2: clamp(Math.max(from.lon, to.lon) + lonBuffer, -180, 180)
  };
}

function calculateDistanceKm(
  from: { lat: number; lon: number },
  station: { lat: number | string; lon: number | string }
): number | null {
  const lat = toNumberOrNull(station.lat);
  const lon = toNumberOrNull(station.lon);

  if (lat == null || lon == null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - from.lat);
  const dLon = toRadians(lon - from.lon);
  const fromLat = toRadians(from.lat);
  const stationLat = toRadians(lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) * Math.cos(stationLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusKm * c * 10) / 10;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getStringField(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  return typeof value === "string" ? value : null;
}

function getUnknownField(raw: Record<string, unknown>, key: string): unknown {
  return raw[key];
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
