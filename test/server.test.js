// Runs the real server against a mock Anthropic API to check the request
// shape and the endpoints' handling of responses.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

const requests = [];
let mock, server, base;

function reply(body) {
  const fmt = body.output_config && body.output_config.format;
  const content = body.messages[0].content;
  let text = "A warm reply. What do you notice?";
  if (fmt) {
    if (content.startsWith("Hexagram")) text = JSON.stringify({ primary: "p", lines: "", resulting: "r" });
    else if (content.startsWith("Seven")) {
      const pos = [...content.matchAll(/^- (.+?): /gm)].map(m => m[1]).reverse();
      text = JSON.stringify({ cards: pos.map(p => ({ pos: p, card: "x", insight: "insight for " + p })) });
    } else text = JSON.stringify({ synthesis: "s", invitation: "i" });
  }
  if (content.includes("REFUSE")) return { stop_reason: "refusal", content: [] };
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

before(async () => {
  mock = http.createServer((req, res) => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => {
      const body = JSON.parse(data);
      requests.push({ headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: body.model, usage: { input_tokens: 1, output_tokens: 1 }, ...reply(body) }));
    });
  });
  await new Promise(r => mock.listen(0, r));
  const port = 18000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: "http://localhost:" + mock.address().port },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise(r => server.stdout.on("data", r));
});

after(() => { server.kill(); mock.close(); });

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json() }));

test("draw + interpret", async () => {
  const d = await post("/api/draw", {});
  assert.equal(d.status, 200);
  assert.ok(d.body.seed > 0);
  assert.equal(d.body.reading.cards.length, 7);

  requests.length = 0;
  const i = await post("/api/interpret", { seed: d.body.seed });
  assert.equal(i.status, 200);
  assert.equal(i.body.iching.primary, "p");
  assert.equal(i.body.synthesis, "s");
  // Insights are re-aligned to positions even though the mock reversed them.
  i.body.tarot.forEach((t, k) => {
    assert.equal(t.pos, d.body.reading.cards[k].pos);
    assert.equal(t.card, d.body.reading.cards[k].name);
    assert.equal(t.insight, "insight for " + t.pos);
  });
  assert.equal(requests.length, 3);
  for (const r of requests) {
    assert.equal(r.body.fallbacks, "default");
    assert.match(r.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
    assert.equal(r.body.output_config.format.type, "json_schema");
  }
});

test("chat validates history and handles refusals", async () => {
  const seed = 987654;
  const ok = await post("/api/chat", { seed, synthesis: "s", history: [{ role: "user", text: "work worries" }] });
  assert.equal(ok.status, 200);
  assert.match(ok.body.reply, /What do you notice/);
  assert.match(requests.at(-1).body.system, /Hexagram/);

  assert.equal((await post("/api/chat", { seed, history: [{ role: "assistant", text: "x" }] })).status, 400);
  assert.equal((await post("/api/chat", { seed, history: [] })).status, 400);
  assert.equal((await post("/api/chat", { seed: "nope", history: [{ role: "user", text: "x" }] })).status, 400);
  assert.equal((await post("/api/chat", { seed, history: [{ role: "user", text: "REFUSE" }] })).body.error, "refused");
});

test("serves SPA routes and 404s unknown api routes", async () => {
  assert.equal((await fetch(base + "/api/nope")).status, 404);
  assert.equal((await fetch(base + "/api/health")).status, 200);
});
