// DAY 42 (owner, 2026-10-18): "Isao surprises us during a lull with a creation he made, a Disco Ball! 42 days surviving on this planet, Arthur
// would have been proud of us! bring your towel and let's party! ... they party for a little bit and are interrupted by an alarm and yet
// another wave of monsters." The clock is pure (src/domain/disco-party-clock.js), the pose is the owner's diorama ported
// (src/domain/disco-celebration.js); this module does the scene: the ball fetched two days ahead, Isao's line, the track on its own bus, the
// sector clock held by the host through holding(), a live ten-second cut round the Stålheart as its arm rises into the crane-hook pose and
// the ball appears at the tip, the loop (pendulum, spin, halo, laser ring, four floodlights in the party's colours), then at the track's end
// the klaxon, the callout, the second line, the ball lowered and shrunk away, the Terraforming loop resumed and the next pulse armed.
//
// THE ARM IS POSED ABSOLUTELY, as the diorama's runtime does (measured 2026-10-18 on terraformer_3000_d0_game.glb and the far tier: the same
// node frames; the diorama's lift 1.87 m with the clip's carriage puts the tip at (0.05, 11.63, 2.6), its rest hook, where the Terraforming
// clip keeps the lift near -7.4..-8.2 m, the tool at the ground). So the hoist blends each joint from its paused Terraforming value to the
// diorama's value, J4 and J6 to zero as the diorama sets them; the paused clip still writes its pose at every mixer update, so the host
// ticks this right after the base's mixers and before the render. Both tiers are posed: the far tier keeps the joints and shows whenever
// the eye is far, and the ball must hang from whichever tier is drawn.
//
// The host: scene, camera, metres() (world units a metre), sfx (src/audio.js), startShot, snapCamera, showBrief, callout(text, cls), armWave,
// daylight(), sectorRun(), base() (the story base: structure(id)), shotActive, seated, card, warning (the board's wave warning counting
// down: no party over it), alive, won, isaoBusy; loadGlb for a test.
import * as THREE from '../../vendor/three.module.js';
import { loadGlb } from '../glbmodels.js';
import { DAY_42 } from '../content/day-42.js';
import { createPartyClock } from '../domain/disco-party-clock.js';
import { celebrationPose, hoistBlend, HOOK_LOCAL_OFFSET, PARTY_COLORS, CELEBRATION_JOINTS } from '../domain/disco-celebration.js';

// [node, transform, axis, pose key]: the joints the celebration drives, in the GLB's own frames (metres, radians)
const JOINTS = [['GANTRY_TRAVEL_Y', 'position', 'z', 'gantryZ'], ['CARRIAGE_TRAVEL_X', 'position', 'x', 'carriageX'], ['TOOL_LIFT_Z', 'position', 'y', 'liftY'],
  ['J1_BASE_YAW', 'rotation', 'y', 'j1Yaw'], ['J2_SHOULDER', 'rotation', 'z', 'j2Shoulder'], ['J3_ELBOW', 'rotation', 'z', 'j3Elbow'],
  ['J4_FOREARM_ROLL', 'rotation', 'y', 'j4Roll'], ['J5_WRIST_PITCH', 'rotation', 'z', 'j5Wrist'], ['J6_TOOL_ROLL', 'rotation', 'y', 'j6Roll']];
const target = (p) => ({ gantryZ: p.gantryZ, carriageX: p.carriageX, liftY: p.liftY, j1Yaw: p.j1Yaw, ...CELEBRATION_JOINTS, j4Roll: 0, j6Roll: 0 });
// the ball's own sockets (disco_ball_d0_lod1.glb): the four light pods at the halo's corners, the four laser apertures on the ring
const POD = { r: 2.05, y: -0.16, at: Math.PI / 4 }, APERTURE = { r: 1.48 };
// the floodlights fall off linearly, `intensity` the light a metre out (decay 2 in world units left them a glow at the ground, 2026-10-18)
const DECAY = 1;
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);

