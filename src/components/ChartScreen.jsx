import { useState, useEffect, useRef } from "react";
import { T, GRAD } from "../theme.js";
import { findPlaces, makeChart, chartErrorText } from "../api.js";
import { useAstroStyles } from "../astroStyles.js";

export const CHART_SYSTEMS = [
  { id: "gene-keys", label: "Gene Keys" },
  { id: "human-design", label: "Human Design" },
  { id: "natal", label: "Natal" },
  { id: "vedic", label: "Vedic" },
];

const primaryBtn = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const field = { width: "100%", padding: "10px 12px", border: "1px solid " + T.border, borderRadius: 10, fontSize: 16, color: T.text, background: T.bg, fontFamily: "Georgia,serif" };
const lbl = { display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, margin: "0 0 6px" };

// "Now" in a timezone, as the form's date and time strings.
function nowIn(tz) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

export function ChartNav({ current, onNav, hideDraw }) {
  const items = hideDraw ? CHART_SYSTEMS : [{ id: null, label: "Draw" }, ...CHART_SYSTEMS];
  return (
    <nav aria-label="Oracles and charts" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {items.map(it => {
        const on = it.id === current;
        return <button key={it.label} onClick={() => onNav(it.id)} aria-current={on ? "page" : undefined}
          style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 999, cursor: "pointer", letterSpacing: 0.3,
            border: "1px solid " + (on ? "transparent" : T.border), background: on ? GRAD : T.surface, color: on ? "#fff" : T.muted }}>{it.label}</button>;
      })}
    </nav>
  );
}

