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

// the next step, or null: strictly in order (a step waits for the one before it), one at a time, and only once its `when` holds
export function due(st, { phase = null, sector = 0, waveActive = false } = {}) {
  if (st.active) return null;
  const next = st.steps.find((s) => !st.done.has(s.id));
  if (!next) return null;
  const w = next.when ?? {}, at = STORY_PHASES.indexOf(phase);
  if (w.phase != null && !(at >= 0 && at >= STORY_PHASES.indexOf(w.phase))) return null;
  if (w.sector != null && !((sector ?? 0) >= w.sector)) return null;
  if (w.idle && waveActive) return null;
  return next;
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

export const perks = (st) => new Set(st.perks);
export const hasPerk = (st, name) => st.perks.has(name);

// once per new sector: true when the assembly line stands and a lost hull should be rebuilt at this sector's start
export function rebuildDue(st, sector) {
  if (!(sector > st.sector)) return false;
  st.sector = sector;
  return st.perks.has('rebuild');
}

export const snapshot = (st) => ({ active: st.active, done: st.steps.filter((s) => st.done.has(s.id)).map((s) => s.id), printed: st.printed.slice(), next: st.steps.find((s) => !st.done.has(s.id))?.id ?? null, perks: [...st.perks].sort() });
