import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  extractActivityRecords,
  mergeStationActivities,
  normalizeStationActivities,
  normalizeStationDetails,
  parseActivityTimestamp
} from "../dist/services/station-normalizer.service.js";

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
  assert.deepEqual(station.prices["95"], { price: 61.4, confirmations: 3, updatedAt: "2026-07-13T08:55:00.000Z" });
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

test("object-shaped fresh queue conflict from the real API is preserved", () => {
  const station = normalizeStationDetails("1004", { status: "yes", freshConflict: { status: "queue", ageMin: 26 } }, []);
  assert.equal(station.freshConflict, true);
  assert.equal(station.queue.present, true);
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

test("activity timestamps support ISO, Unix seconds and Unix milliseconds", () => {
  const iso = parseActivityTimestamp("2026-07-13T10:00:00Z");
  assert.equal(iso, Date.parse("2026-07-13T10:00:00Z"));
  assert.equal(parseActivityTimestamp(1_752_400_000), 1_752_400_000_000);
  assert.equal(parseActivityTimestamp(1_752_400_000_000), 1_752_400_000_000);
  assert.equal(parseActivityTimestamp({ publishedAt: "2026-07-13T09:00:00Z" }), Date.parse("2026-07-13T09:00:00Z"));
  assert.equal(parseActivityTimestamp("2026-07-13 15:56:03"), Date.parse("2026-07-13T15:56:03Z"));
  assert.equal(parseActivityTimestamp("не дата"), null);
});

test("activities are merged, deduplicated and sorted only after the merge", () => {
  const comments = normalizeStationActivities("42", [
    { id: "same", status: "queue", detail: "92 · Очередь 5–20 машин", created_at: "2026-07-13T09:00:00Z" },
    { status: "yes", detail: "Одинаковый текст", created_at: "2026-07-13T10:00:00Z" },
    { status: "yes", detail: "Одинаковый текст", created_at: "2026-07-12T23:59:00Z" }
  ], "comments");
  const recent = normalizeStationActivities("42", [
    { id: "same", status: "queue", detail: "92 · Очередь 5–20 машин", created_at: "2026-07-13T09:00:00Z", on_site: true },
    { status: "no", detail: "Другой тип", created_at: "2026-07-13T09:00:00Z" }
  ], "recent");
  const merged = mergeStationActivities([recent, comments]);

  assert.equal(merged.length, 4);
  assert.deepEqual(merged.map((item) => item.createdAtMs), [
    Date.parse("2026-07-13T10:00:00Z"),
    Date.parse("2026-07-13T09:00:00Z"),
    Date.parse("2026-07-13T09:00:00Z"),
    Date.parse("2026-07-12T23:59:00Z")
  ]);
  assert.equal(merged.find((item) => item.sourceId === "same").wasOnSite, true);
  assert.deepEqual(merged.find((item) => item.sourceId === "same").fuelTypes, ["92"]);
});

test("queue car ranges do not create phantom fuel grades", () => {
  const [activity] = normalizeStationActivities("42", [
    { status: "low", detail: "92, 95 · Очередь 50–100 машин · Лимит 30 л", created_at: "2026-07-13T10:00:00Z" }
  ], "recent");
  assert.deepEqual(activity.fuelTypes, ["92", "95"]);
  assert.equal(activity.limitLiters, 30);
  assert.deepEqual(activity.queue, { label: "50–100 машин", minCars: 50, maxCars: 100 });
});

test("unknown activity types and invalid dates are preserved at the end", () => {
  const activities = normalizeStationActivities("42", [
    { type: "new-api-event", detail: "Новый тип", created_at: "не дата" },
    { status: "yes", detail: "Свежая", created_at: "2026-07-13T10:00:00Z" }
  ], "recent");
  const merged = mergeStationActivities([activities]);
  assert.equal(merged[0].text, "Свежая");
  assert.equal(merged[1].type, "unknown");
  assert.equal(merged[1].text, "Новый тип");
  assert.equal(Number.isNaN(merged[1].createdAtMs), true);
});

test("activity arrays are extracted from supported response wrappers", () => {
  const item = { status: "yes", created_at: "2026-07-13T10:00:00Z" };
  assert.deepEqual(extractActivityRecords([item]), [item]);
  assert.deepEqual(extractActivityRecords({ data: { comments: [item] }, total: 1 }), [item]);
  assert.deepEqual(extractActivityRecords({ status: "yes", realCount: 37 }), []);
});
