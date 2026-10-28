import Anthropic from "@anthropic-ai/sdk";
import { describeReading } from "../shared/oracle.js";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ORACLE_EFFORT || "low";
// Fast model for the small steps of the linked-chart chat (picking facts, polishing).
const QUICK_MODEL = process.env.ANTHROPIC_QUICK_MODEL || "claude-haiku-5-5";

export class OracleRefusal extends Error {}

// On a policy decline the API re-runs the request on Anthropic's recommended
// fallback model; a refusal that survives the chain surfaces as OracleRefusal.
// quick: use the fast model; if this API key can't use it, fall back to MODEL.
async function ask(opts) {
  if (opts.quick) {
    try { return await askOnce(opts); }
    catch (err) {
      const modelProblem = err instanceof Anthropic.APIError && (err.status === 404 || (err.status === 400 && /model/i.test(err.message || "")));
      if (!modelProblem) throw err;
      console.warn("Fast model unavailable (" + QUICK_MODEL + "); using " + MODEL + ":", err.status, err.message);
      return askOnce({ ...opts, quick: false });
    }
  }
  return askOnce(opts);
}

async function askOnce({ system, messages, schema, quick }) {
  const effort = quick ? {} : { effort: EFFORT };
  const res = await client.beta.messages.create({
    model: quick ? QUICK_MODEL : MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: schema
      ? { ...effort, format: { type: "json_schema", schema } }
      : effort,
    system,
    messages,
  });
  if (res.stop_reason === "refusal") throw new OracleRefusal("declined");
  const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
  return schema ? JSON.parse(text) : text.trim();
}

const obj = (props) => ({
  type: "object",
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
});
const str = { type: "string" };

const ICHING_SCHEMA = obj({ primary: str, lines: str, resulting: str });
const TAROT_SCHEMA = obj({ cards: { type: "array", items: obj({ pos: str, card: str, insight: str }) } });
const SYNTH_SCHEMA = obj({ synthesis: str, invitation: str });

function interpretIChing(r) {
  return ask({
    system: "You are an I Ching oracle. Interpret through the lens of inner transformation. Plain, warm, grounded language.",
    schema: ICHING_SCHEMA,
    messages: [{ role: "user", content:
      "Hexagram "+r.pHex+" – "+r.pName+(r.rHex?" → "+r.rHex+" – "+r.rName:"")+
      (r.changing.length?", changing lines: "+r.changing.join(", "):", no changing lines")+".\n"+
      "primary: 2-3 sentences on the primary hexagram.\n"+
      "lines: 1-2 sentences on the changing lines, or an empty string if there are none.\n"+
      "resulting: 1-2 sentences on the resulting hexagram, or an empty string if there is none."
    }],
  });
}

async function interpretTarot(r) {
  const out = await ask({
    system: "You are a Tarot reader. Use grounded, plain Rider-Waite meanings.",
    schema: TAROT_SCHEMA,
    messages: [{ role: "user", content:
      "Seven cards drawn, one per position:\n"+
      r.cards.map(c => "- "+c.pos+": "+c.name).join("\n")+"\n"+
      "Give a 2-sentence insight for each card in its position, in this order. "+
      "'How Do I Show Up?' means how to show up in mindset or action to overcome what's in the way."
    }],
  });
  // Align by position so a reordered or short reply can't mislabel a card.
  return r.cards.map(c => {
    const hit = out.cards.find(x => x.pos === c.pos);
    return { pos: c.pos, card: c.name, insight: hit ? hit.insight : "" };
  });
}

function synthesise(r) {
  return ask({
    system: "You are a contemplative oracle synthesising two independent readings.",
    schema: SYNTH_SCHEMA,
    messages: [{ role: "user", content:
      "Two oracles spoke independently. I Ching: Hexagram "+r.pHex+" ("+r.pName+")"+(r.rHex?" → "+r.rHex+" ("+r.rName+")":"")+
      ". Tarot: "+r.cards.map(c => c.name).join(", ")+".\n"+
      "synthesis: 2-3 poetic plain-English sentences — no card names, no I Ching terminology.\n"+
      "invitation: one warm sentence inviting the person to share what's on their mind."
    }],
  });
}

