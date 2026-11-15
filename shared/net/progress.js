// Salvare per joc sincronizată cu serverul: cache în memorie + copie în localStorage, trimitere cu debounce de 2 s.
import { store } from '../engine/save.js';
import { api } from './api.js';
import { mergeData, sameData, debounce } from './util.js';

const PUSH_MS = 2000;

/** `store` are aceeași formă ca store() din save.js (get/set/remove sincrone). `load()` aduce și îmbină datele de pe server. */
export function createSyncedSave(userId, gameId) {
  const disk = store('srv' + userId + ':' + gameId);
  const path = 'progress/' + encodeURIComponent(gameId);
  let data = disk.get('all', {}) || {};
  let dirty = false, loaded = null;

  const persist = () => disk.set('all', data);
  async function push(keepalive) {
    if (!dirty) return;
    dirty = false;
    try {
      const r = await api('PUT', path, { data }, { keepalive });
      if (r && r.data && typeof r.data === 'object') { data = mergeData(data, r.data); persist(); }
    } catch (e) { dirty = true; } // se reîncearcă la următoarea modificare
  }
  const later = debounce(() => push(false), PUSH_MS);
  const mark = () => { persist(); dirty = true; later(); };

  const flush = () => { if (dirty) later.flush(); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  return {
    flush,
    load() {
      if (!loaded) {
        loaded = api('GET', path).then((r) => {
          const remote = r && (r.data !== undefined ? r.data : r);
          if (!remote || typeof remote !== 'object') return;
          const merged = mergeData(data, remote);
          if (!sameData(merged, remote)) { dirty = true; later(); }
          data = merged;
          persist();
        }).catch(() => { /* fără rețea: rămâne copia locală */ });
      }
      return loaded;
    },
    store: {
      get(key, fallback) { return key in data ? data[key] : fallback; },
      set(key, value) { data = { ...data, [key]: value }; mark(); return true; },
      remove(key) {
        if (!(key in data)) return;
        data = { ...data };
        delete data[key];
        mark();
      },
    },
  };
}
