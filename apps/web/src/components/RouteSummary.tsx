import type { RouteFuelResponse } from "../types/fuel";

export function RouteSummary({ route, stationCount }: { route: RouteFuelResponse; stationCount: number }) {
  if (!route.route) return null;
  const items = [
    { icon: "↗", label: "Расстояние", value: `${formatDistance(route.route.distanceKm)} км` },
    { icon: "◷", label: "В пути", value: formatDuration(route.route.durationMin) },
    { icon: "⛽", label: "АЗС", value: String(stationCount) },
    { icon: "◌", label: "Коридор", value: `${route.corridorKm} км` }
  ];
  return <section className="overflow-hidden rounded-[24px] border border-white/70 bg-white/90 p-3 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-xl sm:p-4">
    <div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-road-600">Маршрут готов</div><h2 className="mt-1 text-xl font-black text-slate-950">Поездка</h2></div><div className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-xl text-white">✓</div></div>
    <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">{items.map((item) => <div key={item.label} className="rounded-2xl bg-slate-950 px-3 py-4 text-white"><div className="text-lg text-emerald-300">{item.icon}</div><div className="mt-2 whitespace-nowrap text-lg font-black">{item.value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</div></div>)}</div>
  </section>;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
function formatDistance(value: number): string { return value < 10 ? value.toFixed(1) : String(Math.round(value)); }
