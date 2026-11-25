// Browser security headers for every response.
//
// The content policy only lets the page load its own scripts (plus Cloudflare
// Turnstile when sign-up protection is on, and Google's ad hosts when ads are on), talk to this server and Supabase,
// and use Google Fonts. Inline styles stay allowed: the charts are styled inline.
export function securityHeaders(env = process.env) {
  const origin = u => { try { return new URL(u).origin; } catch { return null; } };
  const supabase = origin(env.SUPABASE_URL || "");
  const turnstile = env.TURNSTILE_SITE_KEY ? "https://challenges.cloudflare.com" : null;
  const list = (...xs) => xs.filter(Boolean).join(" ");
  // AdSense loads scripts, frames and images from many Google hosts that change
  // over time, so with ads on those directives allow any https source. Inline
  // scripts and plain-http sources stay blocked.
  const ads = /^ca-pub-\d+$/.test(env.ADSENSE_CLIENT || "");
  const adSrc = ads ? "https:" : null;
  const csp = [
    "default-src 'self'",
    "script-src " + list("'self'", turnstile, adSrc),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src " + list("'self' data: blob:", adSrc),
    "connect-src " + list("'self'", supabase, turnstile, adSrc),
    "frame-src " + (list(turnstile, adSrc) || "'none'"),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join("; ");
  const https = String(env.PUBLIC_URL || "").startsWith("https://");
  return (req, res, next) => {
    res.set({
      "Content-Security-Policy": csp,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    if (https || req.secure) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  };
}
