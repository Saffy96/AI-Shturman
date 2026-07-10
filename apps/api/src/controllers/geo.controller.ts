import type { NextFunction, Request, Response } from "express";
import { reverseGeo, searchGeo } from "../services/geo.service.js";

export async function searchGeoController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = parseQuery(req.query.q);
    const response = await searchGeo(query);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function reverseGeoController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = Number(req.query.lat); const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw validationError("lat and lon are required");
    const result = await reverseGeo(lat, lon);
    res.json({ ok: true, address: result.address, lat: result.lat, lon: result.lon, result });
  } catch (error) { next(error); }
}

function parseQuery(value: unknown): string {
  if (Array.isArray(value)) {
    throw validationError("q must be a single value");
  }

  const query = String(value ?? "").trim();

  if (!query) {
    throw validationError("q is required");
  }

  return query;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}
