import assert from "node:assert/strict";
import test from "node:test";

process.env.GEOAPIFY_API_KEY = "test-secret-key";
process.env.GEOAPIFY_BASE_URL = "https://geoapify.test";
process.env.GEOAPIFY_TIMEOUT_MS = "10";
process.env.NODE_ENV = "test";

const {
  autocompleteGeoapify,
  normalizeGeoapifyResults,
  reverseGeoapify,
  searchGeoapify
} = await import("../dist/services/geoapify.service.js");
const { env } = await import("../dist/config/env.js");
const { autocompleteGeo } = await import("../dist/services/geo.service.js");

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test("normalizer handles city, address fallbacks, invalid coordinates, duplicates, and empty results", () => {
  const results = normalizeGeoapifyResults([
    { name: "Казань", formatted: "Казань, Татарстан, Россия", city: "Казань", lat: "55.79", lon: "49.12", place_id: "city" },
    { street: "Баумана", housenumber: "1", address_line1: "улица Баумана, 1", address_line2: "Казань", lat: 55.791, lon: 49.111 },
    { street: "Кремлёвская", city: "Казань", lat: 55.792, lon: 49.112 },
    { formatted: "Без названия, Казань", lat: 55.793, lon: 49.113 },
    { city: "Иннополис", state: "Татарстан", country: "Россия", lat: 55.794, lon: 49.114 },
    { name: "bad", lat: "invalid", lon: 49 },
    { name: "duplicate place", formatted: "Другое", lat: 1, lon: 2, place_id: "city" },
    { name: "duplicate address", formatted: "Казань, Татарстан, Россия", lat: 3, lon: 4 },
    { name: "duplicate coordinates", formatted: "Ещё адрес", lat: 55.790001, lon: 49.120001 }
  ]);
  assert.equal(results.length, 5);
  assert.equal(results[0].name, "Казань");
  assert.equal(results[1].name, "улица Баумана, 1");
  assert.equal(results[1].address, "улица Баумана, 1, Казань");
  assert.equal(results[2].name, "Кремлёвская");
  assert.equal(results[3].name, "Без названия");
  assert.equal(results[4].address, "Иннополис, Татарстан, Россия");
  assert.deepEqual(normalizeGeoapifyResults([]), []);
});

test("autocomplete builds the documented URL including lon,lat proximity bias", async () => {
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ results: [] });
  };
  await autocompleteGeoapify("Баумана", { limit: 6, countryCode: "ru", bias: { lat: 55.7961, lon: 49.1064 } });
  assert.equal(requestedUrl.pathname, "/v1/geocode/autocomplete");
  assert.equal(requestedUrl.searchParams.get("text"), "Баумана");
  assert.equal(requestedUrl.searchParams.get("format"), "json");
  assert.equal(requestedUrl.searchParams.get("lang"), "ru");
  assert.equal(requestedUrl.searchParams.get("limit"), "6");
  assert.equal(requestedUrl.searchParams.get("filter"), "countrycode:ru");
  assert.equal(requestedUrl.searchParams.get("apiKey"), "test-secret-key");
  assert.equal(requestedUrl.searchParams.get("bias"), "proximity:49.1064,55.7961");
});

test("search and reverse use their respective endpoints and parameters", async () => {
  const urls = [];
  globalThis.fetch = async (input) => {
    urls.push(new URL(String(input)));
    return Response.json({ results: [] });
  };
  await searchGeoapify("Казань");
  await reverseGeoapify(55.796127, 49.106414);
  assert.equal(urls[0].pathname, "/v1/geocode/search");
  assert.equal(urls[1].pathname, "/v1/geocode/reverse");
  assert.equal(urls[1].searchParams.get("lat"), "55.796127");
  assert.equal(urls[1].searchParams.get("lon"), "49.106414");
  assert.equal(urls[1].searchParams.has("filter"), false);
});

for (const [status, expectedStatus, message] of [
  [401, 502, "Geoapify authentication failed"],
  [403, 502, "Geoapify authentication failed"],
  [429, 429, "Geoapify rate limit exceeded"],
  [500, 502, "Geoapify service is temporarily unavailable"]
]) {
  test(`maps Geoapify HTTP ${status} without leaking the API key`, async () => {
    globalThis.fetch = async () => new Response(null, { status });
    await assert.rejects(searchGeoapify("error"), (error) => {
      assert.equal(error.statusCode, expectedStatus);
      assert.equal(error.message, message);
      assert.equal(error.message.includes("test-secret-key"), false);
      return true;
    });
  });
}

test("aborts a timed-out Geoapify request", async () => {
  globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  await assert.rejects(searchGeoapify("timeout"), (error) => error.statusCode === 504 && error.message === "Geoapify request timed out");
});

test("fails clearly when the API key is missing", async () => {
  const key = env.geoapifyApiKey;
  env.geoapifyApiKey = "";
  try {
    await assert.rejects(searchGeoapify("missing-key"), (error) => error.statusCode === 503 && error.message === "Geoapify API key is not configured");
  } finally {
    env.geoapifyApiKey = key;
  }
});

test("coalesces concurrent identical autocomplete requests", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Response.json({ results: [] });
  };
  await Promise.all([
    autocompleteGeo("coalescing-test"),
    autocompleteGeo("coalescing-test"),
    autocompleteGeo("coalescing-test")
  ]);
  assert.equal(calls, 1);
});
