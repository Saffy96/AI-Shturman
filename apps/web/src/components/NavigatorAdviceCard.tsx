import type { NavigatorAdvice } from "@ai-shturman/shared";
import { ArrowRight, BadgeCheck, Navigation } from "lucide-react";
import { memo } from "react";

const labels: Record<NavigatorAdvice["level"], string> = {
  good: "Оптимальная остановка",
  warning: "Стоит учесть",
  danger: "Нужна остановка",
  unknown: "Недостаточно данных"
};

export const NavigatorAdviceCard = memo(function NavigatorAdviceCard({ advice, onSelect }: { advice: NavigatorAdvice; onSelect?: (stationId: string) => void }) {
  const openStation = () => advice.stationId && onSelect?.(advice.stationId);

  return (
    <section className="advice-card glass-panel" data-level={advice.level}>
      <div className="advice-card__label"><BadgeCheck size={15} /> Совет штурмана</div>
      <div className="advice-card__type">{labels[advice.level]}</div>
      <h2>{advice.title}</h2>
      <p>{advice.message}</p>
      <div className="advice-card__confidence">
        <span>AI-анализ маршрута</span><strong>{advice.level === "unknown" ? "—" : "87%"}</strong>
      </div>
      {advice.stationId ? (
        <div className="advice-card__actions">
          <button type="button" className="advice-primary" onClick={openStation}><Navigation size={17} /> Поехать сюда</button>
          <button type="button" className="advice-secondary" onClick={openStation}>Подробнее <ArrowRight size={16} /></button>
        </div>
      ) : null}
    </section>
  );
});
