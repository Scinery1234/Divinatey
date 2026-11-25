// Accounts, saved charts and free-tier usage.
//
// With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, everything lives in
// Supabase (see supabase/migrations). Without them the server runs with an
// in-memory store: accounts are off, and the free chart counts reset when the
// server restarts. AUTH_TEST_TOKENS=1 (tests only, never with Supabase) makes
// the memory store accept bearer tokens of the form "test:<id>:<email>:<plan>".
import { createClient } from "@supabase/supabase-js";
import { createVault, withVault } from "./vault.js";

const SLOTS = [1, 2];
const PROFILE_FIELDS = "plan, plan_renews_at, stripe_customer_id, subscription_id, subscription_status, billing_interval, cancel_at_period_end, extra_questions";
const EMPTY_PROFILE = { plan: "free", plan_renews_at: null, stripe_customer_id: null, subscription_id: null, subscription_status: null,
  billing_interval: null, cancel_at_period_end: false, extra_questions: 0 };

function supabaseStore(url, serviceKey) {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = ({ data, error }) => { if (error) throw error; return data; };
  let cleanedFor = "";

  return {
    accounts: true,
    async getUser(token) {
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data || !data.user) return null;
      return { id: data.user.id, email: data.user.email || "" };
    },
    async getProfile(id) {
      const rows = must(await sb.from("profiles").select(PROFILE_FIELDS).eq("id", id).limit(1));
      if (rows.length) return rows[0];
      // The sign-up trigger normally creates this; fall back in case it wasn't installed.
      must(await sb.from("profiles").upsert({ id }, { onConflict: "id", ignoreDuplicates: true }));
      return { ...EMPTY_PROFILE };
    },
    async setCustomer(userId, customerId) {
      must(await sb.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId));
    },
    async userByCustomer(customerId) {
      const rows = must(await sb.from("profiles").select("id").eq("stripe_customer_id", customerId).limit(1));
      return rows.length ? rows[0].id : null;
    },
    async applySubscription(userId, sub) {
      must(await sb.from("profiles").update(sub).eq("id", userId));
    },
    async addExtraQuestions(userId, n) {
      must(await sb.rpc("add_extra_questions", { uid: userId, n }));
    },
    async useExtraQuestion(userId) {
      return !!must(await sb.rpc("use_extra_question", { uid: userId }));
    },
    async eventSeen(id) {
      return must(await sb.from("stripe_events").select("id").eq("id", id).limit(1)).length > 0;
    },
    async markEvent(id, type) {
      must(await sb.from("stripe_events").upsert({ id, type }, { ignoreDuplicates: true }));
    },
    async listCharts(userId) {
      return must(await sb.from("charts").select("slot, system, name, birth, updated_at").eq("user_id", userId).order("slot"));
    },
    async saveChart(userId, slot, chart) {
      must(await sb.from("charts").upsert({ user_id: userId, slot, ...chart, updated_at: new Date().toISOString() }, { onConflict: "user_id,slot" }));
    },
    async deleteChart(userId, slot) {
      must(await sb.from("charts").delete().eq("user_id", userId).eq("slot", slot));
    },
    async usage(day, ipHash) {
      if (cleanedFor !== day) {           // once per day per instance: drop earlier days
        cleanedFor = day;
        sb.from("free_chart_usage").delete().lt("day", day).then(() => {}, () => {});
      }
      return new Set(must(await sb.from("free_chart_usage").select("chart_hash").eq("day", day).eq("ip_hash", ipHash)).map(r => r.chart_hash));
    },
    async recordUsage(day, ipHash, chartHash) {
      must(await sb.from("free_chart_usage").upsert({ day, ip_hash: ipHash, chart_hash: chartHash }, { ignoreDuplicates: true }));
    },
    async linkedSeeds(userId, weekStart) {
      return new Set(must(await sb.from("linked_questions").select("seed").eq("user_id", userId).eq("week_start", weekStart)).map(r => String(r.seed)));
    },
    async recordLinked(userId, weekStart, seed) {
      must(await sb.from("linked_questions").upsert({ user_id: userId, week_start: weekStart, seed }, { ignoreDuplicates: true }));
    },
    // Free-account allowances: one row per use, keyed so repeats don't count twice.
    async usageKeys(userId, weekStart, kind) {
      return new Set(must(await sb.from("account_usage").select("key").eq("user_id", userId).eq("week_start", weekStart).eq("kind", kind)).map(r => r.key));
    },
    async recordUse(userId, weekStart, kind, key) {
      must(await sb.from("account_usage").upsert({ user_id: userId, week_start: weekStart, kind, key }, { ignoreDuplicates: true }));
    },
    // Past draws with their interpretation and chat, newest first.
    async listReadings(userId, limit = 50) {
      return must(await sb.from("readings").select("seed, data, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit));
    },
    async getReading(userId, seed) {
      const rows = must(await sb.from("readings").select("seed, data, created_at, updated_at").eq("user_id", userId).eq("seed", String(seed)).limit(1));
      return rows[0] || null;
    },
    async saveReading(userId, seed, data) {
      must(await sb.from("readings").upsert({ user_id: userId, seed: String(seed), data, updated_at: new Date().toISOString() }, { onConflict: "user_id,seed" }));
    },
    async deleteReading(userId, seed) {
      const q = sb.from("readings").delete().eq("user_id", userId);
      must(await (seed == null ? q : q.eq("seed", String(seed))));
    },
    async listLinked(userId) {
      return must(await sb.from("linked_questions").select("week_start, seed").eq("user_id", userId).order("week_start"));
    },
    // Removes the account and everything kept with it. The profile, charts and
    // linked questions also cascade from auth.users; deleting them first means
    // nothing is left behind if the last step fails and is retried.
    async deleteUser(userId) {
      must(await sb.from("charts").delete().eq("user_id", userId));
      must(await sb.from("linked_questions").delete().eq("user_id", userId));
      must(await sb.from("readings").delete().eq("user_id", userId));
      must(await sb.from("account_usage").delete().eq("user_id", userId));
      const { error } = await sb.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw error;
      must(await sb.from("profiles").delete().eq("id", userId));
    },
  };
}

