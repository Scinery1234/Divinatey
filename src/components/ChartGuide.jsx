import { useState } from "react";
import { T } from "../theme.js";
import { explainChart, chartReading, oracleErrorText } from "../api.js";

const genBtn = { padding: "4px 12px", background: "var(--deep)", color: "#f5f0e8", border: "none", borderRadius: 4, fontFamily: "Georgia,serif", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };
const paras = t => t.split(/\n{2,}/).map((p, i) => <p key={i} style={{ lineHeight: 1.85, fontSize: 14, color: "#2a1a0a", margin: "0 0 10px", fontFamily: "Georgia,serif" }}>{p}</p>);

// One generated text: a button, then the text (kept in `texts` under `id`).
function useGenerate(texts, setText) {
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const run = async (id, fn) => {
    setBusy(b => ({ ...b, [id]: true })); setErrors(e => ({ ...e, [id]: null }));
    try { const { text } = await fn(); setText(id, text); }
    catch (err) { setErrors(e => ({ ...e, [id]: oracleErrorText(err) })); }
    setBusy(b => ({ ...b, [id]: false }));
  };
  return { busy, errors, run };
}

// Side panel. Free: the fixed reference text. Paid/preview: each item and each
// overview can be explained; every explanation is its own request built only
// from that item's (or that tab's) data.
export function GuidePanel({ reference, chart, canExplain, texts, setText, lockedCard, onClose }) {
  const [tab, setTab] = useState(0);
  const t = reference[tab];
  const g = useGenerate(texts, setText);
  const id = item => `${t.key}:${item}`;
  const gen = item => g.run(id(item), () => explainChart(chart, t.key, item));
  const Body = ({ item }) => <>
    {g.busy[id(item)] && <div className="spark">✦</div>}
    {g.errors[id(item)] && <p className="err">{g.errors[id(item)]}</p>}
    {texts[id(item)] && !g.busy[id(item)] && <div className="gk-item-b open">{paras(texts[id(item)])}</div>}
  </>;

  return (
    <div role="dialog" aria-label={canExplain ? "Chart guide" : "Chart reference"} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(30,22,48,.35)" }} />
      <div className="astro" style={{ position: "relative", width: "min(540px,94vw)", height: "100%", overflowY: "auto", borderRadius: 0, background: "var(--bg)", padding: 0 }}>
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--tint2)", borderBottom: "2px solid var(--rule)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "var(--deep)" }}>✦ {canExplain ? "Chart guide" : "Chart reference"}</strong>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "10px 14px 0", flexWrap: "wrap", borderBottom: "1px solid var(--rule)" }}>
          {reference.map((r, i) => <button key={r.key} onClick={() => setTab(i)}
            style={{ fontSize: 12, padding: "6px 10px", border: "1px solid var(--rule)", borderBottom: "none", borderRadius: "6px 6px 0 0", cursor: "pointer",
              background: i === tab ? "var(--card)" : "var(--tint3)", color: i === tab ? "var(--deep)" : "var(--muted)", fontWeight: i === tab ? 700 : 400 }}>{r.icon} {r.name}</button>)}
        </div>
        <div style={{ padding: "14px 18px 40px" }}>
          {canExplain && t.overview ? (
            <div className="gk-item" style={{ borderColor: t.col + "55" }}>
              <div className="gk-item-h" style={{ background: t.col + "14" }}>
                <div><strong style={{ color: t.col, fontSize: ".85rem" }}>{t.icon} {t.overviewTitle}</strong>
                  <div className="role" style={{ fontStyle: "normal" }}>{t.blurb}</div></div>
                <button style={{ ...genBtn, background: t.col }} disabled={!!g.busy[id("overview")]} onClick={() => gen("overview")}>
                  {g.busy[id("overview")] ? "Channelling…" : texts[id("overview")] ? "↺ Regenerate" : "Generate →"}</button>
              </div>
              {!texts[id("overview")] && !g.busy[id("overview")] && !g.errors[id("overview")] && <p className="rd-ph" style={{ padding: "8px 14px" }}>A summary of this section as a whole.</p>}
              <div style={{ padding: "0 14px" }}><Body item="overview" /></div>
            </div>
          ) : <p className="tagline">{t.blurb}</p>}

          {t.items.map((it, i) => (
            <div key={t.key + i} className="gk-item">
              <div className="gk-item-h"><div style={{ minWidth: 0 }}>
                <strong className="ttl">{it.title}</strong>{it.code && <> <span className="code" style={{ color: t.col }} dangerouslySetInnerHTML={{ __html: it.code }} /></>}
                {it.sub && <div className="sub" dangerouslySetInnerHTML={{ __html: it.sub }} />}
                {it.role && <div className="role">{it.role}</div>}
              </div>
              {canExplain && <button style={genBtn} disabled={!!g.busy[id(i)]} onClick={() => gen(i)}>{g.busy[id(i)] ? "Channelling…" : texts[id(i)] ? "↺" : "Explain →"}</button>}
              </div>
              {canExplain && <div style={{ padding: "0 14px" }}><Body item={i} /></div>}
            </div>
          ))}
          {!canExplain && lockedCard}
        </div>
      </div>
    </div>
  );
}

// The reading for this chart (paid/preview): each section is generated on its
// own from the chart and today's sky; no section sees another's text.
export function ChartReading({ reading, chart, texts, setText }) {
  const g = useGenerate(texts, setText);
  const [showTech, setShowTech] = useState({});
  if (!reading) return null;
  return (
    <div className="section" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
      <h3 className="sec-h">✦ {reading.title}</h3>
      <p className="tagline">Each section is written on its own from this chart and where things stand today.</p>
      {reading.sections.map(s => {
        const id = "r" + s.id, tid = "r" + s.id + "t";
        return (
          <div key={s.id} className="rd-sec">
            <div className="rd-head">
              <div><span>{s.icon}</span><strong>{s.title}</strong><span className="d">{s.desc}</span></div>
              <button className="gen-btn" disabled={!!g.busy[id]} onClick={() => g.run(id, () => chartReading(chart, s.id, false))}>
                {g.busy[id] ? "Channelling…" : texts[id] ? "↺ Regenerate" : "Generate →"}</button>
            </div>
            <div className="rd-body">
              {g.busy[id] ? <div className="spark">✦</div>
                : g.errors[id] ? <p className="err">{g.errors[id]}</p>
                : texts[id] ? paras(texts[id]) : <p className="rd-ph">Click Generate to write this section.</p>}
            </div>
            {s.technical && texts[id] && (
              <div style={{ padding: "0 20px 14px" }}>
                <button className="rd-astro-btn" style={{ display: "inline-block" }} onClick={() => {
                  const open = !showTech[s.id]; setShowTech(v => ({ ...v, [s.id]: open }));
                  if (open && !texts[tid]) g.run(tid, () => chartReading(chart, s.id, true));
                }}>📊 {showTech[s.id] ? "Hide" : "Show"} technical context</button>
                {showTech[s.id] && <div className="rd-astro"><p className="t">Technical context</p>
                  {g.busy[tid] ? <p className="dim">Loading…</p> : g.errors[tid] ? <p className="err">{g.errors[tid]}</p> : texts[tid] ? paras(texts[tid]) : null}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const guideButtonLabel = canExplain => canExplain ? "✦ chart guide" : "✦ chart reference";
export { T };
