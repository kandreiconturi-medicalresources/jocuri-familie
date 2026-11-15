// Heap binar min peste chei numerice (cost * 65536 + index): ordine deterministă, fără obiecte.
export function createHeap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(k) {
      let i = a.length;
      a.push(k);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p] <= k) break;
        a[i] = a[p]; i = p;
      }
      a[i] = k;
    },
    pop() {
      const top = a[0], last = a.pop();
      const n = a.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && a[c + 1] < a[c]) c++;
          if (a[c] >= last) break;
          a[i] = a[c]; i = c;
        }
        a[i] = last;
      }
      return top;
    },
  };
}
export const KEY = 65536;
