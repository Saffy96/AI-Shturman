import type {
  FreshnessLabel,
  GdebenzRawConflict,
  GdebenzRawStatus,
  NormalizedStationStatus
} from "./station.js";

const FUEL_ORDER = ["92", "95", "98", "100", "ДТ"];

export function normalizeStationStatus(status: GdebenzRawStatus | undefined): NormalizedStationStatus {
  if (status === "yes" || status === "low" || status === "no") {
    return status;
  }

  return "unknown";
}

export function getStatusLabel(status: NormalizedStationStatus): string {
  switch (status) {
    case "yes":
      return "Есть топливо";
    case "low":
      return "Мало топлива / нестабильно";
    case "no":
      return "Нет топлива или не работает";
    case "unknown":
      return "Нет данных";
  }
}

export function getQueueLabel(conflict: GdebenzRawConflict | undefined): string {
  if (conflict === "queue") {
    return "Есть очередь";
  }

  if (conflict === "no") {
    return "Есть конфликтующие отметки";
  }

  return "Очередь не отмечена";
}

export function getFreshnessLabel(lastUpdatedAt: string | null | undefined, now = new Date()): FreshnessLabel {
  if (!lastUpdatedAt) {
    return "неизвестно";
  }

  const timestamp = parseSourceTimestamp(lastUpdatedAt);

  if (Number.isNaN(timestamp)) {
    return "неизвестно";
  }

  const ageMinutes = Math.max(0, (now.getTime() - timestamp) / 60_000);

  if (ageMinutes <= 30) {
    return "свежие данные";
  }

  if (ageMinutes <= 120) {
    return "средняя свежесть";
  }

  return "устаревшие данные";
}

export function parseFuels(fuelsNow: unknown, detail?: string | null): string[] {
  const textParts = collectText(fuelsNow);
  const text = textParts.join(" ");
  const fuels = new Set<string>();

  addFuelsFromText(text, fuels);

  if (fuels.size === 0 && detail) {
    addFuelsFromText(detail, fuels);
  }

  return FUEL_ORDER.filter((fuel) => fuels.has(fuel));
}

export function detailMentionsQueue(detail: string | null | undefined): boolean {
  if (!detail) {
    return false;
  }

  const normalized = detail.toLowerCase();

  if (normalized.includes("очереди нет") || normalized.includes("без очеред")) {
    return false;
  }

  return normalized.includes("очеред");
}

export function hasRequestedFuel(fuels: string[], requestedFuel: string): boolean {
  const normalized = normalizeFuelName(requestedFuel);

  if (!normalized) {
    return false;
  }

  return fuels.some((fuel) => normalizeFuelName(fuel) === normalized);
}

export function getRecommendation(params: {
  status: NormalizedStationStatus;
  hasRequestedFuel: boolean;
  hasQueue: boolean;
  freshnessLabel: FreshnessLabel;
}): string {
  if (params.hasQueue) {
    return "Есть очередь, лучше проверить альтернативы";
  }

  if (params.status === "no") {
    return "Лучше пропустить";
  }

  if (
    params.hasRequestedFuel &&
    params.freshnessLabel === "свежие данные"
  ) {
    return "Можно заехать";
  }

  return "Данные сомнительные";
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function addFuelsFromText(value: string, fuels: Set<string>): void {
  const normalized = value.toUpperCase().replace(/Ё/g, "Е");

  if (/\b100\b|АИ[\s-]*100|AI[\s-]*100/.test(normalized)) {
    fuels.add("100");
  }

  if (/\b98\b|АИ[\s-]*98|AI[\s-]*98/.test(normalized)) {
    fuels.add("98");
  }

  if (/\b95\b|АИ[\s-]*95|AI[\s-]*95/.test(normalized)) {
    fuels.add("95");
  }

  if (/\b92\b|АИ[\s-]*92|AI[\s-]*92/.test(normalized)) {
    fuels.add("92");
  }

  if (/\bДТ\b|ДИЗЕЛ|DIESEL|\bDT\b/.test(normalized)) {
    fuels.add("ДТ");
  }
}

function parseSourceTimestamp(value: string): number {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`).getTime();
  }

  return new Date(trimmed).getTime();
}

function normalizeFuelName(value: string): string | null {
  const normalized = value.trim().toUpperCase().replace(/Ё/g, "Е");

  if (/100/.test(normalized)) {
    return "100";
  }

  if (/98/.test(normalized)) {
    return "98";
  }

  if (/95/.test(normalized)) {
    return "95";
  }

  if (/92/.test(normalized)) {
    return "92";
  }

  if (/^ДТ$|ДИЗЕЛ|DIESEL|^DT$/.test(normalized)) {
    return "ДТ";
  }

  return null;
}

function collectText(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [key, ...collectText(item)]);
  }

  return [];
}
