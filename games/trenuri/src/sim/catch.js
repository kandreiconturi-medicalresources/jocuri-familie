// Raza unei gări față de un oraș: cutia STATION_RADIUS + 2 în jurul centrului; gara mare de trecere acoperă tot orașul ei.
import { STATION_RADIUS } from './consts.js';

export const cityReach = (st) => STATION_RADIUS[st.size] + 2;
/** Gara st adună pasageri, poștă și cerere de marfă din orașul c? */
export const covers = (st, c) => (st.thru && st.cityId === c.id) || (Math.abs(c.x - st.x) <= cityReach(st) && Math.abs(c.y - st.y) <= cityReach(st));
