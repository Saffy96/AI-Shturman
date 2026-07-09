import assert from "node:assert/strict";
import { buildNavigatorAdvice } from "../dist/index.js";

function station(overrides = {}) {
  return {
    id: "osm:test",
    brand: "Лукойл",
    name: "Лукойл",
    address: "Тестовая улица",
    lat: 55,
    lon: 49,
    distanceKm: 18,
    status: "yes",
    statusLabel: "Есть топливо",
    fuels: ["95"],
    hasRequestedFuel: true,
    hasQueue: false,
    queueLabel: "Очередь не отмечена",
    confidence: 0.8,
    confirmations: 3,
    lastUpdatedAt: "2026-07-10T10:00:00Z",
    freshnessLabel: "свежие данные",
    recommendation: "Можно заехать",
    rawDetail: null,
    distanceFromRouteKm: null,
    distanceFromStartKm: null,
    routePositionLabel: null,
    ...overrides
  };
}

assert.deepEqual(buildNavigatorAdvice([station()], "95"), {
  level: "good",
  title: "Можно заехать",
  message:
    "Ближайшая подходящая АЗС с 95 — Лукойл через 18 км. Очередь не отмечена. Данные: свежие данные. Рекомендация: можно заехать.",
  stationId: "osm:test"
});

assert.equal(buildNavigatorAdvice([station({ hasQueue: true })], "95").level, "warning");
assert.equal(buildNavigatorAdvice([station({ status: "low" })], "95").title, "Топлива мало");
assert.equal(buildNavigatorAdvice([station({ fuels: ["92"], hasRequestedFuel: false })], "95").level, "danger");
assert.equal(buildNavigatorAdvice([], "95").level, "unknown");

const routeAdvice = buildNavigatorAdvice(
  [
    station({
      id: "osm:queue",
      distanceKm: 3,
      distanceFromStartKm: 12,
      hasQueue: true,
      queueLabel: "Есть очередь"
    }),
    station({
      id: "osm:next",
      brand: "Татнефть",
      distanceKm: 8,
      distanceFromStartKm: 19
    })
  ],
  "95"
);

assert.equal(routeAdvice.level, "good");
assert.equal(routeAdvice.stationId, "osm:next");
assert.match(routeAdvice.message, /Татнефть/);
assert.match(routeAdvice.message, /19 км/);

console.log("navigator advice cases passed");
