// THE LANDING WASH (owner, 2026-11-15: "when the rocket lands, the thrusters touching the surface should create effects of smoke and particles
// flying ... like in the reference images of spacex boosters re-entry. perhaps we can re-use some of the nuclear strike effects after the explosion,
// just the smoke"). The orbital strike's own layers (src/fx/explosions/common.js: the puff that drags out along the ground and rises slowly, as its
// base surge does, and the spark streak), as two fixed rings of slots: a puff is written into the next slot with its birth time and the shader
// animates it from there, so the whole wash is two draws and no allocation a frame, whatever the flight does. The rules (how hard, where, how many)
// are src/domain/landing-wash.js; the knobs src/content/story-defaults.js LANDING_WASH.
//
// `parent` the base's group, `frame` the landing island's world basis (src/fx/story-base.js: +y its up, no scale), `metres` world units a metre: the
// puffs live in island metres and the layers' uScale makes them world units (a quad is widened in view space, so never an object scale). The bend
// follows the planet from the island's tangent plane (`planetRadius`, world units). tick(dt, { feet, axis, plume, reach, pad, wreck }) every frame:
// the hull's feet and up in island metres, its engines' light 0..1, the plume's length under the feet (metres), the pad's top (island y), and
// whether a cut at the ground is a wreck (the bigger ring).
import * as THREE from '../../vendor/three.module.js';
import { assemble, mulberry32, range } from './explosions/common.js';
import { washStrength, groundHit, emitDue, cutAtGround, sagAt } from '../domain/landing-wash.js';
import { LANDING_WASH } from '../content/story-defaults.js';

