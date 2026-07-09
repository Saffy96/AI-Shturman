import type {
  Coordinates as SharedCoordinates,
  FuelSummary as SharedFuelSummary,
  NormalizedFuelStation
} from "@ai-shturman/shared";

export type FuelType = "92" | "95" | "98" | "100" | "ДТ";

export type Coordinates = SharedCoordinates;
export type FuelSummary = SharedFuelSummary;
export type FuelStation = NormalizedFuelStation;

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
