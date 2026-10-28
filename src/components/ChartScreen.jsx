import { useState, useEffect, useRef } from "react";
import { T, GRAD } from "../theme.js";
import { DateFields } from "./DateFields.jsx";
import { findPlaces, makeChart, chartErrorText, saveChartSlot } from "../api.js";
import { useAstroStyles } from "../astroStyles.js";
import { PREVIEW } from "../preview.js";
import { ChartChat } from "./ChartChat.jsx";
import { GuidePanel, ChartReading } from "./ChartGuide.jsx";
import { loadSession, saveSession } from "../session.js";

// One chart = one system for one set of birth details.
const chartKeyOf = b => b ? [b.system, b.date, b.time, b.tz, b.lat ?? "", b.lon ?? ""].join("|") : "";

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

export function PlacePicker({ value, onPick }) {
  const [q, setQ] = useState(value ? value.label : "");
  const [list, setList] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");      // idle | searching | done | error
  const req = useRef(0);

  useEffect(() => { setQ(value ? value.label : ""); }, [value]);
  useEffect(() => {
    if (value && q === value.label) return;
    const text = q.trim();
    if (text.length < 2) { setList([]); setStatus("idle"); return; }
    const id = ++req.current;
    const t = setTimeout(() => {
      setStatus("searching"); setOpen(true);
      findPlaces(text)
        .then(r => { if (id === req.current) { setList(r); setActive(-1); setStatus("done"); } })
        .catch(e => { if (id === req.current) { setList([]); setStatus(e && e.code === "no_server" ? "no_server" : "error"); } });
    }, 150);
    return () => clearTimeout(t);
  }, [q, value]);

  const pick = p => { onPick(p); setOpen(false); setList([]); setStatus("idle"); };
  const message = status === "searching" && !list.length ? "Searching places…"
    : status === "done" && !list.length ? "No places match. Try a nearby town, or check the spelling."
    : status === "error" ? "Couldn't search places just now. Try again in a moment."
    : status === "no_server" ? "Place search isn't available: this site is running without Divinatey's server. (Error: no_server)" : null;
  return (
    <div style={{ position: "relative" }}>
      <input id="place" style={field} value={q} placeholder="Start typing a town or city…" autoComplete="off"
        role="combobox" aria-expanded={open && list.length > 0} aria-controls="place-list" aria-autocomplete="list"
        onChange={e => { setQ(e.target.value); if (value) onPick(null); }}
        onFocus={() => { if (list.length || message) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (!list.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(list[Math.max(0, active)]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && !list.length && message && (
        <div role="status" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: T.surface, border: "1px solid " + T.border, borderRadius: 10, marginTop: 4, padding: "10px 12px", fontSize: 13, color: T.dim, boxShadow: "0 8px 24px rgba(30,22,48,.12)" }}>{message}</div>
      )}
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

function LockedAI({ compact }) {
  return (
    <div style={{ margin: compact ? "16px 0 0" : "20px 0", padding: compact ? 14 : 18, borderRadius: 14, background: "linear-gradient(135deg,#ede8ff,#fce7f3)", border: "1px solid " + T.purple + "44", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.purple, fontWeight: 700, marginBottom: 6 }}>{PREVIEW ? "✦ Paid preview" : "✦ Paid plan"}</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: T.muted }}>
        {PREVIEW ? "AI explanations of every placement, a transit reading, chat about your chart and no daily limit."
          : "AI explanations of every placement, a transit reading, chat about your chart, two saved chart slots and no daily limit."}
      </p>
    </div>
  );
}

// Save the chart on screen to one of the paid plan's two slots.
function SaveBar({ auth, body, onSignIn }) {
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState(null);
  if (!auth || !auth.enabled) return null;
  const me = auth.me;
  const small = { fontSize: 12, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 600 };
  if (!auth.session && PREVIEW) return null;
  if (!auth.session) return <button onClick={onSignIn} style={{ ...small, color: T.muted, background: "none", border: "1px solid " + T.border }}>sign in to save</button>;
  if (!me) return null;
  if (me.plan !== "paid") return <span style={{ fontSize: 11, color: T.dim }}>Saving charts is part of the paid plan</span>;
  const bySlot = Object.fromEntries((me.charts || []).map(c => [c.slot, c]));
  const save = async slot => {
    setBusy(slot); setNote(null);
    try { await saveChartSlot(slot, body); await auth.refreshMe(); setNote("Saved to slot " + slot); }
    catch (e) { setNote("Couldn't save. Try again."); }
    setBusy(0);
  };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {[1, 2].map(slot => {
        const c = bySlot[slot];
        return <button key={slot} disabled={!!busy} onClick={() => save(slot)} title={c ? "Replaces " + (c.name || "the chart") + " in slot " + slot : "Slot " + slot + " is empty"}
          style={{ ...small, color: T.purple, background: "none", border: "1px solid " + T.purple + "66" }}>
          {busy === slot ? "saving…" : "save to slot " + slot + (c ? " (replace)" : "")}</button>;
      })}
      {note && <span role="status" style={{ fontSize: 11, color: T.cyan }}>{note}</span>}
    </span>
  );
}

