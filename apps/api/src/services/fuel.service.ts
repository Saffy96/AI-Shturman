import {
  buildRouteBBox,
  haversineDistanceKm,
  projectPointOnRoute,
  simplifyRoute,
  toNumberOrNull,
  type Coordinates,
  type FuelSummary,
  type GeoSearchResult,
  type NearbyFuelResponse,
  type NormalizedFuelStation,
  type NormalizedStationDetails,
  type RouteFuelResponse
} from "@ai-shturman/shared";
import {
  getStationsByBBox,
  getNearbyStations,
  getStationDetails,
  getStationRecent,
  GdebenzClientError,
  type GdebenzBBoxStationRaw,
  type GdebenzNearbyResponse,
  type GdebenzRecentResponseRaw,
  type GdebenzStationDetailsRaw,
} from "@ai-shturman/gdebenz-client";
import { env } from "../config/env.js";
import { TtlCache } from "../utils/ttl-cache.js";
import { getFirstGeoResult, reverseGeo } from "./geo.service.js";
import { getDrivingRoute } from "./openroute.service.js";
import {
  applyHoseRatingContext,
  extractActivityRecords,
  mergeStationActivities,
  mergeStationSources,
  normalizeStationActivities,
  normalizeStationDetails,
  stationNormalizer
} from "./station-normalizer.service.js";

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

const nearbyCache = new TtlCache<GdebenzNearbyResponse>(env.cacheTtlMs, 250);
const bboxCache = new TtlCache<GdebenzBBoxStationRaw[]>(env.cacheTtlMs, 500);
const detailsCache = new TtlCache<GdebenzStationDetailsRaw>(90_000, 1_000);
const recentCache = new TtlCache<GdebenzRecentResponseRaw>(90_000, 1_000);
const stationAddressCache = new TtlCache<string>(7 * 24 * 60 * 60 * 1000, 10_000);
const nearbyRequests = new Map<string, Promise<GdebenzNearbyResponse>>();
const bboxRequests = new Map<string, Promise<GdebenzBBoxStationRaw[]>>();
const detailsRequests = new Map<string, Promise<GdebenzStationDetailsRaw>>();
const recentRequests = new Map<string, Promise<GdebenzRecentResponseRaw>>();
const MAX_ROUTE_CHUNKS = 20;
const MAX_GDEBENZ_ROUTE_REQUESTS = 24;
const MAX_CHUNK_SPLIT_DEPTH = 2;
const DETAILS_RETRY_DELAYS_MS = [0, 300, 900] as const;
// Gdebenz serves a 30-minute public cache when fp is omitted. Its own web app
// always sends a fingerprint; this stable read-only fingerprint selects the
// fresh response while our short local cache still protects the upstream.
const GDEBENZ_DETAILS_FINGERPRINT = "ai-shturman-readonly";

interface RequestBudget { remaining: number; }

export async function getFuelStationDetails(osmId: number | string, forceRefresh = false): Promise<NormalizedStationDetails> {
  const [commentsResult, recentResult] = await Promise.allSettled([
    getCachedStationDetails(osmId, forceRefresh),
    getCachedStationRecent(osmId, forceRefresh)
  ]);

  if (commentsResult.status === "rejected" && recentResult.status === "rejected") {
    throw new AggregateError([commentsResult.reason, recentResult.reason], "Failed to load station details");
  }

  const commentsResponse = commentsResult.status === "fulfilled" ? commentsResult.value : {};
  const recentResponse = recentResult.status === "fulfilled" ? recentResult.value : [];
  const commentRecords = extractActivityRecords(commentsResponse);
  const recentRecords = extractActivityRecords(recentResponse);
  const normalizedComments = normalizeStationActivities(osmId, commentRecords, "comments");
  const normalizedRecent = normalizeStationActivities(osmId, recentRecords, "recent");
  const mergedActivities = [...normalizedRecent, ...normalizedComments];
  const activities = mergeStationActivities([normalizedRecent, normalizedComments]);
  const station = normalizeStationDetails(osmId, commentsResponse, recentRecords, activities);
  const diagnostics = {
    comments: commentRecords.length,
    recent: recentRecords.length,
    merged: mergedActivities.length,
    deduplicated: activities.length,
    ...(commentsResult.status === "rejected" ? { commentsError: errorMessage(commentsResult.reason) } : {}),
    ...(recentResult.status === "rejected" ? { recentError: errorMessage(recentResult.reason) } : {})
  };

  if (env.nodeEnv === "development") {
    station.activityDiagnostics = diagnostics;
    console.group(`[Gdebenz details] ${osmId}`);
    console.log("comments raw:", commentsResult.status === "fulfilled" ? commentsResult.value : commentsResult.reason);
    console.log("recent raw:", recentResult.status === "fulfilled" ? recentResult.value : recentResult.reason);
    console.log("merged normalized:", activities);
    console.groupEnd();
  }

  return station;
}

