import { useState } from "react";
import { T, GRAD } from "../theme.js";
import { accountRedirect, authErrorText } from "../auth.js";
import { deleteChartSlot } from "../api.js";
import { CHART_SYSTEMS } from "./ChartScreen.jsx";

const primaryBtn = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, padding: "12px 28px", fontSize: 15 };
const ghostBtn = { fontSize: 13, color: T.muted, background: "none", border: "1px solid " + T.border, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 600 };
const linkBtn = { background: "none", border: "none", padding: 0, color: T.purple, fontSize: 13, cursor: "pointer", fontWeight: 600 };
const field = { width: "100%", padding: "10px 12px", border: "1px solid " + T.border, borderRadius: 10, fontSize: 16, color: T.text, background: T.bg };
const lbl = { display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, margin: "0 0 6px" };
const card = { background: T.surface, border: "1px solid " + T.border, borderRadius: 16, padding: "22px 20px", marginTop: 8 };
const h2 = { fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 22, margin: "0 0 4px", color: T.text };
const MIN_PASSWORD = 8;

function Notice({ kind, children }) {
  if (!children) return null;
  return <p role={kind === "error" ? "alert" : "status"} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: kind === "error" ? T.pink : T.cyan }}>{children}</p>;
}

function SignIn({ client }) {
  const [mode, setMode] = useState("signin");      // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);             // {kind, text}

  const run = async fn => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ kind: "error", text: authErrorText(e) }); }
    setBusy(false);
  };
  const needEmail = () => { if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setMsg({ kind: "error", text: "Enter your email address." }); return false; } return true; };
  const needPassword = () => { if (password.length < MIN_PASSWORD) { setMsg({ kind: "error", text: `Passwords need at least ${MIN_PASSWORD} characters.` }); return false; } return true; };

  const submit = e => {
    e.preventDefault();
    if (!needEmail()) return;
    if (mode === "forgot") return run(async () => {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: accountRedirect() });
      if (error) throw error;
      setMsg({ kind: "ok", text: "If there's an account for that email, a password reset link is on its way." });
    });
    if (!needPassword()) return;
    if (mode === "signup") return run(async () => {
      const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: accountRedirect() } });
      if (error) throw error;
      if (!data.session) setMsg({ kind: "ok", text: "Check your email to confirm your account, then come back here." });
    });
    return run(async () => {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    });
  };
  const magicLink = () => {
    if (!needEmail()) return;
    run(async () => {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: accountRedirect() } });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Check your email for a sign-in link. It works once and expires in an hour." });
    });
  };

  const title = { signin: "Sign in", signup: "Create an account", forgot: "Reset your password" }[mode];
  return (
    <form onSubmit={submit} noValidate style={card}>
      <h2 style={h2}>{title}</h2>
      <p style={{ fontSize: 13, color: T.muted, margin: "0 0 18px", lineHeight: 1.6 }}>
        {mode === "forgot" ? "We'll email you a link to set a new password." : "An account keeps your plan and your saved charts. Drawing and free charts don't need one."}
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label style={lbl} htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" style={field} value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode !== "forgot" && <div><label style={lbl} htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={field} value={password} onChange={e => setPassword(e.target.value)} />
          {mode === "signup" && <p style={{ fontSize: 11, color: T.dim, margin: "6px 0 0" }}>At least {MIN_PASSWORD} characters.</p>}</div>}
        <Notice kind={msg && msg.kind}>{msg && msg.text}</Notice>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "one moment…" : { signin: "Sign in", signup: "Create account", forgot: "Send reset link" }[mode]}</button>
          {mode !== "forgot" && <button type="button" disabled={busy} onClick={magicLink} style={ghostBtn}>Email me a sign-in link instead</button>}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: T.muted }}>
          {mode === "signin" && <><button type="button" style={linkBtn} onClick={() => { setMode("signup"); setMsg(null); }}>Create an account</button>
            <button type="button" style={linkBtn} onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot password?</button></>}
          {mode !== "signin" && <button type="button" style={linkBtn} onClick={() => { setMode("signin"); setMsg(null); }}>Back to sign in</button>}
        </div>
      </div>
    </form>
  );
}