function memoryStore({ testTokens }) {
  const charts = new Map();       // userId → Map(slot → chart)
  const usage = new Map();        // day|ipHash → Set(chartHash)
  const linked = new Map();       // userId|weekStart → Set(seed)
  const profiles = new Map();     // userId → profile fields set by billing
  const events = new Set();
  const deleted = new Set();
  const uses = new Map();         // userId|weekStart|kind → Set(key)
  const readings = new Map();     // userId → Map(seed → {data, created_at, updated_at})
  let counter = 0;      // test accounts that were deleted stop signing in
  const prof = id => { if (!profiles.has(id)) profiles.set(id, {}); return profiles.get(id); };
  return {
    accounts: !!testTokens,
    async getUser(token) {
      if (!testTokens) return null;
      const m = /^test:([\w-]+):([^:]*):(free|paid)$/.exec(token);
      return m && !deleted.has(m[1]) ? { id: m[1], email: m[2], plan: m[3] } : null;
    },
    async getProfile(id, user) {
      const p = profiles.get(id) || {};
      return { ...EMPTY_PROFILE, plan: (user && user.plan) || "free", ...p };
    },
    async setCustomer(userId, customerId) { prof(userId).stripe_customer_id = customerId; },
    async userByCustomer(customerId) {
      for (const [id, p] of profiles) if (p.stripe_customer_id === customerId) return id;
      return null;
    },
    async applySubscription(userId, sub) { Object.assign(prof(userId), sub); },
    async addExtraQuestions(userId, n) { const p = prof(userId); p.extra_questions = (p.extra_questions || 0) + n; },
    async useExtraQuestion(userId) {
      const p = prof(userId);
      if (!(p.extra_questions > 0)) return false;
      p.extra_questions--; return true;
    },
    async eventSeen(id) { return events.has(id); },
    async markEvent(id) { events.add(id); },
    async listCharts(userId) {
      const m = charts.get(userId) || new Map();
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([slot, c]) => ({ slot, ...c }));
    },
    async saveChart(userId, slot, chart) {
      if (!charts.has(userId)) charts.set(userId, new Map());
      charts.get(userId).set(slot, { ...chart, updated_at: new Date().toISOString() });
    },
    async deleteChart(userId, slot) { charts.get(userId)?.delete(slot); },
    async usage(day, ipHash) {
      for (const k of usage.keys()) if (!k.startsWith(day + "|")) usage.delete(k);
      return new Set(usage.get(day + "|" + ipHash) || []);
    },
    async recordUsage(day, ipHash, chartHash) {
      const k = day + "|" + ipHash;
      if (!usage.has(k)) usage.set(k, new Set());
      usage.get(k).add(chartHash);
    },
    async linkedSeeds(userId, weekStart) { return new Set(linked.get(userId + "|" + weekStart) || []); },
    async recordLinked(userId, weekStart, seed) {
      const k = userId + "|" + weekStart;
      if (!linked.has(k)) linked.set(k, new Set());
      linked.get(k).add(String(seed));
    },
    async usageKeys(userId, weekStart, kind) { return new Set(uses.get([userId, weekStart, kind].join("|")) || []); },
    async recordUse(userId, weekStart, kind, key) {
      const k = [userId, weekStart, kind].join("|");
      if (!uses.has(k)) uses.set(k, new Set());
      uses.get(k).add(key);
    },
    async listReadings(userId, limit = 50) {
      return [...(readings.get(userId) || new Map()).entries()].map(([seed, v]) => ({ seed, ...v }))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.n - a.n).slice(0, limit).map(({ n, ...v }) => v);
    },
    async getReading(userId, seed) {
      const v = readings.get(userId)?.get(String(seed));
      if (!v) return null;
      const { n, ...rest } = v;
      return { seed: String(seed), ...rest };
    },
    async saveReading(userId, seed, data) {
      if (!readings.has(userId)) readings.set(userId, new Map());
      const m = readings.get(userId), old = m.get(String(seed)), now = new Date().toISOString();
      m.set(String(seed), { data, created_at: old ? old.created_at : now, updated_at: now, n: ++counter });
    },
    async deleteReading(userId, seed) {
      if (seed == null) readings.delete(userId); else readings.get(userId)?.delete(String(seed));
    },
    async listLinked(userId) {
      const out = [];
      for (const [k, seeds] of linked) if (k.startsWith(userId + "|")) for (const seed of seeds) out.push({ week_start: k.slice(userId.length + 1), seed });
      return out.sort((a, b) => a.week_start.localeCompare(b.week_start));
    },
    async deleteUser(userId) {
      charts.delete(userId); profiles.delete(userId); readings.delete(userId); deleted.add(userId);
      for (const k of [...uses.keys()]) if (k.startsWith(userId + "|")) uses.delete(k);
      for (const k of [...linked.keys()]) if (k.startsWith(userId + "|")) linked.delete(k);
    },
  };
}

export function createStore(env = process.env) {
  return withVault(baseStore(env), createVault(env));
}

function baseStore(env) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    if (env.AUTH_TEST_TOKENS) throw new Error("AUTH_TEST_TOKENS must not be set together with Supabase");
    return supabaseStore(url, key);
  }
  return memoryStore({ testTokens: env.AUTH_TEST_TOKENS === "1" });
}

export { SLOTS };
