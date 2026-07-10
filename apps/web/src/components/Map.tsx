import { Map as YandexMap, Placemark, Polyline, YMaps } from "@pbe/react-yandex-maps";
import { useEffect, useRef } from "react";
import type { Coordinates, FuelStation, GeoSearchResult } from "../types/fuel";

interface Props { from?: GeoSearchResult | null; to?: GeoSearchResult | null; location?: Coordinates | null; route?: Coordinates[]; stations: FuelStation[]; zoom: number; onZoomChange: (zoom: number) => void; onStationClick?: (station: FuelStation) => void; }

export function Map({ from, to, location, route = [], stations, zoom, onZoomChange, onStationClick }: Props) {
  const mapRef = useRef<any>(null);
  const points = [from, to, location, ...stations].filter(Boolean) as Coordinates[];
  const center = points[0] ? [points[0].lat, points[0].lon] : [55.796127, 49.106414];
  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    const bounds = points.reduce((b, p) => [[Math.min(b[0][0], p.lat), Math.min(b[0][1], p.lon)], [Math.max(b[1][0], p.lat), Math.max(b[1][1], p.lon)]], [[points[0].lat, points[0].lon], [points[0].lat, points[0].lon]]);
    mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 42 });
  }, [from?.lat, to?.lat, location?.lat, route.length, stations.length]);
  return <section className="h-full w-full overflow-hidden bg-[#05070b]">
    <YMaps query={{ apikey: import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "", lang: "ru_RU" }}><YandexMap instanceRef={(v) => { mapRef.current = v; }} state={{ center, zoom }} width="100%" height="100%" onBoundsChange={(e: any) => onZoomChange(Math.round(e.get("newZoom")))}>
      {route.length > 1 ? <Polyline geometry={route.map((p) => [p.lat, p.lon])} options={{ strokeColor: "#0f766e", strokeWidth: 5 }} /> : null}
      {from ? <Placemark geometry={[from.lat, from.lon]} properties={{ iconCaption: `🚩 ${from.name}`, balloonContent: from.address }} /> : null}
      {to ? <Placemark geometry={[to.lat, to.lon]} properties={{ iconCaption: `🏁 ${to.name}`, balloonContent: to.address }} /> : null}
      {location ? <Placemark geometry={[location.lat, location.lon]} properties={{ iconCaption: "📍 Вы здесь" }} /> : null}
      {stations.map((s) => <Placemark key={s.id} geometry={[s.lat, s.lon]} properties={{ iconContent: "⛽", hintContent: `${s.brand || s.name || "АЗС"} — открыть подробности` }} options={{ preset: "islands#circleIcon", iconColor: s.status === "no" ? "#ff5252" : s.hasRequestedFuel ? "#00e676" : "#64748b" }} modules={["geoObject.addon.hint"]} onClick={() => onStationClick?.(s)} />)}
    </YandexMap></YMaps>
  </section>;
}

function stationBalloon(s: FuelStation): string {
  const deviation = s.distanceFromRouteKm == null ? "—" : s.distanceFromRouteKm < 1 ? `${Math.round(s.distanceFromRouteKm * 1000)} м` : `${s.distanceFromRouteKm.toFixed(1)} км`;
  return `<b>Через:</b> ${s.distanceFromStartKm?.toFixed(1) ?? s.distanceKm?.toFixed(1) ?? "—"} км<br/><b>Отклонение:</b> ${deviation}<br/><b>Топливо:</b> ${s.fuels.join(", ") || "нет данных"}<br/><b>Очередь:</b> ${s.hasQueue ? "есть" : "нет"}<br/><b>Обновлено:</b> ${relativeTime(s.lastUpdatedAt)}`;
}
function relativeTime(value: string | null): string { if (!value) return "неизвестно"; const m = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return m < 60 ? `${m} мин назад` : `${Math.round(m / 60)} ч назад`; }