export function ChartScreen({ system, meta, auth, canChat, prefill, onPrefillUsed, onOpenSaved, onSignIn, onAccount, onCrisis }) {
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
  const lastBirth = useRef(null);    // the person on screen: switching system reuses their details
  // Generated explanations and readings, per chart, kept for this browser tab.
  const [allTexts, setAllTexts] = useState(() => loadSession().texts || {});
  const ck = result ? chartKeyOf(result.body) : "";
  const texts = allTexts[ck] || {};
  const setText = (id, text) => setAllTexts(all => {
    const next = { ...all, [ck]: { ...(all[ck] || {}), [id]: text } };
    const keys = Object.keys(next);
    if (keys.length > 8) delete next[keys[0]];        // keep the last few charts only
    saveSession({ texts: next });
    return next;
  });

  const pickPlace = p => { setPlace(p); if (p) { setLat(String(p.lat)); setLon(String(p.lon)); } };
  const useNow = () => {
    const tz = place ? place.tz : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const n = nowIn(tz); setDate(n.date); setTime(n.time);
    if (!place) setPlace({ label: "Here (" + tz + ")", tz, lat: NaN, lon: NaN });
  };

  const generate = async f => {
    setError(null);
    if (!f.date) return setError("Enter a birth date.");
    if (!f.place) return setError("Choose a birth place from the list.");
    const body = { system, name: f.name, date: f.date, time: f.time, tz: f.place.tz };
    if (needsLocation) {
      body.lat = parseFloat(f.lat); body.lon = parseFloat(f.lon);
      if (!isFinite(body.lat) || !isFinite(body.lon)) return setError("Choose a birth place from the list, or enter its latitude and longitude.");
    }
    setBusy(true);
    try {
      const r = await makeChart(body);
      lastBirth.current = f;
      saveSession({ person: f });
      setResult({ ...r, body: { ...body, place: f.place.label } });
      setTimeout(() => top.current && top.current.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(chartErrorText(err));
    }
    setBusy(false);
  };
  const submit = e => { e.preventDefault(); generate({ name, date, time, place, lat, lon }); };

  // Opening a saved chart: fill the form from it and generate straight away.
  useEffect(() => {
    if (!prefill || prefill.system !== system) return;
    const b = prefill.birth;
    const p = { label: b.place || b.tz, tz: b.tz, lat: b.lat ?? NaN, lon: b.lon ?? NaN };
    const f = { name: prefill.name || "", date: b.date, time: b.time, place: p, lat: b.lat ?? "", lon: b.lon ?? "" };
    setName(f.name); setDate(f.date); setTime(f.time); setPlace(p); setLat(String(f.lat)); setLon(String(f.lon));
    onPrefillUsed && onPrefillUsed();
    generate(f);
  }, [prefill, system]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Switching system shows the same person's chart in that system straight away.
  // The free limit counts people, so this never uses up another free chart.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      // Coming back to the page (or refreshing): bring back the person on screen.
      const person = !prefill && loadSession().person;
      if (person && person.date && person.place) {
        setName(person.name || ""); setDate(person.date); setTime(person.time); setPlace(person.place);
        setLat(person.lat == null ? "" : String(person.lat)); setLon(person.lon == null ? "" : String(person.lon));
        generate(person);
      }
      return;
    }
    setResult(null); setError(null); setShowRef(false);
    if (prefill && prefill.system === system) return;
    if (lastBirth.current) generate(lastBirth.current);
  }, [system]);   // eslint-disable-line react-hooks/exhaustive-deps

  const saved = auth && auth.me && auth.me.plan === "paid" ? (auth.me.charts || []) : [];

  if (result) {
    const vars = Object.fromEntries(Object.entries(result.accent || {}).map(([k, v]) => ["--" + k, v]));
    return (
      <div ref={top}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "4px 0 12px", flexWrap: "wrap" }}>
          <button onClick={() => { lastBirth.current = null; saveSession({ person: null }); setResult(null); }} style={{ fontSize: 12, color: T.muted, background: "none", border: "1px solid " + T.border, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>← someone else</button>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {result.quota && <span style={{ fontSize: 11, color: T.dim }}>free today: {result.quota.used} of {result.quota.max} people</span>}
            <SaveBar auth={auth} body={result.body} onSignIn={onSignIn} />
            <button onClick={() => setShowRef(true)} style={{ ...primaryBtn, padding: "7px 16px", fontSize: 12 }}>{canChat ? "✦ chart guide" : "✦ chart reference"}</button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: T.dim, margin: "-4px 0 10px", textAlign: "center" }}>Pick another system above to see {result.body && result.body.name ? result.body.name + "'s" : "this person's"} chart there. It opens straight away and doesn't use another free chart.</p>
        <div className="astro" style={vars} dangerouslySetInnerHTML={{ __html: result.html }} />
        {canChat ? <ChartReading reading={result.reading} chart={result.body} texts={texts} setText={setText} /> : <LockedAI />}
        <ChartChat chart={result.body} canChat={canChat} auth={auth} onSignIn={onSignIn} onAccount={onAccount || onSignIn} onCrisis={onCrisis} />
        {showRef && <GuidePanel reference={result.reference} chart={result.body} canExplain={canChat} texts={texts} setText={setText}
          lockedCard={!PREVIEW && <LockedAI compact />} onClose={() => setShowRef(false)} />}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 16, padding: "22px 20px", marginTop: 8 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 22, margin: "0 0 4px", color: T.text }}>{info ? info.title : ""}</h2>
      <p style={{ fontSize: 13, color: T.muted, margin: "0 0 18px", lineHeight: 1.6 }}>{info ? info.sub : ""}</p>
      {saved.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "-6px 0 16px" }}>
          <span style={{ fontSize: 11, color: T.dim }}>Your saved charts:</span>
          {saved.map(c => {
            const sys = CHART_SYSTEMS.find(x => x.id === c.system);
            return <button key={c.slot} type="button" onClick={() => onOpenSaved && onOpenSaved(c)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + T.border, background: T.bg, color: T.text }}>
              {(c.name || "Slot " + c.slot) + " · " + (sys ? sys.label : c.system)}</button>;
          })}
        </div>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        <div><label style={lbl} htmlFor="cname">Name (optional)</label><input id="cname" style={field} value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Whose chart is this?" /></div>
        <div><label style={lbl} htmlFor="cdate">Birth date</label><DateFields id="cdate" value={date} onChange={setDate} /></div>
        <div style={{ maxWidth: 220 }}><label style={lbl} htmlFor="ctime">Birth time</label><input id="ctime" type="time" style={field} value={time} onChange={e => setTime(e.target.value)} /></div>
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
        <p style={{ fontSize: 11, color: T.dim, margin: 0, lineHeight: 1.6 }}>{PREVIEW ? "Paid preview: no daily limit. Sign in to save charts." : saved.length || (auth && auth.me && auth.me.plan === "paid") ? "Paid plan: no daily limit. Save charts from the chart view." : "Free: two people a day, and each person's birth details open all four charts. Nothing is saved."} Places: GeoNames (CC BY 4.0).</p>
      </div>
    </form>
  );
}
