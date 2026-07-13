import { useCallback, useState } from "react";
import type { Coordinates } from "../types/fuel";

export type GeolocationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "insecure";

export class GeolocationRequestError extends Error {
  constructor(
    message: string,
    readonly status: Exclude<GeolocationStatus, "idle" | "loading" | "ready">
  ) {
    super(message);
    this.name = "GeolocationRequestError";
  }
}

export interface AccurateCoordinates extends Coordinates { accuracy: number; }

export function useGeolocation() {
  const [location, setLocation] = useState<AccurateCoordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");

  const requestLocation = useCallback(() => {
    if (window.isSecureContext === false) {
      const error = new GeolocationRequestError(
        "Геолокация работает только на localhost или HTTPS.",
        "insecure"
      );
      setStatus(error.status);
      return Promise.reject(error);
    }

    if (!("geolocation" in navigator)) {
      const error = new GeolocationRequestError("Этот браузер не поддерживает геолокацию.", "unsupported");
      setStatus(error.status);
      return Promise.reject(error);
    }

    setStatus("loading");

    return new Promise<AccurateCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          setLocation(coords);
          setStatus("ready");
          resolve(coords);
        },
        (positionError) => {
          const error = mapGeolocationError(positionError);
          setStatus(error.status);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 0
        }
      );
    });
  }, []);

  return {
    location,
    status,
    isLocating: status === "loading",
    requestLocation
  };
}

function mapGeolocationError(error: GeolocationPositionError): GeolocationRequestError {
  if (error.code === error.PERMISSION_DENIED) {
    return new GeolocationRequestError(
      "Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.",
      "denied"
    );
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return new GeolocationRequestError("Устройство не смогло определить местоположение.", "unavailable");
  }

  if (error.code === error.TIMEOUT) {
    return new GeolocationRequestError("Не удалось определить местоположение за 10 секунд.", "timeout");
  }

  return new GeolocationRequestError(error.message || "Не удалось получить геопозицию.", "unavailable");
}
