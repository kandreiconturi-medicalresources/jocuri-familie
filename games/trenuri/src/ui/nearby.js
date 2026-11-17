// Ajutor mic: un oraș are gară în rază?
import { covers } from '../sim/catch.js';

export const cityNear = (s, c) => s.stations.some((st) => covers(st, c));
