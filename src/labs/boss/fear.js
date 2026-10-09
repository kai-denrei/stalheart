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
// outlives a reset. THE SHARES: `step` also adds the time since its last call to the round's seconds (while the fear is live: the
// fight running, the switch on, no capture playing), by the mode it returns; `counts()` gives the share of them spent fleeing and
// stunned, which `frights` cannot (a count of fresh episodes: a beam that is always in reach is one fright for seconds). They restart
// with the round (`reset`), as the threats do. Positions are the lab's local metres [x, z]; `step` returns the flee point in the same, a fresh array each call.
//
// THE BAIT MODE (`gunFear()` true; wave B, 2026-10-09: "#2 or #3 hits gets it wild temporarily, hurrying away from the impact"): the fear per gun of the
// domain's `barrage` / `scare` / `flightNow`. Within reach of a floor contact or any body node (`nodes()`, the arms count): each 25 mm round (`round`) fills
// the barrage meter and its flinch disturbs the kit (the crouch is the flinch); a 40 mm landing sends it wild, an MK-9 into a panic (and stuns it for
// `gunFear.nuke.stun` seconds, 0 by default), neither disturbing it (the recoil would hold it still for half a second of its flight). `step` then returns the
// flight with the flee point ({ mode, point, flight }), for the lab's temperament; `onScare(report)` hears every scare (the chatter's stagger).
import { makeFear, inReach, frighten, stun, fearNow, clearFear, barrage, scare, flightNow, meterNow } from '../../domain/boss-fear.js';
import { lineOf } from '../../domain/boss-fight.js';

// `tune()` the fight's live numbers, `creature()` the rules' creature (centre and contacts), `tank()` the rules' tank, `fight()`
// the round's state, `now()` the lab's clock, `kit()` the Nih-Dairia kit (or null), `on()` whether the fear switch and the fight are on
// the bait mode's: `gunFear()` whether the fear per gun is in force, `nodes()` the body's nodes ([x, z, height] local metres), `onScare(report)` each scare
export function createFear({ tune, creature, tank, fight, now, kit = () => null, on = () => true, gunFear = () => false, nodes = () => [], onScare = () => {} }) {
  const fear = makeFear();
  let mode = 'hunt';
  let last = null;                                  // the clock at the last `step`
  const secs = { live: 0, flee: 0, stun: 0 };       // this round's seconds of live fear, and of them fleeing and stunned

  function live() {
    const k = kit();
    return !!k && on() && fight().phase === 'fight' && !k.motion.feeding.locked;
  }
  const reached = (point, radius) => inReach(point, radius, gunFear() ? [...(creature().contacts ?? []), ...nodes()] : creature().contacts ?? [], tune().fear.reach);
  const disturb = (r) => { if (r.disturb) kit()?.motion.disturb(); };
  const scared = (r) => { if (r) onScare(r); return r; };

  return {
    // a Bofors or MK-9 landing the friendlies resolved at `point`
    landed(plan, point) {
      if (!live() || !reached(point, plan.radius)) return;
      const T = tune();
      if (gunFear()) {   // the bait mode: wild or panic, the stun its own knob
        if (plan.kind !== 'nuke' && plan.kind !== 'bofors') return;
        if (plan.kind === 'nuke' && T.gunFear.nuke.stun > 0) disturb(stun(fear, now(), T, T.gunFear.nuke.stun));
        scared(scare(fear, plan.kind, [point[0], point[1]], now(), T));
        return;
      }
      if (plan.kind === 'nuke') disturb(stun(fear, now(), T));
      else if (plan.kind === 'bofors') disturb(frighten(fear, plan, [point[0], point[1]], 'bofors', T.fear.bofors, now(), T));
    },
    // the live beam's point, each frame it burns
    beam(plan, point) {
      if (!live() || !reached(point, plan.radius)) return;
      const T = tune();
      disturb(frighten(fear, plan, [point[0], point[1]], 'sol', T.fear.after, now(), T));
    },
    // a 25 mm round of the player's landing at `point` (the bait mode): the barrage meter, its flinch disturbing the kit
    round(plan, point) {
      if (!gunFear() || !live() || !reached(point, plan.radius)) return;
      const r = scared(barrage(fear, [point[0], point[1]], now(), tune()));
      if (r) disturb(r);
    },
    // what the creature does now: { mode: 'hunt' | 'flee' | 'stun', point, flight } (the flee point in local metres, else null; the bait mode's running flight, else null)
    step(t) {
      const dt = last === null ? 0 : Math.max(0, t - last); last = t;
      if (!live()) { clearFear(fear); mode = 'hunt'; return { mode, point: null, flight: null }; }
      const { c, u } = lineOf(creature(), tank());
      const r = gunFear() ? flightNow(fear, t, c, u) : fearNow(fear, t, c, u, tune());
      mode = r.mode;
      secs.live += dt; if (mode === 'flee') secs.flee += dt; else if (mode === 'stun') secs.stun += dt;
      return r;
    },
    // a re-anchor of the lab's frame moves every local position by the same vector
    shift(sx, sz) { for (const th of fear.threats.values()) { th.at[0] += sx; th.at[1] += sz; } if (fear.flight) { fear.flight.at[0] += sx; fear.flight.at[1] += sz; } },
    reset() { clearFear(fear); mode = 'hunt'; last = null; secs.live = secs.flee = secs.stun = 0; },
    mode: () => mode,
    // the run's fresh episodes, and this round's share of live-fear time spent fleeing and stunned (0 before any)
    counts: () => ({ frights: fear.frights, stuns: fear.stuns, fleeShare: secs.live > 0 ? secs.flee / secs.live : 0, stunShare: secs.live > 0 ? secs.stun / secs.live : 0 }),
    // the bait mode's fear per gun: the run's scares by level, the barrage meter now, the flight running ({ level, at, since, until, flee, speed, erratic } or null)
    guns: () => ({ ...fear.scares, meter: meterNow(fear, now(), tune()), flight: fear.flight && fear.flight.until > now() ? { ...fear.flight, at: [...fear.flight.at] } : null }),
  };
}
