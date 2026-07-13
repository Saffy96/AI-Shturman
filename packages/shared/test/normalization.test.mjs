import assert from "node:assert/strict";
import { parseFuels } from "../dist/index.js";

assert.deepEqual(
  parseFuels(["92", "95"], "92, 95, ДТ"),
  ["92", "95", "ДТ"],
  "detail must supplement a partially populated fuels_now value"
);

assert.deepEqual(
  parseFuels(["92", "95"], "92, 95, ДТ · Очередь 100+ машин · Лимит 30 л"),
  ["92", "95", "ДТ"],
  "queue and limit quantities must not create phantom fuel grades"
);

assert.deepEqual(
  parseFuels(null, "92, 95 · Очередь 100+ машин"),
  ["92", "95"],
  "a queue size of 100 cars is not AI-100"
);

console.log("fuel normalization cases passed");
