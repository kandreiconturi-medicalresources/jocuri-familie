// Geometria curții terminalului mare (coordonate locale: x = spre curte, z = de-a lungul liniei); folosită de terminal, hală, trenuri și oameni.
export const LANE = 0.6, LADDER = 0.75, END = 1.7; // distanța dintre linii; panta scării de macaze; capătul liniilor terminale
export const laneC = (k) => k * LANE;
export const laneStart = (k) => -2.45 + laneC(k) * LADDER;
/** Cutie aliniată: x în [c0,c1], z în [a0,a1], y în [y0,y1]. */
export const box = (B, c0, c1, a0, a1, y0, y1, col) => B.obox((c0 + c1) / 2, (y0 + y1) / 2, (a0 + a1) / 2, 0, 1, (a1 - a0) / 2, (c1 - c0) / 2, (y1 - y0) / 2, col);
