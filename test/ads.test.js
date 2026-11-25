// AdSense: off without a publisher id; with one, config, ads.txt and the content policy allow it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let server, base;
before(async () => {
  const port = 23000 + Math.floor(Math.random() * 1000);
  base = "http://localhost:" + port;
  const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", ADSENSE_CLIENT: "ca-pub-1234567890123456", ADSENSE_SLOT: "1111111111", ADSENSE_SLOT_CHART: "2222222222" };
  server = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise(r => server.stdout.on("data", r));
});
after(() => server.kill());

test("config hands the browser the publisher id and a slot per placement", async () => {
  const c = await (await fetch(base + "/api/config")).json();
  assert.deepEqual(c.ads, { client: "ca-pub-1234567890123456", slots: { home: "1111111111", reading: "1111111111", chart: "2222222222" } });
});

test("ads.txt names the publisher", async () => {
  const r = await fetch(base + "/ads.txt");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
});

test("with ads on, the content policy allows https ad sources but still no inline scripts", async () => {
  const csp = (await fetch(base + "/")).headers.get("content-security-policy");
  assert.match(csp, /script-src 'self' https:(;|$)/);
  assert.match(csp, /frame-src https:/);
  assert.doesNotMatch(csp, /unsafe-inline'[^;]*script|script-src[^;]*unsafe-inline/);
  assert.match(csp, /frame-ancestors 'none'/);
});
