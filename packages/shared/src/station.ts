export type GdebenzRawStatus = "yes" | "low" | "no" | null;
export type GdebenzRawConflict = "queue" | "no" | null;

export type NormalizedStationStatus = "yes" | "low" | "no" | "unknown";

export type FreshnessLabel =
  | "свежие данные"
  | "средняя свежесть"
  | "устаревшие данные"
  | "неизвестно";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface NormalizedFuelStation {
  id: string;
  brand: string | null;
  name: string | null;
  address: string | null;
  lat: number;
  lon: number;
  distanceKm: number | null;
  status: NormalizedStationStatus;
  statusLabel: string;
  fuels: string[];
  hasRequestedFuel: boolean;
  hasQueue: boolean;
  queueLabel: string;
  confidence: number | null;
  confirmations: number | null;
  lastUpdatedAt: string | null;
  freshnessLabel: FreshnessLabel;
  recommendation: string;
  rawDetail: string | null;
  distanceFromRouteKm?: number | null;
  distanceFromStartKm?: number | null;
  routePositionLabel?: string | null;
}

export interface FuelSummary {
  total: number;
  withFuel: number;
  withRequestedFuel: number;
  withQueue: number;
  withoutFuel: number;
  unknown: number;
}

export interface NearbyFuelResponse {
  ok: true;
  source: "gdebenz";
  updatedAt: string;
  radiusKm: number;
  userLocation: Coordinates;
  stations: NormalizedFuelStation[];
  summary: FuelSummary;
}

export interface GeoSearchResult {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface GeoSearchResponse {
  ok: true;
  query: string;
  results: GeoSearchResult[];
}

export interface RouteFuelResponse {
  ok: true;
  mode: "route_bbox" | "route_real";
  source: "gdebenz";
  updatedAt: string;
  from: GeoSearchResult;
  to: GeoSearchResult;
  corridorKm: number;
  route?: {
    distanceKm: number;
    durationMin: number;
    geometryPointsCount: number;
    geometry: Coordinates[];
  };
  stations: NormalizedFuelStation[];
  summary: FuelSummary;
  warning?: string;
}
