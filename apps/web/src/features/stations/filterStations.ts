import type { FuelStation, StationFilters } from "../../types/fuel";

export function filterStations(stations: FuelStation[], filters: StationFilters): FuelStation[] {
  return stations.filter((station) => {
    if (filters.availability === "withFuel" && station.status !== "yes" && station.status !== "queue" && station.status !== "low") return false;
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
