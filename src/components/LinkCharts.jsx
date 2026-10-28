import { useState } from "react";
import { T, GRAD } from "../theme.js";
import { DateFields } from "./DateFields.jsx";
import { CHART_SYSTEMS, PlacePicker } from "./ChartScreen.jsx";
import { loadSession } from "../session.js";

const NEEDS_COORDS = new Set(["natal", "vedic"]);
const DATE_ONLY = new Set(["numerology"]);     // needs the full name at birth, not the place
const field = { width: "100%", padding: "10px 12px", border: "1px solid " + T.border, borderRadius: 10, fontSize: 16, color: T.text, background: T.bg, fontFamily: "Georgia,serif" };
const lbl = { display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, margin: "0 0 6px" };
const primary = { background: GRAD, border: "none", borderRadius: 999, color: "#fff", fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const label = id => (CHART_SYSTEMS.find(s => s.id === id) || {}).label || id;

// The request body for each linked chart (the server recalculates them).
export function linkedChartBodies(linked) {
  if (!linked || !linked.person || !linked.systems.length) return [];
  const p = linked.person;
  return linked.systems.map(system => ({
    system, name: p.name || "", date: p.date, time: p.time || "12:00",
    ...(p.place ? { tz: p.place.tz } : {}),
    ...(p.birthName ? { birthName: p.birthName } : {}),
    ...(NEEDS_COORDS.has(system) ? { lat: parseFloat(p.lat), lon: parseFloat(p.lon) } : {}),
  }));
}

// People the person might mean: whoever is on the chart screen, and saved charts.
function knownPeople(auth) {
  const out = [], seen = new Set();
  const add = (name, b) => {
    const k = [b.date, b.time, b.tz || (b.place && b.place.tz), b.birthName || ""].join("|");
    if (!b.date || seen.has(k)) return; seen.add(k);
    const place = b.place && typeof b.place === "object" ? b.place
      : b.tz && b.tz !== "UTC" ? { label: b.place || b.tz, tz: b.tz, lat: b.lat ?? NaN, lon: b.lon ?? NaN } : null;
    out.push({ name: name || "", birthName: b.birthName || "", date: b.date, time: b.time, place, lat: b.lat ?? (place && place.lat) ?? "", lon: b.lon ?? (place && place.lon) ?? "" });
  };
  const onScreen = loadSession().person;
  if (onScreen) add(onScreen.name, { ...onScreen, tz: onScreen.place && onScreen.place.tz });
  ((auth && auth.me && auth.me.charts) || []).forEach(c => add(c.name, c.birth));
  return out;
}

// A single button under the reading. Choosing charts happens in the side panel;
// once linked, the button becomes a short summary with edit and unlink.
export function LinkBar({ linked, onChange, auth, disabled }) {
  const [open, setOpen] = useState(false);
  const systems = (linked && linked.systems) || [];
  const p = linked && linked.person;
  const on = systems.length > 0 && p;
  const small = { fontSize: 12, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer" };
  return (
    <div style={{ margin: "4px 0 14px", textAlign: "center" }}>
      {on ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", padding: "9px 16px", borderRadius: 999, border: "1px solid " + T.purple + "55", background: "#f6f1ff" }}>
          <span style={{ fontSize: 12, color: T.purple, fontWeight: 600 }}>✦ {systems.map(label).join(" · ")}{p.name ? " · " + p.name : ""}</span>
          <button style={{ ...small, color: T.muted }} disabled={disabled} onClick={() => setOpen(true)}>edit</button>
          <button style={{ ...small, color: T.dim }} disabled={disabled} onClick={() => onChange({ ...linked, systems: [] })}>unlink</button>
        </div>
      ) : (
        <button disabled={disabled} onClick={() => setOpen(true)}
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, padding: "9px 18px", borderRadius: 999, cursor: disabled ? "default" : "pointer", border: "1px solid " + T.purple + "66", background: T.surface, color: T.purple }}>
          ✦ bring in my charts</button>
      )}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: T.dim, lineHeight: 1.6 }}>
        {on ? "The oracle draws on these when it's relevant to what you ask." : "Let the oracle draw on your birth charts when it's relevant to what you ask."}
      </p>
      {open && <LinkPanel linked={linked} auth={auth} onClose={() => setOpen(false)} onSave={v => { onChange(v); setOpen(false); }} />}
    </div>
  );
}

