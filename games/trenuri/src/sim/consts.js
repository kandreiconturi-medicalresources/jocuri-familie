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

// Locomotive: apar pe rând după an. vmax în 1/256 placă/pas, power = câte vagoane trage bine, rel = fiabilitate (0–100)
export const MODELS = [
  { id: 0, key: 'mic', name: 'Abur mic', year: 1840, price: 4000, vmax: 16, power: 3, maint: 80, rel: 90, glb: 'train-locomotive-a', smoke: true },
  { id: 1, key: 'abur', name: 'Abur', year: 1856, price: 7000, vmax: 20, power: 4, maint: 100, rel: 92, glb: 'train-locomotive-b', smoke: true },
  { id: 2, key: 'rapid', name: 'Abur rapid', year: 1885, price: 10500, vmax: 28, power: 4, maint: 130, rel: 94, glb: 'train-locomotive-passenger-a', smoke: true },
  { id: 3, key: 'diesel', name: 'Diesel', year: 1930, price: 15000, vmax: 40, power: 5, maint: 180, rel: 96, glb: 'train-diesel-a', smoke: false },
  { id: 4, key: 'electric', name: 'Electric de oraș', year: 1952, price: 21000, vmax: 48, power: 5, maint: 220, rel: 98, glb: 'train-electric-city-a', smoke: false },
  { id: 5, key: 'glont', name: 'Electric rapid', year: 1970, price: 32000, vmax: 64, power: 6, maint: 300, rel: 99, glb: 'train-electric-bullet-a', smoke: false },
  // epoci noi (după 1970): desenate procedural în render/trainMeshes.js; glb rămâne doar rezervă
  { id: 6, key: 'intercity', name: 'Intercity electric', year: 1985, price: 42000, vmax: 72, power: 6, maint: 360, rel: 99, glb: 'train-electric-city-b', smoke: false },
  { id: 7, key: 'tgv', name: 'Tren de mare viteză', year: 1995, price: 58000, vmax: 88, power: 6, maint: 440, rel: 99, glb: 'train-electric-bullet-b', smoke: false },
  { id: 8, key: 'regio', name: 'Regio modern', year: 2008, price: 64000, vmax: 80, power: 8, maint: 460, rel: 99, glb: 'train-electric-city-a', smoke: false },
  { id: 9, key: 'hidrogen', name: 'Tren pe hidrogen', year: 2022, price: 84000, vmax: 104, power: 8, maint: 520, rel: 100, glb: 'train-electric-bullet-c', smoke: false },
];
export const availableModels = (year) => MODELS.filter((m) => m.year <= year);
export const START_YEARS = [1840, 1900, 1950, 1980, 2000, 2025];
export const CAR_PRICE = 500, MAX_CARS = 6;

export const DWELL = 24, RETRY = 40, WAIT_CAP = 240, STOCK_CAP = 250;
export const START_CASH = 100000, SANDBOX_CASH = 9999999;
export const MAINT = { tile: 4, station: 60 };
export const CITY_LEVELS = [0, 600, 2500];
export const LOW_PAY = 25; // % din plată când destinația nu cere marfa
export const PROD = 16; // unități produse lunar de o industrie primară
export const YIELD_BASE = 80, YIELD_LONG = 600; // pași de așteptare înainte ca un tren să se întoarcă

// Îmbunătățiri de gară (la gară, lângă ea): preț și efect
export const UPGRADES = [
  { key: 'water', name: 'Depou de apă', icon: '💧', cost: 1500, text: 'Trenurile cu abur merg mai repede.', glb: 'industrial/water-tower', dx: -0.9, dz: 0.7, s: 0.5 },
  { key: 'mail', name: 'Oficiu poștal', icon: '✉️', cost: 2000, text: 'Apare mai multă poștă.', glb: 'suburban/building-type-r', dx: 0.9, dz: 0.7, s: 0.45 },
  { key: 'hotel', name: 'Hotel', icon: '🏨', cost: 3500, text: 'Vin mai mulți pasageri.', glb: 'commercial/building-d', dx: -0.9, dz: -0.8, s: 0.45 },
  { key: 'depot', name: 'Depozit', icon: '🏚️', cost: 2500, text: 'Marfa se strică mai încet.', glb: 'industrial/building-d', dx: 0.9, dz: -0.8, s: 0.4 },
  { key: 'shop', name: 'Atelier de întreținere', icon: '🔧', cost: 4000, text: 'Repară trenurile care opresc aici: fiabilitatea revine.', glb: 'industrial/building-h', dx: 0, dz: 1.15, s: 0.4 },
];
export const WORKSHOP = 4; // indicele atelierului în UPGRADES
export const REL_FLOOR = { simple: 70, expert: 30 }; // fiabilitatea minimă după uzură

