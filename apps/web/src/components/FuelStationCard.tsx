import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Fuel,
  Info,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Users
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { fetchStationDetails, submitStationReport } from "../services/fuelApi";
import type { FuelStation, StationDetails } from "../types/fuel";
import { buildTwoGisUrl, buildYandexMapsUrl } from "../utils/maps";

interface Props {
  station: FuelStation;
  selected?: boolean;
  onShowOnMap?: (station: FuelStation) => void;
}

export const FuelStationCard = memo(function FuelStationCard({ station, selected = false, onShowOnMap }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<StationDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetails = useCallback(async (forceRefresh = false) => {
    if ((!forceRefresh && details) || loading) return;
    const osmId = station.id.startsWith("osm:") ? station.id.slice(4) : station.id;
    setLoading(true);
    setDetailsError(null);
    try {
      const response = await fetchStationDetails(osmId, forceRefresh);
      setDetails(response.station);
    } catch {
      setDetailsError("Не удалось загрузить свежие данные.");
    } finally {
      setLoading(false);
    }
  }, [details, loading, station.id]);

  useEffect(() => {
    if (!selected) return;
    setExpanded(true);
    void loadDetails();
  }, [selected]);

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

  return (
    <article
      id={`station-${station.id}`}
      className={`group scroll-mt-40 overflow-hidden rounded-[26px] border bg-[#0b1017] text-white shadow-[0_24px_60px_rgba(0,0,0,.28)] ${selected ? "border-cyan-400/70 ring-2 ring-cyan-400/20" : "border-white/[.10]"}`}
    >
      <div className="relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/[.10] blur-3xl" />

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
          {details?.limit.active ? <span className="rounded-full bg-orange-400/15 px-3 py-1.5 text-xs font-black text-orange-300">Лимит: {formatLimit(details)}</span> : null}
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

        <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickMetric icon={<Fuel size={13} />} label="Рейтинг «Шланга»" value={`${station.hoseRating}/100`} />
          <QuickMetric icon={<Clock size={13} />} label="Обновлено" value={relativeTime(updatedAt)} />
          <QuickMetric icon={<CheckCircle size={13} />} label="Уверенность" value={confidence == null ? "—" : `${Math.round(confidence)}%`} />
          <QuickMetric icon={<Navigation size={13} />} label="Отклонение" value={formatDeviation(station.distanceFromRouteKm)} />
        </div>

        <div className="relative mt-2 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.07] px-3 py-2 text-xs font-black text-cyan-200">
          AI Recommendation: {station.recommendation}
        </div>

        <div className="relative mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="button" onClick={() => onShowOnMap?.(station)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 text-sm font-black text-cyan-950 active:scale-[.98]"><LocateFixed size={17} /> На карте</button>
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 text-center text-sm font-black text-emerald-950 transition hover:bg-emerald-300 active:scale-[.98]" href={buildYandexMapsUrl(location)} target="_blank" rel="noreferrer"><Navigation size={17} /> Маршрут</a>
          <a aria-label="Открыть в 2ГИС" className="grid min-h-12 w-12 place-items-center rounded-2xl bg-white/[.08] text-slate-200 transition hover:bg-white/[.13] active:scale-[.98]" href={buildTwoGisUrl(location)} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>
        </div>
      </div>

      <button type="button" onClick={toggleDetails} className="flex min-h-12 w-full items-center justify-between border-t border-white/[.07] bg-white/[.025] px-4 text-left text-xs font-black text-slate-300 transition hover:bg-white/[.055]">
        <span className="inline-flex items-center gap-2"><Info size={15} className="text-emerald-400" /> Отметки, очередь и лимиты</span>
        <ChevronDown size={17} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded ? (
        <div className="border-t border-white/[.07] bg-[#080c12] p-4">
          {loading && !details ? <DetailsSkeleton /> : details ? <StationDetailsPanel station={station} details={details} loading={loading} onRefresh={() => void loadDetails(true)} /> : detailsError ? <button type="button" onClick={() => void loadDetails()} className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-bold text-red-200">{detailsError} Нажмите, чтобы повторить</button> : null}
        </div>
      ) : null}
    </article>
  );
});