// The three interpretations are independent, so they run concurrently.
export async function interpretReading(r) {
  const [iching, tarot, synth] = await Promise.all([interpretIChing(r), interpretTarot(r), synthesise(r)]);
  return { iching, tarot, synthesis: synth.synthesis, invitation: synth.invitation };
}

// What the page showed about each card and the hexagram, so the chat stays
// consistent with it. `interp` is {iching:{primary,lines,resulting}, tarot:[{pos,card,insight}]}.
export function describeInterpretation(interp) {
  if (!interp) return "";
  const out = [], i = interp.iching || {};
  if (i.primary) out.push("I Ching: " + i.primary);
  if (i.lines) out.push("Changing lines: " + i.lines);
  if (i.resulting) out.push("Resulting hexagram: " + i.resulting);
  (interp.tarot || []).forEach(t => { if (t && t.insight) out.push("Tarot, " + t.pos + (t.card ? " (" + t.card + ")" : "") + ": " + t.insight); });
  return out.join("\n");
}

export function chat(r, synthesis, history, interp) {
  const shown = describeInterpretation(interp);
  const system =
    "You are the Digital Oracle of Divinatey. The person has drawn this reading — "+describeReading(r)+
    (synthesis ? ". The synthesis they were shown: \""+synthesis+"\"" : "")+".\n\n"+
    (shown ? "What their reading page says about each part (stay consistent with it, building on it rather than repeating it):\n"+shown+"\n\n" : "")+
    "When they share what's on their mind, reinterpret the reading through that lens, with specific references to the hexagram and cards. "+
    "Respond in plain text (no markdown), warm, poetic and grounded, 3-5 sentences, ending with one reflective question.\n\n"+
    "This is a tool for reflection, not prediction or professional advice. If the person describes a medical, legal or financial decision, "+
    "gently encourage appropriate professional guidance. If they express thoughts of suicide or self-harm, set the reading aside, respond with care, "+
    "and encourage them to contact Lifeline on 13 11 14 or emergency services on 000.";
  return ask({
    system,
    messages: history.map(m => ({ role: m.role, content: m.text })),
  });
}

// Chat about one birth chart. Only that chart's facts (and today's transits
// for it) are in context: no other system, chart or earlier reading.
export function chartChat(ctx, history) {
  const system =
    ctx.voice + " You are speaking with someone about " + (ctx.name ? ctx.name + "'s" : "their") + " " + ctx.title + ".\n\n" +
    "The chart (calculated, not to be recited):\n" + ctx.facts + "\n\n" +
    (ctx.now ? "Current transits for this chart, as of " + ctx.today + ":\n" + ctx.now + "\n\n" : "") +
    "Answer their questions about this chart only, referring to specific placements where it helps. " +
    "Respond in plain text (no markdown), warm and grounded, 3-6 sentences, ending with one reflective question when it fits.\n\n" +
    "This is a tool for reflection, not prediction or professional advice. If the person describes a medical, legal or financial decision, " +
    "gently encourage appropriate professional guidance. If they express thoughts of suicide or self-harm, set the chart aside, respond with care, " +
    "and encourage them to contact Lifeline on 13 11 14 or emergency services on 000.";
  return ask({ system, messages: history.map(m => ({ role: m.role, content: m.text })) });
}

// One standalone piece of writing from a single prompt: a chart explanation or
// reading section. No history and nothing shared between calls.
export function writeText(prompt) {
  return ask({
    system: "Write in plain text without markdown, headings or bullet points. Keep to the length asked for.",
    messages: [{ role: "user", content: prompt }],
  });
}

// ── Divination chat with linked charts ──────────────────────────────────────
// Four steps, only the last of which the person sees:
//   1. retrieve: pick the few chart facts that bear on this message (fast model)
//   2. make sense: private notes on how the draw and those facts fit together
//   3. insight: the reply, in plain words, with at most one explained term
//   4. polish: edit for clarity, jargon and length (fast model)
// Only chart data goes in (fact cards recalculated from birth details), never
// text from an earlier reading or explanation.
const SAFETY =
  "This is a tool for reflection, not prediction or professional advice. If the person describes a medical, legal or financial decision, " +
  "gently encourage appropriate professional guidance. If they express thoughts of suicide or self-harm, set the reading aside, respond with care, " +
  "and encourage them to contact Lifeline on 13 11 14 or emergency services on 000.";
