// Chart routes: place search, validation, rendering and the free daily limit.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let server, base;

before(async () => {
  const port = 19000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", FREE_CHARTS_PER_DAY: "2" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise(r => server.stdout.on("data", r));
});
after(() => server.kill());

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json() }));
const birth = { date: "1990-07-15", time: "14:30", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 };

test("place search returns places with timezone and coordinates", async () => {
  const r = await fetch(base + "/api/places?q=springfield%20mo").then(r => r.json());
  assert.equal(r[0].label, "Springfield, Missouri, United States");
  assert.equal(r[0].tz, "America/Chicago");
  assert.ok(Math.abs(r[0].lat - 37.2) < 0.1);
  assert.deepEqual(await fetch(base + "/api/places?q=a").then(r => r.json()), []);
});

test("systems list", async () => {
  const r = await fetch(base + "/api/systems").then(r => r.json());
  assert.deepEqual(Object.keys(r).sort(), ["gene-keys", "human-design", "natal", "vedic"]);
  assert.equal(r.natal.needsLocation, true);
  assert.equal(r["gene-keys"].needsLocation, false);
});

test("bad input is rejected without using the free allowance", async () => {
  assert.equal((await post("/api/chart", { ...birth, system: "tarot" })).status, 400);
  assert.equal((await post("/api/chart", { ...birth, system: "natal", lat: 200 })).status, 400);
  assert.equal((await post("/api/chart", { ...birth, system: "natal", date: "1990-13-45" })).status, 400);
  assert.equal((await post("/api/chart", { ...birth, system: "gene-keys", tz: "Mars/Olympus" })).status, 400);
});

test("free tier: two people a day, all four systems each; repeats are free; no AI", async () => {
  const a = await post("/api/chart", { ...birth, system: "human-design", name: "<script>x</script>" });
  assert.equal(a.status, 200);
  assert.match(a.body.html, /Bodygraph/);
  assert.doesNotMatch(a.body.html, /<script>x/);
  assert.doesNotMatch(a.body.html, /Generate →|Explain →|apiCall|loadSection/);
  assert.ok(a.body.reference.length >= 3);
  assert.ok(a.body.reference.every(t => t.items.every(i => !("prompt" in i))));
  assert.deepEqual(a.body.quota, { used: 1, max: 2 });

  for (const system of ["gene-keys", "natal", "vedic"]) {
    const same = await post("/api/chart", { ...birth, system, name: "Someone" });
    assert.equal(same.status, 200, system);
    assert.deepEqual(same.body.quota, { used: 1, max: 2 }, "same person, other system: not counted");
  }

  const b = await post("/api/chart", { ...birth, system: "vedic", date: "1985-03-02" });
  assert.equal(b.status, 200);
  assert.deepEqual(b.body.quota, { used: 2, max: 2 });

  const c = await post("/api/chart", { ...birth, system: "natal", date: "1972-12-24" });
  assert.equal(c.status, 429);
  assert.equal(c.body.error, "free_limit");

  assert.equal((await post("/api/chart", { ...birth, system: "gene-keys", date: "1985-03-02" })).status, 200, "a person already opened today still works");
});
