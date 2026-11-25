// Saved charts are encrypted on this server before they reach the database, so
// the database (and anyone who gets into it) holds only ciphertext.
//
// CHART_ENCRYPTION_KEY: 32 random bytes, base64 (`openssl rand -base64 32`).
// CHART_ENCRYPTION_OLD_KEYS: comma-separated earlier keys, still accepted for
// reading while charts are re-saved under the new key.
// Losing every key that saved a chart makes that chart unreadable for good.
import crypto from "node:crypto";

const VERSION = 1;

function parseKey(s) {
  const raw = Buffer.from(String(s).trim(), "base64");
  if (raw.length !== 32) throw new Error("CHART_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)");
  return raw;
}

// The row's owner and slot are bound in as associated data, so ciphertext
// copied to another account or slot doesn't decrypt.
const aad = (userId, slot) => Buffer.from(`divinatey-chart|${userId}|${slot}`);

export function createVault(env = process.env) {
  if (!env.CHART_ENCRYPTION_KEY) return null;
  const key = parseKey(env.CHART_ENCRYPTION_KEY);
  const keys = [key, ...String(env.CHART_ENCRYPTION_OLD_KEYS || "").split(",").filter(s => s.trim()).map(parseKey)];
  return {
    seal(userId, slot, value) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv("aes-256-gcm", key, iv);
      c.setAAD(aad(userId, slot));
      const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
      return { v: VERSION, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64") };
    },
    // Returns the value, or null when no key opens it (wrong key, tampered or moved).
    open(userId, slot, box) {
      for (const k of keys) {
        try {
          const d = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(box.iv, "base64"));
          d.setAAD(aad(userId, slot));
          d.setAuthTag(Buffer.from(box.tag, "base64"));
          return JSON.parse(Buffer.concat([d.update(Buffer.from(box.ct, "base64")), d.final()]).toString("utf8"));
        } catch { /* try the next key */ }
      }
      return null;
    },
  };
}

const sealed = birth => !!birth && typeof birth === "object" && birth.v === VERSION && typeof birth.ct === "string";

// Wraps a store so saved charts are sealed on the way in and opened on the way
// out. The chart's name label goes inside the sealed box; the plain name column
// stays empty. Charts saved before encryption was switched on still read, and
// are sealed the next time they're saved.
export function withVault(store, vault) {
  if (!vault) return store;
  // An unreadable reading (key lost) is skipped rather than shown.
  const openRow = (userId, row) => {
    if (!sealed(row.data)) return row;
    const data = vault.open(userId, "reading:" + row.seed, row.data);
    return data ? { ...row, data } : null;
  };
  return {
    ...store,
    async saveChart(userId, slot, chart) {
      const box = vault.seal(userId, slot, { name: chart.name || "", birth: chart.birth });
      return store.saveChart(userId, slot, { system: chart.system, name: "", birth: box });
    },
    // Saved readings (interpretation and chat) are sealed the same way, bound to their seed.
    async saveReading(userId, seed, data) {
      return store.saveReading(userId, seed, vault.seal(userId, "reading:" + seed, data));
    },
    async getReading(userId, seed) {
      const row = await store.getReading(userId, seed);
      return row && openRow(userId, row);
    },
    async listReadings(userId, limit) {
      return (await store.listReadings(userId, limit)).map(row => openRow(userId, row)).filter(Boolean);
    },
    async listCharts(userId) {
      return (await store.listCharts(userId)).map(row => {
        if (!sealed(row.birth)) return row;
        const v = vault.open(userId, row.slot, row.birth);
        if (!v) return { slot: row.slot, system: row.system, name: "", birth: null, locked: true, updated_at: row.updated_at };
        return { ...row, name: v.name, birth: v.birth };
      });
    },
  };
}
