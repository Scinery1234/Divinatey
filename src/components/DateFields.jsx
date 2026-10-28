import { useState, useEffect } from "react";
import { T } from "../theme.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const daysIn = (y, m) => new Date(Date.UTC(y || 2000, m, 0)).getUTCDate();   // m is 1-12; leap-safe

// Birth date as Day / Month / Year dropdowns. They work the same on every
// phone and browser (unlike native date pickers), and the year jumps straight
// to the right decade. value and onChange use "YYYY-MM-DD", or "" until all three are set.
export function DateFields({ id, value, onChange }) {
  const parse = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: "", m: "", d: "" }; };
  const [parts, setParts] = useState(() => parse(value));
  // Follow changes made elsewhere (a saved chart, "use this moment").
  useEffect(() => { if (value) setParts(parse(value)); }, [value]);

  const set = (k, v) => {
    const p = { ...parts, [k]: v === "" ? "" : +v };
    if (p.d && p.m && p.d > daysIn(p.y, p.m)) p.d = daysIn(p.y, p.m);   // e.g. 31 → 30 when switching to April
    setParts(p);
    onChange(p.y && p.m && p.d ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : "");
  };
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1899 }, (_, i) => thisYear - i);
  const sel = { padding: "10px 8px", border: "1px solid " + T.border, borderRadius: 10, fontSize: 16, color: T.text, background: T.bg, fontFamily: "Georgia,serif", minWidth: 0, width: "100%" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.4fr", gap: 8 }}>
      <select id={id} aria-label="Day" style={sel} value={parts.d} onChange={e => set("d", e.target.value)}>
        <option value="">Day</option>
        {Array.from({ length: parts.m ? daysIn(parts.y, parts.m) : 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select aria-label="Month" style={sel} value={parts.m} onChange={e => set("m", e.target.value)}>
        <option value="">Month</option>
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select aria-label="Year" style={sel} value={parts.y} onChange={e => set("y", e.target.value)}>
        <option value="">Year</option>
        {parts.y && parts.y < 1900 && <option value={parts.y}>{parts.y}</option>}
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
