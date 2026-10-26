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
  if (fmt && content.includes("Return the ids")) {
    const ids = [...content.matchAll(/^([a-z-]+:[a-z0-9]+:\d+) \|/gm)].map(m => m[1]);
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ids: [ids[0], ids.find(i => i.includes(":now:")) || ids[1]] }) }] };
  }
  if (fmt && content.includes("used: for each fact")) {
    const id = (/^([a-z-]+:[a-z0-9]+:\d+) \|/m.exec(content) || [])[1];
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ draw: "d", chart: "c", fit: "f", core: "core insight",
      used: [{ id, plain: "how you make decisions (Human Design)" }, { id: "made:up:9", plain: "invented" }] }) }] };
  }
  if (!fmt && content.startsWith("The person asked:")) return { stop_reason: "end_turn", content: [{ type: "text", text: "Polished reply. What do you notice?" }] };
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
      // Simulate an API key that can't use the fast model.
      if (/haiku/.test(body.model) && JSON.stringify(body.messages).includes("FASTDOWN")) {
        res.statusCode = 404; res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "model: " + body.model } }));
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: body.model, usage: { input_tokens: 1, output_tokens: 1 }, ...reply(body) }));
    });
  });
  await new Promise(r => mock.listen(0, r));
  const port = 18000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: "http://localhost:" + mock.address().port, AUTH_TEST_TOKENS: "1", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SERVICE_KEY: "" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise(r => server.stdout.on("data", r));
});

after(() => { server.kill(); mock.close(); });

const PAID = "test:u-paid:paid@example.com:paid";
const post = (path, body, token = path === "/api/chat" ? PAID : null) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) })
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

