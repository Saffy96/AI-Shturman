import type { RouteLocation } from "../types/fuel";
import { LocationPicker } from "./LocationPicker";

export function RouteForm({ from, to, isRouteMode, isBuildingRoute, onFromChange, onToChange, onSwap, onBuildRoute }: { from: RouteLocation | null; to: RouteLocation | null; isRouteMode: boolean; isBuildingRoute: boolean; onFromChange: (value: RouteLocation) => void; onToChange: (value: RouteLocation) => void; onSwap: () => void; onBuildRoute: () => void }) {
  if (!isRouteMode) return null;
  return <section className="grid gap-3 rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
    <LocationPicker label="Откуда" value={from} allowGps onChange={onFromChange} />
    <button type="button" className="mx-auto rounded-xl bg-slate-100 px-4 py-2 font-black" onClick={onSwap}>⇄ Поменять местами</button>
    <LocationPicker label="Куда" value={to} onChange={onToChange} />
    <button className="min-h-12 rounded-xl bg-slate-950 px-4 font-black text-white disabled:opacity-50" type="button" onClick={onBuildRoute} disabled={isBuildingRoute || !from || !to}>{isBuildingRoute ? "Строим маршрут..." : "Построить маршрут"}</button>
  </section>;
}
