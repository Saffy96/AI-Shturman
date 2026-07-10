import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type SheetState = "closed" | "half" | "full";
export function BottomSheet({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  const [state, setState] = useState<SheetState>("half");
  useEffect(() => { const open = () => setState("full"); window.addEventListener("ai-shturman:open-station", open); return () => window.removeEventListener("ai-shturman:open-station", open); }, []);
  const heights = { closed: "calc(68px + env(safe-area-inset-bottom))", half: "min(48dvh, 450px)", full: "calc(100dvh - env(safe-area-inset-top) - 78px)" };
  return <motion.section animate={{ height: heights[state] }} transition={{ type: "spring", damping: 30, stiffness: 280 }} className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-[28px] border border-white/[.08] bg-[#10151d]/95 text-white shadow-[0_-25px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl md:bottom-5 md:left-auto md:right-5 md:w-[430px] md:rounded-[30px]">
    <div className="sticky top-0 z-10 bg-[#10151d]/95 px-3 pb-2 pt-2 backdrop-blur-xl sm:px-4 sm:pb-3"><div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/20" /><div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><div className="min-w-0 flex-1 overflow-hidden">{summary}</div><SheetButton label="Развернуть панель" onClick={() => setState(state === "full" ? "half" : "full")}>{state === "full" ? <ChevronDown /> : <ChevronUp />}</SheetButton><SheetButton label="Свернуть панель" onClick={() => setState(state === "closed" ? "half" : "closed")}><ChevronDown /></SheetButton></div></div>
    <AnimatePresence>{state !== "closed" ? <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-[calc(100%-74px)] overflow-y-auto overscroll-contain px-3 pb-[calc(20px+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">{children}</motion.div> : null}</AnimatePresence>
  </motion.section>;
}
function SheetButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.08] active:scale-90 sm:h-11 sm:w-11" onClick={onClick} aria-label={label}>{children}</button>; }
