import type { NavigatorAdvice } from "@ai-shturman/shared";
import { memo } from "react";

const tones: Record<NavigatorAdvice["level"], string> = {
  good: "from-emerald-400/20 to-cyan-400/10 text-emerald-950",
  warning: "from-amber-400/25 to-orange-400/10 text-amber-950",
  danger: "from-rose-400/20 to-orange-400/10 text-rose-950",
  unknown: "from-slate-300/40 to-white/20 text-slate-900"
};

export const NavigatorAdviceCard = memo(function NavigatorAdviceCard({ advice, onSelect }: { advice: NavigatorAdvice; onSelect?: (stationId: string) => void }) {
  return <section className={`rounded-[28px] border border-white/70 bg-gradient-to-br p-4 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-xl ${tones[advice.level]}`}>
    <div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-2xl text-white shadow-lg">✦</div><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.2em] opacity-60">Smart Advice</div><h2 className="mt-1 text-xl font-black">{advice.title}</h2><p className="mt-2 text-sm font-bold leading-relaxed opacity-85">{advice.message}</p>{advice.stationId ? <a href={`#station-${advice.stationId}`} onClick={() => advice.stationId && onSelect?.(advice.stationId)} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white active:scale-95">Показать рекомендуемую АЗС →</a> : null}</div></div>
  </section>;
});
