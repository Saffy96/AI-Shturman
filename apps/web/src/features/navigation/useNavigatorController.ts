import { useCallback, useMemo, useRef, useState } from "react";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { fetchNearbyFuel, fetchRouteFuel } from "../../services/fuelApi";
import type { Coordinates, FuelStation, FuelType, GeoSearchResult, NearbyFuelResponse, RouteFuelResponse, RouteLocation, SearchMode, StationFilters } from "../../types/fuel";
import { filterStations } from "../stations/filterStations";
import { DEFAULT_FILTERS, KAZAN_LOCATION, LOCATION_SOURCE_LABELS, type CorridorKm, type LocationSource, type RadiusKm } from "./config";
import { getReadableError, shouldOfferApproximateFallback } from "./errors";
import { normalizeCorridor, normalizeFilters, normalizeFuel, normalizeMapZoom, normalizeMode, normalizeRadius, normalizeRouteLocation, useStoredState } from "./storage";

type FuelResponse = NearbyFuelResponse | RouteFuelResponse;
type RouteRequestMode = "real" | "approx";
export type LoadingPhase = "route" | "stations" | null;

interface SelectedLocation { coords: Coordinates; source: LocationSource; }
export interface RoutePoints { from: GeoSearchResult; to: GeoSearchResult; }

const EMPTY_STATIONS: FuelStation[] = [];

