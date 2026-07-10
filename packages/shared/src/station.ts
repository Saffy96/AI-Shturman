export type GdebenzRawStatus = "yes" | "low" | "no" | null;
export type GdebenzRawConflict = "queue" | "no" | null;

export type NormalizedStationStatus = "yes" | "low" | "no" | "unknown";
export type StationSource = "gdebenz" | "yandex" | "osm";
export type ReliabilityLabel = "high" | "medium" | "low";
export interface StationQueue { present: boolean; estimatedMinutes: number | null; }
export interface StationStopCost { deviationKm: number; extraTimeMin: number; fuelLiters: number; fuelPriceRub: number | null; totalRub: number | null; }

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
  sources: StationSource[];
  source: StationSource;
  brand: string | null;
  name: string | null;
  address: string | null;
  lat: number;
  lon: number;
  distanceKm: number | null;
  status: NormalizedStationStatus;
  statusLabel: string;
  fuels: string[];
  prices: Record<string, number> | null;
  hasRequestedFuel: boolean;
  hasQueue: boolean;
  queueLabel: string;
  confidence: number | null;
  confirmations: number | null;
  reports: number;
  queue: StationQueue;
  lastUpdatedAt: string | null;
  freshnessLabel: FreshnessLabel;
  freshness: number;
  reliability: number;
  reliabilityLabel: ReliabilityLabel;
  rating: number;
  stopCost: StationStopCost;
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
  title?: string;
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
