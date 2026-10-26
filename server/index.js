import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { divineReading, isValidSeed } from "../shared/oracle.js";
import { getQuantumSeed } from "./seed.js";
import { interpretReading, chat, OracleRefusal } from "./oracle-ai.js";
import { rateLimit } from "./rate-limit.js";
import { freeChartLimit } from "./free-limit.js";
import { createStore, SLOTS } from "./store.js";
import { searchPlaces, parseChartInput, renderChart, chartKey, systemMeta, ChartInputError } from "./astro.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const PORT = Number(process.env.PORT) || 8787;

const MAX_HISTORY = 19; // odd, so the trimmed history still starts with the user
const MAX_TEXT = 2000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  });
  next();
});

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

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/draw", async (req, res) => {
  const { seed, source } = await getQuantumSeed();
  res.json({ seed, source, reading: divineReading(seed) });
});

app.post("/api/interpret", aiLimit, async (req, res) => {
  const reading = readingFrom(req, res);
  if (!reading) return;
  try {
    res.json(await interpretReading(reading));
  } catch (err) {
    sendError(res, err);
  }
});

// Chat is part of the paid plan. (The middleware is defined with the account
// routes below; the arrow wrappers look it up when a request arrives.)
app.post("/api/chat", aiLimit, (q, r, n) => identify(q, r, n), (q, r, n) => requireUser(q, r, n), (q, r, n) => requirePaid(q, r, n), async (req, res) => {
  const reading = readingFrom(req, res);
  if (!reading) return;
  const { synthesis, history } = req.body;
  const valid = Array.isArray(history) && history.length > 0 &&
    history.every((m, i) =>
      m && typeof m.text === "string" && m.text.length > 0 && m.text.length <= MAX_TEXT &&
      m.role === (i % 2 === 0 ? "user" : "assistant")) &&
    history.length % 2 === 1;
  if (!valid) return res.status(400).json({ error: "invalid history" });
  // Keep the newest turns, starting on a user message.
  const trimmed = history.slice(-MAX_HISTORY);
  try {
    const reply = await chat(reading, typeof synthesis === "string" ? synthesis.slice(0, 1000) : "", trimmed);
    res.json({ reply });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Accounts ─────────────────────────────────────────────────────────────────
const store = createStore();
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
    req.user = { id: user.id, email: user.email, plan: profile.plan === "paid" ? "paid" : "free" };
    next();
  } catch (err) {
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
  res.json({ auth: url && anonKey ? { url, anonKey } : null });
});

app.get("/api/me", accountLimit, identify, requireUser, async (req, res) => {
  try {
    res.json({ email: req.user.email, plan: req.user.plan, slots: SLOTS.length, charts: await store.listCharts(req.user.id) });
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

// Free: FREE_CHARTS_PER_DAY different charts per IP per day. Paid: no daily limit.
app.post("/api/chart", chartLimit, identifyOptional, async (req, res) => {
  let inp;
  try {
    inp = parseChartInput(req.body);
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    return sendError(res, err);
  }
  try {
    const paid = req.user && req.user.plan === "paid";
    const key = chartKey(inp);
    if (!paid) {
      const quota = await freeCharts.check(req.ip, key);
      if (!quota.ok) return res.status(429).json({ error: "free_limit", used: quota.used, max: quota.max });
    }
    const chart = renderChart(inp);
    res.json({ ...chart, quota: paid ? null : await freeCharts.record(req.ip, key) });
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    sendError(res, err);
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));

// Production: serve the built client with SPA fallback.
app.use(express.static(dist, { index: false, maxAge: "1h" }));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(dist, "index.html"), err => err && next());
});

app.listen(PORT, () => console.log("Divinatey listening on http://localhost:" + PORT));
