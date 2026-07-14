import type {
  GdebenzBBoxStationRaw,
  GdebenzRecentReportRaw,
  GdebenzStationDetailsRaw,
  GdebenzStationRaw
} from "@ai-shturman/gdebenz-client";
import {
  detailMentionsQueue, getFreshnessLabel, getQueueLabel, getRecommendation, getStatusLabel,
  hasRequestedFuel, haversineDistanceKm, normalizeStationStatus, parseFuels, toNumberOrNull,
  type NormalizedFuelStation, type NormalizedStationDetails, type StationActivity, type StationActivityType,
  type StationPrice, type StationSource
} from "@ai-shturman/shared";

export interface StationRouteMetrics { distanceFromRouteKm?: number | null; distanceFromStartKm?: number | null; routePositionLabel?: string | null; }

export class StationNormalizer {
  normalizeGdebenz(raw: GdebenzStationRaw | GdebenzBBoxStationRaw, requestedFuel: string, fallbackDistanceKm?: number | null, route?: StationRouteMetrics): NormalizedFuelStation | null {
    const lat = toNumberOrNull(raw.lat); const lon = toNumberOrNull(raw.lon);
    if (lat == null || lon == null) return null;
    const detail = stringValue(raw.detail);
    const status = normalizeStationStatus(raw.status);
    const fuels = parseFuels(raw.fuels_now, detail);
    const selectedFuel = requestedFuel === "all" || hasRequestedFuel(fuels, requestedFuel);
    const updatedAt = stringValue(raw.last_at);
    const freshnessLabel = getFreshnessLabel(updatedAt);
    const freshness = freshnessScore(updatedAt);
    const confidence = normalizeProbability(toNumberOrNull(raw.confidence_base));
    const confirmations = toNumberOrNull(raw.confirmations);
    const reliability = clamp((confidence ?? 0.5) * 0.65 + freshness * 0.25 + Math.min(confirmations ?? 0, 5) / 50, 0, 1);
    const hasQueue = status === "queue" || raw.conflict === "queue" || detailMentionsQueue(detail);
    const deviation = route?.distanceFromRouteKm ?? null;
    const rating = calculateStationRating({ selectedFuel, status, freshness, reliability, deviationKm: deviation, hasQueue });
    const prices = parsePrices(raw);
    const stopCost = calculateStopCost(deviation, requestedFuel === "all" ? null : prices?.[requestedFuel] ?? null);
    return {
      id: `osm:${raw.osm_id}`, source: "gdebenz", sources: ["gdebenz", "osm"], brand: stringValue(raw.brand), name: stringValue(raw.name), address: stringValue(raw.addr), lat, lon,
      distanceKm: toNumberOrNull(raw.distance_km) ?? fallbackDistanceKm ?? null, status, statusLabel: getStatusLabel(status), fuels, hasRequestedFuel: selectedFuel,
      prices, hasQueue, queue: { present: hasQueue, vehicleRange: null, confirmations: null, estimatedMinutes: hasQueue ? 5 : 0 }, queueLabel: hasQueue ? "Есть очередь" : getQueueLabel(raw.conflict), confidence, confirmations, reports: Math.max(0, Math.round(confirmations ?? 0)), lastUpdatedAt: updatedAt, freshnessLabel, freshness,
      reliability, reliabilityLabel: reliability >= 0.7 ? "high" : reliability >= 0.4 ? "medium" : "low", rating, stopCost,
      recommendation: rating >= 60 ? "Лучше заехать сюда" : getRecommendation({ status, hasRequestedFuel: selectedFuel, hasQueue, freshnessLabel }), rawDetail: detail,
      distanceFromRouteKm: deviation, distanceFromStartKm: route?.distanceFromStartKm ?? null, routePositionLabel: route?.routePositionLabel ?? null
    };
  }
}

