// Accounts and saved charts, against the in-memory store with test tokens
// (stands in for Supabase; the Supabase store itself is not exercised here).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let server, base;
before(async () => {
  const port = 20000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", AUTH_TEST_TOKENS: "1", FREE_CHARTS_PER_DAY: "1", COMP_EMAILS: " Owner@Example.com ,tester@example.com", CHART_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
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
  assert.deepEqual((await call("GET", "/api/config")).body, { auth: null, preview: true, billing: false });
});

test("me needs a valid session", async () => {
  assert.equal((await call("GET", "/api/me")).status, 401);
  assert.equal((await call("GET", "/api/me", "not-a-token")).status, 401);
  const me = await call("GET", "/api/me", FREE);
  assert.deepEqual(me.body, { email: "free@example.com", plan: "free", slots: 1, charts: [],
    free: { chats: { used: 0, max: 5 }, chartReadings: { used: 0, max: 1 } },
    billing: { enabled: false, subscribed: false, status: null, interval: null, renewsAt: null, cancelAtPeriodEnd: false, hasCustomer: false, extraQuestions: 0 },
    questions: { used: 0, max: 5 } });
});

test("free accounts save one chart; the second slot is paid", async () => {
  const F = "test:u-free1:f1@example.com:free";
  assert.equal((await call("PUT", "/api/charts/1", F, natal)).status, 200);
  const r = await call("PUT", "/api/charts/2", F, natal);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "paid_required");
  assert.equal((await call("GET", "/api/me", F)).body.charts.length, 1);
});

test("paid accounts save two slots, validated, and can delete", async () => {
  assert.equal((await call("PUT", "/api/charts/3", PAID, natal)).status, 400);
  assert.equal((await call("PUT", "/api/charts/1", PAID, { ...natal, lat: 999 })).status, 400);
  const a = await call("PUT", "/api/charts/1", PAID, natal);
  assert.equal(a.status, 200);
  assert.equal("place" in a.body.charts[0].birth, false, "the place name isn't kept");
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
  assert.equal((await call("POST", "/api/chart", FREE, { ...natal, system: "vedic", date: "1985-03-02" })).status, 429);
  const stale = await call("POST", "/api/chart", "expired-token", { ...natal, system: "vedic" });
  assert.equal(stale.status, 200, "a stale token is treated as signed out, not an error");
  const paid = await call("POST", "/api/chart", PAID, { ...natal, system: "vedic" });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.quota, null);
});

test("paid preview: anyone can chat and skip the chart limit, only with the header", async () => {
  const pv = (method, path, body, token) => fetch(base + path, {
    method, headers: { "content-type": "application/json", "x-paid-preview": "1", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json() }));
  // FREE_CHARTS_PER_DAY is 1 here and this IP has used it already.
  const c = await pv("POST", "/api/chart", { ...natal, system: "gene-keys", date: "1972-12-24" });
  assert.equal(c.status, 200);
  assert.equal(c.body.quota, null);
  const { body: { seed } } = await pv("POST", "/api/draw", {});
  const chat = await pv("POST", "/api/chat", { seed, history: [] });
  assert.equal(chat.status, 400, "past the paywall: fails only on the empty history");
  assert.equal((await call("POST", "/api/chat", null, { seed, history: [] })).status, 401, "without the header chat stays locked");
  const me = await pv("GET", "/api/me", null, FREE);
  assert.equal(me.body.plan, "paid", "signed-in users count as paid in the preview");
  assert.equal((await pv("PUT", "/api/charts/1", natal, FREE)).status, 200);
  assert.equal((await pv("PUT", "/api/charts/1", natal)).status, 401, "saving still needs an account");
});

test("COMP_EMAILS accounts get the paid plan without Stripe, wherever they are", async () => {
  const OWNER = "test:u-owner:owner@example.com:free";
  const me = (await call("GET", "/api/me", OWNER)).body;
  assert.equal(me.plan, "paid");
  assert.equal(me.billing.subscribed, false);
  assert.equal((await call("PUT", "/api/charts/1", OWNER, natal)).status, 200, "saves charts");
  assert.equal((await call("GET", "/api/me", FREE)).body.plan, "free", "others stay free");
});

test("saved charts keep only what the chart needs: rounded coordinates, no place name", async () => {
  const U = "test:u-min:min@example.com:paid";
  const r = await call("PUT", "/api/charts/1", U, { ...natal, lat: -33.868819, lon: 151.209295 });
  assert.equal(r.status, 200);
  const b = r.body.charts[0].birth;
  assert.deepEqual(b, { date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 });
});

test("download my data: everything kept, for the signed-in account only", async () => {
  const U = "test:u-exp:exp@example.com:paid";
  assert.equal((await call("GET", "/api/me/export")).status, 401);
  await call("PUT", "/api/charts/2", U, natal);
  const r = await fetch(base + "/api/me/export", { headers: { authorization: "Bearer " + U } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition"), /attachment; filename="divinatey-my-data.json"/);
  const d = await r.json();
  assert.equal(d.account.email, "exp@example.com");
  assert.equal(d.saved_charts.length, 1);
  assert.equal(d.saved_charts[0].name, "Me");
  assert.equal(d.saved_charts[0].birth.date, "1990-07-15");
  assert.deepEqual(d.linked_questions, []);
});

test("delete my account: needs confirmation, removes everything, and the session stops working", async () => {
  const U = "test:u-del:del@example.com:paid";
  await call("PUT", "/api/charts/1", U, natal);
  assert.equal((await call("DELETE", "/api/me", U, {})).status, 400, "confirmation required");
  assert.equal((await call("DELETE", "/api/me", null, { confirm: "DELETE" })).status, 401);
  const r = await call("DELETE", "/api/me", U, { confirm: "DELETE" });
  assert.deepEqual(r.body, { deleted: true });
  assert.equal((await call("GET", "/api/me", U)).status, 401);
});

test("security headers on pages and API", async () => {
  for (const path of ["/", "/api/config"]) {
    const h = (await fetch(base + path)).headers;
    const csp = h.get("content-security-policy");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/, "no inline or third-party scripts without Turnstile");
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(h.get("x-content-type-options"), "nosniff");
    assert.equal(h.get("x-frame-options"), "DENY");
    assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  }
  assert.equal((await fetch(base + "/api/config")).headers.get("cache-control"), "no-store");
});

test("health check reports the chart server", async () => {
  assert.deepEqual((await call("GET", "/api/health")).body, { ok: true, charts: true });
});
