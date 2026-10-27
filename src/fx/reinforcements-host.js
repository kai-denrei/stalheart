// FEIDS-26 REINFORCEMENTS, THE HOST (owner, 2026-10-23: "the goal will be to have Isao call out planetary re-inforcements after having built the
// radar, and after a few in-game days the FEIDS26 will come ... they will land at the Arena (before the boss fight.)"; spec
// docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md). The call: when the radar step is printed (perk `uplink`,
// src/fx/programme-host.js printed) Isao asks the colony (`reinforcements_called`, the callout) and story.reinforcements books the day and the
// due day (REINFORCEMENTS.days later). The drop: the rule's trigger (src/domain/reinforcements.js dropReady: a timer since round 3, 2026-10-26: at the
// due day, held only by a manned seat, a card, Isao's panel or a running shot; THE ARENA's start, or ?reinforce=1 at once; ?reinforce=0 never), the models fetched a day ahead (or at once when forced), then the scene
// (src/fx/feids-drop.js) on its own clock in a frame at the drop's centre (REINFORCEMENTS.offsetCells down the heart's field from the arena's
// cell, off the crater), Isao's `reinforcements_inbound`, and a live shot on the cinematic's camera for its 28 s, never over a manned seat or
// another shot (the drop goes on without its cut); then the four handed to the squad (host.landed(mechs, frame), src/fx/mech-squad.js).
//   host: scene, metres(), sfx, explode, startShot, snapCamera, showBrief, callout(text, cls), graph(), dungeon(), story(), daylight(),
//         sectorRun(), shotActive() (a shot or the hull's deploy: both own the camera, and the drop's cut waits for either), seated(), card(), alive(), won(), isaoBusy(), flag (the ?reinforce value), uplink() (the radar's perk stands),
//         landed(mechs, frame, centre), squad(), camera (the shot's start pose)
import * as THREE from '../../vendor/three.module.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { dropReady, dropCentre, dropPhase } from '../domain/reinforcements.js';
import { createFeidsDrop } from './feids-drop.js';
import { BLOCKED } from '../dungeon.js';

const TL = REINFORCEMENTS.timeline, LOAD_WAIT = 10, SOUND_WAIT = 3, LOOK = [11, 3.2, 5];   // seconds a triggered drop waits for its models, and for its three lazy sounds to decode, before it goes without them

