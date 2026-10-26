// Accounts and saved charts, against the in-memory store with test tokens
// (stands in for Supabase; the Supabase store itself is not exercised here).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let server, base;
before(async () => {
  const port = 20000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", AUTH_TEST_TOKENS: "1", FREE_CHARTS_PER_DAY: "1" };
  delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY; delete env.SUPABASE_SERVICE_KEY;
  server = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise(r => server.stdout.on("data", r));
});
after(() => server.kill());

const FREE = "test:u-free:free@example.com:free", PAID = "test:u-paid:paid@example.com:paid";
const call = (method, path, token, body) => fetch(base + path, {
  method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json() }));
const natal = { system: "natal", name: "Me", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21, place: "Sydney, New South Wales, Australia" };

test("config reports accounts off without Supabase keys", async () => {
  assert.deepEqual((await call("GET", "/api/config")).body, { auth: null });
});

test("me needs a valid session", async () => {
  assert.equal((await call("GET", "/api/me")).status, 401);
  assert.equal((await call("GET", "/api/me", "not-a-token")).status, 401);
  const me = await call("GET", "/api/me", FREE);
  assert.deepEqual(me.body, { email: "free@example.com", plan: "free", slots: 2, charts: [] });
});

test("free accounts can't save charts", async () => {
  const r = await call("PUT", "/api/charts/1", FREE, natal);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "paid_required");
});

test("paid accounts save two slots, validated, and can delete", async () => {
  assert.equal((await call("PUT", "/api/charts/3", PAID, natal)).status, 400);
  assert.equal((await call("PUT", "/api/charts/1", PAID, { ...natal, lat: 999 })).status, 400);
  const a = await call("PUT", "/api/charts/1", PAID, natal);
  assert.equal(a.status, 200);
  assert.equal(a.body.charts[0].birth.place, "Sydney, New South Wales, Australia");
  const b = await call("PUT", "/api/charts/2", PAID, { system: "human-design", name: "Partner", date: "1988-02-01", time: "08:00", tz: "Europe/London" });
  assert.deepEqual(b.body.charts.map(c => [c.slot, c.system, c.name]), [[1, "natal", "Me"], [2, "human-design", "Partner"]]);
  assert.equal("lat" in b.body.charts[1].birth, false);
  const other = await call("GET", "/api/me", "test:u-other:o@example.com:paid");
  assert.deepEqual(other.body.charts, [], "charts are per account");
  const d = await call("DELETE", "/api/charts/1", PAID);
  assert.deepEqual(d.body.charts.map(c => c.slot), [2]);
});

test("paid accounts skip the free daily limit; free accounts don't", async () => {
  const one = await call("POST", "/api/chart", null, natal);
  assert.equal(one.status, 200);
  assert.equal((await call("POST", "/api/chart", FREE, { ...natal, system: "vedic" })).status, 429);
  const stale = await call("POST", "/api/chart", "expired-token", natal);
  assert.equal(stale.status, 200, "a stale token is treated as signed out, not an error");
  const paid = await call("POST", "/api/chart", PAID, { ...natal, system: "vedic" });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.quota, null);
});
