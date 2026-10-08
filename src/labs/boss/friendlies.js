// friendlies.js — the boss fight's two shooters from above and their red spots (the boss lab, 2026-10-08; spec
// docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, section 4). The fight's rules decide everything
// (src/domain/boss-fight.js: `schedule` makes the plans, `resolveLanding` and `burn` the damage and the hull's loss); this file only
// translates each plan into what is seen and heard:
//
// - THE RED SPOT: from the plan's `showAt` until it is over, an additive ring of the plan's radius, `0xff2a1a`, pulsing at 6 Hz,
//   flat on the surface normal and lifted 0.1 m. Its radius is the damage radius: what you see is what kills.
// - THE BOFORS: the gun model on station for ever (makeGunship / mountGunship / fireRound / stepRounds, src/domain/gunship.js), a
//   round fired at the plan's `fireAt` with a tracer from the sky point (the platform's altitude over the frame's origin, 120 m
//   east); at the plan's `land` (the plan is trusted; stepRounds is the gun model's bookkeeping) the burst, the impact cue and the
//   landing resolved.
// - SOL-88: the orbital laser standalone, as the laser lab uses it: the pointer (`guideAt`) until `land`, then `lay`, the ignite
//   burst and the burn loop, `aim` at the plan's point (the spot is the promise: the contact never chases) with a contact burst
//   every 1 / LASER_CONTACT_RATE seconds and `burn` every frame until `until`, then `lift`.
//
// POSITIONS: plans are in the lab's local metres [x, z]; `surface(x, z)` gives the ground in the planet-centred `sphere` group,
// where the rings, the tracers, the laser and the explosions all live. `shift(sx, sz)` follows a re-anchor of the lab's frame.
import * as THREE from '../../../vendor/three.module.js';
import { schedule, resolveLanding, burn } from '../../domain/boss-fight.js';
import { makeGunship, stepGunship, mountGunship, fireRound, stepRounds } from '../../domain/gunship.js';
import { GUNSHIP_GUNS, GUNSHIP_ORBIT, GUNSHIP_PLATFORM } from '../../content/gunship.js';
import { LASER_PRESET, LASER_SOUNDS, LASER_CONTACT_RATE } from '../../content/orbital-laser.js';
import { createGunshipOptic } from '../../fx/gunship-optic.js';
import { createOrbitalLaser } from '../../fx/orbital-laser.js';

const SPOT = { hex: 0xff2a1a, inner: 0.94, hz: 6, lift: 0.1, order: 8 };   // the red spot: the seat highlight's additive ring
const TRACER = { hex: 0xffb43d, width: 0.5 };
const STATION_EAST = 120;   // metres east of the frame's origin the tracers leave from
const Z = new THREE.Vector3(0, 0, 1);

