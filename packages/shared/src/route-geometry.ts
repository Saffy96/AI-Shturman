import type { Coordinates } from "./station.js";

interface ProjectionResult {
  distanceFromRouteKm: number;
  distanceFromStartKm: number;
}

export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

/** Samples a route by travelled distance while always preserving its endpoints. */
export function simplifyRoute(route: Coordinates[], intervalKm = 25): Coordinates[] {
  if (route.length <= 2 || intervalKm <= 0) return [...route];
  const simplified: Coordinates[] = [route[0]];
  let distanceToNextSample = intervalKm;

  for (let index = 1; index < route.length; index += 1) {
    let start = route[index - 1];
    const end = route[index];
    let segmentKm = haversineDistanceKm(start, end);

    while (segmentKm >= distanceToNextSample && segmentKm > 0) {
      const ratio = distanceToNextSample / segmentKm;
      const sample = {
        lat: start.lat + (end.lat - start.lat) * ratio,
        lon: start.lon + (end.lon - start.lon) * ratio
      };
      simplified.push(sample);
      start = sample;
      segmentKm = haversineDistanceKm(start, end);
      distanceToNextSample = intervalKm;
    }
    distanceToNextSample -= segmentKm;
  }

  const last = route[route.length - 1];
  const tail = simplified[simplified.length - 1];
  if (tail.lat !== last.lat || tail.lon !== last.lon) simplified.push(last);
  return simplified;
}

export function distancePointToSegmentKm(
  point: Coordinates,
  segmentStart: Coordinates,
  segmentEnd: Coordinates
): number {
  const projection = projectPointToSegment(point, segmentStart, segmentEnd);
  return projection.distanceKm;
}

export function projectPointOnRoute(
  point: Coordinates,
  routeGeometry: Coordinates[]
): ProjectionResult | null {
  if (routeGeometry.length === 0) {
    return null;
  }

  if (routeGeometry.length === 1) {
    return {
      distanceFromRouteKm: haversineDistanceKm(point, routeGeometry[0]),
      distanceFromStartKm: 0
    };
  }

  let traversedKm = 0;
  let bestDistanceKm = Number.POSITIVE_INFINITY;
  let bestDistanceFromStartKm = 0;

  for (let index = 1; index < routeGeometry.length; index += 1) {
    const start = routeGeometry[index - 1];
    const end = routeGeometry[index];
    const segmentLengthKm = haversineDistanceKm(start, end);
    const projection = projectPointToSegment(point, start, end);

    if (projection.distanceKm < bestDistanceKm) {
      bestDistanceKm = projection.distanceKm;
      bestDistanceFromStartKm = traversedKm + segmentLengthKm * projection.ratio;
    }

    traversedKm += segmentLengthKm;
  }

  return {
    distanceFromRouteKm: bestDistanceKm,
    distanceFromStartKm: bestDistanceFromStartKm
  };
}

export function buildRouteBBox(
  routeGeometry: Coordinates[],
  paddingKm: number
): { lat1: number; lon1: number; lat2: number; lon2: number } {
  if (routeGeometry.length === 0) {
    return {
      lat1: -paddingKm / 111,
      lon1: -paddingKm / 111,
      lat2: paddingKm / 111,
      lon2: paddingKm / 111
    };
  }

  let minLat = routeGeometry[0].lat;
  let maxLat = routeGeometry[0].lat;
  let minLon = routeGeometry[0].lon;
  let maxLon = routeGeometry[0].lon;

  for (const point of routeGeometry) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }

  const avgLatRad = toRadians((minLat + maxLat) / 2);
  const latPadding = paddingKm / 111;
  const lonPadding = paddingKm / (111 * Math.max(Math.cos(avgLatRad), 0.2));

  return {
    lat1: clamp(minLat - latPadding, -90, 90),
    lon1: clamp(minLon - lonPadding, -180, 180),
    lat2: clamp(maxLat + latPadding, -90, 90),
    lon2: clamp(maxLon + lonPadding, -180, 180)
  };
}

function projectPointToSegment(
  point: Coordinates,
  segmentStart: Coordinates,
  segmentEnd: Coordinates
): { distanceKm: number; ratio: number } {
  const avgLatRad = toRadians((segmentStart.lat + segmentEnd.lat + point.lat) / 3);
  const kmPerLat = 111;
  const kmPerLon = 111 * Math.max(Math.cos(avgLatRad), 0.2);

  const startX = segmentStart.lon * kmPerLon;
  const startY = segmentStart.lat * kmPerLat;
  const endX = segmentEnd.lon * kmPerLon;
  const endY = segmentEnd.lat * kmPerLat;
  const pointX = point.lon * kmPerLon;
  const pointY = point.lat * kmPerLat;

  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return {
      distanceKm: Math.hypot(pointX - startX, pointY - startY),
      ratio: 0
    };
  }

  const rawRatio = ((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared;
  const ratio = clamp(rawRatio, 0, 1);
  const projectedX = startX + dx * ratio;
  const projectedY = startY + dy * ratio;

  return {
    distanceKm: Math.hypot(pointX - projectedX, pointY - projectedY),
    ratio
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
