// FEIDS-26 REINFORCEMENTS, THE HOST (owner, 2026-10-23: "the goal will be to have Isao call out planetary re-inforcements after having built the
// radar, and after a few in-game days the FEIDS26 will come ... they will land at the Arena (before the boss fight.)"; spec
// docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md). The call: when the radar step is printed (perk `uplink`,
// src/fx/programme-host.js printed) Isao asks the colony (`reinforcements_called`, the callout) and story.reinforcements books the day and the
// due day (REINFORCEMENTS.days later). The drop: the rule's trigger (src/domain/reinforcements.js dropReady: the first lull after the due day,
// THE ARENA's start, or ?reinforce=1 at once; ?reinforce=0 never), the models fetched a day ahead (or at once when forced), then the scene
// (src/fx/feids-drop.js) on its own clock in a frame at the drop's centre (REINFORCEMENTS.offsetCells down the heart's field from the arena's
// cell, off the crater), Isao's `reinforcements_inbound`, and a live shot on the cinematic's camera for its 28 s, never over a manned seat or
// another shot (the drop goes on without its cut); then the four handed to the squad (host.landed(mechs, frame), src/fx/mech-squad.js).
//   host: scene, metres(), sfx, explode, startShot, snapCamera, showBrief, callout(text, cls), graph(), dungeon(), story(), daylight(),
//         sectorRun(), shotActive(), seated(), card(), alive(), won(), isaoBusy(), flag (the ?reinforce value), uplink() (the radar's perk stands),
//         landed(mechs, frame, centre), squad(), camera (the shot's start pose)
import * as THREE from '../../vendor/three.module.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { dropReady, dropCentre, dropPhase } from '../domain/reinforcements.js';
import { createFeidsDrop } from './feids-drop.js';
import { BLOCKED } from '../dungeon.js';

const TL = REINFORCEMENTS.timeline, LOAD_WAIT = 10, SOUND_WAIT = 3;   // seconds a triggered drop waits for its models, and for its three lazy sounds to decode, before it goes without them

