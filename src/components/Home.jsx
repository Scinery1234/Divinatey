import { useState } from "react";
import { T, SCRIPT, GRAD } from "../theme.js";
import { CHART_SYSTEMS } from "./ChartScreen.jsx";
import { PlanCards, PAID_FEATURES, goToCheckout } from "./Billing.jsx";
import { FooterLinks, VikLink } from "./common.jsx";
import { PREVIEW } from "../preview.js";

const primary = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const serif = "Georgia,'Times New Roman',serif";
const eyebrow = { fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: T.purple, fontWeight: 700, margin: "0 0 10px" };
const h2 = { fontFamily: serif, fontWeight: 400, fontSize: "clamp(24px,4.2vw,32px)", color: T.text, margin: "0 0 10px", lineHeight: 1.25, textWrap: "balance" };
const body = { fontSize: 15, color: T.muted, lineHeight: 1.75, margin: 0, maxWidth: 620 };
const card = { background: T.surface, border: "1px solid " + T.border, borderRadius: 18, padding: 22 };
const section = { maxWidth: 980, margin: "0 auto", padding: "56px max(18px, env(safe-area-inset-left, 0px)) 0" };

const SYSTEM_BLURB = {
  "gene-keys": ["Gene Keys", "Your Activation, Venus and Pearl sequences: the shadows you meet, the gifts they open into."],
  "human-design": ["Human Design", "Your bodygraph: type, strategy, inner authority, defined centres and channels."],
  "natal": ["Natal astrology", "The Western chart of your birth moment: planets, houses, aspects and patterns."],
  "vedic": ["Vedic astrology", "Jyotish in the sidereal zodiac: your Lagna, nakshatras and the dasha period you're in."],
};

const FAQ = [
  ["Does it predict the future?", "No. Divinatey is a tool for reflection: a prompt to look at your situation from a new angle. Take every interpretation with a grain of salt."],
  ["Do I need an account?", "Not to draw or open free charts. You'll want one for the paid plan, so your plan and saved charts follow you."],
  ["What happens to my birth details?", "They're used to calculate your chart and then discarded, unless you save the chart to your account. See the privacy page for the details."],
  ["Can I cancel?", "Any time, from Manage billing on your account page. You keep the paid plan until the end of the period you've paid for."],
];

