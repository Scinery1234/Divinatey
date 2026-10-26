import crypto from "node:crypto";

// Free tier: each IP may open `max` different charts per UTC day. Asking for
// the same chart again (same system and birth details) doesn't count. IPs are
// kept only as salted hashes, and the whole table is dropped when the day
// changes. In memory, like rate-limit.js: one instance only.
export function freeChartLimit({ max }) {
  let day = "", salt = "", seen = new Map();
  const roll = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; salt = crypto.randomBytes(16).toString("hex"); seen = new Map(); }
  };
  const hash = ip => crypto.createHash("sha256").update(salt + ip).digest("hex");

  return {
    // Whether this IP may open this chart now: {ok, used, max}.
    check(ip, key) {
      roll();
      const keys = seen.get(hash(ip)) || new Set();
      return { ok: keys.has(key) || keys.size < max, used: keys.size, max };
    },
    // Counts the chart once it has been delivered.
    record(ip, key) {
      roll();
      const h = hash(ip);
      if (!seen.has(h)) seen.set(h, new Set());
      seen.get(h).add(key);
      return { used: seen.get(h).size, max };
    },
  };
}
