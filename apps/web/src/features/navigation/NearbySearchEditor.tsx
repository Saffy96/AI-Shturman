import { useState } from "react";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";
import type { GeoSearchResult } from "../../types/fuel";

interface Props {
  locationLabel: string;
  sourceLabel: string;
  locating: boolean;
  loading: boolean;
  onRequestLocation: () => void;
  onOpenMap: () => void;
  onUseKazan: () => void;
  onAddressSelect: (result: GeoSearchResult) => void;
}

export function NearbySearchEditor({ locationLabel, sourceLabel, locating, loading, onRequestLocation, onOpenMap, onUseKazan, onAddressSelect }: Props) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="nearby-editor">
      <div className="location-readout"><span>Текущая точка</span><strong>{locationLabel}</strong><small>{sourceLabel}</small></div>
      <div className="nearby-editor__actions">
        <button type="button" onClick={onRequestLocation} disabled={locating || loading}>{locating ? "Определяем…" : "Моё местоположение"}</button>
        <button type="button" onClick={onOpenMap}>Выбрать на карте</button>
        <button type="button" onClick={onUseKazan}>Казань</button>
      </div>
      <button type="button" className="manual-location-toggle" aria-expanded={manualOpen} onClick={() => setManualOpen((value) => !value)}>Ввести адрес вручную</button>
      {manualOpen ? <AddressAutocomplete autoFocus placeholder="Например: Казань, улица Баумана, 1" onSelect={(result) => { onAddressSelect(result); setManualOpen(false); }} /> : null}
    </div>
  );
}