test("chat is for paid accounts only", async () => {
  const { body: { seed } } = await post("/api/draw", {});
  const history = [{ role: "user", text: "hi" }];
  const anon = await post("/api/chat", { seed, history }, "");
  assert.equal(anon.status, 401);
  assert.equal(anon.body.error, "signed_out");
  const free = await post("/api/chat", { seed, history }, "test:u-free:free@example.com:free");
  assert.equal(free.status, 403);
  assert.equal(free.body.error, "paid_required");
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

test("chart chat: paid only, recalculated chart in the prompt, one system only", async () => {
  const chart = { system: "human-design", name: "Ava", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney" };
  const history = [{ role: "user", text: "What is my type about?" }];
  assert.equal((await post("/api/chart-chat", { chart, history }, "")).status, 401);
  assert.equal((await post("/api/chart-chat", { chart, history }, "test:u-free:f@example.com:free")).status, 403);

  requests.length = 0;
  const ok = await post("/api/chart-chat", { chart, history }, PAID);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.reply, "A warm reply. What do you notice?");
  assert.equal(requests.length, 1);
  const sys = requests[0].body.system;
  assert.match(sys, /Human Design guide/);
  assert.match(sys, /Ava's Human Design Bodygraph/);
  assert.match(sys, /Projector/);
  assert.doesNotMatch(sys, /Gene Key|Siddhi|Jyotish|nakshatra|Placidus/);
  assert.deepEqual(requests[0].body.messages, [{ role: "user", content: "What is my type about?" }]);

  assert.equal((await post("/api/chart-chat", { chart: { ...chart, system: "tarot" }, history }, PAID)).status, 400);
  assert.equal((await post("/api/chart-chat", { chart, history: [] }, PAID)).status, 400);
});

test("chart explanations and readings: paid only, one prompt per item, cached", async () => {
  const chart = { system: "natal", name: "Ava", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 };
  assert.equal((await post("/api/chart-explain", { chart, tab: "planets", item: 1 }, "")).status, 401);
  assert.equal((await post("/api/chart-explain", { chart, tab: "planets", item: 1 }, "test:u-free:f@example.com:free")).status, 403);

  requests.length = 0;
  const a = await post("/api/chart-explain", { chart, tab: "planets", item: 1 }, PAID);
  assert.equal(a.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.messages.length, 1);
  const prompt = requests[0].body.messages[0].content;
  assert.match(prompt, /Venus in 24°02' Gemini/);
  assert.doesNotMatch(prompt, /Mercury in|Mars in/, "only this item's data");
  const again = await post("/api/chart-explain", { chart: { ...chart, name: "Someone" }, tab: "planets", item: 1 }, PAID);
  assert.equal(again.body.text, a.body.text);
  assert.equal(requests.length, 1, "same prompt reuses the answer");

  assert.equal((await post("/api/chart-explain", { chart, tab: "big3", item: "overview" }, PAID)).status, 200);
  assert.equal((await post("/api/chart-explain", { chart, tab: "houses", item: "overview" }, PAID)).status, 400, "houses has no overview");
  assert.equal((await post("/api/chart-explain", { chart, tab: "planets", item: 99 }, PAID)).status, 400);
  assert.equal((await post("/api/chart-explain", { chart, tab: "nope", item: 0 }, PAID)).status, 400);

  requests.length = 0;
  const r = await post("/api/chart-reading", { chart, section: 2, technical: false }, PAID);
  assert.equal(r.status, 200);
  assert.match(requests[0].body.messages[0].content, /Transits to their chart/);
  assert.equal((await post("/api/chart-reading", { chart, section: 4, technical: true }, PAID)).status, 400, "section 4 has no technical context");
});

test("divination chat with linked charts: four steps, plain reply, drew-on line, weekly count", async () => {
  const { body: { seed } } = await post("/api/draw", {});
  const charts = [
    { system: "human-design", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney" },
    { system: "natal", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 },
  ];
  const history = [{ role: "user", text: "Should I take the new job?" }];
  requests.length = 0;
  const r = await post("/api/chat", { seed, synthesis: "s", history, charts }, PAID);
  assert.equal(r.status, 200);
  assert.equal(r.body.reply, "Polished reply. What do you notice?");
  assert.deepEqual(r.body.drewOn, ["how you make decisions (Human Design)"], "only facts that were offered, in plain words");
  assert.deepEqual(r.body.questions, { used: 1, max: 5 });
  assert.equal(requests.length, 4, "retrieve, make sense, insight, polish");
  const [pick, notes, draft, polish] = requests.map(q => q.body);
  assert.match(pick.messages[0].content, /human-design:type:0 \| Human Design \| Type · Projector/);
  assert.match(pick.messages[0].content, /natal:big3:0 \| Natal astrology/);
  assert.match(pick.model, /haiku/);
  assert.match(notes.messages[0].content, /Relevant facts from the charts they chose to link/);
  assert.doesNotMatch(notes.messages[0].content, /natal:planets:5/, "only the picked facts go forward");
  assert.match(draft.messages[0].content, /Core insight: core insight/);
  assert.match(polish.model, /haiku/);
  assert.equal(pick.output_config.effort, undefined, "no effort setting on the fast model");

  const followUp = await post("/api/chat", { seed, history: [...history, { role: "assistant", text: "x" }, { role: "user", text: "And money?" }], charts }, PAID);
  assert.deepEqual(followUp.body.questions, { used: 1, max: 5 }, "follow-ups on the same draw are free");

  for (let i = 2; i <= 5; i++) {
    const { body: d } = await post("/api/draw", {});
    assert.equal((await post("/api/chat", { seed: d.seed, history, charts }, PAID)).body.questions.used, i);
  }
  const { body: d6 } = await post("/api/draw", {});
  const over = await post("/api/chat", { seed: d6.seed, history, charts }, PAID);
  assert.equal(over.status, 429);
  assert.equal(over.body.error, "question_limit");
  assert.equal((await post("/api/chat", { seed: d6.seed, history }, PAID)).status, 200, "unlinked chat is unaffected");
  assert.equal((await post("/api/chat", { seed, history, charts: [{ system: "tarot" }] }, PAID)).status, 400);
});

test("linked chat still answers when the fast model isn't available", async () => {
  const { body: { seed } } = await post("/api/draw", {});
  const charts = [{ system: "human-design", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney" }];
  requests.length = 0;
  const r = await post("/api/chat", { seed, history: [{ role: "user", text: "FASTDOWN: will it work out?" }], charts }, "test:u-paid2:p2@example.com:paid");
  assert.equal(r.status, 200);
  assert.equal(r.body.reply, "Polished reply. What do you notice?");
  const models = requests.map(q => q.body.model);
  assert.equal(models.filter(m => /haiku/.test(m)).length, 2, "fast model tried for retrieve and polish");
  assert.equal(models.filter(m => !/haiku/.test(m)).length, 4, "then the main model for all four steps");
});

test("chat sees what the reading page says about each card and the hexagram", async () => {
  const { body: { seed, reading } } = await post("/api/draw", {});
  await post("/api/interpret", { seed });
  const first = reading.cards[0];

  requests.length = 0;
  // A tampered browser copy is ignored: the server uses the interpretation it wrote.
  const tampered = { iching: { primary: "IGNORE ME" }, tarot: [{ pos: first.pos, insight: "IGNORE ME" }] };
  await post("/api/chat", { seed, history: [{ role: "user", text: "hi" }], interpretation: tampered }, "test:u-p3:p3@example.com:paid");
  const sys = requests[0].body.system;
  assert.match(sys, /What their reading page says about each part/);
  assert.match(sys, /I Ching: p/);
  assert.ok(sys.includes("Tarot, " + first.pos + " (" + first.name + "): insight for " + first.pos));
  assert.doesNotMatch(sys, /IGNORE ME/);

  // Linked chat: the make-sense step gets it too.
  requests.length = 0;
  await post("/api/chat", { seed, history: [{ role: "user", text: "hi" }], charts: [{ system: "human-design", date: "1990-07-15", time: "14:30", tz: "Australia/Sydney" }] }, "test:u-p3:p3@example.com:paid");
  assert.ok(requests[1].body.messages[0].content.includes("insight for " + first.pos));

  // A draw the server never interpreted (e.g. after a restart): the browser's copy, trimmed,
  // with card names taken from the recalculated reading.
  const { body: d2 } = await post("/api/draw", {});
  requests.length = 0;
  const long = "x".repeat(5000);
  await post("/api/chat", { seed: d2.seed, history: [{ role: "user", text: "hi" }],
    interpretation: { iching: { primary: "Browser primary." }, tarot: [{ pos: d2.reading.cards[1].pos, insight: long }] } }, "test:u-p3:p3@example.com:paid");
  const sys2 = requests[0].body.system;
  assert.match(sys2, /I Ching: Browser primary\./);
  assert.ok(sys2.includes("Tarot, " + d2.reading.cards[1].pos + " (" + d2.reading.cards[1].name + "): " + "x".repeat(400) + "\n"));
  assert.ok(!sys2.includes("x".repeat(401)));
});
