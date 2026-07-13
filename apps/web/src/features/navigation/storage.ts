import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { FuelType, RouteLocation, SearchMode, StationFilters } from "../../types/fuel";
import { CORRIDOR_OPTIONS, DEFAULT_FILTERS, FUEL_OPTIONS, RADIUS_OPTIONS, type CorridorKm, type RadiusKm } from "./config";

export function useStoredState<T>(key: string, fallback: T, normalize: (value: unknown) => T | null): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return normalize(JSON.parse(raw)) ?? fallback;
    }
    catch { return fallback; }
  });

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Storage may be unavailable in private or restricted contexts. */ }
  }, [key, value]);
  return [value, setValue];
}

export function normalizeRouteLocation(value: unknown): RouteLocation | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<RouteLocation>;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || typeof point.text !== "string" || typeof point.address !== "string") return null;
  if (point.type !== "gps" && point.type !== "address" && point.type !== "map") return null;
  return { type: point.type, text: point.text, name: point.name || point.text, address: point.address, lat: Number(point.lat), lon: Number(point.lon), ...(typeof point.accuracy === "number" ? { accuracy: point.accuracy } : {}) };
}

export const normalizeMode = (value: unknown): SearchMode | null => value === "nearby" || value === "route" ? value : null;
export const normalizeRadius = (value: unknown): RadiusKm | null => typeof value === "number" && RADIUS_OPTIONS.includes(value as RadiusKm) ? value as RadiusKm : null;
export const normalizeCorridor = (value: unknown): CorridorKm | null => typeof value === "number" && CORRIDOR_OPTIONS.includes(value as CorridorKm) ? value as CorridorKm : null;
export const normalizeMapZoom = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 19 ? value : null;
export const normalizeFuel = (value: unknown): FuelType | null => typeof value === "string" && FUEL_OPTIONS.includes(value as FuelType) ? value as FuelType : null;

export function normalizeFilters(value: unknown): StationFilters | null {
  if (!value || typeof value !== "object") return null;
  const filters = value as Partial<StationFilters>;
  return {
    availability: filters.availability === "withFuel" || filters.availability === "withSelectedFuel" || filters.availability === "excludeNoFuel" ? filters.availability : DEFAULT_FILTERS.availability,
    queue: filters.queue === "withoutQueue" || filters.queue === "onlyQueue" ? filters.queue : DEFAULT_FILTERS.queue,
    freshness: filters.freshness === "fresh" || filters.freshness === "freshOrMedium" || filters.freshness === "hideOld" ? filters.freshness : DEFAULT_FILTERS.freshness,
    status: filters.status === "yes" || filters.status === "low" || filters.status === "queue" || filters.status === "no" || filters.status === "unknown" ? filters.status : DEFAULT_FILTERS.status,
    deviation: filters.deviation === "max2" ? "max2" : "all"
  };
}
