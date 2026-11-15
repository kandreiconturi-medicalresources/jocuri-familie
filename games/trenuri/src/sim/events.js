// Evenimente lunare prietenoase: recoltă bogată, industrie nouă. (Orașe noi crescute și recorduri: în economy.js.)
import { INDUSTRIES } from './goods.js';
import { placeOne } from './indgen.js';
import { roll, fork } from './rand.js';
import { addNews } from './news.js';

export function monthlyEvents(s) {
  const farms = s.industries.filter((o) => o.type === 0 || o.type === 9);
  const pick = roll(s, 5), which = roll(s, 8);
  if (pick === 0 && farms.length) {
    const f = farms[which % farms.length];
    f.boost = 1;
    addNews(s, '🌽', `Recoltă bogată la ${f.name}! Luna asta produce mai mult.`);
  }
  if (roll(s, 9) === 0 && s.industries.length < (s.w >> 1)) {
    const type = roll(s, INDUSTRIES.length), r = fork(s);
    const m = { w: s.w, h: s.h, height: s.height, water: s.water, forest: s.forest, cities: s.cities, industries: s.industries, busy: (i) => s.occ[i] || s.roads[i] || s.track[i] };
    const o = placeOne(m, r, type, s.industries.length);
    if (o) {
      s.industries.push(o);
      s.occ[o.y * s.w + o.x] = 1; s.forest[o.y * s.w + o.x] = 0;
      s.dirty.industries = s.dirty.forest = true;
      addNews(s, '🏗️', `Industrie nouă: s-a deschis ${o.name}!`);
    }
  }
}
