// A Google AdSense unit, shown to signed-out visitors and free accounts only
// (the caller decides). Renders nothing unless the server has a publisher id
// and a slot id for this placement.
import { useEffect, useRef } from "react";
import { T } from "../theme.js";

let loaded = null;
function loadAdSense(client) {
  if (!loaded) loaded = new Promise(resolve => {
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client);
    s.onload = resolve; s.onerror = resolve;          // an ad blocker just means no ad
    document.head.appendChild(s);
  });
  return loaded;
}

export function AdSlot({ ads, place, onUpgrade, style }) {
  const slot = ads && ads.slots && ads.slots[place];
  const ins = useRef(null), pushed = useRef(false);
  useEffect(() => {
    if (!slot) return;
    loadAdSense(ads.client);
    if (pushed.current || !ins.current) return;
    pushed.current = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blocked */ }
  }, [slot, ads]);
  if (!slot) return null;
  return (
    <aside className="ad-wrap" aria-label="Advertisement" style={{ margin: "18px auto", maxWidth: 728, textAlign: "center", ...style }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: T.dim, marginBottom: 4 }}>
        advertisement{onUpgrade && <> · <button className="link-btn" onClick={onUpgrade} style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: T.purple, fontWeight: 700 }}>go ad-free</button></>}
      </div>
      <ins ref={ins} className="adsbygoogle" style={{ display: "block" }} data-ad-client={ads.client} data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
