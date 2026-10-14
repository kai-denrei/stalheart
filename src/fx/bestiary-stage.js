// THE BESTIARY'S STAGE (owner, 2026-10-14: "display all the unlocked units in their full glory, enemies at high resolution with smooth
// animations displaying their movement patterns"; spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md, section 4): a small
// scene of its own the terminal (src/fx/terminal-screen.js) draws into a render target under its frame. A bent ground disc at the story
// planet's radius, a lure on a slow closed loop, and the entry's pack hunting it: three or six bodies of the entry's smallest type, seated
// through the game's own family (src/fx/creature-pearl.js createPearlFamily, with the game's tables, as src/fx/creature-enemies.js makes it
// and as the swarm lab's Pearl lane seats it on branch swarm-lab-pearl) at the kit's HIGH level forced with the cap lifted (the swarm lab's
// lod.force, src/fx/cutis-maku/geometry.js), the membrane's lumps, the breath, the contact shadow and the core all on. The kit creatures
// stage through their own family where it seats on a plane: the Cutis-Maku (src/fx/creature-cutis.js) does; the Reeds' kit simulates on a
// frame of its own on the unit sphere (src/fx/creature-reed.js) and does not, so their entries carry `stage: false` (src/content/bestiary.js)
// and show the card alone, as the spec allows.
//
// THE PACK HUNTS. Each body has a record, as in the game: the record walks at the lure at its type's paced walk (the game's pearlSpeed, at
// the sector's pace; the Cutis-Maku its tier's speed), held under `walk` of the lure's mean speed so the pack chases rather than corners,
// a little apart from the others, and the body follows its record with the family's own track() (the gait, the stalks, the seek, the turn).
// The lure (src/domain/bestiary.js lureStep) keeps ahead of the nearest record. THE CAMERA orbits slowly round the pack's middle (a share
// of the way to the lure, followed smoothly; the disc's centre when the stage is empty), so the hunt stays in the frame; the planet's bend
// is the game's (uPlanetR, the kit's shader), so the bodies bend as in play. SILHOUETTE (met in an earlier run only): every membrane drawn
// flat dark and near opaque (a define in the stage's own materials, set before the kit's tone mapping; the game's family is a different instance and never
// sees it), the pearls hidden, the lure off.
//
// createBestiaryStage({ stage }) -> { show(entry, { state, pack }), setPack(n), step(dt, height), render(renderer, target), state(), dispose() }
import * as THREE from '../../vendor/three.module.js';
import { createPearlFamily } from './creature-pearl.js';
import { createCutisFamily } from './creature-cutis.js';
import { bendPoint } from './cutis-maku/shaders.js';
import { CUTIS_LOD } from './cutis-maku/config.js';
import { pearlBodies, pearlSpeed } from '../domain/pearl-bodies.js';
import { lurePoint, lureStep, packSeats } from '../domain/bestiary.js';
import { PEARL_TIERS, PEARL_OF, PEARL_BODY, PEARL_FOLLOW, PEARL_PACE, PEARL_GAIT, PEARL_IMPACT } from '../content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH, CREATURE_TIERS } from '../content/creature-enemies.js';
import { STORY_RECIPE, STORY_SANITY } from '../content/story-defaults.js';
import { BESTIARY_STAGE } from '../content/bestiary.js';
import { ENEMY_SPEC } from '../enemyspec.js';

const CELL = STORY_RECIPE.metresPerCell;
// the story planet's radius in metres (src/fx/creature-bodies.js: metresPerCell / cellSide, ~753 m)
const PLANET_R = CELL / STORY_SANITY.cellSide;
const BODIES = pearlBodies({ spec: ENEMY_SPEC, of: PEARL_OF, tiers: PEARL_TIERS, body: PEARL_BODY });
const SILHOUETTE = 'BESTIARY_SILHOUETTE';

// the entry's smallest Pearl type (the pack is that type's bodies, as the game builds them)
export function packType(entry) {
  return entry.types.filter((t) => BODIES[t]).sort((a, b) => BODIES[a].r0 - BODIES[b].r0)[0] ?? null;
}
// a Pearl type's record walk in m/s: its spec x its tier's pace, capped at its body's radii a second (PEARL_PACE), at the sector's pace
export function packWalk(type) {
  const b = BODIES[type], pace = PEARL_PACE[b.tier];
  return pearlSpeed({ speed: ENEMY_SPEC[type].speed * pace.speed, radii: pace.radii, r0: b.r0, sectorPace: PEARL_GAIT.sectorPace, metresPerCell: CELL }) * PEARL_GAIT.sectorPace * CELL;
}