export function normalizeStationDetails(
  osmId: number | string,
  raw: GdebenzStationDetailsRaw = {},
  recent: GdebenzRecentReportRaw[] = [],
  activities: StationActivity[] = normalizeStationActivities(osmId, recent, "recent")
): NormalizedStationDetails {
  const status = normalizeStationStatus(raw.status);
  const fuels = parseFuels(raw.fuelsNow);
  const limits = raw.limits;
  const queuePresent = status === "queue" || limits?.q === "yes"
    || (isRecord(raw.freshConflict) && raw.freshConflict.status === "queue");
  const confidenceBase = toNumberOrNull(raw.confidenceBase);
  const structuredLimitLiters = positiveNumberOrNull(limits?.lim);
  const limitConfirmations = positiveNumberOrNull(limits?.limCnt);
  const currentDetailLimitLiters = findLimitLiters(raw.detail, []);
  const limitActive = structuredLimitLiters != null
    || currentDetailLimitLiters != null
    || limitConfirmations != null;
  const limitLiters = limitActive
    ? structuredLimitLiters ?? currentDetailLimitLiters ?? findLimitLiters(null, recent)
    : null;

  return {
    id: `osm:${osmId}`,
    status,
    statusLabel: getStatusLabel(status),
    fuels,
    fuelBrandsKnown: fuels.length > 0,
    confidencePercent: confidenceBase == null ? null : clamp(confidenceBase * 100, 0, 100),
    confirmations: toNumberOrNull(raw.confirmations),
    confirmationsFresh: toNumberOrNull(raw.confirmationsFresh),
    realCount: toNumberOrNull(raw.realCount),
    updatedAt: normalizeSourceDate(raw.updated),
    seeded: raw.seeded === true,
    views: toNumberOrNull(raw.views),
    freshConflict: raw.freshConflict === true || isRecord(raw.freshConflict),
    queue: {
      present: queuePresent,
      vehicleRange: stringValue(limits?.qn),
      confirmations: toNumberOrNull(limits?.qCnt),
      estimatedMinutes: null
    },
    limit: {
      active: limitActive,
      liters: limitLiters,
      confirmations: limitConfirmations
    },
    prices: normalizeDetailsPrices(raw.pricesNow),
    address: stringValue(raw.addr),
    cvt: raw.cvt ?? null,
    detail: stringValue(raw.detail),
    recentReports: recent.map((report) => ({
      status: normalizeStationStatus(report.status),
      detail: stringValue(report.detail),
      createdAt: stringValue(report.created_at),
      edited: report.edited === true,
      authorReliable: report.author_reliable === true,
      onSite: report.on_site === true
    })),
    activities,
    sourceLabel: "Данные водителей"
  };
}

const ACTIVITY_DATE_FIELDS = ["createdAt", "created_at", "date", "timestamp", "time", "ts", "publishedAt", "updatedAt"] as const;

export function parseActivityTimestamp(raw: unknown): number | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    for (const field of ACTIVITY_DATE_FIELDS) {
      if (record[field] == null) continue;
      const parsed = parseActivityTimestamp(record[field]);
      if (parsed != null) return parsed;
    }
    return null;
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const timestamp = raw < 10_000_000_000 ? raw * 1000 : raw;
    return Number.isFinite(new Date(timestamp).getTime()) ? timestamp : null;
  }

  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) return parseActivityTimestamp(Number(value));
  // Gdebenz emits UTC timestamps without an explicit zone. Its frontend also
  // interprets these values as UTC before formatting them in the device zone.
  const apiUtcDate = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/);
  const timestamp = Date.parse(apiUtcDate ? `${apiUtcDate[1]}T${apiUtcDate[2]}Z` : value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function extractActivityRecords(payload: unknown): GdebenzRecentReportRaw[] {
  if (Array.isArray(payload)) return payload.filter(isRecord) as GdebenzRecentReportRaw[];
  if (!isRecord(payload)) return [];
  for (const key of ["data", "items", "comments", "recent"] as const) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested.filter(isRecord) as GdebenzRecentReportRaw[];
    if (isRecord(nested)) {
      const records = extractActivityRecords(nested);
      if (records.length) return records;
    }
  }
  return [];
}

