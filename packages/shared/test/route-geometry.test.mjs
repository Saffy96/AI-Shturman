import assert from "node:assert/strict";
import { haversineDistanceKm, simplifyRoute } from "../dist/index.js";

const route = Array.from({ length: 101 }, (_, index) => ({ lat: 55, lon: 49 + index * 0.01 }));
const simplified = simplifyRoute(route, 25);

assert.deepEqual(simplified[0], route[0]);
assert.deepEqual(simplified.at(-1), route.at(-1));
assert.ok(simplified.length < route.length);
for (let index = 1; index < simplified.length - 1; index += 1) {
  const distance = haversineDistanceKm(simplified[index - 1], simplified[index]);
  assert.ok(distance > 24 && distance < 26, `sample interval was ${distance}`);
}
console.log("route simplification cases passed");