export function createLandingWash({ parent, frame, metres = 1, planetRadius = 0, tune = LANDING_WASH, seed = 11 } = {}) {
  const P = tune.puffs, G = tune.grit, rand = mulberry32(seed), pick = ([lo, hi]) => range(rand, lo, hi);
  const R = metres > 0 ? planetRadius / metres : 0;   // the planet's radius in island metres (the ground's sag)
  const idle = (n, item) => Array.from({ length: n }, item);
  const fx = assemble({ name: 'landing-wash', lifeS: Infinity }, { palette: tune.palette, scale: metres, planetRadius }, [
    { kind: 'puff', items: idle(P.capacity, () => ({ o: [0, 0, 0], delay: 1e9, life: 0 })), order: 1, uniforms: { uIntensity: tune.intensity } },
    { kind: 'spark', items: idle(G.capacity, () => ({ o: [0, 0, 0], v: [0, 0, 0], delay: 1e9, life: 0 })), order: 2, uniforms: { uTrail: G.trail } },
  ]);
  const root = new THREE.Group(); root.name = 'LandingWash'; root.matrixAutoUpdate = false; root.matrix.copy(frame); root.add(fx.object); parent.add(root);
  const [puffMesh, gritLines] = fx.object.children, pa = puffMesh.geometry.attributes, ga = gritLines.geometry.attributes;
  let clock = 0, pi = 0, gi = 0, pCarry = 0, gCarry = 0, was = 0, k = 0, emitted = 0, thrown = 0, bursts = 0, last = 0, dirtyP = false, dirtyG = false, gone = false;
  const hit = [0, 0, 0];

  // one puff into the next slot: out from the hit along the ground at angle `a`
  function puff(a, s, size1, life, heat) {
    const i = pi; pi = (pi + 1) % P.capacity;
    const c = Math.cos(a), n = Math.sin(a), r0 = rand() * P.core, size0 = pick(P.size0), drag = pick(P.drag), lift = pick(P.lift);
    // its centre `lift` of its size over the ground as it grows, so it rests on the ground (a quad half under it drew a straight edge): born at that
    // share of its first size, carried up by the share of its growth (the drag's own easing, near the growth's), plus a little of its own
    pa.aOrigin.array.set([hit[0] + c * r0, hit[1] + lift * size0, hit[2] + n * r0], i * 3);
    pa.aVel.array.set([c * s, lift * (size1 - size0) * drag + pick(P.up), n * s], i * 3);
    pa.aMotion.array.set([drag, pick(P.rise), 0, 0], i * 4);
    pa.aSize.array.set([size0, size1, pick(P.grow), rand()], i * 4);
    pa.aTime.array.set([clock, life, heat, P.heatTau], i * 4);
    dirtyP = true; emitted++; last = clock + life;
  }
  function grit(strength) {
    const i = gi; gi = (gi + 1) % G.capacity;
    const a = rand() * Math.PI * 2, up = pick(G.up), flat = Math.sqrt(1 - up * up), s = pick(G.speed) * (0.6 + 0.4 * strength);
    const o = [hit[0] + (rand() - 0.5) * 2, hit[1] + 0.4, hit[2] + (rand() - 0.5) * 2], v = [Math.cos(a) * flat * s, up * s, Math.sin(a) * flat * s];
    const spark = [clock, pick(G.life), pick(G.drag), pick(G.heat)];
    for (let e = 0; e < 2; e++) { const j = i * 2 + e; ga.aOrigin.array.set(o, j * 3); ga.aVel.array.set(v, j * 3); ga.aSpark.array.set(spark, j * 4); }
    dirtyG = true; thrown++; last = Math.max(last, clock + spark[1]);
  }
  function flush() {
    if (dirtyP) { for (const key of ['aOrigin', 'aVel', 'aMotion', 'aSize', 'aTime']) pa[key].needsUpdate = true; dirtyP = false; }
    if (dirtyG) { for (const key of ['aOrigin', 'aVel', 'aSpark']) ga[key].needsUpdate = true; dirtyG = false; }
  }

  return {
    root,
    tick(dt, { feet, axis = [0, 1, 0], plume = 0, reach = 0, pad = 0, wreck = false } = {}) {
      if (gone || !(dt > 0)) return;
      clock += dt; fx.tick(dt);
      if (feet) {
        const ground = pad - sagAt(feet[0], feet[2], R), altitude = feet[1] - ground;
        k = washStrength({ plume, altitude, reach: reach * tune.reach, full: tune.full });
        const h = groundHit(feet, axis, ground); hit[0] = h[0]; hit[1] = pad; hit[2] = h[2];   // the bend lays the puffs on the sphere from the tangent plane
        if (k > 0) {
          const p = emitDue(pCarry, P.rate * k, dt); pCarry = p.carry;
          for (let j = 0; j < p.n; j++) puff(rand() * Math.PI * 2, pick(P.speed) * (0.55 + 0.45 * k), pick(P.size1), pick(P.life), pick(P.heat) * (0.5 + 0.5 * k));
          const g = emitDue(gCarry, G.rate * k, dt); gCarry = g.carry;
          for (let j = 0; j < g.n; j++) grit(k);
        } else pCarry = gCarry = 0;
        if (cutAtGround({ was, now: plume, altitude })) ring(wreck ? tune.burst.wreck : 1);
        was = k;
      }
      flush();
    },
    // the ring thrown at the cut (the touchdown; `scale` more on a wreck), evenly round with a jitter so it never reads as spokes
    burst(scale = 1) { ring(scale); flush(); },
    state: () => ({ k: +k.toFixed(2), emitted, thrown, bursts, live: clock < last, t: +clock.toFixed(2), hit: hit.map((v) => +v.toFixed(1)) }),
    dispose() { if (gone) return; gone = true; fx.dispose(); root.removeFromParent(); },
  };
  function ring(scale) {
    const B = tune.burst, n = Math.round(B.count * scale);
    for (let j = 0; j < n; j++) puff((j + rand() * 0.8) / n * Math.PI * 2, pick(B.speed), pick(B.size1), pick(B.life), pick(P.heat) * 0.6);
    for (let j = 0; j < Math.round(G.burst * scale); j++) grit(1);
    bursts++;
  }
}
