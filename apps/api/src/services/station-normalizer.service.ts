import type { GdebenzBBoxStationRaw, GdebenzStationRaw } from "@ai-shturman/gdebenz-client";
import {
  detailMentionsQueue, getFreshnessLabel, getQueueLabel, getRecommendation, getStatusLabel,
  hasRequestedFuel, haversineDistanceKm, normalizeStationStatus, parseFuels, toNumberOrNull,
  type NormalizedFuelStation, type StationSource
} from "@ai-shturman/shared";

export interface StationRouteMetrics { distanceFromRouteKm?: number | null; distanceFromStartKm?: number | null; routePositionLabel?: string | null; }

export class StationNormalizer {
  normalizeGdebenz(raw: GdebenzStationRaw | GdebenzBBoxStationRaw, requestedFuel: string, fallbackDistanceKm?: number | null, route?: StationRouteMetrics): NormalizedFuelStation | null {
    const lat = toNumberOrNull(raw.lat); const lon = toNumberOrNull(raw.lon);
    if (lat == null || lon == null) return null;
    const detail = stringValue(raw.detail);
    const status = normalizeStationStatus(raw.status);
    const fuels = parseFuels(raw.fuels_now, detail);
    const selectedFuel = hasRequestedFuel(fuels, requestedFuel);
    const updatedAt = stringValue(raw.last_at);
    const freshnessLabel = getFreshnessLabel(updatedAt);
    const freshness = freshnessScore(updatedAt);
    const confidence = normalizeProbability(toNumberOrNull(raw.confidence_base));
    const confirmations = toNumberOrNull(raw.confirmations);
    const reliability = clamp((confidence ?? 0.5) * 0.65 + freshness * 0.25 + Math.min(confirmations ?? 0, 5) / 50, 0, 1);
    const hasQueue = raw.conflict === "queue" || detailMentionsQueue(detail);
    const deviation = route?.distanceFromRouteKm ?? null;
    const rating = calculateStationRating({ selectedFuel, status, freshness, reliability, deviationKm: deviation, hasQueue });
    const prices = parsePrices(raw);
    const stopCost = calculateStopCost(deviation, prices?.[requestedFuel] ?? null);
    return {
      id: `osm:${raw.osm_id}`, source: "gdebenz", sources: ["gdebenz", "osm"], brand: stringValue(raw.brand), name: stringValue(raw.name), address: stringValue(raw.addr), lat, lon,
      distanceKm: toNumberOrNull(raw.distance_km) ?? fallbackDistanceKm ?? null, status, statusLabel: getStatusLabel(status), fuels, hasRequestedFuel: selectedFuel,
      prices, hasQueue, queue: { present: hasQueue, estimatedMinutes: hasQueue ? 5 : 0 }, queueLabel: hasQueue ? "Есть очередь" : getQueueLabel(raw.conflict), confidence, confirmations, reports: Math.max(0, Math.round(confirmations ?? 0)), lastUpdatedAt: updatedAt, freshnessLabel, freshness,
      reliability, reliabilityLabel: reliability >= 0.7 ? "high" : reliability >= 0.4 ? "medium" : "low", rating, stopCost,
      recommendation: rating >= 60 ? "Лучше заехать сюда" : getRecommendation({ status, hasRequestedFuel: selectedFuel, hasQueue, freshnessLabel }), rawDetail: detail,
      distanceFromRouteKm: deviation, distanceFromStartKm: route?.distanceFromStartKm ?? null, routePositionLabel: route?.routePositionLabel ?? null
    };
  }
}

export function calculateStationRating(input: { selectedFuel: boolean; status: NormalizedFuelStation["status"]; freshness: number; reliability: number; deviationKm: number | null; hasQueue: boolean }): number {
  const fuel = input.selectedFuel && input.status === "yes" ? 1 : input.status === "low" ? 0.55 : input.selectedFuel ? 0.45 : 0.2;
  const deviation = input.deviationKm == null ? 0.8 : Math.max(0.25, Math.exp(-input.deviationKm / 4));
  const queue = input.hasQueue ? 0.6 : 1;
  return Math.round(100 * fuel * input.freshness * deviation * queue * (0.65 + input.reliability * 0.35));
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
