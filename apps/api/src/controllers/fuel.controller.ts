import type { StationReportInput } from "@ai-shturman/shared";
import type { NextFunction, Request, Response } from "express";
import { getFuelStationDetails, getNearbyFuel, getRouteFuel, getRouteFuelReal, submitFuelStationReport } from "../services/fuel.service.js";

export async function getFuelStationDetailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const osmId = req.params.osmId?.trim();
    if (!osmId || !isValidStationId(osmId)) throw validationError("osmId must be a valid station identifier");
    const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
    const station = await getFuelStationDetails(osmId, forceRefresh);
    res.json({ ok: true, station });
  } catch (error) {
    next(error);
  }
}

export function isValidStationId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

export async function submitFuelStationReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const osmId = req.params.osmId?.trim();
    if (!osmId || !isValidStationId(osmId)) throw validationError("osmId must be a valid station identifier");
    const input = parseStationReport(req.body);
    await submitFuelStationReport(osmId, input);
    res.json({ ok: true, submitted: true });
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

export function parseStationReport(body: unknown): StationReportInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError("report body is required");
  const input = body as Record<string, unknown>;
  const stationName = String(input.stationName ?? "").trim().slice(0, 160);
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  const availability = input.availability;
  const visitorId = String(input.visitorId ?? "").trim();
  const hasQueue = input.hasQueue === true;
  const limitLiters = input.limitLiters == null || input.limitLiters === "" ? null : Number(input.limitLiters);
  const allowedFuelTypes = new Set(["92", "95", "98", "100", "ДТ"]);
  const fuelTypes = Array.isArray(input.fuelTypes)
    ? [...new Set(input.fuelTypes.map(String).filter((fuel) => allowedFuelTypes.has(fuel)))]
    : [];

  if (!stationName) throw validationError("stationName is required");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw validationError("lat must be between -90 and 90");
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw validationError("lon must be between -180 and 180");
  if (availability !== "yes" && availability !== "no") throw validationError("availability must be yes or no");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(visitorId)) throw validationError("visitorId is invalid");
  if (limitLiters != null && (!Number.isFinite(limitLiters) || limitLiters < 1 || limitLiters > 500)) throw validationError("limitLiters must be between 1 and 500");
  if (availability === "yes" && fuelTypes.length === 0) throw validationError("at least one fuel type is required");

  return {
    stationName, lat, lon, availability, fuelTypes,
    limitLiters: availability === "yes" ? limitLiters : null,
    hasQueue: availability === "yes" && hasQueue,
    visitorId
  };
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}
