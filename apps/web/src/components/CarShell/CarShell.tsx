import type { ReactNode } from "react";
import { Mic } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Header } from "./Header";

export function CarShell({ map, children, drivePanel, online, gpsReady, accuracy }: { map: ReactNode; children: ReactNode; drivePanel?: ReactNode; online: boolean; gpsReady: boolean; accuracy?: number }) {
  return <div className="relative h-[100dvh] overflow-hidden bg-[#05070b] text-white"><div className="absolute inset-0">{map}</div><Header online={online} gpsReady={gpsReady} accuracy={accuracy} /><button className="pointer-events-auto absolute bottom-24 left-4 z-30 flex min-h-14 items-center gap-2 rounded-full border border-white/10 bg-[#10151d]/90 px-5 font-black shadow-2xl backdrop-blur-xl active:scale-90 md:bottom-6 md:left-6"><Mic size={22} className="text-[#00e676]" /> Штурман</button><BottomSheet summary={drivePanel}>{children}</BottomSheet></div>;
}
