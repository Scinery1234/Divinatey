import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { divineReading, isValidSeed } from "../shared/oracle.js";
import { getQuantumSeed } from "./seed.js";
import { interpretReading, chat, chartChat, writeText, linkedChat, OracleRefusal } from "./oracle-ai.js";
import { rateLimit } from "./rate-limit.js";
import { freeChartLimit } from "./free-limit.js";
import { createStore, SLOTS } from "./store.js";
import { createBilling, BillingError } from "./billing.js";
import { searchPlaces, warmPlaces, chartChatContext, chartFactCards, guidePrompt, readingPrompt, parseChartInput, renderChart, chartKey, systemMeta, ChartInputError } from "./astro.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const PORT = Number(process.env.PORT) || 8787;

const MAX_HISTORY = 19; // odd, so the trimmed history still starts with the user
const MAX_TEXT = 2000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
// Stripe webhook: needs the raw body to check Stripe's signature, so it comes
// before the JSON parser. (billing is created with the account routes below.)
app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  if (!billing) return res.status(404).json({ error: "billing off" });
  try {
    const result = await billing.webhook(req.body, req.get("stripe-signature"));
    console.log("Stripe webhook:", result);
    res.json({ received: true, result });
  } catch (err) {
    if (err instanceof BillingError) return res.status(err.status).json({ error: err.code });
    console.error("Stripe webhook failed:", err);
    res.status(500).json({ error: "internal" });      // Stripe retries
  }
});

app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  });
  next();
});

// Paid preview (/preview in the app): every paid feature unlocked for anyone,
// for testing before payments exist. PAID_PREVIEW=0 switches it off.
const PREVIEW_ON = process.env.PAID_PREVIEW !== "0";
const previewChatLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: Number(process.env.PREVIEW_CHAT_PER_10MIN) || 20 });
app.use("/api", (req, res, next) => { req.preview = PREVIEW_ON && req.get("x-paid-preview") === "1"; next(); });

const aiLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_10MIN) || 40,
});

// Readings are recomputed from the seed on every request, so the client can
// never put arbitrary content into the oracle's prompts.
function readingFrom(req, res) {
  const seed = req.body && req.body.seed;
  if (!isValidSeed(seed)) {
    res.status(400).json({ error: "invalid seed" });
    return null;
  }
  return divineReading(seed);
}

function sendError(res, err) {
  if (err instanceof OracleRefusal) return res.status(422).json({ error: "refused" });
  if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: "busy" });
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return res.status(502).json({ error: "upstream" });
  }
  console.error(err);
  return res.status(500).json({ error: "internal" });
}

app.get("/api/health", (req, res) => res.json({ ok: true, charts: true }));

app.post("/api/draw", async (req, res) => {
  const { seed, source } = await getQuantumSeed();
  res.json({ seed, source, reading: divineReading(seed) });
});

// The interpretation the server wrote for each draw, so the chat can stay
// consistent with what the page shows (kept a day, newest 2000 draws).
const interpretations = new Map();
function rememberInterpretation(seed, interp) {
  interpretations.set(String(seed), { interp, at: Date.now() });
  if (interpretations.size > 2000) interpretations.delete(interpretations.keys().next().value);
}
const cap = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
// Prefer the server's own copy; otherwise use the browser's, trimmed to size.
function interpretationFor(seed, reading, fromClient) {
  const kept = interpretations.get(String(seed));
  if (kept && Date.now() - kept.at < 864e5) return kept.interp;
  if (!fromClient || typeof fromClient !== "object") return null;
  const i = fromClient.iching || {}, t = Array.isArray(fromClient.tarot) ? fromClient.tarot : [];
  return {
    iching: { primary: cap(i.primary, 600), lines: cap(i.lines, 400), resulting: cap(i.resulting, 400) },
    // Card names come from the recalculated reading, never from the browser.
    tarot: reading.cards.map(c => {
      const hit = t.find(x => x && x.pos === c.pos);
      return { pos: c.pos, card: c.name, insight: hit ? cap(hit.insight, 400) : "" };
    }),
  };
}

