import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { FuelStation } from "../../types/fuel";

interface Props {
  station: FuelStation | null;
  children: ReactNode;
  onClose: () => void;
}

export function StationDetailsDrawer({ station, children, onClose }: Props) {
  const [sheetState, setSheetState] = useState<"collapsed" | "half" | "expanded">("half");

  useEffect(() => {
    if (!station) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, station]);

  if (!station) return null;

  return (
    <aside className="station-drawer" data-sheet-state={sheetState} aria-label="Детали выбранной АЗС">
      <div className="station-drawer__mobile-handle" aria-hidden="true" />
      <header className="station-drawer__header">
        <div className="min-w-0">
          <div className="station-drawer__eyebrow">Выбранная АЗС</div>
          <div className="station-drawer__title">{station.brand || station.name || "АЗС"}</div>
        </div>
        <div className="station-drawer__sheet-actions">
          <button type="button" onClick={() => setSheetState(sheetState === "expanded" ? "half" : "expanded")} className="drawer-icon-button mobile-only" aria-label={sheetState === "expanded" ? "Уменьшить панель" : "Развернуть панель"}>{sheetState === "expanded" ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
          <button type="button" onClick={onClose} className="drawer-icon-button" aria-label="Закрыть детали АЗС"><X size={19} /></button>
        </div>
      </header>
      <div className="station-drawer__content">{children}</div>
    </aside>
  );
}
