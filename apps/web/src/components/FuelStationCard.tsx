import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Fuel,
  Info,
  MapPin,
  Navigation,
  Users
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { fetchStationDetails } from "../services/fuelApi";
import type { FuelStation, StationDetails } from "../types/fuel";
import { buildTwoGisUrl, buildYandexMapsUrl } from "../utils/maps";

interface Props {
  station: FuelStation;
  index?: number;
  recommended?: boolean;
}

export const FuelStationCard = memo(function FuelStationCard({ station, recommended = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<StationDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetails = useCallback(async () => {
    if (details || loading) return;
    const osmId = station.id.startsWith("osm:") ? station.id.slice(4) : station.id;
    setLoading(true);
    setDetailsError(null);
    try {
      const response = await fetchStationDetails(osmId);
      setDetails(response.station);
    } catch {
      setDetailsError("Не удалось загрузить свежие данные.");
    } finally {
      setLoading(false);
    }
  }, [details, loading, station.id]);

  const fuels = useMemo(() => collectFuels(station, details), [station, details]);
  const status = details?.status ?? station.status;
  const statusLabel = details?.statusLabel ?? station.statusLabel;
  const confidence = details?.confidencePercent ?? (station.confidence == null ? null : station.confidence * 100);
  const updatedAt = details?.updatedAt ?? station.lastUpdatedAt;
  const queue = details?.queue.present ?? station.hasQueue;
  const title = station.brand || station.name || "АЗС";
  const distance = station.distanceFromStartKm ?? station.distanceKm;
  const location = { lat: station.lat, lon: station.lon };

  function toggleDetails() {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadDetails();
  }

  function report(kind: "fuel" | "queue") {
    const key = "ai-shturman:stationReports";
    const history = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown[];
    history.unshift({ stationId: station.id, station: title, kind, createdAt: new Date().toISOString() });
    window.localStorage.setItem(key, JSON.stringify(history.slice(0, 100)));
    window.dispatchEvent(new Event("ai-shturman:reports-updated"));
  }

  return (
    <article
      id={`station-${station.id}`}
      className="group scroll-mt-40 overflow-hidden rounded-[26px] border border-white/[.10] bg-[#0b1017] text-white shadow-[0_24px_60px_rgba(0,0,0,.28)]"
    >
      <div className="relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/[.10] blur-3xl" />

        {recommended ? (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-emerald-950">
            <BadgeCheck size={13} /> Лучший вариант
          </div>
        ) : null}

        <header className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-emerald-950 shadow-[0_10px_30px_rgba(16,185,129,.25)]">
            <Fuel size={23} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[19px] font-black leading-tight tracking-tight">{title}</h2>
            <div className="mt-1 flex items-start gap-1 text-xs font-semibold text-slate-400">
              <MapPin className="mt-0.5 shrink-0" size={12} />
              <span className="line-clamp-2">{station.address || "Адрес не указан"}</span>
            </div>
          </div>
          {distance != null ? (
            <div className="shrink-0 text-right">
              <div className="text-[22px] font-black leading-none">{formatDistance(distance)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-500">км по пути</div>
            </div>
          ) : null}
        </header>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${statusTone(status)}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />{statusLabel}
          </span>
          {queue ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-300"><Users size={13} /> Очередь</span> : null}
          {details?.limit.active ? <span className="rounded-full bg-orange-400/15 px-3 py-1.5 text-xs font-black text-orange-300">Лимит {details.limit.liters == null ? "" : `${details.limit.liters} л`}</span> : null}
        </div>

        <section className="relative mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Топливо и цены</h3>
            {loading ? <span className="animate-pulse text-[10px] font-bold text-emerald-400">обновляем…</span> : null}
          </div>
          {fuels.length ? (
            <div className="grid grid-cols-2 gap-2">
              {fuels.map((fuel) => {
                const price = findPrice(fuel, station, details);
                return (
                  <div key={fuel} className="flex min-h-[58px] items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.045] px-3 py-2.5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{normalizeFuelKey(fuel) === "ДТ" ? "Дизель" : "Бензин"}</div>
                      <div className="mt-0.5 text-base font-black text-emerald-300">{fuelLabel(fuel)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black tabular-nums">{price == null ? "—" : formatPrice(price)}</div>
                      <div className="text-[9px] font-bold uppercase text-slate-500">₽ / литр</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[.10] bg-white/[.03] px-3 py-4 text-center text-xs font-semibold text-slate-400">
              {status === "yes" ? "Топливо подтверждено, марки и цены уточняются" : "Марки топлива и цены пока неизвестны"}
            </div>
          )}
        </section>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <QuickMetric icon={<Clock size={13} />} label="Обновлено" value={relativeTime(updatedAt)} />
          <QuickMetric icon={<CheckCircle size={13} />} label="Уверенность" value={confidence == null ? "—" : `${Math.round(confidence)}%`} />
          <QuickMetric icon={<Navigation size={13} />} label="Отклонение" value={formatDeviation(station.distanceFromRouteKm)} />
        </div>

        <div className="relative mt-3 rounded-2xl border border-emerald-400/[.12] bg-emerald-400/[.07] p-3">
          <div className="text-sm font-black text-emerald-100">{station.recommendation}</div>
          <div className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-400">Актуальность рассчитана по свежести и подтверждениям водителей.</div>
        </div>

        <div className="relative mt-3 grid grid-cols-[1fr_auto] gap-2">
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-emerald-950 transition hover:bg-emerald-300 active:scale-[.98]" href={buildYandexMapsUrl(location)} target="_blank" rel="noreferrer"><Navigation size={17} /> Построить маршрут</a>
          <a aria-label="Открыть в 2ГИС" className="grid min-h-12 w-12 place-items-center rounded-2xl bg-white/[.08] text-slate-200 transition hover:bg-white/[.13] active:scale-[.98]" href={buildTwoGisUrl(location)} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>
        </div>
      </div>

      <button type="button" onClick={toggleDetails} className="flex min-h-12 w-full items-center justify-between border-t border-white/[.07] bg-white/[.025] px-4 text-left text-xs font-black text-slate-300 transition hover:bg-white/[.055]">
        <span className="inline-flex items-center gap-2"><Info size={15} className="text-emerald-400" /> Отметки, очередь и лимиты</span>
        <ChevronDown size={17} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded ? (
        <div className="border-t border-white/[.07] bg-[#080c12] p-4">
          {loading ? <DetailsSkeleton /> : details ? <StationDetailsPanel details={details} onReport={report} /> : detailsError ? <button type="button" onClick={() => void loadDetails()} className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-bold text-red-200">{detailsError} Нажмите, чтобы повторить</button> : null}
        </div>
      ) : null}
    </article>
  );
});

function StationDetailsPanel({ details, onReport }: { details: StationDetails; onReport: (kind: "fuel" | "queue") => void }) {
  return (
    <div className="grid gap-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <Evidence value={details.confirmationsFresh} label="свежих" />
        <Evidence value={details.confirmations} label="подтверждений" />
        <Evidence value={details.realCount} label="отметок" />
      </div>

      {details.queue.present || details.limit.active ? (
        <div className="grid gap-2">
          {details.queue.present ? <Notice icon={<Users size={16} />} title="Есть очередь" text={[details.queue.vehicleRange ? `${details.queue.vehicleRange} машин` : null, details.queue.confirmations != null ? `${details.queue.confirmations} подтвержд.` : null].filter(Boolean).join(" · ")} tone="amber" /> : null}
          {details.limit.active ? <Notice icon={<AlertTriangle size={16} />} title="Действует лимит" text={[details.limit.liters != null ? `${details.limit.liters} литров` : null, details.limit.confirmations != null ? `${details.limit.confirmations} подтвержд.` : null].filter(Boolean).join(" · ")} tone="orange" /> : null}
        </div>
      ) : null}

      {details.detail ? <div className="rounded-2xl bg-white/[.05] p-3 font-semibold leading-relaxed text-slate-300">{details.detail}</div> : null}

      {details.recentReports.length ? (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Последние отметки</h3>
          <div className="mt-2 grid gap-2">
            {details.recentReports.slice(0, 6).map((report, index) => (
              <div key={`${report.createdAt}-${index}`} className="rounded-2xl border border-white/[.06] bg-white/[.035] p-3">
                <div className="font-bold text-slate-200">{report.detail || statusText(report.status)}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                  <span>{formatDate(report.createdAt)}</span>
                  {report.onSite ? <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">был на месте</span> : null}
                  {report.authorReliable ? <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-sky-300">проверенный автор</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Подтвердить обстановку</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onReport("fuel")} className="min-h-11 rounded-xl bg-emerald-400/10 text-xs font-black text-emerald-300 transition hover:bg-emerald-400/15">Топливо есть</button>
          <button type="button" onClick={() => onReport("queue")} className="min-h-11 rounded-xl bg-amber-400/10 text-xs font-black text-amber-300 transition hover:bg-amber-400/15">Есть очередь</button>
        </div>
      </div>

      <div className="border-t border-white/[.07] pt-3 text-[10px] font-semibold leading-relaxed text-slate-600">По отметкам водителей. Данные не являются официальной информацией сети АЗС.</div>
    </div>
  );
}

function QuickMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-white/[.045] px-2.5 py-2"><div className="flex items-center gap-1 text-emerald-400">{icon}<span className="truncate text-[8px] font-black uppercase tracking-wide text-slate-600">{label}</span></div><div className="mt-1 truncate text-xs font-black text-slate-200">{value}</div></div>;
}

function Evidence({ value, label }: { value: number | null; label: string }) {
  return <div className="rounded-xl bg-white/[.045] px-2 py-2.5 text-center"><div className="text-lg font-black text-white">{value ?? "—"}</div><div className="mt-0.5 truncate text-[8px] font-black uppercase tracking-wide text-slate-600">{label}</div></div>;
}

function Notice({ icon, title, text, tone }: { icon: React.ReactNode; title: string; text: string; tone: "amber" | "orange" }) {
  const colors = tone === "amber" ? "border-amber-400/15 bg-amber-400/10 text-amber-200" : "border-orange-400/15 bg-orange-400/10 text-orange-200";
  return <div className={`flex items-center gap-3 rounded-2xl border p-3 ${colors}`}><div className="shrink-0">{icon}</div><div><div className="font-black">{title}</div>{text ? <div className="mt-0.5 text-xs opacity-70">{text}</div> : null}</div></div>;
}

function DetailsSkeleton() {
  return <div className="grid animate-pulse gap-2"><div className="h-14 rounded-2xl bg-white/[.06]" /><div className="h-20 rounded-2xl bg-white/[.04]" /></div>;
}

function collectFuels(station: FuelStation, details: StationDetails | null): string[] {
  const values = [...station.fuels, ...(details?.fuels ?? []), ...Object.keys(station.prices ?? {}), ...Object.keys(details?.prices ?? {})];
  return [...new Map(values.map((fuel) => [normalizeFuelKey(fuel), fuel])).entries()]
    .filter(([key]) => Boolean(key))
    .sort(([left], [right]) => fuelOrder(left) - fuelOrder(right))
    .map(([, fuel]) => fuel);
}

function findPrice(fuel: string, station: FuelStation, details: StationDetails | null): number | null {
  const key = normalizeFuelKey(fuel);
  const detailPrice = Object.entries(details?.prices ?? {}).find(([name]) => normalizeFuelKey(name) === key)?.[1].price;
  if (detailPrice != null) return detailPrice;
  return Object.entries(station.prices ?? {}).find(([name]) => normalizeFuelKey(name) === key)?.[1] ?? null;
}

function normalizeFuelKey(value: string): string { const upper = value.toUpperCase(); return upper.includes("ДТ") || upper.includes("DIESEL") ? "ДТ" : upper.match(/100|98|95|92/)?.[0] ?? upper.trim(); }
function fuelOrder(value: string): number { return value === "92" ? 1 : value === "95" ? 2 : value === "98" ? 3 : value === "100" ? 4 : value === "ДТ" ? 5 : 99; }
function fuelLabel(value: string): string { const key = normalizeFuelKey(value); return key === "ДТ" ? "ДТ" : `АИ-${key}`; }
function formatPrice(value: number): string { return value.toLocaleString("ru-RU", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function formatDistance(value: number): string { return value < 10 ? value.toFixed(1) : String(Math.round(value)); }
function formatDeviation(value?: number | null): string { if (value == null) return "—"; return value < 1 ? `${Math.round(value * 1000)} м` : `${value.toFixed(1)} км`; }
function relativeTime(value: string | null): string { if (!value) return "нет данных"; const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 60 ? `${minutes} мин назад` : minutes < 1_440 ? `${Math.round(minutes / 60)} ч назад` : `${Math.round(minutes / 1_440)} дн назад`; }
function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "время неизвестно"; }
function statusText(status: StationDetails["status"]): string { return status === "yes" ? "Топливо есть" : status === "low" ? "Топливо заканчивается" : status === "queue" ? "Есть очередь" : status === "no" ? "Топлива нет / АЗС не работает" : "Нет данных"; }
function statusTone(status: FuelStation["status"]): string { return status === "yes" ? "bg-emerald-400/15 text-emerald-300" : status === "low" ? "bg-orange-400/15 text-orange-300" : status === "queue" ? "bg-amber-400/15 text-amber-300" : status === "no" ? "bg-red-400/15 text-red-300" : "bg-slate-400/10 text-slate-400"; }
