import assert from "node:assert/strict";
import test from "node:test";
import { submitStationComment } from "../../../packages/gdebenz-client/dist/index.js";
import { parseStationReport } from "../dist/controllers/fuel.controller.js";

test("station report validation keeps only supported fields", () => {
  const report = parseStationReport({
    stationName: "Лукойл",
    lat: 55.75,
    lon: 37.61,
    availability: "yes",
    fuelTypes: ["95", "ДТ", "95", "unknown"],
    limitLiters: 30,
    hasQueue: true,
    visitorId: "1234567890abcdef"
  });
  assert.deepEqual(report.fuelTypes, ["95", "ДТ"]);
  assert.equal(report.limitLiters, 30);
  assert.equal(report.hasQueue, true);
});

test("gdebenz client posts comments using the official endpoint and JSON contract", async () => {
  let request;
  const payload = {
    osm_id: "42", name: "АЗС", lat: 55, lon: 37, status: "queue",
    text: "95 · Очередь · Лимит 30 л", fp: "1234567890abcdef", cf: "", vt: ""
  };
  await submitStationComment(payload, {
    baseUrl: "https://example.test/api",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  assert.equal(request.url, "https://example.test/api/comments");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(request.init.body), payload);
});
