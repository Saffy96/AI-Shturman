import type { FuelSummary, FuelType } from "../types/fuel";

interface SummaryCardProps {
  summary: FuelSummary;
  fuel: FuelType;
}

export function SummaryCard({ summary, fuel }: SummaryCardProps) {
  const items = [
    { label: "Всего", value: summary.total },
    { label: `${fuel} есть`, value: summary.withRequestedFuel },
    { label: "Очередь", value: summary.withQueue },
    { label: "Нет топлива", value: summary.withoutFuel },
    { label: "Нет данных", value: summary.unknown }
  ];

  return (
    <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
      <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-road-50 px-3 py-3 text-center">
            <div className="text-2xl font-black text-road-900">{item.value}</div>
            <div className="mt-1 text-xs font-bold uppercase text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
