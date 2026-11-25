import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { divineReading, isValidSeed, describeReading } from "../shared/oracle.js";
import { getQuantumSeed } from "./seed.js";
import { interpretReading, chat, chartChat, writeText, linkedChat, OracleRefusal } from "./oracle-ai.js";
import { rateLimit } from "./rate-limit.js";
import { freeChartLimit } from "./free-limit.js";
import { createStore, SLOTS } from "./store.js";
import { createBilling, BillingError } from "./billing.js";
import { securityHeaders } from "./headers.js";
import { searchPlaces, warmPlaces, chartChatContext, chartFactCards, guidePrompt, readingPrompt, parseChartInput, renderChart, chartKey, systemMeta, ChartInputError } from "./astro.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const PORT = Number(process.env.PORT) || 8787;

const MAX_HISTORY = 19; // odd, so the trimmed history still starts with the user
const MAX_TEXT = 2000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
app.use(securityHeaders());
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

// Why Claude's API turned a request down, in terms the site owner can act on.
function upstreamReason(err) {
  const m = (err.message || "").toLowerCase();
  if (err.status === 401 || err.status === 403) return "key";
  if (m.includes("credit balance") || m.includes("billing")) return "credit";
  if (err.status === 404 || (err.status === 400 && m.includes("model"))) return "model";
  if (err.status === 529 || m.includes("overloaded")) return "overloaded";
  if (err.status >= 500 || !err.status) return "outage";
  return "request";
}

function sendError(res, err) {
  if (err instanceof OracleRefusal) return res.status(422).json({ error: "refused" });
  if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: "busy" });
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return res.status(502).json({ error: "upstream", reason: upstreamReason(err), status: err.status || null });
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

app.post("/api/interpret", aiLimit, (req, res, next) => identifyOptional(req, res, next), async (req, res) => {
  const reading = readingFrom(req, res);
  if (!reading) return;
  try {
    const out = await interpretReading(reading);
    rememberInterpretation(req.body.seed, out);
    if (req.user) await keepReading(req.user.id, req.body.seed, { interp: out });
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

// Chat needs an account: paid accounts chat freely, free accounts get
// FREE_CHATS_PER_WEEK oracle messages a week (linking charts stays paid).
// (identify and requireUser are defined with the account routes
// below; they're looked up per request.) In the paid preview anyone may chat,
// under a tighter per-IP limit.
const FREE_CHATS = Number(process.env.FREE_CHATS_PER_WEEK) || 5;
const FREE_CHART_READINGS = Number(process.env.FREE_CHART_READINGS_PER_WEEK) || 1;
const chatAccess = (req, res, next) => req.preview
  ? identifyOptional(req, res, () => previewChatLimit(req, res, next))
  : identify(req, res, () => requireUser(req, res, () => {
    if (req.user.plan === "paid") return next();
    if (req.path === "/api/chat" && !(Array.isArray(req.body.charts) && req.body.charts.length)) { req.freeChat = true; return next(); }
    res.status(403).json({ error: "paid_required" });
  }));

// A draw kept with the account: its interpretation and the chat about it.
async function keepReading(userId, seed, patch) {
  try {
    const old = await store.getReading(userId, seed);
    await store.saveReading(userId, seed, { ...(old ? old.data : {}), ...patch });
  } catch (err) { console.error("Couldn't keep the reading:", err.message || err); }
}
// The oracle's memory of earlier draws: when, what was drawn and the person's own
// first question. Built from stored facts only, never from earlier AI replies.
async function memoryFor(userId, seed) {
  try {
    const rows = (await store.listReadings(userId, 6)).filter(r => r.seed !== String(seed)).slice(0, 5);
    return rows.map(r => {
      const first = (r.data.messages || []).find(m => m.role === "user");
      return "- " + r.created_at.slice(0, 10) + ": " + describeReading(divineReading(Number(r.seed))) + (first ? ". They asked: \"" + first.text.slice(0, 200) + "\"" : "");
    }).join("\n");
  } catch (err) { console.error("Couldn't load reading history:", err.message || err); return ""; }
}
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
  const memory = req.user ? await memoryFor(req.user.id, req.body.seed) : "";
  const keep = reply => req.user && keepReading(req.user.id, req.body.seed, { messages: [...history, { role: "assistant", text: reply }].slice(-60) });
  if (!charts.length) {
    try {
      let chats = null;
      if (req.freeChat) {
        const used = await store.usageKeys(req.user.id, weekStart(), "chat");
        if (used.size >= FREE_CHATS) return res.status(429).json({ error: "chat_limit", used: used.size, max: FREE_CHATS });
      }
      const reply = await chat(reading, synth, trimmed, interp, memory);
      if (req.freeChat) {
        await store.recordUse(req.user.id, weekStart(), "chat", crypto.randomUUID());
        chats = { used: (await store.usageKeys(req.user.id, weekStart(), "chat")).size, max: FREE_CHATS };
      }
      await keep(reply);
      return res.json({ reply, ...(chats ? { chats } : {}) });
    }
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
    const out = await linkedChat(reading, synth, trimmed, charts, interp, memory);
    await keep(out.reply);
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
if (store.accounts && !process.env.AUTH_TEST_TOKENS && !process.env.CHART_ENCRYPTION_KEY)
  console.warn("CHART_ENCRYPTION_KEY is not set: saved charts are stored unencrypted. Set it (openssl rand -base64 32).");
if (store.accounts && !process.env.AUTH_TEST_TOKENS && !process.env.FREE_LIMIT_SECRET)
  console.warn("FREE_LIMIT_SECRET is not set: free chart counts reset on every restart.");
const accountLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 120 });

// Sets req.user ({id, email, plan}) when the request carries a valid session token.
// identifyOptional treats a missing or stale token as signed out instead of failing.
// Accounts given the paid plan without Stripe (the owner, testers): COMP_EMAILS=a@x.com,b@y.com
const COMP_EMAILS = new Set((process.env.COMP_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean));
const isComp = email => !!email && COMP_EMAILS.has(String(email).toLowerCase());
const identify = (req, res, next) => identifyUser(req, res, next, false);
const identifyOptional = (req, res, next) => identifyUser(req, res, next, true);
async function identifyUser(req, res, next, optional) {
  const h = req.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return next();
  try {
    const user = await store.getUser(h.slice(7));
    if (!user) return optional ? next() : res.status(401).json({ error: "signed_out" });
    const profile = await store.getProfile(user.id, user);
    req.user = { id: user.id, email: user.email, plan: profile.plan === "paid" || req.preview || isComp(user.email) ? "paid" : "free" };
    next();
  } catch (err) {
    // On routes that work signed out, an account-service failure shouldn't block the request.
    if (optional) { console.error("Account lookup failed; continuing signed out:", err.message || err); return next(); }
    sendError(res, err);
  }
}
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: "signed_out" });
const slotParam = (req, res) => {
  const slot = Number(req.params.slot);
  if (!SLOTS.includes(slot)) { res.status(400).json({ error: "invalid slot" }); return null; }
  return slot;
};

