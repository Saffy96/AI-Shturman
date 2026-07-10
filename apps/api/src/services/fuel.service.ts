import {
  buildRouteBBox,
  getFreshnessLabel,
  getQueueLabel,
  getRecommendation,
  getStatusLabel,
  hasRequestedFuel,
  detailMentionsQueue,
  haversineDistanceKm,
  normalizeStationStatus,
  parseFuels,
  projectPointOnRoute,
  simplifyRoute,
  toNumberOrNull,
  type Coordinates,
  type FuelSummary,
  type GeoSearchResult,
  type NearbyFuelResponse,
  type NormalizedFuelStation,
  type RouteFuelResponse
} from "@ai-shturman/shared";
import {
  getStationsByBBox,
  getNearbyStations,
  GdebenzClientError,
  type GdebenzBBoxStationRaw,
  type GdebenzNearbyResponse,
  type GdebenzStationRaw
} from "@ai-shturman/gdebenz-client";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";
import { getFirstGeoResult, reverseGeo } from "./geo.service.js";
import { getDrivingRoute } from "./openroute.service.js";
import { mergeStationSources, stationNormalizer } from "./station-normalizer.service.js";

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
  fromLat?: number;
  fromLon?: number;
  toLat?: number;
  toLon?: number;
}

interface ChunkFetchResult {
  chunksProcessed: number;
  rawStations: GdebenzBBoxStationRaw[];
  warnings: string[];
}

interface StationRouteMetrics {
  distanceFromRouteKm?: number | null;
  distanceFromStartKm?: number | null;
  routePositionLabel?: string | null;
}

const nearbyCache = new TtlCache<GdebenzNearbyResponse>(env.cacheTtlMs);
const bboxCache = new TtlCache<GdebenzBBoxStationRaw[]>(env.cacheTtlMs);
const stationAddressCache = new TtlCache<string>(7 * 24 * 60 * 60 * 1000);
const MAX_ROUTE_CHUNKS = 20;
const MAX_GDEBENZ_ROUTE_REQUESTS = 24;
const MAX_CHUNK_SPLIT_DEPTH = 2;

interface RequestBudget { remaining: number; }

export async function getNearbyFuel(params: NearbyFuelParams): Promise<NearbyFuelResponse> {
  const rawResponse = await getCachedNearbyStations(params);
  const stations = mergeStationSources([rawResponse.stations
    .map((station) => stationNormalizer.normalizeGdebenz(station, params.fuel))
    .filter((station): station is NormalizedFuelStation => station !== null)
  ]).sort((left, right) => right.rating - left.rating || (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY));
  await enrichStationAddresses(stations);

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
  const [from, to] = await resolveRoutePoints(params);
  const corridorKm = params.corridorKm || adaptiveRadius(haversineDistanceKm(from, to));
  const routeFetch = await fetchApproximateRouteStations(from, to, corridorKm);

  const stations = mergeStationSources([routeFetch.rawStations
    .map((station) => {
      const coordinates = toCoordinates(station);
      return stationNormalizer.normalizeGdebenz(
        station,
        params.fuel,
        coordinates ? haversineDistanceKm(from, coordinates) : null
      );
    })
    .filter((station): station is NormalizedFuelStation => station !== null)
  ]).sort((left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY));
  await enrichStationAddresses(stations);

  return {
    ok: true,
    mode: "route_bbox",
    source: "gdebenz",
    updatedAt: new Date().toISOString(),
    from,
    to,
    corridorKm,
    stations,
    summary: buildSummary(stations),
    warning: [
      "Маршрут считается приблизительно по прямоугольным сегментам, не по дорожной линии.",
      ...routeFetch.warnings
    ].join(" ")
  };
}

export async function getRouteFuelReal(params: RouteFuelParams): Promise<RouteFuelResponse> {
  const [from, to] = await resolveRoutePoints(params);
  const route = await getDrivingRoute(from, to);
  const corridorKm = params.corridorKm || adaptiveRadius(route.distanceKm);
  const routeFetch = await fetchRouteStationsAlongGeometry(route.geometry, corridorKm);

  const stations = mergeStationSources([routeFetch.rawStations
    .map((station) => {
      const coordinates = toCoordinates(station);

      if (!coordinates) {
        return null;
      }

      const projected = projectPointOnRoute(coordinates, route.geometry);

      if (!projected || projected.distanceFromRouteKm > corridorKm + 0.05) {
        return null;
      }

      return stationNormalizer.normalizeGdebenz(station, params.fuel, projected.distanceFromStartKm, {
        distanceFromRouteKm: roundTo(projected.distanceFromRouteKm, 1),
        distanceFromStartKm: roundTo(projected.distanceFromStartKm, 1),
        routePositionLabel: getRoutePositionLabel(projected.distanceFromRouteKm)
      });
    })
    .filter((station): station is NormalizedFuelStation => station !== null)
  ]).sort(compareRouteStations);
  await enrichStationAddresses(stations);

  return {
    ok: true,
    mode: "route_real",
    source: "gdebenz",
    updatedAt: new Date().toISOString(),
    from,
    to,
    corridorKm,
    route: {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      geometryPointsCount: route.geometry.length,
      geometry: route.geometry
    },
    stations,
    summary: buildSummary(stations),
    ...(routeFetch.warnings.length > 0 ? { warning: routeFetch.warnings.join(" ") } : {})
  };
}

