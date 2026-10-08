// fear.js — the boss lab's fright and stun (2026-10-08; spec docs/superpowers/specs/2026-10-08-boss-fight-next-round-design.md,
// section 2). The rule is src/domain/boss-fear.js; this file only feeds it what the friendlies report and says what the creature
// does now. A Bofors landing or a live SOL beam within radius + `fear.reach` of a floor contact frightens it (`landed`, `beam`), the
// MK-9's landing within reach stuns it. Each fresh fright and each stun disturb the kit (`motion.disturb()`).
//
// THE LIMITS (the caller's, as the rule leaves them): nothing is heard unless the fear switch is on, the fight's phase is 'fight'
// (plans in flight keep landing after a loss or a kill) and the feeding is not locked (a capture plays out); a guard that fails also
// drops the fears held, so a switch turned off or a round lost leaves nothing running.
//
// THE CLOCK: `now` is the lab's own monotonic clock, never the fight's (which restarts each round): the rule's disturb cooldown
// outlives a reset. Positions are the lab's local metres [x, z]; `step` returns the flee point in the same, a fresh array each call.
import { makeFear, inReach, frighten, stun, fearNow, clearFear } from '../../domain/boss-fear.js';
import { lineOf } from '../../domain/boss-fight.js';

// `tune()` the fight's live numbers, `creature()` the rules' creature (centre and contacts), `tank()` the rules' tank, `fight()`
// the round's state, `now()` the lab's clock, `kit()` the Nih-Dairia kit (or null), `on()` whether the fear switch and the fight are on
export function createFear({ tune, creature, tank, fight, now, kit = () => null, on = () => true }) {
  const fear = makeFear();
  let mode = 'hunt';

  function live() {
    const k = kit();
    return !!k && on() && fight().phase === 'fight' && !k.motion.feeding.locked;
  }
  const reached = (point, radius) => inReach(point, radius, creature().contacts ?? [], tune().fear.reach);
  const disturb = (r) => { if (r.disturb) kit()?.motion.disturb(); };

  return {
    // a Bofors or MK-9 landing the friendlies resolved at `point`
    landed(plan, point) {
      if (!live() || !reached(point, plan.radius)) return;
      const T = tune();
      if (plan.kind === 'nuke') disturb(stun(fear, now(), T));
      else if (plan.kind === 'bofors') disturb(frighten(fear, plan, [point[0], point[1]], 'bofors', T.fear.bofors, now(), T));
    },
    // the live beam's point, each frame it burns
    beam(plan, point) {
      if (!live() || !reached(point, plan.radius)) return;
      const T = tune();
      disturb(frighten(fear, plan, [point[0], point[1]], 'sol', T.fear.after, now(), T));
    },
    // what the creature does now: { mode: 'hunt' | 'flee' | 'stun', point } (the flee point in local metres, else null)
    step(t) {
      if (!live()) { clearFear(fear); mode = 'hunt'; return { mode, point: null }; }
      const { c, u } = lineOf(creature(), tank());
      const r = fearNow(fear, t, c, u, tune());
      mode = r.mode;
      return r;
    },
    // a re-anchor of the lab's frame moves every local position by the same vector
    shift(sx, sz) { for (const th of fear.threats.values()) { th.at[0] += sx; th.at[1] += sz; } },
    reset() { clearFear(fear); mode = 'hunt'; },
    mode: () => mode,
    counts: () => ({ frights: fear.frights, stuns: fear.stuns }),
  };
}
