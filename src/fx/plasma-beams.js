// THE PLASMA BEAMS (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the plasma thrower's and the lancer's
// beams on the towers: the links, throwPlasma, lanceBeam and their per-frame step. The controller keeps the beams' map
// (plasmaBeams; the frame readout counts it) and hands it in.
import { firingFor } from '../content/firing-defaults.js';
import * as THREE from '../../vendor/three.module.js';
import { createBeam } from '../beamfx.js';
import { BOARD_PRESET, BEAM_PEAK } from '../beamdraw.js';
import { sub3, scale3, norm3 } from '../vec3.js';
import { makeDotBurst } from '../units.js';
import { arcOf, pointAlongArc } from '../domain/round-path.js';
import { shotOf } from '../sentryfx.js';
import { LANCE_LOOK as SHOT_LANCE_LOOK, THROW_LOOK as SHOT_THROW_LOOK } from '../shotfx.js';
import { lanceFollow } from './lance-follow.js';

export function createPlasmaBeams(host) {
  // --- the PLASMA THROWER's beam ------------------------------------------
  // The tank's secondary, emplaced. It uses the SAME shader the pilot's
  // plasma does (beamfx's createBeam, the board preset) rather than a second
  // look that would drift from it — but not the tank's RIG, because that rig
  // draws along a great circle at a constant radius, which is right for a
  // hull firing across the ground and wrong for a tower on a wall firing DOWN
  // onto it. Straight 3D from muzzle to target is what a downward throw is,
  // and over 2.6 cells the difference between that and an arc is a fraction
  // of a cell.
  //
  // One beam per tower, five links each so the root tapers rather than
  // reading as a stack of boxes — the same reason the tank's has five.
  const PLASMA_LINKS = 5;
  // the board preset's widths are written in CELLS, same convention as the
  // tank's CELL_WIDTH_KEYS — scaled here and nowhere else
  const PLASMA_W = {
    coreWidth: BOARD_PRESET.coreWidth * 1.6,
    glowWidth: BOARD_PRESET.glowWidth * 0.55,
    jitterAmount: BOARD_PRESET.jitterAmount * 0.55,
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();

  // ONE CONSTRUCTOR for both beams: a thrower is wide, hot and jittery (a spray of matter), a lance thin and steady (light; operator:
  // "much thinner and straighter, no jitter"): jitter to nothing, noise and flicker most of the way down, a fifth of the width. The looks
  // live in shotfx.js so the shooting lab draws the same lance and throw the board does.
  const LANCE_LOOK = SHOT_LANCE_LOOK;
  const THROW_LOOK = SHOT_THROW_LOOK;

  function makePlasmaLinks(tw, look = THROW_LOOK) {
    const links = [];
    for (let i = 0; i < PLASMA_LINKS; i++) {
      const bm = createBeam(new THREE.Vector3(), new THREE.Vector3(), {
        ...BOARD_PRESET,
        ...(look.noiseAmount !== undefined ? { noiseAmount: look.noiseAmount } : {}),
        ...(look.flicker !== undefined ? { flicker: look.flicker } : {}),
        ...(look.scrollSpeed !== undefined ? { scrollSpeed: look.scrollSpeed } : {}),
        // the BEAM's colour if the def names one, else the tower's own — so
        // a Plasma Thrower reads as one of ITS family and not as a second
        // tank, and a green laser does not have to be a green tower
        glowColor: `#${(shotOf(tw.def).beamColor ?? tw.def.color).toString(16).padStart(6, '0')}`,
        coreWidth: PLASMA_W.coreWidth * host.cellSide() * look.width,
        glowWidth: PLASMA_W.glowWidth * host.cellSide() * look.width,
        jitterAmount: PLASMA_W.jitterAmount * host.cellSide() * look.jitter,
      });
      bm.mesh.visible = false;
      bm.mesh.renderOrder = 10;
      host.scene.add(bm.mesh);
      links.push(bm);
    }
    return links;
  }

  function throwPlasma(tw, from, to, tNow) {
    let ent = host.plasmaBeams.get(tw);
    if (!ent) {
      ent = { links: makePlasmaLinks(tw), until: 0 };
      host.plasmaBeams.set(tw, ent);
    }
    // HELD PAST THE TICK. The weapon fires six times a second and the hold
    // is longer than the gap, so what the player sees is one continuous
    // throw that ends when the tower stops firing rather than a strobe.
    ent.until = tNow + firingFor('plasma').beamHold;
    const a = scale3(from, 1);
    for (let k = 0; k < PLASMA_LINKS; k++) {
      const f0 = k / PLASMA_LINKS, f1 = (k + 1) / PLASMA_LINKS;
      pa.set(a[0] + (to[0] - a[0]) * f0, a[1] + (to[1] - a[1]) * f0, a[2] + (to[2] - a[2]) * f0);
      pb.set(a[0] + (to[0] - a[0]) * f1, a[1] + (to[1] - a[1]) * f1, a[2] + (to[2] - a[2]) * f1);
      const bm = ent.links[k];
      bm.setEndpoints(pa, pb);
      // narrow at the muzzle, opening down the throw — one curve, same shape
      // as the tank's widthAt, applied to the BASE widths rather than to
      // whatever the uniform happened to hold last frame (which would ratchet
      // the beam wider or thinner every tick).
      const w = 0.35 + 0.65 * Math.pow((k + 0.5) / PLASMA_LINKS, 0.7);
      for (const [key, base] of Object.entries(PLASMA_W)) {
        const u = bm.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`];
        if (u) u.value = base * host.cellSide() * w;
      }
      const cs = bm.uniforms.uCapStart, ce = bm.uniforms.uCapEnd;
      if (cs) cs.value = k === 0 ? BOARD_PRESET.capStart : 0;
      if (ce) ce.value = k === PLASMA_LINKS - 1 ? BOARD_PRESET.capEnd : 0;
      const gi = bm.uniforms.uGlowIntensity;
      if (gi) gi.value = BEAM_PEAK * 0.55 * w;
      bm.mesh.visible = true;
      bm.update(tNow);
      bm.setAlpha(1);
    }
  }

  // THE LANCE'S OWN DRAW. Same engine as the plasma — the beamfx shader, so
  // the board has ONE plasma look and not two — but pointed differently on
  // purpose: straight along the ground arc rather than down onto a body,
  // held for a long burst rather than re-lit six times a second, and thin,
  // because a lance is a line and a thrower is a spray.
  function lanceBeam(tw, from, dir, len, tNow, struck, stoppedBy) {
    let ent = host.plasmaBeams.get(tw);
    if (!ent) {
      ent = { links: makePlasmaLinks(tw, LANCE_LOOK), until: 0 };
      host.plasmaBeams.set(tw, ent);
    }
    ent.until = tNow + firingFor('lancer').beamHold;
    // IT HUGS THE PLANET (operator: a straight chord dove 0.49 cells underground across seven cells): drawn along the great circle,
    // descending at the barrel's pitch, the same curve its stop is solved on (src/domain/round-path.js lanceReach, pointAlongArc)
    const { fromU, dTan, r0, slope } = arcOf(from, dir);
    const at = (m) => pointAlongArc(fromU, dTan, r0, slope, m);
    for (let k = 0; k < PLASMA_LINKS; k++) {
      const m0 = len * (k / PLASMA_LINKS), m1 = len * ((k + 1) / PLASMA_LINKS);
      const p0 = at(m0), p1 = at(m1);
      pa.set(p0[0], p0[1], p0[2]);
      pb.set(p1[0], p1[1], p1[2]);
      const bm = ent.links[k];
      bm.setEndpoints(pa, pb);
      const cs = bm.uniforms.uCapStart, ce = bm.uniforms.uCapEnd;
      if (cs) cs.value = k === 0 ? BOARD_PRESET.capStart : 0;
      if (ce) ce.value = k === PLASMA_LINKS - 1 ? BOARD_PRESET.capEnd : 0;
      const gi = bm.uniforms.uGlowIntensity;
      // BRIGHTER FOR EVERY BODY IT IS THROUGH. The one thing a piercing
      // weapon should say out loud is how many it caught.
      if (gi) gi.value = BEAM_PEAK * (0.5 + 0.22 * Math.min(4, struck));
      bm.mesh.visible = true;
      bm.update(tNow);
      bm.setAlpha(1);
    }
    // WHERE IT IS STOPPED, SAID OUT LOUD: a splash on the rock reads as a hit, not a beam too short; rate-limited to the burst
    if (stoppedBy && tNow - (tw.lastSpark ?? -9) > (tw.def.burst ?? 0.6) * 0.9) {
      tw.lastSpark = tNow;
      const at = pointAlongArc(fromU, dTan, r0, slope, len);   // the splash where the curve ends
      const b = makeDotBurst(shotOf(tw.def).beamColor ?? tw.def.color, norm3(at),
        stoppedBy === 'wall' ? 18 : 12);
      b.scale.setScalar(host.cellSide() * (stoppedBy === 'wall' ? 1.5 : 1.1));
      b.position.set(at[0], at[1], at[2]);
      host.scene.add(b); host.debris.push(b); host.explode('lancer.burn', at);
    }
  }

  function stepPlasmaBeams(tNow) {
    for (const [tw, ent] of host.plasmaBeams) {
      const live = tNow < ent.until && host.towerByCell.get(tw.ci) === tw;
      const range = host.effectiveStats(tw.def, tw.tier).range * host.cellSide(), fl = live && tw.key === 'lancer' && lanceFollow(tw, { piloted: host.pilotMode() && host.pilot()?.state.tower === tw, camera: host.camera, range });
      if (fl) { const until = ent.until, dir = norm3(sub3(fl.aim, fl.from)); lanceBeam(tw, fl.from, dir, host.lanceReach(fl.from, dir, range, tw.ci).len, tNow, tw.lastStruck ?? 0, null); ent.until = until; }   // on the barrel every frame; no longer burst, no damage
      for (const bm of ent.links) {
        if (!live) { bm.mesh.visible = false; continue; }
        bm.update(tNow);
      }
      if (!live && !host.towers.includes(tw)) {
        for (const bm of ent.links) { host.scene.remove(bm.mesh); host.disposeObj(bm.mesh); }
        host.plasmaBeams.delete(tw);
      }
    }
  }
  return { makePlasmaLinks, throwPlasma, lanceBeam, stepPlasmaBeams };
}
