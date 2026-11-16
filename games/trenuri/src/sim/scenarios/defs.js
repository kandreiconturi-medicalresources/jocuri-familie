// Cele 8 scenarii (date pure, deterministe). Harta e fixă: seed + mărime + an. Dificultatea crește de la primul la ultimul.
// Obiectiv: { k: tip de măsură (vezi goals.js), a: argument, t: [bronz, argint, aur], text }.
export const SCENARIOS = [
  {
    id: 'primul', icon: '🚂', name: 'Primul tren', seed: 11, size: 'S', year: 1900, years: 3, cash: 60000,
    story: 'Într-o vale frumoasă, doi vecini nu s-au vizitat niciodată: drumul e lung și greu. Ajută-i cu un tren mic și vesel!',
    tip: 'Pune o gară în fiecare oraș, leagă-le cu șină și trimite un tren între ele.',
    goals: [{ k: 'del', a: 0, t: [100, 1500, 5000], text: 'Du pasageri la destinație' }],
  },
  {
    id: 'posta', icon: '✉️', name: 'Poșta rapidă', seed: 12, size: 'S', year: 1900, years: 3, cash: 70000,
    story: 'Scrisorile ajung greu, cu căruța. Poștașul visează la un tren care să le ducă pe toate înainte de sărbători!',
    tip: 'Vagoanele verzi duc poșta. Orașele mari trimit mai multe scrisori.',
    goals: [{ k: 'del', a: 1, t: [60, 1000, 3000], text: 'Du scrisori și colete' }],
  },
  {
    id: 'carbune', icon: '⚫', name: 'Cărbune pentru oțelărie', seed: 13, size: 'S', year: 1900, years: 4, cash: 90000,
    story: 'Oțelăria a rămas fără cărbune și cuptoarele se răcesc. Mina are destul, dar nimeni nu-l aduce. Poți tu?',
    tip: 'Pune câte o gară lângă mină și lângă oțelărie. Vagonul negru duce cărbunele.',
    goals: [{ k: 'del', a: 6, t: [100, 300, 600], text: 'Du cărbune la oțelărie' }],
  },
  {
    id: 'sat', icon: '🏡', name: 'Fă din sat un oraș', seed: 14, size: 'S', year: 1900, years: 6, cash: 100000,
    story: 'Satele sunt mici și liniștite, dar visează să devină orașe. Cu trenuri, mâncare și vizitatori, ele pot crește!',
    tip: 'Orașele cresc cu pasageri, poștă și mărfurile pe care le cer. Uită-te în panoul orașului.',
    goals: [{ k: 'ups', a: 0, t: [1, 4, 8], text: 'Fă orașele să crească de nivel' }],
  },
  {
    id: 'paine', icon: '🍞', name: 'Pâine pentru toți', seed: 15, size: 'S', year: 1900, years: 6, cash: 120000,
    story: 'Orașele flămânzesc! Cerealele din ferme trebuie făcute mâncare la fabrică, iar mâncarea dusă în orașe.',
    tip: 'Lanțul: fermă (cereale) → fabrică de mâncare → oraș. Alege vagonul potrivit pentru fiecare rută.',
    goals: [{ k: 'del', a: 3, t: [80, 400, 900], text: 'Du mâncare în orașe' }],
  },
  {
    id: 'munti', icon: '⛰️', name: 'Peste munți', seed: 23, size: 'S', year: 1900, years: 6, cash: 150000,
    story: 'Un râu și niște dealuri abrupte despart două orașe. Constructorii spun că nu se poate, dar tu știi mai bine!',
    tip: 'Șina peste apă devine pod, dar podurile costă mult. Caută cel mai scurt loc de trecere.',
    goals: [{ k: 'bridge', a: 0, t: [1, 2, 4], text: 'Construiește poduri' }, { k: 'del', a: 0, t: [150, 1000, 3000], text: 'Du pasageri' }],
  },
  {
    id: 'retea', icon: '🗺️', name: 'Marea rețea', seed: 7, size: 'M', year: 1900, years: 8, cash: 200000,
    story: 'Regele vrea ca fiecare oraș să aibă tren. Construiește o rețea mare care leagă țara!',
    tip: 'O gară în fiecare oraș și un tren pe fiecare linie. Reinvestește banii câștigați.',
    goals: [{ k: 'served', a: 0, t: [4, 6, 8], text: 'Leagă orașe cu trenuri' }],
  },
  {
    id: 'metropola', icon: '🏙️', name: 'Metropola', seed: 18, size: 'M', year: 1950, years: 10, cash: 300000,
    story: 'Un oraș visează la zgârie-nori! Adu-i pasageri, poștă, mâncare, bunuri și combustibil, ca să devină metropolă.',
    tip: 'Metropola cere mâncare, cherestea, bunuri, brânză și combustibil. Ce primește îl face să crească.',
    goals: [{ k: 'lvl', a: 2, t: [1, 2, 4], text: 'Fă orașe să devină metropole' }],
  },
];

/** Variante expert (etapa 6.5): aceeași hartă, mod expert cu 2 AI-uri, un an în plus; medalia contează și avere netă (bani personali + acțiuni). */
const NW = { k: 'nw', a: 0, text: 'Avere netă (bani personali + acțiuni)' };
const variant = (id, goals) => { const b = SCENARIOS.find((q) => q.id === id); return { ...b, id: id + '-x', base: id, name: b.name + ' (expert)', expert: true, ai: [1, 1], years: b.years + 1, tip: 'Expert: ia un împrumut cu cap, cumpără acțiuni la compania ta și vezi ce fac concurenții.', goals: [...b.goals, ...goals] }; };
export const EXPERT_SCENARIOS = [
  variant('carbune', [{ ...NW, t: [80000, 120000, 200000] }]),
  variant('retea', [{ ...NW, t: [100000, 180000, 350000] }]),
];
export const scenarioById = (id) => SCENARIOS.find((q) => q.id === id) || EXPERT_SCENARIOS.find((q) => q.id === id) || null;