export function createFriendlies(scene, {
  sphere = scene, surface, cellSide = 10, explosions = null, sfx = null, tune, fight, now, creature, tank,
  onTankHit = () => {}, enabled = () => ({ gunship: true, sol: true }),
} = {}) {
  const unit = cellSide / 10;   // scene units per metre
  const gun = GUNSHIP_GUNS.bofors;
  const gs = makeGunship(GUNSHIP_ORBIT, { station: true }); mountGunship(gs);
  const optic = createGunshipOptic(sphere, { cellSide, metresPerCell: 10 });
  const laser = createOrbitalLaser(sphere, { cellSide, metresPerCell: 10 });
  const spotMat = new THREE.MeshBasicMaterial({ color: SPOT.hex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const spotGeo = new Map();   // radius -> RingGeometry
  const pending = [];          // { plan, ring, fired, laid, contactT }
  let solOwner = null, burnVoice = null, pulse = 0;
  const sky = new THREE.Vector3(), east = new THREE.Vector3();

  function ringOf(radius) {
    let g = spotGeo.get(radius);
    if (!g) { g = new THREE.RingGeometry(radius * SPOT.inner * unit, radius * unit, 64); spotGeo.set(radius, g); }
    const m = new THREE.Mesh(g, spotMat); m.renderOrder = SPOT.order; sphere.add(m);
    return m;
  }
  function placeRing(m, here) {
    m.position.copy(here.point).addScaledVector(here.normal, SPOT.lift * unit);
    m.quaternion.setFromUnitVectors(Z, here.normal);
  }
  // the platform over the frame's origin at its altitude, offset east, so the tracers come down at a slant
  function skyPoint() {
    const o = surface(0, 0), e = surface(1, 0);
    east.copy(e.point).sub(o.point); east.addScaledVector(o.normal, -east.dot(o.normal)).normalize();
    return sky.copy(o.point).addScaledVector(o.normal, GUNSHIP_PLATFORM.altitudeCells * cellSide).addScaledVector(east, STATION_EAST * unit).toArray();
  }
  // the shooters a disabled switch drops go to `schedule` as the tune's own booleans
  function tuneNow() {
    const T = tune(), on = enabled();
    return { ...T, bofors: { ...T.bofors, enabled: !!on.gunship && T.bofors.enabled !== false }, sol: { ...T.sol, enabled: !!on.sol && T.sol.enabled !== false } };
  }

  function endBurn() {
    laser.lift(); laser.hideGuide();
    burnVoice?.stop(); burnVoice = null; solOwner = null;
  }
  function drop(e) {
    if (e.ring) { sphere.remove(e.ring); e.ring = null; }
    if (solOwner === e) endBurn();
    else if (e.plan.kind === 'sol' && !solOwner) laser.hideGuide();
  }

  // one plan's frame; true once it is over
  function advance(e, t, dt, state) {
    const p = e.plan, here = surface(p.at[0], p.at[1]);
    if (!e.ring && t >= p.showAt) e.ring = ringOf(p.radius);
    if (e.ring) placeRing(e.ring, here);
    if (p.kind === 'bofors') {
      if (!e.fired && t >= p.fireAt) {
        e.fired = true;
        const to = here.point.toArray();
        fireRound(gs, gun.key, to, gun.travel);
        optic.flight(skyPoint(), to, TRACER.hex, gun.travel, TRACER.width);
      }
      if (t < p.land) return false;
      explosions?.spawn(`gunship.${gun.key}`, here.point.toArray(), here.normal.toArray(), cellSide);
      sfx?.play(gun.impact ?? 'blast_fire');
      if (resolveLanding(state, p, creature(), tank()).tankHit) onTankHit('a Bofors round');
      return true;
    }
    if (t < p.land) { if (!solOwner) laser.guideAt(here.point, here.normal); return false; }
    if (t >= p.until) return true;
    if (!e.laid) {
      if (solOwner) endBurn();   // a strike over another's burn takes the one beam
      e.laid = true; solOwner = e; e.contactT = 0;
      laser.hideGuide();
      laser.tune({ coreWidth: LASER_PRESET.coreWidth, glowWidth: LASER_PRESET.glowWidth, radius: p.radius });
      laser.lay(here.point, here.normal);
      explosions?.spawn('laser.ignite', here.point.toArray(), here.normal.toArray(), cellSide);
    } else if (solOwner === e) laser.aim(here.point, here.normal);
    if (burn(state, p, dt, creature(), tank()).tankHit) onTankHit('SOL-88');
    e.contactT += dt;
    for (const every = 1 / LASER_CONTACT_RATE; e.contactT >= every; e.contactT -= every) {
      explosions?.spawn('laser.contact', here.point.toArray(), here.normal.toArray(), cellSide);
    }
    if (solOwner === e) burnVoice ??= sfx?.loop(LASER_SOUNDS.burn) ?? null;   // loop() is null until the sample decodes
    return false;
  }

  function tick(dt) {
    const t = now(), state = fight();
    stepGunship(gs, dt, GUNSHIP_ORBIT);
    gs.phase = 'station'; gs.left = GUNSHIP_ORBIT.station;   // on station for ever, as the gunship lab's stationForever
    stepRounds(gs);
    for (const plan of schedule(state, t, creature(), tuneNow())) pending.push({ plan, ring: null, fired: false, laid: false, contactT: 0 });
    for (let i = 0; i < pending.length; i++) {
      if (!advance(pending[i], t, dt, state)) continue;
      drop(pending[i]); pending.splice(i--, 1);
    }
    pulse += dt;
    spotMat.opacity = 0.5 + 0.35 * Math.sin(pulse * SPOT.hz * 2 * Math.PI);
    laser.tick(dt, 1);
    optic.fade(dt);
  }

  // a new round owes nothing to the old one: the plans, the spots, the rounds and the tracers in the air, the beam
  function reset() {
    for (const e of pending) drop(e);
    pending.length = 0; gs.rounds.length = 0;
    endBurn();
    optic.fade(1e6);   // every tracer to the end of its flight
  }

  function shift(sx, sz) { for (const e of pending) { e.plan.at[0] += sx; e.plan.at[1] += sz; } }

  return {
    tick, shift, reset,
    rings: () => pending.reduce((n, e) => n + (e.ring ? 1 : 0), 0),
    dispose() {
      reset();
      for (const g of spotGeo.values()) g.dispose();
      spotGeo.clear(); spotMat.dispose();
      optic.dispose(); laser.dispose();
    },
  };
}
