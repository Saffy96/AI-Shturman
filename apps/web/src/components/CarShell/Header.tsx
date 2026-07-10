import { Clock3, Gauge, MapPin, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function Header({ online, gpsReady, accuracy }: { online: boolean; gpsReady: boolean; accuracy?: number }) {
  const [time, setTime] = useState(() => currentTime());
  useEffect(() => { const timer = window.setInterval(() => setTime(currentTime()), 30_000); return () => window.clearInterval(timer); }, []);
  return <header className="pointer-events-auto absolute inset-x-2 top-[calc(env(safe-area-inset-top)+6px)] z-40 flex min-h-14 items-center justify-between rounded-2xl border border-white/[.08] bg-[#10151d]/90 px-3 text-white shadow-2xl backdrop-blur-2xl sm:inset-x-3 sm:min-h-16 sm:px-4 md:inset-x-6 md:top-5">
    <div className="min-w-0"><div className="truncate text-sm font-black tracking-wide sm:text-base">AI Штурман</div><div className="hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#8a94a6] sm:block">Automotive intelligence</div></div>
    <div className="flex items-center gap-3 text-xs font-bold md:gap-5">
      <Status icon={<MapPin size={15} />} active={gpsReady} text={gpsReady ? `GPS${accuracy ? ` · ${Math.round(accuracy)} м` : ""}` : "GPS"} />
      <Status icon={online ? <Wifi size={15} /> : <WifiOff size={15} />} active={online} text={online ? "Онлайн" : "Офлайн"} />
      <span className="hidden items-center gap-1 text-[#8a94a6] sm:flex"><Gauge size={15} /> 23°</span>
      <span className="flex shrink-0 items-center gap-1 text-sm text-white sm:text-base"><Clock3 size={15} /> {time}</span>
    </div>
  </header>;
}
function Status({ icon, active, text }: { icon: React.ReactNode; active: boolean; text: string }) { return <span className="hidden items-center gap-1.5 sm:flex">{icon}<i className={`h-2 w-2 rounded-full ${active ? "bg-[#00e676] shadow-[0_0_12px_#00e676]" : "bg-[#ff5252]"}`} /><span className="text-[#8a94a6]">{text}</span></span>; }
function currentTime(): string { return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
