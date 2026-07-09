import type { NavigatorAdvice } from "@ai-shturman/shared";

interface NavigatorAdviceCardProps {
  advice: NavigatorAdvice;
}

const levelStyles: Record<NavigatorAdvice["level"], string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-rose-200 bg-rose-50 text-rose-950",
  unknown: "border-slate-200 bg-slate-50 text-slate-900"
};

const levelMarkers: Record<NavigatorAdvice["level"], string> = {
  good: "Можно",
  warning: "Проверь",
  danger: "Риск",
  unknown: "Неясно"
};

export function NavigatorAdviceCard({ advice }: NavigatorAdviceCardProps) {
  return (
    <section className={`rounded-2xl border p-4 shadow-soft ${levelStyles[advice.level]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">🤖</div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase opacity-75">{levelMarkers[advice.level]}</div>
          <h2 className="mt-1 text-xl font-black">{advice.title}</h2>
          <p className="mt-2 text-base font-bold leading-snug">{advice.message}</p>
        </div>
      </div>
    </section>
  );
}
