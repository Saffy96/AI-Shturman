import { GeolocationRequestError } from "../../hooks/useGeolocation";
import { FuelApiError } from "../../services/fuelApi";

export function shouldOfferApproximateFallback(error: unknown): boolean {
  return error instanceof FuelApiError && (error.kind === "route-service" || error.kind === "rate-limited");
}

export function getReadableError(error: unknown, isOnline: boolean): string {
  if (!isOnline) return "Нет интернета. Проверьте связь и попробуйте снова.";
  if (error instanceof GeolocationRequestError) return error.message;
  if (error instanceof FuelApiError) {
    if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте обновить данные.";
    if (error.kind === "bad-response") return "Сервер вернул неожиданный ответ.";
    if (error.kind === "rate-limited") return error.message || "Сервис временно ограничил запросы. Попробуйте позже.";
    if (error.kind === "route-service") return error.message || "Сервис построения маршрута временно недоступен.";
    return error.message || "Сервер недоступен. Проверьте подключение и повторите попытку.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Что-то пошло не так. Попробуйте ещё раз.";
}