app.post("/api/interpret", aiLimit, async (req, res) => {
  const reading = readingFrom(req, res);
  if (!reading) return;
  try {
    const out = await interpretReading(reading);
    rememberInterpretation(req.body.seed, out);
    res.json(out);
  } catch (err) {
    sendError(res, err);
  }
});

// Alternating user/assistant turns, starting and ending with the user.
function validHistory(history) {
  return Array.isArray(history) && history.length > 0 && history.length % 2 === 1 &&
    history.every((m, i) =>
      m && typeof m.text === "string" && m.text.length > 0 && m.text.length <= MAX_TEXT &&
      m.role === (i % 2 === 0 ? "user" : "assistant"));
}

// Chat is part of the paid plan. (identify, requireUser and requirePaid are
// defined with the account routes below; they're looked up per request.)
// In the paid preview anyone may chat, under a tighter per-IP limit.
const chatAccess = (req, res, next) => req.preview
  ? previewChatLimit(req, res, next)
  : identify(req, res, () => requireUser(req, res, () => requirePaid(req, res, next)));
app.post("/api/chat", aiLimit, chatAccess, async (req, res) => {
  const reading = readingFrom(req, res);
  if (!reading) return;
  const { synthesis, history } = req.body;
  if (!validHistory(history)) return res.status(400).json({ error: "invalid history" });
  // Keep the newest turns, starting on a user message.
  const trimmed = history.slice(-MAX_HISTORY);
  const synth = typeof synthesis === "string" ? synthesis.slice(0, 1000) : "";
  const interp = interpretationFor(req.body.seed, reading, req.body.interpretation);

  // Charts the person chose to link: recalculated here from the birth details.
  let charts = [];
  if (Array.isArray(req.body.charts) && req.body.charts.length) {
    try {
      const seen = new Set();
      charts = req.body.charts.slice(0, 5).map(parseChartInput).filter(c => !seen.has(c.system) && seen.add(c.system)).map(chartFactCards);
    } catch (err) {
      if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
      return sendError(res, err);
    }
  }
  if (!charts.length) {
    try { return res.json({ reply: await chat(reading, synth, trimmed, interp) }); }
    catch (err) { return sendError(res, err); }
  }

  // Linked questions: LINKED_QUESTIONS_PER_WEEK draws per paid account per week
  // (follow-ups on the same draw are free). Unlimited in the paid preview.
  const counted = !req.preview && req.user;
  const week = weekStart(), seed = String(req.body.seed);
  let useExtra = false;
  try {
    if (counted) {
      const asked = await store.linkedSeeds(req.user.id, week);
      if (!asked.has(seed) && asked.size >= LINKED_PER_WEEK) {
        // Over the weekly allowance: use a purchased extra question if there is one.
        const extra = (await store.getProfile(req.user.id, req.user)).extra_questions || 0;
        if (extra < 1) return res.status(429).json({ error: "question_limit", used: asked.size, max: LINKED_PER_WEEK, canBuy: !!billing });
        useExtra = true;
      }
    }
    const out = await linkedChat(reading, synth, trimmed, charts, interp);
    let questions = null;
    if (counted) {
      if (useExtra) await store.useExtraQuestion(req.user.id);     // charged only once the answer is ready
      await store.recordLinked(req.user.id, week, seed);
      const p = await store.getProfile(req.user.id, req.user);
      questions = { used: (await store.linkedSeeds(req.user.id, week)).size, max: LINKED_PER_WEEK, extra: p.extra_questions || 0 };
    }
    res.json({ ...out, questions });
  } catch (err) {
    sendError(res, err);
  }
});

const LINKED_PER_WEEK = Number(process.env.LINKED_QUESTIONS_PER_WEEK) || 5;
// Monday (UTC) of the current week, as YYYY-MM-DD.
function weekStart(d = new Date()) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m.toISOString().slice(0, 10);
}

// ── Accounts ─────────────────────────────────────────────────────────────────
const store = createStore();
const billing = createBilling({ store });
if (store.accounts && !process.env.AUTH_TEST_TOKENS && !process.env.FREE_LIMIT_SECRET)
  console.warn("FREE_LIMIT_SECRET is not set: free chart counts reset on every restart.");
const accountLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 120 });

