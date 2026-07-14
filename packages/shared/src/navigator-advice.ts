import { hasRequestedFuel } from "./normalization.js";
import type { NormalizedFuelStation } from "./station.js";

export type NavigatorAdviceLevel = "good" | "warning" | "danger" | "unknown";

export interface NavigatorAdvice {
  level: NavigatorAdviceLevel;
  title: string;
  message: string;
  stationId?: string;
}

interface StationCandidate {
  station: NormalizedFuelStation;
  hasSelectedFuel: boolean;
}

export function buildNavigatorAdvice(
  stations: NormalizedFuelStation[],
  selectedFuel: string
): NavigatorAdvice {
  if (stations.length === 0 || stations.every((station) => station.status === "unknown")) {
    return {
      level: "unknown",
      title: "Данных мало",
      message: "По выбранному радиусу данных мало. Проверь карту вручную и не рассчитывай на последнюю АЗС."
    };
  }

  const candidates = stations
    .map((station) => ({
      station,
      hasSelectedFuel: hasRequestedFuel(station.fuels, selectedFuel)
    }))
    .sort(compareCandidates);

  const fuelCandidates = candidates.filter((candidate) => candidate.hasSelectedFuel);

  if (fuelCandidates.length === 0) {
    return {
      level: "danger",
      title: "Надежных АЗС не найдено",
      message: `В выбранном радиусе надежных АЗС с ${selectedFuel} не найдено. Лучше заправиться заранее или увеличить радиус.`
    };
  }

  const goodCandidate = fuelCandidates.find(
    ({ station }) =>
      station.status === "yes" &&
      !station.hasQueue &&
      (station.freshnessLabel === "свежие данные" || station.freshnessLabel === "средняя свежесть")
  );

  if (goodCandidate) {
    const station = goodCandidate.station;

    return {
      level: "good",
      title: "Можно заехать",
      message: `Ближайшая подходящая АЗС с ${selectedFuel} — ${getStationTitle(station)} через ${formatDistance(
        getPrimaryDistance(station)
      )} км. Очередь не отмечена. Данные: ${station.freshnessLabel}. Рекомендация: можно заехать.`,
      stationId: station.id
    };
  }

  const queueCandidate = fuelCandidates.find(({ station }) => station.hasQueue);

  if (queueCandidate) {
    const station = queueCandidate.station;

    return {
      level: "warning",
      title: "Есть очередь",
      message: `АЗС с ${selectedFuel} найдена, но есть отметка об очереди. Ближайшая: ${getStationTitle(
        station
      )}, ${formatDistance(getPrimaryDistance(station))} км. Лучше посмотреть альтернативы.`,
      stationId: station.id
    };
  }

  const lowCandidate = fuelCandidates.find(({ station }) => station.status === "low");

  if (lowCandidate) {
    return {
      level: "warning",
      title: "Топлива мало",
      message: `В радиусе есть АЗС с ${selectedFuel}, но статус нестабильный / топлива мало. Лучше не тянуть до последнего.`,
      stationId: lowCandidate.station.id
    };
  }

  return {
    level: "unknown",
    title: "Данных мало",
    message: "По выбранному радиусу данных мало. Проверь карту вручную и не рассчитывай на последнюю АЗС.",
    stationId: fuelCandidates[0]?.station.id
  };
}

function compareCandidates(left: StationCandidate, right: StationCandidate): number {
  return (
    compareNumber(right.station.hoseRating ?? 0, left.station.hoseRating ?? 0) ||
    compareBoolean(right.hasSelectedFuel, left.hasSelectedFuel) ||
    compareBoolean(right.station.status === "yes", left.station.status === "yes") ||
    compareBoolean(!right.station.hasQueue, !left.station.hasQueue) ||
    compareBoolean(
      right.station.freshnessLabel === "свежие данные",
      left.station.freshnessLabel === "свежие данные"
    ) ||
    compareNumber(getConfidence(right.station), getConfidence(left.station)) ||
    compareNumber(getPrimaryDistance(left.station), getPrimaryDistance(right.station))
  );
}

function compareBoolean(left: boolean, right: boolean): number {
  return Number(left) - Number(right);
}

function compareNumber(left: number, right: number): number {
  return left - right;
}

function getConfidence(station: NormalizedFuelStation): number {
  return station.confidence ?? -1;
}

function getPrimaryDistance(station: NormalizedFuelStation): number {
  return station.distanceFromStartKm ?? station.distanceKm ?? Number.POSITIVE_INFINITY;
}

function getStationTitle(station: NormalizedFuelStation): string {
  return station.brand || station.name || station.address || "АЗС";
}

function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) {
    return "неизвестно";
  }

  if (distanceKm < 10) {
    return distanceKm.toFixed(1);
  }

  return String(Math.round(distanceKm));
}
