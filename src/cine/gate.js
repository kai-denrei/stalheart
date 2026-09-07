// cine/gate.js — THE GATE. A 12-second cinematic (docs/CINEMATICS-PLAN.md,
// phase 1): the wormhole full frame, then the pull back through the
// aperture into the ring, under the galaxy sky.
//
// Draws the game's own assets: the GT-9 ring exactly as units.js casts it
// (makePortalRing — same repaint, same pivots), the wormhole shader at a
// frame-class target, the galaxy bake as sky AND as the environment every
// metal reflects. Nothing here is a second copy of anything (plan §0).
//
// Every time-dependent thing is SET from t: rotors, phases, the camera.
// A capture seeks; the live loop just calls update(t) with a running t.
import * as THREE from '../../vendor/three.module.js';
import { preloadPortalRing, makePortalRing } from '../units.js';
import { bakeGalaxyCube } from '../galaxybake.js';
import { SKY_PRESET } from '../galaxyseed.js';
import { createWormholeTarget, RING_SPIN, TRAVEL } from './wormholebg.js';
import { compileRail } from './rail.js';
import { applyWeatheredMaterial } from './materials.js';
import { makeCinemaCloud } from './cloud.js';
import { CREATURE_TINTS, accentFor } from '../enemyspec.js';
import { makeWirePlanet, widenWire } from './planet.js';
import { LOOKS } from '../looks.js';

export const GATE_LEN = 12;

// The rail. The aperture faces +Z and the disc is a unit circle on
// Aperture_Volume, whose scale is the clearance radius (~1.8 m). Beat 1
// sits INSIDE the throat and pulls slowly back — at 0.5 m the disc is 6x
// larger than the frame, so what fills it is the march's centre. Beat 2
// pulls through the plane; the ring resolves around the frame and settles
// at half the height. Beat 3 drifts, for the crossing (phase 1c).
export const GATE_RAIL = [
  // beat 1: the camera HOLDS at 2.3 m, where the 1.8 m disc still fills a
  // 16:9 frame at fov 40 — the tunnel's "flying out" is the march's own
  // uNear ramp (below), not the camera's. No seam, one march per frame.
  { t: 0.0, pos: [0.10, 0.06, 2.30], look: [0.08, 0.05, -2], fov: 40 },
  { t: 4.0, pos: [0.12, 0.08, 2.30], look: [0.06, 0.04, -2] },
  { t: 8.0, pos: [1.60, 0.90, 7.20], look: [0, 0, 0] },
  // beat 3 LANDS (ruling C, 2026-09-04): the pull-back keeps going until
  // the wire planet's horizon is under the ring — the ring at the size it
  // has in the game, on a board a player knows, the swarm coming past
  // measured: the planet is 7.8 m in radius under a 3.6 m aperture — on the
  // board the gate spans ~3 cells of a ~12-cell-radius world, and that IS
  // the scale a player knows. Back far enough that the disc reads as a
  // planet and not a ball, the ring in the upper third.
  { t: 12.0, pos: [-4.5, 3.6, 22.0], look: [0, -2.2, 0] },
];

// Beat 1 is the march's own fly-out: the ray's start distance (uNear) ramps
// from inside the throat (0.45) to the tuned 1.5 the board shows, on the
// disc itself. A first cut drew a second, frame-shaped march on a camera
// quad and crossfaded it into the disc — two marches a frame and a hard
// circular seam where their scales met (t=4.6 still). The disc fills the
// frame at 2.3 m anyway, so one march does it.
const NEAR_IN = 0.45, NEAR_OUT = 1.5, BEAT1 = 4.0;

