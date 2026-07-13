import { Clock3, LocateFixed, Settings2, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export function Header({ online, gpsReady, accuracy, routeActive }: { online: boolean; gpsReady: boolean; accuracy?: number; routeActive?: boolean }) {
  const [time, setTime] = useState(() => currentTime());
  useEffect(() => { const timer = window.setInterval(() => setTime(currentTime()), 30_000); return () => window.clearInterval(timer); }, []);

  return (
    <header className="top-navigation glass-panel">
      <div className="product-mark"><span className="product-mark__icon">A</span><div><strong>AI Штурман</strong><small>умная навигация</small></div></div>
      <div className="top-navigation__status">
        <Status icon={<LocateFixed size={15} />} active={gpsReady} text={gpsReady ? `GPS${accuracy ? ` · ${Math.round(accuracy)} м` : ""}` : "GPS"} />
        <Status icon={online ? <Wifi size={15} /> : <WifiOff size={15} />} active={online} text={online ? "Онлайн" : "Офлайн"} />
        <span className={`route-state ${routeActive ? "route-state--active" : ""}`}>{routeActive ? "Маршрут активен" : "Без маршрута"}</span>
        <span className="top-clock"><Clock3 size={15} /> {time}</span>
        <button type="button" aria-label="Открыть настройки поиска" onClick={() => window.dispatchEvent(new Event("ai-shturman:edit-search"))} className="top-icon-button"><Settings2 size={17} /></button>
      </div>
    </header>
  );
}

function Status({ icon, active, text }: { icon: ReactNode; active: boolean; text: string }) {
  return <span className="system-status">{icon}<i data-active={active} /><span>{text}</span></span>;
}

function currentTime(): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}
