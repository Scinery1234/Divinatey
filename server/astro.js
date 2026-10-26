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

// Builds the place index (111k places) ahead of the first search.
export function warmPlaces() { placeEngine.searchPlaces("zz"); }

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

// The free limit counts people, not charts: one set of birth details opens all
// four systems. (Neither the system, the name nor fine-tuned coordinates count.)
export const chartKey = inp => [inp.date, inp.time, inp.tz].join("|");

function computeChart(inp) {
  const engine = engines[inp.system];
  const utc = engine.toUTC(inp.date, inp.time, inp.tz);
  if (!utc) throw new ChartInputError("invalid time");
  const full = { ...inp, utc };
  const chart = engine.SYSTEM.compute(full);
  chart.input = full;
  return { engine, chart };
}

export function renderChart(inp) {
  const { engine, chart } = computeChart(inp);
  const R = engine.SYSTEM.reading;
  return {
    system: inp.system,
    title: engine.SYSTEM.title,
    accent: engine.SYSTEM.accent || {},
    html: engine.chartBodyHTML(chart),
    reference: engine.referenceData(chart),
    reading: { title: R.title, sections: R.sections.map(s => ({ id: s.id, icon: s.icon, title: s.title, desc: s.desc, technical: !!s.astroPrompt })) },
  };
}

// The prompt for one guide item (or a tab's overview), built from that item's
// own data only, exactly as the standalone pages do.
export function guidePrompt(inp, tabKey, item) {
  const { engine, chart } = computeChart(inp);
  const tab = engine.SYSTEM.guide.tabs.find(t => t.key === tabKey);
  if (!tab) throw new ChartInputError("unknown section");
  if (item === "overview") {
    if (!tab.overview) throw new ChartInputError("unknown section");
    return tab.overview(chart);
  }
  const it = tab.items(chart)[Number(item)];
  if (!Number.isInteger(Number(item)) || !it) throw new ChartInputError("unknown item");
  return it.prompt;
}

// The prompt for one reading section, from the chart and today's sky only.
export function readingPrompt(inp, sectionId, technical) {
  const { engine, chart } = computeChart(inp);
  const sec = engine.SYSTEM.reading.sections.find(s => s.id === Number(sectionId));
  if (!sec || (technical && !sec.astroPrompt)) throw new ChartInputError("unknown section");
  const data = engine.SYSTEM.reading.data(chart);
  return technical ? sec.astroPrompt(data) : sec.prompt(data);
}

// Each system's chat speaks only its own language; nothing from another system is included.
const CHAT_VOICE = {
  "gene-keys": "You are a Gene Keys contemplative guide. Use Gene Keys language: shadow, gift and siddhi, lines, spheres and the Activation, Venus and Pearl sequences.",
  "human-design": "You are a Human Design guide. Use only Human Design concepts: type, strategy, authority, profile, centres, channels, gates and lines.",
  "natal": "You are a thoughtful Western astrologer working with the tropical zodiac and Placidus houses.",
  "vedic": "You are a traditional Jyotish (Vedic astrology) guide working in the sidereal zodiac with the Lahiri ayanamsa. Use only Jyotish concepts.",
};
const plain = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// What the chat is told about one chart: its placements and today's transits,
// calculated fresh from the birth details.
export function chartChatContext(inp) {
  const engine = engines[inp.system];
  const utc = engine.toUTC(inp.date, inp.time, inp.tz);
  if (!utc) throw new ChartInputError("invalid time");
  const full = { ...inp, utc };
  const chart = engine.SYSTEM.compute(full);
  chart.input = full;
  const facts = engine.referenceData(chart).map(t =>
    t.name + ":\n" + t.items.map(i => "- " + [i.title, plain(i.code), plain(i.sub), i.role ? "(" + i.role + ")" : ""].filter(Boolean).join(" · ")).join("\n")
  ).join("\n\n");
  const data = engine.SYSTEM.reading.data(chart);
  const now = Object.entries(data).filter(([k, v]) => k !== "name" && typeof v === "string" && /tech|personal|sky|week|dasha|pan/i.test(k))
    .map(([k, v]) => k + ": " + v).join("\n").slice(0, 6000);
  return {
    voice: CHAT_VOICE[inp.system],
    title: engine.SYSTEM.title,
    name: inp.name,
    facts: facts.slice(0, 12000),
    now,
    today: new Date().toISOString().slice(0, 10),
  };
}

const SYSTEM_PLAIN = { "gene-keys": "Gene Keys", "human-design": "Human Design", "natal": "Natal astrology", "vedic": "Vedic astrology" };
const TRANSIT_KEYS = { "gene-keys": ["personalTech"], "human-design": ["personal"], "natal": ["personal"], "vedic": ["personal"] };

// A linked chart as short fact cards the divination chat can retrieve from:
// one card per placement (from the chart guide) plus one per current transit.
// Only data: no generated text from any earlier reading.
export function chartFactCards(inp) {
  const { engine, chart } = computeChart(inp);
  const sys = inp.system, cards = [];
  engine.referenceData(chart).forEach(t => t.items.forEach((it, i) => cards.push({
    id: `${sys}:${t.key}:${i}`, system: sys, kind: "chart",
    text: [it.title, plain(it.code), plain(it.sub), it.role ? "(" + it.role + ")" : ""].filter(Boolean).join(" · "),
  })));
  const data = engine.SYSTEM.reading.data(chart);
  (TRANSIT_KEYS[sys] || []).forEach(k => String(data[k] || "").split("\n").map(l => l.trim()).filter(l => l && !/^none$|^no /i.test(l))
    .slice(0, 12).forEach((l, i) => cards.push({ id: `${sys}:now:${i}`, system: sys, kind: "transit", text: "Today: " + l })));
  return { system: sys, label: SYSTEM_PLAIN[sys], name: inp.name, cards };
}

export const systemMeta = () => Object.fromEntries(Object.entries(engines).map(([id, e]) =>
  [id, { title: e.SYSTEM.formTitle, sub: e.SYSTEM.formSub, needsLocation: !!e.SYSTEM.needsLocation }]));
