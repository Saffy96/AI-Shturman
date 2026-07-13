import { Clock3, MapPin, Settings2, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function Header({ online, gpsReady, accuracy, routeActive }: { online: boolean; gpsReady: boolean; accuracy?: number; routeActive?: boolean }) {
  const [time, setTime] = useState(() => currentTime());
  useEffect(() => { const timer = window.setInterval(() => setTime(currentTime()), 30_000); return () => window.clearInterval(timer); }, []);
  return <header className="pointer-events-auto absolute inset-x-2 top-[calc(env(safe-area-inset-top)+6px)] z-40 flex min-h-14 items-center justify-between rounded-2xl border border-white/[.08] bg-[#10151d]/90 px-3 text-white shadow-2xl backdrop-blur-2xl sm:inset-x-3 sm:min-h-16 sm:px-4 md:inset-x-6 md:top-5">
    <div className="min-w-0"><div className="truncate text-sm font-black tracking-wide sm:text-base">AI Штурман</div><div className="hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#8a94a6] sm:block">Automotive intelligence</div></div>
    <div className="flex items-center gap-3 text-xs font-bold md:gap-5">
      <Status icon={<MapPin size={15} />} active={gpsReady} text={gpsReady ? `GPS${accuracy ? ` · ${Math.round(accuracy)} м` : ""}` : "GPS"} />
      <Status icon={online ? <Wifi size={15} /> : <WifiOff size={15} />} active={online} text={online ? "Онлайн" : "Офлайн"} />
      <span className={`hidden rounded-full px-2.5 py-1 sm:inline ${routeActive ? "bg-[#00e676]/15 text-[#00e676]" : "bg-white/[.06] text-[#8a94a6]"}`}>{routeActive ? "Маршрут активен" : "Без маршрута"}</span>
      <span className="flex shrink-0 items-center gap-1 text-sm text-white sm:text-base"><Clock3 size={15} /> {time}</span>
      <button type="button" aria-label="Открыть настройки" onClick={() => window.dispatchEvent(new Event("ai-shturman:open-station"))} className="grid h-9 w-9 place-items-center rounded-full bg-white/[.07] text-[#8a94a6] active:scale-95"><Settings2 size={17} /></button>
    </div>
  </header>;
}
function Status({ icon, active, text }: { icon: React.ReactNode; active: boolean; text: string }) { return <span className="hidden items-center gap-1.5 sm:flex">{icon}<i className={`h-2 w-2 rounded-full ${active ? "bg-[#00e676] shadow-[0_0_12px_#00e676]" : "bg-[#ff5252]"}`} /><span className="text-[#8a94a6]">{text}</span></span>; }
function currentTime(): string { return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
