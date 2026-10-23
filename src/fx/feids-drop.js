// THE FEIDS-26 DROP, THE SCENE (owner, 2026-10-23: "we will reproduce the cinematic with the same scene, and they will land at the Arena";
// spec docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md). The timeline is the pure rule (src/domain/reinforcements.js); this
// draws it on the planet: two FEIDS-26 capsules and four MX-06 Ridgebacks (the owner's GLBs, assets/models/feids26 and ridgeback), posed
// every tick from the drop's own clock in a tangent frame at the drop's centre (x across, y the planet's normal, z toward the heart; the
// cinematic's metres times metres()), the shell's quarters on their own Shell_Separate clip, each mech on its Airdrop_Land clip at the clock
// the rule gives (legs tucked in the fall, the braking burn's deploy, the touchdown's compression and settle) with DROP_ROOT held at zero so
// the rule's height is the only vertical travel (the README: "do not add a second copy of the vertical drop translation"). The mechs are
// hidden while held in the closed shell (the spec's fallback: the shell is opaque, so the leg fold is not ported). The effects (THE DROP'S LOOK,
// 2026-10-23, the owner's four notes; spec docs/superpowers/specs/2026-10-23-drop-fx-design.md, the demo's effects ported in src/fx/feids-heat.js):
// each capsule's heat group (the blue glow, the white rim, the 24 flame trails) and the shell's thermal emissive, the split's flash; each falling
// mech's re-entry fire and smoke streaming up behind it (no more orange bubble), the braking jet under SOCKET_BRAKE_JET; the game's own dust at
// each touchdown and flash at each split (host.explode). The sounds fire on the rule's cues as the clock crosses them. The Ridgeback's static far
// tier (mx06_d0_lod2, one draw) is fetched with them and handed to the squad with the four (mechs()[i].far).
//   host: scene, metres() (world units a metre), sfx (play, prime, activeVoices), explode(use, point) (optional), load(url) (optional, loadGlbWithClips)
//   createFeidsDrop(host) -> { prepare(), prime(), primed(), ready(), failed(), begin(frame), tick(t), pose(t, out), mechs(), release(), heard(), worldOf(local, out), show(on), dispose() }
//   frame: { origin, x, up, z } (THREE.Vector3s; origin on the ground at the centre)
import * as THREE from '../../vendor/three.module.js';
import { loadGlbWithClips } from '../glbmodels.js';
import { capsuleState, cargoState, dropCues, cuesIn, dropCamera } from '../domain/reinforcements.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { createFeidsKit, capsuleHeat, thermalShell, mechBurn } from './feids-heat.js';

const TL = REINFORCEMENTS.timeline, CUES = dropCues(TL, REINFORCEMENTS.sounds);
const AXIS_Y = 3.8;   // the capsule's shell axis above its ground-centred root, in its metres (its leading shield is local +Z)
const additive = (color, opacity = 0.5) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

