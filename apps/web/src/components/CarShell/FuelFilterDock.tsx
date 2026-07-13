import { Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect } from "react";
import type { FuelType, SearchMode, StationFilters } from "../../types/fuel";
import { FiltersPanel } from "../FiltersPanel";

interface Props {
  fuel: FuelType;
  fuels: readonly FuelType[];
  filters: StationFilters;
  filtersOpen: boolean;
  mode: SearchMode;
  distanceKm: number;
  distanceOptions: readonly number[];
  resultCount: number;
  loading: boolean;
  canSearch: boolean;
  onFuelChange: (fuel: FuelType) => void;
  onFiltersChange: (filters: StationFilters) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onDistanceChange: (value: number) => void;
  onSearch: () => void;
  onRefresh: () => void;
}

export function FuelFilterDock({ fuel, fuels, filters, filtersOpen, mode, distanceKm, distanceOptions, resultCount, loading, canSearch, onFuelChange, onFiltersChange, onFiltersOpenChange, onDistanceChange, onSearch, onRefresh }: Props) {
  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onFiltersOpenChange(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen, onFiltersOpenChange]);

  return (
    <div className="fuel-dock glass-panel">
      {filtersOpen ? <div className="filter-popover-panel glass-panel">
        <div className="filter-popover-panel__header"><div><span>Настройки выдачи</span><strong>Дополнительные фильтры</strong></div><button type="button" onClick={() => onFiltersOpenChange(false)} aria-label="Закрыть фильтры"><X size={18} /></button></div>
        <FiltersPanel filters={filters} onChange={onFiltersChange} />
      </div> : null}
      <div className="fuel-dock__row" aria-label="Интересующее топливо">
        {fuels.map((item) => {
          const label = item === "all" ? "Все" : item === "ДТ" ? item : `АИ-${item}`;
          return <button key={item} type="button" aria-pressed={fuel === item} title={item === "all" ? "Показать все марки топлива" : `${label}: показать подтверждённые и ещё не уточнённые АЗС`} className="fuel-pill" onClick={() => onFuelChange(item)}>{label}</button>;
        })}
      </div>
      <div className="fuel-dock__tools">
        <label className="dock-select"><Filter size={15} /><span className="sr-only">{mode === "route" ? "Ширина коридора" : "Радиус поиска"}</span><select value={distanceKm} onChange={(event) => onDistanceChange(Number(event.target.value))}>{distanceOptions.map((value) => <option key={value} value={value}>{value} км</option>)}</select></label>
        <span className="result-counter">{resultCount} АЗС</span>
        <button type="button" className="dock-action dock-action--filters" aria-label="Дополнительные фильтры" aria-expanded={filtersOpen} onClick={() => onFiltersOpenChange(!filtersOpen)}><SlidersHorizontal size={18} /></button>
        <button type="button" className="dock-action dock-action--primary" disabled={!canSearch || loading} onClick={onSearch}><Search size={17} /><span>{loading ? "Ищем…" : "Найти"}</span></button>
        <button type="button" className="dock-action" disabled={!canSearch || loading} onClick={onRefresh} aria-label="Обновить данные"><RefreshCw size={17} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </div>
  );
}
