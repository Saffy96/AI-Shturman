import type { StationFilters } from "../types/fuel";

export function FiltersPanel({ filters, onChange }: { filters: StationFilters; onChange: (filters: StationFilters) => void }) {
  return <section className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/80 p-2 shadow-lg backdrop-blur-xl">
    <div className="flex min-w-max gap-2">
      <Chip active={filters.availability === "withSelectedFuel"} onClick={() => onChange({ ...filters, availability: filters.availability === "withSelectedFuel" ? "all" : "withSelectedFuel" })}>⛽ Выбранное топливо</Chip>
      <Chip active={filters.availability === "withFuel"} onClick={() => onChange({ ...filters, availability: filters.availability === "withFuel" ? "all" : "withFuel" })}>✓ В наличии</Chip>
      <Chip active={filters.queue === "withoutQueue"} onClick={() => onChange({ ...filters, queue: filters.queue === "withoutQueue" ? "all" : "withoutQueue" })}>◷ Без очереди</Chip>
      <Chip active={filters.freshness === "fresh"} onClick={() => onChange({ ...filters, freshness: filters.freshness === "fresh" ? "all" : "fresh" })}>● Свежие</Chip>
      <Chip active={filters.deviation === "max2"} onClick={() => onChange({ ...filters, deviation: filters.deviation === "max2" ? "all" : "max2" })}>↗ До 2 км</Chip>
    </div>
  </section>;
}
function Chip({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 rounded-full px-4 text-sm font-black transition active:scale-95 ${active ? "bg-slate-950 text-white shadow-lg" : "bg-slate-100 text-slate-700"}`}>{children}</button>; }
