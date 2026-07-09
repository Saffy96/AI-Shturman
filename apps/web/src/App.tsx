import { buildNavigatorAdvice } from "@ai-shturman/shared";
import { FormEvent, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { NavigatorAdviceCard } from "./components/NavigatorAdviceCard";
import { RouteForm } from "./components/RouteForm";
import { StationCard } from "./components/StationCard";
import { SummaryCard } from "./components/SummaryCard";
import { GeolocationRequestError, useGeolocation } from "./hooks/useGeolocation";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { FuelApiError, fetchNearbyFuel } from "./services/fuelApi";
import type { Coordinates, FuelType, NearbyFuelResponse } from "./types/fuel";

const radiusOptions = [20, 50, 100] as const;
const fuelOptions: FuelType[] = ["92", "95", "98", "100", "ДТ"];
const kazanLocation: Coordinates = {
  lat: 55.796127,
  lon: 49.106414
};

type LocationSource = "browser" | "kazan" | "manual";

interface SelectedLocation {
  coords: Coordinates;
  source: LocationSource;
}

const locationSourceLabels: Record<LocationSource, string> = {
  browser: "GPS / браузер",
  kazan: "Казань по умолчанию",
  manual: "Введено вручную"
};

export function App() {
  const [from, setFrom] = useState("Казань");
  const [to, setTo] = useState("Таймурзино");
  const [radiusKm, setRadiusKm] = useState<(typeof radiusOptions)[number]>(50);
  const [fuel, setFuel] = useState<FuelType>("95");
  const [data, setData] = useState<NearbyFuelResponse | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isAdviceVisible, setIsAdviceVisible] = useState(false);

  const geolocation = useGeolocation();
  const isOnline = useNetworkStatus();

  const locationLabel = useMemo(() => {
    if (!selectedLocation) {
      return "Геопозиция не получена";
    }

    return `${selectedLocation.coords.lat.toFixed(6)}, ${selectedLocation.coords.lon.toFixed(6)}`;
  }, [selectedLocation]);

  const sourceLabel = selectedLocation ? locationSourceLabels[selectedLocation.source] : "Не выбран";
  const canRequestStations = Boolean(selectedLocation);
  const navigatorAdvice = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildNavigatorAdvice(data.stations, fuel);
  }, [data, fuel]);

  async function handleLocationRequest() {
    setError(null);
    setManualError(null);

    try {
      const location = await geolocation.requestLocation();
      applyLocation(location, "browser");
    } catch (requestError) {
      setError(getReadableError(requestError, isOnline));
    }
  }

  function handleUseKazan() {
    setManualError(null);
    setError(null);
    applyLocation(kazanLocation, "kazan");
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lat = Number(manualLat.replace(",", "."));
    const lon = Number(manualLon.replace(",", "."));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setManualError("Введите числовые координаты.");
      return;
    }

    if (lat < -90 || lat > 90) {
      setManualError("Latitude должен быть от -90 до 90.");
      return;
    }

    if (lon < -180 || lon > 180) {
      setManualError("Longitude должен быть от -180 до 180.");
      return;
    }

    setManualError(null);
    setError(null);
    applyLocation({ lat, lon }, "manual");
  }

  async function handleCheckStations() {
    await runFuelCheck();
  }

  async function handleRefresh() {
    await runFuelCheck();
  }

  async function runFuelCheck() {
    setError(null);

    if (!selectedLocation) {
      setError("Сначала получите геопозицию или выберите fallback.");
      return;
    }

    if (!isOnline) {
      setError("Нет интернета. Проверьте связь и попробуйте снова.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchNearbyFuel({
        lat: selectedLocation.coords.lat,
        lon: selectedLocation.coords.lon,
        radiusKm,
        fuel
      });

      setData(response);
      setIsAdviceVisible(true);
    } catch (requestError) {
      setError(getReadableError(requestError, isOnline));
    } finally {
      setIsLoading(false);
    }
  }

  function applyLocation(coords: Coordinates, source: LocationSource) {
    setSelectedLocation({ coords, source });
    setData(null);
    setIsAdviceVisible(false);
  }

  return (
    <div className="min-h-screen pb-[calc(24px+env(safe-area-inset-bottom))]">
      <Header />

      <main className="mx-auto grid max-w-xl gap-4 px-4">
        {!isOnline ? <Notice tone="danger" text="Нет интернета. Данные можно обновить после восстановления связи." /> : null}

        <RouteForm from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

        <section className="rounded-2xl border border-road-100 bg-white p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">Радиус</span>
              <select
                className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-black text-slate-950 outline-none focus:border-road-500 focus:bg-white"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value) as (typeof radiusOptions)[number])}
              >
                {radiusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} км
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">Топливо</span>
              <select
                className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-black text-slate-950 outline-none focus:border-road-500 focus:bg-white"
                value={fuel}
                onChange={(event) => setFuel(event.target.value as FuelType)}
              >
                {fuelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl bg-road-50 px-4 py-3">
            <div className="text-xs font-black uppercase text-road-600">Текущая позиция</div>
            <div className="mt-1 text-base font-black text-road-900">{locationLabel}</div>
            <div className="mt-1 text-sm font-bold text-slate-600">Источник: {sourceLabel}</div>
          </div>

          {!canRequestStations ? (
            <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
              Сначала получите геопозицию или выберите fallback.
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            <button
              className="min-h-14 rounded-xl bg-slate-950 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleLocationRequest}
              disabled={geolocation.isLocating || isLoading}
            >
              📍 {geolocation.isLocating ? "Получаем..." : "Получить геопозицию"}
            </button>

            <button
              className="min-h-14 rounded-xl bg-road-500 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleCheckStations}
              disabled={!canRequestStations || geolocation.isLocating || isLoading}
            >
              ⛽ {isLoading ? "Проверяем..." : "Проверить АЗС"}
            </button>

            <button
              className="min-h-14 rounded-xl bg-fuel-500 px-4 text-lg font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleRefresh}
              disabled={!canRequestStations || geolocation.isLocating || isLoading}
            >
              🔄 Обновить
            </button>
          </div>
        </section>

        {!selectedLocation ? (
          <FallbackLocationCard
            isManualFormOpen={isManualFormOpen}
            manualLat={manualLat}
            manualLon={manualLon}
            manualError={manualError}
            isLocating={geolocation.isLocating}
            isLoading={isLoading}
            onUseKazan={handleUseKazan}
            onManualToggle={() => setIsManualFormOpen((value) => !value)}
            onManualLatChange={setManualLat}
            onManualLonChange={setManualLon}
            onManualSubmit={handleManualSubmit}
            onRetry={handleLocationRequest}
          />
        ) : null}

        {error ? <Notice tone="danger" text={error} /> : null}

        {isLoading ? <LoadingState /> : null}

        {data ? <SummaryCard summary={data.summary} fuel={fuel} /> : null}

        {data ? (
          <button
            className="min-h-14 rounded-2xl bg-slate-950 px-4 text-lg font-black text-white shadow-soft transition active:scale-[0.98]"
            type="button"
            onClick={() => setIsAdviceVisible(true)}
          >
            🤖 Совет штурмана
          </button>
        ) : null}

        {navigatorAdvice && isAdviceVisible ? <NavigatorAdviceCard advice={navigatorAdvice} /> : null}

        {data && data.stations.length === 0 && !isLoading ? <EmptyState /> : null}

        {data && data.stations.length > 0 ? (
          <section className="grid gap-3">
            {data.stations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function FallbackLocationCard({
  isManualFormOpen,
  manualLat,
  manualLon,
  manualError,
  isLocating,
  isLoading,
  onUseKazan,
  onManualToggle,
  onManualLatChange,
  onManualLonChange,
  onManualSubmit,
  onRetry
}: {
  isManualFormOpen: boolean;
  manualLat: string;
  manualLon: string;
  manualError: string | null;
  isLocating: boolean;
  isLoading: boolean;
  onUseKazan: () => void;
  onManualToggle: () => void;
  onManualLatChange: (value: string) => void;
  onManualLonChange: (value: string) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
      <div className="text-lg font-black text-amber-950">Не удалось определить местоположение.</div>
      <div className="mt-1 text-base font-bold text-amber-900">Можно продолжить вручную.</div>

      <div className="mt-4 grid gap-2">
        <button
          className="min-h-12 rounded-xl bg-road-500 px-4 text-base font-black text-white transition active:scale-[0.98]"
          type="button"
          onClick={onUseKazan}
        >
          📍 Использовать Казань
        </button>

        <button
          className="min-h-12 rounded-xl bg-white px-4 text-base font-black text-slate-950 transition active:scale-[0.98]"
          type="button"
          onClick={onManualToggle}
        >
          ✍️ Ввести координаты вручную
        </button>

        <button
          className="min-h-12 rounded-xl bg-slate-950 px-4 text-base font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRetry}
          disabled={isLocating || isLoading}
        >
          🔄 Попробовать ещё раз
        </button>
      </div>

      {isManualFormOpen ? (
        <form className="mt-4 grid gap-3 rounded-xl bg-white p-3" onSubmit={onManualSubmit}>
          <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">Latitude</span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
              inputMode="decimal"
              placeholder="55.796127"
              value={manualLat}
              onChange={(event) => onManualLatChange(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-slate-700">Longitude</span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-road-500 focus:bg-white"
              inputMode="decimal"
              placeholder="49.106414"
              value={manualLon}
              onChange={(event) => onManualLonChange(event.target.value)}
            />
          </label>

          {manualError ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-950">{manualError}</div> : null}

          <button
            className="min-h-12 rounded-xl bg-fuel-500 px-4 text-base font-black text-white transition active:scale-[0.98]"
            type="submit"
          >
            Применить координаты
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Notice({ text, tone }: { text: string; tone: "danger" | "neutral" }) {
  const className =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : "border-slate-200 bg-white text-slate-800";

  return <div className={`rounded-2xl border p-4 text-base font-bold shadow-soft ${className}`}>{text}</div>;
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-road-100 bg-white p-5 text-center shadow-soft">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-road-100 border-t-road-500" />
      <div className="mt-3 text-lg font-black text-road-900">Ищем АЗС рядом</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-soft">
      <div className="text-3xl">⛽</div>
      <div className="mt-2 text-lg font-black text-slate-950">АЗС не найдены</div>
      <div className="mt-1 text-base font-semibold text-slate-600">Попробуйте увеличить радиус поиска.</div>
    </div>
  );
}

function getReadableError(error: unknown, isOnline: boolean): string {
  if (!isOnline) {
    return "Нет интернета. Проверьте связь и попробуйте снова.";
  }

  if (error instanceof GeolocationRequestError) {
    return error.message;
  }

  if (error instanceof FuelApiError) {
    if (error.kind === "timeout") {
      return "Backend не ответил вовремя. Попробуйте обновить.";
    }

    if (error.kind === "bad-response") {
      return "Backend вернул неожиданный ответ.";
    }

    return "Backend недоступен. Проверьте, что apps/api запущен на localhost:4000.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте ещё раз.";
}
