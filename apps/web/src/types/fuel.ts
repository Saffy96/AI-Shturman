import type {
  Coordinates as SharedCoordinates,
  FuelSummary as SharedFuelSummary,
  GeoSearchResponse as SharedGeoSearchResponse,
  GeoSearchResult as SharedGeoSearchResult,
  NormalizedFuelStation
} from "@ai-shturman/shared";

export type FuelType = "92" | "95" | "98" | "100" | "ДТ";

export type Coordinates = SharedCoordinates;
export type FuelSummary = SharedFuelSummary;
export type FuelStation = NormalizedFuelStation;
export type GeoSearchResult = SharedGeoSearchResult;
export type GeoSearchResponse = SharedGeoSearchResponse;

export type SearchMode = "nearby" | "route";
export type AvailabilityFilter = "all" | "withFuel" | "withSelectedFuel" | "excludeNoFuel";
export type QueueFilter = "all" | "withoutQueue" | "onlyQueue";
export type FreshnessFilter = "all" | "fresh" | "freshOrMedium" | "hideOld";
export type StatusFilter = "all" | "yes" | "low" | "no" | "unknown";

export interface StationFilters {
  availability: AvailabilityFilter;
  queue: QueueFilter;
  freshness: FreshnessFilter;
  status: StatusFilter;
}

export interface FilteredSummary {
  total: number;
  shown: number;
}

export interface NearbyFuelResponse {
  ok: true;
  source: "gdebenz";
  updatedAt: string;
  radiusKm: number;
  userLocation: Coordinates;
  stations: FuelStation[];
  summary: FuelSummary;
}

export interface NearbyFuelParams {
  lat: number;
  lon: number;
  radiusKm: number;
  fuel: FuelType;
}

export interface RouteFuelResponse {
  ok: true;
  mode: "route_bbox";
  source: "gdebenz";
  updatedAt: string;
  from: GeoSearchResult;
  to: GeoSearchResult;
  corridorKm: number;
  stations: FuelStation[];
  summary: FuelSummary;
  warning: string;
}

export interface RouteFuelParams {
  from: string;
  to: string;
  corridorKm: number;
  fuel: FuelType;
}
