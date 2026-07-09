import type { Coordinates } from "../types/fuel";

export function buildYandexMapsUrl(location: Coordinates): string {
  return `https://yandex.ru/maps/?rtext=~${location.lat},${location.lon}&rtt=auto`;
}

export function buildTwoGisUrl(location: Coordinates): string {
  return `https://2gis.ru/search/${location.lat},${location.lon}`;
}
