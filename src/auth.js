// Sign-in with Supabase Auth: email + password, or a magic link. The browser
// only ever holds the public anon key; the server checks every request.
import { useState, useEffect, useCallback } from "react";
import { getConfig, getMe, setTokenSource } from "./api.js";
import { href } from "./preview.js";

let clientPromise = null;
export function getAuthClient() {
  // supabase-js loads only when accounts are configured.
  if (!clientPromise) clientPromise = getConfig().then(async cfg => {
    if (!cfg.auth) return null;
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(cfg.auth.url, cfg.auth.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }).catch(() => null);
  return clientPromise;
}

setTokenSource(async () => {
  const sb = await getAuthClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
});

export const accountRedirect = () => window.location.origin + href("account");

// {ready, enabled, session, me, recovery, refreshMe, signOut, client}
export function useAuth() {
  const [state, setState] = useState({ ready: false, enabled: false, session: null, me: null, recovery: false });
  const [client, setClient] = useState(null);

  const refreshMe = useCallback(async () => {
    try { const me = await getMe(); setState(s => ({ ...s, me })); }
    catch (e) { setState(s => ({ ...s, me: null })); }
  }, []);

  useEffect(() => {
    let sub = null, alive = true;
    getAuthClient().then(async sb => {
      if (!alive) return;
      if (!sb) { setState(s => ({ ...s, ready: true })); return; }
      setClient(sb);
      const { data } = await sb.auth.getSession();
      setState(s => ({ ...s, ready: true, enabled: true, session: data.session }));
      const r = sb.auth.onAuthStateChange((event, session) => {
        setState(s => ({ ...s, session, recovery: event === "PASSWORD_RECOVERY" ? true : event === "SIGNED_OUT" ? false : s.recovery, me: session ? s.me : null }));
      });
      sub = r.data.subscription;
    });
    return () => { alive = false; if (sub) sub.unsubscribe(); };
  }, []);

  const signedIn = !!state.session;
  useEffect(() => { if (signedIn) refreshMe(); }, [signedIn, refreshMe]);

  const signOut = useCallback(async () => { if (client) await client.auth.signOut(); }, [client]);
  const endRecovery = useCallback(() => setState(s => ({ ...s, recovery: false })), []);
  return { ...state, client, refreshMe, signOut, endRecovery };
}

// Supabase error → plain words for the viewer.
export function authErrorText(err) {
  const m = (err && (err.code || err.message) || "").toLowerCase();
  if (m.includes("invalid_credentials") || m.includes("invalid login")) return "That email and password don't match. Try again, or use a sign-in link.";
  if (m.includes("email_not_confirmed") || m.includes("not confirmed")) return "Confirm your email first. Check your inbox for the link we sent.";
  if (m.includes("weak_password") || m.includes("pwned") || m.includes("password")) return "Choose a stronger password: at least 8 characters, and not one that has appeared in a data leak.";
  if (m.includes("user_already_exists") || m.includes("already registered")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("email_address_not_authorized") || m.includes("not authorized")) return "Sign-up emails can't be sent to this address yet (the site's email service isn't fully set up). Please try again later.";
  if (m.includes("over_email_send_rate_limit") || m.includes("email rate limit")) return "Too many emails sent in the last hour. Wait a while, then try again.";
  if (m.includes("rate") || m.includes("security purposes")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("signup_disabled") || m.includes("signups not allowed")) return "New accounts are switched off right now.";
  if (m.includes("email_address_invalid") || m.includes("invalid format")) return "That email address doesn't look right.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the sign-in service. Check your connection and try again.";
  // Unknown: show what the sign-in service said, so problems can be reported and fixed.
  const detail = err && err.message ? " (" + String(err.message).slice(0, 160) + ")" : "";
  return "That didn't work. Check your details and try again." + detail;
}