// Google AdSense, for signed-out visitors and free accounts (paid accounts and
// the preview are ad-free; the browser decides who sees slots, from /api/me).
// ADSENSE_CLIENT is the publisher id (ca-pub-…); slot ids per placement.
const ADSENSE = /^ca-pub-\d{10,20}$/.test(process.env.ADSENSE_CLIENT || "") ? {
  client: process.env.ADSENSE_CLIENT,
  slots: Object.fromEntries(["home", "reading", "chart"].map(k => [k, process.env["ADSENSE_SLOT_" + k.toUpperCase()] || process.env.ADSENSE_SLOT || ""]).filter(([, v]) => /^\d+$/.test(v))),
} : null;
if (process.env.ADSENSE_CLIENT && !ADSENSE) console.warn("ADSENSE_CLIENT should look like ca-pub-1234567890123456; ads are off.");
// ads.txt tells ad buyers this site's inventory is sold by this publisher.
app.get("/ads.txt", (req, res) => {
  if (!ADSENSE) return res.status(404).type("text/plain").send("");
  res.type("text/plain").send("google.com, " + ADSENSE.client.replace(/^ca-/, "") + ", DIRECT, f08c47fec0942fa0\n");
});

// The anon key is public by design: the browser needs it to sign in.
app.get("/api/config", (req, res) => {
  const url = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY;
  res.json({ auth: url && anonKey ? { url, anonKey } : null, preview: PREVIEW_ON, billing: !!billing,
    ...(process.env.TURNSTILE_SITE_KEY ? { captcha: process.env.TURNSTILE_SITE_KEY } : {}),
    ...(ADSENSE ? { ads: ADSENSE } : {}) });
});

