// PAID_PREVIEW=0 turns the preview off: the header no longer unlocks anything.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let server, base;
before(async () => {
  const port = 21000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", PAID_PREVIEW: "0", FREE_CHARTS_PER_DAY: "1" };
  delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY; delete env.SUPABASE_SERVICE_KEY; delete env.AUTH_TEST_TOKENS;
  server = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise(r => server.stdout.on("data", r));
});
after(() => server.kill());

test("preview switched off", async () => {
  const pv = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", "x-paid-preview": "1" }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  const cfg = await fetch(base + "/api/config").then(r => r.json());
  assert.equal(cfg.preview, false);
  const { body: { seed } } = await pv("/api/draw", {});
  assert.equal((await pv("/api/chat", { seed, history: [{ role: "user", text: "hi" }] })).status, 401);
  const birth = { system: "vedic", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 };
  assert.equal((await pv("/api/chart", birth)).status, 200);
  assert.equal((await pv("/api/chart", { ...birth, system: "natal" })).status, 200, "same person, other system");
  assert.equal((await pv("/api/chart", { ...birth, system: "natal", date: "1985-03-02" })).status, 429);
});
