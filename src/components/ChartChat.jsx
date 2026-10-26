import { useState, useEffect, useRef } from "react";
import { T, GRAD } from "../theme.js";
import { askChart, oracleErrorText } from "../api.js";
import { detectCrisis } from "../../shared/safety.js";
import { ChatTeaser, SuggestedChips } from "./ChatTeaser.jsx";

const QUESTIONS = [
  "What are my greatest strengths in this chart?",
  "Where is my main growth edge?",
  "What's most important for me right now, with today's transits?",
];
const PREVIEW = ["The strongest thread running through your chart is",
  " a pull between what feels safe and what feels alive. The places where those meet are where your real work, and your real ease, begin."];
const now = () => new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

// Chat about the chart on screen. `chart` is the request body that generated it;
// a new chart starts a new conversation.
export function ChartChat({ chart, canChat, auth, onSignIn, onAccount, onCrisis }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const conv = useRef(0);
  const key = JSON.stringify(chart);
  useEffect(() => { conv.current++; setMsgs([]); setInput(""); setError(null); setBusy(false); }, [key]);

  if (!canChat) return (
    <div style={{ marginTop: 20 }}>
      <ChatTeaser questions={QUESTIONS} preview={PREVIEW} auth={auth} onSignIn={onSignIn} onAccount={onAccount} />
    </div>
  );

  const send = async text => {
    if (detectCrisis(text) && onCrisis) onCrisis();
    const id = conv.current;
    const history = [...msgs, { role: "user", text, ts: now() }];
    setMsgs(history); setBusy(true); setError(null);
    try {
      const { reply } = await askChart(chart, history);
      if (id !== conv.current) return;
      setMsgs(h => [...h, { role: "assistant", text: reply, ts: now() }]);
    } catch (err) {
      if (id !== conv.current) return;
      setMsgs(msgs); setInput(text); setError(oracleErrorText(err));
    }
    if (id === conv.current) setBusy(false);
  };
  const submit = e => { e.preventDefault(); const t = input.trim(); if (t && !busy) { setInput(""); send(t); } };

  return (
    <section aria-label="Chat about this chart" style={{ marginTop: 20, padding: 18, borderRadius: 18, border: "1px solid " + T.border, background: T.surface }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.purple, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>ask about this chart</div>
      {msgs.length === 0 && !busy && <SuggestedChips questions={QUESTIONS} label="try asking" onAsk={send} disabled={busy} />}
      <div aria-live="polite">
        {msgs.map((m, i) => { const mine = m.role === "user"; return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "86%", padding: "12px 16px", borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: mine ? GRAD : T.bg, color: mine ? "#fff" : T.muted, fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap", border: mine ? "none" : "1px solid " + T.border, fontFamily: "Georgia,serif" }}>{m.text}</div>
            <div style={{ fontSize: 9, color: T.dim, marginTop: 3, padding: "0 4px" }}>{m.ts}</div>
          </div>
        ); })}
        {busy && <div className="pulse" style={{ color: T.dim, fontSize: 20, margin: "0 0 12px 6px" }} aria-label="thinking">···</div>}
        {error && <p role="alert" style={{ fontSize: 13, color: T.pink, textAlign: "center", margin: "0 0 12px" }}>{error}</p>}
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea value={input} aria-label="Ask about this chart" maxLength={2000} rows={1} disabled={busy}
          onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          placeholder="ask about this chart…"
          style={{ flex: 1, resize: "none", border: "1px solid " + T.border, borderRadius: 12, padding: "10px 14px", fontSize: 16, fontFamily: "Georgia,serif", lineHeight: 1.5, outline: "none", overflow: "hidden", color: T.text, background: T.bg }} />
        <button type="submit" disabled={busy || !input.trim()} style={{ background: busy || !input.trim() ? "none" : GRAD, color: busy || !input.trim() ? T.dim : "#fff", border: busy || !input.trim() ? "1px solid " + T.border : "1px solid transparent", borderRadius: 12, padding: "10px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>send</button>
      </form>
    </section>
  );
}
