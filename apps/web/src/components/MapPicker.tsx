import { Map, Placemark, YMaps } from "@pbe/react-yandex-maps";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Coordinates, RouteLocation } from "../types/fuel";

export function MapPicker({ initial, onSelect, onClose }: { initial?: Coordinates; onSelect: (point: RouteLocation) => void; onClose: () => void }) {
  const [coords, setCoords] = useState<Coordinates>(initial ?? { lat: 55.796127, lon: 49.106414 });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function choose() {
    const coordinates = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
    onSelect({ name: "Выбранная точка", address: coordinates, lat: coords.lat, lon: coords.lon, type: "map", text: coordinates });
  }

  return createPortal(
    <div className="map-picker-backdrop fixed inset-0 z-[100] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Выбор точки на карте">
      <section className="map-picker-dialog w-full max-w-xl overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between p-4"><h2 className="text-lg font-black">Укажите точку на карте</h2><button className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
        <YMaps query={{ apikey: import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "", lang: "ru_RU" }}>
          <Map defaultState={{ center: [coords.lat, coords.lon], zoom: 12 }} width="100%" height="430px" onClick={(event: any) => { const [lat, lon] = event.get("coords"); setCoords({ lat, lon }); }}>
            <Placemark geometry={[coords.lat, coords.lon]} options={{ preset: "islands#redIcon" }} />
          </Map>
        </YMaps>
        <div className="p-4">
          <div className="mb-3 text-center text-sm font-bold text-slate-600">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</div>
          <button className="min-h-12 w-full rounded-xl bg-road-500 font-black text-white" onClick={choose}>Выбрать эту точку</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