async function resolveRoutePoints(params: RouteFuelParams): Promise<[GeoSearchResult, GeoSearchResult]> {
  if (
    params.fromLat != null &&
    params.fromLon != null &&
    params.toLat != null &&
    params.toLon != null
  ) {
    return [
      {
        name: params.from,
        address: params.from,
        lat: params.fromLat,
        lon: params.fromLon
      },
      {
        name: params.to,
        address: params.to,
        lat: params.toLat,
        lon: params.toLon
      }
    ];
  }

  return Promise.all([getFirstGeoResult(params.from), getFirstGeoResult(params.to)]);
}

async function getCachedNearbyStations(params: NearbyFuelParams): Promise<GdebenzNearbyResponse> {
  const cacheKey = `${params.lat.toFixed(3)}:${params.lon.toFixed(3)}:${params.radiusKm}`;
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

async function fetchApproximateRouteStations(
  from: Coordinates,
  to: Coordinates,
  corridorKm: number
): Promise<ChunkFetchResult> {
  const totalDistanceKm = haversineDistanceKm(from, to);
  const chunkCount = getChunkCount(totalDistanceKm, corridorKm);
  const chunks = buildStraightLineChunks(from, to, chunkCount);
  const warnings: string[] = [];
  const rawStations: GdebenzBBoxStationRaw[] = [];
  const budget = { remaining: MAX_GDEBENZ_ROUTE_REQUESTS };

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await fetchGeometryChunkStations(chunks[index], corridorKm, index + 1, MAX_CHUNK_SPLIT_DEPTH, "route-bbox", budget);
    rawStations.push(...result.rawStations);
    warnings.push(...result.warnings);
  }

  return {
    chunksProcessed: chunks.length,
    rawStations: dedupeStations(rawStations),
    warnings
  };
}

async function fetchRouteStationsAlongGeometry(
  routeGeometry: Coordinates[],
  corridorKm: number
): Promise<ChunkFetchResult> {
  const searchGeometry = simplifyRoute(routeGeometry, 25);
  const totalDistanceKm = getGeometryLengthKm(searchGeometry);
  const chunks = buildGeometryChunks(searchGeometry, totalDistanceKm, corridorKm);
  const warnings: string[] = [];
  const rawStations: GdebenzBBoxStationRaw[] = [];
  const budget = { remaining: MAX_GDEBENZ_ROUTE_REQUESTS };

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await fetchGeometryChunkStations(chunks[index], corridorKm, index + 1, MAX_CHUNK_SPLIT_DEPTH, "route-real", budget);
    rawStations.push(...result.rawStations);
    warnings.push(...result.warnings);
  }

  const uniqueStations = dedupeStations(rawStations);
  console.log(`[route-real] points: ${routeGeometry.length}->${searchGeometry.length}, chunks: ${chunks.length}, requests: ${MAX_GDEBENZ_ROUTE_REQUESTS - budget.remaining}, stations raw: ${rawStations.length}, unique: ${uniqueStations.length}`);

  return {
    chunksProcessed: chunks.length,
    rawStations: uniqueStations,
    warnings
  };
}

