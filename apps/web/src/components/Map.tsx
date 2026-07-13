import { Clusterer, Map as YandexMap, Placemark, Polyline, YMaps } from "@pbe/react-yandex-maps";
import { Crosshair, LocateFixed, Minus, Plus, Route as RouteIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Coordinates, FuelStation, GeoSearchResult } from "../types/fuel";

type MapInteractionMode = "automatic" | "manual";

interface Props {
  from?: GeoSearchResult | null;
  to?: GeoSearchResult | null;
  location?: Coordinates | null;
  route?: Coordinates[];
  stations: FuelStation[];
  zoom: number;
  recommendedStationId?: string | null;
  selectedStation?: FuelStation | null;
  onZoomChange: (zoom: number) => void;
  onStationClick?: (station: FuelStation) => void;
}

const defaultCenter = [55.796127, 49.106414] as [number, number];

export function Map({ from, to, location, route = [], stations, zoom, recommendedStationId, selectedStation, onZoomChange, onStationClick }: Props) {
  const mapRef = useRef<any>(null);
  const programmaticMoveRef = useRef(false);
  const interactionTimerRef = useRef<number | null>(null);
  const lastRouteKeyRef = useRef("");
  const lastLocationKeyRef = useRef("");
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>("automatic");
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [mapReady, setMapReady] = useState(false);

  const routeBounds = useMemo(() => {
    const points = route.length > 1 ? route : [from, to].filter(Boolean) as Coordinates[];
    return boundsFor(points);
  }, [from?.lat, from?.lon, to?.lat, to?.lon, route]);
  const routeKey = `${from?.lat ?? ""}:${from?.lon ?? ""}:${to?.lat ?? ""}:${to?.lon ?? ""}:${route.length}`;

  const runProgrammaticMove = useCallback((move: () => void) => {
    programmaticMoveRef.current = true;
    setInteractionMode("automatic");
    move();
    window.setTimeout(() => { programmaticMoveRef.current = false; }, 450);
  }, []);

  const showRoute = useCallback(() => {
    if (!mapRef.current || !routeBounds) return;
    const compact = window.matchMedia("(max-width: 767px)").matches;
    const zoomMargin = compact ? [132, 24, 158, 24] : selectedStation ? [112, 470, 140, 56] : [112, 72, 140, 56];
    const isCityRoute = Math.abs(routeBounds[1][0] - routeBounds[0][0]) < 1 && Math.abs(routeBounds[1][1] - routeBounds[0][1]) < 1.5;
    runProgrammaticMove(() => {
      const result = mapRef.current.setBounds(routeBounds, { checkZoomRange: true, zoomMargin, duration: 250 });
      if (isCityRoute && result && typeof result.then === "function") {
        void result.then(() => {
          if (mapRef.current?.getZoom() < 11) mapRef.current.setZoom(11, { duration: 180 });
        });
      }
    });
  }, [routeBounds, runProgrammaticMove, selectedStation]);

  const showLocation = useCallback(() => {
    if (!mapRef.current || !location) return;
    runProgrammaticMove(() => mapRef.current.setCenter([location.lat, location.lon], Math.max(currentZoom, 13), { duration: 220 }));
  }, [currentZoom, location, runProgrammaticMove]);

  const showSelected = useCallback(() => {
    if (!mapRef.current || !selectedStation) return;
    runProgrammaticMove(() => mapRef.current.setCenter([selectedStation.lat, selectedStation.lon], Math.max(currentZoom, 14), { duration: 220 }));
  }, [currentZoom, runProgrammaticMove, selectedStation]);

  const changeZoom = useCallback((delta: number) => {
    if (!mapRef.current) return;
    runProgrammaticMove(() => mapRef.current.setZoom(Math.max(2, Math.min(19, currentZoom + delta)), { duration: 150 }));
  }, [currentZoom, runProgrammaticMove]);

  useEffect(() => {
    if (!mapRef.current || !routeBounds || !routeKey || routeKey === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = routeKey;
    showRoute();
  }, [mapReady, routeBounds, routeKey, showRoute]);

  useEffect(() => {
    if (!mapRef.current || !location) return;
    const key = `${location.lat}:${location.lon}`;
    if (key === lastLocationKeyRef.current || interactionMode === "manual") return;
    lastLocationKeyRef.current = key;
    showLocation();
  }, [interactionMode, location, mapReady, showLocation]);

  useEffect(() => {
    const focusStation = (event: Event) => {
      const detail = (event as CustomEvent<Coordinates>).detail;
      if (!mapRef.current || !detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lon)) return;
      runProgrammaticMove(() => mapRef.current.setCenter([detail.lat, detail.lon], Math.max(currentZoom, 15), { duration: 240 }));
    };
    window.addEventListener("ai-shturman:focus-station", focusStation);
    return () => window.removeEventListener("ai-shturman:focus-station", focusStation);
  }, [currentZoom, runProgrammaticMove]);

  useEffect(() => () => {
    if (interactionTimerRef.current != null) window.clearTimeout(interactionTimerRef.current);
  }, []);

  const handleActionBegin = useCallback(() => {
    if (!programmaticMoveRef.current) setInteractionMode("manual");
  }, []);

  const handleBoundsChange = useCallback((event: any) => {
    const nextZoom = Math.round(event.get("newZoom"));
    setCurrentZoom(nextZoom);
    if (interactionTimerRef.current != null) window.clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = window.setTimeout(() => onZoomChange(nextZoom), 150);
  }, [onZoomChange]);

  const markers = useMemo(() => stations.map((station) => {
    const selected = selectedStation?.id === station.id;
    const recommended = recommendedStationId === station.id;
    return <StationMarker key={station.id} station={station} selected={selected} recommended={recommended} compact={currentZoom < 11} onClick={onStationClick} />;
  }), [currentZoom, onStationClick, recommendedStationId, selectedStation?.id, stations]);

  return <section className="relative h-full w-full overflow-hidden bg-[#05070b]" aria-label="Карта АЗС">
    <YMaps query={{ apikey: import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "", lang: "ru_RU", load: "package.full" }}>
      <YandexMap
        instanceRef={(value) => { mapRef.current = value; setMapReady(Boolean(value)); }}
        defaultState={{ center: location ? [location.lat, location.lon] : from ? [from.lat, from.lon] : defaultCenter, zoom }}
        width="100%"
        height="100%"
        onActionBegin={handleActionBegin}
        onBoundsChange={handleBoundsChange}
      >
        {route.length > 1 ? <Polyline geometry={route.map((point) => [point.lat, point.lon])} options={{ strokeColor: "#00c9a7", strokeWidth: 6, strokeOpacity: 0.9 }} /> : null}
        {from ? <Placemark geometry={[from.lat, from.lon]} properties={{ iconCaption: `A · ${from.name}`, balloonContent: from.address }} options={{ preset: "islands#darkGreenCircleDotIcon" }} /> : null}
        {to ? <Placemark geometry={[to.lat, to.lon]} properties={{ iconCaption: `Б · ${to.name}`, balloonContent: to.address }} options={{ preset: "islands#redCircleDotIcon" }} /> : null}
        {location ? <Placemark geometry={[location.lat, location.lon]} properties={{ iconCaption: "Вы здесь" }} options={{ preset: "islands#blueCircleDotIcon", zIndex: 900 }} /> : null}
        <Clusterer options={{ preset: "islands#invertedDarkGreenClusterIcons", groupByCoordinates: false, gridSize: currentZoom < 10 ? 96 : 64, clusterDisableClickZoom: false, clusterOpenBalloonOnClick: false }}>
          {markers}
        </Clusterer>
      </YandexMap>
    </YMaps>

    <div className="absolute bottom-[130px] left-3 z-20 grid gap-2 md:bottom-6 md:left-6">
      {interactionMode === "manual" && routeBounds ? <MapButton label="Показать весь маршрут" wide onClick={showRoute}><RouteIcon size={18} /> <span>Показать маршрут</span></MapButton> : null}
      {location ? <MapButton label="Моё местоположение" onClick={showLocation}><LocateFixed size={19} /></MapButton> : null}
      {selectedStation ? <MapButton label="Показать выбранную АЗС" onClick={showSelected}><Crosshair size={19} /></MapButton> : null}
      <MapButton label="Приблизить" onClick={() => changeZoom(1)}><Plus size={20} /></MapButton>
      <MapButton label="Отдалить" onClick={() => changeZoom(-1)}><Minus size={20} /></MapButton>
    </div>
  </section>;
}

