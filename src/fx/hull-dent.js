// A DENT IN THE HULL, EXPLICIT (owner, 2026-11-02, round 4, note 7: hitting a hard core must read; spec
// docs/superpowers/specs/2026-11-02-round-4-fifteen-notes-design.md, Stream A). Moved out of src/td-tab.js playerHit's FOUR HITS A HULL branch
// (the flash class, the shove, the alarm, the gauge) and made louder: the shove at HULL_DENT.bump of BUMP_LEN (was 0.6), a cored kick through
// the tank's jolt (src/fx/ram-jolt.js, a HULL_DENT.jolt m body), the HULL DAMAGE callout (HULL LOST stays src/fx/hull-loss.js's) and the frame's
// red halo and vignette (styles.css #tab-td.hull-dent::after); the gauge on the armour's parts is src/tankfeel.js applyTankHealth (HULL_DENT.gauge).
//   host: { container, sfx, jolt, playerMesh(), health() (the armour's share left), bump(share) (the shove, a share of BUMP_LEN), callout(text, cls) }
//   dent()   state() -> { dents }
import { HULL_DENT } from '../content/tank.js';
import { applyTankHealth } from '../tankfeel.js';

export function createHullDent(host) {
  let dents = 0;
  return {
    dent() {
      dents++;
      host.bump(HULL_DENT.bump);
      const mesh = host.playerMesh(); if (mesh) applyTankHealth(mesh, host.health());
      host.jolt.kick({ radius: HULL_DENT.jolt, solid: true, side: 0 });
      const c = host.container; c.classList.remove('hull-dent'); void c.offsetWidth; c.classList.add('hull-dent');   // restart the flash on a second dent
      host.callout(HULL_DENT.callout[0], HULL_DENT.callout[1]);
      host.sfx.play('danger_alert', { dist: 0, gain: 0.5 });
    },
    state: () => ({ dents }),
  };
}
