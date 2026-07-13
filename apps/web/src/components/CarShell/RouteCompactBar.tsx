import { ArrowRightLeft, Pencil, Route, X } from "lucide-react";

export function RouteCompactBar({ from, to, distanceKm, duration, onEdit, onSwap, onCancel }: { from: string; to: string; distanceKm: number; duration: string; onEdit: () => void; onSwap: () => void; onCancel: () => void }) {
  return <section className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/[.08] bg-[#10151d]/90 px-3 py-2 text-white shadow-2xl backdrop-blur-xl">
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00e676] text-[#07110c]"><Route size={18} /></div>
    <div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{from} <span className="text-[#00e676]">→</span> {to}</div><div className="text-[11px] font-bold text-[#8a94a6]">{duration} · {Math.round(distanceKm)} км</div></div>
    <Action label="Изменить маршрут" onClick={onEdit}><Pencil size={16} /></Action>
    <Action label="Поменять точки местами" onClick={onSwap}><ArrowRightLeft size={16} /></Action>
    <Action label="Отменить маршрут" onClick={onCancel}><X size={17} /></Action>
  </section>;
}
function Action({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[.08] text-slate-300 active:scale-95">{children}</button>; }
