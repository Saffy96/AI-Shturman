import { useEffect, useRef, useState } from "react";
import { reverseGeo, searchGeo } from "../services/fuelApi";
import type { GeoSearchResult, RouteLocation } from "../types/fuel";
import { MapPicker } from "./MapPicker";

interface Props {
  label: string;
  value: RouteLocation | null;
  allowGps?: boolean;
  onChange: (value: RouteLocation) => void;
}

export function LocationPicker({ label, value, allowGps = false, onChange }: Props) {
  const [text, setText] = useState(value?.text ?? "");
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchVersion = useRef(0);

  useEffect(() => { setText(value?.text ?? ""); }, [value?.text]);
  useEffect(() => {
    const query = text.trim();
    const version = ++searchVersion.current;
    if (query.length < 2 || query === value?.text) { setSuggestions([]); return; }
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchGeo(query);
        if (version === searchVersion.current) setSuggestions(response.results);
      } catch {
        if (version === searchVersion.current) setSuggestions([]);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [text, value?.text]);

  function select(result: GeoSearchResult, type: RouteLocation["type"] = "address", accuracy?: number) {
    const point = { ...result, type, text: result.address, ...(accuracy == null ? {} : { accuracy }) };
    onChange(point);
    setText(point.text);
    setSuggestions([]);
    setError(null);
  }

  function requestGps() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try { select(await reverseGeo(position.coords.latitude, position.coords.longitude), "gps", position.coords.accuracy); }
      catch { setError("Не удалось определить адрес текущей точки."); }
      finally { setLocating(false); }
    }, () => {
      setLocating(false);
      setError("Не удалось получить геопозицию.");
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="relative">
        <input className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 caret-road-500 outline-none placeholder:text-slate-400 focus:border-road-500" value={text} onChange={(event) => setText(event.target.value)} placeholder={allowGps ? "Казань" : "Москва"} />
        {suggestions.length ? <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border bg-white text-slate-950 shadow-xl">{suggestions.map((item) => <button type="button" key={`${item.lat}:${item.lon}`} className="block w-full border-b px-4 py-3 text-left hover:bg-road-50" onClick={() => select(item)}><b>{item.title || item.name}</b><span className="block text-sm text-slate-500">{item.address}</span></button>)}</div> : null}
      </div>
      {value ? <div className="mt-2 text-sm text-slate-600"><b>{value.name}</b><br />{value.lat.toFixed(6)}, {value.lon.toFixed(6)}{value.accuracy != null ? <><br />Точность: {Math.round(value.accuracy)} м</> : null}</div> : null}
      {error ? <div className="mt-2 text-xs font-bold text-rose-700" role="alert">{error}</div> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {allowGps ? <button type="button" className="min-h-11 rounded-xl bg-slate-950 px-2 font-bold text-white disabled:opacity-50" onClick={requestGps} disabled={locating}>{locating ? "Получаем…" : "Моё место"}</button> : <span />}
        <button type="button" className="min-h-11 rounded-xl bg-road-100 px-2 font-bold text-road-900" onClick={() => setMapOpen(true)}>Выбрать на карте</button>
      </div>
      {mapOpen ? <MapPicker initial={value ?? undefined} onClose={() => setMapOpen(false)} onSelect={(point) => { onChange(point); setMapOpen(false); }} /> : null}
    </section>
  );
}
