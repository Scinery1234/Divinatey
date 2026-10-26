// Stripe billing: the paid plan ($20/month or $180/year) and $5 extra questions.
//
// Prices are found by lookup key (created by scripts/stripe-setup.mjs), or set
// directly with STRIPE_PRICE_MONTHLY / _YEARLY / _EXTRA. The webhook is the only
// thing that turns the paid plan on or off.
import Stripe from "stripe";

export const PRICE_KEYS = { monthly: "divinatey_monthly", yearly: "divinatey_yearly", extra: "divinatey_extra_question" };
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export class BillingError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function createBilling({ store, env = process.env }) {
  if (!env.STRIPE_SECRET_KEY) return null;
  const opts = {};
  if (env.STRIPE_API_BASE) {                 // tests: point the SDK at a local fake
    const u = new URL(env.STRIPE_API_BASE);
    Object.assign(opts, { host: u.hostname, port: Number(u.port), protocol: u.protocol.replace(":", "") });
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, opts);
  const priceCache = {};

  async function priceId(kind) {
    const direct = { monthly: env.STRIPE_PRICE_MONTHLY, yearly: env.STRIPE_PRICE_YEARLY, extra: env.STRIPE_PRICE_EXTRA }[kind];
    if (direct) return direct;
    if (!priceCache[kind]) {
      const list = await stripe.prices.list({ lookup_keys: [PRICE_KEYS[kind]], active: true, limit: 1 });
      if (!list.data.length) throw new Error(`Stripe price with lookup key ${PRICE_KEYS[kind]} not found. Run scripts/stripe-setup.mjs.`);
      priceCache[kind] = list.data[0].id;
    }
    return priceCache[kind];
  }

  async function customerFor(user) {
    const profile = await store.getProfile(user.id, user);
    if (profile.stripe_customer_id) return profile.stripe_customer_id;
    const c = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
    await store.setCustomer(user.id, c.id);
    return c.id;
  }

  // Subscription → profile fields. current_period_end lives on the item in newer API versions.
  function subscriptionFields(sub) {
    const item = sub.items && sub.items.data && sub.items.data[0];
    const end = sub.current_period_end || (item && item.current_period_end);
    return {
      plan: PAID_STATUSES.has(sub.status) ? "paid" : "free",
      subscription_id: sub.id,
      subscription_status: sub.status,
      billing_interval: item && item.price && item.price.recurring ? item.price.recurring.interval : null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      plan_renews_at: end ? new Date(end * 1000).toISOString() : null,
    };
  }

  return {
    // A Stripe Checkout page for the plan or for one extra question.
    async checkout(user, kind, returnUrl) {
      if (!PRICE_KEYS[kind]) throw new BillingError(400, "unknown plan");
      const profile = await store.getProfile(user.id, user);
      const subscribed = profile.plan === "paid" && profile.subscription_id;
      if (kind !== "extra" && subscribed) throw new BillingError(409, "already_subscribed");
      if (kind === "extra" && profile.plan !== "paid") throw new BillingError(403, "paid_required");
      const customer = await customerFor(user);
      const session = await stripe.checkout.sessions.create({
        mode: kind === "extra" ? "payment" : "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: await priceId(kind), quantity: 1 }],
        metadata: { user_id: user.id, kind },
        ...(kind === "extra" ? {} : { subscription_data: { metadata: { user_id: user.id } } }),
        allow_promotion_codes: kind !== "extra",
        success_url: returnUrl + (returnUrl.includes("?") ? "&" : "?") + "checkout=" + (kind === "extra" ? "extra" : "success"),
        cancel_url: returnUrl + (returnUrl.includes("?") ? "&" : "?") + "checkout=cancelled",
      });
      return session.url;
    },

    // Stripe's billing portal: change plan, update card, cancel, invoices.
    async portal(user, returnUrl) {
      const profile = await store.getProfile(user.id, user);
      if (!profile.stripe_customer_id) throw new BillingError(400, "no_billing");
      const s = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: returnUrl });
      return s.url;
    },

    // Verifies and applies a webhook event. Returns what it did, for logs and tests.
    async webhook(rawBody, signature) {
      let event;
      try { event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET); }
      catch (e) { throw new BillingError(400, "bad_signature"); }
      if (await store.eventSeen(event.id)) return "duplicate";
      let result = "ignored";
      const o = event.data.object;
      if (event.type === "checkout.session.completed") {
        const userId = o.client_reference_id || (o.metadata && o.metadata.user_id);
        if (userId && o.customer) await store.setCustomer(userId, o.customer);
        if (o.mode === "subscription" && o.subscription && userId) {
          const sub = typeof o.subscription === "string" ? await stripe.subscriptions.retrieve(o.subscription) : o.subscription;
          await store.applySubscription(userId, subscriptionFields(sub));
          result = "subscribed";
        } else if (o.mode === "payment" && o.metadata && o.metadata.kind === "extra" && o.payment_status === "paid" && userId) {
          await store.addExtraQuestions(userId, 1);
          result = "extra_question";
        }
      } else if (event.type.startsWith("customer.subscription.")) {
        const userId = (o.metadata && o.metadata.user_id) || await store.userByCustomer(o.customer);
        if (userId) {
          await store.applySubscription(userId, subscriptionFields(event.type === "customer.subscription.deleted" ? { ...o, status: "canceled" } : o));
          result = "subscription_" + o.status;
        }
      }
      await store.markEvent(event.id, event.type);
      return result;
    },
  };
}
