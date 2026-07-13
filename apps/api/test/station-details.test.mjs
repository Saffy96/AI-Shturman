import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeStationDetails } from "../dist/services/station-normalizer.service.js";

async function fixture(name) {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

test("HAR A: status no keeps the shutdown explanation and recent reliability", async () => {
  const raw = await fixture("status-no");
  const station = normalizeStationDetails("1001", raw.details, raw.recent);
  assert.equal(station.status, "no");
  assert.equal(station.fuels.length, 0);
  assert.match(station.detail, /не работает/);
  assert.equal(station.recentReports[0].onSite, true);
  assert.equal(station.recentReports[0].authorReliable, true);
});

test("HAR B: status queue normalizes 20–50 cars, 30 l limit and prices", async () => {
  const raw = await fixture("status-queue");
  const station = normalizeStationDetails("1002", raw.details, raw.recent);
  assert.equal(station.status, "queue");
  assert.deepEqual(station.queue, { present: true, vehicleRange: "20–50", confirmations: 7, estimatedMinutes: null });
  assert.deepEqual(station.limit, { active: true, liters: 30, confirmations: 5 });
  assert.deepEqual(station.prices["95"], { price: 61.4, confirmations: 3, updatedAt: "2026-07-13T08:55:00Z" });
  assert.equal(station.confidencePercent, 84);
});

test("HAR C: status low preserves both queue and limit", async () => {
  const raw = await fixture("status-low");
  const station = normalizeStationDetails("1003", raw.details, raw.recent);
  assert.equal(station.status, "low");
  assert.deepEqual(station.fuels, ["92", "95"]);
  assert.equal(station.queue.present, true);
  assert.equal(station.limit.active, true);
  assert.equal(station.limit.liters, 20);
  assert.equal(station.confirmationsFresh, 3);
  assert.equal(station.realCount, 11);
});

test("status yes with empty fuels confirms fuel without inventing brands", () => {
  const station = normalizeStationDetails("1004", { status: "yes", fuelsNow: [], confidenceBase: 0.5 }, []);
  assert.equal(station.status, "yes");
  assert.deepEqual(station.fuels, []);
  assert.equal(station.fuelBrandsKnown, false);
});

test("limit liters are recovered from a recent driver report", () => {
  const station = normalizeStationDetails(
    "1005",
    { status: "low", limited: true, limits: { lim: null } },
    [{ status: "low", detail: "Отпускают с лимитом до 25 л", created_at: "2026-07-13T10:00:00Z" }]
  );
  assert.equal(station.limit.active, true);
  assert.equal(station.limit.liters, 25);
});
