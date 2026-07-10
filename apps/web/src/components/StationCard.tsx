import type { FuelStation } from "../types/fuel";
import { buildTwoGisUrl, buildYandexMapsUrl } from "../utils/maps";

export function StationCard({ station }: { station: FuelStation }) {
  const title = station.brand || station.name || "АЗС";
  const location = { lat: station.lat, lon: station.lon };
  const distance = station.distanceFromStartKm ?? station.distanceKm;
  return <article id={`station-${station.id}`} className="group scroll-mt-40 rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_55px_rgba(15,23,42,.10)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-xl">
    <header className="flex gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-road-600 text-2xl shadow-lg">⛽</div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="truncate text-xl font-black text-slate-950">{title}</h2><p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{station.address || "Адрес не указан"}</p></div>{distance != null ? <div className="shrink-0 text-right"><div className="text-2xl font-black text-slate-950">{formatDistance(distance)}</div><div className="text-[10px] font-black uppercase text-slate-400">км по пути</div></div> : null}</div></div>
    </header>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Metric label="Отклонение" value={formatDeviation(station.distanceFromRouteKm)} />
      <Metric label="Данные" value={relativeTime(station.lastUpdatedAt)} />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">{station.fuels.length ? station.fuels.map((fuel) => <span key={fuel} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900">{fuel} ✓</span>) : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">Топливо неизвестно</span>}<span className={`rounded-full px-3 py-1.5 text-xs font-black ${station.hasQueue ? "bg-orange-100 text-orange-900" : "bg-sky-100 text-sky-900"}`}>{station.hasQueue ? "Очередь" : "Без очереди"}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{station.freshnessLabel}</span></div>
    <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-sm font-bold text-slate-200">{station.recommendation}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><a className="flex min-h-12 items-center justify-center rounded-2xl bg-road-500 px-3 text-center text-sm font-black text-white active:scale-95" href={buildYandexMapsUrl(location)} target="_blank" rel="noreferrer">Маршрут</a><a className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-3 text-center text-sm font-black text-slate-900 active:scale-95" href={buildTwoGisUrl(location)} target="_blank" rel="noreferrer">Открыть в 2ГИС</a></div>
  </article>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-100 p-3"><div className="text-base font-black text-slate-950">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div></div>; }
function formatDistance(value: number): string { return value < 10 ? value.toFixed(1) : String(Math.round(value)); }
function formatDeviation(value?: number | null): string { if (value == null) return "—"; return value < 1 ? `${Math.round(value * 1000)} м` : `${value.toFixed(1)} км`; }
function relativeTime(value: string | null): string { if (!value) return "Неизвестно"; const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 60 ? `${minutes} мин назад` : `${Math.round(minutes / 60)} ч назад`; }
