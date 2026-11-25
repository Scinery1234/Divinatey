// Browser security headers for every response.
//
// The content policy only lets the page load its own scripts (plus Cloudflare
// Turnstile when sign-up protection is on), talk to this server and Supabase,
// and use Google Fonts. Inline styles stay allowed: the charts are styled inline.
export function securityHeaders(env = process.env) {
  const origin = u => { try { return new URL(u).origin; } catch { return null; } };
  const supabase = origin(env.SUPABASE_URL || "");
  const turnstile = env.TURNSTILE_SITE_KEY ? "https://challenges.cloudflare.com" : null;
  const list = (...xs) => xs.filter(Boolean).join(" ");
  const csp = [
    "default-src 'self'",
    "script-src " + list("'self'", turnstile),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src " + list("'self'", supabase, turnstile),
    "frame-src " + (turnstile || "'none'"),
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
