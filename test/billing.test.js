// Billing against a fake Stripe API, with webhooks signed the way Stripe signs them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import Stripe from "stripe";

const SECRET = "whsec_test_secret";
const calls = [];
let fake, server, base;
const subscription = (status, extra = {}) => ({
  id: "sub_1", object: "subscription", customer: "cus_1", status, cancel_at_period_end: false, metadata: { user_id: "u-buyer" },
  items: { data: [{ current_period_end: 1893456000, price: { id: "price_m", recurring: { interval: "month" } } }] }, ...extra,
});

before(async () => {
  fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      calls.push({ method: req.method, path: u.pathname, query: u.search, body: new URLSearchParams(body) });
      res.setHeader("content-type", "application/json");
      const send = o => res.end(JSON.stringify(o));
      if (u.pathname === "/v1/prices") return send({ object: "list", data: [{ id: "price_" + u.searchParams.get("lookup_keys[0]") }] });
      if (u.pathname === "/v1/customers") return send({ id: "cus_1", object: "customer" });
      if (u.pathname === "/v1/checkout/sessions") return send({ id: "cs_1", object: "checkout.session", url: "https://checkout.stripe.test/cs_1" });
      if (u.pathname === "/v1/billing_portal/sessions") return send({ id: "bps_1", url: "https://billing.stripe.test/p" });
      if (u.pathname === "/v1/subscriptions/sub_1") return send(subscription("active"));
      res.statusCode = 404; send({ error: { message: "not found" } });
    });
  });
  await new Promise(r => fake.listen(0, r));
  const port = 22000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", AUTH_TEST_TOKENS: "1",
    STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_API_BASE: "http://localhost:" + fake.address().port, PUBLIC_URL: "https://divinatey.test" };
  delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY; delete env.SUPABASE_SERVICE_KEY;
  server = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise(r => server.stdout.on("data", r));
});
after(() => { server.kill(); fake.close(); });

const BUYER = "test:u-buyer:buyer@example.com:free";
const call = (method, path, token, body) => fetch(base + path, {
  method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json() }));
let n = 0;
function webhook(type, object, { signed = true } = {}) {
  const payload = JSON.stringify({ id: "evt_" + (++n), object: "event", type, data: { object } });
  const sig = signed ? Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) : "t=1,v1=bad";
  return fetch(base + "/api/stripe/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body: payload })
    .then(async r => ({ status: r.status, body: await r.json(), payload }));
}

test("config says billing is on", async () => {
  assert.equal((await call("GET", "/api/config")).body.billing, true);
});

test("checkout: signed in only, the right price, one Stripe customer per account", async () => {
  assert.equal((await call("POST", "/api/billing/checkout", null, { kind: "monthly" })).status, 401);
  const r = await call("POST", "/api/billing/checkout", BUYER, { kind: "monthly", returnPath: "/preview/account" });
  assert.equal(r.status, 200);
  assert.equal(r.body.url, "https://checkout.stripe.test/cs_1");
  const s = calls.find(c => c.path === "/v1/checkout/sessions").body;
  assert.equal(s.get("mode"), "subscription");
  assert.equal(s.get("line_items[0][price]"), "price_divinatey_monthly");
  assert.equal(s.get("client_reference_id"), "u-buyer");
  assert.equal(s.get("customer"), "cus_1");
  assert.equal(s.get("success_url"), "https://divinatey.test/preview/account?checkout=success");
  await call("POST", "/api/billing/checkout", BUYER, { kind: "yearly", returnPath: "https://evil.example/" });
  const s2 = calls.filter(c => c.path === "/v1/checkout/sessions")[1].body;
  assert.equal(s2.get("line_items[0][price]"), "price_divinatey_yearly");
  assert.equal(s2.get("success_url"), "https://divinatey.test/account?checkout=success", "unknown return paths fall back to /account");
  assert.equal(calls.filter(c => c.path === "/v1/customers").length, 1, "customer reused");
  assert.equal((await call("POST", "/api/billing/checkout", BUYER, { kind: "extra" })).status, 403, "extra questions are for the paid plan");
  assert.equal((await call("POST", "/api/billing/checkout", BUYER, { kind: "lifetime" })).status, 400);
});

test("webhooks: signature checked, subscription turns the plan on and off, duplicates ignored", async () => {
  assert.equal((await webhook("checkout.session.completed", {}, { signed: false })).status, 400);

  const done = await webhook("checkout.session.completed", { id: "cs_1", mode: "subscription", customer: "cus_1", subscription: "sub_1", client_reference_id: "u-buyer", metadata: { user_id: "u-buyer", kind: "monthly" } });
  assert.equal(done.body.result, "subscribed");
  let me = (await call("GET", "/api/me", BUYER)).body;
  assert.equal(me.plan, "paid");
  assert.equal(me.billing.subscribed, true);
  assert.equal(me.billing.interval, "month");
  assert.equal(me.billing.renewsAt, "2030-01-01T00:00:00.000Z");
  assert.equal((await call("POST", "/api/billing/checkout", BUYER, { kind: "monthly" })).status, 409, "already subscribed");

  // The same event delivered twice is applied once.
  const again = await fetch(base + "/api/stripe/webhook", { method: "POST", headers: { "content-type": "application/json",
    "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: done.payload, secret: SECRET }) }, body: done.payload }).then(r => r.json());
  assert.equal(again.result, "duplicate");

  await webhook("customer.subscription.updated", subscription("active", { cancel_at_period_end: true }));
  me = (await call("GET", "/api/me", BUYER)).body;
  assert.equal(me.plan, "paid");
  assert.equal(me.billing.cancelAtPeriodEnd, true);

  await webhook("customer.subscription.updated", subscription("past_due"));
  assert.equal((await call("GET", "/api/me", BUYER)).body.plan, "paid", "a failed renewal keeps access while Stripe retries");

  // Extra questions
  const extra = await webhook("checkout.session.completed", { id: "cs_2", mode: "payment", payment_status: "paid", customer: "cus_1", client_reference_id: "u-buyer", metadata: { user_id: "u-buyer", kind: "extra" } });
  assert.equal(extra.body.result, "extra_question");
  assert.equal((await call("GET", "/api/me", BUYER)).body.billing.extraQuestions, 1);
  const ex = await call("POST", "/api/billing/checkout", BUYER, { kind: "extra" });
  assert.equal(ex.status, 200);
  assert.equal(calls.filter(c => c.path === "/v1/checkout/sessions").at(-1).body.get("mode"), "payment");

  const portal = await call("POST", "/api/billing/portal", BUYER, { returnPath: "/account" });
  assert.equal(portal.body.url, "https://billing.stripe.test/p");

  await webhook("customer.subscription.deleted", subscription("canceled"));
  me = (await call("GET", "/api/me", BUYER)).body;
  assert.equal(me.plan, "free");
  assert.equal(me.billing.subscribed, false);
});
