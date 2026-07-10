import type { Coordinates } from "@ai-shturman/shared";
import { env } from "../config/env.js";

interface OpenRouteFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    summary?: {
      distance?: number;
      duration?: number;
    };
  };
}

interface OpenRouteGeoJsonResponse {
  features?: OpenRouteFeature[];
}

export interface DrivingRoute {
  distanceKm: number;
  durationMin: number;
  geometry: Coordinates[];
}

export class OpenRouteServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code:
      | "missing-key"
      | "unauthorized"
      | "forbidden"
      | "rate-limited"
      | "route-not-found"
      | "timeout"
      | "bad-response"
      | "network"
  ) {
    super(message);
    this.name = "OpenRouteServiceError";
  }
}

export async function getDrivingRoute(from: Coordinates, to: Coordinates): Promise<DrivingRoute> {
  if (!env.openRouteServiceApiKey) {
    throw new OpenRouteServiceError(
      "OpenRouteService API key is not configured. Use approximate route fallback.",
      503,
      "missing-key"
    );
  }

  const url = new URL("/v2/directions/driving-car/geojson", env.openRouteServiceBaseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.openRouteServiceTimeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: env.openRouteServiceApiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat]
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw await mapOpenRouteError(response, url);
    }

    const payload = (await response.json()) as OpenRouteGeoJsonResponse;
    const feature = payload.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    const distance = feature?.properties?.summary?.distance;
    const duration = feature?.properties?.summary?.duration;

    if (!Array.isArray(coordinates) || typeof distance !== "number" || typeof duration !== "number") {
      throw new OpenRouteServiceError(
        "OpenRouteService returned unexpected route data.",
        502,
        "bad-response"
      );
    }

    const geometry = coordinates
      .map((item) => {
        if (!Array.isArray(item) || item.length < 2) {
          return null;
        }

        const [lon, lat] = item;
        if (typeof lat !== "number" || typeof lon !== "number") {
          return null;
        }

        return { lat, lon };
      })
      .filter((point): point is Coordinates => point !== null);

    if (geometry.length < 2) {
      throw new OpenRouteServiceError("Route was not found for the selected points.", 404, "route-not-found");
    }

    return {
      distanceKm: roundTo(distance / 1000, 1),
      durationMin: Math.max(1, Math.round(duration / 60)),
      geometry
    };
  } catch (error) {
    if (error instanceof OpenRouteServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouteServiceError("OpenRouteService request timed out.", 504, "timeout");
    }

    throw new OpenRouteServiceError("OpenRouteService request failed.", 502, "network");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapOpenRouteError(response: Response, url: URL): Promise<OpenRouteServiceError> {
  const responseBody = await safeReadResponseBody(response);
  logOpenRouteError(response.status, response.statusText, url, responseBody);
  const bodyMessage = readBodyMessage(responseBody);

  if (response.status === 401) {
    return new OpenRouteServiceError(
      bodyMessage || "OpenRouteService rejected the API key.",
      401,
      "unauthorized"
    );
  }

  if (response.status === 403) {
    return new OpenRouteServiceError(
      bodyMessage || "OpenRouteService access is forbidden for this API key.",
      403,
      "forbidden"
    );
  }

  if (response.status === 404) {
    return new OpenRouteServiceError(
      bodyMessage || "Route was not found for the selected points.",
      404,
      "route-not-found"
    );
  }

  if (response.status === 429) {
    return new OpenRouteServiceError(
      bodyMessage || "OpenRouteService temporarily limited requests. Use approximate route fallback.",
      429,
      "rate-limited"
    );
  }

  return new OpenRouteServiceError(
    bodyMessage || `OpenRouteService responded with HTTP ${response.status}.`,
    response.status >= 400 && response.status < 600 ? response.status : 502,
    "bad-response"
  );
}

function readBodyMessage(responseBody: string): string | null {
  try {
    const payload = JSON.parse(responseBody) as { error?: unknown; message?: unknown };

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    return null;
  } catch {
    return null;
  }
}

async function safeReadResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<failed to read body>";
  }
}

function logOpenRouteError(status: number, statusText: string, url: URL, responseBody: string): void {
  const safeUrl = new URL(url.toString());
  safeUrl.searchParams.delete("api_key");

  console.error("[openroute]");
  console.error(`status: ${status}`);
  console.error(`statusText: ${statusText}`);
  console.error(`url: ${safeUrl.toString()}`);
  console.error("body:");
  console.error(responseBody);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
