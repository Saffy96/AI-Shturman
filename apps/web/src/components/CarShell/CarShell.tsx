import type { ReactNode } from "react";
import { Header } from "./Header";

interface CarShellProps {
  map: ReactNode;
  routePanel?: ReactNode;
  editorPanel?: ReactNode;
  filterDock?: ReactNode;
  mapControls?: ReactNode;
  stationPanel?: ReactNode;
  noticePanel?: ReactNode;
  onOpenSettings: () => void;
  online: boolean;
  gpsReady: boolean;
  accuracy?: number;
  routeActive?: boolean;
}

export function CarShell({
  map,
  routePanel,
  editorPanel,
  filterDock,
  mapControls,
  stationPanel,
  noticePanel,
  onOpenSettings,
  online,
  gpsReady,
  accuracy,
  routeActive
}: CarShellProps) {
  return (
    <div className="app-shell">
      <div className="map-layer">{map}</div>
      <Header online={online} gpsReady={gpsReady} accuracy={accuracy} routeActive={routeActive} onOpenSettings={onOpenSettings} />

      {routePanel ? <div className="route-summary-overlay">{routePanel}</div> : null}
      {editorPanel ? <aside className="route-editor-overlay">{editorPanel}</aside> : null}
      {noticePanel ? <div className="notice-overlay">{noticePanel}</div> : null}
      {mapControls ? <div className="map-control-overlay">{mapControls}</div> : null}
      {filterDock ? <div className="fuel-filter-overlay">{filterDock}</div> : null}
      {stationPanel}
    </div>
  );
}