// Sets req.user ({id, email, plan}) when the request carries a valid session token.
// identifyOptional treats a missing or stale token as signed out instead of failing.
const identify = (req, res, next) => identifyUser(req, res, next, false);
const identifyOptional = (req, res, next) => identifyUser(req, res, next, true);
async function identifyUser(req, res, next, optional) {
  const h = req.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return next();
  try {
    const user = await store.getUser(h.slice(7));
    if (!user) return optional ? next() : res.status(401).json({ error: "signed_out" });
    const profile = await store.getProfile(user.id, user);
    req.user = { id: user.id, email: user.email, plan: profile.plan === "paid" || req.preview ? "paid" : "free" };
    next();
  } catch (err) {
    // On routes that work signed out, an account-service failure shouldn't block the request.
    if (optional) { console.error("Account lookup failed; continuing signed out:", err.message || err); return next(); }
    sendError(res, err);
  }
}
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: "signed_out" });
const requirePaid = (req, res, next) => req.user.plan === "paid" ? next() : res.status(403).json({ error: "paid_required" });
const slotParam = (req, res) => {
  const slot = Number(req.params.slot);
  if (!SLOTS.includes(slot)) { res.status(400).json({ error: "invalid slot" }); return null; }
  return slot;
};

// The anon key is public by design: the browser needs it to sign in.
app.get("/api/config", (req, res) => {
  const url = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY;
  res.json({ auth: url && anonKey ? { url, anonKey } : null, preview: PREVIEW_ON, billing: !!billing });
});

app.get("/api/me", accountLimit, identify, requireUser, async (req, res) => {
  try {
    const p = await store.getProfile(req.user.id, req.user);
    const asked = await store.linkedSeeds(req.user.id, weekStart());
    res.json({
      email: req.user.email, plan: req.user.plan, slots: SLOTS.length, charts: await store.listCharts(req.user.id),
      billing: {
        enabled: !!billing, subscribed: !!p.subscription_id && p.plan === "paid", status: p.subscription_status || null,
        interval: p.billing_interval || null, renewsAt: p.plan_renews_at || null, cancelAtPeriodEnd: !!p.cancel_at_period_end,
        hasCustomer: !!p.stripe_customer_id, extraQuestions: p.extra_questions || 0,
      },
      questions: { used: asked.size, max: LINKED_PER_WEEK },
    });
  } catch (err) {
    sendError(res, err);
  }
});

