import { useState } from "react";
import { searchGeo } from "../services/fuelApi";
import type { RouteLocation } from "../types/fuel";
import { LocationPicker } from "./LocationPicker";

interface Props {
  from: RouteLocation | null;
  to: RouteLocation | null;
  isRouteMode: boolean;
  isBuildingRoute: boolean;
  onFromChange: (value: RouteLocation) => void;
  onToChange: (value: RouteLocation) => void;
  onSwap: () => void;
  onBuildRoute: () => void;
}

export function RouteForm({ from, to, isRouteMode, isBuildingRoute, onFromChange, onToChange, onSwap, onBuildRoute }: Props) {
  const [presetError, setPresetError] = useState<string | null>(null);
  if (!isRouteMode) return null;

  async function selectPreset(name: string) {
    setPresetError(null);
    try {
      const result = (await searchGeo(name)).results[0];
      if (result) onToChange({ ...result, type: "address", text: result.address });
      else setPresetError("Адрес не найден.");
    } catch { setPresetError("Не удалось загрузить адрес."); }
  }

  return (
    <section className="grid gap-3 rounded-[26px] border border-white/[.08] bg-[#10151d] p-4 text-white shadow-2xl">
      <div><div className="text-xs font-black uppercase tracking-[.2em] text-[#8a94a6]">Навигация</div><h2 className="mt-1 text-2xl font-black">Куда?</h2></div>
      <LocationPicker label="Откуда" value={from} allowGps onChange={onFromChange} />
      <button type="button" className="mx-auto rounded-xl bg-slate-100 px-4 py-2 font-black text-slate-950" onClick={onSwap}>⇄ Поменять местами</button>
      <LocationPicker label="Куда" value={to} onChange={onToChange} />
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-wider text-[#8a94a6]">Последние направления</div>
        <div className="flex gap-2 overflow-x-auto">{["Москва", "Уфа", "Адлер"].map((city) => <button key={city} type="button" onClick={() => void selectPreset(city)} className="min-h-11 rounded-full bg-white/[.08] px-4 text-sm font-black active:scale-95">{city}</button>)}</div>
        {presetError ? <div className="mt-2 text-xs font-bold text-rose-300" role="alert">{presetError}</div> : null}
      </div>
      <button className="min-h-14 rounded-2xl bg-[#00e676] px-4 font-black text-[#05070b] shadow-[0_0_30px_rgba(0,230,118,.2)] active:scale-95 disabled:opacity-50" type="button" onClick={onBuildRoute} disabled={isBuildingRoute || !from || !to}>{isBuildingRoute ? "Прокладываем маршрут…" : "Построить маршрут"}</button>
    </section>
  );
}
