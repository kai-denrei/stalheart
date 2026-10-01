// Isao's build programme: which step of the base he prints next and what it switches on. Pure: the steps come in from content
// (src/content/base-programme.js), the host passes the story phase, the sector and whether a wave is on, and prints the step itself.
import { STORY_PHASES } from './automation.js';

// `standing(step)` says a step's pieces already stand (a static stage, or a jump past it): those count as printed from the start,
// perks included, so a stage-8 base has every perk without a print
export function makeBuildProgramme(steps, { standing = () => false } = {}) {
  const st = { steps: steps.slice(), done: new Set(), active: null, perks: new Set(), sector: 0, printed: [] };
  for (const s of st.steps) if (standing(s)) { st.done.add(s.id); if (s.perk) st.perks.add(s.perk); }
  return st;
}

// does a step's `when` hold in this context?
function holds(w, { phase, sector, waveActive, back, manned }) {
  const at = STORY_PHASES.indexOf(phase);
  if (w.phase != null && !(at >= 0 && at >= STORY_PHASES.indexOf(w.phase))) return false;
  if (w.sector != null && !((sector ?? 0) >= w.sector)) return false;
  if (w.idle && waveActive) return false;
  // THE BACK GATE WAITS FOR THE SURPRISE TO BE OVER (2026-09-18): `when.back` is the state the second front must have reached —
  // 'held' means the mouth is open and its breach is closed or spent. The host reads it off the sector loop and passes it in.
  if (w.back != null && w.back !== back) return false;
  // SOL AUTOMATED (2026-10-01): `when.manned` is how many passes the player must have flown and burned in (the ARC-01 waits for it)
  if (w.manned != null && !((manned ?? 0) >= w.manned)) return false;
  return true;
}

// the next step, or null: strictly in order (a step waits for the one before it), one at a time, and only once its `when` holds.
// A step marked `passable` whose `when` does not hold yet is passed over: the steps behind it go on without it and it prints when its
// turn comes round again (the ARC-01 waits on the player's hands, and the back gate must not wait behind it).
export function due(st, ctx = {}) {
  if (st.active) return null;
  const { phase = null, sector = 0, waveActive = false, back = null, manned = 0 } = ctx;
  for (const s of st.steps) {
    if (st.done.has(s.id)) continue;
    if (holds(s.when ?? {}, { phase, sector, waveActive, back, manned })) return s;
    if (!s.passable) return null;
  }
  return null;
}

export function begin(st, step) { st.active = step.id; }

// the step stands: returns its perk (or null)
export function finish(st, step) {
  if (st.active === step.id) st.active = null;
  if (st.done.has(step.id)) return null;
  st.done.add(step.id); st.printed.push(step.id);
  if (step.perk) st.perks.add(step.perk);
  return step.perk ?? null;
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
  if (step.perk && !st.steps.some((s) => s !== step && s.perk === step.perk && st.done.has(s.id) && !s.structures.some((id) => st.lost.has(id)))) { st.perks.delete(step.perk); return step.perk; }
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

// `owed`: the steps not yet printed that the programme must still print in order (a passable step, waiting on the door or the player, is not owed)
export const snapshot = (st) => ({ active: st.active, done: st.steps.filter((s) => st.done.has(s.id)).map((s) => s.id), printed: st.printed.slice(), next: st.steps.find((s) => !st.done.has(s.id))?.id ?? null, owed: st.steps.filter((s) => !st.done.has(s.id) && !s.passable).map((s) => s.id), perks: [...st.perks].sort(), lost: [...(st.lost ?? [])].sort() });
