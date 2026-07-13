import { hasRequestedFuel } from "@ai-shturman/shared";
import type { FuelStation, FuelType, StationFilters } from "../../types/fuel";

export function filterStations(stations: FuelStation[], filters: StationFilters, fuel: FuelType): FuelStation[] {
  return stations.filter((station) => {
    if (fuel !== "all" && !hasRequestedFuel(station.fuels, fuel)) return false;
    if (filters.availability === "withFuel" && station.status !== "yes" && station.status !== "low") return false;
    if (filters.availability === "excludeNoFuel" && station.status === "no") return false;
    if (filters.queue === "withoutQueue" && station.hasQueue) return false;
    if (filters.queue === "onlyQueue" && !station.hasQueue) return false;
    if (filters.freshness === "fresh" && station.freshnessLabel !== "свежие данные") return false;
    if (filters.freshness === "freshOrMedium" && station.freshnessLabel !== "свежие данные" && station.freshnessLabel !== "средняя свежесть") return false;
    if (filters.freshness === "hideOld" && station.freshnessLabel === "устаревшие данные") return false;
    if (filters.status !== "all" && station.status !== filters.status) return false;
    if (filters.deviation === "max2" && (station.distanceFromRouteKm ?? 0) > 2) return false;
    return true;
  });
}
