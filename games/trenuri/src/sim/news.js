// Ziarul: ultimele evenimente (maxim 30), afișate de UI.
export function addNews(s, icon, text) {
  s.news.push({ tick: s.tick, icon, text });
  if (s.news.length > 30) s.news.shift();
}