export function createFeidsDrop(h) {
  const load = h.load ?? loadGlbWithClips, M = REINFORCEMENTS.models;
  let models = null, loading = null, bad = false, hidden = false, frame = null, capsules = [], mechs = [], last = -Infinity, heard = [], kit = null;
  const basis = new THREE.Matrix4(), qFrame = new THREE.Quaternion(), qLocal = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), eye = new THREE.Vector3(), look = new THREE.Vector3();

  // THE THREE SOUNDS ARE LAZY (src/content/audio-defaults.js): decoded on demand, and a prime before the page's first gesture has no context to decode
  // with and is not retried by the engine (src/fx/disco-party.js), so prime() asks again on every call until all three are in
  const KEYS = [...new Set(CUES.map((c) => c.key))];
  let primed = false, priming = false;
  function prime() {
    if (primed || priming || !h.sfx?.prime) return primed;
    priming = true;
    Promise.all(KEYS.map((k) => h.sfx.prime(k))).then((r) => { primed = r.every(Boolean); priming = false; }, () => { priming = false; });
    return primed;
  }
  function prepare() {
    prime();
    if (loading) return loading;
    loading = Promise.all([load(M.capsule), load(M.mech), load(M.mechFar)]).then(([cap, mech, far]) => {
      if (!cap?.scene || !mech?.scene) { bad = true; console.warn('feids drop: a model did not load'); return; }
      models = { cap, mech, far: far?.scene ?? null };
    }, () => { bad = true; });
    return loading;
  }
  const worldOf = (x, y, z, out = new THREE.Vector3()) => {
    const m = h.metres();
    return out.copy(frame.origin).addScaledVector(frame.x, x * m).addScaledVector(frame.up, y * m).addScaledVector(frame.z, z * m);
  };
  const clipAction = (mixer, clips, name) => {
    const clip = clips.find((c) => c.name === name); if (!clip) return null;
    const a = mixer.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true; return a;
  };

  function begin(f) {
    frame = f; last = -Infinity; heard = [];
    basis.makeBasis(f.x, f.up, f.z); qFrame.setFromRotationMatrix(basis);
    if (!models) return;
    kit = createFeidsKit();
    for (let i = 0; i < 2; i++) {
      const root = models.cap.scene.clone(true), wrap = new THREE.Group(); wrap.add(root);
      const heat = capsuleHeat(kit); heat.group.position.set(0, AXIS_Y, 0);   // at the shell's axis, in the capsule's frame: the shield local +Z, the trails to -Z
      const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), additive(0xffffff, 0)); flash.position.set(0, AXIS_Y, 0);
      wrap.add(heat.group, flash); h.scene.add(wrap);
      const mixer = new THREE.AnimationMixer(root);
      capsules.push({ wrap, root, heat, thermal: thermalShell(root), flash, mixer, shell: clipAction(mixer, models.cap.clips, 'Shell_Separate'), split: false });
    }
    for (let i = 0; i < 4; i++) {
      const root = models.mech.scene.clone(true), wrap = new THREE.Group(); wrap.add(root); wrap.visible = false;
      const jet = new THREE.Group();
      for (const [r, len, c] of [[0.45, 3, 0x62aaff], [0.18, 2.1, 0xffe9c3]]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(r, len, 12, 1, true), additive(c, 0.8)); cone.position.y = -len / 2; jet.add(cone); }
      (root.getObjectByName('SOCKET_BRAKE_JET') ?? root).add(jet);
      const burn = mechBurn(kit, i);   // in the scene, in the drop's frame, not in the model
      h.scene.add(wrap, burn.group);
      const mixer = new THREE.AnimationMixer(root);
      mechs.push({ wrap, root, jet, burn, mixer, drop: clipAction(mixer, models.mech.clips, 'Airdrop_Land'), dropRoot: root.getObjectByName('DROP_ROOT'), clips: models.mech.clips, landed: false, index: i });
    }
  }

  // an effect's group at a point of the drop's frame, unturned (the demo's world axes), its children in metres
  function fxAt(obj, x, y, z) { worldOf(x, y, z, obj.position); obj.quaternion.copy(qFrame); obj.scale.setScalar(h.metres()); }
  function placeAt(obj, x, y, z, pitch, yaw, scale) {
    worldOf(x, y, z, obj.position);
    e.set(pitch, yaw, 0); qLocal.setFromEuler(e); obj.quaternion.copy(qFrame).multiply(qLocal);
    obj.scale.setScalar(scale * h.metres());
  }

  function tick(t) {
    if (!frame) return;
    capsules.forEach((c, i) => {
      const s = capsuleState(t, i, TL);
      c.wrap.visible = !s.gone && !hidden;
      if (s.gone) return;
      placeAt(c.wrap, s.x, s.y, 0, s.pitch, 0, 1);
      if (c.shell) { c.shell.time = Math.min(c.shell.getClip().duration, s.opening); c.mixer.update(0); }
      c.heat.update(s.heat, t); c.thermal.update(s.split < 0 ? s.heat : Math.exp(-s.split * 1.8), t);
      c.flash.visible = s.flash > 0; c.flash.material.opacity = s.flash * 0.85; c.flash.scale.setScalar(2 + Math.max(0, s.split) * 17);
      if (!c.split && s.split >= 0) { c.split = true; h.explode?.('tank.flash', worldOf(s.x, s.y, 0, v).toArray()); }
    });
    mechs.forEach((mc, i) => {
      const s = cargoState(t, i >> 1, i & 1, TL);
      mc.wrap.visible = !s.held && !hidden; mc.burn.group.visible = false;
      if (s.held) return;
      placeAt(mc.wrap, s.x, s.height, s.z, s.pitch, s.yaw, REINFORCEMENTS.scale);
      if (mc.drop) { mc.drop.time = s.clip; mc.mixer.update(0); }
      if (mc.dropRoot) mc.dropRoot.position.set(0, 0, 0);   // the rule's height is the only vertical travel
      mc.jet.visible = s.jet > 0; mc.jet.scale.setScalar(Math.max(1e-3, s.jet));
      if (!hidden) { fxAt(mc.burn.group, s.x, s.height + 0.7, s.z); mc.burn.update(s, t); }
      if (s.landed && !mc.landed) { mc.landed = true; h.explode?.('rock.dust', worldOf(s.x, 0, s.z, v).toArray()); }
    });
    for (const cue of cuesIn(CUES, last, t)) {   // `voiced`: a voice of the key is live after the ask (the engine refuses a sound not decoded or a context not running)
      h.sfx?.play?.(cue.key);
      heard.push({ key: cue.key, kind: cue.kind, index: cue.index, t: +t.toFixed(2), voiced: !!h.sfx?.activeVoices?.some((x) => x.key === cue.key) });
    }
    last = t;
  }

  // the cinematic's camera at the drop's clock, into out.pos / out.quat (the shot's poseAt) and out.fov, up along the planet's normal
  function pose(t, out) {
    if (!frame) return false;
    const c = dropCamera(t, TL, REINFORCEMENTS.shot.shake ?? 1);
    worldOf(c.eye[0], c.eye[1], c.eye[2], eye); worldOf(c.look[0], c.look[1], c.look[2], look);
    m4.lookAt(eye, look, frame.up); out.pos.copy(eye); out.quat.setFromRotationMatrix(m4); out.fov = c.fov;
    return true;
  }

  // the drop's effects let go: the capsules' heat and thermal clones and flash, the mechs' burn, the kit (the mechs' jets go with mechs())
  function releaseFx() {
    for (const c of capsules) { c.wrap.removeFromParent(); c.mixer.stopAllAction(); c.heat.dispose(); c.thermal.dispose(); c.flash.geometry.dispose(); c.flash.material.dispose(); }
    for (const mc of mechs) mc.burn.dispose();
    kit?.dispose(); kit = null; capsules = [];
  }
  function dispose() {
    for (const mc of mechs) { mc.wrap.removeFromParent(); mc.mixer.stopAllAction(); mc.jet.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    releaseFx(); mechs = []; frame = null;
  }

  return {
    prepare, prime, primed: () => primed, ready: () => !!models, failed: () => bad, begin, tick, pose, worldOf: (local, out) => worldOf(local[0], local[1], local[2], out),
    // the four for the squad once they are down: wrapper, model root, mixer and clips (the Airdrop_Land action handed over; the jet taken out of the
    // model, so the squad's instancing sees the GLB's own meshes only; the burn is the scene's, let go at release())
    mechs: () => mechs.map((mc) => { for (const fx of [mc.jet]) { fx.removeFromParent(); fx.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } return { wrap: mc.wrap, root: mc.root, mixer: mc.mixer, clips: mc.clips, drop: mc.drop, index: mc.index, far: models?.far ?? null }; }),
    release() { releaseFx(); mechs = []; },   // the mechs now the squad's
    heard: () => heard.slice(), dispose,
    show(on) { hidden = !on; },   // the harness's A/B for the drop's draw cost (--reinforcements)
  };
}
