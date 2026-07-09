import type { NearbyFuelParams, NearbyFuelResponse } from "../types/fuel";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 12_000;

export type FuelApiErrorKind = "backend-unavailable" | "timeout" | "bad-response";

export class FuelApiError extends Error {
  constructor(
    message: string,
    readonly kind: FuelApiErrorKind
  ) {
    super(message);
    this.name = "FuelApiError";
  }
}

export async function fetchNearbyFuel(params: NearbyFuelParams): Promise<NearbyFuelResponse> {
  const url = new URL("/api/fuel/nearby", API_BASE_URL);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lon", String(params.lon));
  url.searchParams.set("radiusKm", String(params.radiusKm));
  url.searchParams.set("fuel", params.fuel);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new FuelApiError("Backend unavailable", "backend-unavailable");
    }

    const payload = (await response.json()) as NearbyFuelResponse;

    if (!payload.ok || !Array.isArray(payload.stations)) {
      throw new FuelApiError("Unexpected backend response", "bad-response");
    }

    return payload;
  } catch (error) {
    if (error instanceof FuelApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FuelApiError("Backend request timed out", "timeout");
    }

    throw new FuelApiError("Backend unavailable", "backend-unavailable");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
