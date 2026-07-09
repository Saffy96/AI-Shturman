import type { FuelStation } from "../types/fuel";
import { buildTwoGisUrl, buildYandexMapsUrl } from "../utils/maps";

interface StationCardProps {
  station: FuelStation;
}

const statusStyles: Record<FuelStation["status"], string> = {
  yes: "bg-emerald-100 text-emerald-900",
  low: "bg-amber-100 text-amber-950",
  no: "bg-rose-100 text-rose-900",
  unknown: "bg-slate-100 text-slate-800"
};

export function StationCard({ station }: StationCardProps) {
  const title = station.brand || station.name || "АЗС";
  const subtitle = station.brand && station.name && station.brand !== station.name ? station.name : null;
  const mapLocation = { lat: station.lat, lon: station.lon };
  const address = station.address || "Адрес не указан";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-0.5 truncate text-sm font-semibold text-slate-600">{subtitle}</p> : null}
          <p className="mt-2 text-base font-medium text-slate-700">{address}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {station.lat.toFixed(6)}, {station.lon.toFixed(6)}
          </p>
        </div>

        {station.distanceKm != null ? (
          <div className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-right text-white">
            <div className="text-lg font-black">{formatDistance(station.distanceKm)}</div>
            <div className="text-xs font-bold text-slate-300">км</div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-2 text-sm font-black ${statusStyles[station.status]}`}>
          {station.statusLabel}
        </span>
        <span className={`rounded-full px-3 py-2 text-sm font-black ${station.hasQueue ? "bg-orange-100 text-orange-900" : "bg-slate-100 text-slate-700"}`}>
          {station.queueLabel}
        </span>
        <span className="rounded-full bg-road-100 px-3 py-2 text-sm font-black text-road-900">
          {station.freshnessLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3">
        <InfoRow label="Топливо" value={station.fuels.length > 0 ? station.fuels.join(", ") : "Не указано"} />
        <InfoRow label="Рекомендация" value={station.recommendation} strong />
        {station.confidence != null ? <InfoRow label="Доверие" value={formatConfidence(station.confidence)} /> : null}
        {station.confirmations != null ? <InfoRow label="Подтверждения" value={String(station.confirmations)} /> : null}
        {station.rawDetail ? <InfoRow label="Детали" value={station.rawDetail} /> : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {/* TODO: add cached reverse geocoding later for stations without address. */}
        <a
          className="flex min-h-12 items-center justify-center rounded-xl bg-road-500 px-4 text-center text-base font-black text-white transition active:scale-[0.98]"
          href={buildYandexMapsUrl(mapLocation)}
          target="_blank"
          rel="noreferrer"
        >
          Открыть в Яндекс Картах
        </a>
        <a
          className="flex min-h-12 items-center justify-center rounded-xl bg-fuel-500 px-4 text-center text-base font-black text-white transition active:scale-[0.98]"
          href={buildTwoGisUrl(mapLocation)}
          target="_blank"
          rel="noreferrer"
        >
          Открыть в 2ГИС
        </a>
      </div>
    </article>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-black uppercase text-slate-500">{label}</div>
      <div className={strong ? "text-base font-black text-slate-950" : "text-base font-semibold text-slate-800"}>
        {value}
      </div>
    </div>
  );
}

function formatDistance(value: number): string {
  if (value < 10) {
    return value.toFixed(1);
  }

  return Math.round(value).toString();
}

function formatConfidence(value: number): string {
  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${Math.round(value)}%`;
}
