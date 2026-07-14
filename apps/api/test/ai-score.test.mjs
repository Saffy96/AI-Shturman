import assert from "node:assert/strict";
import test from "node:test";
import { calculateHoseRating, getAiRecommendation } from "../dist/services/station-normalizer.service.js";

const strong = {
  freshness: 1,
  hasQueue: false,
  hasLimit: false,
  price: 60,
  referencePrice: 60,
  deviationKm: 0,
  confirmations: 7,
  reliability: 1,
  brandKnown: true,
  nextStationDistanceKm: 50,
  selectedFuel: true,
  status: "yes"
};

test("Hose Rating is independent, bounded and reacts to every required factor", () => {
  const baseline = calculateHoseRating(strong);
  assert.equal(baseline, 100);
  assert.ok(calculateHoseRating({ ...strong, freshness: 0.2 }) < baseline, "freshness");
  assert.ok(calculateHoseRating({ ...strong, hasQueue: true }) < baseline, "queue");
  assert.ok(calculateHoseRating({ ...strong, hasLimit: true }) < baseline, "limit");
  assert.ok(calculateHoseRating({ ...strong, price: 90 }) < baseline, "price");
  assert.ok(calculateHoseRating({ ...strong, deviationKm: 10 }) < baseline, "deviation");
  assert.ok(calculateHoseRating({ ...strong, confirmations: 0 }) < baseline, "confirmations");
  assert.ok(calculateHoseRating({ ...strong, reliability: 0.1 }) < baseline, "reliability");
  assert.ok(calculateHoseRating({ ...strong, brandKnown: false }) < baseline, "brand");
  assert.ok(calculateHoseRating({ ...strong, nextStationDistanceKm: 5 }) < baseline, "next station");
  assert.ok(calculateHoseRating({ ...strong, hasQueue: true }) < 55, "queue safety cap");
  assert.ok(calculateHoseRating({ ...strong, hasLimit: true }) < 65, "limit safety cap");
  assert.equal(calculateHoseRating({ ...strong, status: "no" }), 0);
});

test("AI Recommendation is derived only from Hose Rating", () => {
  assert.equal(getAiRecommendation(75), "Рекомендуем заехать");
  assert.equal(getAiRecommendation(55), "Можно заехать");
  assert.equal(getAiRecommendation(35), "Лучше проверить альтернативы");
  assert.equal(getAiRecommendation(34), "Лучше пропустить");
});