export function createReinforcements(h) {
  const drop = createFeidsDrop({ scene: h.scene, metres: h.metres, sfx: h.sfx, explode: h.explode });
  const forced = h.flag === '1', disabled = h.flag === '0';
  let phase = 'idle', t = -1, waiting = -1, why = 'idle', ticks = 0, frame = null, centre = -1, cut = false, cutDone = false, forceNow = false;
  if (forced) drop.prepare();   // ?reinforce=1: the models on their way with the world, so the drop can go the moment it stands

  const rec = () => h.story()?.reinforcements ?? null;
  const day = () => h.daylight()?.day?.() ?? 0;
  function called() {
    const s = h.story(); if (!s || s.reinforcements || disabled) return false;
    const d = day(); s.reinforcements = { calledDay: d, due: d + REINFORCEMENTS.days };
    h.showBrief(REINFORCEMENTS.briefs.called); h.callout(REINFORCEMENTS.callout, 'co-victory-sub');
    return true;
  }
  // the frame at the drop's centre: on the floor, up the planet's normal, z toward the heart, x = up x z
  function frameAt() {
    const s = h.story(), g = h.graph(), dg = h.dungeon(), arena = s?.arena?.cell ?? -1;
    if (!(arena >= 0) || !g || !dg) return null;
    centre = dropCentre({ adj: g.adj, dist: dg.distToHeart, from: arena, hops: REINFORCEMENTS.offsetCells, open: (ci) => dg.tags[ci] !== BLOCKED });
    if (!(centre >= 0)) return null;
    const up = new THREE.Vector3(...g.centers[centre]).normalize(), origin = up.clone();   // the floor is the unit sphere
    const heart = new THREE.Vector3(...g.centers[dg.heart]), z = heart.sub(origin); z.addScaledVector(up, -z.dot(up));
    if (z.lengthSq() < 1e-12) z.set(1, 0, 0).addScaledVector(up, -up.x);
    z.normalize();
    return { origin, up, z, x: new THREE.Vector3().crossVectors(up, z).normalize() };
  }
  // the cut, asked at the start and again each tick of the drop until it runs (a seat or another shot holds it; a skipped cut stays skipped)
  function shot() {
    if (cutDone || cut || h.seated() || h.shotActive() || t > TL.duration - 2) return;
    const start = { pos: h.camera.position.clone(), quat: h.camera.quaternion.clone() }, at = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    cut = true;
    h.startShot({ id: REINFORCEMENTS.shot.id, dur: TL.duration - Math.max(0, t), skippable: true, onEnd: () => { cut = false; cutDone = true; h.snapCamera(); }, poseAt(u, out) {
      if (!drop.pose(Math.max(0, t), at)) return;
      const k = Math.min(1, Math.max(0, t) / REINFORCEMENTS.shot.easeIn), e = k * k * (3 - 2 * k);
      out.pos.lerpVectors(start.pos, at.pos, e); out.quat.slerpQuaternions(start.quat, at.quat, e);
    } });
  }
  function begin() {
    frame = frameAt(); if (!frame) return false;
    drop.begin(frame); phase = 'dropping'; t = 0; cut = false; cutDone = false;
    h.showBrief(REINFORCEMENTS.briefs.inbound);
    shot();
    drop.tick(0);
    return true;
  }
  function land() {
    phase = 'landed';
    h.landed?.(drop.mechs(), frame, centre); drop.release();
    h.callout(REINFORCEMENTS.landedCallout, 'co-victory'); if (!h.isaoBusy()) h.showBrief(REINFORCEMENTS.briefs.landed);
  }

  return {
    called,
    tick(dt) {
      if (disabled || phase === 'landed') return;
      if (phase === 'dropping') {
        t += dt; drop.prime(); drop.tick(t); shot();
        if (t > TL.duration) land();
        return;
      }
      if (!rec() && h.uplink()) called();   // a radar standing without its print (a skipped chapter, a grown base): the call at once
      const r = rec(), d = day(), sr = h.sectorRun?.() ?? null, st = sr?.state?.().phase;
      if (forced || forceNow || (r && d >= r.due - 1)) drop.prepare();
      const cond = { forced: forced || forceNow, disabled, due: r?.due ?? null, day: d, fighting: st === 'fighting', secure: st === 'secure', breathing: !!sr?.breathing?.(),
        arena: !!sr?.defNow?.()?.boss, shot: h.shotActive(), seated: h.seated(), card: h.card(), alive: h.alive(), won: h.won(), isaoBusy: h.isaoBusy() };
      ticks++;
      if (!dropReady(cond)) { waiting = -1; why = cond.shot ? 'shot' : 'lull'; return; }
      drop.prepare();   // THE ARENA before the due day's preload: fetched now, the drop going once they land (or LOAD_WAIT on)
      waiting = waiting < 0 ? 0 : waiting + dt;
      if (!drop.ready() && !drop.failed()) { why = 'loading'; if (waiting < LOAD_WAIT) return; }
      if (!drop.prime()) { why = 'sounds'; if (waiting < SOUND_WAIT) return; }   // no context yet (no gesture): it goes silent after SOUND_WAIT, the primes asked again through the drop
      if (!rec() && h.story()) h.story().reinforcements = { calledDay: d, due: d, forced: true };   // a forced drop books itself
      why = begin() ? 'begun' : 'no frame';
    },
    force() { forceNow = true; drop.prepare(); },
    show: (on) => { drop.show(on); h.squad?.()?.show?.(on); },   // the harness's A/B: the capsules and the four drawn or not, the clocks running
    state: () => {
      const r = rec();
      return { called: !!r, calledDay: r?.calledDay ?? null, due: r?.due ?? null, phase, t: +Math.max(0, t).toFixed(2), clock: dropPhase(t, TL), centre, cut, cutDone, seated: h.seated(), primed: drop.primed(), loaded: drop.ready(), failed: drop.failed(),
        why, ticks, heard: drop.heard(), mechs: h.squad?.()?.state?.() ?? [] };
    },
    restore() { drop.dispose(); phase = 'idle'; t = -1; frame = null; cut = false; },
  };
}
