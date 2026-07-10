import { Fuel, History } from "lucide-react";
import { useEffect, useState } from "react";
import type { FuelStation } from "../types/fuel";
import { FuelStationCard } from "./FuelStationCard";

interface Report { stationId: string; station: string; kind: "fuel" | "queue"; createdAt: string; }
export function NextStations({ stations }: { stations: FuelStation[] }) {
  const [reports, setReports] = useState<Report[]>(readReports);
  useEffect(() => { const update = () => setReports(readReports()); window.addEventListener("ai-shturman:reports-updated", update); return () => window.removeEventListener("ai-shturman:reports-updated", update); }, []);
  return <section className="grid gap-3 rounded-[28px] border border-white/[.08] bg-[#10151d]/90 p-3 text-white"><div className="flex items-center justify-between px-1"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#8a94a6]">По маршруту</div><h2 className="mt-1 text-xl font-black">Следующие заправки</h2></div><div className="flex gap-2 rounded-full bg-white/[.08] px-3 py-2 font-black"><Fuel size={17} className="text-[#00e676]" />{stations.length}</div></div>{stations.map((station, index) => <FuelStationCard key={station.id} station={station} index={index} />)}{reports.length ? <details className="rounded-2xl bg-white/[.06] p-3"><summary className="flex cursor-pointer gap-2 font-black"><History size={17} />История отметок ({reports.length})</summary><div className="mt-3 grid gap-2">{reports.slice(0, 10).map((item) => <div key={item.createdAt} className="rounded-xl bg-black/20 p-2 text-xs text-[#8a94a6]"><b className="text-white">{item.station}</b> · {item.kind === "fuel" ? "топливо подтверждено" : "отмечена очередь"}<br />{new Date(item.createdAt).toLocaleString("ru-RU")}</div>)}</div></details> : null}</section>;
}
function readReports(): Report[] { try { return JSON.parse(window.localStorage.getItem("ai-shturman:stationReports") || "[]") as Report[]; } catch { return []; } }