export function normalizeStationActivities(
  osmId: number | string,
  records: GdebenzRecentReportRaw[],
  source: StationActivity["source"]
): StationActivity[] {
  return records.map((raw, index) => normalizeActivity(osmId, raw, source, index));
}

export function mergeStationActivities(groups: StationActivity[][]): StationActivity[] {
  const deduplicated = new Map<string, StationActivity>();
  for (const item of groups.flat()) {
    const key = getActivityDedupKey(item);
    const existing = deduplicated.get(key);
    deduplicated.set(key, existing ? chooseMoreCompleteActivity(existing, item) : item);
  }
  return [...deduplicated.values()].sort((a, b) => {
    const aTime = Number.isFinite(a.createdAtMs) ? a.createdAtMs : Number.NEGATIVE_INFINITY;
    const bTime = Number.isFinite(b.createdAtMs) ? b.createdAtMs : Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });
}

export function getActivityDedupKey(item: StationActivity): string {
  if (item.sourceId) return `source-id:${item.sourceId}`;
  return [
    item.osmId,
    item.type,
    Number.isFinite(item.createdAtMs) ? item.createdAtMs : "unknown-date",
    item.text.trim(),
    item.fuelTypes.join(","),
    item.limitLiters ?? "",
    item.queue?.minCars ?? "",
    item.queue?.maxCars ?? "",
    item.wasOnSite ?? ""
  ].join("|");
}

export function chooseMoreCompleteActivity(first: StationActivity, second: StationActivity): StationActivity {
  return activityCompleteness(second) > activityCompleteness(first) ? second : first;
}

function normalizeActivity(
  osmId: number | string,
  raw: GdebenzRecentReportRaw,
  source: StationActivity["source"],
  index: number
): StationActivity {
  const text = firstString(raw.detail, raw.text, raw.message, raw.comment) ?? activityFallbackText(raw);
  const createdAtMs = parseActivityTimestamp(raw) ?? Number.NaN;
  const createdAt = Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString() : firstDateValue(raw) ?? "";
  const sourceId = firstString(raw.sourceId, raw.id, raw.comment_id, raw.commentId);
  const fuelTypes = parseActivityFuels(raw, text);
  const limitLiters = parseLimitLiters(raw.limitLiters ?? raw.limit_liters, text);
  const queue = parseActivityQueue(raw.queue, text);
  const type = normalizeActivityType(raw.type, raw.status, text, limitLiters);
  const identity = sourceId ?? [String(osmId), type, createdAtMs, text, index].join("|");

  return {
    id: `activity:${stableHash(identity)}`,
    ...(sourceId ? { sourceId } : {}),
    osmId: String(osmId),
    type,
    text,
    fuelTypes,
    ...(queue ? { queue } : {}),
    ...(limitLiters != null ? { limitLiters } : {}),
    createdAt,
    createdAtMs,
    ...(typeof raw.on_site === "boolean" ? { wasOnSite: raw.on_site } : {}),
    ...(typeof raw.author_reliable === "boolean" ? { authorReliable: raw.author_reliable } : {}),
    ...(typeof raw.edited === "boolean" ? { edited: raw.edited } : {}),
    source
  };
}

function normalizeActivityType(type: unknown, status: unknown, text: string, limitLiters: number | null): StationActivityType {
  const value = String(type ?? "").trim().toLowerCase();
  const aliases: Record<string, StationActivityType> = {
    fuel: "fuel_available", yes: "fuel_available", available: "fuel_available", fuel_available: "fuel_available",
    no: "fuel_unavailable", unavailable: "fuel_unavailable", fuel_unavailable: "fuel_unavailable",
    low: limitLiters != null ? "limit" : "fuel_available", queue: "queue", limit: "limit",
    closed: "station_closed", station_closed: "station_closed", open: "station_open", station_open: "station_open",
    price: "price", comment: "comment"
  };
  if (aliases[value]) return aliases[value];
  const statusValue = String(status ?? "").trim().toLowerCase();
  if (aliases[statusValue]) return aliases[statusValue];
  if (/очеред/i.test(text)) return "queue";
  if (limitLiters != null || /лимит/i.test(text)) return "limit";
  return "unknown";
}

