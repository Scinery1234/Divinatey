// Accounts, saved charts and free-tier usage.
//
// With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, everything lives in
// Supabase (see supabase/migrations). Without them the server runs with an
// in-memory store: accounts are off, and the free chart counts reset when the
// server restarts. AUTH_TEST_TOKENS=1 (tests only, never with Supabase) makes
// the memory store accept bearer tokens of the form "test:<id>:<email>:<plan>".
import { createClient } from "@supabase/supabase-js";

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
  };
}

function memoryStore({ testTokens }) {
  const charts = new Map();       // userId → Map(slot → chart)
  const usage = new Map();        // day|ipHash → Set(chartHash)
  const linked = new Map();       // userId|weekStart → Set(seed)
  const profiles = new Map();     // userId → profile fields set by billing
  const events = new Set();
  const prof = id => { if (!profiles.has(id)) profiles.set(id, {}); return profiles.get(id); };
  return {
    accounts: !!testTokens,
    async getUser(token) {
      if (!testTokens) return null;
      const m = /^test:([\w-]+):([^:]*):(free|paid)$/.exec(token);
      return m ? { id: m[1], email: m[2], plan: m[3] } : null;
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
  };
}

export function createStore(env = process.env) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    if (env.AUTH_TEST_TOKENS) throw new Error("AUTH_TEST_TOKENS must not be set together with Supabase");
    return supabaseStore(url, key);
  }
  return memoryStore({ testTokens: env.AUTH_TEST_TOKENS === "1" });
}

export { SLOTS };
