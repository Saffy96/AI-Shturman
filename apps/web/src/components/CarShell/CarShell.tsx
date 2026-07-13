import type { ReactNode } from "react";
import { Header } from "./Header";

interface CarShellProps {
  map: ReactNode;
  routePanel?: ReactNode;
  advicePanel?: ReactNode;
  editorPanel?: ReactNode;
  filterDock?: ReactNode;
  mapControls?: ReactNode;
  stationPanel?: ReactNode;
  noticePanel?: ReactNode;
  children?: ReactNode;
  online: boolean;
  gpsReady: boolean;
  accuracy?: number;
  routeActive?: boolean;
}

export function CarShell({
  map,
  routePanel,
  advicePanel,
  editorPanel,
  filterDock,
  mapControls,
  stationPanel,
  noticePanel,
  children,
  online,
  gpsReady,
  accuracy,
  routeActive
}: CarShellProps) {
  return (
    <div className="app-shell">
      <div className="map-layer">{map}</div>
      <Header online={online} gpsReady={gpsReady} accuracy={accuracy} routeActive={routeActive} />

      {routePanel ? <div className="route-summary-overlay">{routePanel}</div> : null}
      {advicePanel ? <aside className="smart-advice-overlay">{advicePanel}</aside> : null}
      {editorPanel ? <aside className="route-editor-overlay">{editorPanel}</aside> : null}
      {noticePanel ? <div className="notice-overlay">{noticePanel}</div> : null}
      {mapControls ? <div className="map-control-overlay">{mapControls}</div> : null}
      {filterDock ? <div className="fuel-filter-overlay">{filterDock}</div> : null}
      {stationPanel}
      {children}
    </div>
  );
}