function parseActivityQueue(rawQueue: unknown, text: string): StationActivity["queue"] | undefined {
  const range = text.match(/(?:≈|~)?\s*(\d+)\s*[–—-]\s*(\d+)\s*машин/i);
  if (range) return { label: range[0].trim(), minCars: Number(range[1]), maxCars: Number(range[2]) };
  const count = text.match(/(?:очеред\S*\s*)?(\d+)\s*машин/i);
  if (count) return { label: count[0].trim(), minCars: Number(count[1]), maxCars: Number(count[1]) };
  if (/очеред/i.test(text) || rawQueue === true || isRecord(rawQueue)) return { label: "Очередь" };
  return undefined;
}

function parseActivityFuels(raw: GdebenzRecentReportRaw, text: string): string[] {
  const structured = raw.fuelTypes ?? raw.fuels ?? raw.fuels_now;
  if (structured != null) return parseFuels(structured);
  // Detail strings use `fuels · queue · limit`. Restricting fuel parsing to
  // the first segment prevents "50–100 машин" from inventing АИ-100.
  const firstSegment = text.split("·", 1)[0]?.trim() ?? "";
  const withoutMetrics = firstSegment
    .replace(/(?:≈|~)?\s*\d+\s*[–—-]\s*\d+\s*машин/gi, " ")
    .replace(/лимит(?:ом|а)?\s*(?:до|:|—|-)?\s*\d+(?:[.,]\d+)?\s*л/gi, " ");
  return parseFuels(undefined, withoutMetrics);
}