export function useNavigatorController() {
  const [fromPoint, setFromPoint] = useStoredState<RouteLocation | null>("ai-shturman:from", null, normalizeRouteLocation);
  const [toPoint, setToPoint] = useStoredState<RouteLocation | null>("ai-shturman:to", null, normalizeRouteLocation);
  const [selectedMode, setSelectedMode] = useStoredState<SearchMode>("ai-shturman:selectedMode", "nearby", normalizeMode);
  const [radiusKm, setRadiusKm] = useStoredState<RadiusKm>("ai-shturman:radiusKm", 50, normalizeRadius);
  const [corridorKm, setCorridorKm] = useStoredState<CorridorKm>("ai-shturman:corridorKm", 5, normalizeCorridor);
  const [fuel, setFuel] = useStoredState<FuelType>("ai-shturman:selectedFuel", "95", normalizeFuel);
  const [mapZoom, setMapZoom] = useStoredState("ai-shturman:mapZoom", 8, normalizeMapZoom);
  const [filters, setFilters] = useStoredState<StationFilters>("ai-shturman:filters", DEFAULT_FILTERS, normalizeFilters);
  const [data, setData] = useState<FuelResponse | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoints | null>(null);
  const [routeWarning, setRouteWarning] = useState<string | null>(null);
  const [routeFallbackHint, setRouteFallbackHint] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [stationFocusVersion, setStationFocusVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRouteEditorOpen, setIsRouteEditorOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isNearbyMapPickerOpen, setIsNearbyMapPickerOpen] = useState(false);
  const requestVersionRef = useRef(0);

  const geolocation = useGeolocation();
  const isOnline = useNetworkStatus();
  const isRouteMode = selectedMode === "route";
  const routeData = isRouteResponse(data) ? data : null;
  const responseStations = data?.stations ?? EMPTY_STATIONS;
  const allStations = useMemo(() => routeData?.mode === "route_real"
    ? responseStations.filter((station) => station.distanceFromRouteKm == null || station.distanceFromRouteKm <= corridorKm)
    : responseStations, [corridorKm, responseStations, routeData?.mode]);
  const filteredStations = useMemo(() => filterStations(allStations, filters, fuel), [allStations, filters, fuel]);
  const canRequestStations = isRouteMode ? Boolean(routePoints) : Boolean(selectedLocation);
  const locationLabel = selectedLocation ? `${selectedLocation.coords.lat.toFixed(6)}, ${selectedLocation.coords.lon.toFixed(6)}` : "Геопозиция не получена";
  const sourceLabel = selectedLocation ? LOCATION_SOURCE_LABELS[selectedLocation.source] : "Не выбран";

  const clearResults = useCallback(() => {
    requestVersionRef.current += 1;
    setData(null);
    setRouteWarning(null);
    setRouteFallbackHint(null);
    setSelectedStation(null);
    setIsLoading(false);
    setIsBuildingRoute(false);
    setLoadingPhase(null);
  }, []);

  const applyLocation = useCallback((coords: Coordinates, source: LocationSource) => {
    setSelectedLocation({ coords, source });
    clearResults();
  }, [clearResults]);

  const requestLocation = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    setError(null);
    try {
      const location = await geolocation.requestLocation();
      if (requestVersion === requestVersionRef.current) applyLocation(location, "browser");
    } catch (requestError) {
      if (requestVersion === requestVersionRef.current) setError(getReadableError(requestError, isOnline));
    }
  }, [applyLocation, geolocation.requestLocation, isOnline]);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSelectedMode(mode);
    clearResults();
    setError(null);
    setIsRouteEditorOpen(true);
    setIsFiltersOpen(false);
  }, [clearResults, setSelectedMode]);

  const resetRoute = useCallback(() => {
    setRoutePoints(null);
    setRouteWarning(null);
    setRouteFallbackHint(null);
    if (selectedMode === "route") {
      setData(null);
      setSelectedStation(null);
    }
  }, [selectedMode]);

  const handleFromChange = useCallback((value: RouteLocation) => { setFromPoint(value); resetRoute(); }, [resetRoute, setFromPoint]);
  const handleToChange = useCallback((value: RouteLocation) => { setToPoint(value); resetRoute(); }, [resetRoute, setToPoint]);
  const handleSwapRoute = useCallback(() => {
    setFromPoint(toPoint);
    setToPoint(fromPoint);
    resetRoute();
    setIsRouteEditorOpen(true);
  }, [fromPoint, resetRoute, setFromPoint, setToPoint, toPoint]);

  const buildRoute = useCallback(async () => {
    if (isBuildingRoute || !fromPoint || !toPoint) return;
    const requestVersion = ++requestVersionRef.current;
    setError(null);
    setRouteFallbackHint(null);
    setLoadingPhase("route");
    setIsBuildingRoute(true);
    const points = { from: fromPoint, to: toPoint };
    setRoutePoints(points);
    try {
      const response = await fetchRouteFuel({ from: fromPoint.text, to: toPoint.text, corridorKm, fuel, mode: "real", fromLat: fromPoint.lat, fromLon: fromPoint.lon, toLat: toPoint.lat, toLon: toPoint.lon });
      if (requestVersion !== requestVersionRef.current) return;
      setData(response);
      setRoutePoints({ from: response.from, to: response.to });
      setRouteWarning(response.warning ?? null);
      setIsRouteEditorOpen(false);
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) return;
      if (shouldOfferApproximateFallback(requestError)) setRouteFallbackHint("Можно продолжить в приблизительном режиме по коридору маршрута.");
      setError(getReadableError(requestError, isOnline));
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsBuildingRoute(false);
        setLoadingPhase(null);
      }
    }
  }, [corridorKm, fromPoint, fuel, isBuildingRoute, isOnline, toPoint]);

  const runFuelCheck = useCallback(async (requestMode: RouteRequestMode) => {
    if (isLoading || isBuildingRoute) return;
    setError(null);
    if (!isOnline) { setError("Нет интернета. Проверьте связь и попробуйте снова."); return; }
    if (!canRequestStations) { setError(isRouteMode ? "Сначала постройте маршрут." : "Сначала выберите местоположение."); return; }
    const requestVersion = ++requestVersionRef.current;
    setIsLoading(true);
    setLoadingPhase("stations");
    try {
      if (isRouteMode && routePoints) {
        const response = await fetchRouteFuel({ from: fromPoint?.text ?? routePoints.from.name, to: toPoint?.text ?? routePoints.to.name, corridorKm, fuel, mode: requestMode, fromLat: routePoints.from.lat, fromLon: routePoints.from.lon, toLat: routePoints.to.lat, toLon: routePoints.to.lon });
        if (requestVersion !== requestVersionRef.current) return;
        setData(response);
        setRoutePoints({ from: response.from, to: response.to });
        setRouteWarning(response.warning ?? null);
      } else if (selectedLocation) {
        const response = await fetchNearbyFuel({ ...selectedLocation.coords, radiusKm, fuel });
        if (requestVersion !== requestVersionRef.current) return;
        setData(response);
        setRouteWarning(null);
      }
      setRouteFallbackHint(null);
      setIsRouteEditorOpen(false);
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) return;
      if (isRouteMode && requestMode === "real" && shouldOfferApproximateFallback(requestError)) setRouteFallbackHint("Можно продолжить в приблизительном режиме по коридору маршрута.");
      setError(getReadableError(requestError, isOnline));
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
        setLoadingPhase(null);
      }
    }
  }, [canRequestStations, corridorKm, fromPoint?.text, fuel, isBuildingRoute, isLoading, isOnline, isRouteMode, radiusKm, routePoints, selectedLocation, toPoint?.text]);

  const selectStation = useCallback((station: FuelStation, focus = false) => {
    setSelectedStation(station);
    if (focus) setStationFocusVersion((value) => value + 1);
  }, []);
  const closeStation = useCallback(() => setSelectedStation(null), []);
  const cancelRoute = useCallback(() => {
    clearResults();
    setRoutePoints(null);
    setIsRouteEditorOpen(true);
  }, [clearResults]);

  return {
    fromPoint, toPoint, selectedMode, radiusKm, corridorKm, fuel, mapZoom, filters, data, routeData, routePoints,
    routeWarning, routeFallbackHint, selectedLocation, selectedStation, stationFocusVersion, filteredStations,
    geolocation, isOnline, isRouteMode, canRequestStations, isLoading, isBuildingRoute, loadingPhase, error,
    isRouteEditorOpen, isFiltersOpen, isNearbyMapPickerOpen, locationLabel, sourceLabel,
    setRadiusKm, setCorridorKm, setFuel, setMapZoom, setFilters, setIsRouteEditorOpen, setIsFiltersOpen, setIsNearbyMapPickerOpen,
    applyLocation, requestLocation, handleModeChange, handleFromChange, handleToChange, handleSwapRoute, buildRoute,
    checkStations: () => runFuelCheck("real"), useApproximateRoute: () => runFuelCheck("approx"),
    refresh: () => runFuelCheck(routeData?.mode === "route_bbox" ? "approx" : "real"),
    selectStation, closeStation, cancelRoute, useKazan: () => applyLocation(KAZAN_LOCATION, "kazan")
  };
}

function isRouteResponse(data: FuelResponse | null): data is RouteFuelResponse {
  return Boolean(data && "mode" in data);
}
