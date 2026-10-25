import { randomBytes } from "node:crypto";
import { MAX_SEED } from "../shared/oracle.js";

// ANU retired the free endpoint in favour of a keyed API. With ANU_API_KEY set
// we use the current API; without it we try the legacy one, then fall back to
// hardware entropy.
const ANU_KEYED = "https://api.quantumnumbers.anu.edu.au?length=4&type=uint8";
const ANU_LEGACY = "https://qrng.anu.edu.au/API/jsonI.php?length=4&type=uint8";

async function fetchAnuBytes() {
  const key = process.env.ANU_API_KEY;
  const res = await fetch(key ? ANU_KEYED : ANU_LEGACY, {
    headers: key ? { "x-api-key": key } : {},
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.success && Array.isArray(d.data) && d.data.length >= 4) return d.data;
  return null;
}

// 99% the current millisecond (anchoring the draw to this moment), 1% quantum
// or hardware noise.
export async function getQuantumSeed() {
  const ms = Date.now() % MAX_SEED;
  let noise, source;
  try {
    const b = await fetchAnuBytes();
    if (b) {
      noise = (b[0]*16777216 + b[1]*65536 + b[2]*256 + b[3]) % MAX_SEED;
      source = "ANU";
    }
  } catch {}
  if (source === undefined) {
    noise = randomBytes(4).readUInt32BE(0) % MAX_SEED;
    source = "crypto";
  }
  const seed = Math.round(ms*0.99 + noise*0.01) % MAX_SEED || 1;
  return { seed, source };
}