async function getCachedStationDetails(osmId: number | string, forceRefresh: boolean): Promise<GdebenzStationDetailsRaw> {
  const key = String(osmId);
  const stale = detailsCache.peek(key);
  if (!forceRefresh) {
    const cached = detailsCache.get(key);
    if (cached) return cached;
  }
  return coalesceRequest(detailsRequests, key, async () => {
    try {
      const value = await retryGdebenzRequest(() => getStationDetails(osmId, GDEBENZ_DETAILS_FINGERPRINT, gdebenzOptions()));
      detailsCache.set(key, value);
      return value;
    } catch (error) {
      if (stale) return stale;
      throw error;
    }
  });
}

async function getCachedStationRecent(osmId: number | string, forceRefresh: boolean): Promise<GdebenzRecentResponseRaw> {
  const key = String(osmId);
  const stale = recentCache.peek(key);
  if (!forceRefresh) {
    const cached = recentCache.get(key);
    if (cached) return cached;
  }
  return coalesceRequest(recentRequests, key, async () => {
    try {
      const value = await retryGdebenzRequest(() => getStationRecent(osmId, 30, GDEBENZ_DETAILS_FINGERPRINT, gdebenzOptions()));
      recentCache.set(key, value);
      return value;
    } catch (error) {
      if (stale) return stale;
      throw error;
    }
  });
}

async function retryGdebenzRequest<T>(request: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const delayMs of DETAILS_RETRY_DELAYS_MS) {
    if (delayMs > 0) await delay(delayMs);
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (!isRetryableGdebenzError(error)) throw error;
    }
  }
  throw lastError;
}

function isRetryableGdebenzError(error: unknown): boolean {
  return error instanceof GdebenzClientError
    && (error.isTimeout || error.statusCode == null || error.statusCode === 429 || error.statusCode >= 500);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function gdebenzOptions() {
  return { baseUrl: env.gdebenzBaseUrl, timeoutMs: env.gdebenzTimeoutMs };
}

export async function getNearbyFuel(params: NearbyFuelParams): Promise<NearbyFuelResponse> {
  const rawResponse = await getCachedNearbyStations(params);
  const stations = applyHoseRatingContext(mergeStationSources([rawResponse.stations
    .map((station) => stationNormalizer.normalizeGdebenz(station, params.fuel))
    .filter((station): station is NormalizedFuelStation => station !== null)
  ])).sort((left, right) => right.hoseRating - left.hoseRating || (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY));
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

  const stations = applyHoseRatingContext(mergeStationSources([routeFetch.rawStations
    .map((station) => {
      const coordinates = toCoordinates(station);
      return stationNormalizer.normalizeGdebenz(
        station,
        params.fuel,
        coordinates ? haversineDistanceKm(from, coordinates) : null
      );
    })
    .filter((station): station is NormalizedFuelStation => station !== null)
  ])).sort((left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY));
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

  const stations = applyHoseRatingContext(mergeStationSources([routeFetch.rawStations
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
  ])).sort(compareRouteStations);
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

  return coalesceRequest(nearbyRequests, cacheKey, async () => {
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
  });
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

  return coalesceRequest(bboxRequests, cacheKey, async () => {
    const response = await getStationsByBBox(params, {
      baseUrl: env.gdebenzBaseUrl,
      timeoutMs: env.gdebenzTimeoutMs
    });
    bboxCache.set(cacheKey, response);
    return response;
  });
}

function coalesceRequest<T>(requests: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const existing = requests.get(key);
  if (existing) return existing;
  const pending = (async () => {
    try {
      return await load();
    } finally {
      requests.delete(key);
    }
  })();
  requests.set(key, pending);
  return pending;
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
