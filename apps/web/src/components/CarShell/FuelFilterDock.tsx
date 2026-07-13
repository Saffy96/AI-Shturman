import { Filter, RefreshCw, Search } from "lucide-react";
import type { FuelType, SearchMode, StationFilters } from "../../types/fuel";
import { FiltersPanel } from "../FiltersPanel";

interface Props {
  fuel: FuelType;
  fuels: readonly FuelType[];
  filters: StationFilters;
  mode: SearchMode;
  distanceKm: number;
  distanceOptions: readonly number[];
  resultCount: number;
  loading: boolean;
  canSearch: boolean;
  onFuelChange: (fuel: FuelType) => void;
  onFiltersChange: (filters: StationFilters) => void;
  onDistanceChange: (value: number) => void;
  onSearch: () => void;
  onRefresh: () => void;
}

export function FuelFilterDock({ fuel, fuels, filters, mode, distanceKm, distanceOptions, resultCount, loading, canSearch, onFuelChange, onFiltersChange, onDistanceChange, onSearch, onRefresh }: Props) {
  return (
    <div className="fuel-dock glass-panel">
      <div className="fuel-dock__row" aria-label="Выбор топлива">
        {fuels.map((item) => (
          <button key={item} type="button" aria-pressed={fuel === item} className="fuel-pill" onClick={() => onFuelChange(item)}>
            {item === "ДТ" ? item : `АИ-${item}`}
          </button>
        ))}
      </div>
      <div className="fuel-dock__tools">
        <label className="dock-select">
          <Filter size={15} />
          <span className="sr-only">{mode === "route" ? "Ширина коридора" : "Радиус поиска"}</span>
          <select value={distanceKm} onChange={(event) => onDistanceChange(Number(event.target.value))}>
            {distanceOptions.map((value) => <option key={value} value={value}>{value} км</option>)}
          </select>
        </label>
        <span className="result-counter">{resultCount} АЗС</span>
        <button type="button" className="dock-action dock-action--primary" disabled={!canSearch || loading} onClick={onSearch}>
          <Search size={17} /> <span>{loading ? "Ищем…" : "Найти"}</span>
        </button>
        <button type="button" className="dock-action" disabled={!canSearch || loading} onClick={onRefresh} aria-label="Обновить данные">
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <details className="filter-popover">
        <summary>Дополнительные фильтры</summary>
        <FiltersPanel filters={filters} onChange={onFiltersChange} />
      </details>
    </div>
  );
}
