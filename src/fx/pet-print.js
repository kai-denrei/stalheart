// ISAO PRINTS A COMPANION (owner, 2026-10-30: "the robot cat should not already be on the planet when we land, let's spawn it after; include a
// skippable scene where Isao whimsically prints the cat because he wants a companion. Close up on the creation, showing various angles." / "same
// with the Cheetah later."). The order and the triggers are content (src/content/companions.js COMPANIONS.prints: C-07 first, RECKON K9 later),
// the rules are pure (src/domain/pet-print.js), the companions themselves are src/fx/companions.js ('unborn' -> 'printing' -> 'born').
// The scene: Isao taken off his queue (`isao.held`, as the missile's set piece does) comes down over a print bed on the clearing, his head
// rasters a glowing slice up the body: the unit's own fixture as a bright wireframe cut by a rising plane, its own tinted wireframe (the game's
// default look) closing up behind it a band lower; then the print fades, the unit takes its first idle, Isao goes back up and the unit walks off
// into its play. A live cut (the world runs under it) through four close angles round the bed (printCamera), five seconds mandatory then Space
// skips (src/fx/camera-shot.js lockFor / skipKey, the FEIDS-26 drop's rule and hint); a skip finishes the print at once. The camera's near plane
// is lowered for the close-up as the drop's cut does, and put back at its end. Lines are text only (src/isaobriefs.js).
//   host: scene, camera, metres(), startShot, endShot, snapCamera, showBrief, companions(), isao() (the drone's record or null), phase() (the story beat),
//         perk(id), day(), sectorRun(), shotActive(), seated(), card(), isaoBusy(), alive(), won(), slabAt(p, padM) (the raised island's top under a
//         unit point, metres, or null: src/fx/story-base.js)
//   createPetPrint(host) -> { tick(dt), force(i) (unit i printed now: false when born or printing), state(), restore() }
import * as THREE from '../../vendor/three.module.js';
import { COMPANIONS } from '../content/companions.js';
import { STORY_PHASES } from '../domain/automation.js';
import { nextPrint, printGates, printReady, printEnd, printTimeline, printCamera } from '../domain/pet-print.js';
import { loadModelFixture, cloneFixture, modelClips } from './model-fixture.js';

const P = COMPANIONS.prints, K = COMPANIONS.print, TL = K.timeline, END = printEnd(TL), UNITS = COMPANIONS.units;
const unitIndex = (id) => UNITS.findIndex((u) => u.id === id);

