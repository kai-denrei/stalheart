// THE CARGO (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3: pickups that are seen and heard). Our flag goes up
// over a cleared landing site, the part's crate swings onto the MÖRK's back deck and rides there on a damped spring, drops off
// the back at home with two bounces and a thud, or tumbles off a lost hull; a small trophy flag goes up at home per part.
// Presentation only: the host owns the rules (src/domain/expeditions.js), the sphere and the clock, and says where things go
// in world units. Works without a document (Node tests): nothing is fetched, the timings and states still run.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { CARGO_ASSETS, CARGO_TINTS, CARGO_CRATE_TINTS, CARGO_LOOK, CARGO_CUES } from '../content/cargo.js';

const browser = typeof document !== 'undefined';
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);

// a world basis with +Y on the normal and +Z along `facing` flattened onto the ground (any tangent when facing is missing)
function basis(normal, facing, out = new THREE.Quaternion()) {
  const up = normal.clone().normalize();
  let f = facing ? facing.clone().addScaledVector(up, -facing.dot(up)) : new THREE.Vector3();
  if (f.lengthSq() < 1e-10) f = new THREE.Vector3().crossVectors(Math.abs(up.y) < 0.9 ? Y : X, up);
  f.normalize();
  const right = new THREE.Vector3().crossVectors(up, f).normalize();
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, f));
}
const vec = (a) => (a?.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

// THE BACK DECK, FROM THE HULL ITSELF. The MÖRK carries no deck socket (SOCKET_SERVICE is a low towing point), so the deck is
// read off the geometry once per hull, in hull-local space: five rays straight down onto the crate's footprint in the rear of the
// hull, the highest hit wins; the turret (it yaws) and the lift field (not a surface) are not deck.
export function deckOf(hull, inset = CARGO_LOOK.deckInset) {
  hull.updateWorldMatrix(true, true);
  const inv = hull.matrixWorld.clone().invert(), m = new THREE.Matrix4(), p = new THREE.Vector3();
  const box = new THREE.Box3(), meshes = [];
  const skip = (o) => { for (let a = o; a && a !== hull; a = a.parent) if (/^TURRET_YAW/.test(a.name)) return true; return false; };
  hull.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position || skip(o)) return;
    if ([o.material].flat().some((mt) => mt?.transparent || /Lift field/.test(mt?.name ?? ''))) return;
    meshes.push(o); m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 6000));
    for (let i = 0; i < pos.count; i += step) box.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m));
  });
  if (box.isEmpty()) return { point: new THREE.Vector3(0, 0.5, -0.3), bottom: 0, length: 1 };
  const len = box.max.z - box.min.z, wide = box.max.x - box.min.x, z = box.min.z + len * inset;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0).transformDirection(hull.matrixWorld);
  let top = -Infinity;
  for (const [dx, dz] of [[0, 0], [-0.12, 0], [0.12, 0], [0, -0.06], [0, 0.06]]) {
    ray.set(new THREE.Vector3(dx * wide, box.max.y + 1, z + dz * len).applyMatrix4(hull.matrixWorld), down);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) top = Math.max(top, p.copy(hit.point).applyMatrix4(inv).y);
  }
  if (!Number.isFinite(top)) top = box.min.y + (box.max.y - box.min.y) * 0.6;
  return { point: new THREE.Vector3(0, top, z), bottom: box.min.y, length: len };
}

