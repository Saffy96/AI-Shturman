import type { NextFunction, Request, Response } from "express";
import { getNearbyFuel } from "../services/fuel.service.js";

export async function getNearbyFuelController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parseNearbyQuery(req.query);
    const response = await getNearbyFuel(params);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

function parseNearbyQuery(query: Request["query"]): {
  lat: number;
  lon: number;
  radiusKm: number;
  fuel: string;
} {
  const lat = parseRequiredNumber(query.lat, "lat");
  const lon = parseRequiredNumber(query.lon, "lon");
  const radiusKm = parseOptionalNumber(query.radiusKm, 50);
  const fuel = parseOptionalString(query.fuel, "95");

  if (lat < -90 || lat > 90) {
    throw validationError("lat must be between -90 and 90");
  }

  if (lon < -180 || lon > 180) {
    throw validationError("lon must be between -180 and 180");
  }

  if (radiusKm <= 0 || radiusKm > 100) {
    throw validationError("radiusKm must be between 1 and 100");
  }

  return { lat, lon, radiusKm, fuel };
}

function parseRequiredNumber(value: unknown, name: string): number {
  if (Array.isArray(value)) {
    throw validationError(`${name} must be a single number`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw validationError(`${name} is required and must be a number`);
  }

  return parsed;
}

function parseOptionalNumber(value: unknown, fallback: number): number {
  if (value == null) {
    return fallback;
  }

  if (Array.isArray(value)) {
    throw validationError("radiusKm must be a single number");
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw validationError("radiusKm must be a number");
  }

  return parsed;
}

function parseOptionalString(value: unknown, fallback: string): string {
  if (value == null) {
    return fallback;
  }

  if (Array.isArray(value)) {
    throw validationError("fuel must be a single value");
  }

  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : fallback;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}
