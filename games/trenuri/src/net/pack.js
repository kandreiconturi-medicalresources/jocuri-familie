// Comprimarea stării pentru rețea și salvări: JSON → (deflate dacă există CompressionStream) → base64.
// Primul octet: 'z' = deflate, 'r' = JSON simplu (Safari vechi); șirul rămâne base64 valid (serverul cere base64 strict). Folosit la stare și salvările pe NAS (< 1 MB).
const enc = new TextEncoder(), dec = new TextDecoder();

function toB64(u) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x4000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x4000));
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function through(stream, bytes) {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

const tag = (flag, u) => { const o = new Uint8Array(u.length + 1); o[0] = flag; o.set(u, 1); return o; };

export const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** obiect JSON → șir base64. `raw: true` forțează varianta fără compresie (teste). */
export async function pack(obj, { raw = false } = {}) {
  const bytes = enc.encode(JSON.stringify(obj));
  if (raw || !canCompress()) return toB64(tag(0x72, bytes));
  return toB64(tag(0x7a, await through(new CompressionStream('deflate'), bytes)));
}

export async function unpack(str) {
  if (typeof str !== 'string' || str.length < 2) throw new Error('pack');
  const all = fromB64(str), bytes = all.subarray(1);
  if (all[0] === 0x72) return JSON.parse(dec.decode(bytes));
  if (all[0] !== 0x7a || !canCompress()) throw new Error('pack');
  return JSON.parse(dec.decode(await through(new DecompressionStream('deflate'), bytes)));
}