export function createBestiaryStage({ stage = BESTIARY_STAGE } = {}) {
  const S = stage, L = S.lure;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05080b);
  const cam = new THREE.PerspectiveCamera(S.orbit.fov, 16 / 10, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xc8d6e6, 0x2a2622, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.2); sun.position.set(30, 60, 20); scene.add(sun);
  const world = new THREE.Group(); world.name = 'bestiary stage'; scene.add(world);
  const disposables = [], P = [0, 0, 0];
  const bent = (geo) => { const a = geo.getAttribute('position'); for (let i = 0; i < a.count; i++) { bendPoint(a.getX(i), a.getY(i), a.getZ(i), PLANET_R, P); a.setXYZ(i, P[0], P[1], P[2]); } geo.computeVertexNormals(); disposables.push(geo); return geo; };
  const mat = (m) => { disposables.push(m); return m; };

  // --- the ground: a bent disc, rings every 6 m, the lure's loop drawn faint on it ------------------------------------------------------------
  { const g = new THREE.RingGeometry(0.01, S.disc.radius, 72, 18); g.rotateX(-Math.PI / 2); world.add(new THREE.Mesh(bent(g), mat(new THREE.MeshStandardMaterial({ color: S.disc.colour, roughness: 1, metalness: 0 })))); }
  const lineMat = mat(new THREE.LineBasicMaterial({ color: S.disc.rim, transparent: true, opacity: 0.7 }));
  const loopLine = (pts) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => { bendPoint(x, 0.04, z, PLANET_R, P); return new THREE.Vector3(P[0], P[1], P[2]); })); disposables.push(g); return new THREE.LineLoop(g, lineMat); };
  for (let r = 6; r < S.disc.radius; r += 6) world.add(loopLine(Array.from({ length: 96 }, (_, k) => [Math.cos((k / 96) * Math.PI * 2) * r, Math.sin((k / 96) * Math.PI * 2) * r])));
  const track = loopLine(Array.from({ length: 240 }, (_, k) => lurePoint(k / 240, L))); track.material = mat(new THREE.LineBasicMaterial({ color: S.lureColour, transparent: true, opacity: 0.22 })); world.add(track);
  // --- the lure: a small glowing marker over a ring on the ground ---------------------------------------------------------------------------
  const lure = new THREE.Group(); lure.name = 'lure'; world.add(lure);
  const glow = mat(new THREE.MeshBasicMaterial({ color: S.lureColour })), halo = mat(new THREE.MeshBasicMaterial({ color: S.lureColour, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), glow); orb.position.y = 1.3; lure.add(orb); disposables.push(orb.geometry);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 32), halo); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; lure.add(ring); disposables.push(ring.geometry);

  // --- the families: the game's Pearl family at the high level forced, the cap lifted; the Cutis-Maku's on first use -----------------------------
  const lod = { ...CUTIS_LOD, ...PEARL_FOLLOW.lod, force: S.level, highCap: Math.max(...S.packSizes) };
  const capacity = Object.fromEntries(PEARL_TIERS.map((t) => [t.id, Math.max(...S.packSizes) * 2]));
  const pearl = createPearlFamily({ parent: world, tiers: BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS,
    tune: { ...PEARL_FOLLOW, lod, capacity }, pace: PEARL_PACE, gait: PEARL_GAIT, impact: PEARL_IMPACT, hubs: { count: 1, quat: () => null } });
  pearl.setPlanet(PLANET_R);
  let cutis = null;
  const cutisFamily = () => {
    if (!cutis) {
      const key = S.creatureTier, def = CREATURE_TIERS.cutis[key];
      cutis = createCutisFamily({ parent: world, tiers: { [key]: { ...def, capacity: Math.max(...S.packSizes) * 2 } }, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, lod });
      cutis.setPlanet(PLANET_R);
    }
    return cutis;
  };

  // --- the silhouette: a define in the stage's own membrane materials (patched once each, before the kit's tone mapping) ------------------------
  const patched = new WeakSet();
  let darkened = 0;   // the materials drawn dark at the last dress (the harness)
  function dress(dark) {
    darkened = 0;
    const [r, g, b] = S.silhouette.map((v) => (Number.isInteger(v) ? v.toFixed(1) : String(v)));
    for (const root of [...pearl.roots(), ...(cutis?.roots() ?? [])]) root.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m) return;
      if (!m.isShaderMaterial) { o.userData.bestiaryHidden = dark; return; }   // the pearls (src/fx/cutis-maku/hard-core.js): hidden in silhouette
      if (!m.fragmentShader.includes('#include <tonemapping_fragment>')) return;   // the contact shadow is dark already
      if (!patched.has(m)) { patched.add(m); m.fragmentShader = m.fragmentShader.replace('#include <tonemapping_fragment>', `#ifdef ${SILHOUETTE}\n  gl_FragColor=vec4(${r},${g},${b},min(1.,gl_FragColor.a*2.));\n  #endif\n  #include <tonemapping_fragment>`); m.needsUpdate = true; }
      const on = !!m.defines?.[SILHOUETTE];
      if (on !== dark) { m.defines = { ...(m.defines ?? {}) }; if (dark) m.defines[SILHOUETTE] = 1; else delete m.defines[SILHOUETTE]; m.needsUpdate = true; }
      if (dark) darkened++;
    });
  }
  const hideCores = () => { for (const root of pearl.roots()) root.traverse((o) => { if (o.userData.bestiaryHidden) o.visible = false; }); };

  // --- the pack ---------------------------------------------------------------------------------------------------------------------------
  const lureStart = () => { const p0 = lurePoint(0, L); return { phase: 0, dir: 1, x: p0[0], z: p0[1] }; };
  const focus = [0, 0];
  let entry = null, mode = 'none', pack = S.packSizes[0], records = [], near = [], clock = 0, lureAt = lureStart(), family = null, type = null, kind = null;
  const lureLen = (() => { let s = 0; const a = [0, 0], b = [0, 0]; for (let k = 0; k < 400; k++) { lurePoint(k / 400, L, a); lurePoint((k + 1) / 400, L, b); s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; })();
  const lureMean = lureLen / L.period;
  function clear() { for (const r of records) family?.free(r.h); records = []; near = []; }
  function seat() {
    clear();
    if (mode === 'none') return;
    lureAt = lureStart();
    const { seats } = packSeats(pack, { radius: L.radius, ...S.pack }), start = lurePoint(0, L);
    const walk = Math.min(kind === 'cutis' ? CREATURE_TIERS.cutis[S.creatureTier].speed * PEARL_GAIT.sectorPace * CELL : packWalk(type), S.walk * lureMean);
    const r0 = kind === 'cutis' ? CREATURE_TIERS.cutis[S.creatureTier].r0 : BODIES[type].r0;
    records = seats.map(([x, z], k) => {
      const angle = Math.atan2(start[1] - z, start[0] - x);
      const h = kind === 'cutis' ? family.add(S.creatureTier, { x, z, angle }) : family.add(type, { x, z, angle, speed: walk });
      return { x, z, h, walk, r0, k, at: [x, z] };
    });
    near = records.map((r) => r.at);
    dress(mode === 'silhouette');
  }
  // an entry in a state: 'full' the pack and the lure; 'silhouette' dark bodies, no lure; 'unseen' or a card-only entry: nothing on the stage
  function show(e, { state = 'full', pack: n = pack } = {}) {
    clear();
    entry = e; pack = S.packSizes.includes(n) ? n : S.packSizes[0];
    kind = e?.kind === 'creature' ? (e.id === 'cutis' && e.stage ? 'cutis' : null) : e ? 'pearl' : null;
    type = kind === 'pearl' ? packType(e) : null;
    mode = !e || state === 'unseen' || !e.stage || !kind || (kind === 'pearl' && !type) ? 'none' : state;
    family = kind === 'cutis' ? cutisFamily() : kind === 'pearl' ? pearl : null;
    seat();
  }
  function setPack(n) { if (!S.packSizes.includes(n) || n === pack) return; pack = n; seat(); }

  function step(dt, height = 600) {
    clock += dt;
    // the camera's slow orbit round its focus: the pack's middle and a share of the way to the lure, followed smoothly
    let fx = 0, fz = 0;
    if (records.length) { for (const r of records) { fx += r.x; fz += r.z; } fx /= records.length; fz /= records.length; fx += (lureAt.x - fx) * S.orbit.lure; fz += (lureAt.z - fz) * S.orbit.lure; }
    const k = 1 - Math.exp(-dt / S.orbit.smooth); focus[0] += (fx - focus[0]) * k; focus[1] += (fz - focus[1]) * k;
    const a = (clock / S.orbit.period) * Math.PI * 2;
    bendPoint(focus[0], S.orbit.lookUp, focus[1], PLANET_R, P); const ly = P[1];
    cam.position.set(focus[0] + Math.cos(a) * S.orbit.radius, ly - S.orbit.lookUp + S.orbit.height, focus[1] + Math.sin(a) * S.orbit.radius); cam.lookAt(focus[0], ly, focus[1]); cam.updateMatrixWorld();
    lure.visible = mode === 'full'; track.visible = mode === 'full';
    if (mode === 'none') { pearl.step(dt, cam, height); cutis?.step(dt, cam, height); return; }
    // the records: at the lure (each a little to its own side), apart from one another; then the lure, held ahead of them all
    for (const r of records) {
      const off = ((r.k / records.length) - 0.5) * 2 * S.pack.ring * 0.6, dx0 = lureAt.x - r.x, dz0 = lureAt.z - r.z, dl0 = Math.hypot(dx0, dz0) || 1;
      const tx = lureAt.x - (dz0 / dl0) * off, tz = lureAt.z + (dx0 / dl0) * off, dx = tx - r.x, dz = tz - r.z, d = Math.hypot(dx, dz);
      const go = Math.min(r.walk * (kind === 'pearl' ? family.paceOf(r.h) : 1) * dt, Math.max(0, d - L.ahead * 0.5));
      if (d > 1e-6) { r.x += (dx / d) * go; r.z += (dz / d) * go; }
      for (const o of records) {
        if (o === r) continue;
        const ex = r.x - o.x, ez = r.z - o.z, e = Math.hypot(ex, ez), min = (r.r0 + o.r0) * 1.15;
        if (e > 1e-6 && e < min) { const push = (min - e) * 0.5; r.x += (ex / e) * push; r.z += (ez / e) * push; }
      }
      r.at[0] = r.x; r.at[1] = r.z;
    }
    lureAt = lureStep(lureAt, dt, L, near);
    bendPoint(lureAt.x, 0, lureAt.z, PLANET_R, P); lure.position.set(P[0], P[1], P[2]);
    for (const r of records) family.track(r.h, { x: r.x, z: r.z, ax: lureAt.x, az: lureAt.z, dt, speed: r.walk });
    pearl.step(dt, cam, height); cutis?.step(dt, cam, height);
    if (mode === 'silhouette') hideCores();
  }
  // the scene into `target` (its own clear: the scene's background), the renderer's target put back to the canvas
  function render(renderer, target) {
    cam.aspect = target.width / Math.max(1, target.height); cam.updateProjectionMatrix();
    renderer.setRenderTarget(target); renderer.render(scene, cam); renderer.setRenderTarget(null);
  }
  function counts() {
    let bodies = 0; const levels = [0, 0, 0, 0];
    for (const s of [...Object.values(pearl.stats()), ...Object.values(cutis?.stats() ?? {})]) { bodies += s.live; if (s.lod) for (let k = 0; k < 4; k++) levels[k] += s.lod[k]; }
    return { bodies, levels };
  }
  return {
    show, setPack, step, render,
    state: () => ({ entry: entry?.id ?? null, mode, pack, type: kind === 'cutis' ? `cutis:${S.creatureTier}` : type, ...counts(), lure: mode === 'full' ? [+lureAt.x.toFixed(2), +lureAt.z.toFixed(2)] : null,
      dark: darkened, nearest: records.length ? +Math.min(...records.map((r) => Math.hypot(r.x - lureAt.x, r.z - lureAt.z))).toFixed(2) : null, force: lod.force }),
    dispose() { clear(); pearl.dispose(); cutis?.dispose(); for (const d of disposables) d.dispose(); },
  };
}
