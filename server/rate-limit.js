// Minimal in-memory, per-IP fixed-window limiter. Good enough for a single
// instance; put a shared store (or your platform's limiter) in front when
// running several.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (now - h.start > windowMs) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || now - h.start > windowMs) {
      h = { start: now, count: 0 };
      hits.set(req.ip, h);
    }
    if (++h.count > max) {
      res.set("Retry-After", String(Math.ceil((h.start + windowMs - now) / 1000)));
      return res.status(429).json({ error: "rate limited" });
    }
    next();
  };
}
