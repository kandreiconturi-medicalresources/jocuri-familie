// Cursa: start cu numărătoare, ture, checkpoint-uri, clasament, final. Pur, fără Three/DOM.
import { createCar, stepCar, collide } from './car.js';
import { createBot, botControls } from './ai.js';
import { rng } from '../../../../shared/engine/rng.js';

export const COUNT_T = 3.2;   // secunde de numărătoare (3, 2, 1) înainte de START
export const CHECKPOINTS = 8; // pe tură
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const WAIT_AFTER_FIRST = 40;  // cât mai așteptăm după primul sosit, dacă un om încă aleargă

/** entries: [{ id, name, color, bot?, level?, remote? }] – ordinea = locul pe grilă. */
export function createRace({ track, laps = 3, entries, seed = 1 }) {
  const r = rng(seed);
  const race = {
    track, laps, phase: 'count', t: -COUNT_T, cars: [], byId: {}, bots: {}, events: [], order: [],
    finished: 0, firstFinish: -1, done: false, seed,
  };
  entries.forEach((e, k) => {
    const car = createCar(e.id, track.gridSlot(k), track);
    Object.assign(car, { name: e.name, color: e.color, bot: !!e.bot, remote: !!e.remote, place: 0, lapStart: 0, lapTimes: [], best: 0 });
    race.cars.push(car); race.byId[e.id] = car;
    if (e.bot) race.bots[e.id] = createBot(e.level || 'mid', r.next);
  });
  race.order = race.cars.map((c) => c.id);
  return race;
}

/** Numărul care se arată în timpul numărătorii: 3, 2, 1, apoi 0 (= START). */
export const countNumber = (race) => (race.t < 0 ? Math.ceil(-race.t - (COUNT_T - 3)) : 0);

function rank(race) {
  const L = race.track.length;
  race.order = race.cars.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.place - b.place;
    return b.maxProg - a.maxProg;
  }).map((c) => { c.rank = 0; return c.id; });
  race.order.forEach((id, i) => { race.byId[id].rank = i + 1; });
  return L;
}

/** Un pas de simulare. `ctls` = { id: comenzi } pentru mașinile controlate local de oameni. */
export function stepRace(race, ctls, dt) {
  const { track, laps } = race;
  const L = track.length;
  race.events.length = 0;
  const go = race.t >= 0;
  if (race.phase === 'count' && go) { race.phase = 'go'; race.events.push({ t: 'start' }); }
  race.t += dt;

  const leader = race.cars.reduce((m, c) => Math.max(m, c.prog), -1e9);
  const stepped = [];
  for (const car of race.cars) {
    if (car.remote) continue;
    let ctl = ctls[car.id];
    if (car.bot || car.finished || !ctl) {
      let bot = race.bots[car.id];
      if (!bot) bot = race.bots[car.id] = createBot('easy', Math.random);
      if (car.bot && go) car.nitro = Math.min(1, car.nitro + dt * 0.06);
      if (car.bot) car.capMul = bot.skill * (1 + clamp((leader - car.prog) / 160, -0.5, 1) * 0.07);
      ctl = botControls(bot, car, track, race.t);
      if (car.finished) { ctl.nitro = false; ctl.throttle = car.speed < 14 ? 1 : 0; }
    }
    stepCar(car, ctl, track, dt, go);
    stepped.push(car);
    if (car.nitroHit) { car.nitroHit = false; race.events.push({ t: 'nitro', id: car.id }); }
  }
  const hit = collide(race.cars, track);
  if (hit > 2) race.events.push({ t: 'bump', v: hit });

  for (const car of race.cars) {
    const p = Math.max(0, car.maxProg);
    const lap = Math.min(laps, Math.floor(p / L));
    car.cp = Math.floor(p / (L / CHECKPOINTS));
    if (lap > car.lap) {
      const ms = Math.round((race.t - car.lapStart) * 1000);
      car.lap = lap; car.lapStart = race.t; car.lapTimes.push(ms);
      car.best = car.best ? Math.min(car.best, ms) : ms;
      race.events.push({ t: 'lap', id: car.id, lap, ms });
    }
    if (!car.finished && car.maxProg >= laps * L) {
      car.finished = true;
      car.finishT = race.t - (car.maxProg - laps * L) / Math.max(5, car.speed);
      car.place = ++race.finished;
      if (race.firstFinish < 0) race.firstFinish = race.t;
      race.events.push({ t: 'finish', id: car.id, place: car.place });
    }
  }
  rank(race);

  const humans = race.cars.filter((c) => !c.bot);
  const pending = (humans.length ? humans : race.cars).some((c) => !c.finished);
  if (!race.done && (!pending || (race.firstFinish >= 0 && race.t - race.firstFinish > WAIT_AFTER_FIRST))) {
    race.done = true; race.phase = 'done'; race.events.push({ t: 'done' });
  }
  return race;
}

/** Clasamentul final: cei sosiți după timp, ceilalți după distanța parcursă. */
export const standings = (race) => race.order.map((id) => race.byId[id]);
