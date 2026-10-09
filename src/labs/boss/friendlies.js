// friendlies.js — the boss fight's four shooters from above and their red spots (the boss lab, 2026-10-08; specs
// docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, section 4, and ...-next-round-design.md, section 1). The fight's
// rules decide everything (src/domain/boss-fight.js: `schedule` makes the plans, `aimNow` moves a stream and a beam, `resolveLanding`
// and `burn` the damage and the hull's loss); this file only translates each plan into what is seen and heard, one branch per kind:
//
// - THE RED SPOT: from the plan's `showAt` until it is over, an additive ring of the plan's radius, `0xff2a1a`, pulsing at 6 Hz,
//   flat on the surface normal and lifted 0.1 m. Its radius is the damage radius: what you see is what kills.
// - THE ROTARY (25 mm): a stream, one plan a burst. Its ring walks with the foot the rules pick (`aimNow`, every frame from `showAt`);
//   from `land` to `until` the stream burns (`burn`), a tracer from the sky point and a `gunship.rotary` impact every 0.1 s, and the
//   `gunship_rotary_fire` loop is held (null until the sample decodes: asked again each frame; stopped at the end, on `drop`, on `reset`).
// - THE BOFORS (40 mm): the gun model on station for ever (makeGunship / mountGunship / fireRound / stepRounds, src/domain/gunship.js), a
//   round fired at the plan's `fireAt` with a tracer from the sky point (the platform's altitude over the frame's origin, 120 m
//   east), its flight the time left to `land` so the head arrives at the burst; at the plan's `land` (the plan is trusted;
//   stepRounds is the gun model's bookkeeping) the burst, the impact cue and the landing resolved.
// - THE MK-9: the 55 m ring from the release to `land`; at `fireAt` the body drops from the sky point (src/fx/gunship-drop.js, driven
//   every frame) with its release and ignite cues; at `land` the `gunship.nuke` blast and the landing resolved. The body is optional
//   (a pool that is not ready drops nothing), the ring and the landing are the rule.
// - SOL-88: the orbital laser standalone, as the laser lab uses it: the pointer (`guideAt`) at the planned point until `land`, then
//   `lay`, the ignite burst and the burn loop; the beam TRACKS (the rules' `aimNow` each frame: in front of the creature, clear of the
//   tank), the ring and the contact bursts with it, `burn` every frame until `until`, then `lift`.
//
// THE HOST'S HOOKS (default no-ops): `onTankHit(reason)`, `onLanding(plan, { damage, point })` for every Bofors and MK-9 landing,
// `onBeam(plan, point)` each frame SOL burns and `onBurn(plan, dt)` each frame a stream or the beam burns (the bait mode's Isao is
// hurt by them as the creature is); `point` is the plan's local [x, z], a fresh array each call. `adopt(plan)` takes a plan the
// player made (src/labs/boss/seat.js) into the same presentation.
//
// POSITIONS: plans are in the lab's local metres [x, z]; `surface(x, z)` gives the ground in the planet-centred `sphere` group,
// where the rings, the tracers, the laser and the explosions all live. `shift(sx, sz)` follows a re-anchor of the lab's frame.
import * as THREE from '../../../vendor/three.module.js';
import { schedule, resolveLanding, burn, aimNow } from '../../domain/boss-fight.js';
import { makeGunship, stepGunship, mountGunship, fireRound, stepRounds } from '../../domain/gunship.js';
import { GUNSHIP_GUNS, GUNSHIP_ORBIT, GUNSHIP_PLATFORM, GUNSHIP_NUKE } from '../../content/gunship.js';
import { LASER_PRESET, LASER_SOUNDS, LASER_CONTACT_RATE } from '../../content/orbital-laser.js';
import { createGunshipOptic } from '../../fx/gunship-optic.js';
import { createGunshipDrop } from '../../fx/gunship-drop.js';
import { createOrbitalLaser } from '../../fx/orbital-laser.js';

const SPOT = { hex: 0xff2a1a, inner: 0.94, hz: 6, lift: 0.1, order: 8 };   // the red spot: the seat highlight's additive ring
const TRACER = { hex: 0xffb43d, width: 0.5 };
const STREAM = { every: 0.1, width: 0.25 };   // the rotary's tracer and impact cadence, seconds; the tracer's tail as a fraction of its flight
const STATION_EAST = 120;   // metres east of the frame's origin the tracers leave from
const Z = new THREE.Vector3(0, 0, 1);