const PICK_SCHEMA = obj({ ids: { type: "array", items: str } });
const NOTES_SCHEMA = obj({
  draw: str, chart: str, fit: str, core: str,
  used: { type: "array", items: obj({ id: str, plain: str }) },
});
const transcript = history => history.slice(-7).map(m => (m.role === "user" ? "Person: " : "Oracle: ") + m.text).join("\n");

// Hosts often cut requests off at 30-60 s; finish within this budget by
// skipping the optional polish when time is short.
const LINKED_BUDGET_MS = Number(process.env.LINKED_TIME_BUDGET_MS) || 25000;

// A sensible default when the fact-picking step fails: what's happening now,
// plus the first (core) entry of each linked chart.
function defaultFacts(charts) {
  const now = charts.flatMap(c => c.cards.filter(k => k.kind === "transit").slice(0, 2));
  const core = charts.map(c => c.cards.find(k => k.kind === "chart")).filter(Boolean);
  return [...core, ...now].slice(0, 6);
}

// Breadth: every linked chart gets a say, and none takes over. Human Design in
// particular yields far more facts than the others, so without this it dominates.
const PER_CHART = 2;
function balanceFacts(picked, charts) {
  const out = [], count = {};
  for (const k of picked) {
    if ((count[k.system] || 0) >= PER_CHART) continue;
    count[k.system] = (count[k.system] || 0) + 1; out.push(k);
  }
  for (const c of charts) {                      // a linked chart the picker skipped: its core fact
    if (count[c.system]) continue;
    const core = c.cards.find(k => k.kind === "chart");
    if (core) { out.push({ ...core, label: c.label }); count[c.system] = 1; }
  }
  return out.slice(0, Math.max(6, PER_CHART * charts.length));
}
// Lists the facts chart by chart, alternating, so no system sits at the top.
function interleave(charts) {
  const lists = charts.map(c => c.cards.map(k => ({ ...k, label: c.label })));
  const out = [];
  for (let i = 0; lists.some(l => i < l.length); i++) lists.forEach(l => { if (i < l.length) out.push(l[i]); });
  return out;
}

