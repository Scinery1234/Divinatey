export class ApiError extends Error {
  constructor(status, code) { super(code || "HTTP " + status); this.status = status; this.code = code; }
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error);
  return data;
}

export const drawReading = () => post("/api/draw");
export const interpret = seed => post("/api/interpret", { seed });
export const askOracle = (seed, synthesis, history) =>
  post("/api/chat", { seed, synthesis, history: history.map(m => ({ role: m.role, text: m.text })) });

export function oracleErrorText(err) {
  if (err instanceof ApiError) {
    if (err.status === 429) return "The oracle needs a moment to rest. Try again in a few minutes.";
    if (err.code === "refused") return "The oracle can't speak to that one. Try asking another way.";
    if (err.code === "busy") return "Many seekers are asking right now. Try again shortly.";
  }
  return "The oracle didn't respond in time — this can happen on slower connections.";
}