function LinkPanel({ linked, auth, onClose, onSave }) {
  const people = knownPeople(auth);
  const start = (linked && linked.person) || people[0] || null;
  const [systems, setSystems] = useState(() => (linked && linked.systems) || []);
  const [name, setName] = useState(start ? start.name : "");
  const [birthName, setBirthName] = useState(start ? start.birthName || "" : "");
  const [date, setDate] = useState(start ? start.date : "");
  const [time, setTime] = useState(start ? start.time : "12:00");
  const [place, setPlace] = useState(start ? start.place : null);
  const [lat, setLat] = useState(start && start.lat != null ? String(start.lat) : "");
  const [lon, setLon] = useState(start && start.lon != null ? String(start.lon) : "");
  const [error, setError] = useState(null);
  const needCoords = systems.some(s => NEEDS_COORDS.has(s));
  const needName = systems.some(s => DATE_ONLY.has(s));
  const needPlace = systems.some(s => !DATE_ONLY.has(s));
  const use = p => { setName(p.name); setBirthName(p.birthName || ""); setDate(p.date); setTime(p.time); setPlace(p.place); setLat(p.lat == null ? "" : String(p.lat)); setLon(p.lon == null ? "" : String(p.lon)); };
  const pickPlace = pl => { setPlace(pl); if (pl) { setLat(String(pl.lat)); setLon(String(pl.lon)); } };
  const save = e => {
    e.preventDefault();
    if (!systems.length) return setError("Tick at least one chart.");
    if (!date) return setError("Enter a birth date.");
    if (needPlace && (!place || !place.tz)) return setError("Choose a birth place from the list.");
    if (needName && !birthName.trim()) return setError("Numerology needs the full name at birth.");
    if (needCoords && (!isFinite(parseFloat(lat)) || !isFinite(parseFloat(lon)))) return setError("Natal and Vedic charts need the birth place's coordinates: choose it from the list.");
    onSave({ systems, person: { name: name.trim(), birthName: birthName.trim(), date, time, place, lat, lon } });
  };
  return (
    <div role="dialog" aria-label="Link your charts" style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(30,22,48,.35)" }} />
      <form onSubmit={save} noValidate style={{ position: "relative", width: "min(460px,94vw)", height: "100%", overflowY: "auto", background: T.surface, padding: "18px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 400, color: T.text }}>Bring in your charts</strong>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.dim }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>The oracle looks at these charts only when it helps answer what you ask, and explains them in everyday words.</p>
        <div>
          <span style={lbl}>Charts</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHART_SYSTEMS.map(s => {
              const on = systems.includes(s.id);
              return <label key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (on ? T.purple + "88" : T.border), background: on ? "#f1ebff" : T.bg, color: on ? T.purple : T.muted, fontWeight: 600 }}>
                <input type="checkbox" checked={on} onChange={() => setSystems(v => on ? v.filter(x => x !== s.id) : [...v, s.id])} style={{ accentColor: T.purple }} />{s.label}</label>;
            })}
          </div>
        </div>
        {people.length > 0 && <div>
          <span style={lbl}>Use someone you've entered</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {people.map((p, i) => <button type="button" key={i} onClick={() => use(p)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + T.border, background: T.bg, color: T.text }}>
              {(p.name || "Unnamed") + " · " + p.date}</button>)}
          </div>
        </div>}
        <div><label style={lbl} htmlFor="lname">Name (optional)</label><input id="lname" style={field} value={name} maxLength={60} onChange={e => setName(e.target.value)} /></div>
        {needName && <div><label style={lbl} htmlFor="lbname">Full name at birth</label><input id="lbname" style={field} value={birthName} maxLength={100} onChange={e => setBirthName(e.target.value)} placeholder="As on the birth certificate" /></div>}
        <div><label style={lbl} htmlFor="ldate">Birth date</label><DateFields id="ldate" value={date} onChange={setDate} /></div>
        <div style={{ maxWidth: 220 }}><label style={lbl} htmlFor="ltime">Birth time</label><input id="ltime" type="time" style={field} value={time} onChange={e => setTime(e.target.value)} /></div>
        <div><label style={lbl} htmlFor="place">Birth place{needPlace ? "" : " (optional)"}</label><PlacePicker value={place} onPick={pickPlace} /></div>
        {needCoords && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl} htmlFor="llat">Latitude</label><input id="llat" type="number" step="0.01" style={field} value={lat} onChange={e => setLat(e.target.value)} /></div>
          <div><label style={lbl} htmlFor="llon">Longitude</label><input id="llon" type="number" step="0.01" style={field} value={lon} onChange={e => setLon(e.target.value)} /></div>
        </div>}
        <p style={{ margin: 0, fontSize: 11, color: T.dim, lineHeight: 1.6 }}>
          {needCoords ? "Natal and Vedic use the exact birthplace coordinates; picking a place fills them in."
            : needPlace ? "Gene Keys and Human Design need the date, time and place (for the timezone)."
            : "Numerology uses only the birth date and the full name at birth."}
        </p>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: T.pink }}>{error}</p>}
        <div><button type="submit" style={{ ...primary, padding: "12px 28px", fontSize: 15 }}>link {systems.length > 1 ? "these charts" : "this chart"} ✦</button></div>
        {systems.length > 0 && <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Linking: {systems.map(label).join(", ")}</p>}
      </form>
    </div>
  );
}