export function createPetPrint(h) {
  const bornDay = new Map();   // id -> the day it was born (the next trigger's `days`)
  let held = 0, forced = -1, run = null, why = 'idle', prints = 0, skips = 0, bedLeft = null, hint = null, lens = null, last = null;
  const v = new THREE.Vector3(), w = new THREE.Vector3(), q = new THREE.Quaternion(), tmp = new THREE.Object3D();
  const day = () => h.day?.() ?? 0;

  function hintOn() { if (hint || typeof document === 'undefined') return; hint = document.createElement('div'); hint.id = 'pet-skip-hint'; hint.innerHTML = `<footer><span>${K.shot.hint}</span></footer>`; document.body.append(hint); }
  function hintOff() { hint?.remove(); hint = null; }
  function lensOn(fov) { if (!lens) lens = { fov: h.camera.fov, near: h.camera.near }; h.camera.near = K.shot.near; h.camera.fov = fov; h.camera.updateProjectionMatrix(); }
  function lensOff() { if (!lens) return; h.camera.near = lens.near; h.camera.fov = lens.fov; h.camera.updateProjectionMatrix(); lens = null; }

  // a bed-metre point (x right of the facing, y up, z the facing) in world units
  const at = (r, p, out) => out.copy(r.origin).addScaledVector(r.x, p[0] * r.m).addScaledVector(r.up, p[1] * r.m).addScaledVector(r.z, p[2] * r.m);
  const cutAt = (r, plane, share) => plane.setFromNormalAndCoplanarPoint(w.copy(r.up).negate(), at(r, [0, -0.02 + share * (r.box.h + 0.04), 0], v));

  function makeBed(r) {
    const g = new THREE.Group(), R = K.bedM, c = K.colour;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 0.05, 48), new THREE.MeshStandardMaterial({ color: 0x1b232a, roughness: 0.55, metalness: 0.6, transparent: true }));
    disc.position.y = 0.005; g.add(disc);
    const glow = (r0, r1, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.035; g.add(m); return m; };
    r.rims = [glow(R * 0.93, R, 0.9), glow(R * 0.6, R * 0.62, 0.45), glow(R * 0.3, R * 0.31, 0.35)];
    g.position.copy(r.origin); g.quaternion.copy(r.quat); g.scale.setScalar(r.m);
    h.scene.add(g); return g;
  }
  // the print: the unit's fixture again, a bright wireframe held at its idle's first frame, cut by the rising plane
  function makeGhost(r, def) {
    loadModelFixture(def.model).then((scene) => {
      if (run !== r || r.done) return;
      const g = cloneFixture(scene);
      g.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: K.colour, wireframe: true, transparent: true, opacity: 0.9, depthWrite: false, clippingPlanes: [r.ghostPlane] }); o.frustumCulled = false; } });
      const clip = modelClips(def.model).find((c) => c.name === def.idle);
      if (clip) { r.ghostMixer = new THREE.AnimationMixer(g); r.ghostMixer.clipAction(clip).play(); r.ghostMixer.update(0); }
      r.ghost = g; r.bed.add(g);
    }, () => {});
  }
  // the unit's own wireframe, revealed by the second plane a band lower; its materials cloned (a fixture's are shared) and handed back at the end
  function clipSkin(r, root) {
    root?.traverse((o) => {
      if (!o.isMesh) return;
      const was = o.material, list = Array.isArray(was) ? was : [was], cl = list.map((m) => { const c = m.clone(); c.clippingPlanes = [r.skinPlane]; return c; });
      r.skin.push([o, was, cl]); o.material = Array.isArray(was) ? cl : cl[0];
    });
  }
  function unclipSkin(r) { for (const [o, was, cl] of r.skin) { if (o.material === cl[0] || o.material === cl) o.material = was; for (const c of cl) c.dispose(); } r.skin.length = 0; }

  // the bed on the bare floor: the best candidate whose plot and the close angles' ring (clear metres out) stand off every raised slab
  function pickSpot(c) {
    const cand = c.spots(K.spotCells, K.bedM + 0.8);
    for (const clear of K.slabClear) { const hit = cand.find((x) => h.slabAt(x.p, K.bedM + clear) == null); if (hit) return hit.ci; }
    return cand[0]?.ci ?? -1;
  }
  function begin(i, k) {
    const c = h.companions(), def = UNITS[i];
    const ci = pickSpot(c);
    if (!c.print(i, ci)) return false;
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    c.frameOf(i, pos, quat);
    const r = { i, k, id: def.id, t: 0, cell: ci, done: false, cut: false, cutDone: false, woke: false, said: false, skipped: false, m: h.metres(), origin: pos.clone(), up: pos.clone().normalize(), quat,
      x: new THREE.Vector3(1, 0, 0).applyQuaternion(quat), z: new THREE.Vector3(0, 0, 1).applyQuaternion(quat), ghostPlane: new THREE.Plane(), skinPlane: new THREE.Plane(), skin: [], ghost: null, ghostMixer: null, isao: null, angle: -1 };
    // the body's measure at its first frame, metres (the slice's height, the sheet's size and the camera's scale)
    const root = c.roots()[i], b = new THREE.Box3();
    if (root) { const keep = [root.parent, root.position.clone(), root.quaternion.clone(), root.scale.clone()]; root.parent?.remove(root); root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); root.updateMatrixWorld(true); b.setFromObject(root); keep[0]?.add(root); root.position.copy(keep[1]); root.quaternion.copy(keep[2]); root.scale.copy(keep[3]); }
    const sz = b.isEmpty() ? new THREE.Vector3(0.5, 0.9, 2) : b.getSize(new THREE.Vector3());
    r.box = { w: sz.x, h: Math.max(0.3, b.isEmpty() ? 0.9 : b.max.y), l: sz.z, zc: b.isEmpty() ? 0 : (b.min.z + b.max.z) / 2 };
    r.size = Math.max(0.55, Math.min(1.2, r.box.l / K.refLength));
    run = r;
    r.bed = makeBed(r); makeGhost(r, def); clipSkin(r, root);
    cutAt(r, r.ghostPlane, 0); cutAt(r, r.skinPlane, 0);
    // the slice: a glowing sheet at the cut, the head's layer
    r.slice = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: K.colour, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    r.slice.rotation.x = -Math.PI / 2; r.slice.scale.set(r.box.w * 1.3, r.box.l * 1.05, 1); r.slice.position.z = r.box.zc; r.slice.visible = false; r.bed.add(r.slice);
    // the beam: the nozzle to the head's point on the slice
    r.beam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: K.colour, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.beam.frustumCulled = false; r.beam.visible = false; h.scene.add(r.beam);
    // Isao off his queue for the scene (a set piece's hold: his work waits, his face and rotors keep running)
    const is = h.isao?.();
    if (is?.obj && !is.held) {
      is.held = true; r.isao = { rec: is, from: is.obj.position.clone(), quat: is.obj.quaternion.clone(), state: is.state };
      // his height and his foot in his own frame (up his +Y, as he flies), metres: he hovers with his foot hoverM over the bed
      const o = is.obj, P0 = o.position.clone(), Q0 = o.quaternion.clone(); o.position.set(0, 0, 0); o.quaternion.identity(); o.updateMatrixWorld(true);
      const ib = new THREE.Box3().setFromObject(o); o.position.copy(P0); o.quaternion.copy(Q0); o.updateMatrixWorld(true);
      r.isao.foot = ib.isEmpty() ? -2 : ib.min.y / r.m; r.isao.tall = ib.isEmpty() ? 4 : (ib.max.y - ib.min.y) / r.m;
    }
    const tr = P.triggers[k]; if (tr?.brief) h.showBrief(tr.brief);
    shot(r);
    step(0);
    return true;
  }
  function shot(r) {
    r.cut = true;
    const eye = new THREE.Vector3(), look = new THREE.Vector3(), m4 = new THREE.Matrix4();
    h.startShot({ id: K.shot.id, dur: END + 1, skippable: true, lockFor: K.shot.lock, skipKey: K.shot.skipKey, onEnd: () => { r.cut = false; r.cutDone = true; hintOff(); lensOff(); if (!r.done) { r.skipped = true; skips++; finish(r); } h.snapCamera(); }, poseAt(u, out) {
      if (r.done) return;
      const cam = printCamera(r.t, K.angles, r.size);
      at(r, cam.eye, eye); at(r, cam.look, look); m4.lookAt(eye, look, r.up);
      out.pos.copy(eye); out.quat.setFromRotationMatrix(m4);
    } });
  }
  function poseIsao(r, s) {
    const I = r.isao; if (!I) return;
    const hover = at(r, [Math.sin(r.t * 0.9) * 0.25, r.box.h + K.hoverM - I.foot + Math.sin(r.t * 2.1) * 0.12, r.box.zc], v.clone());
    I.rec.obj.position.lerpVectors(I.from, hover, s.isao);
    tmp.position.copy(I.rec.obj.position); tmp.up.copy(r.up); tmp.lookAt(w.copy(I.rec.obj.position).addScaledVector(r.z, r.m * 4).addScaledVector(r.up, -r.m * 1.2 * s.isao));
    I.rec.obj.quaternion.slerpQuaternions(I.quat, tmp.quaternion, Math.min(1, s.isao * 1.5));
  }
  function step(dt) {
    const r = run; if (!r || r.done) return;
    r.t += dt;
    const s = printTimeline(r.t, TL, K.band), c = h.companions();
    cutAt(r, r.ghostPlane, s.ghost); cutAt(r, r.skinPlane, s.skin);
    if (r.ghost) { r.ghost.visible = s.fade > 0.01; r.ghost.traverse((o) => { if (o.isMesh) o.material.opacity = 0.9 * s.fade; }); }
    r.slice.visible = s.beam; r.slice.position.y = s.slice * r.box.h; r.slice.material.opacity = 0.14 + 0.1 * Math.abs(Math.sin(r.t * 9));
    r.rims[0].material.opacity = 0.5 + 0.4 * Math.abs(Math.sin(r.t * (s.beam ? 4 : 1.5)));
    poseIsao(r, s);
    // the head rasters across the slice and lifts between strokes (a printer, not a laser: src/printpath.js's lesson)
    r.beam.visible = s.beam && Math.sin(r.t * 13) > -0.55 && !!r.isao;
    if (r.beam.visible) {
      const noz = r.isao.rec.obj.userData.nozzle, pa = r.beam.geometry.attributes.position;
      if (noz) noz.getWorldPosition(v); else v.copy(r.isao.rec.obj.position);
      pa.setXYZ(0, v.x, v.y, v.z);
      at(r, [Math.sin(r.t * 7.3) * r.box.w * 0.45, s.slice * r.box.h, r.box.zc + ((r.t * 0.85) % 1 * 2 - 1) * r.box.l * 0.48], w);
      pa.setXYZ(1, w.x, w.y, w.z); pa.needsUpdate = true; r.beam.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(r.t * 21));
    }
    if (!s.still && !r.woke) { r.woke = true; c?.wake(r.i); }
    if (s.phase === 'wake' && !r.said) { r.said = true; h.showBrief(UNITS[r.i].born); }
    if (r.cut) {
      const a = printCamera(r.t, K.angles, r.size).angle; lensOn(K.angles[a].fov); if (r.t >= K.shot.lock) hintOn();
      if (a !== r.angle) { r.angle = a; if (dt > 0) h.snapCamera(); }   // a cut, not the game camera's glide
    }
    if (r.t >= END) finish(r);
  }
  // the print done (its end, or a skip): the unit born and in its play, the print and the beam gone, the bed fading, Isao back to his work
  function finish(r) {
    if (r.done) return;
    r.done = true;
    const c = h.companions();
    c?.wake(r.i); c?.birth(r.i); bornDay.set(r.id, day()); prints++;
    if (!r.said) { r.said = true; h.showBrief(UNITS[r.i].born); }
    unclipSkin(r);
    r.ghostMixer?.stopAllAction(); if (r.ghost) r.bed.remove(r.ghost);
    r.slice.visible = false; h.scene.remove(r.beam); r.beam.geometry.dispose();
    if (r.isao) { const rec = r.isao.rec; rec.held = false; if (rec.state !== 'build') rec.dir = rec.obj.position.clone().normalize().toArray(); }
    bedLeft = { g: r.bed, t: 1.5 };
    if (r.cut) h.endShot();   // the print's own end ends its cut (onEnd: the lens back, the game's camera)
    last = { id: r.id, t: +r.t.toFixed(2), skipped: r.skipped, cell: r.cell, angle: r.angle };
    run = null; forced = -1; held = 0; why = 'born';
  }
  function fadeBed(dt) {
    if (!bedLeft) return;
    bedLeft.t -= dt;
    const k = Math.max(0, bedLeft.t / 1.5);
    bedLeft.g.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = (o.material.userData.op ??= o.material.opacity) * k; } });
    if (bedLeft.t <= 0) { h.scene.remove(bedLeft.g); bedLeft.g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); bedLeft = null; }
  }

  return {
    tick(dt) {
      fadeBed(dt);
      const c = h.companions(); if (!c) return;
      if (run) { step(dt); return; }
      if (forced >= 0 && c.life(forced) !== 'unborn') forced = -1;   // born meanwhile (its own trigger): nothing left to force
      const born = c.born(), id = forced >= 0 ? UNITS[forced].id : nextPrint(P.order, born);
      if (!id) { why = 'all born'; return; }
      const i = unitIndex(id), k = Math.max(0, P.order.indexOf(id)), tr = P.triggers[k];
      if (i < 0 || !tr) { why = 'no trigger'; return; }
      const prev = k > 0 ? P.order[k - 1] : null, prevDay = prev ? (bornDay.get(prev) ?? (born.includes(prev) ? day() - (tr.days ?? 0) : null)) : null;
      const gates = printGates(tr, { phase: h.phase?.() ?? null, phases: STORY_PHASES, perk: (p) => !!h.perk(p), day: day(), prevDay });
      held = gates ? held + dt : 0;
      const sr = h.sectorRun?.() ?? null, st = sr?.state?.().phase;
      const cond = { forced: forced >= 0, shot: h.shotActive(), gates, held, delay: tr.delay ?? 0, patience: tr.patience ?? Infinity, alive: h.alive(), won: h.won(), arena: !!sr?.defNow?.()?.boss,
        seated: h.seated(), card: h.card(), isaoBusy: h.isaoBusy(), fighting: st === 'fighting', breathing: !!sr?.breathing?.() };
      if (!printReady(cond)) { why = cond.shot ? 'shot' : forced >= 0 ? 'forced' : !gates ? 'gates' : held < cond.delay ? 'delay' : cond.seated ? 'seat' : cond.card ? 'card' : cond.isaoBusy ? 'brief' : cond.fighting ? 'fight' : 'held'; return; }
      if (!c.loaded(i)) { why = 'loading'; return; }
      why = begin(i, k) ? 'printing' : 'no spot';
    },
    force(i) {
      const c = h.companions(); if (!c || !UNITS[i] || c.life(i) !== 'unborn' || run) return false;
      forced = i; return true;
    },
    state: () => ({ why, held: +held.toFixed(1), forced, prints, skips, printing: run ? { id: run.id, t: +run.t.toFixed(2), phase: printTimeline(run.t, TL, K.band).phase, angle: run.angle, cut: run.cut, cell: run.cell, isao: !!run.isao, ghost: !!run.ghost, size: +run.size.toFixed(2), box: Object.fromEntries(Object.entries(run.box).map(([k, x]) => [k, +x.toFixed(2)])),
      eyeM: +(h.camera.position.distanceTo(run.origin) / run.m).toFixed(2), eyeUp: +(h.camera.position.clone().sub(run.origin).dot(run.up) / run.m).toFixed(2), fov: +h.camera.fov.toFixed(1), isaoM: run.isao ? [+run.isao.foot.toFixed(2), +run.isao.tall.toFixed(2), +(run.isao.rec.obj.position.clone().sub(run.origin).dot(run.up) / run.m).toFixed(2)] : null } : null,
      last, bornDay: Object.fromEntries(bornDay), lens: lens ? { near: h.camera.near, fov: h.camera.fov } : null, hint: !!hint, end: END }),
    restore() {
      if (run) { const r = run; r.done = true; unclipSkin(r); h.scene.remove(r.bed); h.scene.remove(r.beam); if (r.isao) r.isao.rec.held = false; run = null; }
      if (bedLeft) { h.scene.remove(bedLeft.g); bedLeft = null; }
      hintOff(); lensOff();
    },
  };
}
