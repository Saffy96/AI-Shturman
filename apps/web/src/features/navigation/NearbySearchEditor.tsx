import { useState, type FormEvent } from "react";
import type { Coordinates } from "../../types/fuel";

interface Props {
  locationLabel: string;
  sourceLabel: string;
  locating: boolean;
  loading: boolean;
  onRequestLocation: () => void;
  onOpenMap: () => void;
  onUseKazan: () => void;
  onManualLocation: (coords: Coordinates) => void;
}

export function NearbySearchEditor({ locationLabel, sourceLabel, locating, loading, onRequestLocation, onOpenMap, onUseKazan, onManualLocation }: Props) {
  const [manualOpen, setManualOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextLat = Number(lat.replace(",", "."));
    const nextLon = Number(lon.replace(",", "."));
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon) || nextLat < -90 || nextLat > 90 || nextLon < -180 || nextLon > 180) {
      setError("Введите корректные координаты.");
      return;
    }
    setError(null);
    onManualLocation({ lat: nextLat, lon: nextLon });
    setManualOpen(false);
  }

  return (
    <div className="nearby-editor">
      <div className="location-readout"><span>Текущая точка</span><strong>{locationLabel}</strong><small>{sourceLabel}</small></div>
      <div className="nearby-editor__actions">
        <button type="button" onClick={onRequestLocation} disabled={locating || loading}>{locating ? "Определяем…" : "Моё местоположение"}</button>
        <button type="button" onClick={onOpenMap}>Выбрать на карте</button>
        <button type="button" onClick={onUseKazan}>Казань</button>
      </div>
      <button type="button" className="manual-location-toggle" onClick={() => setManualOpen((value) => !value)}>Ввести координаты вручную</button>
      {manualOpen ? <form className="manual-location-form" onSubmit={submit}>
        <input aria-label="Широта" inputMode="decimal" placeholder="55.796127" value={lat} onChange={(event) => setLat(event.target.value)} />
        <input aria-label="Долгота" inputMode="decimal" placeholder="49.106414" value={lon} onChange={(event) => setLon(event.target.value)} />
        <button type="submit">Применить</button>
        {error ? <div role="alert">{error}</div> : null}
      </form> : null}
    </div>
  );
}