export function createReinforcements(h) {
  const drop = createFeidsDrop({ scene: h.scene, metres: h.metres, sfx: h.sfx, explode: h.explode });
  const forced = h.flag === '1', disabled = h.flag === '0';
  let phase = 'idle', t = -1, waiting = -1, why = 'idle', ticks = 0, sinceDue = -1, heldFor = 0, lateBy = null, landLine = 0, frame = null, centre = -1, cut = false, cutDone = false, forceNow = false;
  // THE CUT'S LENS (the owner's ant view, 2026-10-23): the near plane lowered to shot.near and the rule's fov (eased in from the camera's) each tick
  // of the cut, the values found put back at its end, on a seat taken over it (the near only: the seat owns the fov) and on restore
  let lens = null, hint = null, cutAt = 0;
  // THE SKIP'S HINT (round 2, 2026-10-23): from the lock's end to the cut's end, the gunship briefing's footer line (its markup, its colours)
  function hintOn() {
    if (hint || typeof document === 'undefined') return;
    hint = document.createElement('div'); hint.id = 'feids-skip-hint'; hint.innerHTML = `<footer><span>${REINFORCEMENTS.shot.hint}</span></footer>`; document.body.append(hint);
  }
  function hintOff() { hint?.remove(); hint = null; }
  const lensAt = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 0 };
  function lensOn() {
    if (!h.camera || !drop.pose(Math.max(0, t), lensAt)) return;
    if (!lens) lens = { fov: h.camera.fov, near: h.camera.near };
    const k = Math.min(1, Math.max(0, t) / REINFORCEMENTS.shot.easeIn), e = k * k * (3 - 2 * k);
    h.camera.near = REINFORCEMENTS.shot.near; h.camera.fov = lens.fov + (lensAt.fov - lens.fov) * e; h.camera.updateProjectionMatrix();
  }
  function lensOff(fov = true) {
    if (!lens) return;
    h.camera.near = lens.near; if (fov) h.camera.fov = lens.fov; h.camera.updateProjectionMatrix(); lens = null;
  }
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
    cut = true; cutAt = Math.max(0, t);
    h.startShot({ id: REINFORCEMENTS.shot.id, dur: TL.duration - cutAt, skippable: true, lockFor: REINFORCEMENTS.shot.lock, skipKey: REINFORCEMENTS.shot.skipKey, onEnd: () => { cut = false; cutDone = true; hintOff(); lensOff(); h.snapCamera(); }, poseAt(u, out) {
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
    drop.tick(0); if (cut) lensOn();
    return true;
  }
  function land() {
    phase = 'landed';
    h.landed?.(drop.mechs(), frame, centre); drop.release();
    h.callout(REINFORCEMENTS.landedCallout, 'co-victory'); landLine = REINFORCEMENTS.landedWait;   // the owner's line (round 3): said when Isao's panel is free, up to landedWait s
  }

  return {
    called,
    tick(dt) {
      if (phase === 'landed' && landLine > 0) { if (!h.isaoBusy()) { landLine = 0; h.showBrief(REINFORCEMENTS.briefs.landed); } else landLine -= dt; }
      if (disabled || phase === 'landed') return;
      if (phase === 'dropping') {
        t += dt; drop.prime(); drop.tick(t); shot();
        if (cut && !h.seated()) lensOn(); else lensOff(!h.seated());
        if (cut && t - cutAt >= REINFORCEMENTS.shot.lock) hintOn(); else hintOff();
        if (t > TL.duration) land();
        return;
      }
      if (!rec() && h.uplink()) called();   // a radar standing without its print (a skipped chapter, a grown base): the call at once
      const r = rec(), d = day(), sr = h.sectorRun?.() ?? null, st = sr?.state?.().phase;
      if (forced || forceNow || (r && d >= r.due - 1)) drop.prepare();
      const cond = { forced: forced || forceNow, disabled, due: r?.due ?? null, day: d, fighting: st === 'fighting', secure: st === 'secure', breathing: !!sr?.breathing?.(),
        arena: !!sr?.defNow?.()?.boss, shot: h.shotActive(), seated: h.seated(), card: h.card(), alive: h.alive(), won: h.won(), isaoBusy: h.isaoBusy() };
      ticks++;
      // THE TIMER'S MEASURE (round 3): game seconds since the day counter crossed `due`, those of them a seat, a card or Isao's panel held it, and
      // at the drop's start the whole wait (lateBy - heldFor is the timer's own lateness: the models and the sounds)
      if (r && d >= r.due) sinceDue = sinceDue < 0 ? 0 : sinceDue + dt;
      if (!dropReady(cond)) { if (sinceDue >= 0) heldFor += dt; waiting = -1; why = cond.shot ? 'shot' : !(cond.due !== null && d >= cond.due) ? 'due' : cond.seated ? 'seat' : cond.isaoBusy ? 'brief' : cond.card ? 'card' : 'held'; return; }
      drop.prepare();   // THE ARENA before the due day's preload: fetched now, the drop going once they land (or LOAD_WAIT on)
      waiting = waiting < 0 ? 0 : waiting + dt;
      if (!drop.ready() && !drop.failed()) { why = 'loading'; if (waiting < LOAD_WAIT) return; }
      if (!drop.prime()) { why = 'sounds'; if (waiting < SOUND_WAIT) return; }   // no context yet (no gesture): it goes silent after SOUND_WAIT, the primes asked again through the drop
      if (!rec() && h.story()) h.story().reinforcements = { calledDay: d, due: d, forced: true };   // a forced drop books itself
      why = begin() ? 'begun' : 'no frame'; if (why === 'begun') lateBy = sinceDue < 0 ? null : +sinceDue.toFixed(2);
    },
    force() { forceNow = true; drop.prepare(); },
    show: (on) => { drop.show(on); h.squad?.()?.show?.(on); },
    // THE GAIT'S LOOK (the harness's frame of a walking mech, round 2): a live shot beside mech i, 3/4 front at LOOK metres (x right, up, z forward of
    // its facing), on its body; any key ends it. look(-1) or no mech: false
    look(i, { squad = h.squad?.(), offset = LOOK, height = 1.6 } = {}) {   // any frameOf() holder (the companions, 2026-10-27), its own offset and look height in metres
      const sq = squad, p = new THREE.Vector3(), q = new THREE.Quaternion(), eye = new THREE.Vector3(), at = new THREE.Vector3(), m4 = new THREE.Matrix4();
      if (!(i >= 0) || !sq?.frameOf?.(i, p, q)) return false;
      h.startShot({ id: 'mechLook', dur: 600, skippable: true, poseAt(u, out) {
        if (!sq.frameOf(i, p, q)) return;
        const m = h.metres(), up = p.clone().normalize();
        eye.set(offset[0], offset[1], offset[2]).applyQuaternion(q).multiplyScalar(m).add(p); at.copy(p).addScaledVector(up, height * m);
        m4.lookAt(eye, at, up); out.pos.copy(eye); out.quat.setFromRotationMatrix(m4);
      } });
      return true;
    },   // the harness's A/B: the capsules and the four drawn or not, the clocks running
    state: () => {
      const r = rec();
      return { called: !!r, calledDay: r?.calledDay ?? null, due: r?.due ?? null, phase, t: +Math.max(0, t).toFixed(2), clock: dropPhase(t, TL), centre, cut, cutDone, lens: lens ? { near: +h.camera.near.toFixed(6), fov: +h.camera.fov.toFixed(2) } : null, hint: !!hint, seated: h.seated(), primed: drop.primed(), loaded: drop.ready(), failed: drop.failed(),
        why, ticks, sinceDue: +sinceDue.toFixed(2), heldFor: +heldFor.toFixed(2), lateBy, heard: drop.heard(), mechs: h.squad?.()?.state?.() ?? [] };
    },
    restore() { lensOff(); hintOff(); drop.dispose(); landLine = 0; phase = 'idle'; t = -1; frame = null; cut = false; },
  };
}
