// Chart engine on the server. The browser sends birth details; the server
// calculates and renders the chart, so free-tier limits can't be bypassed and
// (later) paid prompts are always built here from recalculated data.
//
// Each system is loaded into its own instance of the shared core, so no system
// can see another system's code, data or state.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared", "astro");
const read = f => fs.readFileSync(path.join(dir, f), "utf8");
const CORE = ["core/astronomy.js", "core/tz.js", "core/core.js"].map(read).join("\n;\n");

export const SYSTEMS = {
  "gene-keys": "genekeys",
  "human-design": "humandesign",
  "natal": "natal",
  "vedic": "vedic",
};

function instantiate(extraSrc, exportsSrc) {
  const win = {};
  const doc = { addEventListener() {}, getElementById() { return null; } };
  // `var SYSTEM` gives core's functions the module's SYSTEM, as window.SYSTEM does in a browser.
  const body = "var SYSTEM;\n" + CORE + "\n;\n" + extraSrc + "\n;\nSYSTEM = window.SYSTEM;\nreturn " + exportsSrc + ";";
  return new Function("window", "document", body)(win, doc);
}

const engines = {};
for (const [id, mod] of Object.entries(SYSTEMS)) {
  engines[id] = instantiate(read(`systems/${mod}.js`),
    "{ SYSTEM, chartBodyHTML, referenceData, toUTC, tzUsable }");
}
const placeEngine = instantiate(read("core/cities.js"), "{ searchPlaces }");

export function searchPlaces(q) {
  return placeEngine.searchPlaces(String(q).slice(0, 80)).slice(0, 12)
    .map(c => ({ label: c.label, tz: c.tz, lat: c.lat, lon: c.lon }));
}

export class ChartInputError extends Error {}

// Validates raw request input. Returns a clean input object or throws ChartInputError.
export function parseChartInput(body) {
  const b = body || {};
  const engine = engines[b.system];
  if (!engine) throw new ChartInputError("unknown system");
  const date = String(b.date || ""), time = String(b.time || "12:00");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ChartInputError("invalid date");
  const year = +date.slice(0, 4);
  if (year < 1800 || year > 2100 || isNaN(Date.parse(date + "T00:00:00Z"))) throw new ChartInputError("invalid date");
  if (!/^\d{2}:\d{2}$/.test(time) || +time.slice(0, 2) > 23 || +time.slice(3) > 59) throw new ChartInputError("invalid time");
  const tz = engine.tzUsable(String(b.tz || ""));
  if (!tz) throw new ChartInputError("invalid timezone");
  const name = String(b.name || "").trim().slice(0, 60);
  const inp = { system: b.system, name, date, time, tz };
  if (engine.SYSTEM.needsLocation) {
    const lat = Number(b.lat), lon = Number(b.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new ChartInputError("invalid location");
    inp.lat = Math.round(lat * 1e4) / 1e4;
    inp.lon = Math.round(lon * 1e4) / 1e4;
  }
  return inp;
}

// What identifies "the same chart" for the free limit (the name doesn't count).
export const chartKey = inp => [inp.system, inp.date, inp.time, inp.tz, inp.lat ?? "", inp.lon ?? ""].join("|");

export function renderChart(inp) {
  const engine = engines[inp.system];
  const utc = engine.toUTC(inp.date, inp.time, inp.tz);
  if (!utc) throw new ChartInputError("invalid time");
  const full = { ...inp, utc };
  const chart = engine.SYSTEM.compute(full);
  chart.input = full;
  return {
    system: inp.system,
    title: engine.SYSTEM.title,
    accent: engine.SYSTEM.accent || {},
    html: engine.chartBodyHTML(chart),
    reference: engine.referenceData(chart),
  };
}

export const systemMeta = () => Object.fromEntries(Object.entries(engines).map(([id, e]) =>
  [id, { title: e.SYSTEM.formTitle, sub: e.SYSTEM.formSub, needsLocation: !!e.SYSTEM.needsLocation }]));