export function createDiscoParty(h) {
  const clock = createPartyClock(DAY_42), load = h.loadGlb ?? loadGlb;
  let ball = null, loading = false, failed = false, music = null, t = 0, appear = 0, tiers = [], overAt = 0, spots = [], lasers = [];
  const tip = new THREE.Vector3(), up = new THREE.Vector3(), base = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const metres = () => h.metres?.() ?? 1;
  const node = (root, name) => root?.getObjectByName(name) ?? null;

  function fetchBall() {
    if (ball || loading || failed) return; loading = true;
    const fail = (why) => { loading = false; if (!failed) console.warn(`disco party: the ball did not load (${why})`); failed = true; };   // once; state().failed
    Promise.resolve(load(DAY_42.ball)).then((res) => {
      const scene = res?.isObject3D ? res : res?.scene; if (!scene) return fail('no scene');
      // a per-instance copy: loadGlb caches one scene per URL for the page's life, so the party never detaches or hides anything of the cached
      // one (a second party after a regenerate gets the whole ball back); geometry and materials stay shared, so nothing is disposed
      ball = (scene.name === 'DISCO_BALL_ROOT' ? scene : node(scene, 'DISCO_BALL_ROOT') ?? scene).clone();
      const cradle = node(ball, 'STANDALONE_CRADLE'); if (cradle) cradle.visible = false;   // hung, never standing
    }, (e) => fail(e?.message ?? e));
  }

  const structure = () => h.base?.()?.structure?.(DAY_42.landmark) ?? null;
  // every tier of the Stålheart there is now (the near one can arrive mid-party): its joints' rest and its Terraforming clip paused
  function gather() {
    const st = structure(); if (!st) return null;
    if (tiers.length && tiers.some((r) => r.root === (st.near ?? st.root))) return st.near ?? st.root;   // the near tier is in: every frame after is a pose, no allocation
    for (const root of new Set([st.near, st.far, st.root].filter(Boolean))) {
      if (tiers.some((r) => r.root === root)) continue;
      const nodes = {}, rest = {};
      for (const [name, tr, axis, key] of JOINTS) { const n = node(root, name); if (!n) continue; nodes[key] = n; rest[key] = n[tr][axis]; }
      const act = root.userData?.actions?.Terraforming_Cycle ?? null;
      tiers.push({ root, nodes, rest, act, wasPaused: act ? act.paused : null });
      if (act) act.paused = true;
    }
    return st.near ?? st.root;
  }
  function pose(r, j) {
    r.last = j;
    for (const [, tr, axis, key] of JOINTS) if (r.nodes[key] && j[key] !== undefined) r.nodes[key][tr][axis] = j[key];
    r.root.updateWorldMatrix(true, true);
  }
  function release() {   // the joints back to the clip's paused pose and the clip running as it was
    for (const r of tiers) { pose(r, r.rest); if (r.act) r.act.paused = r.wasPaused; }
    tiers = [];
  }
  // the tip's world position (world units) and the planet's radial there; false without a Stålheart
  function tipNow(root) {
    const n = node(root, 'EXTRUSION_TIP'); if (!n) return false;
    n.getWorldPosition(tip); up.copy(tip); if (up.lengthSq() < 1e-12) up.copy(Y); else up.normalize();
    return true;
  }

  function addLights() {
    const L = DAY_42.light, halo = node(ball, 'LIGHT_HALO_YAW'), ring = node(ball, 'LASER_RING_YAW');
    for (let k = 0; halo && k < 4; k++) {
      const s = new THREE.SpotLight(PARTY_COLORS[k], L.intensity, L.distance * metres(), L.angle, L.penumbra, DECAY);
      const yaw = POD.at + k * Math.PI / 2; s.position.set(Math.cos(yaw) * POD.r, POD.y, -Math.sin(yaw) * POD.r); s.castShadow = false; s.userData.yaw = yaw;
      s.add(s.target); halo.add(s); spots.push(s);
    }
    for (let k = 0; ring && k < 4; k++) {
      const geo = new THREE.PlaneGeometry(DAY_42.laser.length, DAY_42.laser.width); geo.translate(DAY_42.laser.length / 2 + APERTURE.r, 0, 0); geo.rotateX(-Math.PI / 2);   // flat, out along +x from the aperture
      const mat = new THREE.MeshBasicMaterial({ color: PARTY_COLORS[(k + 1) % 4], transparent: true, opacity: DAY_42.laser.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(geo, mat); beam.userData.yaw = k * Math.PI / 2; ring.add(beam); lasers.push(beam);
    }
  }
  function dropLights() {
    for (const s of spots) { s.removeFromParent(); s.dispose(); }
    for (const b of lasers) { b.removeFromParent(); b.geometry.dispose(); b.material.dispose(); }
    spots = []; lasers = [];
  }
  // the ball at the tip: hung toward the planet's centre (the tip's own orientation is the arm's, not the hook's), scaled about the hook
  function hang(root, p) {
    if (!ball || !root || !tipNow(root)) return;
    const m = metres(), s = Math.max(1e-4, appear) * m;
    if (!ball.parent) h.scene.add(ball);
    ball.scale.setScalar(s); ball.quaternion.setFromUnitVectors(Y, up);
    ball.position.copy(tip).addScaledVector(up, -HOOK_LOCAL_OFFSET[1] * s);
    node(ball, 'DISCO_PENDULUM_PIVOT')?.rotation.set(p.pendulumX, 0, p.pendulumZ);
    const spin = node(ball, 'DISCO_SPHERE_SPIN'); if (spin) spin.rotation.y = p.sphereSpinY;
    const halo = node(ball, 'LIGHT_HALO_YAW'); if (halo) halo.rotation.y = p.haloYaw;
    const ring = node(ball, 'LASER_RING_YAW'); if (ring) ring.rotation.y = p.laserRingYaw;
    for (const s2 of spots) {
      const yaw = s2.userData.yaw, c = Math.cos(p.spotPitch);
      s2.target.position.set(Math.cos(yaw) * c * 10, Math.sin(p.spotPitch) * 10, -Math.sin(yaw) * c * 10);   // ten metres down and out along the pod
      s2.intensity = DAY_42.light.intensity * p.pulse * m;
    }
    for (const b of lasers) b.rotation.set(0, b.userData.yaw, p.laserPitch);
    ball.updateMatrixWorld(true);
  }

  // THE CUT: a slow quarter-orbit round the tip, `radius` out and `height` above along the base's radial, on the hanging ball, eased in
  // from wherever the camera was (the sites tour's blend, td-tab freeLook)
  function shot() {
    const st = structure(), root = st?.near ?? st?.root; if (!root || !node(root, 'EXTRUSION_TIP')) return;
    const S = DAY_42.shot, start = { pos: h.camera.position.clone(), quat: h.camera.quaternion.clone() };
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion();
    h.startShot({ id: S.id, dur: S.seconds, skippable: true, onEnd: () => h.snapCamera(), poseAt(u, out) {
      const live = structure(), r = live?.near ?? live?.root ?? root, m = metres(); if (!tipNow(r)) return;
      (live?.holder ?? r).getWorldPosition(base); n.copy(base.lengthSq() < 1e-12 ? Y : base.normalize());   // the base's radial: the orbit's plane stays level while the arm sways
      e1.crossVectors(n, Math.abs(n.y) < 0.9 ? Y : X).normalize(); e2.crossVectors(n, e1);
      const a = -0.3 + u * Math.PI / 2, R = S.radius * m;
      eye.copy(tip).addScaledVector(e1, Math.cos(a) * R).addScaledVector(e2, Math.sin(a) * R).addScaledVector(n, S.height * m);
      look.copy(tip).addScaledVector(n, -HOOK_LOCAL_OFFSET[1] / 2 * m);   // halfway down the hang: the arm's tip and the ball both in frame
      m4.lookAt(eye, look, n); q.setFromRotationMatrix(m4);
      const k = Math.min(1, u * S.seconds / S.easeIn), e = k * k * (3 - 2 * k);
      out.pos.lerpVectors(start.pos, eye, e); out.quat.slerpQuaternions(start.quat, q, e);
    } });
  }

  function begin() {
    h.showBrief(DAY_42.briefs.start);
    music = h.sfx?.loop(DAY_42.music.key) ?? null;
    h.sfx?.duck(DAY_42.music.duck.buses, DAY_42.music.duck.depth, DAY_42.seconds);
    t = 0; overAt = 0; appear = 0; tiers = []; gather(); addLights();
  }
  function end(alarm, sr) {   // the track's end (alarm) or the party cut short by the hull or the win
    music?.stop(0.15); music = null; h.sfx?.duck(DAY_42.music.duck.buses, 1, 0);   // the duck lifted
    if (alarm) {
      h.sfx?.play('danger_alert'); h.callout(DAY_42.callout, 'co-victory'); h.showBrief(DAY_42.briefs.over);
      if (sr?.state?.().phase === 'fighting') h.armWave();
    }
    dropLights(); overAt = t;
    for (const r of tiers) r.from = r.last ?? r.rest;   // lowered from wherever the arm is now, mid-hoist or mid-loop
  }
  function finish() {   // 'done' and restore(): nothing of the party left in the yard
    dropLights(); ball?.removeFromParent(); release(); music?.stop(0.15); music = null; appear = 0; t = 0; overAt = 0;
  }

  return {
    tick(dt) {
      const sr = h.sectorRun?.() ?? null, phase = sr?.state?.().phase, day = h.daylight?.()?.day?.() ?? 0;
      if (day >= DAY_42.day - DAY_42.loadAhead) fetchBall();
      const cond = { day, fighting: phase === 'fighting', secure: phase === 'secure', breathing: !!sr?.breathing?.(), shot: h.shotActive(), seated: h.seated(),
        card: !ball || h.card() || !!h.warning?.(), alive: h.alive(), boss: !!sr?.defNow?.()?.boss, won: h.won(), isaoBusy: h.isaoBusy() };   // the board's wave warning is a card: no party over its rings
      const was = clock.state().phase, events = clock.tick(dt, cond);
      if (was === 'party' && events.length === 0 && (!cond.alive || cond.won)) events.push(...clock.over().map((e) => (e === 'over' ? 'cut' : e)));
      for (const ev of events) {
        if (ev === 'start') begin();
        else if (ev === 'shot') shot();
        else if (ev === 'over' || ev === 'cut') end(ev === 'over', sr);
        else if (ev === 'done') finish();
      }
      const now = clock.state().phase;
      if (now !== 'party' && now !== 'over') return;
      if (!events.includes('start')) t += dt;   // the party's own time from its first frame; the loop keeps turning as the ball goes down
      const root = gather(), p = celebrationPose(t, DAY_42.loop);
      if (now === 'party') {
        appear = Math.min(1, t);
        if (!music && t < DAY_42.shot.at) music = h.sfx?.loop(DAY_42.music.key) ?? null;   // null until the track has decoded: asked again (src/audio.js)
        const k = Math.min(1, t / DAY_42.hoist);
        for (const r of tiers) pose(r, hoistBlend(k, r.rest, target(p)));
      } else {
        const k = (t - overAt) / DAY_42.lower; appear = Math.max(0, 1 - k);
        for (const r of tiers) pose(r, hoistBlend(k, r.from ?? r.rest, r.rest));
      }
      hang(root, p);
    },
    holding: () => clock.holding(),
    force() { clock.force(); fetchBall(); },
    state: () => ({ ...clock.state(), t: +t.toFixed(2), loaded: !!ball, failed, hanging: !!ball?.parent, lights: ball?.parent ? spots.filter((s) => s.parent).length : 0, music: !!music }),
    restore() { finish(); clock.reset(); },
  };
}
