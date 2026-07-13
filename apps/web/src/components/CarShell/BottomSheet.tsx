import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export type BottomSheetSnapPoint = "collapsed" | "half" | "expanded";
const storageKey = "ai-shturman:bottomSheet";

export function BottomSheet({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  const [snapPoint, setSnapPoint] = useState<BottomSheetSnapPoint>(() => normalizeSnapPoint(window.localStorage.getItem(storageKey)));
  const dragStart = useRef<number | null>(null);

  useEffect(() => { window.localStorage.setItem(storageKey, snapPoint); }, [snapPoint]);
  useEffect(() => {
    const open = () => setSnapPoint("expanded");
    window.addEventListener("ai-shturman:open-station", open);
    return () => window.removeEventListener("ai-shturman:open-station", open);
  }, []);

  function startDrag(event: PointerEvent<HTMLDivElement>) { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current == null) return;
    const distance = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(distance) < 35) return;
    setSnapPoint((current) => distance < 0 ? nextSnap(current) : previousSnap(current));
  }

  return <section data-snap={snapPoint} className="station-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-[28px] border border-white/[.08] bg-[#10151d]/95 text-white shadow-[0_-25px_80px_rgba(0,0,0,.55)] backdrop-blur-xl md:bottom-5 md:left-auto md:right-5 md:w-[410px] md:rounded-[28px]">
    <div className="sticky top-0 z-10 touch-none select-none bg-[#10151d]/95 px-3 pb-2 pt-2 sm:px-4 sm:pb-3" onPointerDown={startDrag} onPointerUp={endDrag}>
      <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/25" />
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">{summary}</div>
        <SheetButton label={snapPoint === "expanded" ? "Свернуть до половины" : "Развернуть панель"} onClick={() => setSnapPoint(snapPoint === "expanded" ? "half" : "expanded")}>{snapPoint === "expanded" ? <ChevronDown /> : <ChevronUp />}</SheetButton>
        <SheetButton label={snapPoint === "collapsed" ? "Открыть панель" : "Свернуть панель"} onClick={() => setSnapPoint(snapPoint === "collapsed" ? "half" : "collapsed")}><ChevronDown /></SheetButton>
      </div>
    </div>
    {snapPoint !== "collapsed" ? <div className="h-[calc(100%-74px)] overflow-y-auto overscroll-contain px-3 pb-[calc(20px+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">{children}</div> : null}
  </section>;
}

function SheetButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.08] active:scale-90 sm:h-11 sm:w-11" onClick={onClick} aria-label={label}>{children}</button>; }
function normalizeSnapPoint(value: string | null): BottomSheetSnapPoint { return value === "collapsed" || value === "expanded" || value === "half" ? value : "half"; }
function nextSnap(value: BottomSheetSnapPoint): BottomSheetSnapPoint { return value === "collapsed" ? "half" : "expanded"; }
function previousSnap(value: BottomSheetSnapPoint): BottomSheetSnapPoint { return value === "expanded" ? "half" : "collapsed"; }
