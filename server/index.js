import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { divineReading, isValidSeed } from "../shared/oracle.js";
import { getQuantumSeed } from "./seed.js";
import { interpretReading, chat, OracleRefusal } from "./oracle-ai.js";
import { rateLimit } from "./rate-limit.js";
import { freeChartLimit } from "./free-limit.js";
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

app.post("/api/chat", aiLimit, async (req, res) => {
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

// ── Charts (free tier: no AI) ────────────────────────────────────────────────
const placeLimit = rateLimit({ windowMs: 60 * 1000, max: 120 });
const chartLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 });
const freeCharts = freeChartLimit({ max: Number(process.env.FREE_CHARTS_PER_DAY) || 2 });

app.get("/api/systems", (req, res) => res.json(systemMeta()));

app.get("/api/places", placeLimit, (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  res.json(q.length < 2 ? [] : searchPlaces(q));
});

app.post("/api/chart", chartLimit, (req, res) => {
  let inp;
  try {
    inp = parseChartInput(req.body);
  } catch (err) {
    if (err instanceof ChartInputError) return res.status(400).json({ error: err.message });
    throw err;
  }
  const key = chartKey(inp);
  const quota = freeCharts.check(req.ip, key);
  if (!quota.ok) return res.status(429).json({ error: "free_limit", used: quota.used, max: quota.max });
  try {
    const chart = renderChart(inp);
    res.json({ ...chart, quota: freeCharts.record(req.ip, key) });
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
