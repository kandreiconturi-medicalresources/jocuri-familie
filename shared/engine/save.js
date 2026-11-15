// Salvări JSON în localStorage, cu chei `jf:<namespace>:<cheie>`. Nu aruncă niciodată.

export function store(namespace) {
  const k = (key) => `jf:${namespace}:${key}`;
  return {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(k(key));
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(k(key), JSON.stringify(value));
        return true;
      } catch (e) {
        return false; // mod privat / plin
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(k(key));
      } catch (e) { /* ignorat */ }
    },
  };
}
