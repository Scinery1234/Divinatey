// Per-tab memory of what's on screen (the current person, their chat, any
// explanations, the last draw), so leaving a page or refreshing doesn't lose
// it. sessionStorage is cleared when the tab closes and never leaves the browser.
const KEY = "divinatey:session:v1";

export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
export function saveSession(patch) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...loadSession(), ...patch })); } catch (e) { /* storage full or blocked: keep going */ }
}
