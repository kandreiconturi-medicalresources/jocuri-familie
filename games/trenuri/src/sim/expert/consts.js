// Mod expert: constante (numai întregi). Dobânzile sunt în ‰ pe an, prețurile în lei pe acțiune.
export const SHARES = 1000, PW_START = 20000, LOAN_TR = 10000, BANKRUPT_MONTHS = 6, MAX_CO = 8;
/** Rating după datoria raportată la active: dobânda anuală (‰) și câte tranșe se pot lua. */
export const RATINGS = [
  { k: 'A', name: 'Excelent', rate: 50, max: 10, below: 20 },
  { k: 'B', name: 'Bun', rate: 80, max: 7, below: 40 },
  { k: 'C', name: 'Așa și așa', rate: 120, max: 4, below: 60 },
  { k: 'D', name: 'Riscant', rate: 180, max: 2, below: 101 },
];
/** Întreținere lunară completă (lei) față de modul simplu (4 și 60). Trenurile îmbătrânesc: +2% pe lună, până la +150%. */
export const EX_MAINT = { tile: 6, station: 120, upgrade: 40, ageStep: 2, ageMax: 150 };
export const DIV_PCT = 30; // % din profitul anual dat ca dividend
export const AI_DEFS = [
  { name: 'Feroviara Vulturul', color: '#9775fa' },
  { name: 'Trenuri Cetina', color: '#20c997' },
  { name: 'Calea Lăstunului', color: '#ff922b' },
];
/** Nivelurile AI: răbdare (luni între proiecte), rezervă de bani, tranșe de împrumut, lungime maximă, trenuri pe linie. */
export const AI_LEVELS = [
  { key: 'prudent', name: 'Prudent', cool: 4, reserve: 40000, loans: 0, maxD: 22, perLine: 3 },
  { key: 'echilibrat', name: 'Echilibrat', cool: 3, reserve: 25000, loans: 2, maxD: 28, perLine: 4 },
  { key: 'agresiv', name: 'Agresiv', cool: 2, reserve: 15000, loans: 5, maxD: 36, perLine: 6 },
];
