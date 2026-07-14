import { CarShell, FuelFilterDock, MapContainer, NavigationCard, RouteCompactBar, StationDetailsDrawer } from "./components/CarShell";
import { FuelStationCard } from "./components/FuelStationCard";
import { MapPicker } from "./components/MapPicker";
import { RouteForm } from "./components/RouteForm";
import { CORRIDOR_OPTIONS, FUEL_OPTIONS, RADIUS_OPTIONS, type CorridorKm, type RadiusKm } from "./features/navigation/config";
import { NearbySearchEditor } from "./features/navigation/NearbySearchEditor";
import { Notice } from "./features/navigation/Notice";
import { RouteFallbackCard } from "./features/navigation/RouteFallbackCard";
import { SearchModeSwitch } from "./features/navigation/SearchModeSwitch";
import { useNavigatorController } from "./features/navigation/useNavigatorController";
import { formatDuration } from "./utils/format";

export function App() {
  const nav = useNavigatorController();
  const notice = getNotice(nav);

  const editorPanel = nav.isRouteEditorOpen ? (
    <div className="editor-card glass-panel">
      <div className="editor-card__heading">
        <div><span>Планирование</span><h2>{nav.isRouteMode ? "Маршрут" : "Поиск рядом"}</h2></div>
        {nav.data ? <button type="button" onClick={() => nav.setIsRouteEditorOpen(false)} aria-label="Закрыть редактор">×</button> : null}
      </div>
      <SearchModeSwitch value={nav.selectedMode} onChange={nav.handleModeChange} />
      {nav.isRouteMode ? (
        <RouteForm from={nav.fromPoint} to={nav.toPoint} isRouteMode isBuildingRoute={nav.isBuildingRoute} onFromChange={nav.handleFromChange} onToChange={nav.handleToChange} onSwap={nav.handleSwapRoute} onBuildRoute={() => void nav.buildRoute()} />
      ) : (
        <NearbySearchEditor
          locationLabel={nav.locationLabel}
          sourceLabel={nav.sourceLabel}
          locating={nav.geolocation.isLocating}
          loading={nav.isLoading}
          onRequestLocation={() => void nav.requestLocation()}
          onOpenMap={() => nav.setIsNearbyMapPickerOpen(true)}
          onUseKazan={nav.useKazan}
          onAddressSelect={(result) => nav.applyLocation({ lat: result.lat, lon: result.lon }, "manual", result.address)}
        />
      )}
      {nav.error ? <Notice tone="danger" text={nav.error} /> : null}
      {nav.routeFallbackHint && nav.isRouteMode ? <RouteFallbackCard text={nav.routeFallbackHint} loading={nav.isLoading} onConfirm={() => void nav.useApproximateRoute()} /> : null}
      {nav.loadingPhase ? <NavigationCard state="loading" /> : null}
    </div>
  ) : null;

  return (
    <>
      <CarShell
        online={nav.isOnline}
        gpsReady={Boolean(nav.geolocation.location)}
        accuracy={nav.geolocation.location?.accuracy}
        routeActive={Boolean(nav.routeData?.route)}
        filtersOpen={nav.isFiltersOpen}
        onOpenSettings={() => nav.setIsFiltersOpen(!nav.isFiltersOpen)}
        editorPanel={editorPanel}
        noticePanel={notice ? <Notice tone={notice.tone} text={notice.text} /> : null}
        mapControls={!nav.isRouteEditorOpen ? <button type="button" className="floating-edit-button" onClick={() => { nav.setIsFiltersOpen(false); nav.setIsRouteEditorOpen(true); }}>Изменить поиск</button> : null}
        filterDock={
          <FuelFilterDock
            fuel={nav.fuel}
            fuels={FUEL_OPTIONS}
            filters={nav.filters}
            filtersOpen={nav.isFiltersOpen}
            mode={nav.selectedMode}
            distanceKm={nav.isRouteMode ? nav.corridorKm : nav.radiusKm}
            distanceOptions={nav.isRouteMode ? CORRIDOR_OPTIONS : RADIUS_OPTIONS}
            resultCount={nav.filteredStations.length}
            loading={nav.isLoading || nav.isBuildingRoute}
            canSearch={nav.canRequestStations}
            onFuelChange={nav.setFuel}
            onFiltersChange={nav.setFilters}
            onFiltersOpenChange={nav.setIsFiltersOpen}
            onDistanceChange={(value) => nav.isRouteMode ? nav.setCorridorKm(value as CorridorKm) : nav.setRadiusKm(value as RadiusKm)}
            onSearch={() => void nav.checkStations()}
            onRefresh={() => void nav.refresh()}
          />
        }
        stationPanel={
          <StationDetailsDrawer station={nav.selectedStation} onClose={nav.closeStation}>
            {nav.selectedStation ? <FuelStationCard key={nav.selectedStation.id} station={nav.selectedStation} selected onShowOnMap={(station) => nav.selectStation(station, true)} /> : null}
          </StationDetailsDrawer>
        }
        routePanel={nav.routeData?.route && !nav.isRouteEditorOpen ? <RouteCompactBar from={nav.routeData.from.name} to={nav.routeData.to.name} distanceKm={nav.routeData.route.distanceKm} duration={formatDuration(nav.routeData.route.durationMin)} onEdit={() => nav.setIsRouteEditorOpen(true)} onSwap={nav.handleSwapRoute} onCancel={nav.cancelRoute} /> : null}
        map={
          <MapContainer
            from={nav.routePoints?.from}
            to={nav.routePoints?.to}
            location={!nav.isRouteMode ? nav.selectedLocation?.coords : null}
            route={nav.routeData?.route?.geometry}
            stations={nav.filteredStations}
            zoom={nav.mapZoom}
            selectedStation={nav.selectedStation}
            stationFocusVersion={nav.stationFocusVersion}
            onZoomChange={nav.setMapZoom}
            onStationClick={nav.selectStation}
          />
        }
      />
      {nav.isNearbyMapPickerOpen ? <MapPicker initial={nav.selectedLocation?.coords} onClose={() => nav.setIsNearbyMapPickerOpen(false)} onSelect={(point) => { nav.applyLocation(point, "map"); nav.setIsNearbyMapPickerOpen(false); }} /> : null}
    </>
  );
}

type Navigator = ReturnType<typeof useNavigatorController>;

function getNotice(nav: Navigator): { tone: "danger" | "neutral"; text: string } | null {
  if (!nav.isOnline) return { tone: "danger", text: "Нет подключения. Показаны сохранённые данные." };
  if (nav.data && nav.data.stations.length === 0) return { tone: "neutral", text: "По выбранным условиям АЗС не найдены." };
  if (nav.data && nav.data.stations.length > 0 && nav.filteredStations.length === 0) return { tone: "neutral", text: "Ослабьте фильтры — подходящих АЗС сейчас нет." };
  if (nav.routeWarning && nav.isRouteMode && !nav.isRouteEditorOpen) return { tone: "neutral", text: nav.routeWarning };
  return null;
}
