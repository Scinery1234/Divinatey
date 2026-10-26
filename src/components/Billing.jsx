import { useState, useEffect } from "react";
import { T, GRAD } from "../theme.js";
import { startCheckout, openPortal, billingErrorText } from "../api.js";
import { href } from "../preview.js";

export const PLANS = [
  { kind: "monthly", name: "Monthly", price: "$20", per: "a month", note: "Cancel any time" },
  { kind: "yearly", name: "Yearly", price: "$180", per: "a year", note: "Save $60 · two months free" },
];
export const PAID_FEATURES = [
  "Chat with the oracle about every reading",
  "Bring your birth charts into your questions: 5 a week, $5 for each extra",
  "AI explanations of every placement, and a reading of your chart against today's sky",
  "Chat about your charts",
  "Two saved charts and no daily chart limit",
];

const primary = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const ghost = { fontSize: 13, color: T.muted, background: "none", border: "1px solid " + T.border, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 600 };
const lbl = { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, margin: 0 };
const fmtDay = iso => iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";

// Sends the browser to Stripe. Returns an error message, or nothing.
export async function goToCheckout(kind, returnTo = "account") {
  try { const { url } = await startCheckout(kind, href(returnTo)); window.location.assign(url); return null; }
  catch (e) { return billingErrorText(e); }
}

export function PlanCards({ onChoose, busy, compact }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
      {PLANS.map(p => (
        <div key={p.kind} style={{ border: "1px solid " + (p.kind === "yearly" ? T.purple + "66" : T.border), borderRadius: 16, padding: compact ? 16 : 20, background: p.kind === "yearly" ? "#f7f2ff" : T.surface, display: "grid", gap: 8, alignContent: "start" }}>
          <div style={{ ...lbl, color: T.purple }}>{p.name}</div>
          <div><span style={{ fontFamily: "Georgia,serif", fontSize: 30, color: T.text }}>{p.price}</span> <span style={{ fontSize: 13, color: T.muted }}>{p.per}</span></div>
          <div style={{ fontSize: 12, color: T.dim }}>{p.note}</div>
          {onChoose && <button disabled={!!busy} onClick={() => onChoose(p.kind)} style={{ ...primary, padding: "11px 20px", fontSize: 14, marginTop: 4 }}>
            {busy === p.kind ? "opening…" : "Choose " + p.name.toLowerCase()}</button>}
        </div>
      ))}
    </div>
  );
}

// The billing part of the account page.
export function BillingPanel({ me, refreshMe }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const b = me.billing || {};

  // Back from Stripe: say what happened, and refresh until the webhook has landed.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("checkout");
    if (!q) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (q === "cancelled") return;
    setNotice(q === "extra" ? "Thanks: your extra question is being added." : "Thanks: your paid plan is being switched on.");
    let tries = 0;
    const t = setInterval(() => { tries++; refreshMe(); if (tries >= 8) clearInterval(t); }, 2000);
    return () => clearInterval(t);
  }, [refreshMe]);

  const choose = async kind => { setBusy(kind); setError(null); const e = await goToCheckout(kind); if (e) { setError(e); setBusy(null); } };
  const manage = async () => {
    setBusy("portal"); setError(null);
    try { const { url } = await openPortal(href("account")); window.location.assign(url); }
    catch (e) { setError(billingErrorText(e)); setBusy(null); }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h3 style={lbl}>Plan</h3>
      {notice && <p role="status" style={{ margin: 0, fontSize: 13, color: T.cyan }}>{notice}</p>}
      {me.plan === "paid" ? <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, padding: "5px 12px", borderRadius: 999, color: "#fff", background: GRAD }}>Paid plan</span>
          {b.interval && <span style={{ fontSize: 13, color: T.muted }}>{b.interval === "year" ? "$180 a year" : "$20 a month"}</span>}
        </div>
        {b.status === "past_due" && <p role="alert" style={{ margin: 0, fontSize: 13, color: T.pink }}>Your last payment didn't go through. Update your card in Manage billing to keep the paid plan.</p>}
        {b.renewsAt && <p style={{ margin: 0, fontSize: 13, color: T.muted }}>{b.cancelAtPeriodEnd ? "Ends on " : "Renews on "}{fmtDay(b.renewsAt)}</p>}
        {me.questions && <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
          Questions with charts this week: {me.questions.used} of {me.questions.max}{b.extraQuestions ? ` · ${b.extraQuestions} extra question${b.extraQuestions > 1 ? "s" : ""} ready` : ""}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {b.hasCustomer && b.enabled && <button style={ghost} disabled={!!busy} onClick={manage}>{busy === "portal" ? "opening…" : "Manage billing"}</button>}
          {b.enabled && <button style={{ ...ghost, color: T.purple }} disabled={!!busy} onClick={() => choose("extra")}>{busy === "extra" ? "opening…" : "Buy an extra question · $5"}</button>}
        </div>
        {!b.subscribed && <p style={{ margin: 0, fontSize: 12, color: T.dim }}>Your plan was set up by hand, so there's nothing to manage here.</p>}
      </> : b.enabled ? <>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>You're on the free plan. The paid plan adds:</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.muted, lineHeight: 1.8 }}>{PAID_FEATURES.map(f => <li key={f}>{f}</li>)}</ul>
        <PlanCards onChoose={choose} busy={busy} compact />
        <p style={{ margin: 0, fontSize: 11, color: T.dim }}>Payments are handled by Stripe. Cancel any time from Manage billing; you keep the paid plan until the end of the period.</p>
      </> : <p style={{ margin: 0, fontSize: 13, color: T.muted }}>You're on the free plan. Upgrading opens soon: $20 a month or $180 a year.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: T.pink }}>{error}</p>}
    </div>
  );
}
