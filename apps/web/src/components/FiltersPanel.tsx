import type { ReactNode } from "react";
import { Route, Sparkles, Users } from "lucide-react";
import type { StationFilters } from "../types/fuel";

export function FiltersPanel({ filters, onChange }: { filters: StationFilters; onChange: (filters: StationFilters) => void }) {
  return (
    <section className="filters-panel" aria-label="Дополнительные фильтры">
      <Chip icon={<Users size={15} />} active={filters.queue === "withoutQueue"} onClick={() => onChange({ ...filters, queue: filters.queue === "withoutQueue" ? "all" : "withoutQueue" })}>Без очереди</Chip>
      <Chip icon={<Sparkles size={15} />} active={filters.freshness === "fresh"} onClick={() => onChange({ ...filters, freshness: filters.freshness === "fresh" ? "all" : "fresh" })}>Свежие данные</Chip>
      <Chip icon={<Route size={15} />} active={filters.deviation === "max2"} onClick={() => onChange({ ...filters, deviation: filters.deviation === "max2" ? "all" : "max2" })}>До 2 км от маршрута</Chip>
    </section>
  );
}

function Chip({ active, children, icon, onClick }: { active: boolean; children: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className="filter-chip">{icon}<span>{children}</span></button>;
}
