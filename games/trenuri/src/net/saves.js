// Salvări în 3 sloturi: pe NAS (shared/net/api.js) când serverul e disponibil, altfel local (gameSave).
// Conținutul e starea serializată compact și comprimată (pack.js), mereu sub 1 MB.
import { serialize, deserialize } from '../sim/index.js';
import { pack, unpack } from './pack.js';

export const SLOTS = [1, 2, 3], MAX_BYTES = 1000000, GAME = 'trenuri';

/** deps = { store: gameSave('trenuri'), api: { listSaves, loadSave, putSave, deleteSave } | null }. `api` null = doar local. */
export function createSaves({ store, api }) {
  const local = (slot) => store.get('slot' + slot, null);
  return {
    /** Întoarce 3 rânduri: { slot, name, size, updatedAt } sau null dacă slotul e gol. */
    async list() {
      const rows = [null, null, null];
      if (api) {
        for (const r of await api.listSaves(GAME)) if (r && r.slot >= 1 && r.slot <= 3) rows[r.slot - 1] = { slot: r.slot, name: r.name, size: r.size, updatedAt: r.updatedAt };
      } else {
        for (const n of SLOTS) { const v = local(n); if (v && v.data) rows[n - 1] = { slot: n, name: v.name, size: v.data.length, updatedAt: v.at }; }
      }
      return rows;
    },
    async save(slot, name, state, speed = 1) {
      const data = await pack({ v: 1, state: serialize(state), speed });
      if (data.length > MAX_BYTES) throw new Error('mare');
      const nm = String(name).slice(0, 40);
      if (api) await api.putSave(GAME, slot, nm, data);
      else if (!store.set('slot' + slot, { name: nm, at: Date.now(), data })) throw new Error('plin');
      return data.length;
    },
    /** → { state, speed } (starea deserializată, gata de folosit). */
    async load(slot) {
      const r = api ? await api.loadSave(GAME, slot) : local(slot);
      if (!r || !r.data) throw new Error('gol');
      const o = await unpack(r.data);
      if (!o || !o.state || o.state.version < 2) throw new Error('veche');
      return { state: deserialize(o.state), speed: o.speed === 0 ? 0 : o.speed || 1 };
    },
    async remove(slot) { if (api) await api.deleteSave(GAME, slot); else store.remove('slot' + slot); },
  };
}

const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Numele implicit al unei salvări: „Hartă M · Apr 1952”. */
export const saveName = (s) => `${s.scn ? 'Scenariu' : s.sandbox ? 'Liber' : 'Hartă ' + s.size} · ${MONTHS[s.date.m - 1]} ${s.date.y}`.slice(0, 40);
