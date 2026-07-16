import type { NextFunction, Request, Response } from "express";
import { autocompleteGeo, reverseGeo, searchGeo } from "../services/geo.service.js";

const MAX_QUERY_LENGTH = 300;

export async function autocompleteGeoController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = parseQuery(req.query.q, 2);
    const bias = parseOptionalBias(req.query.lat, req.query.lon);
    const response = await autocompleteGeo(query, bias ? { bias } : undefined);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function searchGeoController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = parseQuery(req.query.q, 1);
    const response = await searchGeo(query);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function reverseGeoController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = parseCoordinate(req.query.lat, "lat", -90, 90);
    const lon = parseCoordinate(req.query.lon, "lon", -180, 180);
    const result = await reverseGeo(lat, lon);
    res.json({ ok: true, address: result.address, lat: result.lat, lon: result.lon, result });
  } catch (error) { next(error); }
}

function parseQuery(value: unknown, minimumLength: number): string {
  if (Array.isArray(value)) {
    throw validationError("q must be a single value");
  }

  const query = String(value ?? "").trim();

  if (!query) {
    throw validationError("q is required");
  }

  if (query.length < minimumLength) throw validationError(`q must contain at least ${minimumLength} characters`);
  if (query.length > MAX_QUERY_LENGTH) throw validationError(`q must contain at most ${MAX_QUERY_LENGTH} characters`);

  return query;
}

function parseOptionalBias(latValue: unknown, lonValue: unknown): { lat: number; lon: number } | undefined {
  if (latValue == null && lonValue == null) return undefined;
  if (latValue == null || lonValue == null) throw validationError("lat and lon must be provided together");
  return {
    lat: parseCoordinate(latValue, "lat", -90, 90),
    lon: parseCoordinate(lonValue, "lon", -180, 180)
  };
}

function parseCoordinate(value: unknown, name: string, minimum: number, maximum: number): number {
  if (Array.isArray(value) || typeof value === "object" || value == null || value === "") {
    throw validationError(`${name} must be a number between ${minimum} and ${maximum}`);
  }
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    throw validationError(`${name} must be a number between ${minimum} and ${maximum}`);
  }
  return coordinate;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}