async function fetchGeometryChunkStations(
  chunkGeometry: Coordinates[],
  corridorKm: number,
  chunkIndex: number,
  splitDepthRemaining: number,
  warningPrefix: "route-real" | "route-bbox",
  budget: RequestBudget
): Promise<ChunkFetchResult> {
  if (budget.remaining <= 0) {
    return { chunksProcessed: 0, rawStations: [], warnings: [`Лимит запросов gdebenz исчерпан: сегмент ${chunkIndex} пропущен.`] };
  }
  budget.remaining -= 1;
  const bbox = buildRouteBBox(chunkGeometry, corridorKm);

  try {
    const stations = await getCachedBBoxStations(bbox);
    return {
      chunksProcessed: 1,
      rawStations: stations,
      warnings: []
    };
  } catch (error) {
    if (isBBoxTooLargeError(error) && splitDepthRemaining > 0 && chunkGeometry.length > 2) {
      const [left, right] = splitGeometryChunk(chunkGeometry);
      const leftResult = await fetchGeometryChunkStations(left, corridorKm, chunkIndex, splitDepthRemaining - 1, warningPrefix, budget);
      const rightResult = await fetchGeometryChunkStations(right, corridorKm, chunkIndex, splitDepthRemaining - 1, warningPrefix, budget);

      return {
        chunksProcessed: leftResult.chunksProcessed + rightResult.chunksProcessed,
        rawStations: [...leftResult.rawStations, ...rightResult.rawStations],
        warnings: [...leftResult.warnings, ...rightResult.warnings]
      };
    }

    if (isBBoxTooLargeError(error)) {
      return {
        chunksProcessed: 1,
        rawStations: [],
        warnings: [`Часть маршрута пропущена: chunk ${chunkIndex} все еще слишком большой для gdebenz.`]
      };
    }

    const message = error instanceof GdebenzClientError || error instanceof Error ? error.message : "unknown error";
    return { chunksProcessed: 1, rawStations: [], warnings: [`Часть маршрута пропущена: сегмент ${chunkIndex} не загрузился (${warningPrefix}: ${message}).`] };
  }
}

