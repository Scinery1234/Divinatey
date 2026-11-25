// Cloudflare Turnstile: a bot check Supabase verifies on sign-up and sign-in,
// shown only when the server is configured with TURNSTILE_SITE_KEY.
// Each token works once, so callers reset() after every attempt.
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC; s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { loading = null; reject(new Error("turnstile_load")); };
    document.head.appendChild(s);
  });
  return loading;
}

export const Turnstile = forwardRef(function Turnstile({ siteKey, onToken }, ref) {
  const box = useRef(null), widget = useRef(null);
  useImperativeHandle(ref, () => ({
    reset() { onToken(null); if (window.turnstile && widget.current != null) window.turnstile.reset(widget.current); },
  }));
  useEffect(() => {
    let alive = true;
    loadTurnstile().then(ts => {
      if (!alive || !box.current) return;
      widget.current = ts.render(box.current, {
        sitekey: siteKey, appearance: "interaction-only",
        callback: t => onToken(t), "expired-callback": () => onToken(null), "error-callback": () => onToken(null),
      });
    }).catch(() => onToken(null));
    return () => { alive = false; if (window.turnstile && widget.current != null) window.turnstile.remove(widget.current); };
  }, [siteKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} />;
});
