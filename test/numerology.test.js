// Numerology calculations, checked by hand.
import { load } from "../scripts/astro/load.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const S = load("numerology").SYSTEM;
const chart = (birthName, date, name = "") => {
  const inp = { birthName, name, date, time: "12:00", tz: "UTC", utc: new Date(date + "T12:00:00Z") };
  const c = S.compute(inp); c.input = inp; return c;
};

test("core numbers (Mary Lynn Smith, 15 July 1990)", () => {
  const c = chart("Mary Lynn Smith", "1990-07-15");
  assert.equal(c.lifePath.n, 5);              // 7 + 6 + 1 = 14 → 5
  assert.equal(c.lifePath.debt, 14);
  assert.equal(c.expression.n, 11);           // MARY 21→3, LYNN 20→2, SMITH 24→6: 11 is kept
  assert.equal(c.soul.n, 6);                  // A+Y, Y, I: 8 + 7 + 9 = 24 → 6 (Y alone is a vowel)
  assert.equal(c.personality.n, 5);           // 4 + 4 + 6 = 14 → 5
  assert.equal(c.birthday.n, 6);
  assert.equal(c.maturity.n, 7);              // 5 + 11 = 16 → 7
  assert.deepEqual([...c.lessons], [6]);
  assert.deepEqual([...c.periods].map(p => p.pinnacle), [4, 7, 11, 8]);
  assert.deepEqual([...c.periods].map(p => p.challenge), [1, 5, 4, 6]);
  assert.deepEqual([...c.periods].map(p => p.from), [0, 32, 41, 50]);   // first pinnacle ends at 36 − 5
});

test("Y next to a vowel is a consonant", () => {
  assert.equal(chart("Murray", "2000-01-01").soul.n, 4);          // U 3 + A 1; the Y follows A
});

test("master numbers, accents and the current name (José Núñez, 29 November 1983)", () => {
  const c = chart("José Núñez", "1983-11-29", "Joe Nunez");
  assert.equal(chart("Jose Nunez", "1983-11-29").expression.n, c.expression.n, "accents don't change the numbers");
  assert.equal(c.lifePath.n, 7);              // 11 + 11 + 3 = 25 → 7 (11s kept on the way)
  assert.equal(c.birthday.n, 11);             // 29 → 11, kept
  assert.equal(c.expression.n, 3);            // JOSE 13→4, NUNEZ 26→8: 12 → 3
  assert.equal(c.current.n, 11);              // JOE 12→3 + NUNEZ 8 = 11, kept
  assert.equal(chart("Jose Nunez", "1983-11-29", "José Núñez").current, null, "same name: no separate current-name number");
});

test("personal year changes on 1 January", () => {
  const c = chart("Mary Lynn Smith", "1990-07-15");
  const y = c.today.y, m = c.today.m, d = c.today.d;
  const one = n => { while (n > 9) n = String(n).split("").reduce((a, b) => a + +b, 0); return n; };
  assert.equal(c.cyc.year, one(7 + 6 + one(y)));
  assert.equal(c.cyc.month, one(c.cyc.year + m));
  assert.equal(c.cyc.day, one(c.cyc.month + d));
});

test("prompts never include the birth name", () => {
  const c = chart("Zebediah Quixote", "1971-02-03", "Zed");
  const prompts = [];
  const d = S.reading.data(c);
  S.reading.sections.forEach(s => { prompts.push(s.prompt(d)); if (s.astroPrompt) prompts.push(s.astroPrompt(d)); });
  S.guide.tabs.forEach(t => { t.items(c).forEach(i => prompts.push(i.prompt)); if (t.overview) prompts.push(t.overview(c)); });
  for (const p of prompts) assert.doesNotMatch(p, /Zebediah|Quixote|ZEBEDIAH|QUIXOTE/);
});
