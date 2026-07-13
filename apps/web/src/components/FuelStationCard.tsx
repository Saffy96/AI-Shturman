import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { fetchStationDetails } from "../services/fuelApi";
import type { FuelStation, StationDetails } from "../types/fuel";
import { StationCard } from "./StationCard";

interface Props { station: FuelStation; index?: number; recommended?: boolean; }

export function FuelStationCard({ station, index = 0, recommended = false }: Props) {
  const [expanded, setExpanded] = useState(recommended);
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
      setDetailsError("Не удалось загрузить свежую карточку ГдеБЕНЗ.");
    } finally {
      setLoading(false);
    }
  }, [details, loading, station.id]);

  useEffect(() => {
    if (recommended) void loadDetails();
  }, [loadDetails, recommended]);

  function toggleDetails() {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadDetails();
  }

  function report(kind: "fuel" | "queue") {
    const key = "ai-shturman:stationReports";
    const history = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown[];
    history.unshift({ stationId: station.id, station: station.brand || station.name || "АЗС", kind, createdAt: new Date().toISOString() });
    window.localStorage.setItem(key, JSON.stringify(history.slice(0, 100)));
    window.dispatchEvent(new Event("ai-shturman:reports-updated"));
  }

  return <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
    <StationCard station={station} />
    <div className="-mt-5 grid grid-cols-2 gap-2 rounded-b-[28px] bg-[#10151d] p-3 pt-7 text-white">
      <div className="col-span-2 rounded-xl bg-white/[.06] p-3 text-sm"><b>Цена остановки:</b> {station.stopCost.totalRub == null ? `${station.stopCost.deviationKm.toFixed(1)} км · ${station.stopCost.extraTimeMin} мин · ${station.stopCost.fuelLiters} л` : `≈ ${station.stopCost.totalRub} ₽`}<br /><span className="text-xs text-[#8a94a6]">Отчётов: {station.reports} · очередь {station.queue.estimatedMinutes == null ? "неизвестна" : `≈ ${station.queue.estimatedMinutes} мин`}</span></div>
      <button type="button" onClick={toggleDetails} className="col-span-2 min-h-12 rounded-xl bg-white/[.10] text-sm font-black">{expanded ? "Скрыть данные водителей" : "Подробнее по данным водителей"}</button>
      {expanded ? <div className="col-span-2">{loading ? <div className="rounded-xl bg-white/[.06] p-3 text-sm text-[#8a94a6]">Загружаем полную карточку…</div> : details ? <StationDetailsPanel details={details} /> : detailsError ? <button type="button" onClick={() => void loadDetails()} className="w-full rounded-xl bg-red-500/15 p-3 text-sm font-bold text-red-200">{detailsError} Повторить</button> : null}</div> : null}
      <button type="button" onClick={() => report("fuel")} className="min-h-12 rounded-xl bg-emerald-500/20 text-sm font-black text-emerald-300">Топливо есть</button>
      <button type="button" onClick={() => report("queue")} className="min-h-12 rounded-xl bg-amber-500/20 text-sm font-black text-amber-300">Есть очередь</button>
    </div>
  </motion.div>;
}

function StationDetailsPanel({ details }: { details: StationDetails }) {
  const prices = Object.entries(details.prices);
  return <section className="grid gap-3 rounded-xl bg-white/[.06] p-3 text-sm">
    <div><div className="font-black text-white">{details.statusLabel}</div><div className="mt-1 text-xs text-[#8a94a6]">Уверенность: {details.confidencePercent == null ? "—" : `${Math.round(details.confidencePercent)}%`} · свежих подтверждений: {details.confirmationsFresh ?? "—"} · всего подтверждений: {details.confirmations ?? "—"} · отметок: {details.realCount ?? "—"}</div></div>
    <div><b>Топливо:</b> {details.fuels.length ? details.fuels.join(", ") : details.status === "yes" ? "подтверждено, марки неизвестны" : "марки неизвестны"}</div>
    {details.queue.present ? <div className="rounded-lg bg-amber-500/15 p-2 text-amber-100"><b>Очередь активна</b>{details.queue.vehicleRange ? ` · ${details.queue.vehicleRange} машин` : ""}{details.queue.confirmations != null ? ` · подтверждений: ${details.queue.confirmations}` : ""}</div> : null}
    {details.limit.active ? <div className="rounded-lg bg-orange-500/15 p-2 text-orange-100"><b>Действует лимит</b>{details.limit.liters != null ? ` · ${details.limit.liters} л` : ""}{details.limit.confirmations != null ? ` · подтверждений: ${details.limit.confirmations}` : ""}</div> : null}
    {prices.length ? <div><b>Цены:</b><div className="mt-1 grid gap-1">{prices.map(([fuel, price]) => <div key={fuel} className="rounded-lg bg-black/20 px-2 py-1">{fuel}: {price.price == null ? "—" : `${price.price} ₽`} · подтверждений {price.confirmations ?? "—"} · {formatDate(price.updatedAt)}</div>)}</div></div> : null}
    <div><b>Обновлено:</b> {formatDate(details.updatedAt)}</div>
    {details.detail ? <div className="rounded-lg bg-black/20 p-2">{details.detail}</div> : null}
    {details.recentReports.length ? <div><b>Последние отметки:</b><div className="mt-1 grid gap-2">{details.recentReports.map((report, index) => <div key={`${report.createdAt}-${index}`} className="rounded-lg bg-black/20 p-2"><span className="font-bold text-white">{report.detail || statusText(report.status)}</span><div className="mt-1 text-xs text-[#8a94a6]">{formatDate(report.createdAt)}{report.onSite ? " · пользователь был на месте" : ""}{report.authorReliable ? " · достоверный автор" : ""}{report.edited ? " · изменено" : ""}</div></div>)}</div></div> : null}
    <div className="border-t border-white/10 pt-2 text-xs text-[#8a94a6]"><b className="text-white">{details.sourceLabel}</b><br />Пользовательские отметки, не официальные данные сети АЗС.</div>
  </section>;
}

function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString("ru-RU") : "время неизвестно"; }
function statusText(status: StationDetails["status"]): string { return status === "yes" ? "Топливо есть" : status === "low" ? "Топливо заканчивается" : status === "queue" ? "Есть очередь" : status === "no" ? "Топлива нет / АЗС не работает" : "Нет данных"; }
