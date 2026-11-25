// "Safety & your data": infographics on how birth details and conversations
// are handled. Every claim here is backed by code and tests; keep them in step.
import { T, GRAD } from "../theme.js";

const serif = "Georgia,'Times New Roman',serif";
const kicker = { fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: T.purple, margin: "0 0 6px" };
const h3 = { fontFamily: serif, fontWeight: 400, fontSize: 22, color: T.text, margin: "0 0 6px" };
const lead = { fontSize: 13.5, lineHeight: 1.7, color: T.muted, margin: "0 0 18px" };
const panel = { background: T.surface, border: "1px solid " + T.border, borderRadius: 18, padding: "22px 18px" };
const GOOD = "#059669", BAD = T.pink;

function Section({ kick, title, intro, children }) {
  return (
    <section style={{ ...panel, marginBottom: 18 }}>
      <p style={kicker}>{kick}</p>
      <h3 style={h3}>{title}</h3>
      {intro && <p style={lead}>{intro}</p>}
      {children}
    </section>
  );
}

// ── 1. At a glance ────────────────────────────────────────────────────────────
function Glance() {
  const stats = [
    ["0", "names, places or emails sent to the AI"],
    ["2", "saved charts at most, and only if you save them"],
    ["1 step", "to download or delete everything"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 18 }}>
      {stats.map(([big, small]) => (
        <div key={big} style={{ background: GRAD, borderRadius: 16, padding: "16px 14px", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>{big}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.95, marginTop: 4 }}>{small}</div>
        </div>
      ))}
    </div>
  );
}

// ── 2. Where your details go ──────────────────────────────────────────────────
function Node({ icon, title, children, tone = T.purple, dashed }) {
  return (
    <div style={{ border: (dashed ? "1.5px dashed " : "1.5px solid ") + tone, borderRadius: 14, padding: "12px 14px", background: T.bg, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: T.text, fontSize: 14 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>{title}
      </div>
      {children && <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginTop: 4 }}>{children}</div>}
    </div>
  );
}
function Arrow({ label }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0", color: T.dim }}>
      <div style={{ width: 2, height: 14, background: T.border }} />
      {label && <span style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, color: T.dim, padding: "2px 0" }}>{label}</span>}
      <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid " + T.border }} />
    </div>
  );
}
function Chip({ ok, children }) {
  return (
    <li style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 12.5, color: T.text, lineHeight: 1.5 }}>
      <span aria-hidden="true" style={{ color: ok ? GOOD : BAD, fontWeight: 800 }}>{ok ? "✓" : "✕"}</span>
      <span><span className="sr-only">{ok ? "Sent: " : "Not sent: "}</span>{children}</span>
    </li>
  );
}
function Flow() {
  const list = { listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 3 };
  return (
    <Section kick="Data flow" title="Where your birth details go" intro="From the moment you type them in, here is every place they travel, and where they stop.">
      <div role="img" aria-label="Your birth details travel over an encrypted connection to Divinatey's server, which calculates the chart. The AI receives only the calculated chart. Saved charts are kept for your account only; unsaved ones are forgotten.">
        <Node icon="📱" title="You">Birth date, time and place, typed into your browser.</Node>
        <Arrow label="encrypted connection (HTTPS)" />
        <Node icon="⚙️" title="Divinatey's server">Calculates your chart from the birth details. Nothing is logged.</Node>
        <Arrow />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Node icon="✦" title="The AI (Claude)" tone={T.cyan}>
            Only when you ask for an explanation, a reading or a chat.
            <ul style={list}>
              <Chip ok>chart positions and numbers</Chip>
              <Chip ok>birth date and today's date</Chip>
              <Chip>your name or the chart's label</Chip>
              <Chip>birth place or coordinates</Chip>
              <Chip>your email or account</Chip>
            </ul>
          </Node>
          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <Node icon="🔒" title="If you save a chart" tone={GOOD}>
              Kept with your account, and only your account can read it. Delete it any time.
            </Node>
            <Node icon="💨" title="If you don't" tone={T.dim} dashed>
              Discarded as soon as the chart is shown. Nothing to leak.
            </Node>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── 3. Kept vs never kept ─────────────────────────────────────────────────────
function Ledger() {
  const col = (ok, title, items) => (
    <div style={{ border: "1.5px solid " + (ok ? GOOD : BAD), borderRadius: 14, padding: "14px 14px 12px", background: T.bg }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: ok ? GOOD : BAD, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {items.map(([icon, text]) => (
          <li key={text} style={{ display: "flex", gap: 8, fontSize: 13, color: T.text, lineHeight: 1.5 }}><span aria-hidden="true">{icon}</span><span>{text}</span></li>
        ))}
      </ul>
    </div>
  );
  return (
    <Section kick="Storage" title="What we keep, and what we never keep" intro="Drawing a reading and opening free charts don't need an account at all.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {col(true, "Kept with an account", [
          ["✉️", "Your email address and your plan"],
          ["🔒", "Up to two charts you choose to save, with coordinates rounded to about 1 km and no place name"],
          ["🔮", "Readings you draw while signed in, with their chat, so you can return to them (delete any or all)"],
          ["📅", "Weekly counts of your free questions and linked charts"],
        ])}
        {col(false, "Never kept", [
          ["💬", "Readings and chats when you're signed out"],
          ["🌙", "Charts you don't save"],
          ["💳", "Card numbers (Stripe handles payments)"],
          ["🌐", "Your IP address: only a scrambled daily count for the free limit, cleared each day"],
        ])}
      </div>
    </Section>
  );
}

