# Divinatey

I Ching + Tarot drawn from this exact moment in time, interpreted by Claude, plus four birth charts: Gene Keys, Human Design, Western natal and Vedic. Built by [Vikashan](https://www.vikashan.org).

## How it works

- **Server** (`server/`, Express): holds the Anthropic API key, generates the seed (timestamp + ANU quantum noise, with hardware entropy as fallback), casts the reading and asks Claude to interpret it.
- **Client** (`src/`, React + Vite): the splash screen, the reading, the follow-up chat, crisis resources, and the About/Terms/Privacy pages (at `/about`, `/terms`, `/privacy`).
- **Shared** (`shared/`): the casting engine used by both sides, the crisis keywords, and the chart engine (`shared/astro/`).
- **Charts** (`server/astro.js`): the server calculates and renders every chart from the birth details, so the free limit can't be bypassed. Each system is loaded into its own isolated instance of the engine. Routes: `GET /api/places?q=` (birth place search over 111k GeoNames places), `GET /api/systems`, `POST /api/chart`. The free tier allows `FREE_CHARTS_PER_DAY` (2) different charts per IP per day; reopening the same chart doesn't count. IPs are held only as salted hashes, in memory, reset daily.

The client only ever sends the **seed** back. The server rebuilds the reading from it, so a client can't get arbitrary content into the prompts, and the API key never reaches the browser. The three interpretations (I Ching, Tarot, synthesis) run in parallel and return structured JSON.

Nothing is stored. Rate limiting is an in-memory, per-IP counter (`RATE_LIMIT_PER_10MIN`, 40 by default).

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
| `FREE_CHARTS_PER_DAY` | `2` | Different charts each IP may open per UTC day |

If a request is declined on policy grounds, it's automatically retried on Anthropic's recommended fallback model (`fallbacks: "default"`).

## Standalone chart pages

`npm run astro:pages` writes each chart system as a single offline HTML file to `astro-pages/` (and claude.ai artifact versions to `astro-pages/artifact/`). `scripts/astro/build-cities.mjs` regenerates the place list.

## Tests

```bash
npm test
```

Unit tests cover the casting engine. Server tests run the real server against a mock Anthropic API.
