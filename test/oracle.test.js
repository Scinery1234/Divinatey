import { test } from "node:test";
import assert from "node:assert/strict";
import { divineReading, isValidSeed, HB, HN, TD, TP } from "../shared/oracle.js";
import { detectCrisis } from "../shared/safety.js";

test("tables are complete", () => {
  assert.equal(HN.length, 65);
  assert.equal(new Set(HB).size, 64);
  assert.ok(HB.every(b => b >= 0 && b < 64));
  assert.equal(new Set(TD).size, 78);
  assert.equal(TP.length, 7);
});

test("readings are deterministic per seed", () => {
  assert.deepEqual(divineReading(123456789), divineReading(123456789));
  assert.notDeepEqual(divineReading(123456789).cards, divineReading(123456790).cards);
});

test("readings are well-formed across many seeds", () => {
  for (let s = 1; s < 5000; s += 7) {
    const r = divineReading(s * 104729);
    assert.ok(r.pHex >= 1 && r.pHex <= 64);
    assert.equal(r.lines.length, 6);
    assert.ok(r.lines.every(l => l >= 6 && l <= 9));
    assert.equal(r.changing.length, r.lines.filter(l => l === 6 || l === 9).length);
    assert.equal(r.rHex === null, r.changing.length === 0);
    assert.equal(new Set(r.cards.map(c => c.name)).size, 7);
    assert.deepEqual(r.cards.map(c => c.pos), TP);
  }
});

test("seed validation", () => {
  assert.ok(isValidSeed(1));
  for (const bad of [0, -1, 1.5, "5", null, 2147483647]) assert.ok(!isValidSeed(bad));
});

test("crisis detection", () => {
  assert.ok(detectCrisis("I want to die"));
  assert.ok(!detectCrisis("will my job work out?"));
});
