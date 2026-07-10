import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type SheetState = "closed" | "half" | "full";
export function BottomSheet({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  const [state, setState] = useState<SheetState>("half");
  useEffect(() => {
    const open = () => setState("full");
    window.addEventListener("ai-shturman:open-station", open);
    return () => window.removeEventListener("ai-shturman:open-station", open);
  }, []);
  const heights = { closed: 74, half: "46vh", full: "calc(100dvh - 92px)" };
  return <motion.section animate={{ height: heights[state] }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-[30px] border border-white/[.08] bg-[#10151d]/95 text-white shadow-[0_-25px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl md:bottom-5 md:left-auto md:right-5 md:w-[430px] md:rounded-[30px]">
    <div className="sticky top-0 z-10 bg-[#10151d]/90 px-4 pb-3 pt-2 backdrop-blur-xl"><div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/20" /><div className="flex items-center gap-2">{summary ? <div className="min-w-0 flex-1">{summary}</div> : null}<button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[.08] active:scale-90" onClick={() => setState(state === "full" ? "half" : "full")} aria-label="Изменить размер панели">{state === "full" ? <ChevronDown /> : <ChevronUp />}</button><button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[.08] active:scale-90" onClick={() => setState(state === "closed" ? "half" : "closed")} aria-label="Свернуть панель"><ChevronDown /></button></div></div>
    <AnimatePresence>{state !== "closed" ? <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-[calc(100%-78px)] overflow-y-auto px-3 pb-[calc(20px+env(safe-area-inset-bottom))]">{children}</motion.div> : null}</AnimatePresence>
  </motion.section>;
}
