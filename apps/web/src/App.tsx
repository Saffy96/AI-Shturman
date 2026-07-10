import { buildNavigatorAdvice, hasRequestedFuel } from "@ai-shturman/shared";
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { FiltersPanel } from "./components/FiltersPanel";
import { Header } from "./components/Header";
import { Map } from "./components/Map";
import { NavigatorAdviceCard } from "./components/NavigatorAdviceCard";
import { RouteForm } from "./components/RouteForm";
import { StationCard } from "./components/StationCard";
import { SummaryCard } from "./components/SummaryCard";
import { GeolocationRequestError, useGeolocation } from "./hooks/useGeolocation";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { FuelApiError, fetchNearbyFuel, fetchRouteFuel } from "./services/fuelApi";
import type {
  Coordinates,
  FilteredSummary,
  FuelStation,
  FuelSummary,
  FuelType,
  GeoSearchResult,
  NearbyFuelResponse,
  RouteFuelResponse,
  RouteLocation,
  SearchMode,
  StationFilters
} from "./types/fuel";

const radiusOptions = [20, 50, 100] as const;
const corridorOptions = [5, 10, 20, 50] as const;
const fuelOptions: FuelType[] = ["92", "95", "98", "100", "ДТ"];
const defaultFilters: StationFilters = {
  availability: "all",
  queue: "all",
  freshness: "all",
  status: "all",
  deviation: "all"
};
const kazanLocation: Coordinates = {
  lat: 55.796127,
  lon: 49.106414
};

type LocationSource = "browser" | "kazan" | "manual";
type FuelResponse = NearbyFuelResponse | RouteFuelResponse;
type RouteRequestMode = "real" | "approx";

interface SelectedLocation {
  coords: Coordinates;
  source: LocationSource;
}

interface RoutePoints {
  from: GeoSearchResult;
  to: GeoSearchResult;
}

const locationSourceLabels: Record<LocationSource, string> = {
  browser: "GPS / браузер",
  kazan: "Казань по умолчанию",
  manual: "Введено вручную"
};

