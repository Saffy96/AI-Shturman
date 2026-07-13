import type { ReactNode } from "react";
import { Mic } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Header } from "./Header";

export function CarShell({ map, children, drivePanel, routePanel, online, gpsReady, accuracy, routeActive }: { map: ReactNode; children: ReactNode; drivePanel?: ReactNode; routePanel?: ReactNode; online: boolean; gpsReady: boolean; accuracy?: number; routeActive?: boolean }) {
  return <div className="relative h-[100dvh] overflow-hidden bg-[#05070b] text-white"><div className="absolute inset-0">{map}</div><Header online={online} gpsReady={gpsReady} accuracy={accuracy} routeActive={routeActive} />{routePanel ? <div className="pointer-events-auto absolute inset-x-2 top-[calc(env(safe-area-inset-top)+70px)] z-30 sm:inset-x-3 md:left-6 md:right-auto md:top-24 md:w-[min(520px,calc(100vw-500px))]">{routePanel}</div> : null}<button aria-label="Открыть голосового помощника" className="pointer-events-auto absolute bottom-24 right-3 z-30 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-[#10151d]/90 shadow-2xl backdrop-blur-xl active:scale-90 md:bottom-6 md:right-[440px]"><Mic size={21} className="text-[#00e676]" /></button><BottomSheet summary={drivePanel}>{children}</BottomSheet></div>;
}
