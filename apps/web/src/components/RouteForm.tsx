interface RouteFormProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function RouteForm({ from, to, onFromChange, onToChange }: RouteFormProps) {
  return (
    <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-bold text-slate-700">Откуда</span>
          <input
            className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            autoComplete="address-level2"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-bold text-slate-700">Куда</span>
          <input
            className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            autoComplete="address-level2"
          />
        </label>
      </div>
    </section>
  );
}
