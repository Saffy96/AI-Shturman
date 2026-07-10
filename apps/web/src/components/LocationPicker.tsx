import { useEffect, useState } from "react";
import { reverseGeo, searchGeo } from "../services/fuelApi";
import type { GeoSearchResult, RouteLocation } from "../types/fuel";
import { MapPicker } from "./MapPicker";

export function LocationPicker({ label, value, allowGps, onChange }: { label: string; value: RouteLocation | null; allowGps?: boolean; onChange: (value: RouteLocation) => void }) {
  const [text, setText] = useState(value?.text ?? "");
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => { setText(value?.text ?? ""); }, [value?.text]);
  useEffect(() => {
    if (text.trim().length < 2 || text === value?.text) { setSuggestions([]); return; }
    const timer = window.setTimeout(() => searchGeo(text).then((response) => setSuggestions(response.results)).catch(() => setSuggestions([])), 500);
    return () => window.clearTimeout(timer);
  }, [text, value?.text]);
  function select(result: GeoSearchResult, type: RouteLocation["type"] = "address", accuracy?: number) {
    const point = { ...result, type, text: result.address, ...(accuracy == null ? {} : { accuracy }) };
    onChange(point); setText(point.text); setSuggestions([]);
  }
  function gps() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try { select(await reverseGeo(position.coords.latitude, position.coords.longitude), "gps", position.coords.accuracy); }
      finally { setLocating(false); }
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  }
  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
    <div className="relative"><input className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none focus:border-road-500" value={text} onChange={(e) => setText(e.target.value)} placeholder={label === "Откуда" ? "Казань" : "Москва"} />
      {suggestions.length ? <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-xl">{suggestions.map((item) => <button type="button" key={`${item.lat}:${item.lon}`} className="block w-full border-b px-4 py-3 text-left hover:bg-road-50" onClick={() => select(item)}><b>{item.title || item.name}</b><span className="block text-sm text-slate-500">{item.address}</span></button>)}</div> : null}
    </div>
    {value ? <div className="mt-2 text-sm text-slate-600"><b>{value.name}</b><br />{value.lat.toFixed(6)}, {value.lon.toFixed(6)}{value.accuracy != null ? <><br />Точность: {Math.round(value.accuracy)} метров</> : null}</div> : null}
    <div className="mt-3 grid grid-cols-2 gap-2">{allowGps ? <button type="button" className="min-h-11 rounded-xl bg-slate-950 px-2 font-bold text-white" onClick={gps} disabled={locating}>📍 {locating ? "Получаем..." : "Моё место"}</button> : <span />}
      <button type="button" className="min-h-11 rounded-xl bg-road-100 px-2 font-bold text-road-900" onClick={() => setMapOpen(true)}>🗺 Выбрать на карте</button></div>
    {mapOpen ? <MapPicker initial={value ?? undefined} onClose={() => setMapOpen(false)} onSelect={(point) => { onChange(point); setMapOpen(false); }} /> : null}
  </section>;
}