function parseLimitLiters(rawLimit: unknown, text: string): number | null {
  const direct = toNumberOrNull(rawLimit);
  if (direct != null && direct > 0) return direct;
  const match = text.match(/лимит(?:ом|а)?(?:\s*(?:до|:|—|-))?\s*(\d+(?:[.,]\d+)?)\s*л/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function activityFallbackText(raw: GdebenzRecentReportRaw): string {
  const status = normalizeStationStatus(raw.status);
  return status === "unknown" ? "Отметка без описания" : getStatusLabel(status);
}

function firstDateValue(raw: GdebenzRecentReportRaw): string | null {
  for (const field of ACTIVITY_DATE_FIELDS) {
    const value = raw[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim();
  }
  return null;
}

function activityCompleteness(item: StationActivity): number {
  return Number(Boolean(item.sourceId)) * 4 + Number(Boolean(item.text)) + item.fuelTypes.length * 2
    + Number(Boolean(item.queue)) * 2 + Number(item.limitLiters != null) * 2 + Number(item.wasOnSite != null)
    + Number(item.authorReliable != null) + Number(item.edited != null) + Number(Number.isFinite(item.createdAtMs));
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findLimitLiters(detail: string | null | undefined, recent: GdebenzRecentReportRaw[]): number | null {
  for (const value of [detail, ...recent.map((report) => report.detail)]) {
    if (!value) continue;
    const match = value.match(/лимит(?:ом|а)?(?:\s*(?:до|:|—|-))?\s*(\d+(?:[.,]\d+)?)\s*(?:л(?:итр(?:а|ов)?)?)(?=\s|[.,;!?)]|$)/i);
    if (!match) continue;
    const liters = Number(match[1].replace(",", "."));
    if (Number.isFinite(liters) && liters > 0) return liters;
  }
  return null;
}

function positiveNumberOrNull(value: unknown): number | null {
  const number = toNumberOrNull(value);
  return number != null && number > 0 ? number : null;
}

export function calculateStationRating(input: { selectedFuel: boolean; status: NormalizedFuelStation["status"]; freshness: number; reliability: number; deviationKm: number | null; hasQueue: boolean }): number {
  const fuel = input.selectedFuel && input.status === "yes" ? 1 : input.status === "low" ? 0.55 : input.selectedFuel ? 0.45 : 0.2;
  const deviation = input.deviationKm == null ? 0.8 : Math.max(0.25, Math.exp(-input.deviationKm / 4));
  const queue = input.hasQueue ? 0.6 : 1;
  return Math.round(100 * fuel * input.freshness * deviation * queue * (0.65 + input.reliability * 0.35));
}

function normalizeDetailsPrices(raw: GdebenzStationDetailsRaw["pricesNow"]): Record<string, StationPrice> {
  if (!raw) return {};

  return Object.fromEntries(Object.entries(raw).map(([fuel, price]) => [fuel, {
    price: toNumberOrNull(price.p),
    confirmations: toNumberOrNull(price.n),
    updatedAt: normalizeSourceDate(price.t)
  }]));
}

function normalizeSourceDate(value: unknown): string | null {
  const timestamp = parseActivityTimestamp(value);
  return timestamp == null ? stringValue(value) : new Date(timestamp).toISOString();
}

export function mergeStationSources(groups: NormalizedFuelStation[][]): NormalizedFuelStation[] {
  const merged: NormalizedFuelStation[] = [];
  for (const station of groups.flat()) {
    const existing = merged.find((item) => haversineDistanceKm(item, station) <= 0.12 && sameIdentity(item, station));
    if (!existing) { merged.push({ ...station, sources: [...station.sources] }); continue; }
    existing.sources = [...new Set([...existing.sources, ...station.sources])] as StationSource[];
    existing.fuels = [...new Set([...existing.fuels, ...station.fuels])];
    if ((station.lastUpdatedAt ?? "") > (existing.lastUpdatedAt ?? "")) Object.assign(existing, { status: station.status, statusLabel: station.statusLabel, lastUpdatedAt: station.lastUpdatedAt, freshness: station.freshness, freshnessLabel: station.freshnessLabel, hasQueue: station.hasQueue, queueLabel: station.queueLabel });
    existing.confidence = Math.max(existing.confidence ?? 0, station.confidence ?? 0);
    existing.reliability = clamp(Math.max(existing.reliability, station.reliability) + 0.05 * (existing.sources.length - 1), 0, 1);
    existing.reliabilityLabel = existing.reliability >= 0.7 ? "high" : existing.reliability >= 0.4 ? "medium" : "low";
    existing.rating = Math.max(existing.rating, station.rating);
  }
  return merged;
}

function sameIdentity(a: NormalizedFuelStation, b: NormalizedFuelStation): boolean { const left = (a.brand || a.name || "").toLowerCase(); const right = (b.brand || b.name || "").toLowerCase(); return !left || !right || left === right; }
function freshnessScore(value: string | null): number { if (!value) return 0.25; const hours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000); return hours <= 0.5 ? 1 : hours <= 2 ? 0.78 : hours <= 12 ? 0.5 : 0.28; }
function normalizeProbability(value: number | null): number | null { if (value == null) return null; return clamp(value > 1 ? value / 100 : value, 0, 1); }
function parsePrices(raw: Record<string, unknown>): Record<string, number> | null { const value = raw.prices ?? raw.fuel_prices; if (!value || typeof value !== "object") return null; const prices = Object.fromEntries(Object.entries(value).map(([fuel, price]) => [fuel, toNumberOrNull(price)]).filter((entry): entry is [string, number] => entry[1] != null)); return Object.keys(prices).length ? prices : null; }
function calculateStopCost(deviationKm: number | null, price: number | null) { const km = Math.max(0, (deviationKm ?? 0) * 2); const fuelLiters = km * 0.1; return { deviationKm: deviationKm ?? 0, extraTimeMin: Math.round(km / 50 * 60), fuelLiters: Math.round(fuelLiters * 10) / 10, fuelPriceRub: price, totalRub: price == null ? null : Math.round(fuelLiters * price) }; }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }

export const stationNormalizer = new StationNormalizer();
