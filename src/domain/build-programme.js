// Isao's build programme: which step of the base he prints next and what it switches on. Pure: the steps come in from content
// (src/content/base-programme.js), the host passes the story phase, the sector and whether a wave is on, and prints the step itself.
import { STORY_PHASES } from './automation.js';

// `standing(step)` says a step's pieces already stand (a static stage, or a jump past it): those count as printed from the start,
// perks included, so a stage-8 base has every perk without a print
// THE BUILD BOARD (round 6, 2026-11-05): a step marked `board` left the automatic programme; it is `due` only once bought (buy(st, id), the
// board's pick, src/fx/build-board.js), and until then it neither blocks the steps behind it nor counts as owed. A standing one counts as bought.
export function makeBuildProgramme(steps, { standing = () => false } = {}) {
  const st = { steps: steps.slice(), done: new Set(), active: null, perks: new Set(), sector: 0, printed: [], bought: new Set() };
  for (const s of st.steps) if (standing(s)) { st.done.add(s.id); if (s.perk) st.perks.add(s.perk); }
  return st;
}

// THE RECON DOG'S OPENING (2026-11-12; src/content/base-programme.js OPENING_PROGRAMME): the steps `opening.order` names lead in that order, where the
// first of them stood, each with its `opening.when`; the rest keep their order. A step the plan does not hold is left out as before
export function openingSteps(steps, opening) {
  const lead = opening.order.map((id) => steps.find((s) => s.id === id)).filter(Boolean).map((s) => Object.freeze({ ...s, when: opening.when[s.id] ?? s.when }));
  const at = steps.findIndex((s) => opening.order.includes(s.id));
  if (at < 0) return steps.slice();
  const rest = steps.filter((s) => !opening.order.includes(s.id));
  return [...rest.slice(0, at), ...lead, ...rest.slice(at)];
}

// does a step's `when` hold in this context? (the build board asks it of the coming sector)
export function whenHolds(w, { phase, sector, waveActive, back, manned, standing, home = true }) {
  const at = STORY_PHASES.indexOf(phase);
  if (w.phase != null && !(at >= 0 && at >= STORY_PHASES.indexOf(w.phase))) return false;
  if (w.sector != null && !((sector ?? 0) >= w.sector)) return false;
  if (w.idle && waveActive) return false;
  // THE BACK GATE WAITS FOR THE SURPRISE TO BE OVER (2026-09-18): `when.back` is the state the second front must have reached —
  // 'held' means the mouth is open and its breach is closed or spent. The host reads it off the sector loop and passes it in.
  if (w.back != null && w.back !== back) return false;
  // SOL AUTOMATED (2026-10-01): `when.manned` is how many passes the player must have flown and burned in (the ARC-01 waits for it)
  if (w.manned != null && !((manned ?? 0) >= w.manned)) return false;
  // THE BRIDGES FOLLOW THEIR DOMES (2026-11-07): `when.stand` is the structure ids that must STAND before the step is due (a bridge waits for its
  // two domes). The host answers with `standing(id)`; with no answer nothing stands, so a bridge is never printed toward a dome that is not there; an empty list names nothing to wait for.
  if (w.stand?.length && !(typeof standing === 'function' && w.stand.every((id) => standing(id)))) return false;
  // THE KIDOU IS HOME (2026-11-12 night, the colony on the grid): `when.home` waits for the mobile Stålheart to be parked on its plaza (the host's
  // `home`; true when there is no gantry to wait for), so it never sets out while it is out and Isao never prints a bridge across its road
  if (w.home && home === false) return false;
  return true;
}

// the next step, or null: strictly in order (a step waits for the one before it), one at a time, and only once its `when` holds.
// A step marked `passable` whose `when` does not hold yet is passed over: the steps behind it go on without it and it prints when its
// turn comes round again (the ARC-01 waits on the player's hands, and the back gate must not wait behind it).
export function due(st, ctx = {}) {
  if (st.active) return null;
  const { phase = null, sector = 0, waveActive = false, back = null, manned = 0, standing, home = true } = ctx;
  for (const s of st.steps) {
    if (st.done.has(s.id) || (s.board && !st.bought.has(s.id))) continue;
    if (whenHolds(s.when ?? {}, { phase, sector, waveActive, back, manned, standing, home })) return s;
    if (!s.passable) return null;
  }
  return null;
}

