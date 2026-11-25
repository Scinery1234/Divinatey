// Saved charts are sealed with AES-256-GCM before they reach the store.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createVault, withVault } from "../server/vault.js";
import { createStore } from "../server/store.js";

const key = () => crypto.randomBytes(32).toString("base64");
const chart = { system: "natal", name: "Ava", birth: { date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 } };

test("no key, no vault; a bad key is refused", () => {
  assert.equal(createVault({}), null);
  assert.throws(() => createVault({ CHART_ENCRYPTION_KEY: "short" }), /32 bytes/);
});

test("the store only ever holds ciphertext; the account reads its charts back", async () => {
  const raw = createStore({});
  const vault = createVault({ CHART_ENCRYPTION_KEY: key() });
  const store = withVault(raw, vault);
  await store.saveChart("u1", 1, chart);
  const [stored] = await raw.listCharts("u1");
  assert.equal(stored.name, "", "name label is inside the sealed box");
  const text = JSON.stringify(stored);
  assert.doesNotMatch(text, /Ava|1990|Sydney|33\.87/);
  assert.deepEqual(Object.keys(stored.birth).sort(), ["ct", "iv", "tag", "v"]);
  const [back] = await store.listCharts("u1");
  assert.equal(back.name, "Ava");
  assert.deepEqual(back.birth, chart.birth);
});

test("ciphertext moved to another account or slot, tampered, or under a lost key doesn't open", async () => {
  const raw = createStore({});
  const k = key();
  const store = withVault(raw, createVault({ CHART_ENCRYPTION_KEY: k }));
  await store.saveChart("u1", 1, chart);
  const [{ system, name, birth }] = await raw.listCharts("u1");
  const stored = { system, name, birth };
  await raw.saveChart("u2", 1, stored);                  // copied to someone else
  assert.equal((await store.listCharts("u2"))[0].locked, true);
  await raw.saveChart("u1", 2, stored);                  // copied to the other slot
  assert.equal((await store.listCharts("u1"))[1].locked, true);
  const bad = { ...stored, birth: { ...stored.birth, ct: Buffer.from("x" + stored.birth.ct).toString("base64") } };
  await raw.saveChart("u3", 1, bad);
  assert.equal((await store.listCharts("u3"))[0].locked, true);
  const other = withVault(raw, createVault({ CHART_ENCRYPTION_KEY: key() }));
  assert.equal((await other.listCharts("u1"))[0].locked, true, "wrong key");
  const rotated = withVault(raw, createVault({ CHART_ENCRYPTION_KEY: key(), CHART_ENCRYPTION_OLD_KEYS: k }));
  assert.equal((await rotated.listCharts("u1"))[0].name, "Ava", "old keys still read");
});

test("charts saved before encryption was switched on still read", async () => {
  const raw = createStore({});
  await raw.saveChart("u1", 1, chart);
  const [c] = await withVault(raw, createVault({ CHART_ENCRYPTION_KEY: key() })).listCharts("u1");
  assert.equal(c.name, "Ava");
});
