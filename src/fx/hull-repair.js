// THE HULL MENDS UNDER THE STÅLHEART (owner, 2026-10-18: "when the Mork is damaged, sitting under the Stalheart should repair it, same repair
// time as the shield recharge"): each frame the hull's place and pace are read, the rule (src/domain/hull-repair.js) is applied, and the armour it
// returns is written back to the host. Under: the hull inside the Stålheart's gantry box seen from above (the same test as the terminal's console,
// src/fx/story-base.js inside, so the prompt and the mend agree; the hull drives under the Stålheart by the owner's rule of 2026-10-03). The hull
// may be parked there while the player sits in a seat or flies: it mends anyway. A dent taken (the armour falling between two frames) holds the
// mend HULL_REPAIR.hitHold seconds and drops the fraction. The console reads REPAIRING while it mends (mending()), and a quiet callout says so
// when the last dent comes back.
//   createHullRepair({ pos, under, armour, setArmour, hits, metres, alive, callout })
//     pos(): the hull's unit position or null; under(p): inside the Stålheart's gantry; armour()/setArmour(n): the dents left (td-tab hullArmour);
//     hits(): the armour's whole; metres(): metres a unit of the hull's space; alive(): the hull stands; callout(text, cls)
//   -> { tick(dt), mending(), state() }
import { repairStep } from '../domain/hull-repair.js';
import { HULL_REPAIR } from '../content/tank.js';

export function createHullRepair({ pos, under, armour, setArmour, hits, metres, alive, callout }) {
  let last = null, was = null, maxWas = null, sinceHit = Infinity, progress = 0, away = 0, mend = false, at = { under: false, still: false };
  return {
    tick(dt) {
      if (!(dt > 0)) return;
      const p = pos(), max = hits(), dents = armour();
      const speed = p && last ? Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) / dt * metres() : 0;
      last = p ? p.slice() : null;
      if (was !== null && maxWas === max && dents < was) sinceHit = 0; else sinceHit += dt;   // a dent taken; a knob change or a new hull is not one
      was = dents; maxWas = max;
      at = { under: !!(p && alive() && under(p)), still: speed <= HULL_REPAIR.maxSpeed };
      const r = repairStep({ ...at, hit: sinceHit < HULL_REPAIR.hitHold, dents, max, dt, seconds: HULL_REPAIR.seconds, progress, away, keep: HULL_REPAIR.keep });
      progress = r.progress; away = r.away; mend = r.mending;
      if (r.dents !== dents) { setArmour(r.dents); was = r.dents; if (r.dents >= max) callout('HULL REPAIRED', 'co-victory-sub'); }
    },
    mending: () => mend,
    state: () => ({ ...at, dents: armour(), max: hits(), progress: +progress.toFixed(3) }),
  };
}
