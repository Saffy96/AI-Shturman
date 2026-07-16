import assert from "node:assert/strict";
import test from "node:test";

process.env.GEOAPIFY_API_KEY = "api-test-key";
process.env.GEOAPIFY_BASE_URL = "https://geoapify.test";
process.env.NODE_ENV = "test";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname !== "geoapify.test") return originalFetch(input);
  return Response.json({ results: [{ name: url.searchParams.get("text") || "Точка", formatted: "Тестовый адрес", lat: 55.796127, lon: 49.106414 }] });
};

const { app } = await import("../dist/app.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
test.after(() => new Promise((resolve, reject) => server.close((error) => {
  globalThis.fetch = originalFetch;
  error ? reject(error) : resolve();
})));

test("geo autocomplete, search and reverse preserve public response contracts", async () => {
  for (const path of [
    "/api/geo/autocomplete?q=Казань",
    "/api/geo/search?q=Казань",
    "/api/geo/reverse?lat=55.796127&lon=49.106414"
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
  }
});

for (const [path, message] of [
  ["/api/geo/autocomplete?q=", "q is required"],
  ["/api/geo/autocomplete?q=К", "at least 2"],
  ["/api/geo/autocomplete?q=a&q=b", "single value"],
  [`/api/geo/search?q=${"a".repeat(301)}`, "at most 300"],
  ["/api/geo/reverse?lat=x&lon=49", "lat must be"],
  ["/api/geo/reverse?lat=91&lon=49", "lat must be"],
  ["/api/geo/reverse?lat=55&lon=181", "lon must be"],
  ["/api/geo/autocomplete?q=Казань&lat=55", "provided together"]
]) {
  test(`validates ${path.slice(0, 70)}`, async () => {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error.message, new RegExp(message));
  });
}