export function createCargo(scene, { loader = null, sfx = null, hasCue = null, metres = 1, look = CARGO_LOOK, assets = CARGO_ASSETS, tints = CARGO_TINTS, cues = CARGO_CUES } = {}) {
  const gltf = loader ?? new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const group = new THREE.Group(); group.name = 'Cargo'; scene.add(group);
  const errors = [], flags = new Map(), trophies = [], crates = [], decks = new WeakMap();
  let flagBytes = null, crateModel = null, disposed = false, seq = 0;
  const cue = (key, o) => { if (!sfx) return; sfx.play(hasCue && !hasCue(cues[key]) ? cues.fallback : cues[key], o); };
  const crateScale = () => (metres * look.crateSpan) / look.crateSource;

  const ready = browser ? Promise.all([
    new THREE.FileLoader().setResponseType('arraybuffer').loadAsync(assets.flag).then((b) => { flagBytes = b; }),
    gltf.loadAsync(assets.crate).then((g) => { crateModel = g.scene; crateModel.traverse((o) => { for (const mt of o.isMesh ? [o.material].flat() : []) { const t = CARGO_CRATE_TINTS[mt?.name]; if (t) { mt.color.setHex(t.color); mt.emissive?.setHex(t.emissive); } } }); }),
  ]).then(() => { if (disposed) return; for (const f of [...flags.values(), ...trophies]) build(f); for (const c of crates) dress(c); }).catch((e) => { errors.push(String(e)); }) : Promise.resolve();

  // ---- flags: one parse per instance (the cloth is skinned and vendor/ has no SkeletonUtils), recoloured by material name
  function tint(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;   // a skinned cloth keeps its bind-pose bounds: culled while it flies
      for (const mt of [o.material].flat()) { const t = tints[mt?.name]; if (!t) continue; mt.color.setHex(t.color); if (t.emissive != null) { mt.emissive.setHex(t.emissive); mt.emissiveIntensity = 1; } }
    });
  }
  function build(f) {
    if (!flagBytes || f.root || f.building || f.gone) return;
    f.building = true;
    gltf.parseAsync(flagBytes, '').then((g) => {
      if (f.gone || disposed) { release(g.scene); return; }
      tint(g.scene); f.root = g.scene; f.holder.add(g.scene);
      f.mixer = new THREE.AnimationMixer(g.scene);
      const act = (name, once) => { const clip = g.animations.find((a) => a.name === name); if (!clip) return null; const a = f.mixer.clipAction(clip); if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } return a; };
      f.actions = { Raise: act('Raise', true), Lower: act('Lower', true), Flutter: act('Flutter', false) };
      play(f, f.state === 'up' ? 'Flutter' : f.state === 'raising' ? 'Raise' : 'Lower', 0, f.t);
    }).catch((e) => { errors.push(String(e)); });
  }
  function play(f, name, fade = 0.3, at = 0) {
    const next = f.actions?.[name]; if (!next) return;
    next.reset(); next.time = Math.min(at, next.getClip().duration); next.play();
    if (f.current && f.current !== next && fade > 0) f.current.crossFadeTo(next, fade, false); else if (f.current && f.current !== next) f.current.stop();
    f.current = next;
  }
  function makeFlag(point, normal, facing, scale) {
    const holder = new THREE.Group(); holder.position.copy(vec(point)); basis(vec(normal), facing ? vec(facing) : null, holder.quaternion);
    holder.scale.setScalar(metres * scale); group.add(holder);
    const f = { holder, root: null, mixer: null, actions: null, current: null, state: 'raising', t: 0, gone: false };
    build(f);
    return f;
  }
  function dropFlag(f) { f.gone = true; f.mixer?.stopAllAction(); group.remove(f.holder); if (f.root) release(f.root); }

  // ---- crates: clones of one loaded crate share its geometry; a fading crate gets its own materials and frees them
  function dress(c) { if (!crateModel || c.model) return; c.model = crateModel.clone(true); c.obj.add(c.model); if (c.fading) ownMaterials(c); }
  function ownMaterials(c) {
    if (c.owned) return; c.owned = [];
    c.model?.traverse((o) => { if (!o.isMesh) return; o.material = [o.material].flat().map((mt) => { const k = mt.clone(); k.transparent = true; c.owned.push(k); return k; }); if (o.material.length === 1) o.material = o.material[0]; });
  }
  function makeCrate(point, normal, facing) {
    const obj = new THREE.Group(); obj.name = 'Cargo crate'; obj.position.copy(vec(point)); basis(vec(normal), facing ? vec(facing) : null, obj.quaternion);
    obj.scale.setScalar(crateScale()); group.add(obj);
    const c = { obj, model: null, phase: 'site', t: 0, id: null, vel: new THREE.Vector3(), spin: new THREE.Vector3(), up: vec(normal).normalize(), plane: null, bounces: 0, sway: { p: 0, r: 0, vp: 0, vr: 0 }, last: null, lastVel: null, owned: null, fading: false, seq: seq++ };
    crates.push(c); dress(c);
    return c;
  }
  function removeCrate(c) { c.obj.removeFromParent(); for (const m of c.owned ?? []) m.dispose(); c.phase = 'gone'; crates.splice(crates.indexOf(c), 1); }
  const hullOf = (c) => (typeof c.hull === 'function' ? c.hull() : c.hull);
  function deck(hull) { let d = decks.get(hull); if (!d) { d = deckOf(hull, look.deckInset); decks.set(hull, d); } return d; }
  function deckPose(hull, pos, quat) {
    hull.updateWorldMatrix(true, false);
    pos.copy(deck(hull).point).applyMatrix4(hull.matrixWorld);
    hull.getWorldQuaternion(quat);
    return pos;
  }
  const riding = () => crates.find((c) => c.phase === 'lift' || c.phase === 'ride') ?? null;

  const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  function stepCrate(c, dt) {
    c.t += dt;
    const hull = hullOf(c);
    if (c.phase === 'lift' || c.phase === 'ride') {
      if (!hull) { c.phase = 'rest'; c.t = 0; return; }
      deckPose(hull, tmpP, tmpQ);
      if (c.phase === 'lift') {
        const u = Math.min(1, c.t / look.lift), e = u * u * (3 - 2 * u);
        c.obj.position.lerpVectors(c.from, tmpP, e).addScaledVector(c.up, Math.sin(Math.PI * u) * look.liftArc * metres);
        c.obj.quaternion.slerpQuaternions(c.fromQ, tmpQ, e);
        if (u >= 1) { c.phase = 'ride'; c.t = 0; c.last = null; cue('clunk', { rate: 1.45, gain: 0.45 }); }
        return;
      }
      // the sway: pitch from the hull's fore-aft acceleration, roll from its sideways acceleration (a turn), on a damped spring
      const sw = look.sway, pos = tmpA.setFromMatrixPosition(hull.matrixWorld);
      if (dt > 0) {
        if (c.last && pos.distanceTo(c.last) < 30 * metres) {
          const v = tmpB.copy(pos).sub(c.last).divideScalar(dt * metres);
          if (c.lastVel) {
            const acc = v.clone().sub(c.lastVel).divideScalar(dt);
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(tmpQ), right = new THREE.Vector3(1, 0, 0).applyQuaternion(tmpQ);
            const tp = THREE.MathUtils.clamp(-acc.dot(fwd) * sw.gain, -sw.max, sw.max), tr = THREE.MathUtils.clamp(acc.dot(right) * sw.gain, -sw.max, sw.max);
            c.sway.vp += (sw.k * (tp - c.sway.p) - sw.damp * c.sway.vp) * dt; c.sway.p += c.sway.vp * dt;
            c.sway.vr += (sw.k * (tr - c.sway.r) - sw.damp * c.sway.vr) * dt; c.sway.r += c.sway.vr * dt;
          }
          c.lastVel = v.clone();
        } else { c.lastVel = null; c.sway.vp = c.sway.vr = 0; }   // a jump (a deploy, a test teleport) is not an acceleration
        c.last = pos.clone();
      }
      c.obj.position.copy(tmpP);
      c.obj.quaternion.copy(tmpQ).multiply(new THREE.Quaternion().setFromEuler(tmpE.set(c.sway.p, 0, c.sway.r)));
      c.obj.scale.setScalar(crateScale());
      return;
    }
    if (c.phase === 'slide') {
      const u = Math.min(1, c.t / look.slide);
      c.obj.position.copy(c.from).addScaledVector(c.back, c.slideDist * u * u);
      c.obj.quaternion.copy(c.fromQ).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.35 * u * u));   // the nose lifts as it tips off
      if (u >= 1) { c.phase = 'fall'; c.t = 0; c.vel.copy(c.back).multiplyScalar((2 * c.slideDist) / look.slide); }
      return;
    }
    if (c.phase === 'fall' || c.phase === 'tumble') {
      c.vel.addScaledVector(c.up, -look.gravity * metres * dt);
      c.obj.position.addScaledVector(c.vel, dt);
      if (c.spin.lengthSq() > 0) { c.obj.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tmpA.copy(c.spin).normalize(), c.spin.length() * dt)); c.spin.multiplyScalar(Math.exp(-1.2 * dt)); }
      const h = tmpB.copy(c.obj.position).sub(c.plane).dot(c.up), vUp = c.vel.dot(c.up);
      if (h <= 0 && vUp < 0) {
        c.obj.position.addScaledVector(c.up, -h);
        const n = ++c.bounces;
        if (n === 1) c.onLanded?.();
        cue('thud', { gain: Math.max(0.25, 1 - 0.35 * (n - 1)), rate: 0.9 + 0.08 * n });
        if (n > look.bounces) { c.vel.set(0, 0, 0); c.spin.multiplyScalar(0); c.phase = c.phase === 'tumble' ? 'fade' : 'settle'; c.t = 0; c.restQ = basis(c.up, new THREE.Vector3(0, 0, 1).applyQuaternion(c.obj.quaternion)); return; }
        c.vel.addScaledVector(c.up, -vUp * (1 + look.bounce)).multiplyScalar(0.6);
        c.spin.multiplyScalar(0.5);
      }
      if (c.phase === 'tumble' && c.t > look.tumble + 2) { c.phase = 'fade'; c.t = 0; }
      return;
    }
    if (c.phase === 'settle') { c.obj.quaternion.slerp(c.restQ, Math.min(1, dt * 10)); if (c.t > 0.3) { c.obj.quaternion.copy(c.restQ); c.phase = 'rest'; c.t = 0; } return; }
    if (c.phase === 'rest') { if (c.t > look.linger) { c.phase = 'sink'; c.t = 0; } return; }
    if (c.phase === 'sink' || c.phase === 'fade') {
      if (!c.fading) { c.fading = true; ownMaterials(c); c.sinkFrom = c.obj.position.clone(); }
      const dur = c.phase === 'sink' ? look.sink : 0.6, u = Math.min(1, c.t / dur);
      if (c.phase === 'sink') c.obj.position.copy(c.sinkFrom).addScaledVector(c.up, -u * 1.7 * metres * look.crateSpan / look.crateSource);
      for (const m of c.owned ?? []) m.opacity = 1 - u;
      if (u >= 1) { const done = c.onGone; removeCrate(c); done?.(); }
    }
  }

  function stepFlag(f, dt) {
    f.t += dt; f.mixer?.update(dt);
    if (f.state === 'raising' && f.t >= look.raise) { f.state = 'up'; f.t = 0; play(f, 'Flutter', 0.35); }
    else if (f.state === 'lowering' && f.t >= look.lower) { f.state = 'down'; dropFlag(f); if (f.onDown) f.onDown(); }
  }

  const api = {
    ready, errors,
    // our flag over a cleared site, hoisted with the gate hydraulics, and the part's crate waiting beside it
    raiseFlag(id, point, normal, facing = null) {
      if (flags.has(id)) return false;
      const f = makeFlag(point, normal, facing, look.flagScale); f.id = id; flags.set(id, f);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(f.holder.quaternion);
      f.crate = makeCrate(vec(point).addScaledVector(side, -look.crateBeside * metres), normal, facing); f.crate.id = id;
      cue('hoist');
      return true;
    },
    lowerFlag(id, onDown = null) {
      const f = flags.get(id); if (!f || f.state === 'lowering') return false;
      f.state = 'lowering'; f.t = 0; f.onDown = () => { if (flags.get(id) === f) flags.delete(id); onDown?.(); }; play(f, 'Lower', 0.25);
      if (f.crate?.phase === 'site') { f.crate.phase = 'fade'; f.crate.t = 0; f.crate = null; }
      cue('hoist', { rate: 0.85, gain: 0.7 });
      return true;
    },
    hasFlag: (id) => flags.has(id),
    // the swing onto the back deck: from the waiting crate if there is one, from the flag otherwise
    pickUp(id, hull) {
      if (riding()) return false;
      const f = flags.get(id);
      let c = f?.crate && f.crate.phase === 'site' ? f.crate : null;
      if (f) f.crate = null;
      if (!c) { const h = typeof hull === 'function' ? hull() : hull; if (!h) return false; h.updateWorldMatrix(true, false); c = makeCrate(f ? f.holder.position : tmpP.setFromMatrixPosition(h.matrixWorld), f ? Y.clone().applyQuaternion(f.holder.quaternion) : Y); }
      c.id = id; c.hull = hull; c.phase = 'lift'; c.t = 0; c.from = c.obj.position.clone(); c.fromQ = c.obj.quaternion.clone();
      c.up = Y.clone().applyQuaternion(c.fromQ);
      cue('pickup');
      return true;
    },
    // home: off the back, gravity along the ground normal at `point`, two bounces, a thud; onLanded at the first contact
    drop(point, normal, onLanded = null) {
      const c = riding(); if (!c) return false;
      const hull = hullOf(c);
      if (hull) deckPose(hull, tmpP, tmpQ); else { tmpP.copy(c.obj.position); tmpQ.copy(c.obj.quaternion); }
      // a hull that jumped this frame (a deploy, a test teleport) has not been placed yet: start from above the ground point
      // (its old facing belongs to another spot on the sphere: slide along this ground's tangent instead)
      const n0 = vec(normal).normalize(), jumped = tmpP.distanceTo(vec(point)) > 25 * metres;
      c.back = new THREE.Vector3(0, 0, -1).applyQuaternion(tmpQ);
      if (jumped) { tmpP.copy(vec(point)).addScaledVector(n0, 2 * metres); c.back.addScaledVector(n0, -c.back.dot(n0)); if (c.back.lengthSq() < 1e-8) c.back.crossVectors(n0, Math.abs(n0.y) < 0.9 ? Y : X); c.back.normalize(); basis(n0, c.back.clone().negate(), tmpQ); }
      c.obj.position.copy(tmpP); c.obj.quaternion.copy(tmpQ);
      c.from = tmpP.clone(); c.fromQ = tmpQ.clone();
      c.slideDist = hull ? Math.max(0.5, (deck(hull).point.z - (deck(hull).point.z - deck(hull).length * look.deckInset)) * hull.getWorldScale(tmpA).x + look.crateSpan * 0.55 * metres) : look.crateSpan * metres;
      c.up = vec(normal).normalize(); c.plane = vec(point); c.bounces = 0; c.onLanded = onLanded; c.hull = null;
      c.phase = 'slide'; c.t = 0;
      const old = crates.filter((k) => k !== c && (k.phase === 'rest' || k.phase === 'settle' || k.phase === 'fall' || k.phase === 'slide')).sort((a, b) => a.seq - b.seq);
      for (const k of old.slice(0, Math.max(0, old.length - (look.maxDropped - 1)))) { k.phase = 'sink'; k.t = 0; }
      return true;
    },
    // a lost hull throws it: up and out with a spin, one hard landing, then it fades; onGone when it has
    throwOff(onGone = null) {
      const c = riding(); if (!c) return false;
      const hull = hullOf(c);
      const up = hull ? Y.clone().applyQuaternion(hull.getWorldQuaternion(tmpQ)) : c.up.clone();
      const plane = hull ? tmpA.set(0, deck(hull).bottom, deck(hull).point.z).applyMatrix4(hull.matrixWorld).clone() : c.obj.position.clone();
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(c.obj.quaternion), back = new THREE.Vector3(0, 0, -1).applyQuaternion(c.obj.quaternion);
      const k = (c.seq % 2 ? 1 : -1);
      c.vel.copy(up).multiplyScalar(9).addScaledVector(side, 5 * k).addScaledVector(back, 3).multiplyScalar(metres);
      c.spin.set(4.5 * k, 2.5, 6).applyQuaternion(c.obj.quaternion);
      c.up = up; c.plane = plane; c.bounces = look.bounces - 1; c.onGone = onGone; c.hull = null; c.onLanded = null;
      c.phase = 'tumble'; c.t = 0;
      cue('clunk', { rate: 0.8, gain: 0.8 });
      return true;
    },
    // one small flag per part home, in a row the host lays out
    trophy(index, point, normal, facing = null) {
      if (trophies[index]) return false;
      const f = makeFlag(point, normal, facing, look.trophyScale); f.id = `trophy-${index}`; trophies[index] = f;
      cue('hoist', { rate: 1.15, gain: 0.5 });
      return true;
    },
    carrying: () => riding()?.id ?? null,
    tick(dt) {
      if (disposed) return;
      for (const f of [...flags.values()]) stepFlag(f, dt);
      for (const f of trophies) if (f) stepFlag(f, dt);
      for (const c of [...crates]) stepCrate(c, dt);
    },
    // a close look for the acceptance screenshots: { eye, at, up } in world units, or null
    view(kind, id = null) {
      const m = metres, pick = (obj, up, dir, back, side, height, aim) => {
        const at = obj.getWorldPosition(new THREE.Vector3()).addScaledVector(up, aim * m);
        const right = new THREE.Vector3().crossVectors(up, dir).normalize();
        const eye = at.clone().addScaledVector(dir, back * m).addScaledVector(right, side * m).addScaledVector(up, height * m);
        return { eye: eye.toArray(), at: at.toArray(), up: up.toArray() };
      };
      if (kind === 'flag') { const f = flags.get(id) ?? [...flags.values()].pop(); if (!f) return null; const q = f.holder.quaternion; return pick(f.holder, Y.clone().applyQuaternion(q), new THREE.Vector3(0, 0, 1).applyQuaternion(q), 26, 10, 4, 3.5); }
      if (kind === 'trophy') { const f = trophies.filter(Boolean).pop(); if (!f) return null; const q = f.holder.quaternion; return pick(f.holder, Y.clone().applyQuaternion(q), new THREE.Vector3(0, 0, 1).applyQuaternion(q), 13, 5, 3, 1.8); }
      if (kind === 'crate') { const c = riding(); if (!c) return null; const q = c.obj.getWorldQuaternion(new THREE.Quaternion()); return pick(c.obj, Y.clone().applyQuaternion(q), new THREE.Vector3(0, 0, -1).applyQuaternion(q), 13, 9, 6, 1); }
      if (kind === 'drop') { const c = crates.filter((k) => ['slide', 'fall', 'settle', 'rest', 'sink'].includes(k.phase)).sort((a, b) => b.seq - a.seq)[0]; if (!c) return null; const q = c.obj.quaternion; return pick(c.obj, c.up.clone(), new THREE.Vector3(0, 0, 1).applyQuaternion(q), 14, 8, 6, 1); }
      return null;
    },
    state: () => ({
      carrying: riding()?.id ?? null, attached: riding()?.phase === 'ride',
      flags: [...flags.values()].map((f) => ({ id: f.id, state: f.state, ready: !!f.root })),
      trophies: trophies.filter(Boolean).length,
      crates: crates.map((c) => c.phase), errors: errors.slice(),
    }),
    dispose() {
      disposed = true;
      for (const f of [...flags.values(), ...trophies]) if (f) dropFlag(f);
      flags.clear(); trophies.length = 0;
      for (const c of [...crates]) removeCrate(c);
      group.removeFromParent();
      if (crateModel) release(crateModel);
    },
  };
  return api;
}

function release(root) {
  root.traverse((o) => { o.geometry?.dispose(); for (const m of [o.material].flat()) m?.dispose?.(); o.skeleton?.dispose?.(); });
}
