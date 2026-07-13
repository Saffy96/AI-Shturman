import type { Coordinates, FuelType, StationFilters } from "../../types/fuel";

export const RADIUS_OPTIONS = [20, 50, 100] as const;
export const CORRIDOR_OPTIONS = [5, 10, 20, 50] as const;
export const FUEL_OPTIONS: readonly FuelType[] = ["92", "95", "98", "100", "ДТ"];

export const DEFAULT_FILTERS: StationFilters = {
  availability: "all",
  queue: "all",
  freshness: "all",
  status: "all",
  deviation: "all"
};

export const KAZAN_LOCATION: Coordinates = { lat: 55.796127, lon: 49.106414 };

export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
export type CorridorKm = (typeof CORRIDOR_OPTIONS)[number];
export type LocationSource = "browser" | "kazan" | "manual" | "map";

export const LOCATION_SOURCE_LABELS: Record<LocationSource, string> = {
  browser: "GPS / браузер",
  kazan: "Казань по умолчанию",
  manual: "Введено вручную",
  map: "Выбрано на карте"
};
