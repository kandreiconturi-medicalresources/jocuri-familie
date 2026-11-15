// Constante ale simulării (numai întregi). Direcții: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SV, 6=V, 7=NV.
export const DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
export const LEN = [256, 362, 256, 362, 256, 362, 256, 362]; // lungimea unui pas, în 1/256 de placă
export const opp = (d) => (d + 4) & 7;

// Biți în track[] (Uint16): 0–7 conexiuni, apoi flag-uri
export const T_BRIDGE = 0x100, T_TUNNEL = 0x200, T_OWNER_SHIFT = 10, T_OWNER_MASK = 0x1c00, T_PRESENT = 0x4000;

export const WATER_H = 3; // înălțime ≤ aceasta = apă
export const SIZES = { S: 64, M: 96, L: 128 };

export const TICKS_PER_DAY = 10, DAYS_PER_MONTH = 30, SIM_HZ = 20; // pași de simulare pe secundă la 1×

export const COST = { tile: 120, link: 20, water: 1000, forest: 30, slope: 40 };
export const MAX_BRIDGE = 8, MAX_STEP = 2; // piese de pod la rând / diferență de înălțime între plăci
export const STATION_COST = [1000, 3000, 8000];
export const STATION_RADIUS = [2, 3, 4];
export const STATION_NAMES = ['Haltă', 'Gară', 'Terminal'];

// Modele de locomotivă: nume, preț, viteză maximă (1/256 placă/pas), glb
export const MODELS = [
  { id: 0, name: 'Abur mic', price: 4000, vmax: 16, glb: 'train-locomotive-a', smoke: true },
  { id: 1, name: 'Abur pasageri', price: 9000, vmax: 26, glb: 'train-locomotive-passenger-a', smoke: true },
  { id: 2, name: 'Diesel', price: 15000, vmax: 40, glb: 'train-diesel-a', smoke: false },
];
export const CAR_PRICE = 500, MAX_CARS = 6;
export const CAP_PASS = 30, CAP_MAIL = 20;
export const carKind = (i) => (i % 3 === 2 ? 1 : 0); // 0 pasageri, 1 poștă

export const RATE = [2, 3]; // lei pe unitate pe placă: pasageri, poștă
export const DWELL = 24, RETRY = 40, WAIT_CAP = 240;
export const START_CASH = 100000, SANDBOX_CASH = 9999999;
export const MAINT = { tile: 4, station: 60, train: 80 };
export const CITY_LEVELS = [0, 600, 2500];