export function begin(st, step) { st.active = step.id; }

// the board's purchase: true when `id` is a board step not yet bought or standing. A COLONY CELL IS BOUGHT AS A KIND (2026-11-12 night): `as`
// ({ kind, perk }) names the dome kind the cell will hold and the perk it switches on when it stands (the content's, handed in); with none the
// step's own `kind` and `perk` (the default city's) stand
export function buy(st, id, as = null) {
  const s = st.steps.find((x) => x.id === id);
  if (!s?.board || st.bought.has(id) || st.done.has(id)) return false;
  st.bought.add(id);
  if (as) (st.kinds ??= new Map()).set(id, { kind: as.kind ?? s.kind ?? null, perk: as.perk ?? null });
  return true;
}
// a colony cell's kind and perk: as bought, else the step's own
export const kindOf = (st, step) => st.kinds?.get(step.id) ?? { kind: step.kind ?? null, perk: step.perk ?? null };

// the step stands: returns its perk (or null)
export function finish(st, step) {
  if (st.active === step.id) st.active = null;
  if (st.done.has(step.id)) return null;
  st.done.add(step.id); st.printed.push(step.id);
  const perk = kindOf(st, step).perk;
  if (perk) st.perks.add(perk);
  return perk ?? null;
}

// A BUILDING IS LOST (SOL-82 can burn one; src/content/orbital-laser.js LASER_STRUCTURES). The step that printed it keeps counting
// as done — Isao does not print a burned building back, the colony simply goes without — but its perk goes out, so everything that
// consults the programme drops the thing that building was paying for. Returns the perk that went, or null.
export function lose(st, structureId) {
  st.lost ??= new Set();
  if (st.lost.has(structureId)) return null;
  const step = st.steps.find((s) => s.structures.includes(structureId));
  // a building nothing on the programme printed is still lost — the AFR-01 foundry stands from the start and Isao only works it —
  // it just has no perk to take with it. One that has not been printed yet is not there to burn.
  if (step && !st.done.has(step.id)) return null;
  st.lost.add(structureId);
  if (!step) return null;
  // a perk only goes out if no OTHER standing step still pays for it
  const perk = kindOf(st, step).perk;
  if (perk && !st.steps.some((s) => s !== step && kindOf(st, s).perk === perk && st.done.has(s.id) && !s.structures.some((id) => st.lost.has(id)))) { st.perks.delete(perk); return perk; }
  return null;
}

export const lost = (st) => new Set(st.lost ?? []);

export const perks = (st) => new Set(st.perks);
export const hasPerk = (st, name) => st.perks.has(name);

// once per new sector: true the first time `sector` is seen (the sector-start perks: the assembly line's rebuild, the farm's biomass)
export function sectorStarted(st, sector) {
  if (!(sector > st.sector)) return false;
  st.sector = sector;
  return true;
}
// once per new sector: true when the assembly line stands and a lost hull should be rebuilt at this sector's start
export const rebuildDue = (st, sector) => sectorStarted(st, sector) && st.perks.has('rebuild');

// `owed`: the steps not yet printed that the programme must still print in order (a passable step, waiting on the door or the player, is not
// owed; nor is a board step nobody bought); `bought`: the board's purchases
export const snapshot = (st) => ({ active: st.active, done: st.steps.filter((s) => st.done.has(s.id)).map((s) => s.id), printed: st.printed.slice(), next: st.steps.find((s) => !st.done.has(s.id) && (!s.board || st.bought.has(s.id)))?.id ?? null,   // next: a board step nobody bought is not next (2026-11-08)
   owed: st.steps.filter((s) => !st.done.has(s.id) && !s.passable && (!s.board || st.bought.has(s.id))).map((s) => s.id), bought: [...st.bought], perks: [...st.perks].sort(), lost: [...(st.lost ?? [])].sort(),
   kinds: Object.fromEntries(st.steps.filter((s) => s.cell && (st.bought.has(s.id) || st.done.has(s.id))).map((s) => [s.cell, kindOf(st, s).kind])) });