export function Home({ onDraw, onContinue, onChart, onAccount, auth, billingOn, onPage, onCrisis }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const signedIn = !!(auth && auth.session);
  const paid = PREVIEW || (auth && auth.me && auth.me.plan === "paid");

  // Choosing a plan: signed-in people go straight to Stripe; others sign in first.
  const choose = async kind => {
    if (!signedIn || !billingOn) return onAccount();
    setBusy(kind); setErr(null);
    const e = await goToCheckout(kind);
    if (e) { setErr(e); setBusy(null); }
  };

  return (
    <div style={{ background: "radial-gradient(1200px 520px at 50% -120px, #ece4ff 0%, " + T.bg + " 62%)" }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header style={{ ...section, paddingTop: 72, textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(56px,11vw,88px)", fontWeight: 400, color: T.text, margin: "0 0 4px", lineHeight: 1.05, letterSpacing: 2, fontFamily: SCRIPT }}>Divinatey</h1>
        <p style={{ fontSize: 15, color: T.muted, margin: "0 0 18px", letterSpacing: 0.5 }}>what does the universe know?</p>
        <p style={{ ...body, margin: "0 auto 30px", maxWidth: 520, fontFamily: serif, fontSize: 16.5 }}>
          An I Ching hexagram and seven Tarot cards, drawn from this exact moment and read together.
          Then, if you like, bring in your birth charts to see what they add.
        </p>
        <p style={{ fontSize: 13, color: T.muted, margin: "0 0 18px", fontStyle: "italic", fontFamily: serif }}>Think of a question for the oracle, or write it down, then draw.</p>
        <button onClick={onDraw} style={{ ...primary, padding: "17px 46px", fontSize: 17 }}>draw my reading ✦</button>
        <p style={{ margin: "14px 0 0", fontSize: 11, color: T.dim, letterSpacing: 2, textTransform: "uppercase" }}>free · no account needed</p>
        {onContinue && <p style={{ margin: "18px 0 0" }}><button className="link-btn" onClick={onContinue} style={{ fontSize: 14, color: T.purple, fontWeight: 600 }}>or continue your last reading →</button></p>}
      </header>

      {/* ── Two ways in ──────────────────────────────────────────────────── */}
      <section style={section} aria-labelledby="ways">
        <p style={eyebrow}>two ways in</p>
        <h2 id="ways" style={h2}>Ask the oracle, or read your chart</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginTop: 18 }}>
          <div style={card}>
            <div style={{ fontSize: 34, color: T.gold, lineHeight: 1, marginBottom: 10 }} aria-hidden="true">䷀ ✦</div>
            <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 20, margin: "0 0 6px", color: T.text }}>I Ching + Tarot</h3>
            <p style={{ ...body, fontSize: 14 }}>A hexagram and a seven-card spread, cast independently from the moment you press draw and seeded with quantum noise. Each is interpreted, then woven together.</p>
            <button onClick={onDraw} style={{ ...primary, padding: "10px 22px", fontSize: 13, marginTop: 14 }}>draw ✦</button>
          </div>
          <div style={card}>
            <div style={{ fontSize: 30, color: T.purple, lineHeight: 1, marginBottom: 10, fontFamily: serif }} aria-hidden="true">☉ ☽ ✶</div>
            <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 20, margin: "0 0 6px", color: T.text }}>Your birth charts</h3>
            <p style={{ ...body, fontSize: 14 }}>Enter your birth date, time and place once, and open four charts calculated from that moment, with today's transits and a two-week forecast.</p>
            <button onClick={() => onChart("natal")} style={{ ...primary, padding: "10px 22px", fontSize: 13, marginTop: 14 }}>open my chart ✦</button>
          </div>
        </div>
      </section>

      {/* ── Four charts ──────────────────────────────────────────────────── */}
      <section style={section} aria-labelledby="charts">
        <p style={eyebrow}>one birth moment, four lenses</p>
        <h2 id="charts" style={h2}>Four charts from the same few details</h2>
        <p style={body}>Switch between them freely: your details carry across, and each system speaks only its own language.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 18 }}>
          {CHART_SYSTEMS.map(s => (
            <button key={s.id} onClick={() => onChart(s.id)} style={{ ...card, textAlign: "left", cursor: "pointer", display: "grid", gap: 6, alignContent: "start", font: "inherit", padding: 18 }}>
              <span style={{ fontFamily: serif, fontSize: 18, color: T.text }}>{SYSTEM_BLURB[s.id][0]}</span>
              <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{SYSTEM_BLURB[s.id][1]}</span>
              <span style={{ fontSize: 12, color: T.purple, fontWeight: 700, marginTop: 4 }}>open →</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Ask with your charts ─────────────────────────────────────────── */}
      <section style={section} aria-labelledby="together">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 28, alignItems: "center" }}>
          <div>
            <p style={eyebrow}>paid plan</p>
            <h2 id="together" style={h2}>Bring your charts into the conversation</h2>
            <p style={body}>After a reading, chat with the oracle about what's on your mind. Link your charts and it looks up what's relevant to your question, makes sense of it alongside the cards, and answers in plain words, without the jargon.</p>
          </div>
          <div aria-label="Example conversation" style={{ ...card, background: "linear-gradient(180deg,#ffffff,#f5f0ff)", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: T.dim, textTransform: "uppercase", fontWeight: 700 }}>example</div>
            <div style={{ justifySelf: "end", maxWidth: "85%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: GRAD, color: "#fff", fontSize: 14, fontFamily: serif, lineHeight: 1.6 }}>Should I say yes to the new role?</div>
            <div style={{ maxWidth: "92%", padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: T.surface, border: "1px solid " + T.border, color: T.muted, fontSize: 14, fontFamily: serif, lineHeight: 1.7 }}>
              The cards point to a door that's already half open, and you tend to know your answer only once you've slept on it. Give yourself a night before you reply. What would feel true tomorrow morning?
            </div>
            <div style={{ fontSize: 11, color: T.purple, lineHeight: 1.5 }}>✦ drew on: how you make decisions (Human Design) · what's moving in your sky this week (Natal astrology)</div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={section} aria-labelledby="price">
        <p style={eyebrow}>pricing</p>
        <h2 id="price" style={h2}>Start free. Go deeper when you want to.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 18, alignItems: "start" }}>
          <div style={card}>
            <h3 style={{ ...eyebrow, color: T.muted }}>free</h3>
            <div style={{ fontFamily: serif, fontSize: 30, color: T.text, marginBottom: 10 }}>$0</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: T.muted, lineHeight: 1.9 }}>
              <li>Unlimited I Ching + Tarot readings, interpreted</li>
              <li>All four charts for two people a day</li>
              <li>Transits, a two-week forecast and a chart reference</li>
            </ul>
            <button onClick={onDraw} style={{ fontSize: 13, color: T.purple, background: "none", border: "1px solid " + T.purple + "66", borderRadius: 999, padding: "10px 20px", cursor: "pointer", fontWeight: 700, marginTop: 16 }}>draw a reading</button>
          </div>
          <div style={{ ...card, borderColor: T.purple + "66", background: "linear-gradient(180deg,#ffffff,#f7f2ff)" }}>
            <h3 style={eyebrow}>paid</h3>
            <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 14, color: T.muted, lineHeight: 1.9 }}>{PAID_FEATURES.map(f => <li key={f}>{f}</li>)}</ul>
            {paid ? <p style={{ margin: 0, fontSize: 13, color: T.cyan, fontWeight: 600 }}>{PREVIEW ? "Unlocked in this preview." : "You're on the paid plan."}</p>
              : <PlanCards onChoose={choose} busy={busy} compact />}
            {!paid && <p style={{ margin: "10px 0 0", fontSize: 11, color: T.dim }}>
              {billingOn ? (signedIn ? "Secure checkout with Stripe. Cancel any time." : "You'll sign in or create an account first.") : "Upgrading opens soon."}</p>}
            {err && <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: T.pink }}>{err}</p>}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={section} aria-labelledby="faq">
        <p style={eyebrow}>questions</p>
        <h2 id="faq" style={h2}>Good to know</h2>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {FAQ.map(([q, a]) => (
            <details key={q} style={{ ...card, padding: "14px 18px" }}>
              <summary style={{ cursor: "pointer", fontFamily: serif, fontSize: 16, color: T.text }}>{q}</summary>
              <p style={{ ...body, fontSize: 14, marginTop: 8 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div style={{ ...section, paddingTop: 48, paddingBottom: 8, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: T.dim, lineHeight: 1.8, margin: 0 }}>Prefer a human? Get coaching, psychotherapy and intuitive guidance with <VikLink/>.</p>
      </div>
      <FooterLinks onPage={onPage} onCrisis={onCrisis} />
    </div>
  );
}
