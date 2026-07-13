import type { NextFunction, Request, Response } from "express";
import { getFuelStationDetails, getNearbyFuel, getRouteFuel, getRouteFuelReal } from "../services/fuel.service.js";

export async function getFuelStationDetailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const osmId = req.params.osmId?.trim();
    if (!osmId || !/^\d+$/.test(osmId)) throw validationError("osmId must be a numeric OSM identifier");
    const station = await getFuelStationDetails(osmId);
    res.json({ ok: true, station });
  } catch (error) {
    next(error);
  }
}

export async function getNearbyFuelController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parseNearbyQuery(req.query);
    const response = await getNearbyFuel(params);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getRouteFuelController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parseRouteQuery(req.query);
    const response = await getRouteFuel(params);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getRouteFuelRealController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parseRouteQuery(req.query);
    const response = await getRouteFuelReal(params);
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
  const radiusKm = parseOptionalNumber(query.radiusKm, 5);
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

function parseRouteQuery(query: Request["query"]): {
  from: string;
  to: string;
  fuel: string;
  corridorKm: number;
  fromLat?: number;
  fromLon?: number;
  toLat?: number;
  toLon?: number;
} {
  const from = parseRequiredString(query.from, "from");
  const to = parseRequiredString(query.to, "to");
  const fuel = parseOptionalString(query.fuel, "95");
  const corridorKm = parseOptionalNumber(query.corridorKm, 0);
  const fromLat = parseOptionalCoordinate(query.fromLat, "fromLat", -90, 90);
  const fromLon = parseOptionalCoordinate(query.fromLon, "fromLon", -180, 180);
  const toLat = parseOptionalCoordinate(query.toLat, "toLat", -90, 90);
  const toLon = parseOptionalCoordinate(query.toLon, "toLon", -180, 180);

  if (corridorKm < 0 || corridorKm > 150) {
    throw validationError("corridorKm must be between 0 and 150");
  }

  return {
    from,
    to,
    fuel,
    corridorKm,
    fromLat,
    fromLon,
    toLat,
    toLon
  };
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

function parseRequiredString(value: unknown, name: string): string {
  if (Array.isArray(value)) {
    throw validationError(`${name} must be a single value`);
  }

  const parsed = String(value ?? "").trim();

  if (!parsed) {
    throw validationError(`${name} is required`);
  }

  return parsed;
}

function parseOptionalCoordinate(
  value: unknown,
  name: string,
  min: number,
  max: number
): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw validationError(`${name} must be a single number`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw validationError(`${name} must be a number`);
  }

  if (parsed < min || parsed > max) {
    throw validationError(`${name} must be between ${min} and ${max}`);
  }

  return parsed;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}