const StationMarker = memo(function StationMarker({ station, selected, recommended, compact, onClick }: { station: FuelStation; selected: boolean; recommended: boolean; compact: boolean; onClick?: (station: FuelStation) => void }) {
  const visual = stationVisual(station, recommended);
  const handleClick = useCallback(() => onClick?.(station), [onClick, station]);
  return <Placemark
    geometry={[station.lat, station.lon]}
    properties={{ iconContent: compact ? visual.compactSymbol : visual.symbol, hintContent: `${station.brand || station.name || "АЗС"} · ${visual.label}` }}
    options={{ preset: selected || recommended ? "islands#circleStretchyIcon" : "islands#circleIcon", iconColor: visual.color, zIndex: selected ? 1200 : recommended ? 1100 : visual.zIndex }}
    modules={["geoObject.addon.hint"]}
    onClick={handleClick}
  />;
});

function MapButton({ label, wide, onClick, children }: { label: string; wide?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`pointer-events-auto flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#10151d]/92 px-3 font-black text-white shadow-xl backdrop-blur-md active:scale-95 ${wide ? "w-max" : "w-11"}`}>{children}</button>;
}

function boundsFor(points: Coordinates[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  return points.reduce<[[number, number], [number, number]]>((bounds, point) => [[Math.min(bounds[0][0], point.lat), Math.min(bounds[0][1], point.lon)], [Math.max(bounds[1][0], point.lat), Math.max(bounds[1][1], point.lon)]], [[points[0].lat, points[0].lon], [points[0].lat, points[0].lon]]);
}

function stationVisual(station: FuelStation, recommended: boolean) {
  if (recommended) return { color: "#06b6d4", symbol: "★", compactSymbol: "★", label: "рекомендуемая", zIndex: 1000 };
  if (station.status === "no") return { color: "#ef4444", symbol: "×", compactSymbol: "×", label: "топлива нет", zIndex: 600 };
  if (station.status === "low") return { color: "#f97316", symbol: "!", compactSymbol: "!", label: "топливо заканчивается", zIndex: 700 };
  if (station.hasQueue || station.status === "queue") return { color: "#eab308", symbol: "≋", compactSymbol: "•", label: "есть очередь", zIndex: 800 };
  if (station.status === "unknown") return { color: "#64748b", symbol: "?", compactSymbol: "•", label: "нет данных", zIndex: 500 };
  return { color: "#22c55e", symbol: "✓", compactSymbol: "•", label: "топливо есть", zIndex: 900 };
}
