// Ajutor mic: un oraș are gară în rază?
import { STATION_RADIUS } from '../sim/consts.js';

export const cityNear = (s, c) => s.stations.some((st) => Math.max(Math.abs(c.x - st.x), Math.abs(c.y - st.y)) <= STATION_RADIUS[st.size] + 2);