function StationDetailsPanel({ station, details, loading, onRefresh }: { station: FuelStation; details: StationDetails; loading: boolean; onRefresh: () => void }) {
  const [showAllActivities, setShowAllActivities] = useState(false);
  const visibleActivities = showAllActivities ? details.activities : details.activities.slice(0, 5);
  const activityGroups = groupActivitiesByDate(visibleActivities);

  return (
    <div className="grid gap-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Данные станции</div>
        <button type="button" disabled={loading} onClick={onRefresh} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/[.06] px-3 text-xs font-black text-slate-300 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Evidence value={details.confirmationsFresh} label="свежих" />
        <Evidence value={details.confirmations} label="подтверждений" />
        <Evidence value={details.activities.length} label="отметок в списке" />
      </div>

      {details.queue.present || details.limit.active ? (
        <div className="grid gap-2">
          {details.queue.present ? <Notice icon={<Users size={16} />} title="Есть очередь" text={[details.queue.vehicleRange ? `${details.queue.vehicleRange} машин` : null, details.queue.confirmations != null ? `${details.queue.confirmations} подтвержд.` : null].filter(Boolean).join(" · ")} tone="amber" /> : null}
          {details.limit.active ? <Notice icon={<AlertTriangle size={16} />} title={`Лимит: ${formatLimit(details)}`} text={details.limit.confirmations != null ? `${details.limit.confirmations} подтвержд.` : "Размер лимита пока не подтверждён"} tone="orange" /> : null}
        </div>
      ) : null}

      {details.detail ? <div className="rounded-2xl bg-white/[.05] p-3 font-semibold leading-relaxed text-slate-300">{details.detail}</div> : null}

      {details.activities.length ? (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Последние отметки</h3>
          <div className="mt-2 grid gap-3">
            {activityGroups.map((group) => (
              <div key={group.key}>
                {showAllActivities ? <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600">{group.title}</div> : null}
                <div className="grid gap-2">
                  {group.items.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border border-white/[.06] bg-white/[.035] p-3">
                      <div className="font-bold text-slate-200">{activity.text || activityTypeText(activity.type)}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                        <span>{formatActivityTime(activity.createdAtMs, activity.createdAt)}</span>
                        {activity.fuelTypes.map((fuel) => <span key={fuel} className="rounded-full bg-white/[.06] px-2 py-0.5">{fuelLabel(fuel)}</span>)}
                        {activity.wasOnSite ? <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">был на месте</span> : null}
                        {activity.authorReliable ? <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-sky-300">проверенный автор</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {details.activities.length > 5 ? (
            <button type="button" onClick={() => setShowAllActivities((value) => !value)} className="mt-3 min-h-10 w-full rounded-xl bg-white/[.06] px-3 text-xs font-black text-emerald-300">
              {showAllActivities ? "Свернуть" : `Показать все ${details.activities.length} отметок`}
            </button>
          ) : null}
        </section>
      ) : null}

      {import.meta.env.DEV && details.activityDiagnostics ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-2 text-[10px] font-semibold text-slate-500">
          comments: {details.activityDiagnostics.comments} · recent: {details.activityDiagnostics.recent} · после объединения: {details.activityDiagnostics.merged} · после дедупликации: {details.activityDiagnostics.deduplicated}
          {details.activityDiagnostics.commentsError ? <div className="text-amber-500">comments error: {details.activityDiagnostics.commentsError}</div> : null}
          {details.activityDiagnostics.recentError ? <div className="text-amber-500">recent error: {details.activityDiagnostics.recentError}</div> : null}
        </div>
      ) : null}

      <StationReportForm station={station} details={details} onSubmitted={onRefresh} />

      <div className="border-t border-white/[.07] pt-3 text-[10px] font-semibold leading-relaxed text-slate-600">По отметкам водителей. Данные не являются официальной информацией сети АЗС.</div>
    </div>
  );
}

function StationReportForm({ station, details, onSubmitted }: { station: FuelStation; details: StationDetails; onSubmitted: () => void }) {
  const grades = ["92", "95", "98", "100", "ДТ"] as const;
  const initialGrades = grades.filter((grade) => [...station.fuels, ...details.fuels].some((fuel) => normalizeFuelKey(fuel) === grade));
  const [availability, setAvailability] = useState<"yes" | "no">("yes");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(initialGrades);
  const [hasQueue, setHasQueue] = useState(false);
  const [limitLiters, setLimitLiters] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function toggleGrade(grade: string) {
    setSelectedGrades((current) => current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (availability === "yes" && selectedGrades.length === 0) {
      setResult({ tone: "error", text: "Выберите хотя бы одну марку топлива." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const osmId = station.id.startsWith("osm:") ? station.id.slice(4) : station.id;
      await submitStationReport(osmId, {
        stationName: station.brand || station.name || "АЗС",
        lat: station.lat,
        lon: station.lon,
        availability,
        fuelTypes: availability === "yes" ? selectedGrades : [],
        limitLiters: availability === "yes" && limitLiters ? Number(limitLiters) : null,
        hasQueue: availability === "yes" && hasQueue
      });
      setResult({ tone: "success", text: "Отметка передана в ГдеБЕНЗ. Спасибо, что помогаете водителям!" });
      onSubmitted();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Не удалось отправить отметку." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-3">
      <div className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Добавить отметку в ГдеБЕНЗ</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ChoiceButton active={availability === "yes"} onClick={() => setAvailability("yes")} label="Топливо есть" />
        <ChoiceButton active={availability === "no"} onClick={() => setAvailability("no")} label="Топлива нет" />
      </div>
      {availability === "yes" ? (
        <div className="mt-3 grid gap-3">
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Марка топлива</legend>
            <div className="flex flex-wrap gap-2">
              {grades.map((grade) => <ChoiceButton key={grade} active={selectedGrades.includes(grade)} onClick={() => toggleGrade(grade)} label={fuelLabel(grade)} compact />)}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton active={hasQueue} onClick={() => setHasQueue((value) => !value)} label="Есть очередь" />
            <label className="rounded-xl bg-white/[.05] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
              Лимит, литров
              <input value={limitLiters} onChange={(event) => setLimitLiters(event.target.value)} type="number" min="1" max="500" inputMode="numeric" placeholder="Нет" className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-slate-600" />
            </label>
          </div>
        </div>
      ) : null}
      {result ? <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${result.tone === "success" ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>{result.text}</div> : null}
      <button type="submit" disabled={submitting} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-400 px-4 text-sm font-black text-emerald-950 disabled:opacity-50">
        {submitting ? "Отправляем…" : "Отправить отметку"}
      </button>
      <div className="mt-2 text-[9px] font-semibold leading-relaxed text-slate-500">Анонимная пользовательская отметка. ГдеБЕНЗ не проверяет её и показывает как мнение водителя.</div>
    </form>
  );
}

function ChoiceButton({ active, onClick, label, compact = false }: { active: boolean; onClick: () => void; label: string; compact?: boolean }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`${compact ? "min-h-9 px-3" : "min-h-11 px-2"} rounded-xl text-xs font-black transition ${active ? "bg-emerald-400 text-emerald-950" : "bg-white/[.06] text-slate-300 hover:bg-white/[.10]"}`}>{active ? "✓ " : ""}{label}</button>;
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
function formatLimit(details: StationDetails): string { return details.limit.liters == null ? "размер не указан" : `${details.limit.liters.toLocaleString("ru-RU")} л`; }
function formatDistance(value: number): string { return value < 10 ? value.toFixed(1) : String(Math.round(value)); }
function formatDeviation(value?: number | null): string { if (value == null) return "—"; return value < 1 ? `${Math.round(value * 1000)} м` : `${value.toFixed(1)} км`; }
function relativeTime(value: string | null): string { if (!value) return "нет данных"; const timestamp = new Date(value).getTime(); if (!Number.isFinite(timestamp)) return "время неизвестно"; const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000)); return minutes < 60 ? `${minutes} мин назад` : minutes < 1_440 ? `${Math.round(minutes / 60)} ч назад` : `${Math.round(minutes / 1_440)} дн назад`; }
function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "время неизвестно"; }
type Activity = StationDetails["activities"][number];
interface ActivityGroup { key: string; title: string; items: Activity[]; }

function groupActivitiesByDate(activities: Activity[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  const today = startOfLocalDay(Date.now());
  const yesterday = today - 86_400_000;
  for (const activity of activities) {
    const timestamp = activity.createdAtMs;
    let key = "unknown";
    let title = "Время неизвестно";
    if (Number.isFinite(timestamp)) {
      const day = startOfLocalDay(timestamp);
      key = new Date(day).toISOString();
      title = day === today ? "Сегодня" : day === yesterday ? "Вчера" : new Date(timestamp).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
    const group = groups.get(key) ?? { key, title, items: [] };
    group.items.push(activity);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatActivityTime(timestamp: number, fallback: string): string {
  if (!Number.isFinite(timestamp)) return "время неизвестно";
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes} мин назад`;
  if (ageMinutes < 24 * 60) return `${Math.round(ageMinutes / 60)} ч назад`;
  return formatDate(fallback || new Date(timestamp).toISOString());
}

function activityTypeText(type: Activity["type"]): string {
  return type === "fuel_available" ? "Топливо есть" : type === "fuel_unavailable" ? "Топлива нет" : type === "queue" ? "Есть очередь" : type === "limit" ? "Действует лимит" : type === "station_closed" ? "АЗС закрыта" : type === "station_open" ? "АЗС открыта" : type === "price" ? "Обновлена цена" : "Отметка водителя";
}
function statusTone(status: FuelStation["status"]): string { return status === "yes" ? "bg-emerald-400/15 text-emerald-300" : status === "low" ? "bg-orange-400/15 text-orange-300" : status === "queue" ? "bg-amber-400/15 text-amber-300" : status === "no" ? "bg-red-400/15 text-red-300" : "bg-slate-400/10 text-slate-400"; }