app.put("/api/charts/:slot", accountLimit, identify, requireUser, requirePaid, async (req, res) => {
  const slot = slotParam(req, res);
  if (!slot) return;
  let inp;
  try {
    inp = parseChartInput(req.body);
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  const birth = { date: inp.date, time: inp.time, tz: inp.tz, place: String(req.body.place || "").slice(0, 120) };
  if ("lat" in inp) { birth.lat = inp.lat; birth.lon = inp.lon; }
  if (inp.birthName) birth.birthName = inp.birthName;
  try {
    await store.saveChart(req.user.id, slot, { system: inp.system, name: inp.name, birth });
    res.json({ charts: await store.listCharts(req.user.id) });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/charts/:slot", accountLimit, identify, requireUser, async (req, res) => {
  const slot = slotParam(req, res);
  if (!slot) return;
  try {
    await store.deleteChart(req.user.id, slot);
    res.json({ charts: await store.listCharts(req.user.id) });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Charts (no AI) ───────────────────────────────────────────────────────────
const placeLimit = rateLimit({ windowMs: 60 * 1000, max: 120 });
const chartLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 });
const freeCharts = freeChartLimit({
  max: Number(process.env.FREE_CHARTS_PER_DAY) || 2,
  store,
  secret: process.env.FREE_LIMIT_SECRET,
});

app.get("/api/systems", (req, res) => res.json(systemMeta()));

app.get("/api/places", placeLimit, (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  res.json(q.length < 2 ? [] : searchPlaces(q));
});

// Free: FREE_CHARTS_PER_DAY different people (birth details) per IP per day,
// each in every system. Paid and preview: no daily limit.
app.post("/api/chart", chartLimit, identifyOptional, async (req, res) => {
  let inp;
  try {
    inp = parseChartInput(req.body);
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  try {
    const paid = req.preview || (req.user && req.user.plan === "paid");
    const key = chartKey(inp);
    // If the usage store fails (e.g. Supabase tables missing), log it and let
    // the chart through rather than failing every free chart.
    const usage = async fn => { try { return await fn(); } catch (err) { console.error("Free chart usage store failed:", err.message || err); return null; } };
    if (!paid) {
      const quota = await usage(() => freeCharts.check(req.ip, key));
      if (quota && !quota.ok) return res.status(429).json({ error: "free_limit", used: quota.used, max: quota.max });
    }
    const chart = renderChart(inp);
    res.json({ ...chart, quota: paid ? null : await usage(() => freeCharts.record(req.ip, key)) });
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    sendError(res, err);
  }
});

// Chat about one chart (paid / preview). The chart is recalculated from the
// birth details, so the browser never supplies prompt text.
app.post("/api/chart-chat", aiLimit, chatAccess, async (req, res) => {
  let ctx;
  try {
    ctx = chartChatContext(parseChartInput(req.body.chart));
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  const { history } = req.body;
  if (!validHistory(history)) return res.status(400).json({ error: "invalid history" });
  try {
    res.json({ reply: await chartChat(ctx, history.slice(-MAX_HISTORY)) });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Chart explanations and readings (paid / preview) ─────────────────────────
// Each is one independent call built on the server from the recalculated
// chart. Identical prompts within an hour reuse the answer, to save cost.
const paidAccess = (req, res, next) => req.preview ? next()
  : identify(req, res, () => requireUser(req, res, () => requirePaid(req, res, next)));
const explainLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: Number(process.env.EXPLAIN_PER_10MIN) || 60 });
const textCache = new Map();
async function cachedText(prompt) {
  const hit = textCache.get(prompt);
  if (hit && Date.now() - hit.at < 3600e3) return hit.text;
  const text = await writeText(prompt);
  textCache.set(prompt, { text, at: Date.now() });
  if (textCache.size > 500) textCache.delete(textCache.keys().next().value);
  return text;
}
async function respondWithText(res, makePrompt) {
  let prompt;
  try { prompt = makePrompt(); }
  catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  try { res.json({ text: await cachedText(prompt) }); }
  catch (err) { sendError(res, err); }
}

app.post("/api/chart-explain", explainLimit, paidAccess, (req, res) =>
  respondWithText(res, () => guidePrompt(parseChartInput(req.body.chart), String(req.body.tab || ""), req.body.item)));

app.post("/api/chart-reading", explainLimit, paidAccess, (req, res) =>
  respondWithText(res, () => readingPrompt(parseChartInput(req.body.chart), req.body.section, !!req.body.technical)));

// ── Billing ──────────────────────────────────────────────────────────────────
// Return pages Stripe may send people back to (relative to the site).
const RETURN_PATHS = new Set(["/account", "/preview/account", "/", "/preview"]);
function returnUrl(req) {
  const path = RETURN_PATHS.has(req.body && req.body.returnPath) ? req.body.returnPath : "/account";
  const base = (process.env.PUBLIC_URL || req.protocol + "://" + req.get("host")).replace(/\/+$/, "");
  return base + path;
}
const billingRoute = fn => async (req, res) => {
  if (!billing) return res.status(503).json({ error: "billing_off" });
  try { res.json({ url: await fn(req) }); }
  catch (err) {
    if (err instanceof BillingError) return res.status(err.status).json({ error: err.code });
    console.error("Billing error:", err.message || err);
    res.status(502).json({ error: "billing_upstream" });
  }
};
app.post("/api/billing/checkout", accountLimit, identify, requireUser,
  billingRoute(req => billing.checkout(req.user, String(req.body.kind || ""), returnUrl(req))));
app.post("/api/billing/portal", accountLimit, identify, requireUser,
  billingRoute(req => billing.portal(req.user, returnUrl(req))));

app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));

// Production: serve the built client with SPA fallback.
app.use(express.static(dist, { index: false, maxAge: "1h" }));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(dist, "index.html"), err => err && next());
});

app.listen(PORT, () => {
  console.log("Divinatey listening on http://localhost:" + PORT);
  // Build the place index now so the first birth-place search is instant.
  setImmediate(() => { const t = Date.now(); warmPlaces(); console.log("Place index ready in " + (Date.now() - t) + " ms"); });
});