export function createFriendlies(scene, {
  sphere = scene, surface, cellSide = 10, explosions = null, sfx = null, tune, fight, now, creature, tank,
  onTankHit = () => {}, onLanding = () => {}, onBeam = () => {}, onBurn = () => {},
  enabled = () => ({ rotary: true, bofors: true, nuke: true, sol: true }),
} = {}) {
  const unit = cellSide / 10;   // scene units per metre
  const gun = GUNSHIP_GUNS.bofors, rotary = GUNSHIP_GUNS.rotary;
  const gs = makeGunship(GUNSHIP_ORBIT, { station: true }); mountGunship(gs);
  const optic = createGunshipOptic(sphere, { cellSide, metresPerCell: 10 });
  const laser = createOrbitalLaser(sphere, { cellSide, metresPerCell: 10 });
  const makeDrop = () => createGunshipDrop(sphere, { cellSide, metresPerCell: 10, onIgnite: () => sfx?.play(GUNSHIP_NUKE.igniteSound) });
  let nuke = makeDrop();   // the MK-9's body, pooled; a new one when a round's reset has to take a falling body away
  const spotMat = new THREE.MeshBasicMaterial({ color: SPOT.hex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const spotGeo = new Map();   // radius -> RingGeometry
  const pending = [];          // { plan, ring, fired, laid, contactT, streamT, voice }
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
    const T = tune(), on = enabled(), out = { ...T };
    for (const k of ['rotary', 'bofors', 'nuke', 'sol']) out[k] = { ...T[k], enabled: !!on[k] && T[k].enabled !== false };
    return out;
  }

  function endBurn() {
    laser.lift(); laser.hideGuide();
    burnVoice?.stop(); burnVoice = null; solOwner = null;
  }
  function drop(e) {
    if (e.ring) { sphere.remove(e.ring); e.ring = null; }
    e.voice?.stop(); e.voice = null;
    if (solOwner === e) endBurn();
    else if (e.plan.kind === 'sol' && !solOwner) laser.hideGuide();
  }

  // a landing resolved by the rules, told to the host
  function land(p, state, c, k, by) {
    const r = resolveLanding(state, p, c, k);
    if (r.tankHit) onTankHit(by);
    onLanding(p, { damage: r.damage, point: [...p.at] });
  }

  // one plan's frame; true once it is over
  function advance(e, t, dt, state, c, k) {
    const p = e.plan;
    if ((p.kind === 'rotary' && t >= p.showAt) || (p.kind === 'sol' && t >= p.land)) p.at = aimNow(p, c, k, tune());   // a stream and a beam walk
    const here = surface(p.at[0], p.at[1]);
    if (!e.ring && t >= p.showAt) e.ring = ringOf(p.radius);
    if (e.ring) placeRing(e.ring, here);
    if (p.kind === 'rotary') return stream(e, t, dt, state, c, k, here);
    if (p.kind === 'nuke') return fall(e, t, state, c, k, here);
    if (p.kind === 'bofors') {
      if (!e.fired && t >= p.fireAt) {
        e.fired = true;
        // the flight is what is left to the landing, so the tracer's head arrives at the burst (a frame may start it late)
        const to = here.point.toArray(), flight = Math.max(1e-3, p.land - t);
        fireRound(gs, gun.key, to, flight);
        optic.flight(skyPoint(), to, TRACER.hex, flight, TRACER.width);
      }
      if (t < p.land) return false;
      explosions?.spawn(`gunship.${gun.key}`, here.point.toArray(), here.normal.toArray(), cellSide);
      sfx?.play(gun.impact ?? 'blast_fire');
      land(p, state, c, k, 'a Bofors round');
      return true;
    }
    return beam(e, t, dt, state, c, k, here);
  }

  // the 25 mm stream: burns while any foot is in the ring, a tracer and an impact every 0.1 s, the loop held
  function stream(e, t, dt, state, c, k, here) {
    const p = e.plan;
    if (t < p.land) return false;
    if (t >= p.until) return true;
    e.voice ??= sfx?.loop(rotary.sound) ?? null;   // loop() is null until the sample decodes: asked again next frame
    if (burn(state, p, dt, c, k).tankHit) onTankHit('the 25 mm');
    onBurn(p, dt);
    for (e.streamT += dt; e.streamT >= STREAM.every; e.streamT -= STREAM.every) {
      optic.flight(skyPoint(), here.point.toArray(), rotary.ringHex, rotary.travel, STREAM.width);
      explosions?.spawn(`gunship.${rotary.key}`, here.point.toArray(), here.normal.toArray(), cellSide);
    }
    return false;
  }

  // the MK-9: the ring from the release; the body drops at `fireAt` (when its pool is ready), the blast and the landing at `land`
  function fall(e, t, state, c, k, here) {
    const p = e.plan;
    if (!e.fired && t >= p.fireAt) {
      e.fired = true;
      sfx?.play(GUNSHIP_NUKE.releaseSound);
      nuke.release(skyPoint(), here.point.toArray(), here.normal.toArray());
    }
    if (t < p.land) return false;
    explosions?.spawn('gunship.nuke', here.point.toArray(), here.normal.toArray(), cellSide);
    sfx?.play('blast_fire');
    land(p, state, c, k, 'the MK-9');
    return true;
  }

  // SOL-88: the pointer on the planned point until `land`, then the beam on the rules' tracking point
  function beam(e, t, dt, state, c, k, here) {
    const p = e.plan;
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
    if (burn(state, p, dt, c, k).tankHit) onTankHit('SOL-88');   // never: the plan spares the tank
    onBeam(p, [...p.at]);
    onBurn(p, dt);
    e.contactT += dt;
    for (const every = 1 / LASER_CONTACT_RATE; e.contactT >= every; e.contactT -= every) {
      explosions?.spawn('laser.contact', here.point.toArray(), here.normal.toArray(), cellSide);
    }
    if (solOwner === e) burnVoice ??= sfx?.loop(LASER_SOUNDS.burn) ?? null;   // loop() is null until the sample decodes
    return false;
  }

  // a plan made elsewhere joins the ones in flight and is drawn and resolved as the schedule's are (the bait mode's gunner seat makes
  // the player's with playerShot; `spares` is the schedule's, so a player's plan hits whatever `tank()` reports, a world away there)
  function adopt(plan) { pending.push({ plan, ring: null, fired: false, laid: false, contactT: 0, streamT: STREAM.every, voice: null }); return plan; }

  function tick(dt) {
    const t = now(), state = fight(), c = creature(), k = tank();
    stepGunship(gs, dt, GUNSHIP_ORBIT);
    gs.phase = 'station'; gs.left = GUNSHIP_ORBIT.station;   // on station for ever, as the gunship lab's stationForever
    stepRounds(gs);
    for (const plan of schedule(state, t, c, tuneNow(), k)) adopt(plan);
    for (let i = 0; i < pending.length; i++) {
      if (!advance(pending[i], t, dt, state, c, k)) continue;
      drop(pending[i]); pending.splice(i--, 1);
    }
    pulse += dt;
    spotMat.opacity = 0.5 + 0.35 * Math.sin(pulse * SPOT.hz * 2 * Math.PI);
    nuke.tick(dt);
    laser.tick(dt, 1);
    optic.fade(dt);
  }

  // a new round owes nothing to the old one: the plans, the spots, the rounds and the tracers in the air, the MK-9 falling, the beam and its scorch
  function reset() {
    for (const e of pending) drop(e);
    pending.length = 0; gs.rounds.length = 0;
    if (nuke.mesh()) { nuke.dispose(); nuke = makeDrop(); }
    endBurn(); laser.clear();
    optic.fade(1e6);   // every tracer to the end of its flight
  }

  function shift(sx, sz) { for (const e of pending) { e.plan.at[0] += sx; e.plan.at[1] += sz; } }

  return {
    tick, shift, reset, adopt,
    rings: () => pending.reduce((n, e) => n + (e.ring ? 1 : 0), 0),
    dispose() {
      reset();
      for (const g of spotGeo.values()) g.dispose();
      spotGeo.clear(); spotMat.dispose();
      nuke.dispose(); optic.dispose(); laser.dispose();
    },
  };
}
