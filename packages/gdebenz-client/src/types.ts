export type GdebenzStationStatus = "yes" | "low" | "queue" | "no" | null;
export type GdebenzConflict = "queue" | "no" | null;

export interface GdebenzLimitsRaw {
  q?: "yes" | "no" | null;
  qn?: string | null;
  qCnt?: number | string | null;
  lim?: number | string | null;
  limCnt?: number | string | null;
}

export interface GdebenzPriceRaw {
  p?: number | string | null;
  n?: number | string | null;
  t?: string | null;
}

export interface GdebenzFreshConflictRaw {
  status?: "yes" | "low" | "queue" | "no" | string | null;
  ageMin?: number | string | null;
  [key: string]: unknown;
}

export type GdebenzFuelNowRaw =
  | string
  | number
  | boolean
  | null
  | GdebenzFuelNowRaw[]
  | { [key: string]: GdebenzFuelNowRaw };

export interface GdebenzStationDetailsRaw {
  status?: GdebenzStationStatus;
  detail?: string | null;
  confirmations?: number | string | null;
  confirmationsFresh?: number | string | null;
  realCount?: number | string | null;
  updated?: string | null;
  seeded?: boolean | null;
  views?: number | string | null;
  fuelsNow?: GdebenzFuelNowRaw;
  pricesNow?: Record<string, GdebenzPriceRaw> | null;
  confidenceBase?: number | string | null;
  freshConflict?: boolean | GdebenzFreshConflictRaw | null;
  limited?: boolean | null;
  limits?: GdebenzLimitsRaw | null;
  addr?: string | null;
  cvt?: number | string | null;
}

export interface GdebenzRecentReportRaw {
  id?: number | string | null;
  sourceId?: number | string | null;
  type?: string | null;
  status?: GdebenzStationStatus;
  detail?: string | null;
  text?: string | null;
  fuelTypes?: unknown;
  createdAt?: string | number | null;
  created_at?: string | null;
  date?: string | number | null;
  timestamp?: string | number | null;
  time?: string | number | null;
  ts?: string | number | null;
  publishedAt?: string | number | null;
  updatedAt?: string | number | null;
  edited?: boolean | null;
  author_reliable?: boolean | null;
  on_site?: boolean | null;
  [key: string]: unknown;
}

export interface GdebenzRecentPageRaw {
  data?: unknown;
  items?: unknown;
  comments?: unknown;
  recent?: unknown;
  total?: number | string | null;
  limit?: number | string | null;
  offset?: number | string | null;
  page?: number | string | null;
  [key: string]: unknown;
}

export type GdebenzRecentResponseRaw = GdebenzRecentReportRaw[] | GdebenzRecentPageRaw;

export interface GdebenzStationRaw {
  osm_id: number | string;
  brand?: string | null;
  name?: string | null;
  addr?: string | null;
  lat: number | string;
  lon: number | string;
  distance_km?: number | string | null;
  status?: GdebenzStationStatus;
  detail?: string | null;
  fuels_now?: unknown;
  confirmations?: number | string | null;
  last_at?: string | null;
  confidence_base?: number | string | null;
  conflict?: GdebenzConflict;
  [key: string]: unknown;
}

export interface GdebenzNearbyResponse {
  stations: GdebenzStationRaw[];
  updated?: string | null;
  [key: string]: unknown;
}

export interface GdebenzBBoxStationRaw {
  osm_id: number | string;
  name?: string | null;
  brand?: string | null;
  lat: number | string;
  lon: number | string;
  addr?: string | null;
  status?: GdebenzStationStatus;
  fuels_now?: unknown;
  conflict?: GdebenzConflict;
  [key: string]: unknown;
}

export interface NearbyStationsParams {
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface StationsBBoxParams {
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
}

export interface GdebenzClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}
