import type { StationFilters } from "../types/fuel";

interface FiltersPanelProps {
  filters: StationFilters;
  onChange: (filters: StationFilters) => void;
}

export function FiltersPanel({ filters, onChange }: FiltersPanelProps) {
  return (
    <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
      <div className="mb-3 text-lg font-black text-slate-950">Фильтры</div>

      <div className="grid gap-3 min-[430px]:grid-cols-2">
        <FilterSelect
          label="Наличие"
          value={filters.availability}
          options={[
            ["all", "Все"],
            ["withFuel", "Только где есть топливо"],
            ["withSelectedFuel", "Только выбранное топливо"],
            ["excludeNoFuel", "Исключить нет топлива"]
          ]}
          onChange={(availability) => onChange({ ...filters, availability })}
        />

        <FilterSelect
          label="Очередь"
          value={filters.queue}
          options={[
            ["all", "Все"],
            ["withoutQueue", "Без очереди"],
            ["onlyQueue", "Только с очередью"]
          ]}
          onChange={(queue) => onChange({ ...filters, queue })}
        />

        <FilterSelect
          label="Свежесть"
          value={filters.freshness}
          options={[
            ["all", "Все"],
            ["fresh", "Только свежие"],
            ["freshOrMedium", "Свежие и средние"],
            ["hideOld", "Скрыть устаревшие"]
          ]}
          onChange={(freshness) => onChange({ ...filters, freshness })}
        />

        <FilterSelect
          label="Статус"
          value={filters.status}
          options={[
            ["all", "Все"],
            ["yes", "yes"],
            ["low", "low"],
            ["no", "no"],
            ["unknown", "unknown"]
          ]}
          onChange={(status) => onChange({ ...filters, status })}
        />

        <FilterSelect
          label="Отклонение"
          value={filters.deviation}
          options={[["all", "Любое"], ["max2", "Не более 2 км"]]}
          onChange={(deviation) => onChange({ ...filters, deviation })}
        />
      </div>
    </section>
  );
}

function FilterSelect<TValue extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: TValue;
  options: Array<[TValue, string]>;
  onChange: (value: TValue) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-black text-slate-950 outline-none focus:border-road-500 focus:bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
