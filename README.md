# Divinatey

I Ching + Tarot drawn from this exact moment in time, interpreted by Claude, plus four birth charts: Gene Keys, Human Design, Western natal and Vedic. Built by [Vikashan](https://www.vikashan.org).

## How it works

- **Server** (`server/`, Express): holds the Anthropic API key, generates the seed (timestamp + ANU quantum noise, with hardware entropy as fallback), casts the reading and asks Claude to interpret it.
- **Client** (`src/`, React + Vite): the splash screen, the reading, the follow-up chat, crisis resources, and the About/Terms/Privacy pages (at `/about`, `/terms`, `/privacy`).
- **Shared** (`shared/`): the casting engine used by both sides, the crisis keywords, and the chart engine (`shared/astro/`).
- **Charts** (`server/astro.js`): the server calculates and renders every chart from the birth details, so the free limit can't be bypassed. Each system is loaded into its own isolated instance of the engine. Routes: `GET /api/places?q=` (birth place search over 111k GeoNames places), `GET /api/systems`, `POST /api/chart`. The free tier allows `FREE_CHARTS_PER_DAY` (2) different people per IP per day. One person's birth details open all four systems and count once; reopening them doesn't count again. IPs are held only as keyed hashes and reset daily.

The client only ever sends the **seed** back. The server rebuilds the reading from it, so a client can't get arbitrary content into the prompts, and the API key never reaches the browser. The three interpretations (I Ching, Tarot, synthesis) run in parallel and return structured JSON.

Nothing is stored unless someone creates an account (see below). Rate limiting is an in-memory, per-IP counter (`RATE_LIMIT_PER_10MIN`, 40 by default).

## Running locally

Requires Node 22+.

```bash
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm install
npm run dev               # API on :8787, app on http://localhost:5173
```

## Production

```bash
npm run build
npm start                 # serves the app and API on $PORT (8787 by default)
```

Or use Docker:

```bash
docker build -t divinatey .
docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-ant-... divinatey
```

If the app runs behind a reverse proxy or load balancer, set `TRUST_PROXY=1` so rate limits apply to the real client IPs. The rate limiter keeps its counts in memory, so if you run several instances, enforce limits at the proxy instead.

## Configuration

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | |
| `ORACLE_EFFORT` | `low` | `low`–`max`. Higher is slower and costs more. |
| `ANU_API_KEY` | (unset) | Key for ANU's quantum API. Without it, the app tries ANU's legacy endpoint and then falls back to `crypto`. |
| `PORT` | `8787` | |
| `RATE_LIMIT_PER_10MIN` | `40` | Interpret and chat requests per IP |
| `TRUST_PROXY` | (unset) | Set to `1` behind a proxy |
| `FREE_CHARTS_PER_DAY` | `2` | Different people (birth details) each IP may open per UTC day, each in all four systems |
| `SUPABASE_URL` | (unset) | Turns accounts on, with the two keys below |
| `SUPABASE_ANON_KEY` | (unset) | Public key the browser uses to sign in |
| `SUPABASE_SERVICE_ROLE_KEY` | (unset) | Secret; server only |
| `FREE_LIMIT_SECRET` | (random per start) | Key for hashing IPs in the free chart count |
| `PAID_PREVIEW` | on | Set to `0` to close the paid preview at `/preview` |
| `PREVIEW_CHAT_PER_10MIN` | `20` | Chat messages per IP in the preview |
| `EXPLAIN_PER_10MIN` | `60` | Chart explanations and reading sections per IP (paid and preview) |

If a request is declined on policy grounds, it's automatically retried on Anthropic's recommended fallback model (`fallbacks: "default"`).

## Accounts (Supabase)

Accounts are optional: drawing and free charts work without them. With Supabase configured, people can sign up with email and password or use a magic link, reset their password, and (on the paid plan) save two charts.

1. Create a Supabase project and run `supabase/migrations/0001_accounts_and_charts.sql` in the SQL editor.
2. In **Authentication → URL Configuration**, set the Site URL to your domain and add `https://<your-domain>/account` to the redirect URLs. Sign-in links, confirmations and password resets land there.
3. In **Authentication → Providers → Email**, keep email confirmation on, set the minimum password length to 8 and turn on leaked-password protection.
4. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `FREE_LIMIT_SECRET` on the server.

The browser gets only the anon key (from `GET /api/config`) and uses it just to sign in. Every read and write of profiles, saved charts and free-tier usage goes through this server with the service-role key, which checks the plan; row-level security blocks direct writes. Plans are set in `profiles.plan` (`free` or `paid`); Stripe will update it in the next phase.

Routes: `GET /api/me`, `PUT /api/charts/:slot` (paid, slots 1–2), `DELETE /api/charts/:slot`. Paid accounts skip the free daily chart limit.

## Paid chart features

Paid accounts (and the preview) get, on every chart: a **chart guide** side panel where each placement, centre, house or graha has *Explain →* and each section has an overview; a four-part **reading** of the chart against today's sky; and **chat** about the chart. Routes: `POST /api/chart-explain` `{chart, tab, item | "overview"}`, `POST /api/chart-reading` `{chart, section, technical}`, `POST /api/chart-chat` `{chart, history}`. The server recalculates the chart from the birth details and builds each prompt from that one item's or section's data (the same prompts as the standalone pages), so no reading sees another. Identical prompts within an hour reuse the answer.

The browser keeps the latest reading, the chart on screen, chats and explanations in session storage for the tab, so leaving a page or refreshing doesn't lose them.

## Paid preview

Until payments are switched on, every paid feature is open to everyone under `/preview` (for example `/preview/natal`): no daily chart limit, chat with the oracle without an account, and saving charts when signed in. The main site stays on the free tier. The app sends an `X-Paid-Preview: 1` header from `/preview` pages and the server honours it while `PAID_PREVIEW` isn't `0`. Preview chat has its own per-IP limit (`PREVIEW_CHAT_PER_10MIN`, 20). If accounts are on, add `https://<your-domain>/preview/account` to Supabase's redirect URLs too.

Set `PAID_PREVIEW=0` to close the preview once Stripe is live.

## Standalone chart pages

`npm run astro:pages` writes each chart system as a single offline HTML file to `astro-pages/` (and claude.ai artifact versions to `astro-pages/artifact/`). `scripts/astro/build-cities.mjs` regenerates the place list.

## Tests

```bash
npm test
```

Unit tests cover the casting engine. Server tests run the real server against a mock Anthropic API.