function SetPassword({ client, title, intro, onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async e => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setMsg({ kind: "error", text: `Passwords need at least ${MIN_PASSWORD} characters.` });
    setBusy(true); setMsg(null);
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ kind: "error", text: authErrorText(error) });
    setPassword("");
    setMsg({ kind: "ok", text: "Password saved." });
    onDone && onDone();
  };
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
      {title && <h3 style={{ ...lbl, margin: 0 }}>{title}</h3>}
      {intro && <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.6 }}>{intro}</p>}
      <div><label style={lbl} htmlFor="newpw">New password</label>
        <input id="newpw" type="password" autoComplete="new-password" style={field} value={password} onChange={e => setPassword(e.target.value)} /></div>
      <Notice kind={msg && msg.kind}>{msg && msg.text}</Notice>
      <div><button type="submit" disabled={busy} style={{ ...primaryBtn, padding: "10px 22px", fontSize: 14 }}>{busy ? "saving…" : "Save password"}</button></div>
    </form>
  );
}

function SavedCharts({ me, onOpen, onChanged }) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState(null);
  const bySlot = Object.fromEntries((me.charts || []).map(c => [c.slot, c]));
  const remove = async slot => {
    setBusy(slot); setError(null);
    try { await deleteChartSlot(slot); await onChanged(); }
    catch (e) { setError("That chart couldn't be removed. Try again."); }
    setBusy(0);
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ ...lbl, margin: 0 }}>Saved charts</h3>
      {me.plan !== "paid" && <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.6 }}>Saving charts is part of the paid plan: two chart slots, kept with your account.</p>}
      {me.plan === "paid" && Array.from({ length: me.slots }, (_, i) => i + 1).map(slot => {
        const c = bySlot[slot];
        const sys = c && CHART_SYSTEMS.find(s => s.id === c.system);
        return (
          <div key={slot} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid " + T.border, borderRadius: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.purple, fontWeight: 700 }}>Slot {slot}{sys ? " · " + sys.label : ""}</div>
              {c ? <div style={{ fontSize: 14, color: T.text, marginTop: 2 }}>{c.name || "Unnamed"} <span style={{ color: T.dim, fontSize: 12 }}>· {c.birth.date} {c.birth.time}{c.birth.place ? " · " + c.birth.place : ""}</span></div>
                : <div style={{ fontSize: 13, color: T.dim, marginTop: 2 }}>Empty. Generate a chart, then save it here.</div>}
            </div>
            {c && <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...ghostBtn, color: T.purple }} onClick={() => onOpen(c)}>Open</button>
              <button style={ghostBtn} disabled={busy === slot} onClick={() => remove(slot)}>{busy === slot ? "removing…" : "Remove"}</button>
            </div>}
          </div>
        );
      })}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

export function AccountScreen({ auth, onOpenChart }) {
  if (!auth.ready) return <p style={{ textAlign: "center", color: T.dim, marginTop: 40 }} role="status">Loading…</p>;
  if (!auth.enabled) return (
    <div style={card}><h2 style={h2}>Accounts are coming soon</h2>
      <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.6 }}>Drawing and free charts work without an account.</p></div>
  );
  if (auth.recovery && auth.session) return (
    <div style={card}><SetPassword client={auth.client} title="Set a new password" intro="Choose a new password for your account." onDone={auth.endRecovery} /></div>
  );
  if (!auth.session) return <SignIn client={auth.client} />;

  const me = auth.me;
  return (
    <div style={{ ...card, display: "grid", gap: 22 }}>
      <div>
        <h2 style={h2}>Your account</h2>
        <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>{auth.session.user.email}</p>
      </div>
      {!me ? <p style={{ color: T.dim, margin: 0 }} role="status">Loading your plan…</p> : <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, padding: "5px 12px", borderRadius: 999,
            color: me.plan === "paid" ? "#fff" : T.muted, background: me.plan === "paid" ? GRAD : T.bg, border: me.plan === "paid" ? "none" : "1px solid " + T.border }}>
            {me.plan === "paid" ? "Paid plan" : "Free plan"}</span>
          {me.plan !== "paid" && <span style={{ fontSize: 13, color: T.muted }}>Upgrading opens soon: $20/month or $180/year.</span>}
        </div>
        <SavedCharts me={me} onOpen={onOpenChart} onChanged={auth.refreshMe} />
      </>}
      <SetPassword client={auth.client} title="Password" intro="Set or change your password. Accounts made with a sign-in link can add one here." />
      <div><button style={ghostBtn} onClick={auth.signOut}>Sign out</button></div>
    </div>
  );
}