// THE CROSSING (phase 1c, ruled 2026-09-04): five phage — the wave-1 swarm,
// white belt, "hunt its source" — pour OUT of the gate toward the
// retreating camera, from t = 7.5, starts 0.3 s apart. The aperture's disc
// is opaque and sits on the plane z = 0, so a body behind the plane is
// hidden by depth and a body in front is drawn: the crossing is a
// depth composite, nothing more (the plan's screen-space refraction was
// cut — it is new shader work on the exact wide-canvas geometry that hung
// the M4). Lanes are offsets inside the 1.8 m clearance, and they widen
// as the body comes on, so the swarm spreads past the camera instead of
// converging on it.
const CROSSING = { t0: 7.5, stagger: 0.3, dur: 4.6, n: 5, zIn: -1.4, zOut: 6.2 };
const LANES = [[0.45, 0.30], [-0.60, 0.50], [0.20, -0.70], [-0.30, -0.15], [0.80, -0.45]];

export function createGate({ renderer, scene, camera, tier = {} }) {
  const whSize = tier.wormhole ?? 1024;
  const wh = createWormholeTarget({ size: whSize, filter: tier.name === 'cinema' ? 'nearest' : 'linear' });
  const rail = compileRail(GATE_RAIL, { fov: 40 });

  // THE SKY: the game's bake, at a cinema face size, as background and as
  // the environment (PMREM) — the ring reflects its own galaxies.
  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: tier.skyFace ?? 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(sky.texture).texture;
  scene.environmentIntensity = 0.35;

  // LIGHT: a key that casts, a cool fill, the sky for the rest
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(6, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xc9d4e6, 0x141216, 0.30));
  // the throat lights the ring's inside: a point light at the aperture,
  // tinted from the preset's hue, so the metal facing the wormhole glows
  const throat = new THREE.PointLight(0xc46cff, 40, 12, 2);
  throat.position.set(0, 0, 0.2);
  scene.add(throat);

  const root = new THREE.Group();
  scene.add(root);
  let ring = null, disc = null, landing = null, wideReady = true, apertureWorld = new THREE.Vector3();

  // the swarm, at cinema density: the game's phage, ten points for one.
  // ?nocross=1 removes it; ?cdens=N sets the density; ?csize=N the scale
  const cq = new URLSearchParams(location.search);
  const swarm = [];
  if (cq.get('nocross') !== '1') {
    const dens = parseFloat(cq.get('cdens')) || 10, csize = parseFloat(cq.get('csize')) || 0.55;
    for (let i = 0; i < CROSSING.n; i++) {
      const c = makeCinemaCloud('phage', {
        density: dens, size: csize, seed: 4414 + i,
        body: CREATURE_TINTS.phage, accent: accentFor('phage'),
      });
      c.visible = false;
      root.add(c);
      swarm.push(c);
    }
    console.log(`CROSSING ${swarm.length} phage x ${swarm[0] ? swarm[0].userData.points : 0} points`);
  }
  const rests = {};
  preloadPortalRing().then((ok) => {
    if (!ok) return;
    ring = makePortalRing(0xaee8ff);
    if (!ring) return;
    ring.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // the board's strips carry the tint in DIFFUSE and emissive both; under
    // ACES + the sky environment that clipped to white. The hue goes into
    // emissive over a dark base (the memory's own rule for glow parts), so
    // what bloom lifts is the light, not a white plate.
    for (const m of ring.userData.glows || []) {
      m.color.setHex(0x0e1218);
      if (m.emissive) { m.emissive.setHex(0x8fd4ff); m.emissiveIntensity = 1.1; }
    }
    // The board's grey ladder (RING_REPAINT) lifts every structural material
    // to a light grey WITH a grey emissive; a cinematic lights its metal.
    // The dark base (CINE_BASE) and the maps both live in cine/materials.js
    // now, and apply by name; a material without uv keeps the base.
    // PHASE 1b: THE WEATHERED METAL, over that base. Seeded, baked at load,
    // bound by material name (cine/materials.js); the maps become the
    // material. `?weather=0` leaves the board's ladder for a bisect. `?wrepeat=N` tiles the maps N times across the ring's UVs
    // and `?wnormal=N` scales the normal map — the two knobs a still is
    // judged on, so they are on the URL rather than in the file.
    const wq = new URLSearchParams(location.search);
    if (wq.get('weather') !== '0') {
      const n = applyWeatheredMaterial(ring, {
        seed: 4414, size: tier.name === 'cinema' ? 1024 : 512,
        // judged on stills at t=8: repeat 1 / normal 1 read as brushed
        // steel on the ring's UV scale; 0.5 / 0.6 read as worn plate
        repeat: parseFloat(wq.get('wrepeat')) || 0.5,
        normalScale: parseFloat(wq.get('wnormal')) || 0.6,
      });
      console.log(`WEATHER dressed ${n} materials on the ring (${tier.name === 'cinema' ? 1024 : 512}px)`);
    }
    // the cast is fitted to board scale; bring the aperture back to ~1.8 m
    const ap = ring.userData.aperture;
    if (ap) {
      ring.updateMatrixWorld(true);
      const s = new THREE.Vector3(); ap.getWorldScale(s);
      const k = 1.8 / Math.max(s.x, s.y, 1e-6);
      ring.scale.multiplyScalar(k);
      ring.updateMatrixWorld(true);
      ap.getWorldPosition(apertureWorld);
      // put the aperture at the origin: the rail is authored around it
      ring.position.sub(apertureWorld);
      ring.updateMatrixWorld(true);
      // THE PLANET UNDER IT. k is the exact factor between the board's
      // units and the cinematic's metres (the aperture is 1.8 m here and
      // whatever the cast fitted it to there), so a unit-radius board
      // sphere scaled by k IS the board's planet at this ring's scale —
      // ~45 m across, cells ~3 m, the ring spanning about one. It sits
      // tangent under the ring's foot. ?noplanet=1 removes it.
      if (new URLSearchParams(location.search).get('noplanet') !== '1') {
        const look = LOOKS.tronColors;
        const planet = makeWirePlanet({ seed: 4414, n: 420, edges: look.edges, body: look.bg });
        planet.scale.setScalar(k);
        const box = new THREE.Box3().setFromObject(ring);
        planet.position.set(0, box.min.y - k, 0);
        root.add(planet);
        landing = planet;
        const wq2 = new URLSearchParams(location.search);
        const wide = wq2.get('wide') != null ? parseFloat(wq2.get('wide')) : Math.max(1.5, renderer.domElement.height / 360);
        // ready() waits for this: a capture draws ONE frame, and the dynamic
        // import lands after the ring does (the first 4K still had the thin wire)
        if (wide > 0) { wideReady = false; widenWire(planet, { width: wide, resolution: [renderer.domElement.width, renderer.domElement.height] }).then(() => { wideReady = true; }); }
        console.log(`PLANET radius ${k.toFixed(1)} m, cell ${(planet.userData.cellSide * k).toFixed(2)} m, foot at y=${box.min.y.toFixed(2)}`);
      }
      // OPAQUE, unlike the board's additive disc: inside the throat the sky
      // must not shine through the wormhole, and from outside the aperture
      // is a hole into somewhere else, not a glow over the stars
      // ?disc=front|nomap|tone — variants for bisecting a GPU hang that only
      // happens with this disc filling a canvas wider than ~1500 px
      const dv = new URLSearchParams(location.search).get('disc') || '';
      disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({
        map: dv === 'nomap' ? null : wh.rt.texture, color: dv === 'nomap' ? 0x8040c0 : 0xffffff,
        side: dv === 'front' ? THREE.FrontSide : THREE.DoubleSide, toneMapped: dv === 'tone',
      }));
      if (new URLSearchParams(location.search).get('nodisc') !== '1') ap.add(disc);
    }
    for (const k of ['rotorA', 'rotorB', 'yaw']) {
      const o = ring.userData[k];
      if (o) rests[k] = k === 'yaw' ? o.rotation.y : o.rotation.z;
    }
    root.add(ring);
    // ?matprobe=1 — name every material on the cast ring with its channels,
    // so a recolour can be aimed at the right ones instead of at /glow/i
    if (new URLSearchParams(location.search).get('matprobe') === '1') {
      const seen = new Map();
      ring.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const k = m.name || '(unnamed)';
          const e = seen.get(k) || { meshes: [], m, geo: o.geometry };
          e.meshes.push(o.name); seen.set(k, e);
        }
      });
      for (const [k, e] of seen) {
        const m = e.m;
        console.log(`MAT ${k} color=#${m.color ? m.color.getHexString() : '-'} emissive=#${m.emissive ? m.emissive.getHexString() : '-'}`
          + ` ei=${m.emissiveIntensity ?? '-'} rough=${m.roughness ?? '-'} metal=${m.metalness ?? '-'}`
          + ` maps=${['map', 'aoMap', 'roughnessMap', 'metalnessMap', 'normalMap'].filter((s) => m[s]).join('/') || 'none'}`
          + ` uv=${(() => { const g = e.geo; return g ? ['uv', 'uv1', 'uv2'].filter((a) => g.attributes[a]).join('/') || 'NONE' : '?'; })()}`
          + ` inGlows=${(ring.userData.glows || []).includes(m)} meshes=${e.meshes.length} e.g. ${e.meshes.slice(0, 3).join(',')}`);
      }
    }
  });

  const tmp = new THREE.Vector3();
  function update(t) {
    // the wormhole: travelling hard the whole way; beat 1 flies the ray's
    // start out of the throat (the march's own "inside, then out")
    const u = Math.min(1, t / BEAT1);
    wh.uniforms.uNear.value = NEAR_IN + (NEAR_OUT - NEAR_IN) * (u * u * (3 - 2 * u));
    wh.render(renderer, t, { travelRate: TRAVEL.max, spinRate: 0.15 });
    if (disc && disc.material.map !== wh.rt.texture) { disc.material.map = wh.rt.texture; disc.material.needsUpdate = true; }

    if (ring) {
      const u = ring.userData;
      if (u.rotorA) u.rotorA.rotation.z = rests.rotorA + RING_SPIN.rotorA * t;
      if (u.rotorB) u.rotorB.rotation.z = rests.rotorB + RING_SPIN.rotorB * t;
      if (u.yaw) u.yaw.rotation.y = rests.yaw + RING_SPIN.yaw * t;
    }
    // the wide wire's width is in pixels of its resolution uniform: per draw
    const wm = landing && landing.userData.wire && landing.userData.wire.material;
    if (wm && wm.resolution) wm.resolution.set(renderer.domElement.width, renderer.domElement.height);
    // the crossing: every body SET from t (a capture seeks; nothing accumulates)
    for (let i = 0; i < swarm.length; i++) {
      const c = swarm[i];
      const s = (t - CROSSING.t0 - i * CROSSING.stagger) / CROSSING.dur;
      if (s < 0 || s > 1.15) { c.visible = false; continue; }
      c.visible = true;
      const [lx, ly] = LANES[i % LANES.length];
      const ease = s < 0.25 ? s * 4 * (2 - s * 4) * 0.5 + s : s;   // out of the throat, then steady
      c.position.set(lx * (1 + s * 1.6), ly * (1 + s * 1.3), CROSSING.zIn + (CROSSING.zOut - CROSSING.zIn) * ease);
      // head first: the phage's head is +Y and it travels +Z; then a slow roll
      c.rotation.set(-Math.PI / 2 + Math.sin(t * 1.7 + i) * 0.12, 0, t * 0.9 + i * 1.3);
    }

    const p = rail.poseAt(t);
    camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    camera.up.set(p.up[0], p.up[1], p.up[2]);
    camera.lookAt(tmp.set(p.look[0], p.look[1], p.look[2]));
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
  }

  return {
    name: 'gate', duration: GATE_LEN, update,
    ready: () => !!ring && wideReady,
    wormhole: wh,                                   // the governor's lever
    lockUp: (t) => t < BEAT1 + 1.5,                 // the full-frame beat: never step UP inside it
    dispose() { wh.dispose(); sky.dispose(); pmrem.dispose(); },
  };
}