function normalizeStation(
  raw: GdebenzStationRaw | GdebenzBBoxStationRaw,
  requestedFuel: string,
  fallbackDistanceKm?: number | null,
  routeMetrics?: StationRouteMetrics
): NormalizedFuelStation | null {
  const coordinates = toCoordinates(raw);

  if (!coordinates) {
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
    source: "gdebenz",
    sources: ["gdebenz", "osm"],
    brand: normalizeString(raw.brand),
    name: normalizeString(raw.name),
    address: normalizeString(raw.addr),
    lat: coordinates.lat,
    lon: coordinates.lon,
    distanceKm: toNumberOrNull(getUnknownField(raw, "distance_km")) ?? fallbackDistanceKm ?? null,
    status,
    statusLabel: getStatusLabel(status),
    fuels,
    prices: null,
    hasRequestedFuel: hasFuel,
    hasQueue,
    queue: { present: hasQueue, estimatedMinutes: hasQueue ? 5 : 0 },
    queueLabel: hasQueue ? "Есть очередь" : getQueueLabel(raw.conflict),
    confidence: toNumberOrNull(getUnknownField(raw, "confidence_base")),
    confirmations: toNumberOrNull(getUnknownField(raw, "confirmations")),
    reports: Math.max(0, Math.round(toNumberOrNull(getUnknownField(raw, "confirmations")) ?? 0)),
    lastUpdatedAt,
    freshnessLabel,
    freshness: 0,
    reliability: 0,
    reliabilityLabel: "low",
    rating: 0,
    stopCost: { deviationKm: routeMetrics?.distanceFromRouteKm ?? 0, extraTimeMin: 0, fuelLiters: 0, fuelPriceRub: null, totalRub: null },
    recommendation: getRecommendation({
      status,
      hasRequestedFuel: hasFuel,
      hasQueue,
      freshnessLabel
    }),
    rawDetail: normalizeString(detail),
    distanceFromRouteKm: routeMetrics?.distanceFromRouteKm ?? null,
    distanceFromStartKm: routeMetrics?.distanceFromStartKm ?? null,
    routePositionLabel: routeMetrics?.routePositionLabel ?? null
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

function buildStraightLineChunks(from: Coordinates, to: Coordinates, chunkCount: number): Coordinates[][] {
  const chunks: Coordinates[][] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const startFactor = index / chunkCount;
    const endFactor = (index + 1) / chunkCount;

    chunks.push([interpolatePoint(from, to, startFactor), interpolatePoint(from, to, endFactor)]);
  }

  return chunks;
}

function buildGeometryChunks(routeGeometry: Coordinates[], totalDistanceKm: number, corridorKm: number): Coordinates[][] {
  if (routeGeometry.length <= 2) {
    return [routeGeometry];
  }

  const targetChunkLengthKm = Math.max(Math.ceil(totalDistanceKm / MAX_ROUTE_CHUNKS), corridorKm * 6, 35);
  const chunks: Coordinates[][] = [];
  let currentChunk: Coordinates[] = [routeGeometry[0]];
  let currentDistanceKm = 0;

  for (let index = 1; index < routeGeometry.length; index += 1) {
    const previous = routeGeometry[index - 1];
    const point = routeGeometry[index];
    currentChunk.push(point);
    currentDistanceKm += haversineDistanceKm(previous, point);

    const canCloseChunk = chunks.length < MAX_ROUTE_CHUNKS - 1 && currentChunk.length >= 2;

    if (canCloseChunk && currentDistanceKm >= targetChunkLengthKm) {
      chunks.push(currentChunk);
      currentChunk = [point];
      currentDistanceKm = 0;
    }
  }

  if (currentChunk.length === 1 && chunks.length > 0) {
    chunks[chunks.length - 1].push(currentChunk[0]);
  } else if (currentChunk.length >= 2) {
    chunks.push(currentChunk);
  }

  return chunks.filter((chunk) => chunk.length >= 2);
}

function splitGeometryChunk(chunkGeometry: Coordinates[]): [Coordinates[], Coordinates[]] {
  const middleIndex = Math.floor(chunkGeometry.length / 2);
  const left = chunkGeometry.slice(0, middleIndex + 1);
  const right = chunkGeometry.slice(middleIndex);

  return [left, right];
}

function compareRouteStations(left: NormalizedFuelStation, right: NormalizedFuelStation): number {
  return (
    (left.distanceFromStartKm ?? left.distanceKm ?? Number.POSITIVE_INFINITY) -
      (right.distanceFromStartKm ?? right.distanceKm ?? Number.POSITIVE_INFINITY) ||
    (left.distanceFromRouteKm ?? Number.POSITIVE_INFINITY) - (right.distanceFromRouteKm ?? Number.POSITIVE_INFINITY)
  );
}

function getChunkCount(totalDistanceKm: number, corridorKm: number): number {
  const targetChunkLengthKm = Math.max(80, corridorKm * 2);
  const requestedChunks = Math.ceil(totalDistanceKm / targetChunkLengthKm);
  return clamp(Math.max(1, requestedChunks), 1, MAX_ROUTE_CHUNKS);
}

function getGeometryLengthKm(routeGeometry: Coordinates[]): number {
  let totalKm = 0;

  for (let index = 1; index < routeGeometry.length; index += 1) {
    totalKm += haversineDistanceKm(routeGeometry[index - 1], routeGeometry[index]);
  }

  return totalKm;
}

function getRoutePositionLabel(distanceFromRouteKm: number): string {
  if (distanceFromRouteKm < 0.3) {
    return "Прямо по маршруту";
  }

  return `Отклонение от маршрута: ${formatDistanceKm(distanceFromRouteKm)} км`;
}

function formatDistanceKm(value: number): string {
  if (value < 10) {
    return value.toFixed(1);
  }

  return String(Math.round(value));
}

function adaptiveRadius(routeDistanceKm: number): number {
  if (routeDistanceKm <= 30) return 5;
  if (routeDistanceKm <= 500) return 20;
  return 50;
}

async function enrichStationAddresses(stations: NormalizedFuelStation[]): Promise<void> {
  const missing = stations.filter((station) => !station.address).slice(0, 8);
  await Promise.allSettled(missing.map(async (station) => {
    const key = `${station.lat.toFixed(5)}:${station.lon.toFixed(5)}`;
    const cached = stationAddressCache.get(key);
    if (cached) { station.address = cached; return; }
    const result = await reverseGeo(station.lat, station.lon);
    if (result.address) { station.address = result.address; stationAddressCache.set(key, result.address); }
  }));
}

function interpolatePoint(from: Coordinates, to: Coordinates, factor: number): Coordinates {
  return {
    lat: from.lat + (to.lat - from.lat) * factor,
    lon: from.lon + (to.lon - from.lon) * factor
  };
}

function toCoordinates(value: { lat: unknown; lon: unknown }): Coordinates | null {
  const lat = toNumberOrNull(value.lat);
  const lon = toNumberOrNull(value.lon);

  if (lat == null || lon == null) {
    return null;
  }

  return { lat, lon };
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getStringField(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  return typeof value === "string" ? value : null;
}

function getUnknownField(raw: Record<string, unknown>, key: string): unknown {
  return raw[key];
}

function dedupeStations(stations: GdebenzBBoxStationRaw[]): GdebenzBBoxStationRaw[] {
  const map = new Map<string, GdebenzBBoxStationRaw>();

  for (const station of stations) {
    map.set(String(station.osm_id), station);
  }

  return [...map.values()];
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isBBoxTooLargeError(error: unknown): boolean {
  return (
    error instanceof GdebenzClientError &&
    error.statusCode === 400 &&
    typeof error.cause === "string" &&
    error.cause.includes("bbox_too_large")
  );
}
