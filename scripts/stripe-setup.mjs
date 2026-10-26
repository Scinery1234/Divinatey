// One-time Stripe setup for Divinatey. Safe to run again: it reuses what exists.
//
//   STRIPE_SECRET_KEY=sk_test_... PUBLIC_URL=https://your-site node scripts/stripe-setup.mjs
//
// Creates (or finds, by lookup key):
//   • "Divinatey paid plan": $20/month (divinatey_monthly) and $180/year (divinatey_yearly)
//   • "Extra question": $5 one-off (divinatey_extra_question)
//   • a billing portal configuration (switch monthly/yearly, update card, cancel, invoices)
//   • with PUBLIC_URL: a webhook endpoint at PUBLIC_URL/api/stripe/webhook, and prints its
//     signing secret for STRIPE_WEBHOOK_SECRET (only shown when first created)
// Use a test key (sk_test_...) first; run again with the live key when you launch.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY."); process.exit(1); }
const stripe = new Stripe(key);
const CURRENCY = (process.env.CURRENCY || "usd").toLowerCase();
const mode = key.startsWith("sk_live") ? "LIVE" : "test";

async function price(lookup, make) {
  const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (found.data.length) { console.log(`✓ ${lookup}: ${found.data[0].id} (exists)`); return found.data[0]; }
  const p = await make();
  console.log(`+ ${lookup}: ${p.id}`);
  return p;
}

console.log(`Stripe setup (${mode} mode, ${CURRENCY.toUpperCase()})\n`);
let planProduct = null;
const planProductId = async () => (planProduct ||= await stripe.products.create({
  name: "Divinatey paid plan", description: "Chart explanations and readings, chat, linked charts (5 questions a week), two saved charts, no daily limit." })).id;
const monthly = await price("divinatey_monthly", async () => stripe.prices.create({
  product: await planProductId(), currency: CURRENCY, unit_amount: 2000, recurring: { interval: "month" }, lookup_key: "divinatey_monthly", nickname: "Monthly",
}));
const productOf = p => typeof p.product === "string" ? p.product : p.product.id;
const yearly = await price("divinatey_yearly", () => stripe.prices.create({
  product: productOf(monthly), currency: CURRENCY, unit_amount: 18000, recurring: { interval: "year" }, lookup_key: "divinatey_yearly", nickname: "Yearly",
}));
await price("divinatey_extra_question", async () => {
  const extra = await stripe.products.create({ name: "Extra question", description: "One more question with your charts linked, beyond this week's five." });
  return stripe.prices.create({ product: extra.id, currency: CURRENCY, unit_amount: 500, lookup_key: "divinatey_extra_question", nickname: "Extra question" });
});

const configs = await stripe.billingPortal.configurations.list({ limit: 20 });
const productId = productOf(monthly);
const portalFeatures = {
  customer_update: { enabled: true, allowed_updates: ["email"] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations",
    products: [{ product: productId, prices: [monthly.id, yearly.id] }] },
};
const existing = configs.data.find(c => c.metadata && c.metadata.app === "divinatey");
if (existing) {
  await stripe.billingPortal.configurations.update(existing.id, { features: portalFeatures });
  console.log(`✓ billing portal: ${existing.id} (updated)`);
} else {
  const c = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your Divinatey plan" }, features: portalFeatures, metadata: { app: "divinatey" },
    default_return_url: process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, "") + "/account" : undefined,
  });
  await stripe.billingPortal.configurations.update(c.id, { active: true });
  console.log(`+ billing portal: ${c.id}`);
}

if (process.env.PUBLIC_URL) {
  const url = process.env.PUBLIC_URL.replace(/\/+$/, "") + "/api/stripe/webhook";
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const events = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
  const hook = hooks.data.find(h => h.url === url);
  if (hook) {
    await stripe.webhookEndpoints.update(hook.id, { enabled_events: events });
    console.log(`✓ webhook: ${url} (exists; its signing secret is in the Stripe dashboard)`);
  } else {
    const h = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: "Divinatey" });
    console.log(`+ webhook: ${url}\n\n  Set STRIPE_WEBHOOK_SECRET=${h.secret}\n`);
  }
} else {
  console.log("\n(No PUBLIC_URL: skipped the webhook. Run again with PUBLIC_URL=https://your-site, or add it in the Stripe dashboard.)");
}
console.log("\nDone. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server.");
