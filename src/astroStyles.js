// The chart engine's stylesheet, scoped under .astro so it can't affect the
// rest of Divinatey. Injected once, the first time a chart screen mounts.
import raw from "../shared/astro/core/core.css?raw";

// Prefixes every selector with `scope` (recursing into @media blocks).
export function scopeCss(css, scope) {
  let out = "", i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith("@media")) out += head + "{" + scopeCss(body, scope) + "}";
    else if (head.startsWith("@")) out += head + "{" + body + "}";
    else out += head.split(",").map(s => {
      s = s.trim();
      if (s === ":root" || s === "body" || s === "html") return scope;
      if (s.startsWith(":root")) return scope + s.slice(5);
      return scope + " " + s;
    }).join(",") + "{" + body + "}";
    i = j;
  }
  return out;
}

let injected = false;
export function useAstroStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.textContent = scopeCss(raw, ".astro") +
    ".astro{display:block;min-height:0;padding:20px 16px;border-radius:16px;font-family:Georgia,'Times New Roman',serif;color:var(--ink)}";
  document.head.appendChild(el);
}
