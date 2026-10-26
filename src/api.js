export class ApiError extends Error {
  constructor(status, code) { super(code || "HTTP " + status); this.status = status; this.code = code; }
}

// Set by auth.js: resolves to the signed-in session's access token, or null.
let tokenSource = async () => null;
export function setTokenSource(fn) { tokenSource = fn; }

async function call(method, path, body, withAuth) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withAuth) { const t = await tokenSource(); if (t) headers.Authorization = "Bearer " + t; }
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error);
  return data;
}
const post = (path, body) => call("POST", path, body || {}, false);

export const drawReading = () => post("/api/draw");
export const interpret = seed => post("/api/interpret", { seed });
export const askOracle = (seed, synthesis, history) =>
  call("POST", "/api/chat", { seed, synthesis, history: history.map(m => ({ role: m.role, text: m.text })) }, true);

const get = path => call("GET", path, undefined, false);

export const getSystems = () => get("/api/systems");
export const findPlaces = q => get("/api/places?q=" + encodeURIComponent(q));
export const makeChart = body => call("POST", "/api/chart", body, true);
export const getConfig = () => get("/api/config");
export const getMe = () => call("GET", "/api/me", undefined, true);
export const saveChartSlot = (slot, body) => call("PUT", "/api/charts/" + slot, body, true);
export const deleteChartSlot = slot => call("DELETE", "/api/charts/" + slot, undefined, true);

export function chartErrorText(err) {
  if (err instanceof ApiError) {
    if (err.code === "free_limit") return "You've opened your free charts for today. Come back tomorrow to open another, or reopen one you've already made today.";
    if (err.status === 429) return "Too many charts at once. Wait a few minutes, then try again.";
    if (err.code === "invalid location") return "Choose your birth place from the list so we know its coordinates.";
    if (err.code === "invalid timezone") return "Choose your birth place from the list so we know its timezone.";
    if (err.code === "invalid date" || err.code === "invalid time") return "Check the birth date and time.";
  }
  return "The chart couldn't be calculated just now. Try again in a moment.";
}

export function oracleErrorText(err) {
  if (err instanceof ApiError) {
    if (err.code === "paid_required" || err.code === "signed_out") return "Chat with the oracle is part of the paid plan.";
    if (err.status === 429) return "The oracle needs a moment to rest. Try again in a few minutes.";
    if (err.code === "refused") return "The oracle can't speak to that one. Try asking another way.";
    if (err.code === "busy") return "Many seekers are asking right now. Try again shortly.";
  }
  return "The oracle didn't respond in time — this can happen on slower connections.";
}