// ── 4. Layers of protection ───────────────────────────────────────────────────
function Layers() {
  const rings = [
    ["🌐", "Encrypted connection", "Everything between your browser and the site travels over HTTPS."],
    ["🛡", "Browser shield", "Security headers stop other sites framing this one or running scripts on it."],
    ["🔑", "Only you", "Database rules mean each account can only ever read its own rows."],
  ];
  const nest = i => {
    if (i === rings.length) return (
      <div style={{ background: GRAD, color: "#fff", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 22 }} aria-hidden="true">🔒</div>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Your saved chart</div>
        <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.5 }}>kept with your account, deleted when you say so</div>
      </div>
    );
    const [icon, title, text] = rings[i];
    const shade = ["#f3eeff", "#e9e0ff", "#ddd0ff"][i];
    return (
      <div style={{ background: shade, borderRadius: 16 - i, padding: "10px 10px 10px", border: "1px solid " + T.border }}>
        <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, margin: "0 4px 8px" }}>
          <strong><span aria-hidden="true">{icon} </span>{title}</strong> <span style={{ color: T.muted }}>· {text}</span>
        </div>
        {nest(i + 1)}
      </div>
    );
  };
  return (
    <Section kick="Defence in depth" title="Layers of protection" intro="No single lock does all the work. To reach a saved chart, someone would have to get through every layer.">
      {nest(0)}
    </Section>
  );
}

// ── 5. AI safety ──────────────────────────────────────────────────────────────
function AiSafety() {
  const cards = [
    ["💙", "Care comes first", "If a message mentions suicide or self-harm, the chat stops to show crisis lines (Lifeline 13 11 14, Beyond Blue, 000), and the oracle is told to set the reading aside and respond with care."],
    ["🧭", "Reflection, not advice", "The AI is told this is a tool for reflection, not prediction. For medical, legal or money decisions it points you to a professional."],
    ["🙈", "It doesn't know who you are", "Names, places, coordinates and emails are removed before anything reaches the AI. An automated test checks this."],
    ["🛑", "It can say no", "If a request isn't something the AI should answer, it declines and you see a gentle message rather than a made-up reading."],
    ["🧠", "Memory from facts only", "When the oracle recalls your earlier readings, it's given the date, what was drawn and your first question, never its own earlier replies."],
    ["⏱", "Fair-use limits", "Rate limits on chats and charts stop the service being flooded or abused."],
    ["🧂", "A grain of salt", "AI can be wrong. Every page reminds you that readings are for reflection and entertainment."],
  ];
  return (
    <Section kick="AI safety" title="How the AI is kept in check" intro="The oracle and chart guides are written by Claude, an AI model made by Anthropic. Here's what keeps it safe.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {cards.map(([icon, title, text]) => (
          <div key={title} style={{ border: "1px solid " + T.border, borderRadius: 14, padding: "14px", background: T.bg }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div aria-hidden="true" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 999, background: T.surface, border: "1px solid " + T.border, display: "grid", placeItems: "center", fontSize: 17 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{title}</div>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>{text}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── 6. You're in control ──────────────────────────────────────────────────────
function Control() {
  const steps = [
    ["1", "Choose", "Birth details are saved only when you press save. Readings are kept only while you're signed in."],
    ["2", "Download", "Your account page has “Download my data”: everything we keep, in one file."],
    ["3", "Delete", "“Delete my account” removes your account, saved charts and history at once, and ends any subscription."],
  ];
  return (
    <Section kick="Your controls" title="You're in control">
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 0 }}>
        {steps.map(([n, title, text], i) => (
          <li key={n} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: GRAD, color: "#fff", fontWeight: 800, display: "grid", placeItems: "center", fontSize: 14 }} aria-hidden="true">{n}</div>
              {i < steps.length - 1 && <div aria-hidden="true" style={{ width: 2, flex: 1, minHeight: 18, background: T.border }} />}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: T.text, marginTop: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{text}</div>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function SafetyPage({ onPage }) {
  return (
    <div>
      <p style={{ ...lead, fontSize: 15, fontFamily: serif }}>
        Your birth details are personal. Here's exactly how Divinatey looks after them, and how the AI is kept in check.
      </p>
      <Glance />
      <Flow />
      <Ledger />
      <Layers />
      <AiSafety />
      <Control />
      <Section kick="Ads" title="About the ads" intro="Ads help keep the free tiers free. Here's how they work.">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {[["📢", "Visitors without an account and free accounts see a few ads from Google AdSense. The paid plan has none."],
            ["🍪", "Google may use cookies to choose and measure ads. Where the law requires it, you're asked first, and you can change ad personalisation in your Google ad settings."],
            ["🚫", "Ads never see your birth details, readings or chats."]].map(([icon, text]) => (
            <li key={icon} style={{ display: "flex", gap: 8, fontSize: 13, color: T.text, lineHeight: 1.6 }}><span aria-hidden="true">{icon}</span><span>{text}</span></li>
          ))}
        </ul>
      </Section>
      <p style={{ fontSize: 12, color: T.dim, lineHeight: 1.7, margin: "8px 0 0" }}>
        The full details are in the{" "}
        <a href="/privacy" onClick={e => { if (onPage) { e.preventDefault(); onPage("privacy"); } }} style={{ color: T.purple, fontWeight: 600 }}>privacy policy</a>.
      </p>
    </div>
  );
}
