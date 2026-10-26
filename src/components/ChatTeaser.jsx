import { T, GRAD } from "../theme.js";

// Follow-up questions shaped by the draw (changing lines or not) without
// naming any card or hexagram, so nothing of the reading is given away.
export function suggestedQuestions(r) {
  return [
    "What is the card in “What's in the way?” trying to show me?",
    r.changing && r.changing.length
      ? "What do the changing lines say about where this is heading?"
      : "How does my hexagram apply to my situation right now?",
    "What's one small step I could take this week?",
  ];
}

// For paid accounts: tap-to-ask chips before the first message.
export function SuggestedChips({ reading, onAsk, disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.purple, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>ask the oracle</div>
      {suggestedQuestions(reading).map(q => (
        <button key={q} disabled={disabled} onClick={() => onAsk(q)} style={chip}>{q}</button>
      ))}
    </div>
  );
}

const chip = { textAlign: "left", fontSize: 13, lineHeight: 1.5, padding: "10px 14px", borderRadius: 14, border: "1px solid " + T.purple + "44", background: T.surface, color: T.text, cursor: "pointer", fontFamily: "Georgia,serif" };

// For everyone else: the chat, visible but locked.
export function ChatTeaser({ reading, auth, onSignIn, onAccount, pulse, innerRef }) {
  const qs = suggestedQuestions(reading);
  const signedIn = auth && auth.session;
  const accountsOn = auth && auth.enabled;
  let cta;
  if (!accountsOn) cta = <p style={note}>Chat opens with the paid plan, coming soon.</p>;
  else if (!signedIn) cta = <>
    <button onClick={onSignIn} style={{ ...primary, padding: "12px 28px", fontSize: 15 }}>sign in to continue ✦</button>
    <p style={note}>Chat is part of the paid plan: $20/month or $180/year.</p>
  </>;
  else cta = <>
    <button onClick={onAccount} style={{ ...primary, padding: "12px 28px", fontSize: 15 }}>see the paid plan ✦</button>
    <p style={note}>$20/month or $180/year · upgrading opens soon</p>
  </>;

  return (
    <section ref={innerRef} aria-label="Chat with the oracle (paid plan)" className={pulse ? "teaser-pulse" : undefined}
      style={{ margin: "4px 0 20px", padding: 18, borderRadius: 18, border: "1px solid " + T.purple + "44", background: "linear-gradient(180deg,#ffffff,#f4efff)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.purple, textTransform: "uppercase", fontWeight: 700 }}>continue the conversation</div>
        <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>🔒 paid plan</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {qs.map(q => <button key={q} onClick={signedIn || !accountsOn ? onAccount : onSignIn} style={{ ...chip, opacity: 0.92 }}>{q}</button>)}
      </div>

      <div style={{ position: "relative", marginBottom: 16 }} aria-hidden="true">
        <div style={{ maxWidth: "88%", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: T.surface, border: "1px solid " + T.border, color: T.muted, fontSize: 14, lineHeight: 1.75, fontFamily: "Georgia,serif" }}>
          The card in “What's in the way?” is
          <span style={{ filter: "blur(5px)", userSelect: "none" }}> pointing to something you already sense but haven't said out loud. Notice where you hold back, and what it would cost you to stop.</span>
        </div>
      </div>

      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>{cta}</div>
    </section>
  );
}

const primary = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const note = { margin: 0, fontSize: 12, color: T.dim, lineHeight: 1.6 };