export function App() {
  const [fromPoint, setFromPoint] = useStoredState<RouteLocation | null>("ai-shturman:from", null, normalizeRouteLocation);
  const [toPoint, setToPoint] = useStoredState<RouteLocation | null>("ai-shturman:to", null, normalizeRouteLocation);
  const from = fromPoint?.text ?? "";
  const to = toPoint?.text ?? "";
  const [selectedMode, setSelectedMode] = useStoredState<SearchMode>("ai-shturman:selectedMode", "nearby", normalizeMode);
  const [radiusKm, setRadiusKm] = useStoredState<(typeof radiusOptions)[number]>(
    "ai-shturman:radiusKm",
    50,
    normalizeRadius
  );
  const [corridorKm, setCorridorKm] = useStoredState<(typeof corridorOptions)[number]>(
    "ai-shturman:corridorKm",
    5,
    normalizeCorridor
  );
  const [fuel, setFuel] = useStoredState<FuelType>("ai-shturman:selectedFuel", "95", normalizeFuel);
  const [mapZoom, setMapZoom] = useStoredState("ai-shturman:mapZoom", 8, normalizeMapZoom);
  const [filters, setFilters] = useStoredState<StationFilters>("ai-shturman:filters", defaultFilters, normalizeFilters);
  const [data, setData] = useState<FuelResponse | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoints | null>(null);
  const [routeWarning, setRouteWarning] = useState<string | null>(null);
  const [routeFallbackHint, setRouteFallbackHint] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isAdviceVisible, setIsAdviceVisible] = useState(false);
  const routeBuildPromiseRef = useRef<Promise<RoutePoints> | null>(null);

  const geolocation = useGeolocation();
  const isOnline = useNetworkStatus();
  const isRouteMode = selectedMode === "route";
  const canBuildRoute = Boolean(fromPoint && toPoint);
  const canRequestStations = isRouteMode ? Boolean(routePoints) : Boolean(selectedLocation);
  const allStations = data?.stations ?? [];
  const filteredStations = useMemo(() => applyStationFilters(allStations, filters, fuel), [allStations, filters, fuel]);
  const displaySummary = useMemo(() => buildClientSummary(allStations, fuel), [allStations, fuel]);
  const filteredSummary: FilteredSummary = {
    total: allStations.length,
    shown: filteredStations.length
  };

  const locationLabel = selectedLocation
    ? `${selectedLocation.coords.lat.toFixed(6)}, ${selectedLocation.coords.lon.toFixed(6)}`
    : "Геопозиция не получена";
  const sourceLabel = selectedLocation ? locationSourceLabels[selectedLocation.source] : "Не выбран";
  const routeData = data && "mode" in data ? data : null;
  const navigatorAdvice = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildNavigatorAdvice(filteredStations, fuel);
  }, [data, filteredStations, fuel]);

  async function handleLocationRequest() {
    setError(null);
    setManualError(null);

    try {
      const location = await geolocation.requestLocation();
      applyLocation(location, "browser");
    } catch (requestError) {
      setError(getReadableError(requestError, isOnline));
    }
  }

  function handleUseKazan() {
    setManualError(null);
    setError(null);
    applyLocation(kazanLocation, "kazan");
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lat = Number(manualLat.replace(",", "."));
    const lon = Number(manualLon.replace(",", "."));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setManualError("Введите числовые координаты.");
      return;
    }

    if (lat < -90 || lat > 90) {
      setManualError("Latitude должен быть от -90 до 90.");
      return;
    }

    if (lon < -180 || lon > 180) {
      setManualError("Longitude должен быть от -180 до 180.");
      return;
    }

    setManualError(null);
    setError(null);
    applyLocation({ lat, lon }, "manual");
  }

  async function handleBuildRoute() {
    if (routeBuildPromiseRef.current || !canBuildRoute) {
      return;
    }

    setError(null);
    setRouteFallbackHint(null);

    try {
      const points = await buildRoutePoints();
      setIsLoading(true);
      const response = await fetchRouteFuel({
        from,
        to,
        corridorKm,
        fuel,
        mode: "real",
        fromLat: points.from.lat,
        fromLon: points.from.lon,
        toLat: points.to.lat,
        toLon: points.to.lon
      });
      setData(response);
      setRoutePoints({ from: response.from, to: response.to });
      setRouteWarning(response.warning ?? null);
      setIsAdviceVisible(true);
    } catch (requestError) {
      if (shouldOfferApproximateFallback(requestError)) {
        setRouteFallbackHint("Реальный маршрут недоступен. Можно использовать приблизительный режим.");
      }
      setError(getReadableError(requestError, isOnline));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckStations() {
    await runFuelCheck("real");
  }

  async function handleUseApproximateRoute() {
    await runFuelCheck("approx");
  }

  async function handleRefresh() {
    await runFuelCheck(routeData?.mode === "route_bbox" ? "approx" : "real");
  }

  async function runFuelCheck(requestMode: RouteRequestMode) {
    setError(null);

    if (!isOnline) {
      setError("Нет интернета. Проверьте связь и попробуйте снова.");
      return;
    }

    if (!canRequestStations) {
      setError(isRouteMode ? "Сначала постройте маршрут." : "Сначала получите геопозицию или выберите fallback.");
      return;
    }

    setIsLoading(true);

    try {
      if (isRouteMode) {
        if (!routePoints) {
          setError("Сначала нажмите «Построить маршрут», затем проверьте АЗС.");
          return;
        }

        const response = await fetchRouteFuel({
          from,
          to,
          corridorKm,
          fuel,
          mode: requestMode,
          fromLat: routePoints.from.lat,
          fromLon: routePoints.from.lon,
          toLat: routePoints.to.lat,
          toLon: routePoints.to.lon
        });

        setData(response);
        setRoutePoints({ from: response.from, to: response.to });
        setRouteWarning(response.warning ?? null);
        setRouteFallbackHint(null);
      } else {
        if (!selectedLocation) {
          setError("Сначала получите геопозицию или выберите fallback.");
          return;
        }

        const response = await fetchNearbyFuel({
          lat: selectedLocation.coords.lat,
          lon: selectedLocation.coords.lon,
          radiusKm,
          fuel
        });

        setData(response);
        setRouteWarning(null);
        setRouteFallbackHint(null);
      }

      setIsAdviceVisible(true);
    } catch (requestError) {
      if (isRouteMode && requestMode === "real" && shouldOfferApproximateFallback(requestError)) {
        setRouteFallbackHint("Если сервис реального маршрута недоступен, можно продолжить в приблизительном режиме по corridor bbox.");
      }

      setError(getReadableError(requestError, isOnline));
    } finally {
      setIsLoading(false);
    }
  }

  async function buildRoutePoints(): Promise<RoutePoints> {
    if (routeBuildPromiseRef.current) {
      return routeBuildPromiseRef.current;
    }

    if (!fromPoint || !toPoint) {
      throw new Error("Введите точки Откуда и Куда.");
    }

    const request = (async () => {
      setIsBuildingRoute(true);
      const points = { from: fromPoint, to: toPoint };
      setRoutePoints(points);
      setRouteWarning("Маршрутные точки найдены. Дальше можно проверить АЗС вдоль реального маршрута.");
      setRouteFallbackHint(null);
      return points;
    })();

    routeBuildPromiseRef.current = request;

    try {
      return await request;
    } finally {
      routeBuildPromiseRef.current = null;
      setIsBuildingRoute(false);
    }
  }

  function applyLocation(coords: Coordinates, source: LocationSource) {
    setSelectedLocation({ coords, source });
    setData(null);
    setRouteWarning(null);
    setRouteFallbackHint(null);
    setIsAdviceVisible(false);
  }

  function handleModeChange(mode: SearchMode) {
    setSelectedMode(mode);
    setData(null);
    setRouteWarning(null);
    setRouteFallbackHint(null);
    setIsAdviceVisible(false);
    setError(null);
  }

  function handleFromChange(value: RouteLocation) {
    setFromPoint(value);
    resetRouteIfNeeded();
  }

  function handleToChange(value: RouteLocation) {
    setToPoint(value);
    resetRouteIfNeeded();
  }

  function resetRouteIfNeeded() {
    setRoutePoints(null);
    setRouteWarning(null);
    setRouteFallbackHint(null);

    if (selectedMode === "route") {
      setData(null);
      setIsAdviceVisible(false);
    }
  }

  return (
    <div className="min-h-screen pb-[calc(24px+env(safe-area-inset-bottom))]">
      <Header />

      <main className="mx-auto grid max-w-xl gap-4 px-4">
        {!isOnline ? <Notice tone="danger" text="Нет интернета. Данные можно обновить после восстановления связи." /> : null}

        <ModeSwitch selectedMode={selectedMode} onChange={handleModeChange} />

        <RouteForm
          from={fromPoint}
          to={toPoint}
          isRouteMode={isRouteMode}
          isBuildingRoute={isBuildingRoute}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onSwap={() => { setFromPoint(toPoint); setToPoint(fromPoint); resetRouteIfNeeded(); }}
          onBuildRoute={handleBuildRoute}
        />

        {isRouteMode && routePoints ? <RouteInfo points={routePoints} route={routeData} stationCount={filteredStations.length} /> : null}

        <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">{isRouteMode ? "Коридор" : "Радиус"}</span>
              <select
                className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-black text-slate-950 outline-none focus:border-road-500 focus:bg-white"
                value={isRouteMode ? corridorKm : radiusKm}
                onChange={(event) =>
                  isRouteMode
                    ? setCorridorKm(Number(event.target.value) as (typeof corridorOptions)[number])
                    : setRadiusKm(Number(event.target.value) as (typeof radiusOptions)[number])
                }
              >
                {(isRouteMode ? corridorOptions : radiusOptions).map((option) => (
                  <option key={option} value={option}>
                    {option} км
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">Топливо</span>
              <select
                className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-black text-slate-950 outline-none focus:border-road-500 focus:bg-white"
                value={fuel}
                onChange={(event) => setFuel(event.target.value as FuelType)}
              >
                {fuelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl bg-road-50 px-4 py-3">
            <div className="text-xs font-black uppercase text-road-600">Текущая позиция</div>
            <div className="mt-1 text-base font-black text-road-900">{locationLabel}</div>
            <div className="mt-1 text-sm font-bold text-slate-600">Источник: {sourceLabel}</div>
            {selectedLocation?.source === "browser" && geolocation.location ? (
              <div className={`mt-2 text-sm font-black ${geolocation.location.accuracy <= 100 ? "text-emerald-700" : "text-amber-700"}`}>
                {geolocation.location.accuracy <= 100 ? "📍 Вы здесь" : `⚠ Точность ${Math.round(geolocation.location.accuracy)} метров`}<br />
                {geolocation.location.accuracy <= 100 ? `Точность: ${Math.round(geolocation.location.accuracy)} метров ✅` : "Выберите точку вручную"}
              </div>
            ) : null}
          </div>

          {!canRequestStations ? (
            <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
              {isRouteMode ? "Сначала постройте маршрут по точкам А и Б." : "Сначала получите геопозицию или выберите fallback."}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {!isRouteMode ? (
              <button
                className="min-h-14 rounded-xl bg-slate-950 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleLocationRequest}
                disabled={geolocation.isLocating || isLoading}
              >
                📍 {geolocation.isLocating ? "Получаем..." : "Моё местоположение"}
              </button>
            ) : null}

            <button
              className="min-h-14 rounded-xl bg-road-500 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleCheckStations}
              disabled={!canRequestStations || geolocation.isLocating || isLoading || isBuildingRoute}
            >
              ⛽ {isLoading ? "Проверяем..." : isRouteMode ? "Проверить АЗС по маршруту" : "Проверить АЗС"}
            </button>

            <button
              className="min-h-14 rounded-xl bg-fuel-500 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleRefresh}
              disabled={!canRequestStations || geolocation.isLocating || isLoading || isBuildingRoute}
            >
              🔄 Обновить
            </button>
          </div>
        </section>

        {selectedMode === "nearby" && !selectedLocation ? (
          <FallbackLocationCard
            isManualFormOpen={isManualFormOpen}
            manualLat={manualLat}
            manualLon={manualLon}
            manualError={manualError}
            isLocating={geolocation.isLocating}
            isLoading={isLoading}
            onUseKazan={handleUseKazan}
            onManualToggle={() => setIsManualFormOpen((value) => !value)}
            onManualLatChange={setManualLat}
            onManualLonChange={setManualLon}
            onManualSubmit={handleManualSubmit}
            onRetry={handleLocationRequest}
          />
        ) : null}

        {error ? <Notice tone="danger" text={error} /> : null}

        {routeFallbackHint && isRouteMode ? (
          <RouteFallbackCard
            text={routeFallbackHint}
            isLoading={isLoading}
            onUseApproximateRoute={handleUseApproximateRoute}
          />
        ) : null}

        {routeWarning && isRouteMode ? <Notice tone="neutral" text={routeWarning} /> : null}

        {isLoading ? <LoadingState /> : null}

        {routePoints || selectedLocation || data ? (
          <Map
            from={routePoints?.from}
            to={routePoints?.to}
            location={!isRouteMode ? selectedLocation?.coords : null}
            route={routeData?.route?.geometry}
            stations={filteredStations}
            zoom={mapZoom}
            onZoomChange={setMapZoom}
          />
        ) : null}

        {data ? <SummaryCard summary={displaySummary} fuel={fuel} /> : null}
        {data ? <FiltersPanel filters={filters} onChange={setFilters} /> : null}
        {data ? <FilterSummaryCard summary={filteredSummary} /> : null}

        {data ? (
          <button
            className="min-h-14 rounded-2xl bg-slate-950 px-4 text-lg font-black text-white shadow-soft transition active:scale-[0.98]"
            type="button"
            onClick={() => setIsAdviceVisible(true)}
          >
            🤖 Совет штурмана
          </button>
        ) : null}

        {navigatorAdvice && isAdviceVisible ? <NavigatorAdviceCard advice={navigatorAdvice} /> : null}

        {data && data.stations.length === 0 && !isLoading ? <EmptyState /> : null}
        {data && data.stations.length > 0 && filteredStations.length === 0 && !isLoading ? <FilterEmptyState /> : null}

        {filteredStations.length > 0 ? (
          <section className="grid gap-3">
            {filteredStations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ModeSwitch({
  selectedMode,
  onChange
}: {
  selectedMode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 rounded-2xl border border-road-100 bg-white p-2 shadow-soft">
      <ModeButton selected={selectedMode === "nearby"} onClick={() => onChange("nearby")}>
        Рядом
      </ModeButton>
      <ModeButton selected={selectedMode === "route"} onClick={() => onChange("route")}>
        По маршруту
      </ModeButton>
    </section>
  );
}

function ModeButton({
  selected,
  children,
  onClick
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-12 rounded-xl px-4 text-base font-black transition active:scale-[0.98] ${
        selected ? "bg-road-500 text-white" : "bg-road-50 text-road-900"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RouteInfo({
  points,
  route,
  stationCount
}: {
  points: RoutePoints;
  route: RouteFuelResponse | null;
  stationCount: number;
}) {
  return (
    <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
      <div className="text-lg font-black text-slate-950">
        {route?.mode === "route_real" ? "Маршрут построен" : "Маршрутные точки выбраны"}
      </div>

      {route?.mode === "route_real" && route.route ? (
        <div className="mt-3 grid grid-cols-2 gap-3 min-[420px]:grid-cols-4">
          <MetricTile label="Дистанция" value={`${formatDistance(route.route.distanceKm)} км`} />
          <MetricTile label="Время" value={`${route.route.durationMin} мин`} />
          <MetricTile label="АЗС" value={String(stationCount)} />
          <MetricTile label="Коридор" value={`${route.corridorKm} км`} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <RoutePoint label="Откуда" point={points.from} />
        <RoutePoint label="Куда" point={points.to} />
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-road-50 px-3 py-3 text-center">
      <div className="text-lg font-black text-road-900">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase text-slate-500">{label}</div>
    </div>
  );
}

function RoutePoint({ label, point }: { label: string; point: GeoSearchResult }) {
  return (
    <div className="rounded-xl bg-road-50 px-4 py-3">
      <div className="text-xs font-black uppercase text-road-600">{label}</div>
      <div className="mt-1 text-base font-black text-road-900">{point.name}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{point.address}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">
        {point.lat.toFixed(6)}, {point.lon.toFixed(6)}
      </div>
    </div>
  );
}

function RouteFallbackCard({
  text,
  isLoading,
  onUseApproximateRoute
}: {
  text: string;
  isLoading: boolean;
  onUseApproximateRoute: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
      <div className="text-lg font-black text-amber-950">Реальный маршрут временно недоступен</div>
      <div className="mt-2 text-base font-semibold text-amber-900">{text}</div>
      <button
        className="mt-4 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-base font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={onUseApproximateRoute}
        disabled={isLoading}
      >
        Использовать приблизительный режим
      </button>
    </section>
  );
}

function FallbackLocationCard({
  isManualFormOpen,
  manualLat,
  manualLon,
  manualError,
  isLocating,
  isLoading,
  onUseKazan,
  onManualToggle,
  onManualLatChange,
  onManualLonChange,
  onManualSubmit,
  onRetry
}: {
  isManualFormOpen: boolean;
  manualLat: string;
  manualLon: string;
  manualError: string | null;
  isLocating: boolean;
  isLoading: boolean;
  onUseKazan: () => void;
  onManualToggle: () => void;
  onManualLatChange: (value: string) => void;
  onManualLonChange: (value: string) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
      <div className="text-lg font-black text-amber-950">Не удалось определить местоположение.</div>
      <div className="mt-1 text-base font-bold text-amber-900">Можно продолжить вручную.</div>

      <div className="mt-4 grid gap-2">
        <button
          className="min-h-12 rounded-xl bg-road-500 px-4 text-base font-black text-white transition active:scale-[0.98]"
          type="button"
          onClick={onUseKazan}
        >
          📍 Использовать Казань
        </button>

        <button
          className="min-h-12 rounded-xl bg-white px-4 text-base font-black text-slate-950 transition active:scale-[0.98]"
          type="button"
          onClick={onManualToggle}
        >
          ✍️ Ввести координаты вручную
        </button>

        <button
          className="min-h-12 rounded-xl bg-slate-950 px-4 text-base font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRetry}
          disabled={isLocating || isLoading}
        >
          🔄 Попробовать ещё раз
        </button>
      </div>

      {isManualFormOpen ? (
        <form className="mt-4 grid gap-3 rounded-xl bg-white p-3" onSubmit={onManualSubmit}>
          <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">Latitude</span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
              inputMode="decimal"
              placeholder="55.796127"
              value={manualLat}
              onChange={(event) => onManualLatChange(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">Longitude</span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
              inputMode="decimal"
              placeholder="49.106414"
              value={manualLon}
              onChange={(event) => onManualLonChange(event.target.value)}
            />
          </label>

          {manualError ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-950">{manualError}</div> : null}

          <button
            className="min-h-12 rounded-xl bg-fuel-500 px-4 text-base font-black text-white transition active:scale-[0.98]"
            type="submit"
          >
            Применить координаты
          </button>
        </form>
      ) : null}
    </section>
  );
}

function FilterSummaryCard({ summary }: { summary: FilteredSummary }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
          <div className="text-2xl font-black text-slate-950">{summary.total}</div>
          <div className="mt-1 text-xs font-bold uppercase text-slate-500">Найдено всего</div>
        </div>
        <div className="rounded-xl bg-road-50 px-3 py-3 text-center">
          <div className="text-2xl font-black text-road-900">{summary.shown}</div>
          <div className="mt-1 text-xs font-bold uppercase text-slate-500">Показано</div>
        </div>
      </div>
    </section>
  );
}

function Notice({ text, tone }: { text: string; tone: "danger" | "neutral" }) {
  const className =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : "border-slate-200 bg-white text-slate-800";

  return <div className={`rounded-2xl border p-4 text-base font-bold shadow-soft ${className}`}>{text}</div>;
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-road-100 bg-white p-5 text-center shadow-soft">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-road-100 border-t-road-500" />
      <div className="mt-3 text-lg font-black text-road-900">Ищем АЗС</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-soft">
      <div className="text-3xl">⛽</div>
      <div className="mt-2 text-lg font-black text-slate-950">АЗС не найдены</div>
      <div className="mt-1 text-base font-semibold text-slate-600">Попробуйте увеличить радиус или коридор поиска.</div>
    </div>
  );
}

function FilterEmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-soft">
      <div className="text-lg font-black text-slate-950">По фильтрам ничего не найдено</div>
      <div className="mt-1 text-base font-semibold text-slate-600">Ослабьте фильтры или обновите поиск.</div>
    </div>
  );
}

function applyStationFilters(stations: FuelStation[], filters: StationFilters, fuel: FuelType): FuelStation[] {
  return stations.filter((station) => {
    if (filters.availability === "withFuel" && !hasAnyFuel(station)) {
      return false;
    }

    if (filters.availability === "withSelectedFuel" && !hasRequestedFuel(station.fuels, fuel)) {
      return false;
    }

    if (filters.availability === "excludeNoFuel" && station.status === "no") {
      return false;
    }

    if (filters.queue === "withoutQueue" && station.hasQueue) {
      return false;
    }

    if (filters.queue === "onlyQueue" && !station.hasQueue) {
      return false;
    }

    if (filters.freshness === "fresh" && station.freshnessLabel !== "свежие данные") {
      return false;
    }

    if (
      filters.freshness === "freshOrMedium" &&
      station.freshnessLabel !== "свежие данные" &&
      station.freshnessLabel !== "средняя свежесть"
    ) {
      return false;
    }

    if (filters.freshness === "hideOld" && station.freshnessLabel === "устаревшие данные") {
      return false;
    }

    if (filters.status !== "all" && station.status !== filters.status) {
      return false;
    }

    if (filters.deviation === "max2" && (station.distanceFromRouteKm ?? 0) > 2) {
      return false;
    }

    return true;
  });
}

function buildClientSummary(stations: FuelStation[], fuel: FuelType): FuelSummary {
  return stations.reduce<FuelSummary>(
    (summary, station) => {
      summary.total += 1;

      if (station.status === "yes" || station.status === "low") {
        summary.withFuel += 1;
      }

      if (hasRequestedFuel(station.fuels, fuel)) {
        summary.withRequestedFuel += 1;
      }

      if (station.hasQueue) {
        summary.withQueue += 1;
      }

      if (station.status === "no") {
        summary.withoutFuel += 1;
      }

      if (station.status === "unknown") {
        summary.unknown += 1;
      }

      return summary;
    },
    {
      total: 0,
      withFuel: 0,
      withRequestedFuel: 0,
      withQueue: 0,
      withoutFuel: 0,
      unknown: 0
    }
  );
}

function hasAnyFuel(station: FuelStation): boolean {
  return station.status === "yes" || station.status === "low";
}

function shouldOfferApproximateFallback(error: unknown): boolean {
  return error instanceof FuelApiError && (error.kind === "route-service" || error.kind === "rate-limited");
}

function getReadableError(error: unknown, isOnline: boolean): string {
  if (!isOnline) {
    return "Нет интернета. Проверьте связь и попробуйте снова.";
  }

  if (error instanceof GeolocationRequestError) {
    return error.message;
  }

  if (error instanceof FuelApiError) {
    if (error.kind === "timeout") {
      return "Backend не ответил вовремя. Попробуйте обновить.";
    }

    if (error.kind === "bad-response") {
      return "Backend вернул неожиданный ответ.";
    }

    if (error.kind === "rate-limited") {
      return error.message || "Геокодер временно ограничил запросы. Попробуйте позже или используйте город из пресетов.";
    }

    if (error.kind === "route-service") {
      return error.message || "Сервис реального маршрута временно недоступен.";
    }

    return error.message || "Backend недоступен. Проверьте, что apps/api запущен на localhost:4000.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте ещё раз.";
}

function useStoredState<T>(
  key: string,
  fallback: T,
  normalize: (value: unknown) => T | null
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return fallback;
    }

    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    try {
      return normalize(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function normalizeRouteLocation(value: unknown): RouteLocation | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<RouteLocation>;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || typeof point.text !== "string" || typeof point.address !== "string") return null;
  if (point.type !== "gps" && point.type !== "address" && point.type !== "map") return null;
  return { type: point.type, text: point.text, name: point.name || point.text, address: point.address, lat: Number(point.lat), lon: Number(point.lon), ...(typeof point.accuracy === "number" ? { accuracy: point.accuracy } : {}) };
}

function normalizeMode(value: unknown): SearchMode | null {
  return value === "nearby" || value === "route" ? value : null;
}

function normalizeRadius(value: unknown): (typeof radiusOptions)[number] | null {
  return typeof value === "number" && radiusOptions.includes(value as (typeof radiusOptions)[number])
    ? (value as (typeof radiusOptions)[number])
    : null;
}

function normalizeCorridor(value: unknown): (typeof corridorOptions)[number] | null {
  return typeof value === "number" && corridorOptions.includes(value as (typeof corridorOptions)[number])
    ? (value as (typeof corridorOptions)[number])
    : null;
}

function normalizeMapZoom(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 19 ? value : null;
}

function normalizeFuel(value: unknown): FuelType | null {
  return typeof value === "string" && fuelOptions.includes(value as FuelType) ? (value as FuelType) : null;
}

function normalizeFilters(value: unknown): StationFilters | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeFilters = value as Partial<StationFilters>;

  return {
    availability: isAvailabilityFilter(maybeFilters.availability) ? maybeFilters.availability : defaultFilters.availability,
    queue: isQueueFilter(maybeFilters.queue) ? maybeFilters.queue : defaultFilters.queue,
    freshness: isFreshnessFilter(maybeFilters.freshness) ? maybeFilters.freshness : defaultFilters.freshness,
    status: isStatusFilter(maybeFilters.status) ? maybeFilters.status : defaultFilters.status,
    deviation: maybeFilters.deviation === "max2" ? "max2" : "all"
  };
}

function isAvailabilityFilter(value: unknown): value is StationFilters["availability"] {
  return value === "all" || value === "withFuel" || value === "withSelectedFuel" || value === "excludeNoFuel";
}

function isQueueFilter(value: unknown): value is StationFilters["queue"] {
  return value === "all" || value === "withoutQueue" || value === "onlyQueue";
}

function isFreshnessFilter(value: unknown): value is StationFilters["freshness"] {
  return value === "all" || value === "fresh" || value === "freshOrMedium" || value === "hideOld";
}

function isStatusFilter(value: unknown): value is StationFilters["status"] {
  return value === "all" || value === "yes" || value === "low" || value === "no" || value === "unknown";
}

function formatDistance(value: number): string {
  if (value < 10) {
    return value.toFixed(1);
  }

  return Math.round(value).toString();
}