// Etapa 6.6: semnale cu rezervare, teren, peroane, fizică.
export const SIGNAL_COST = 150;
export const SIG_ALT = 30, SIG_OVER = 60, SIG_REV = 150; // pași de așteptare la roșu: caută alt drum (3 zile), intră în gara plină (6), se întoarce (15)
export const MAX_PLATFORMS = 4, PLATFORM_COST = 2500; // preț = PLATFORM_COST × peroanele de acum
export const LEVEL = { unit: 60, maxSide: 20, maxArea: 220, clear: 40 }; // nivelare: preț pe unitate de volum mutat
export const TUNNEL = { max: 6, cost: 700 }; // plăci în deal (cel mult) și preț pe placă de tunel
export const LOCO_W = [20, 24, 26, 30, 28, 32]; // greutatea locomotivei pe model; vagonul gol = CAR_W, marfa = ½ pe unitate
export const CAR_W = 12;

// Etapa 6.6, runda 2: depouri, defecțiuni, remorcare, semnale de bloc. Duratele sunt în pași (10 pași = o zi).
export const DEPOT = { cost: 6000, lift: 30, repairBase: 40, repairPer: 6, tracks: 2, towModel: 0, auto: TICKS_PER_DAY, self: 400, selfCost: 2000, liftCost: 1500, liftAuto: 100, lfTicks: 60, retry: 50 };
export const BLOCK_MIN = 3, BLOCK_MAX = 12; // „Semnale automate pe linie lungă”: unul la fiecare N plăci

// Faza 7: insule, porturi și vapoare. speed în 1/256 placă/pas, cap = tone în cală, mat = materiale [marfă, tone] cerute din portul tău.
export const SHIP_MODELS = [
  { id: 0, key: 'panze', name: 'Barcă cu pânze', year: 1800, price: 6000, speed: 12, cap: 60, maint: 60, mat: [[5, 15]] },
  { id: 1, key: 'aburi', name: 'Vapor cu aburi', year: 1860, price: 14000, speed: 18, cap: 120, maint: 120, mat: [[5, 10], [8, 15]] },
  { id: 2, key: 'cargou', name: 'Cargou', year: 1920, price: 26000, speed: 24, cap: 240, maint: 200, mat: [[8, 30], [9, 10]] },
  { id: 3, key: 'rapida', name: 'Navă rapidă', year: 1965, price: 40000, speed: 34, cap: 200, maint: 300, mat: [[8, 40], [9, 20]] },
];
export const PORT = { cost: 12000, cap: 400, capPer: 200, fee: 60, dwell: 40, stops: 6 };
/** Materiale de construcție în modul cu insule: [marfă, tone]. Primul port și primul vapor nu cer materiale. */
export const MATS = { port: [[5, 20], [8, 10]], big: [[8, 20], [9, 10]], up: [[5, 10], [8, 5]] };

// Etapa 7.3–7.4: poduri mari, proprietăți, pragurile clasamentului.
export const T_BIGBR = 0x2000; // placă de pod mare (biții 0x2000 era liber): se desenează cu piloni și grinzi
/** Pod mare: până la `max` plăci de apă; cost = base·n + sq·n²; oțel (marfa 8) = n/2 tone (cel puțin 2); `val` = valoarea unei plăci în clasament. */
export const BRIDGE = { max: 30, base: 400, sq: 60, steel: 8, val: 250 };
/** Parcele 4×4: preț = valoarea terenului × `mult`; industria străină costă `ind` + 10 lei pe tonă produsă (până la 2000 t). */
export const LAND = { size: 4, mult: 3, ind: 18000 };
export const THRESHOLDS = [100000, 500000, 1000000];
