// The paid preview lives under /preview: same site, every paid feature
// unlocked for testing until payments are switched on. The server honours it
// only while PAID_PREVIEW isn't "0".
export const PREVIEW = /^\/preview(\/|$)/i.test(window.location.pathname);
export const BASE = PREVIEW ? "/preview" : "";

// The path below BASE, without slashes: "/preview/natal" → "natal".
export const routePath = () => window.location.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "").toLowerCase();
export const href = p => BASE + "/" + (p || "");