export async function linkedChat(r, synthesis, history, charts, interp) {
  const shown = describeInterpretation(interp);
  const t0 = Date.now(), times = {};
  const step = async (name, fn) => { const t = Date.now(); try { return await fn(); } finally { times[name] = Date.now() - t; } };
  const question = history[history.length - 1].text;
  const all = interleave(charts);
  const names = charts.map(c => c.label).join(", ");
  const byId = new Map(all.map(k => [k.id, k]));

  // 1. Retrieve (optional: falls back to default facts)
  const pick = await step("retrieve", () => ask({
    quick: true, schema: PICK_SCHEMA,
    system: "You select background facts for a reflective conversation. Choose only facts that genuinely bear on the person's latest message.",
    messages: [{ role: "user", content:
      "Their draw: " + describeReading(r) + "\n\nConversation so far:\n" + transcript(history) +
      "\n\nChart facts (id | chart | fact):\n" + all.map(k => k.id + " | " + k.label + " | " + k.text).join("\n") +
      "\n\nReturn the ids of the facts most relevant to their latest message. They have linked " + charts.length + " chart" + (charts.length > 1 ? "s" : "") + " (" + names + "): " +
      (charts.length > 1 ? "choose from each of them, one or two per chart, and never more than " + PER_CHART + " from any one chart. " : "choose 3 to 6. ") +
      "Prefer a mix of lasting traits and what's happening now." }],
  })).catch(err => { if (err instanceof OracleRefusal) throw err; console.warn("Linked chat: retrieve step failed, using default facts:", err.message || err); return null; });
  let facts = ((pick && pick.ids) || []).map(id => byId.get(id)).filter(Boolean);
  facts = facts.length ? balanceFacts(facts, charts) : defaultFacts(charts);

  // 2. Make sense (retried once: a malformed reply is the usual failure)
  const notesCall = () => ask({
    schema: NOTES_SCHEMA,
    system: "You are the analyst behind the Digital Oracle of Divinatey. Write private working notes; technical terms are fine here.",
    messages: [{ role: "user", content:
      "Their draw: " + describeReading(r) + (synthesis ? "\nThe synthesis they were shown: \"" + synthesis + "\"" : "") +
      (shown ? "\nWhat their reading page says about each part (stay consistent with it):\n" + shown : "") +
      "\n\nConversation so far:\n" + transcript(history) +
      "\n\nRelevant facts from the charts they chose to link:\n" + (facts.map(k => k.id + " | " + k.label + " | " + k.text).join("\n") || "(none apply)") +
      "\n\ndraw: what the hexagram and the cards (both, not just one) say about their latest message, consistent with what their page already says (2-3 sentences).\n" +
      "chart: what the chart facts add (2-4 sentences), or an empty string if none apply. " + (charts.length > 1 ? "Give each linked chart (" + names + ") its own say; don't let one system carry the answer. " : "") + "\n" +
      "fit: where the draw and the charts agree or pull against each other (1-2 sentences).\n" +
      "core: the single most useful insight for them right now (1-2 sentences).\n" +
      "used: for each fact you actually relied on, its id and a plain-English phrase a newcomer would understand, " +
      "naming the chart in brackets, e.g. \"how you make decisions (Human Design)\" or \"what's moving in your sky this week (Natal astrology)\"." }],
  });
  const notes = await step("make sense", () => notesCall().catch(err => {
    if (err instanceof OracleRefusal) throw err;
    console.warn("Linked chat: make-sense step failed once, retrying:", err.message || err);
    return notesCall();
  }));

  // 3. Insight
  const draft = await step("insight", () => ask({
    system: "You are the Digital Oracle of Divinatey. " + SAFETY,
    messages: [{ role: "user", content:
      "Their latest message: \"" + question + "\"\n\nConversation so far:\n" + transcript(history) +
      "\n\nYour private notes:\n- Draw: " + notes.draw + "\n- Charts: " + notes.chart + "\n- Fit: " + notes.fit + "\n- Core insight: " + notes.core +
      "\n\nWrite your reply to them: 3-5 sentences, plain text, warm, poetic and grounded. Lead with the core insight in terms of their situation. " +
      "Weave in the draw and the charts as everyday meaning, not as labels: use at most one term from any system, and explain it in plain words if you do. " +
      (charts.length > 1 ? "Let more than one of their charts shape the answer, not just one. " : "") +
      "End with one reflective question." }],
  }));

  // 4. Polish (optional: skipped when time is short; the draft is used if it fails)
  const polish = () => ask({
    quick: true,
    system: "You are an editor for the Digital Oracle of Divinatey. " + SAFETY,
    messages: [{ role: "user", content:
      "The person asked: \"" + question + "\"\n\nDraft reply:\n" + draft +
      "\n\nEdit the draft so it: directly answers what they asked; reads naturally aloud; uses at most one specialist term (explained in plain words) " +
      "and no gate numbers, degrees, house numbers or Sanskrit; stays 3-5 sentences ending with one reflective question; keeps the meaning and warmth. " +
      "Return only the final reply, as plain text." }],
  });
  let reply = draft;
  if (Date.now() - t0 < LINKED_BUDGET_MS) {
    reply = await step("polish", polish).catch(err => {
      if (err instanceof OracleRefusal) throw err;
      console.warn("Linked chat: polish step failed, using the draft:", err.message || err);
      return draft;
    }) || draft;
  } else times.polish = "skipped";
  console.log("Linked chat steps (ms):", JSON.stringify({ ...times, total: Date.now() - t0 }));

  const seen = new Set();
  const drewOn = (notes.used || []).filter(u => byId.has(u.id) && u.plain && !seen.has(u.plain) && seen.add(u.plain)).map(u => u.plain).slice(0, 4);
  return { reply, drewOn };
}