function PlacePicker({ value, onPick }) {
  const [q, setQ] = useState(value ? value.label : "");
  const [list, setList] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const req = useRef(0);

  useEffect(() => { setQ(value ? value.label : ""); }, [value]);
  useEffect(() => {
    if (value && q === value.label) return;
    const text = q.trim();
    if (text.length < 2) { setList([]); return; }
    const id = ++req.current;
    const t = setTimeout(() => {
      findPlaces(text).then(r => { if (id === req.current) { setList(r); setActive(-1); setOpen(true); } }).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q, value]);

  const pick = p => { onPick(p); setOpen(false); setList([]); };
  return (
    <div style={{ position: "relative" }}>
      <input id="place" style={field} value={q} placeholder="Start typing a town or city…" autoComplete="off"
        role="combobox" aria-expanded={open && list.length > 0} aria-controls="place-list" aria-autocomplete="list"
        onChange={e => { setQ(e.target.value); if (value) onPick(null); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (!list.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(list[Math.max(0, active)]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && list.length > 0 && (
        <div id="place-list" role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: T.surface, border: "1px solid " + T.border, borderRadius: 10, marginTop: 4, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(30,22,48,.12)" }}>
          {list.map((p, i) => {
            const name = p.label.split(", ")[0];
            return <div key={p.label + i} role="option" aria-selected={i === active} onMouseDown={e => { e.preventDefault(); pick(p); }}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 14, background: i === active ? T.bg : "transparent", color: T.text }}>
              <b>{name}</b><span style={{ color: T.dim }}>{p.label.slice(name.length)}</span>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

function ReferencePanel({ reference, onClose }) {
  const [tab, setTab] = useState(0);
  const t = reference[tab];
  return (
    <div role="dialog" aria-label="Chart reference" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(30,22,48,.35)" }} />
      <div className="astro" style={{ position: "relative", width: "min(520px,94vw)", height: "100%", overflowY: "auto", borderRadius: 0, background: "var(--bg)", padding: 0 }}>
        <div style={{ position: "sticky", top: 0, background: "var(--tint2)", borderBottom: "2px solid var(--rule)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "var(--deep)" }}>✦ Chart reference</strong>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "10px 14px 0", flexWrap: "wrap", borderBottom: "1px solid var(--rule)" }}>
          {reference.map((r, i) => <button key={r.key} onClick={() => setTab(i)}
            style={{ fontSize: 12, padding: "6px 10px", border: "1px solid var(--rule)", borderBottom: "none", borderRadius: "6px 6px 0 0", cursor: "pointer",
              background: i === tab ? "var(--card)" : "var(--tint3)", color: i === tab ? "var(--deep)" : "var(--muted)", fontWeight: i === tab ? 700 : 400 }}>{r.icon} {r.name}</button>)}
        </div>
        <div style={{ padding: "14px 18px 40px" }}>
          <p className="tagline">{t.blurb}</p>
          {t.items.map((it, i) => (
            <div key={i} className="gk-item"><div className="gk-item-h"><div style={{ minWidth: 0 }}>
              <strong className="ttl">{it.title}</strong>{it.code && <> <span className="code" style={{ color: t.col }} dangerouslySetInnerHTML={{ __html: it.code }} /></>}
              {it.sub && <div className="sub" dangerouslySetInnerHTML={{ __html: it.sub }} />}
              {it.role && <div className="role">{it.role}</div>}
            </div></div></div>
          ))}
          <LockedAI compact />
        </div>
      </div>
    </div>
  );
}

function LockedAI({ compact }) {
  return (
    <div style={{ margin: compact ? "16px 0 0" : "20px 0", padding: compact ? 14 : 18, borderRadius: 14, background: "linear-gradient(135deg,#ede8ff,#fce7f3)", border: "1px solid " + T.purple + "44", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.purple, fontWeight: 700, marginBottom: 6 }}>✦ Paid plan · coming soon</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: T.muted }}>
        AI explanations of every placement, transit readings, chat, a second chart slot and saved charts.
      </p>
    </div>
  );
}

export function ChartScreen({ system, meta }) {
  useAstroStyles();
  const info = meta && meta[system];
  const needsLocation = info ? info.needsLocation : system === "natal" || system === "vedic";
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [place, setPlace] = useState(null);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showRef, setShowRef] = useState(false);
  const top = useRef(null);

  // One chart slot: switching system starts a fresh chart (the form keeps the birth details).
  useEffect(() => { setResult(null); setError(null); setShowRef(false); }, [system]);

  const pickPlace = p => { setPlace(p); if (p) { setLat(String(p.lat)); setLon(String(p.lon)); } };
  const useNow = () => {
    const tz = place ? place.tz : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const n = nowIn(tz); setDate(n.date); setTime(n.time);
    if (!place) setPlace({ label: "Here (" + tz + ")", tz, lat: NaN, lon: NaN });
  };

  const submit = async e => {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Enter a birth date.");
    if (!place) return setError("Choose a birth place from the list.");
    const body = { system, name, date, time, tz: place.tz };
    if (needsLocation) {
      body.lat = parseFloat(lat); body.lon = parseFloat(lon);
      if (!isFinite(body.lat) || !isFinite(body.lon)) return setError("Choose a birth place from the list, or enter its latitude and longitude.");
    }
    setBusy(true);
    try {
      setResult(await makeChart(body));
      setTimeout(() => top.current && top.current.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(chartErrorText(err));
    }
    setBusy(false);
  };

  if (result) {
    const vars = Object.fromEntries(Object.entries(result.accent || {}).map(([k, v]) => ["--" + k, v]));
    return (
      <div ref={top}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "4px 0 12px", flexWrap: "wrap" }}>
          <button onClick={() => setResult(null)} style={{ fontSize: 12, color: T.muted, background: "none", border: "1px solid " + T.border, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>← new chart</button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {result.quota && <span style={{ fontSize: 11, color: T.dim }}>{result.quota.used} of {result.quota.max} free charts today</span>}
            <button onClick={() => setShowRef(true)} style={{ ...primaryBtn, padding: "7px 16px", fontSize: 12 }}>✦ chart reference</button>
          </div>
        </div>
        <div className="astro" style={vars} dangerouslySetInnerHTML={{ __html: result.html }} />
        <LockedAI />
        {showRef && <ReferencePanel reference={result.reference} onClose={() => setShowRef(false)} />}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 16, padding: "22px 20px", marginTop: 8 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 22, margin: "0 0 4px", color: T.text }}>{info ? info.title : ""}</h2>
      <p style={{ fontSize: 13, color: T.muted, margin: "0 0 18px", lineHeight: 1.6 }}>{info ? info.sub : ""}</p>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label style={lbl} htmlFor="cname">Name (optional)</label><input id="cname" style={field} value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Whose chart is this?" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl} htmlFor="cdate">Birth date</label><input id="cdate" type="date" style={field} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label style={lbl} htmlFor="ctime">Birth time</label><input id="ctime" type="time" style={field} value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <div>
          <label style={lbl} htmlFor="place">Birth place</label>
          <PlacePicker value={place} onPick={pickPlace} />
          <p style={{ fontSize: 11, color: T.dim, margin: "6px 0 0", lineHeight: 1.6 }}>
            {place && place.tz ? `Timezone ${place.tz}` + (isFinite(place.lat) ? ` · ${Math.abs(place.lat).toFixed(2)}°${place.lat < 0 ? "S" : "N"}, ${Math.abs(place.lon).toFixed(2)}°${place.lon < 0 ? "W" : "E"}` : "")
              : "Any town of 1,000+ people. If yours isn't listed, pick the nearest one."}
          </p>
        </div>
        {needsLocation && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lbl} htmlFor="clat">Latitude</label><input id="clat" type="number" step="0.01" style={field} value={lat} onChange={e => setLat(e.target.value)} placeholder="−33.87" /></div>
            <div><label style={lbl} htmlFor="clon">Longitude</label><input id="clon" type="number" step="0.01" style={field} value={lon} onChange={e => setLon(e.target.value)} placeholder="151.21" /></div>
          </div>
        )}
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: T.pink }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={busy} style={{ ...primaryBtn, padding: "13px 30px", fontSize: 15 }}>{busy ? "calculating…" : "generate chart ✦"}</button>
          <button type="button" onClick={useNow} style={{ fontSize: 12, color: T.muted, background: "none", border: "1px solid " + T.border, borderRadius: 999, padding: "8px 14px", cursor: "pointer" }}>use this moment (current transits)</button>
        </div>
        <p style={{ fontSize: 11, color: T.dim, margin: 0, lineHeight: 1.6 }}>Free: one chart at a time, two different charts a day. Nothing is saved. Places: GeoNames (CC BY 4.0).</p>
      </div>
    </form>
  );
}