app.get("/api/me", accountLimit, identify, requireUser, async (req, res) => {
  try {
    const p = await store.getProfile(req.user.id, req.user);
    const asked = await store.linkedSeeds(req.user.id, weekStart());
    const paid = req.user.plan === "paid";
    const free = paid ? null : {
      chats: { used: (await store.usageKeys(req.user.id, weekStart(), "chat")).size, max: FREE_CHATS },
      chartReadings: { used: (await store.usageKeys(req.user.id, weekStart(), "chart_reading")).size, max: FREE_CHART_READINGS },
    };
    res.json({
      email: req.user.email, plan: req.user.plan, slots: paid ? SLOTS.length : 1, charts: await store.listCharts(req.user.id), free,
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

// Everything kept about the account, as a file the person can download.
app.get("/api/me/export", accountLimit, identify, requireUser, async (req, res) => {
  try {
    const p = await store.getProfile(req.user.id, req.user);
    const data = {
      exported_at: new Date().toISOString(),
      account: { email: req.user.email, plan: req.user.plan },
      billing: { plan: p.plan, subscription_status: p.subscription_status, billing_interval: p.billing_interval,
        plan_renews_at: p.plan_renews_at, cancel_at_period_end: !!p.cancel_at_period_end, extra_questions: p.extra_questions || 0,
        stripe_customer_id: p.stripe_customer_id },
      saved_charts: (await store.listCharts(req.user.id)).map(c => ({ slot: c.slot, system: c.system, name: c.name, birth: c.birth, saved_at: c.updated_at, ...(c.locked ? { locked: true } : {}) })),
      linked_questions: await store.listLinked(req.user.id),
      readings: (await store.listReadings(req.user.id, 1000)).map(r => ({ seed: r.seed, drawn_at: r.created_at, ...r.data })),
      not_kept: "Unsaved charts are never stored. Payment cards are held by Stripe, not Divinatey.",
    };
    res.set("Content-Disposition", 'attachment; filename="divinatey-my-data.json"');
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
});

// Deletes the account and everything kept with it, ending any subscription first.
app.delete("/api/me", accountLimit, identify, requireUser, async (req, res) => {
  if (!req.body || req.body.confirm !== "DELETE") return res.status(400).json({ error: "confirm_required" });
  try {
    if (billing) await billing.cancelForDeletion(await store.getProfile(req.user.id, req.user));
    await store.deleteUser(req.user.id);
    res.json({ deleted: true });
  } catch (err) {
    if (err && err.type && String(err.type).startsWith("Stripe")) { console.error("Stripe cancel failed:", err.message); return res.status(502).json({ error: "billing_upstream" }); }
    sendError(res, err);
  }
});

// Past readings kept with the account.
app.get("/api/me/readings", accountLimit, identify, requireUser, async (req, res) => {
  try {
    const rows = await store.listReadings(req.user.id, 50);
    res.json({ readings: rows.map(row => {
      const r = divineReading(Number(row.seed)), msgs = row.data.messages || [];
      const first = msgs.find(m => m.role === "user");
      return { seed: row.seed, drawnAt: row.created_at, updatedAt: row.updated_at, hexagram: r.pHex + " " + r.pName,
        cards: r.cards.map(c => c.name), question: first ? first.text.slice(0, 140) : "", messages: msgs.length };
    }) });
  } catch (err) { sendError(res, err); }
});
app.get("/api/me/readings/:seed", accountLimit, identify, requireUser, async (req, res) => {
  if (!isValidSeed(Number(req.params.seed))) return res.status(400).json({ error: "invalid seed" });
  try {
    const row = await store.getReading(req.user.id, req.params.seed);
    if (!row) return res.status(404).json({ error: "not_found" });
    const seed = Number(row.seed);
    if (row.data.interp) rememberInterpretation(seed, row.data.interp);
    res.json({ seed, reading: divineReading(seed), interp: row.data.interp || null, messages: row.data.messages || [], drawnAt: row.created_at });
  } catch (err) { sendError(res, err); }
});
app.delete("/api/me/readings/:seed", accountLimit, identify, requireUser, async (req, res) => {
  try { await store.deleteReading(req.user.id, req.params.seed === "all" ? null : req.params.seed); res.json({ deleted: true }); }
  catch (err) { sendError(res, err); }
});

app.put("/api/charts/:slot", accountLimit, identify, requireUser, async (req, res) => {
  const slot = slotParam(req, res);
  if (!slot) return;
  if (req.user.plan !== "paid" && slot !== 1) return res.status(403).json({ error: "paid_required" });   // free accounts: one slot
  let inp;
  try {
    inp = parseChartInput(req.body);
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  // Kept to what the chart needs: coordinates rounded to about 1 km (the chart
  // doesn't change), and no place name; the timezone labels it instead.
  const birth = { date: inp.date, time: inp.time, tz: inp.tz };
  if ("lat" in inp) { birth.lat = Math.round(inp.lat * 100) / 100; birth.lon = Math.round(inp.lon * 100) / 100; }
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
// Paid accounts: unlimited. Free accounts: FREE_CHART_READINGS charts a week get
// their AI reading and explanations (the same chart can be revisited all week).
const paidAccess = (req, res, next) => req.preview ? next()
  : identify(req, res, () => requireUser(req, res, async () => {
    if (req.user.plan === "paid") return next();
    let inp;
    try { inp = parseChartInput(req.body.chart); } catch { return next(); }    // the route answers 400
    const key = crypto.createHash("sha256").update(inp.system + "|" + chartKey(inp)).digest("hex").slice(0, 32);
    try {
      const used = await store.usageKeys(req.user.id, weekStart(), "chart_reading");
      if (!used.has(key) && used.size >= FREE_CHART_READINGS) return res.status(429).json({ error: "reading_limit", used: used.size, max: FREE_CHART_READINGS });
      if (!used.has(key)) await store.recordUse(req.user.id, weekStart(), "chart_reading", key);
      next();
    } catch (err) { sendError(res, err); }
  }));
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
