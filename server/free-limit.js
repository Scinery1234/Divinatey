import crypto from "node:crypto";

// Free tier: each IP may open `max` different charts per UTC day. Asking for
// the same chart again (same system and birth details) doesn't count. IPs and
// chart details are stored only as HMACs keyed with FREE_LIMIT_SECRET, so the
// stored rows can't be turned back into addresses or birth data.
export function freeChartLimit({ max, store, secret }) {
  const key = secret || crypto.randomBytes(32).toString("hex");
  const mac = v => crypto.createHmac("sha256", key).update(v).digest("hex");
  const today = () => new Date().toISOString().slice(0, 10);

  return {
    // Whether this IP may open this chart now: {ok, used, max}.
    async check(ip, chartKey) {
      const day = today();
      const seen = await store.usage(day, mac(day + "|" + ip));
      return { ok: seen.has(mac(chartKey)) || seen.size < max, used: seen.size, max };
    },
    // Counts the chart once it has been delivered.
    async record(ip, chartKey) {
      const day = today(), ipHash = mac(day + "|" + ip);
      await store.recordUsage(day, ipHash, mac(chartKey));
      return { used: (await store.usage(day, ipHash)).size, max };
    },
  };
}
