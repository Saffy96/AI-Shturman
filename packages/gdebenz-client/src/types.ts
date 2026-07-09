export type GdebenzStationStatus = "yes" | "low" | "no" | null;
export type GdebenzConflict = "queue" | "no" | null;

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

export interface GdebenzCommentRaw {
  status?: GdebenzStationStatus;
  detail?: string | null;
  created_at?: string | null;
  edited?: boolean | null;
  author_reliable?: boolean | null;
  on_site?: boolean | null;
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
