import { PREVIEW } from "./preview.js";

export class ApiError extends Error {
  constructor(status, code) { super(code || "HTTP " + status); this.status = status; this.code = code; }
}

// Set by auth.js: resolves to the signed-in session's access token, or null.
let tokenSource = async () => null;
export function setTokenSource(fn) { tokenSource = fn; }

async function call(method, path, body, withAuth) {
  const headers = {};
  if (PREVIEW) headers["X-Paid-Preview"] = "1";
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withAuth) { const t = await tokenSource(); if (t) headers.Authorization = "Bearer " + t; }
  let res;
  try { res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new ApiError(0, "network"); }
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  // Non-JSON errors come from the host, not Divinatey: a gateway timeout (502/503/504)
  // or no API server at all (404).
  if (!res.ok) throw new ApiError(res.status, data.error || (isJson ? undefined : res.status >= 502 ? "timeout" : "no_server"));
  // A web page instead of JSON means the site is being served without its API server.
  if (!isJson) throw new ApiError(res.status, "no_server");
  return data;
}
const post = (path, body) => call("POST", path, body || {}, false);

export const drawReading = () => post("/api/draw");
export const interpret = seed => post("/api/interpret", { seed });
// `interp` is what the page shows about the reading; the server prefers its own copy.
export const askOracle = (seed, synthesis, history, charts, interp) =>
  call("POST", "/api/chat", {
    seed, synthesis, history: history.map(m => ({ role: m.role, text: m.text })),
    ...(charts && charts.length ? { charts } : {}),
    ...(interp ? { interpretation: { iching: interp.iching, tarot: (interp.tarot || []).map(t => ({ pos: t.pos, insight: t.insight })) } } : {}),
  }, true);

const get = path => call("GET", path, undefined, false);

export const getSystems = () => get("/api/systems");
export const findPlaces = q => get("/api/places?q=" + encodeURIComponent(q));
export const makeChart = body => call("POST", "/api/chart", body, true);
export const askChart = (chart, history) =>
  call("POST", "/api/chart-chat", { chart, history: history.map(m => ({ role: m.role, text: m.text })) }, true);
export const explainChart = (chart, tab, item) => call("POST", "/api/chart-explain", { chart, tab, item }, true);
export const chartReading = (chart, section, technical) => call("POST", "/api/chart-reading", { chart, section, technical }, true);
export const getConfig = () => get("/api/config");
export const getMe = () => call("GET", "/api/me", undefined, true);
export const saveChartSlot = (slot, body) => call("PUT", "/api/charts/" + slot, body, true);
export const deleteChartSlot = slot => call("DELETE", "/api/charts/" + slot, undefined, true);

export function chartErrorText(err) {
  if (err instanceof ApiError) {
    if (err.code === "free_limit") return "You've used today's free charts for two people. Come back tomorrow for someone new; the people you've already entered today still open in all four systems.";
    if (err.status === 429) return "Too many charts at once. Wait a few minutes, then try again.";
    if (err.code === "invalid location") return "Choose your birth place from the list so we know its coordinates.";
    if (err.code === "invalid timezone") return "Choose your birth place from the list so we know its timezone.";
    if (err.code === "invalid date" || err.code === "invalid time") return "Check the birth date and time.";
    if (err.code === "network") return "Couldn't reach Divinatey. Check your connection, then try again.";
    if (err.code === "no_server") return "The chart service isn't running on this site right now: the pages are being served without Divinatey's server. (Error: no_server)";
    if (err.status >= 500) return "Something went wrong on our side while calculating this chart. Try again in a moment. (Error " + err.status + (err.code ? ": " + err.code : "") + ")";
    return "The chart couldn't be calculated. (Error " + err.status + (err.code ? ": " + err.code : "") + ")";
  }
  return "The chart couldn't be calculated just now. Try again in a moment.";
}

export function oracleErrorText(err) {
  if (err instanceof ApiError) {
    if (err.code === "network") return "Couldn't reach Divinatey. Check your connection, then try again.";
    if (err.code === "timeout") return "The oracle took too long to answer and the connection was closed. Try again; with charts linked, answers can take up to half a minute. (Error " + err.status + ")";
    if (err.code === "no_server") return "The oracle isn't reachable: this site is running without Divinatey's server. (Error: no_server)";
    if (err.code === "upstream") return "The oracle's AI service had a problem just now. Try again in a moment. (Error 502: upstream)";
    if (err.code === "internal") return "Something went wrong on our side. Try again in a moment. (Error 500)";
    if (err.code === "paid_required" || err.code === "signed_out") return "Chat with the oracle is part of the paid plan.";
    if (err.code === "question_limit") return "You've asked this week's 5 questions with your charts linked. Untick your charts to keep chatting, or come back next week. (Extra questions open with payments.)";
    if (err.status === 429) return "The oracle needs a moment to rest. Try again in a few minutes.";
    if (err.code === "refused") return "The oracle can't speak to that one. Try asking another way.";
    if (err.code === "busy") return "Many seekers are asking right now. Try again shortly.";
  }
  return "The oracle didn't respond in time — this can happen on slower connections.";
}
