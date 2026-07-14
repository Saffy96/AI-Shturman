import assert from "node:assert/strict";
import test from "node:test";
import { TtlCache } from "../dist/utils/ttl-cache.js";

test("TTL cache evicts the least recently used entry at capacity", () => {
  const cache = new TtlCache(60_000, 2);
  cache.set("first", 1);
  cache.set("second", 2);
  assert.equal(cache.get("first"), 1);
  cache.set("third", 3);
  assert.equal(cache.get("first"), 1);
  assert.equal(cache.get("second"), null);
  assert.equal(cache.get("third"), 3);
});
