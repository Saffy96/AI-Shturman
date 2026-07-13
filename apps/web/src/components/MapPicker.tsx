import { Map, Placemark, YMaps } from "@pbe/react-yandex-maps";
import { useState } from "react";
import { createPortal } from "react-dom";
import { reverseGeo } from "../services/fuelApi";
import type { Coordinates, RouteLocation } from "../types/fuel";

export function MapPicker({ initial, onSelect, onClose }: { initial?: Coordinates; onSelect: (point: RouteLocation) => void; onClose: () => void }) {
  const [coords, setCoords] = useState<Coordinates>(initial ?? { lat: 55.796127, lon: 49.106414 });
  const [loading, setLoading] = useState(false);
  async function choose(point = coords) {
    setLoading(true);
    try {
      const result = await reverseGeo(point.lat, point.lon);
      onSelect({ ...result, type: "map", text: result.address });
    } finally { setLoading(false); }
  }
  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/60 sm:place-items-center">
    <section className="w-full max-w-xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between p-4"><div className="text-lg font-black">Укажите точку на карте</div><button type="button" onClick={onClose}>✕</button></div>
      <YMaps query={{ apikey: import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "", lang: "ru_RU" }}>
        <Map defaultState={{ center: [coords.lat, coords.lon], zoom: 12 }} width="100%" height="430px"
          onClick={(event: any) => { const [lat, lon] = event.get("coords"); setCoords({ lat, lon }); }}
          onBoundsChange={(event: any) => { const [lat, lon] = event.get("newCenter"); setCoords({ lat, lon }); }}>
          <Placemark geometry={[coords.lat, coords.lon]} options={{ preset: "islands#redIcon" }} />
        </Map>
      </YMaps>
      <div className="p-4"><div className="mb-3 text-center text-sm font-bold text-slate-600">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</div><button className="min-h-12 w-full rounded-xl bg-road-500 font-black text-white" disabled={loading} onClick={() => choose()}>{loading ? "Определяем адрес..." : "Выбрать эту точку"}</button></div>
    </section>
  </div>, document.body);
}
