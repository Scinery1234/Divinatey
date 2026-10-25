import Anthropic from "@anthropic-ai/sdk";
import { describeReading } from "../shared/oracle.js";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ORACLE_EFFORT || "low";

export class OracleRefusal extends Error {}

// On a policy decline the API re-runs the request on Anthropic's recommended
// fallback model; a refusal that survives the chain surfaces as OracleRefusal.
async function ask({ system, messages, schema }) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: schema
      ? { effort: EFFORT, format: { type: "json_schema", schema } }
      : { effort: EFFORT },
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

export function chat(r, synthesis, history) {
  const system =
    "You are the Digital Oracle of Divinatey. The person has drawn this reading — "+describeReading(r)+
    (synthesis ? ". The synthesis they were shown: \""+synthesis+"\"" : "")+".\n\n"+
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
