import { Fuel, Navigation } from "lucide-react";
import type { FuelStation, RouteFuelResponse } from "../../types/fuel";
import { formatDuration } from "../RouteSummary";

export function DrivePanel({ route, next }: { route?: RouteFuelResponse | null; next?: FuelStation | null }) {
  if (!route?.route) return <div><div className="text-xs font-black uppercase tracking-wider text-[#8a94a6]">Маршрут</div><div className="font-black">Выберите направление</div></div>;
  return <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#00e676] text-[#05070b]"><Navigation size={22} fill="currentColor" /></div><div className="min-w-0 flex-1"><div className="truncate font-black">{route.from.name} → {route.to.name}</div><div className="text-xs font-bold text-[#8a94a6]">🚗 В пути · {Math.round(route.route.distanceKm)} км · {formatDuration(route.route.durationMin)}</div>{next ? <div className="mt-1 truncate text-xs font-bold text-[#00e676]"><Fuel size={12} className="mr-1 inline" />{next.brand || next.name || "АЗС"} через {Math.round(next.distanceFromStartKm ?? next.distanceKm ?? 0)} км</div> : null}</div></div>;
}
