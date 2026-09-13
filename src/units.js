import { makeOrdnanceShell } from './shell.js';
// units.js — the unit roster. Two construction kinds:
//
//   cloud — Braille dot-clouds (creatures.js): ~500–700 points, deformed in
//           the VERTEX SHADER (fx/dot-material.js, motion in
//           content/dot-wobble.js). This used to be a CPU re-pose per frame
//           per instance — 13.6 us and an 8.1 KB upload for one amoeba, which
//           is why the game left the authored creatures unanimated. Measured
//           2026-09-13: on the GPU the same motion is unmeasurable, and 2000
//           merged clouds are one draw call.
//   mesh  — low-poly polygon groups: static geometry, GPU transforms,
//           animation is transform-only (userData.tick rotates/bobs parts).
//           This is the battle-scale path: hundreds of these are cheap,
//           and the step to InstancedMesh (1 draw call per unit type) is
//           mechanical when the time comes.
//
// Conventions: y-up, +Z forward, normalized to unit radius (baseScale holds
// the normalization factor — multiply, don't overwrite, when sizing).
// userData: { kind, lift (fraction of world size to hover above the floor),
// tick(t) (idle animation) }.

import * as THREE from '../vendor/three.module.js';
import { makeDotMaterial } from './fx/dot-material.js';
import { makeMork, makeMorkTier, makeMorkProxy } from './mork.js';
export { preloadMork, preloadMorkTier, preloadMorkProxy } from './mork.js';
import { makeJelly } from './jelly.js';
import { EMOTION_IDS, emotion, phosphorFor } from './emotions.js';
import { printPhase, printOffset, printOn } from './printpath.js';
import { ISAO_MODEL, ISAO_FACE_CLIPS, ISAO_IDLE_CLIPS } from './content/isao-faces.js';
import { loadGlb, loadGlbWithClips, mergeByMaterial, fitModel, tintModel, makeShellRack,
  addEdgeOutlines, makeHeatSleeve } from './glbmodels.js';
import { CREATURES, thinCloud, spherePts, bulletPts, missilePts, heartPts, torusPts, cloudFormPoints, enemyDotPts, portalPts, personPts } from './creatures.js';
import { STARGATE_PTS, STARGATE_STROKE,
  HORIZON_N, stargateHorizon } from './stargate.js';
import { ENEMY_SPEC } from './enemyspec.js';

function normalizeToUnit(group) {
  group.updateMatrixWorld(true);
  let r = 0;
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      r = Math.max(r, v.length());
    }
  });
  if (r > 0) group.scale.setScalar(1 / r);
  group.userData.baseScale = group.scale.x;
  return group;
}

// tank — the mesh-unit proof of concept: hull, treads, turret that sweeps,
// barrel. ~350 triangles, one Lambert material per tint. Tron dressing:
// thin neon white/blue edge lines on the slabs (EdgesGeometry children,
// so they ride each part's transform), a 3×3 diegetic shell rack on the
// turret roof (userData.ammoDots — the game tints them full/empty), and
// two toed-in laser mini-guns at the hull front (userData.laserGuns —
// aim derives from THEIR world transforms, same-source principle).
function makeTank(cols) {
  const main = new THREE.MeshLambertMaterial({ color: cols.walker });
  const accent = new THREE.MeshLambertMaterial({ color: cols.walkerHi });
  const edgeWhite = new THREE.LineBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.9 });
  const edgeBlue = new THREE.LineBasicMaterial({ color: 0x5fc9ff, transparent: true, opacity: 0.85 });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const outline = (mesh, mat) => {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat));
  };
  const hull = add(new THREE.BoxGeometry(1.3, 0.4, 2.0), main, 0, 0.48, 0);
  outline(hull, edgeWhite);
  const treadL = add(new THREE.BoxGeometry(0.42, 0.46, 2.35), main, -0.82, 0.26, 0);
  const treadR = add(new THREE.BoxGeometry(0.42, 0.46, 2.35), main, 0.82, 0.26, 0);
  outline(treadL, edgeBlue);
  outline(treadR, edgeBlue);
  const turret = new THREE.Group();
  turret.position.set(0, 0.84, -0.12);
  turret.userData.baseZ = -0.12; // recoil slides the turret back from here
  g.add(turret);
  const turretBox = add(new THREE.BoxGeometry(0.8, 0.34, 1.0), main, 0, 0, 0, turret);
  outline(turretBox, edgeWhite);
  const barrel = add(new THREE.CylinderGeometry(0.06, 0.085, 1.5, 8), accent, 0, 0.04, 1.15, turret);
  barrel.rotation.x = Math.PI / 2;
  // cannon heat sleeve: a collar around the barrel's middle that the game
  // glows red-hot after a shot and cools back to gunmetal (userData ref)
  const sleeve = add(new THREE.CylinderGeometry(0.105, 0.105, 0.45, 8),
    new THREE.MeshBasicMaterial({ color: 0x232833 }), 0, 0.04, 0.95, turret);
  sleeve.rotation.x = Math.PI / 2;
  // shell rack: 3×3 dots on the turret roof, row-major — index < ammo lit
  const dotGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const ammoDots = [];
  for (let r = 0; r < 3; r++) {
    for (let c2 = 0; c2 < 3; c2++) {
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dot.position.set((c2 - 1) * 0.24, 0.2, (r - 1) * 0.28);
      turret.add(dot);
      ammoDots.push(dot);
    }
  }
  // mini-guns: hull front corners, ~5° toe-in so the bursts converge ahead
  const gunGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.55, 6).rotateX(Math.PI / 2);
  const gunMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
  const laserGuns = [];
  for (const side of [-1, 1]) {
    const gun = new THREE.Group();
    gun.position.set(side * 0.42, 0.42, 1.02);
    // ONE CONSTANT FOR BOTH TANKS. The procedural fallback used to carry its
    // own hardcoded 0.09, so narrowing the mkcx's toe changed nothing on the
    // fallback — and the fallback is what a headless run measures, which made
    // the tuning invisible to every probe.
    gun.rotation.y = -side * SECONDARY_TOE; // +Z toed toward the centerline
    const tube = new THREE.Mesh(gunGeo, gunMat);
    tube.position.z = 0.12;
    gun.add(tube);
    g.add(gun);
    laserGuns.push(gun);
  }
  g.userData.turret = turret; // battle aims along this group's world +Z
  g.userData.ammoDots = ammoDots;
  g.userData.laserGuns = laserGuns;
  g.userData.heatSleeve = sleeve;
  g.userData.tick = (t) => { turret.rotation.y = Math.sin(t * 0.6) * 0.7; };
  g.userData.lift = 0.02;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// drone — second mesh unit: octahedron core in a halo ring, hovers
function makeDrone(cols) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  body.position.y = 0.8;
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 26),
    new THREE.MeshLambertMaterial({ color: cols.walkerHi }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.8;
  g.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshBasicMaterial({ color: cols.walkerHi }));
  eye.position.set(0, 0.8, 0.5);
  g.add(eye);
  g.userData.tick = (t) => {
    body.rotation.y = t * 0.9;
    ring.rotation.y = Math.sin(t * 1.3) * 0.18;
    body.position.y = 0.8 + Math.sin(t * 2.1) * 0.06;
  };
  g.userData.lift = 0.15;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// ghost — HokorobiTawaa's Wave Ghost: agile flyer, pale yellow. Dome +
// skirt + dark eyes; bobs on its inner group while the root stays
// lookAt-owned.
function makeGhost(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.75;
  g.add(inner);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  inner.add(dome);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.5, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: cols.walker, side: THREE.DoubleSide }));
  skirt.position.y = -0.25;
  inner.add(skirt);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1c26 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
    eye.position.set(side * 0.2, 0.12, 0.46);
    inner.add(eye);
  }
  g.userData.tick = (t) => { inner.position.y = 0.75 + Math.sin(t * 2.4) * 0.12; };
  g.userData.lift = 0.3;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// scoutufo — HokorobiTawaa's Scout UFO: fast scout. Saucer disc + dome +
// spinning underring.
function makeUfo(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.75;
  g.add(inner);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 8),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  disc.scale.y = 0.32;
  inner.add(disc);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: cols.walkerHi }));
  dome.position.y = 0.16;
  inner.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20),
    new THREE.MeshBasicMaterial({ color: cols.walkerHi }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.12;
  inner.add(ring);
  g.userData.tick = (t) => { inner.rotation.y = t * 2.2; };
  g.userData.lift = 0.35;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// gslime — HokorobiTawaa's Green Slime: soft regenerator. A squashed
// blob with a jelly squash-stretch tick.
function makeSlime(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.5;
  g.add(inner);
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 9),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  blob.scale.set(1, 0.68, 1);
  inner.add(blob);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: cols.walkerHi }));
  nucleus.position.y = 0.1;
  inner.add(nucleus);
  g.userData.tick = (t) => {
    const sy = 1 + 0.14 * Math.sin(t * 3.1);
    inner.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  };
  g.userData.lift = 0.02;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// drifter — HokorobiTawaa's Wave Saturn: erratic drifter, dual-coded
// yellow body + blue ring (E_BLUE 0x5a6bff, per the source roster).
function makeSaturn(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.8;
  g.add(inner);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  inner.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 6, 24),
    new THREE.MeshLambertMaterial({ color: 0x5a6bff }));
  ring.rotation.x = Math.PI / 2 + 0.4; // the Saturn tilt
  inner.add(ring);
  g.userData.tick = (t) => {
    inner.rotation.y = t * 0.7;
    inner.rotation.z = Math.sin(t * 1.1) * 0.15;
  };
  g.userData.lift = 0.3;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// corona — HokorobiTawaa's Coronavirus: armored spiked sphere, slows
// itself when shot. Root stays lookAt-owned; the inner group spins.
function makeCorona(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.75;
  g.add(inner);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  inner.add(core);
  const spikeGeo = new THREE.ConeGeometry(0.11, 0.42, 5);
  const spikeMat = new THREE.MeshLambertMaterial({ color: cols.walkerHi });
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 14; i++) {
    // fibonacci directions so the crown reads from every side
    const y = 1 - (2 * (i + 0.5)) / 14;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.399963;
    const d = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.copy(d).multiplyScalar(0.72);
    spike.quaternion.setFromUnitVectors(up, d);
    inner.add(spike);
  }
  g.userData.tick = (t) => { inner.rotation.y = t * 0.5; };
  g.userData.lift = 0.12;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// barbed — HokorobiTawaa's Barbed Mine: sea-mine that SPEEDS UP when
// shot. Long barbs, an angry per-tick twist on the inner group.
function makeMine(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.7;
  g.add(inner);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  inner.add(core);
  const barbGeo = new THREE.CylinderGeometry(0.03, 0.09, 0.6, 5);
  const barbMat = new THREE.MeshLambertMaterial({ color: cols.walkerHi });
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 10; i++) {
    const y = 1 - (2 * (i + 0.5)) / 10;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.399963;
    const d = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
    const barb = new THREE.Mesh(barbGeo, barbMat);
    barb.position.copy(d).multiplyScalar(0.72);
    barb.quaternion.setFromUnitVectors(up, d);
    inner.add(barb);
  }
  g.userData.tick = (t) => { inner.rotation.y = Math.sin(t * 1.5) * 0.5; };
  g.userData.lift = 0.06;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// knot — HokorobiTawaa's Solving Torus boss: accelerates when hit.
// One torus-knot mesh, slow menacing spin + breath on the inner group.
function makeKnot(cols) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.85;
  g.add(inner);
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.15, 48, 8),
    new THREE.MeshLambertMaterial({ color: cols.walker }));
  inner.add(knot);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: cols.walkerHi }));
  inner.add(eye);
  g.userData.tick = (t) => {
    inner.rotation.y = t * 0.4;
    inner.rotation.x = Math.sin(t * 0.7) * 0.3;
    inner.scale.setScalar(1 + 0.05 * Math.sin(t * 2.4));
  };
  g.userData.lift = 0.25;
  normalizeToUnit(g);
  g.userData.kind = 'mesh';
  return g;
}

// cloud units — Points that deform in the vertex shader. One uniform a frame,
// no buffer upload, so an instance costs what a still one costs.
function makeCloud(name, cols) {
  const base = CREATURES[name]();
  const out = new Float32Array(base.length * 3);
  // THE REST POSE, NOT A POSED FRAME. This used to upload waveJelly(base, 0),
  // which was right while the CPU owned every frame. The shader wobbles from
  // whatever it is given, and waveJelly at t=0 is NOT the identity — its
  // ripple term is spatial — so seeding a posed frame deformed the body twice.
  for (let i = 0; i < base.length; i++) {
    out[i * 3] = base[i][0]; out[i * 3 + 1] = base[i][1]; out[i * 3 + 2] = base[i][2];
  }
  const colors = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(cols.walker);
  const cHi = new THREE.Color(cols.walkerHi);
  for (let i = 0; i < base.length; i++) {
    const c = base[i][3] === 1 ? cHi : cBody;
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pts = new THREE.Points(geo, makeDotMaterial({ size: 2.2, wobble: true }));
  pts.userData.tick = (t) => pts.material.userData.setTime(t);
  pts.userData.baseScale = 1;
  pts.userData.lift = 0.85;
  pts.userData.kind = 'cloud';
  return pts;
}

// --- orb clouds: Braille dotted spheres under five treatments -------------
// Each orb is ~170 points; treatments re-pose (or re-tint) per frame. At a
// few dozen orbs this is ~5k point updates/frame — negligible. The hash
// gives each point a stable random phase.
const hsh = (i) => {
  const s = Math.sin(i * 127.1 + 0.7) * 43758.5453;
  return s - Math.floor(s);
};

export const ORB_FX = ['spin', 'breathe', 'twinkle', 'wave', 'scatter'];

export function makeOrbCloud(fx, cols, phase = 0) {
  const base = spherePts(170);
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(cols.body);
  const cHi = new THREE.Color(cols.hi);
  const baseCol = new Float32Array(base.length * 3);
  for (let i = 0; i < base.length; i++) {
    const c = base[i][3] === 1 ? cHi : cBody;
    baseCol[i * 3] = c.r; baseCol[i * 3 + 1] = c.g; baseCol[i * 3 + 2] = c.b;
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
  }
  col.set(baseCol);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));

  const repose = (f) => {
    for (let i = 0; i < base.length; i++) {
      const [x, y, z] = f(base[i], i);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    geo.getAttribute('position').needsUpdate = true;
  };

  const tick = {
    spin: (t) => {
      const a = t * 1.5 + phase, c = Math.cos(a), s = Math.sin(a);
      repose((p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]);
    },
    breathe: (t) => {
      // transform-only: cheapest treatment of the five
      pts.scale.setScalar(pts.userData.sizeScale * (1 + 0.16 * Math.sin(t * 2 + phase)));
    },
    twinkle: (t) => {
      const attr = geo.getAttribute('color');
      for (let i = 0; i < base.length; i++) {
        const b = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2 + hsh(i) * 6.283));
        attr.setXYZ(i, baseCol[i * 3] * b, baseCol[i * 3 + 1] * b, baseCol[i * 3 + 2] * b);
      }
      attr.needsUpdate = true;
    },
    wave: (t) => {
      repose((p) => {
        const d = 1 + 0.14 * Math.sin(3 * Math.atan2(p[2], p[0]) + t * 3 - p[1] * 2 + phase);
        return [p[0] * d, p[1], p[2] * d];
      });
    },
    scatter: (t) => {
      const k = Math.pow(Math.max(0, Math.sin(t * 0.9 + phase)), 2);
      repose((p, i) => {
        const r = 1 + 1.0 * k * (0.25 + 0.75 * hsh(i));
        return [p[0] * r, p[1] * r, p[2] * r];
      });
    },
  }[fx] || (() => {});

  pts.userData.kind = 'orb';
  pts.userData.fx = fx;
  pts.userData.sizeScale = 1;
  pts.userData.tick = tick;
  return pts;
}

// --- debris: a unit's own polygons scatter and fade -----------------------
// Bakes the object's world-space triangle soup into one geometry; each
// triangle gets a velocity away from the center (outward-normal bias +
// jitter), drifts, spins around its centroid is skipped — translation and
// fade sell the coming-apart at this scale. tick(dt) -> false when spent.
// what a mesh with no colour of its own shatters into
const DEBRIS_FALLBACK = new THREE.Color(0xbfd4dd);

export function makeDebris(obj, outwardN) {
  obj.updateMatrixWorld(true);
  const center = new THREE.Vector3();
  obj.getWorldPosition(center);
  const triPos = [];
  const triCol = [];
  const v = new THREE.Vector3();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry;
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    // A MESH MAY NOT HAVE A `material.color`. Every mesh that ever came
    // through here was Lambert or Basic, so this read the property straight —
    // and the first ShaderMaterial unit (the jelly) made makeDebris THROW,
    // inside killCreature, BEFORE the scene.remove that follows it. The boss
    // died, its debris never appeared, and its body stayed on the board
    // forever. A missing colour should cost the debris its tint, not cost the
    // corpse its removal.
    const col = m.material.color
      || (m.material.uniforms && m.material.uniforms.uColor && m.material.uniforms.uColor.value)
      || DEBRIS_FALLBACK;
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i++) {
      const vi = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld);
      triPos.push(v.x, v.y, v.z);
      triCol.push(col.r, col.g, col.b);
    }
  });
  const nTri = Math.floor(triPos.length / 9);
  const vels = new Float32Array(nTri * 3);
  const hshf = (i) => { const s = Math.sin(i * 71.7 + 1.3) * 43758.5453; return s - Math.floor(s); };
  const scale = obj.scale.x;
  for (let ti = 0; ti < nTri; ti++) {
    const cx = (triPos[ti * 9] + triPos[ti * 9 + 3] + triPos[ti * 9 + 6]) / 3 - center.x;
    const cy = (triPos[ti * 9 + 1] + triPos[ti * 9 + 4] + triPos[ti * 9 + 7]) / 3 - center.y;
    const cz = (triPos[ti * 9 + 2] + triPos[ti * 9 + 5] + triPos[ti * 9 + 8]) / 3 - center.z;
    const l = Math.hypot(cx, cy, cz) || 1e-6;
    const speed = (0.55 + hshf(ti) * 0.9) * scale;
    vels[ti * 3] = (cx / l + outwardN[0] * 0.6 + (hshf(ti + 99) - 0.5) * 0.5) * speed;
    vels[ti * 3 + 1] = (cy / l + outwardN[1] * 0.6 + (hshf(ti + 202) - 0.5) * 0.5) * speed;
    vels[ti * 3 + 2] = (cz / l + outwardN[2] * 0.6 + (hshf(ti + 307) - 0.5) * 0.5) * speed;
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.Float32BufferAttribute(triPos, 3);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(triCol, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const LIFE = 1.15;
  let life = 0;
  mesh.userData.tick = (dt) => {
    life += dt;
    for (let ti = 0; ti < nTri; ti++) {
      for (let k = 0; k < 3; k++) {
        const j = ti * 3 + k;
        posAttr.setXYZ(j,
          posAttr.getX(j) + vels[ti * 3] * dt,
          posAttr.getY(j) + vels[ti * 3 + 1] * dt,
          posAttr.getZ(j) + vels[ti * 3 + 2] * dt);
      }
    }
    posAttr.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - life / LIFE);
    return life < LIFE;
  };
  return mesh;
}

// dot enemies — the WHOLE TD roster as half-dotted STATIC clouds.
// The original three creatures use their rich generators (posed once,
// never re-posed); the borrowed types use enemyDotPts silhouettes.
// Animation is transform-only per type (spin / bob / squash) except the
// authored three and the swimmers, which deform on the GPU. Either way a
// crowd costs what a still crowd costs.
// Every entry takes a DENSITY factor d (default 1): the game builds at
// d=1 (crowds), the unit viewer at d=4 — one unit on screen at a time can
// afford to be generous (operator ruling). The authored three are THINNED
// rather than resampled, and cannot go above their written count.
const DOT_SHAPES = {
  // the authored three honour the density factor now, by thinning: they are
  // the densest bodies on the roster and were the only ones a crowd could not
  // turn down. See creatures.thinCloud for the measurement behind it.
  phage: (d = 1) => thinCloud(CREATURES.phage(), d),
  amoeba: (d = 1) => thinCloud(CREATURES.amoeba(), d),
  jellyfish: (d = 1) => thinCloud(CREATURES.jellyfish(), d),
  ghost: (d = 1) => enemyDotPts('ghost', Math.round(150 * d)),
  // The flying saucer, replaced by the lab's bacterium — a rod body with
  // flagella. Reverting is this one line: enemyDotPts('ufo').
  //
  // Turned onto its travel axis at BUILD time, not at render time: enemies
  // are oriented every frame by lookAt, which overwrites the object's
  // quaternion, so a rotation set on the object would be thrown away. The
  // model runs along X with the flagella at -X; enemies face +Z; so
  // (x, y, z) -> (-z, y, x) puts the head forward and the tail behind.
  scoutufo: (d = 1) => cloudFormPoints('bacterium', Math.round(170 * d))
    .map((p) => (p.length > 3 ? [-p[2], p[1], p[0], p[3]] : [-p[2], p[1], p[0]])),
  gslime: (d = 1) => enemyDotPts('slime', Math.round(150 * d)),
  drifter: (d = 1) => enemyDotPts('saturn', Math.round(150 * d)),
  corona: (d = 1) => enemyDotPts('corona', Math.round(150 * d)),
  barbed: (d = 1) => enemyDotPts('seamine', Math.round(150 * d)),
  rolling: (d = 1) => enemyDotPts('seamine', Math.round(150 * d)),
  prime: (d = 1) => enemyDotPts('seamine', Math.round(150 * d)),
  knot: (d = 1) => enemyDotPts('knot', Math.round(150 * d)),
  // the invasion roster: the saucer is the lab's ufo (freed when the
  // bacterium took scoutufo's slot); the shellback wears the lab's
  // seashell spiral; the phantom re-uses the ghost — camo does the rest
  saucer: (d = 1) => enemyDotPts('ufo', Math.round(150 * d)),
  // recentred on the CENTROID, not the bbox: a log spiral's mass sits in
  // its outer whorl (measured centroid 0.28, 0.48 after fitUnit), and the
  // solid core renders at the origin — uncentred, the core floated beside
  // the shell instead of inside it
  shellback: (d = 1) => {
    const pts = cloudFormPoints('shell', Math.round(400 * d)); // a spiral is all surface — it needs density
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    // pulled in to 0.78: a log spiral's outer whorl scatters wide, and at
    // full span the cloud read as dust AROUND the core instead of a body
    const K = 0.78;
    return pts.map((p) => (p.length > 3
      ? [(p[0] - cx) * K, (p[1] - cy) * K, (p[2] - cz) * K, p[3]]
      : [(p[0] - cx) * K, (p[1] - cy) * K, (p[2] - cz) * K]));
  },
  phantom: (d = 1) => enemyDotPts('ghost', Math.round(150 * d)),
};

// The solid core a NON-RAMMABLE enemy wears. Half-dotted is this game's
// word for "enemy", and it stays that — but a player has to be able to tell,
// before committing the tank at it, which ones will go under the treads and
// which ones will stop them dead. So the ones that will not give way carry
// one piece of SOLID geometry inside the cloud. Solid means "this has mass",
// which is exactly the thing being communicated.
//
// Shaped per family rather than one generic lump, so it also reads as part
// of that creature: the drifter's core, the corona's ring, the mine's shell.
// Sized to roughly a THIRD of the cloud's span, not half. The cloud is still
// the creature; the core is the part of it that will not give way. At 0.46
// the octahedron reached the drifter's own ring and the dots stopped reading
// as the body at all.
const HARD_CORE = {
  drifter: () => new THREE.OctahedronGeometry(0.34),
  corona: () => new THREE.TorusGeometry(0.42, 0.12, 8, 16).rotateX(Math.PI / 2),
  barbed: () => new THREE.IcosahedronGeometry(0.32),
  shellback: () => new THREE.SphereGeometry(0.2, 8, 6),
  phantom: () => new THREE.IcosahedronGeometry(0.24), // the Predator glint
};

// The shape behind a dot enemy, as points. Exported so a cinematic can
// densify the game's own creature (cine/cloud.js) instead of carrying a copy.
export function dotShapePts(type, dens = 1) {
  return (DOT_SHAPES[type] || ((d = 1) => spherePts(Math.round(140 * d))))(dens);
}

// makeSurvivor — a stranded astronaut and the beacon that makes them
// findable. The FIGURE is the silhouette (personPts: suited, one arm up);
// the BEACON is the motion, a column of dots climbing out of the helmet and
// fading, which is the part that survives being twenty pixels on an orbital
// view. A static figure at that size is a smudge; a smudge with something
// rising out of it is a person.
//
// Two states and no more: standing (survivor orange) and GRABBED (red, and
// the beacon stops climbing — the thing that says "look here" going out is
// exactly the alarm). Saving and dying are the board's business; it removes
// the object.
export function makeSurvivor(cols = {}) {
  const body = new THREE.Color(cols.body ?? 0xffb45e);
  const hi = new THREE.Color(cols.hi ?? 0xfff4d6);
  const alarm = new THREE.Color(cols.alarm ?? 0xff4d5e);
  const base = personPts();
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  for (let i = 0; i < base.length; i++) {
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
    const c = base[i][3] === 1 ? hi : body;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const fig = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 1 }));

  // the beacon: BEAM dots climbing from the helmet, respawned at the bottom
  const BEAM = 26, BEAM_TOP = 3.4;
  const bpos = new Float32Array(BEAM * 3);
  const bcol = new Float32Array(BEAM * 3);
  const phase = new Float32Array(BEAM);
  for (let i = 0; i < BEAM; i++) phase[i] = i / BEAM;
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  bgeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
  const beam = new THREE.Points(bgeo, new THREE.PointsMaterial({
    size: 2.0, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9 }));

  const grp = new THREE.Group();
  grp.add(fig); grp.add(beam);
  let grabbed = false;
  grp.userData.setGrabbed = (v) => {
    if (grabbed === v) return;
    grabbed = v;
    const c = v ? alarm : body;
    for (let i = 0; i < base.length; i++) {
      const cc = base[i][3] === 1 ? (v ? alarm : hi) : c;
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    geo.getAttribute('color').needsUpdate = true;
  };
  grp.userData.tick = (t) => {
    // held, the column stops climbing and just glows: the thing that says
    // "over here" going still is the alarm
    for (let i = 0; i < BEAM; i++) {
      const u = grabbed ? phase[i] * 0.35 : (phase[i] + t * 0.42) % 1;
      const y = 0.95 + u * BEAM_TOP;
      const wob = 0.045 * Math.sin(u * 9 + i);
      bpos[i * 3] = wob; bpos[i * 3 + 1] = y; bpos[i * 3 + 2] = wob * 0.6;
      const f = (1 - u) * (grabbed ? 0.9 : 1);
      const c = grabbed ? alarm : hi;
      bcol[i * 3] = c.r * f; bcol[i * 3 + 1] = c.g * f; bcol[i * 3 + 2] = c.b * f;
    }
    bgeo.getAttribute('position').needsUpdate = true;
    bgeo.getAttribute('color').needsUpdate = true;
  };
  grp.userData.tick(0);
  return grp;
}

// The bodies that deform. The rest of the roster reads as machinery and keeps
// its transform-only idle; these three are the authored organic ones.
const WOBBLERS = new Set(['amoeba', 'phage', 'jellyfish']);

// Per-creature swim tuning. The motion itself is content/dot-wobble.js.
const SWIM = {
  scoutufo: { amp: 0.26, beat: 7.0, along: 4.0, jelly: 0.10 },
  // the shell/wave pairing the operator named: the spiral breathes
  shellback: { amp: 0.20, beat: 4.6, along: 3.0, jelly: 0.16 },
};

const spanOf = (swim, base) => {
  let zMin = Infinity, zMax = -Infinity;
  for (const p of base) { if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2]; }
  return { ...swim, zMin, zMax };
};

// A crowd pulsing in lockstep reads as one organism, so every body gets its
// own offset. Counted, not random: game logic may not call Math.random, and a
// replay must build the same board twice.
let dotSeq = 0;
const dotPhase = () => { dotSeq = (dotSeq + 1) % 1024; return (dotSeq * 2.39996) % 6.28318; };

export function makeDotEnemy(type, cols, dens = 1) {
  const base = dotShapePts(type, dens);
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(cols.walker);
  const cHi = new THREE.Color(cols.walkerHi);
  for (let i = 0; i < base.length; i++) {
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
    const c = base[i][3] === 1 ? cHi : cBody;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // WHICH BODIES DEFORM. The three authored creatures came over from the
  // Braille lab with rich generators and no idle at all: in gameplay an
  // amoeba was a STATIC cloud, because waveJelly only ever ran in the unit
  // viewer's one-at-a-time carousel. They deform now, on the GPU, which is
  // the whole point of the port — measured at 13.6 us/frame each on the CPU
  // and unmeasurable in the vertex shader.
  const wobble = WOBBLERS.has(type);
  const swimOpts = SWIM[type] ? spanOf(SWIM[type], base) : null;
  const pts = new THREE.Points(geo, makeDotMaterial({
    size: 2.1, wobble, swim: swimOpts, phase: dotPhase(),
  }));
  // Swimmers deform their BODY rather than their transform — a transform can
  // turn a creature but cannot make it beat. That deformation used to be a
  // CPU pass over the cloud with a buffer upload behind it; it is a vertex
  // shader now. Everything else keeps the transform-only idle below.
  // Anything the shader animates ticks by advancing one uniform. No pass over
  // the cloud, no buffer re-upload: a crowd costs what a still crowd costs.
  if (wobble || swimOpts) pts.userData.tick = (t) => pts.material.userData.setTime(t);

  // transform-only idles, one flavor per family
  const TICKS = {
    // NEVER WRITE AN ABSOLUTE POSITION IN AN IDLE TICK. This used to open
    // with `pts.position.y = 0` — harmless on a viewer stage where the model
    // sits at the origin, catastrophic in the game, where td-tab writes the
    // enemy's world position and THEN calls this. Zeroing y on a unit sphere
    // drops the body inside the planet: invisible, but still alive and still
    // taking hits, because every hit test uses `e.pos` and not the mesh.
    // Measured on wave 2 — ghosts drawn 12.13 cells from where they were,
    // all of them buried. An idle may rotate or scale; position belongs to
    // whoever placed the object.
    ghost: (t) => { pts.rotation.y = Math.sin(t * 1.2) * 0.4; },
    scoutufo: (t) => { pts.rotation.y = t * 2.4; },
    gslime: (t) => {
      // s0 is written by the CONSUMER after construction, so a caller that
      // does not set it (the unit viewer, for one) would multiply undefined
      // and hand three.js a NaN scale — which is invisible in exactly the
      // same way, and silent.
      const s0 = pts.userData.s0 ?? pts.scale.x ?? 1;
      const sy = 1 + 0.14 * Math.sin(t * 3);
      pts.scale.y = s0 * sy;
      pts.scale.x = pts.scale.z = s0 / Math.sqrt(sy);
    },
    drifter: (t) => { pts.rotation.y = t * 0.8; },
    corona: (t) => { pts.rotation.y = t * 0.9; },
    barbed: (t) => { pts.rotation.y = Math.sin(t * 1.5) * 0.6; },
    rolling: (t) => { pts.rotation.y = t * 1.1; },
    prime: (t) => { pts.rotation.y = t * 0.5; },
    knot: (t) => { pts.rotation.y = t * 0.7; pts.rotation.x = Math.sin(t * 0.8) * 0.3; },
  };
  // A body the shader animates already has its tick — it advances the time
  // uniform — and `tick` is one slot, so letting the table overwrite it would
  // freeze the wobble at t=0 with no error anywhere. The wobble carries its
  // own slow spin, so nothing is lost by skipping the idle here.
  if (!swimOpts && !wobble) {
    pts.userData.tick = TICKS[type] || ((t) => { pts.rotation.y = Math.sin(t) * 0.25; });
  }
  pts.userData.s0 = 1; // scale captured by the game after sizing
  pts.userData.lift = { ghost: 0.9, scoutufo: 0.95, drifter: 0.85, knot: 0.8 }[type] ?? 0.6;
  pts.userData.kind = 'cloud';
  pts.userData.baseScale = 1;

  // The core is a CHILD of the Points, not a Group wrapping both. Callers
  // reach for `obj.geometry` and `obj.material` on the enemy directly, and
  // wrapping would have silently broken the hit flash and the disposal —
  // the same trap the pickups fell into. As a child, every existing call
  // site keeps working and the core just comes along.
  const spec = ENEMY_SPEC[type];
  if (spec && spec.rammable === false) {
    const geo = (HARD_CORE[type] || (() => new THREE.OctahedronGeometry(0.32)))();
    const core = solidWithEdges(geo, cols.walker, cols.walkerHi ?? 0xffffff);
    // The cloud's material is vertexColors, so white is NEUTRAL there and the
    // slow tint can just set white to clear itself. A solid has no vertex
    // colours, so white would erase its body colour instead of clearing a
    // tint — it needs to be told what to go back to.
    core.userData.baseColor = core.material.color.getHex();
    pts.add(core);
    pts.userData.solid = core;   // td-tab tints this alongside the cloud
  }
  return pts;
}

// portal — the braille-lab half-dotted STATIC torus: an upright dotted
// ring under the twinkle treatment (per-dot brightness shimmer; no
// re-posing — the ring itself never moves, only its light does).
// userData.setDim(f) scales all brightness — the game dims a portal as
// it takes damage. Ring lies in local X-Y: align +Y to the surface
// normal and it stands like a gate.
export function makePortalCloud(cols, phase = 0) {
  // The authored lab gate rather than our own generated one. Fewer points
  // (435 against 1150) and far better ones: the chevrons are placed, not
  // derived, and the point ORDER is a drawing order — which is what lets the
  // gate dial itself in with nothing more than a draw range.
  const base = STARGATE_PTS;
  // ring + chevrons first, then the event horizon. The order is deliberate:
  // revealed by index the gate draws its ring, locks its chevrons, and only
  // then does the throat light up — which is the sequence the thing is
  // named for, and it costs nothing but the ordering.
  const N = base.length + HORIZON_N;
  const H0 = base.length;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const baseCol = new Float32Array(N * 3);
  const hBri = new Float32Array(HORIZON_N);   // per-dot shimmer, written per frame
  const cBody = new THREE.Color(cols.body);
  const cHi = new THREE.Color(cols.hi);
  for (let i = 0; i < base.length; i++) {
    const c = base[i][3] === 1 ? cHi : cBody;
    baseCol[i * 3] = c.r; baseCol[i * 3 + 1] = c.g; baseCol[i * 3 + 2] = c.b;
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
  }
  for (let i = H0; i < N; i++) {
    baseCol[i * 3] = cBody.r; baseCol[i * 3 + 1] = cBody.g; baseCol[i * 3 + 2] = cBody.b;
  }
  // Position the horizon at t=0 IN THE CONSTRUCTOR. Its dots are otherwise
  // placed only by the idle tick, which the dial-in skips — so through the
  // whole draw-on they sat at the ORIGIN, and the reveal's final act was a
  // clump of dots in the gate's throat instead of the disc. Anyone standing
  // next to a forming gate (a fresh spawn, say) watched exactly that.
  stargateHorizon(0, pos, new Float32Array(HORIZON_N), H0);
  col.set(baseCol);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));
  const hshf = (i) => { const s = Math.sin(i * 127.1 + 0.7) * 43758.5453; return s - Math.floor(s); };
  const repose = (f) => {
    for (let i = 0; i < base.length; i++) {
      const [x, y, z] = f(base[i], i);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    geo.getAttribute('position').needsUpdate = true;
  };
  const twinkle = (t) => {
    const attr = geo.getAttribute('color');
    // the horizon is a surface in motion: its dots are placed and lit every
    // frame, where the ring's only ever change brightness
    stargateHorizon(t, pos, hBri, H0);
    for (let i = 0; i < HORIZON_N; i++) {
      const k = H0 + i, b = hBri[i];
      attr.setXYZ(k, Math.min(1, cBody.r * b), Math.min(1, cBody.g * b), Math.min(1, cBody.b * b));
    }
    geo.getAttribute('position').needsUpdate = true;
    for (let i = 0; i < base.length; i++) {
      const slow = 0.5 + 0.5 * Math.sin(t * 4.2 + phase + hshf(i) * 6.283);
      const fast = 0.65 + 0.35 * Math.sin(t * 9.7 + hshf(i + 71) * 6.283);
      const b = 0.25 + 0.75 * slow * fast;
      attr.setXYZ(i, baseCol[i * 3] * b, baseCol[i * 3 + 1] * b, baseCol[i * 3 + 2] * b);
    }
    attr.needsUpdate = true;
  };
  // stargate: two-frequency shimmer (the same twinkle used for the ring)
  pts.userData.tick = twinkle;
  // dim rides the MATERIAL color (multiplies vertex colors), so every
  // treatment — color- or position-based — dims the same way
  pts.userData.setDim = (f) => { pts.material.color.setScalar(f); };

  // --- dialling in ---------------------------------------------------------
  // A gate used to simply be there. Now it DRAWS: the stroke sweeps round the
  // ring, then the nine chevrons lock one after another, and the leading dots
  // burn brighter than the settled ones so the eye follows the head.
  //
  // No keyframes and no second geometry — the lab's own point order already
  // describes the motion, so this is a draw range and a gradient behind it.
  let form = 1;
  const HEAD = 26;   // dots behind the head that still glow hot
  pts.userData.setForm = (f) => {
    form = Math.max(0, Math.min(1, f));
    const shown = Math.max(1, Math.round(form * N));
    geo.setDrawRange(0, shown);
    if (form >= 1) return;
    // repaint only the head; the tail keeps whatever twinkle last wrote
    const attr = geo.getAttribute('color');
    for (let i = Math.max(0, shown - HEAD); i < Math.min(shown, base.length); i++) {
      const heat = 1 - (shown - i) / HEAD;          // 0 at the tail, 1 at the tip
      const b = 1 + 2.4 * heat * heat;
      attr.setXYZ(i, Math.min(1, baseCol[i * 3] * b),
        Math.min(1, baseCol[i * 3 + 1] * b), Math.min(1, baseCol[i * 3 + 2] * b));
    }
    attr.needsUpdate = true;
  };
  pts.userData.formed = () => form >= 1;
  // the chevrons are the last 28 points: a gate is only OPEN once they lock
  pts.userData.chevronAt = STARGATE_STROKE / N;

  pts.userData.kind = 'portal';
  pts.userData.sizeScale = 1;
  return pts;
}

// The energy shield: a dot-shell ellipsoid that hovers over the tank's
// hull. The game's own idiom — a fibonacci sphere of additive points, one
// draw call — rather than a translucent mesh: the bloom chain turns the
// bright dots into the energy read for free. tick(t, frac) shimmers it and
// blinks it URGENT when frac (time remaining, 0..1) runs low.
// The shield bubble. It was 280 additive dots — the board's speckle idiom,
// which on a protective FIELD read as debris hanging around the hull rather
// than a surface. It is now a hologram: fresnel-bright at the rim and nearly
// absent through the middle, which is the property that matters most in
// play — you have to be able to see the board you are driving through it.
//
// The impact is a RIPPLE FROM THE CONTACT POINT, not a global flash. The
// caller knows where it was hit; spending that on a surface event is the
// difference between "something happened" and "something hit you there".
export function makeShieldShell(colorHex = 0x7fe0ff) {
  // the hull is longer than it is tall — the same ellipsoid the cloud described
  const geo = new THREE.SphereGeometry(1, 48, 32);
  geo.scale(1.05, 0.8, 1.3);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFrac: { value: 1 },
      uHitDir: { value: new THREE.Vector3(0, 1, 0) },
      uHitAge: { value: 99 },
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vL;
      void main() {
        vL = normalize(position);
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFrac;
      uniform float uHitAge;
      uniform float uOpacity;
      uniform vec3 uHitDir;
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vL;
      void main() {
        // the rim is the read: bright where the surface turns away, all but
        // gone where you are looking straight through it
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        // lattice — latitude and longitude, thin and dim
        float lat = abs(fract(vL.y * 6.0) - 0.5);
        float lon = abs(fract(atan(vL.z, vL.x) * 2.2) - 0.5);
        float grid = smoothstep(0.46, 0.5, max(1.0 - lat * 2.0, 1.0 - lon * 2.0)) * 0.28;
        // one sweep band travelling up the shell
        float sweep = smoothstep(0.10, 0.0, abs(vL.y - (fract(uTime * 0.22) * 2.4 - 1.2))) * 0.35;
        // the strike: a ring expanding away from where it was hit
        float ang = acos(clamp(dot(normalize(vL), normalize(uHitDir)), -1.0, 1.0));
        float ring = smoothstep(0.30, 0.0, abs(ang - uHitAge * 4.5))
                   * smoothstep(0.35, 0.0, uHitAge);
        float a = (fres * 0.85 + grid + sweep + ring * 1.6) * uOpacity;
        // the blink under 25% is a PROMISE pickups.js prints to the player
        if (uFrac < 0.25) a *= (sin(uTime * 14.0) > 0.0) ? 1.0 : 0.25;
        gl_FragColor = vec4(uColor * (1.0 + ring * 2.0), clamp(a, 0.0, 1.0));
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.tick = (t, frac = 1) => {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uFrac.value = frac;
    // age the strike here rather than from the caller's clock: the viewer
    // ticks this object with no game around it
    mat.uniforms.uHitAge.value = Math.min(99, mat.uniforms.uHitAge.value + 0.016);
    mesh.rotation.y = t * 0.25;
  };
  // localDir: a unit vector in the shell's own space, from the caller's
  // worldToLocal. Defaulted far in the past so an unhit shell is quiet.
  mesh.userData.hit = (localDir) => {
    mat.uniforms.uHitDir.value.set(localDir[0], localDir[1], localDir[2]);
    mat.uniforms.uHitAge.value = 0;
  };
  mesh.userData.kind = 'fx';
  return mesh;
}

// dot burst — the cloud-unit counterpart of makeDebris: a puff of tinted
// dots scattering outward from a squash point (Points have no triangles
// to explode, so run-over kills get this instead). Caller positions the
// object; velocities favor the tangent plane around `outwardN` so the
// splat hugs the ground like something flattened. tick(dt) -> alive.
export function makeDotBurst(colorHex, outwardN, n = 42) {
  const hshf = (i) => { const s = Math.sin(i * 91.7 + 2.3) * 43758.5453; return s - Math.floor(s); };
  const pos = new Float32Array(n * 3); // all start at the origin
  const vel = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < n; i++) {
    // random dir, flattened against the surface normal, slight upward pop
    const th = hshf(i) * 6.283;
    const up = hshf(i + 50) * 0.55;
    let dx = Math.cos(th), dy = 0, dz = Math.sin(th);
    dx += outwardN[0] * up; dy += outwardN[1] * up; dz += outwardN[2] * up;
    const sp = 0.45 + hshf(i + 100) * 1.1;
    vel[i * 3] = dx * sp; vel[i * 3 + 1] = dy * sp; vel[i * 3 + 2] = dz * sp;
    const b = 0.7 + 0.3 * hshf(i + 150);
    col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 1,
  });
  const pts = new THREE.Points(geo, mat);
  const LIFE = 0.7;
  let life = 0;
  pts.userData.tick = (dt) => {
    life += dt;
    for (let i = 0; i < n; i++) {
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    posAttr.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - life / LIFE);
    return life < LIFE;
  };
  return pts;
}

// bullet projectile — the Braille shell as a static dot-cloud. Animation is
// pure object transform: orient +Y along the flight dir, spin about that
// axis for rifling. Zero per-point CPU work per frame.
export function makeBulletCloud(cols) {
  const base = bulletPts();
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(cols.body);
  const cHi = new THREE.Color(cols.hi);
  for (let i = 0; i < base.length; i++) {
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
    const c = base[i][3] === 1 ? cHi : cBody;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));
  pts.userData.kind = 'bullet';
  return pts;
}

// missile dot-cloud — same builder as makeBulletCloud, missile silhouette.
export function makeMissileCloud(cols) {
  const base = missilePts();
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(cols.body);
  const cHi = new THREE.Color(cols.hi);
  for (let i = 0; i < base.length; i++) {
    pos[i * 3] = base[i][0]; pos[i * 3 + 1] = base[i][1]; pos[i * 3 + 2] = base[i][2];
    const c = base[i][3] === 1 ? cHi : cBody;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));
  pts.userData.kind = 'missile';
  return pts;
}

// the Heart itself: a dot-cloud that cycles treatments — twinkle, breathe,
// jelly (3.5s each) — and on hit() flares orange/red under the Wave
// treatment for ~1.6s before recovering. One instance per board; ~620
// points re-posed per frame is nothing.
export function makeHeartCloud(bodyHex) {
  const base = heartPts(620);
  const pos = new Float32Array(base.length * 3);
  const col = new Float32Array(base.length * 3);
  const baseCol = new Float32Array(base.length * 3);
  const cBody = new THREE.Color(bodyHex);
  const cHi = new THREE.Color(0xffffff);
  const hshf = (i) => { const s = Math.sin(i * 127.1 + 0.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < base.length; i++) {
    const c = base[i][3] === 1 ? cHi : cBody;
    baseCol[i * 3] = c.r; baseCol[i * 3 + 1] = c.g; baseCol[i * 3 + 2] = c.b;
  }
  col.set(baseCol);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));
  pts.userData.sizeScale = 1;

  const cHurtA = new THREE.Color(0xff5330);
  const cHurtB = new THREE.Color(0xffaa00);
  let lastT = 0;
  let hitUntil = -1;
  let hurtColors = false;

  const setHurtColors = (on) => {
    const attr = geo.getAttribute('color');
    for (let i = 0; i < base.length; i++) {
      if (on) {
        const c = hshf(i) < 0.5 ? cHurtA : cHurtB;
        attr.setXYZ(i, c.r, c.g, c.b);
      } else {
        attr.setXYZ(i, baseCol[i * 3], baseCol[i * 3 + 1], baseCol[i * 3 + 2]);
      }
    }
    attr.needsUpdate = true;
    hurtColors = on;
  };

  const repose = (f) => {
    for (let i = 0; i < base.length; i++) {
      const [x, y, z] = f(base[i], i);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    geo.getAttribute('position').needsUpdate = true;
  };
  const identity = (p) => p;

  pts.userData.tick = (t) => {
    lastT = t;
    const s0 = pts.userData.sizeScale;
    if (t < hitUntil) {
      // HURT: orange/red + Wave
      if (!hurtColors) setHurtColors(true);
      repose((p) => {
        const d = 1 + 0.2 * Math.sin(3 * Math.atan2(p[2], p[0]) + t * 5 - p[1] * 2);
        return [p[0] * d, p[1], p[2] * d];
      });
      pts.scale.setScalar(s0);
      return;
    }
    if (hurtColors) setHurtColors(false);
    const phase = Math.floor(t / 3.5) % 3;
    if (phase === 0) {
      // twinkle
      repose(identity);
      const attr = geo.getAttribute('color');
      for (let i = 0; i < base.length; i++) {
        const b = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.2 + hshf(i) * 6.283));
        attr.setXYZ(i, baseCol[i * 3] * b, baseCol[i * 3 + 1] * b, baseCol[i * 3 + 2] * b);
      }
      attr.needsUpdate = true;
      pts.scale.setScalar(s0);
    } else if (phase === 1) {
      // breathe
      repose(identity);
      pts.scale.setScalar(s0 * (1 + 0.14 * Math.sin(t * 2)));
    } else {
      // jelly: volume-preserving squash-stretch
      const sy = 1 + 0.18 * Math.sin(t * 3);
      const sx = 1 / Math.sqrt(sy);
      repose((p) => [p[0] * sx, p[1] * sy, p[2] * sx]);
      pts.scale.setScalar(s0);
    }
  };
  pts.userData.hit = () => { hitUntil = lastT + 1.6; };
  return pts;
}

// --- mkcx: an authored hover tank, as a selectable player unit ----------
//
// The tank is the opposite case from a GLB TOWER. A tower can be flattened
// to a handful of draw calls because it holds still; the tank has to AIM,
// so the nodes that move must survive the merge. These four do:
//   Turret_Pivot            — the main gun; aiming reads its world +Z
//   Secondary_L/R_Gun_Pivot — the twin mini-lasers
// Everything else merges. 58 meshes becomes roughly a dozen.
// Two castings of the same rig. 'mkcx2' is the MK-CX with the top taken off
// (operator, 2026-09-03: flat deck, no turret block, the nine shells racked on
// the hull, big deck indicators) — authored beside the original in
// blueprint-to-life as its own subject. THE MK-CX/2 IS THE FIELDED UNIT
// (historical): these legacy builders default to 'mkcx2'; the MK-CX
// stays castable as a relic in the units viewer, and nowhere else.
const MKCX_URLS = { mkcx: 'assets/models/mkcx.glb', mkcx2: 'assets/models/mkcx2.glb' };
const MKCX_ROOTS = ['MKCX_Root', 'MKCX2_Root'];
// The heat gauges are SLEEVES the game adds (a dedicated basic material is
// the only thing legible at gameplay distance). Lengths per casting: the
// MK-CX/2's are 1.5x the MK-CX's (operator, 2026-09-03), all three weapons.
// Positions are sleeve CENTRES along the barrel, so a longer sleeve grows
// both ways: the main one still starts ahead of the cradle and the
// secondaries' still end short of their muzzles.
const MKCX_SLEEVES = {
  mkcx: { main: { len: 1.65, z: 2.05 }, sec: { len: 0.62, z: 0.72 } },
  mkcx2: { main: { len: 2.475, z: 2.05 }, sec: { len: 0.93, z: 0.72 } },
};
// Hover_Gear is the nacelle/lift-emitter skirt — the part that should stay
// planted while the body rises off it. Preserved through the merge for that
// reason, not because it animates on its own.
// Nodes that must survive the merge as addressable objects: the things that
// articulate. Everything else is welded into per-material batches — including
// the glow accents, which is exactly what makes the health tint cheap.
const MKCX_LIFTERS = ['LiftEmitter_L1', 'LiftEmitter_L2', 'LiftEmitter_L3',
  'LiftEmitter_R1', 'LiftEmitter_R2', 'LiftEmitter_R3'];
// How far the twin secondaries toe in, in radians. The model authors ~9deg
// but applies it the same way round on both sides; this is the magnitude,
// applied inward per side. Tunable in the beam tab.
//
// Narrowed twice on the operator's eye: 0.157 -> 0.085 -> 0.035.
//
// The number that matters is not the angle, it is where the beams CROSS, and
// that goes as 1/toe: apex = muzzleGap / (2 * tan(toe)). With a measured
// muzzle gap of 0.773 the first cut only moved the apex 4.29 -> 4.56 units,
// which is why halving the angle looked like it did nothing. 0.035 puts the
// apex out past 11 units — the pair reads near-parallel over the length a
// player actually sees, and the wide X past the crossing goes away.
//
// The base toe is only half the story: BEAM_SWEEP in td-tab adds to it across
// the burst. But the sweep runs INWARD, so it cannot be what reads as splayed
// — it is the divergence past the apex, which is this constant alone.
export const SECONDARY_TOE = 0.035;

// Toe both secondaries inward by `angle`, from each turret's OWN SIDE rather
// than from its name — a gun left of the centreline must yaw toward +X and
// one right of it toward -X. Deriving it from position means the fix cannot
// be defeated by an L/R naming convention, in the model or in anyone's head.
//
// Exported because the toe is no longer a constant baked once at build time:
// it scales with the beam's reach so the pair always crosses (arc.js
// toeForCrossing), and both the board and the beam lab re-apply it. It used
// to be inlined here AND copied into beam-tab, which is two copies of a sign
// convention that has already been got wrong once.
export function applySecondaryToe(g, angle) {
  const pivots = secondaryPivots(g);
  for (const piv of pivots) {
    const side = piv.position.x < 0 ? 1 : -1;    // sign that points inward
    piv.rotation.set(0, side * angle, 0);
  }
  return pivots.length;
}

// The two things a toe can be applied to, in preference order: the authored
// model's named pivots, else the procedural tank's own gun objects.
//
// The fallback is not cosmetic. Headless rarely finishes the GLB load, so
// every probe in this project runs on the PROCEDURAL tank — which has no
// `Secondary_*_Pivot` nodes, so a name-only lookup found nothing, silently
// did nothing, and left a reach-solved toe reading as the old fixed one in
// every measurement. Both tanks expose `userData.laserGuns`; that is the
// handle the beams themselves are found by, so it is the right one here too.
export function secondaryPivots(g) {
  if (g.userData?.secondaryPivots) return g.userData.secondaryPivots;
  const named = ['Secondary_L_Pivot', 'Secondary_R_Pivot']
    .map((nm) => g.getObjectByName(nm)).filter(Boolean);
  if (named.length >= 2) return named;
  const guns = g.userData && g.userData.laserGuns;
  return Array.isArray(guns) ? guns.filter(Boolean) : [];
}

const MKCX_PIVOTS = ['Turret_Pivot', 'Secondary_L_Gun_Pivot', 'Secondary_R_Gun_Pivot',
  'Hover_Gear', ...MKCX_LIFTERS,
  'ShellRack_Mount'];   // mkcx2: the deck empty the game's shells sit on
// The barrel glow strips are authored floating +0.20 above the barrel axis.
// At our scale they don't read as strips ON the gun — they read as a stray
// bright line hanging in front of the tank. Dropped before the merge, since
// afterwards they'd be welded into a shared mesh and unaddressable.
// Hull_Collision is a 12-triangle BOX — a physics proxy the exporter left
// visible, not something meant to be drawn. Rendered, its top face reads as
// two big triangles laid over the hull with its corners poking out at the
// front and back. Never render a collision proxy.
const MKCX_DROP = ['Hull_Collision', 'Barrel_Glow_1', 'Barrel_Glow_2'];
const mkcxProtos = { mkcx: null, mkcx2: null };

// Anyone who asks for the mkcx gets its load started for them, and can
// subscribe to know when the real model has replaced the fallback. Without
// this, every tab has to remember to preload, and one that forgets shows
// the procedural tank forever with nothing to say why.
const mkcxReadyCbs = [];
export function onMkcxReady(cb, id = 'mkcx2') {
  if (mkcxProtos[id]) { cb(); return; }
  mkcxReadyCbs.push([id, cb]);
  preloadMkcx(id);
}

// Blueprint callouts: which authored node to hang each label on, and what to
// call it in English. Sourced from the model's own node names so a label
// always names something that actually exists to be edited — pointing at "the
// bit near the front" is how the turret stayed 6 deg out of true for weeks.
const MKCX_CALLOUTS = [
  ['Hull_Mesh', 'hull'],
  ['Turret_Pivot', 'primary turret'],
  ['Barrel_Mesh', 'main barrel'],
  ['MuzzleBrake_Mesh', 'muzzle brake'],
  ['Mantlet_Mesh', 'mantlet'],
  ['Sight_Primary', 'primary sight'],
  ['Hatch_Commander', 'commander hatch'],
  ['LauncherPod_L', 'launcher pod'],
  ['Stowage_Bin', 'stowage bin'],
  ['Secondary_L_Pivot', 'secondary turret'],
  ['Secondary_R_Gun_Pivot', 'secondary gun'],
  ['Nacelle_L', 'nacelle (skirt)'],
  ['LiftEmitter_L2', 'lift emitter'],
  ['Pylon_LB', 'pylon'],
  ['Hull_Glow_1', 'accent strip'],
  ['Headlight_R', 'headlight'],
  ['EngineDeck_Grille', 'engine deck'],
  ['Driver_Hatch', 'driver hatch'],
  ['Sensor_Mast', 'sensor mast'],
  ['Deck_Glow_1', 'deck indicator'],     // mkcx2
  ['Shell_Socket_5', 'shell rack'],      // mkcx2
  ['Callout_4', 'muzzle'],   // authored empty at the barrel tip
];
const mkcxRootOf = (scene) => MKCX_ROOTS.map((n) => scene.getObjectByName(n)).find(Boolean) || scene;

// Drop an empty at each callout's world position, parented to the model root,
// BEFORE the merge welds those nodes away. Empties are not meshes, so they
// survive the merge untouched and are carried by fitModel's scale and
// recentring like everything else — no coordinates to keep in sync by hand.
function markCallouts(scene) {
  const root = mkcxRootOf(scene);
  root.updateMatrixWorld(true);
  const marks = [];
  const p = new THREE.Vector3();
  for (const [node, label] of MKCX_CALLOUTS) {
    const o = scene.getObjectByName(node);
    if (!o) continue;
    // Hang the marker on the nearest surviving PIVOT, so a label on the
    // turret sweeps with the turret instead of hovering where the turret
    // used to point. Never on a mesh: the merge removes those, and a child
    // of a removed node goes with it.
    let host = root;
    for (let a = o; a; a = a.parent) {
      if (MKCX_PIVOTS.includes(a.name)) { host = a; break; }
    }
    o.getWorldPosition(p);
    const m = new THREE.Object3D();
    m.position.copy(host.worldToLocal(p.clone()));
    m.userData.callout = { label, node };
    marks.push([host, m]);
  }
  for (const [host, m] of marks) host.add(m);  // after the walk, never during
  return marks.map(([, m]) => m);
}

// One load, one merge, one set of callout markers — no matter how many
// callers ask. loadGlb caches the SCENE, but every caller still ran this
// body against it: re-merging an already-merged scene, and re-marking it,
// which is why parts whose node is a Group (and so survives a merge) ended
// up with a label each per call. The promise, not the scene, is the guard.
const mkcxLoads = { mkcx: null, mkcx2: null };
// Authored GLBs ship their collision volumes as visible red wireframes —
// helper meshes for the DCC, noise everywhere else. Hidden, not removed:
// a future physics pass may want to read them.
function hideCollisionNodes(root) {
  root.traverse((o) => { if (/collision/i.test(o.name || '')) o.visible = false; });
}

// --- the SERVER: a board fixture cast from GLB ---------------------------
// Not a unit: no rig, no tick, no health. fitModel seats the foot at y=0
// inside a wrapper group (unit height, span-capped per the house rule for
// imported models); the tab scales and orients the clone per placement.
let serverProto = null, serverLoad = null;
export function preloadServer() {
  if (serverLoad) return serverLoad;
  serverLoad = loadGlb('assets/models/server.glb').then((scene) => {
    if (!scene) { serverLoad = null; return false; }
    hideCollisionNodes(scene);
    serverProto = fitModel(scene, { height: 1, maxSpan: 0.8 });
    return true;
  });
  return serverLoad;
}
export function makeServerFixture() {
  if (!serverProto) { preloadServer(); return null; }
  const g = serverProto.clone(true);
  g.userData.kind = 'fixture';
  return g;
}

// --- the LIFE CONTAINERS: shipping containers that ARE the lives display.
// One empty, the rest each holding a spare MK-CX — lose a tank and its
// container stands empty. The GLB ships with cargo (pallets + loads);
// the operator's spec empties them, so Cargo_Group dies at preload.
// Doors are fixed OPEN — the display reads by looking in; presence of
// the tank IS the counter, the lock lamps reinforce it.
let containerProto = null, containerLoad = null;
export function preloadContainer() {
  if (containerLoad) return containerLoad;
  containerLoad = loadGlb('assets/models/container.glb').then((scene) => {
    if (!scene) { containerLoad = null; return false; }
    const cargo = scene.getObjectByName('Cargo_Group');
    if (cargo && cargo.parent) cargo.parent.remove(cargo); // empty the boxes
    hideCollisionNodes(scene);
    // REPAINT (operator, 2026-08-31): the authored shell is near-black
    // (baseColor ~0.06-0.12 linear), which is why nobody could tell a
    // stocked berth from a spent one — the hull inside sat in a black box
    // in a black room. Lighter industrial grey, walls brightest, frame a
    // shade under them so the ribs still read, deck lighter still so a
    // parked hull has something to be a silhouette AGAINST.
    // Done on the PROTO: every container wears the same paint, so one
    // shared material is correct here (unlike the lock lamps, which carry
    // per-instance state and must be cloned).
    // Base colour alone does NOT do it: the default look (tronColors) runs a
    // hemi at 0.55 and a sun at 0.25, and a standard material under that
    // light is near-black whatever you paint it. So each rung carries its
    // own emissive — the house ladder from tintModel, applied by hand
    // because these three names are the whole model.
    const REPAINT = {
      M_Armour: [0xb4bac0, 0x3a4046],  // walls, roof, door panels — the big surfaces
      M_Steel: [0x7d848a, 0x23282c],   // posts, rails, headers, sills
      M_Detail: [0x9aa0a4, 0x2e3236],  // floor deck, handles, cams
    };
    const painted = new Set();
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const rung = REPAINT[m.name];
        if (!rung || painted.has(m)) continue;
        painted.add(m);
        m.color.setHex(rung[0]);
        if (m.emissive) m.emissive.setHex(rung[1]);
        if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.4);
        if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.62);
      }
    });
    // fit by height with a span cap (house rule): a container is ~1.5x
    // longer than tall, so the span cap is what binds — noted, not assumed
    containerProto = fitModel(scene, { height: 1, maxSpan: 1.6 });
    return true;
  });
  return containerLoad;
}
// --- container livery: hazard chevrons and a berth numeral ---------------
// The canvas work is LAZY on purpose: units.js is Node-imported by
// test/units.mjs, and `document` does not exist there. Nothing below runs
// until a fixture is actually built, which only happens in a browser.
//
// Geometry note — the fitted proto measures z ±0.80 (long axis, doors at
// +z), x ±0.32 (width), y 0 to 0.667 (height). Decals are added to the FIT
// GROUP, so these are the coordinates they live in.
const CONT_HALF_W = 0.32, CONT_HALF_L = 0.80, CONT_H = 0.667;
let hazardTex = null;
function hazardTexture() {
  if (hazardTex) return hazardTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#f0bf16'; x.fillRect(0, 0, 128, 32);
  x.fillStyle = '#14120c';
  // 45° bars on a 32px period across a 128px tile, so the tile wraps clean
  for (let i = -1; i < 5; i++) {
    const o = i * 32;
    x.beginPath();
    x.moveTo(o, 32); x.lineTo(o + 16, 32); x.lineTo(o + 48, 0); x.lineTo(o + 32, 0);
    x.closePath(); x.fill();
  }
  hazardTex = new THREE.CanvasTexture(c);
  hazardTex.wrapS = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) hazardTex.colorSpace = THREE.SRGBColorSpace;
  return hazardTex;
}
const numeralTexes = new Map();
function numeralTexture(n) {
  if (numeralTexes.has(n)) return numeralTexes.get(n);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f2ece0';
  x.font = 'bold 210px "Helvetica Neue", Helvetica, Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), 128, 136);
  // stencil bridges — two cut bars are what makes a painted numeral read as
  // MILITARY rather than as a web font sitting on a box
  x.globalCompositeOperation = 'destination-out';
  x.fillRect(0, 78, 256, 13);
  x.fillRect(0, 176, 256, 13);
  x.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  numeralTexes.set(n, tex);
  return tex;
}
function hazardBand(w, h, tiles) {
  const m = new THREE.MeshBasicMaterial({
    map: hazardTexture().clone(), transparent: false, toneMapped: false,
  });
  m.map.needsUpdate = true;
  m.map.wrapS = THREE.RepeatWrapping;
  m.map.repeat.set(tiles, 1);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

// --- THE STALHEART: a Terraformer, cast from GLB --------------------------
//
// Operator, 2026-09-01: the thing at the pole is not a literal heart. It is a
// TERRAFORMER — the machine that makes the colony survivable. Without it the
// colony dies, which is the same rule the Heart always had, told properly.
//
// It replaces makeHeartCloud rather than editing it: both satisfy the same
// three-call contract the tab uses (sizeScale, tick, hit), so which one is on
// the board is a registry choice and nothing downstream changes. See
// HEART_LOOKS in td-tab.js.
let terraProto = null, terraLoad = null;
// the pivots that must survive the merge — a part is only addressable
// afterwards if it was named BEFORE (learned the hard way on the mkcx)
const TERRA_PIVOTS = ['Travel_Carriage', 'Traverse_Carriage', 'Mast_Stage_1',
  'Mast_Stage_2', 'Arm_Swing', 'Arm_Shoulder', 'Arm_Elbow', 'Arm_Wrist',
  'Nozzle_Cone', 'Nozzle_Heater'];

// --- THE 70-METRE DISH -----------------------------------------------------
//
// NASA's Deep Space Network antenna, from science.nasa.gov/3d-resources.
// Terms, and the checks they required, are in ATTRIBUTIONS.md — the short
// version is that the assets are free and without copyright, but the NASA
// INSIGNIA is not, so the texture was inspected before this landed. It is one
// greyscale baked-lighting atlas with no logo, wordmark or text.
//
// It arrives lit rather than coloured: a single "Antenna" material carrying a
// baked AO atlas, which is the opposite problem to the containers and the
// terraformer (near-black authored materials that needed repainting). Here
// the bake IS the detail, so the treatment is a lift and nothing else — tint
// it and the panel structure the bake is drawing goes flat.
let dishLoad = null, dishProto = null;
export function preloadDish() {
  if (dishLoad) return dishLoad;
  dishLoad = loadGlb('assets/models/dish70.glb').then((scene) => {
    if (!scene) { dishLoad = null; return false; }
    scene.updateMatrixWorld(true);
    // ONE UNIT TALL, feet on y=0, centred in x/z — the same contract every
    // other cast here honours, so a caller scales by one number in its own
    // units and never learns what the file was authored in.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.y, 1e-6);
    const wrap = new THREE.Group();
    scene.scale.setScalar(k);
    scene.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    wrap.add(scene);
    let tris = 0;
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const g = o.geometry;
      if (g) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || m.userData.dishLit) continue;
        m.userData.dishLit = true;
        // a dish is white-painted steel: keep the bake, lift it off black,
        // and give it a little emissive so it reads under the board's light
        // without becoming a lamp
        if (m.color) m.color.multiplyScalar(1.35);
        if (m.emissive) { m.emissive.setHex(0x2a3138); m.emissiveIntensity = 1; }
        if ('roughness' in m) m.roughness = Math.min(1, (m.roughness ?? 1) * 0.9);
        m.needsUpdate = true;
      }
    });
    dishProto = wrap;
    console.log(`DISH70 ready: ${Math.round(tris)} tris (NASA/Ames, see ATTRIBUTIONS.md)`);
    return true;
  });
  return dishLoad;
}

// One dish, one unit tall. Caller owns the scale and the placement.
export function makeDishFixture() {
  if (!dishProto) { preloadDish(); return null; }
  const g = dishProto.clone(true);
  g.userData.kind = 'fixture';
  return g;
}

export function preloadTerraformer() {
  if (terraLoad) return terraLoad;
  terraLoad = loadGlb('assets/models/terraformer.glb').then((scene) => {
    if (!scene) { terraLoad = null; return false; }
    hideCollisionNodes(scene);
    // Same repaint problem the containers had: every authored material here
    // is near-black (baseColor 0.006-0.12 linear), and under this board's
    // light — hemi 0.55, sun 0.25 — a standard material that dark reads as a
    // silhouette. Each rung carries its own emissive for the same reason.
    const REPAINT = {
      M_Armour: [0xb9bfc4, 0x3c4247],   // the big plated surfaces
      M_Steel:  [0x848b91, 0x242a2e],   // towers, beams, rails
      M_Detail: [0x9ea4a8, 0x2f3337],   // walkways, ladders, handrails
      M_Turret: [0x9aa1a6, 0x2b3034],   // carriage and arm housings
      M_Track:  [0x4a5054, 0x15181a],   // bogies and track pods
      M_Rubber: [0x2a2e31, 0x0c0e10],
      M_Glow2:  [0x7df9ff, 0x2aa8bf],   // the cool status glow
      M_Glow4:  [0xffb000, 0x8a5b00],   // the warm nozzle glow
    };
    const painted = new Set();
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const rung = REPAINT[m.name];
        if (!rung || painted.has(m)) continue;
        painted.add(m);
        m.color.setHex(rung[0]);
        if (m.emissive) m.emissive.setHex(rung[1]);
        if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.45);
        if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.55);
      }
    });
    // wide, low machine: the span cap binds, not the height
    terraProto = fitModel(scene, { height: 1, maxSpan: 2.0 });
    return true;
  });
  return terraLoad;
}

// A FLAT PEDESTAL ON A ROUND FLOOR. The shell is a sphere, so a machine this
// wide would have its rails hanging in the air at both ends and its middle
// buried. The colony pours a pad first: a shallow cylinder sunk into the
// shell, flat on top, hazard-striped around the rim like everything else
// industrial on this board.
function terraPedestal(radius, height) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.96, height, 40, 1, false),
    new THREE.MeshStandardMaterial({
      color: 0x6f767c, emissive: 0x22262a, metalness: 0.35, roughness: 0.75,
    }));
  deck.position.y = -height / 2;
  g.add(deck);
  // the striped rim: one cylinder wall wearing the hazard tape, so the pad
  // reads as poured industrial concrete rather than a grey disc
  const bandH = height * 0.42;
  const tex = hazardTexture().clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(6, Math.round(radius * 14)), 1);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.004, radius * 1.004, bandH, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  band.position.y = -bandH * 0.62;
  g.add(band);
  return g;
}

export function makeTerraformerFixture(bodyHex = 0xff6a88) {
  if (!terraProto) { preloadTerraformer(); return null; }
  // TWO GROUPS, AND THE REASON MATTERS.
  //
  // The outer group is the tab's: placeActors sets its position, its scale,
  // and — critically — a QUATERNION aligning it to the shell's normal. The
  // inner rig is this file's, and it is the only thing tick() may rotate.
  //
  // The first cut of this had tick() write `g.rotation.z` directly. In
  // three.js `rotation` (Euler) and `quaternion` are two views of ONE
  // rotation, so assigning either replaces the whole orientation: every
  // frame silently discarded the normal alignment and the machine stood in
  // world-Y instead — upright at the pole, and leaning further the further
  // from it, with its pad on edge (operator: "wrong angle"). This project
  // already had that dead end on record from the bullet triads. Separating
  // the groups makes it structurally impossible rather than remembered.
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const model = terraProto.clone(true);
  rig.add(model);

  // CENTRE THE MACHINE ON ITS PAD. fitModel seats the foot at y=0 but the
  // rails run asymmetrically about the origin, so an uncentred model hangs
  // off one side of the pedestal. Measure the real footprint and both
  // centre it and size the pad from it, rather than guessing a radius.
  const mb = new THREE.Box3().setFromObject(model);
  const mc = new THREE.Vector3(); mb.getCenter(mc);
  const ms = new THREE.Vector3(); mb.getSize(ms);
  model.position.x -= mc.x;
  model.position.z -= mc.z;
  const padR = Math.max(ms.x, ms.z) * 0.5 * 1.12;   // a rim beyond the rails
  rig.add(terraPedestal(padR, padR * 0.34));
  g.userData.padR = padR;   // in model units; x sizeScale for the world

  // the pivots this thing is animated by, resolved once
  const P = {};
  for (const name of TERRA_PIVOTS) P[name] = model.getObjectByName(name);
  const rest = {};
  for (const k of Object.keys(P)) if (P[k]) rest[k] = P[k].position.y;

  // the glow materials get PRIVATE clones: the hit flare repaints them, and
  // a shared material would flare every other model using the same name
  const glow = [];
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      if (!/^M_Glow/.test(m.name || '')) return m;
      const c = m.clone();
      glow.push({ mat: c, base: c.color.clone(), emi: c.emissive ? c.emissive.clone() : null });
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });

  let hitUntil = -1;
  const hurt = new THREE.Color(0xff2a1a);
  g.userData.sizeScale = 1;
  g.userData.hit = () => { hitUntil = (g.userData.lastT ?? 0) + 0.9; };

  // ACTIVITY IS INTERMITTENT, NOT CONSTANT (operator, 2026-09-01). A machine
  // whose every joint sweeps a sine forever reads as a screensaver; a real
  // one is still, then does a thing, then is still again. So each subsystem
  // gets its own SHIFT: a long rest, a short move, its own period and its own
  // offset so they never march in step.
  //
  // burst(t, period, dur, phase) is 0 while resting and a smooth 0..1..0 for
  // `dur` seconds once every `period`. Deterministic — a function of the
  // clock alone, no state, no rng — so it costs nothing and never drifts.
  const burst = (t, period, dur, phase) => {
    const u = ((t / period + phase) % 1 + 1) % 1;
    const w = dur / period;
    if (u > w) return 0;
    const k = u / w;                       // 0..1 across the move
    return Math.sin(k * Math.PI);          // ease in, ease out, rest at both ends
  };
  // and a signed version, for joints that swing one way and back
  const swing = (t, period, dur, phase) => {
    const u = ((t / period + phase) % 1 + 1) % 1;
    const w = dur / period;
    if (u > w) return 0;
    return Math.sin((u / w) * Math.PI * 2);
  };

  g.userData.sizeScale = 1;
  g.userData.hit = () => { hitUntil = (g.userData.lastT ?? 0) + 0.9; };

  // WORKING (operator, 2026-09-02: "give the image that the Terraformer is
  // active by having it build things"). 0 = idling as before; 1 = a job on
  // the bed.
  //
  // The first cut ran the idle rig 2.8x faster while working. That made the
  // nozzle's print pattern thrash — "erratic, jarring" (operator) — and read
  // as agitation, not work. Building is SLOW: the carriage sweeps the bed at
  // a walking pace, the arm holds low, the nozzle nods. So `working` is a
  // blend weight into a second, deliberate motion, eased in over about a
  // second so nothing snaps when a job starts or lands.
  g.userData.working = 0;
  let wk = 0, lastRaw = null;
  g.userData.tick = (t) => {
    if (lastRaw !== null) {
      const dtl = Math.max(0, Math.min(0.1, t - lastRaw));
      wk += (Math.min(1, g.userData.working || 0) - wk) * Math.min(1, dtl * 1.2);
    }
    lastRaw = t;
    const raw = t;
    g.userData.lastT = raw;
    const mix = (idle, build) => idle * (1 - wk) + build * wk;
    // BUILD: a raster over the bed — travel sweeps the long axis every 9s,
    // traverse steps the short axis every 3s, a print head's path. Long
    // periods, full sines, no bursts.
    const bTravel = Math.sin((t / 9) * Math.PI * 2) * 0.30;
    const bTrav = Math.sin((t / 3) * Math.PI * 2) * 0.22;
    g.scale.setScalar(g.userData.sizeScale);
    const hurting = raw < hitUntil;

    // THE GANTRY: the whole travel carriage repositions down the rails, but
    // rarely — it is the biggest, slowest thing here and it should read as an
    // event, not a wobble. ~once every 23s, over 6s.
    if (P.Travel_Carriage) {
      P.Travel_Carriage.position.z = mix(swing(t, 23, 6.0, 0.00) * 0.34, bTravel);
    }
    // THE TRAVERSE: the arm rides across the beam more often than the gantry
    // moves, and on its own period so the two are never in phase.
    if (P.Traverse_Carriage) {
      P.Traverse_Carriage.position.x = mix(swing(t, 14, 4.5, 0.37) * 0.26, bTrav);
    }
    // THE MAST: a short breath down and back as it sets its working height.
    if (P.Mast_Stage_2) {
      P.Mast_Stage_2.position.y = (rest.Mast_Stage_2 ?? 0)
        - mix(burst(t, 17, 3.2, 0.62) * 0.09, 0.11);   // down on the work while building
    }
    // THE EXTRUSION ARM: shoulder, elbow and wrist each take a turn, offset
    // so the limb articulates rather than pivoting as one rigid piece.
    if (P.Arm_Swing) P.Arm_Swing.rotation.y = mix(swing(t, 11, 3.6, 0.11) * 0.40, Math.sin((t / 12) * Math.PI * 2) * 0.12);
    if (P.Arm_Elbow) P.Arm_Elbow.rotation.x = mix(-0.10 + swing(t, 9, 3.0, 0.44) * 0.26, -0.34);
    if (P.Arm_Wrist) P.Arm_Wrist.rotation.x = mix(swing(t, 7, 2.2, 0.73) * 0.34, 0.22);

    // THE NOZZLE: the same three-pattern print cycle Isao's beam runs —
    // zigzag raster, spiral, then travel moves with the extruder off — so
    // the two machines on this board are visibly doing the same JOB. Only
    // while the arm is actually working; dark and still the rest of the time.
    const working = burst(t, 11, 3.6, 0.11) > 0.05;
    const { pattern, u } = printPhase(t, 1.2);
    // the print pattern is the IDLE's nozzle business; while building, the
    // nozzle is on the work — lit, and only nodding along the pass
    const firing = wk >= 0.5 ? true : (working && printOn(pattern, u));
    if (P.Nozzle_Cone) {
      const [ox, oy] = printOffset(pattern, u);
      P.Nozzle_Cone.rotation.z = mix(ox * 0.16, Math.sin((t / 3) * Math.PI * 2) * 0.05);
      P.Nozzle_Cone.rotation.x = mix(oy * 0.16, 0.08 + Math.sin((t / 4.5) * Math.PI * 2) * 0.04);
    }

    // the glow follows the work: hot while printing, banked while resting,
    // hard red and fast while the machine is being hit
    const beat = hurting ? 0.55 + 0.45 * Math.abs(Math.sin(t * 18))
      : firing ? 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 9))
        : 0.16;
    for (const s of glow) {
      if (hurting) s.mat.color.copy(hurt);
      else s.mat.color.copy(s.base);
      if (s.mat.emissive) {
        if (hurting) s.mat.emissive.copy(hurt).multiplyScalar(beat);
        else s.mat.emissive.copy(s.emi).multiplyScalar(beat);
      }
    }
    // a struck machine rocks on its pad — on the INNER rig, never on g,
    // whose quaternion belongs to the shell's normal
    rig.rotation.z = hurting ? Math.sin(t * 26) * 0.02 : 0;
  };
  return g;
}

export function makeContainerFixture(number = 0) {
  if (!containerProto) { preloadContainer(); return null; }
  const g = containerProto.clone(true);
  // doors stand open: the counter must be readable at a glance
  const dl = g.getObjectByName('Door_L_Pivot');
  const dr = g.getObjectByName('Door_R_Pivot');
  if (dl) dl.rotation.y = -1.9;
  if (dr) dr.rotation.y = 1.9;
  // lock lamps get PRIVATE materials (clone shares them otherwise, and
  // one container's state would repaint every sibling's lamps)
  const lamps = [];
  g.traverse((o) => {
    if (o.isMesh && /^Lock_Lamp_/.test(o.name)) {
      o.material = o.material.clone();
      lamps.push(o);
    }
  });
  // --- livery: hazard tape and the berth numeral --------------------------
  // The numeral IS the lives read at range: three lit numbers, three hulls.
  // A spent berth's number goes dark red, so the count is legible from the
  // orbit camera without counting tanks you cannot resolve at that distance.
  const numerals = [];
  if (number > 0) {
    const tex = numeralTexture(number);
    const mkNumeral = (w, h) => {
      const m = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      numerals.push(mesh);
      return mesh;
    };
    // both long sides, read from the lane
    for (const sx of [1, -1]) {
      const q = mkNumeral(0.42, 0.42);
      q.position.set(sx * (CONT_HALF_W + 0.004), CONT_H * 0.56, -0.12);
      q.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(q);
    }
    // and the ROOF, which is the face the orbit camera actually sees.
    // Counter-stretched in z because the fixture is squashed to 0.55 depth
    // where it is placed — the same trick the racked hull uses.
    const top = mkNumeral(0.40, 0.40 / 0.55);
    top.position.set(0, CONT_H + 0.004, -0.10);
    top.rotation.x = -Math.PI / 2;
    g.add(top);
  }
  // hazard tape: the sill on both flanks, and the doorway frame you drive
  // through — the industrial read, and it outlines the hole in the dark
  for (const sx of [1, -1]) {
    const band = hazardBand(CONT_HALF_L * 2 * 0.96, 0.075, 10);
    band.position.set(sx * (CONT_HALF_W + 0.004), 0.055, 0);
    band.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(band);
  }
  {
    const zf = CONT_HALF_L - 0.012;               // just inside the door plane
    const header = hazardBand(CONT_HALF_W * 2, 0.055, 5);
    header.position.set(0, CONT_H - 0.03, zf);
    g.add(header);
    for (const sx of [1, -1]) {
      const post = hazardBand(0.055, CONT_H - 0.06, 4);
      post.position.set(sx * (CONT_HALF_W - 0.028), (CONT_H - 0.06) / 2, zf);
      post.material.map.rotation = Math.PI / 2;   // chevrons run up the post
      post.material.map.center.set(0.5, 0.5);
      g.add(post);
    }
  }

  let stocked = null;
  g.userData.setStocked = (on, cargoObj) => {
    if (stocked === on) return;
    stocked = on;
    for (const l of lamps) {
      l.material.color.setHex(on ? 0x2aff66 : 0xff3322);
      if (l.material.emissive) {
        l.material.emissive.setHex(on ? 0x0c4418 : 0x441008);
      }
    }
    if (cargoObj) cargoObj.visible = on;
  };
  // the numeral runs on its OWN state: the lamps say "a spare is racked
  // here", the number says "this life still exists". Berth 3 is empty from
  // the first second of a run and its 3 is still lit — you are driving it.
  let alive = null;
  g.userData.setAlive = (on) => {
    if (alive === on) return;
    alive = on;
    for (const q of numerals) {
      q.material.color.setHex(on ? 0xffffff : 0x5e1b14);
      q.material.opacity = on ? 1 : 0.65;
    }
  };
  g.userData.kind = 'fixture';
  return g;
}

// --- BOBBY: the industrial construction drone ----------------------------
// Every tower and every upgrade on this board is built by one machine. It
// is a quadcopter fabricator: four rotors, a reservoir of biomass, a pump,
// and a boom carrying an extruder head. It flies to the ordered cell,
// hangs there, and prints.
//
// The authored file ships the drone hovering over a WORKPIECE — a bed slab
// with a printed bead on it, the pose that shows what the machine is for.
// The workpiece is scenery for a product shot; on the board Bobby prints
// towers, not test coupons, so the whole group goes before the merge
// (operator's call, and afterwards it would be welded in and unaddressable).
//
// Preserved pivots, all of them things that must MOVE while it works:
// four rotor spins, the boom's yaw and pitch, and the head's pitch. The
// rest merges. Nozzle_Tip stays as an empty — it is where the build beam
// starts, and a marker costs nothing.
const FAB_URL = 'assets/models/fabricator.glb';
const FAB_ROTORS = ['Rotor_FL_Spin', 'Rotor_FR_Spin', 'Rotor_RL_Spin', 'Rotor_RR_Spin'];
// Sensor_Pod and Sensor_Lens are preserved for a reason that is not
// articulation: they are the HEAD, and Isao takes it off. mergeByMaterial
// welds every non-pivot mesh into a batch by material, so a part that is
// not listed here cannot be addressed by name afterwards — hiding it
// silently does nothing, which is exactly what happened the first time.
// Two extra draw calls on one object, against a tower's four.
const FAB_PIVOTS = [...FAB_ROTORS, 'Boom_Yaw', 'Boom_Pitch', 'Head_Pitch', 'Nozzle_Tip',
  'Sensor_Pod', 'Sensor_Lens'];
const FAB_DROP = ['Workpiece_Group', 'Airframe_Collision'];
let fabProto = null, fabLoad = null;
// --- THE PORTAL RING (operator, 2026-09-02) -------------------------------
// The board's gates wear the authored ring now, with the wormhole rendered
// into the hole the blueprint reserves for it.
//
// MERGED, unlike the bench. #portal leaves the 72 meshes unmerged on purpose
// (it reports draw calls and merging would hide the geometry cost); the board
// has a gate per spawn point and cannot pay that. The four moving/reserved
// nodes are named as PIVOTS so the merge preserves them — a part is only
// addressable after mergeByMaterial if it was named before it, which this
// project has already paid to learn once.
const RING_URL = 'assets/models/portalring.glb';
// THE PODS ARE PIVOTS BECAUSE THEY GET BLOWN OFF, one pair per hit.
// mergeByMaterial welds every non-pivot mesh into a batch and drops the
// originals, so the Pod_N_Mount nodes survived by NAME but carried no
// geometry — hiding one hid nothing. Measured: 0 of the 38 named nodes were
// meshes. A part you intend to address later must be named BEFORE the merge,
// which is the third time this project has paid for that sentence.
//
// It costs draw calls: eight pods per gate no longer join the batch. That is
// the price of a part that can be destroyed separately, and it is the whole
// feature.
const RING_PODS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `Pod_${i}_Mount`);
const RING_PIVOTS = ['Rotor_A_Spin', 'Rotor_B_Spin', 'Yaw_Turntable',
  'Aperture_Volume', ...RING_PODS];

// SHADES OF GREY, AND LIT ENOUGH TO SEE (operator, 2026-09-02: "the portal
// metallic frame model is entirely black, it should be shades of grey").
//
// The authored colours were never black — measured, the frame materials sit
// at luminance 0.41 to 0.66. They read black because the default look runs a
// 0.55 hemi and a 0.25 sun, and a standard material under that light is
// near-black whatever you paint it. Exactly the container's problem, and it
// takes the container's fix: each rung carries its OWN emissive, so the
// ladder survives the lighting instead of being erased by it.
//
// M_Glow2 is left alone. It is the pods' glow, already emissive at 0.71, and
// it is the one thing on the model that is SUPPOSED to be a colour.
const RING_REPAINT = {
  M_Armour: [0xc2c8ce, 0x4a5057],   // the big plates — brightest rung
  M_Turret: [0xa8b0b6, 0x3a4046],
  M_Detail: [0x9aa1a7, 0x333940],
  M_Steel: [0x868d93, 0x2a2f34],
  M_Rubber: [0x5e6469, 0x1d2124],   // darkest, so the seals still read
};
let ringLoad = null, ringProto = null;
export function preloadPortalRing() {
  if (ringLoad) return ringLoad;
  ringLoad = loadGlb(RING_URL).then((scene) => {
    if (!scene) { ringLoad = null; return false; }
    // DROP THE HELPERS BEFORE THE MERGE. Base_Collision is a proxy box 67% the
    // size of the whole model, and Callout_1 is a blueprint label card. Neither
    // is drawn on the bench — not because it hides them, but because their
    // authored materials are invisible. The grey repaint below paints EVERY
    // material, so the first build of this lit the collision box up as a giant
    // white square standing over the gate. Excluding them here means no later
    // repaint can bring them back.
    hideCollisionNodes(scene);
    // INSTANCED MESHES MUST NOT BE MERGED. The ring's stators and rotors are
    // authored as InstancedMesh nodes (Block_Instanced, Face_Block_Instanced,
    // RotorA/B_Instanced, Shell_Instanced). mergeByMaterial takes a mesh's
    // BASE geometry and ignores instance matrices — so each instanced part
    // contributed exactly one copy, at the origin. That single block on the
    // turntable's axis was the operator's "unwanted grey block in the centre
    // of the portal" (measured: M_Turret 0.51R and M_Detail 0.26R, unnamed,
    // under Yaw_Turntable — no raw mesh sits there at all), and it also meant
    // every OTHER instance around the ring was silently missing.
    //
    // Two wrong diagnoses before this one, both recorded: a name-excluded
    // callout (the exclude was fine) and a geometric "hub" sweep (there was
    // no hub). What settled it was listing the raw file's meshes by MATERIAL
    // rather than by position.
    //
    // A pivot that is a mesh is left exactly as it is by the merge, so every
    // instanced node is named as one — collected from the file, not typed,
    // so a re-export with different instanced parts still works. It costs
    // one draw call per instanced part per gate; that is the price of the
    // parts existing at all.
    const instanced = [];
    scene.traverse((o) => { if (o.isInstancedMesh && o.name) instanced.push(o.name); });
    console.log(`RING instanced parts kept whole: ${instanced.join(', ') || 'none'}`);
    const merged = mergeByMaterial(scene, [...RING_PIVOTS, ...instanced], ['Base_Collision', 'Callout_1', 'AuxScene_Helpers']);
    // Unit-ish: the caller scales to the cell. Height rather than span,
    // because a gate reads by how tall it stands over the wall it is in.
    ringProto = fitModel(merged, { height: 1.0, maxSpan: 1.2 });
    return true;
  });
  return ringLoad;
}

// One ring. Returns null until the bytes land — callers fall back to the dot
// cloud rather than showing nothing, because a gate you cannot see is a gate
// you cannot shoot.
export function makePortalRing(tint = 0x8fe8ff) {
  if (!ringProto) { preloadPortalRing(); return null; }
  const g = ringProto.clone(true);
  // CLONE THE MATERIALS. Every gate dims independently as it is wounded and
  // loses its own pods, so these carry per-instance state — the container's
  // shared-material shortcut is wrong here for the same reason its lock lamps
  // were.
  const glows = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = list.map((m) => {
      const c = m.clone();
      const rung = RING_REPAINT[m.name];
      if (rung) {
        c.color.setHex(rung[0]);
        if (c.emissive) { c.emissive.setHex(rung[1]); c.emissiveIntensity = 1.0; }
      } else if (/glow/i.test(m.name || '')) {
        if (c.emissive) { c.emissive.setHex(tint); c.emissiveIntensity = 1.6; }
        c.color.setHex(tint);
        glows.push(c);
      }
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
  });
  g.userData.glows = glows;
  // How bright the gate burns — dimmed step by step as it is wounded, and
  // wound UP while a wave charges. One place, so both callers agree.
  g.userData.setDim = (v) => {
    for (const m of glows) m.emissiveIntensity = 1.6 * Math.max(0, v);
  };
  g.userData.pods = RING_PODS.map((n) => g.getObjectByName(n)).filter(Boolean);
  g.userData.rotorA = g.getObjectByName('Rotor_A_Spin');
  g.userData.rotorB = g.getObjectByName('Rotor_B_Spin');
  g.userData.yaw = g.getObjectByName('Yaw_Turntable');
  // The aperture is an EMPTY node whose SCALE carries the reserved volume —
  // a Box3 over it is degenerate and returns nothing. Parent the disc to it
  // at unit radius and the model's own authored size scales it, so a
  // re-export at a different size follows without anyone editing a constant.
  g.userData.aperture = g.getObjectByName('Aperture_Volume');
  return g;
}

// ISAO-BIRUDORŌN (owner, 2026-09-13: Isao still used the older model). The articulated A6 unit, fitted to the fabricator's board size so
// every placement, beam and camera built around the old drone still frames him; loaded alongside the fabricator, which stays the fallback
let isaoProto = null, isaoClips = [];
function preloadBirudoron() {
  return loadGlbWithClips(ISAO_MODEL).then((got) => {
    if (!got?.scene) return false;
    isaoProto = fitModel(got.scene, { height: 0.55, maxSpan: 1.0 }); isaoClips = got.clips;
    return true;
  });
}
export function preloadFabricator() {
  if (fabLoad) return fabLoad;
  const isaoLoad = preloadBirudoron();
  fabLoad = Promise.all([loadGlb(FAB_URL), isaoLoad]).then(([scene]) => {
    if (!scene) { fabLoad = null; return false; }
    const merged = mergeByMaterial(scene, FAB_PIVOTS, FAB_DROP);
    // The drone is parented under Airframe_Platform, which sits at y=1.03
    // in file space because it was authored hovering over the bed we just
    // deleted. fitModel reseats it — min.y to 0, x/z centred — so the
    // offset never reaches the board.
    fabProto = fitModel(merged, { height: 0.55, maxSpan: 1.0 });
    return true;
  });
  return fabLoad;
}
export function makeFabricatorDrone(tint = 0x8fd8ff) {
  if (!fabProto) { preloadFabricator(); return null; }
  const g = fabProto.clone(true);
  tintModel(g, tint, { wash: 0.22, shades: { armour: 1.0, turret: 0.7, detail: 0.55, steel: 0.34 } });
  const rotors = FAB_ROTORS.map((n) => g.getObjectByName(n)).filter(Boolean);
  const boomYaw = g.getObjectByName('Boom_Yaw');
  const boomPitch = g.getObjectByName('Boom_Pitch');
  const headPitch = g.getObjectByName('Head_Pitch');
  const tip = g.getObjectByName('Nozzle_Tip');
  // rest pose of the boom IS gameplay data (the lesson from the mkcx and
  // heptapod castings): read it once, and animate as an offset from it, so
  // stowing the arm means returning to what the artist drew.
  const rest = {
    yaw: boomYaw ? boomYaw.rotation.y : 0,
    pitch: boomPitch ? boomPitch.rotation.x : 0,
    head: headPitch ? headPitch.rotation.x : 0,
  };
  // spin is FREE: one rotation write per rotor per frame, no geometry work.
  // Idle blur at a fixed rate, faster under load, so the machine reads as
  // working before you have parsed anything on the HUD.
  g.userData.spinRotors = (dt, load = 0) => {
    const w = (26 + 34 * load) * dt;
    for (const r of rotors) r.rotation.y += w;
  };
  // work = 0 stows the boom at its authored rest; work = 1 swings it down
  // and out, nozzle toward the ground under the drone
  g.userData.setWork = (work) => {
    const k = Math.max(0, Math.min(1, work));
    if (boomPitch) boomPitch.rotation.x = rest.pitch + 0.85 * k;
    if (headPitch) headPitch.rotation.x = rest.head + 0.55 * k;
    if (boomYaw) boomYaw.rotation.y = rest.yaw;
  };
  g.userData.nozzle = tip || null;
  g.userData.kind = 'fixture';
  return g;
}

// --- ISAO: Bobby with a face ---------------------------------------------
// A second fabricator, kept as its own entity while it earns its place. The
// square sensor pod with the yellow lamp comes off and a CRT goes on: a
// small monitor that shows what the machine thinks about its shift.
//
// Deliberately NOT expressive. In play it wears a handful of preset shapes —
// two eyes and a mouth built from rectangles, drawn the way a machine with
// one font and no anti-aliasing would draw them. The character is in the
// SWITCHING, not in the animation. (The cinematic register, where Isao
// explains the Stålsphere protocol between waves, is the same faces held
// longer and paired with text — nothing new to draw.)
//
// The pod is HIDDEN rather than deleted: the merge welds by material, so
// the lamp lives in a batch with other lit parts and cannot be removed
// without taking them too. Scale-to-nothing is the honest way to drop one
// welded part.
// The face is drawn from the Braille lab's own matrices (src/emotions.js),
// not from shapes invented here — the lab is where expressions are authored
// and this is a renderer. Textures are cached per (id, frame), because a
// static expression is one canvas for the life of the page and an animation
// is four.
const isaoTex = new Map();
function isaoFaceTexture(id, frameIdx = 0) {
  const key = `${id}:${frameIdx}`;
  if (isaoTex.has(key)) return isaoTex.get(key);
  const e = emotion(id);
  const ph = phosphorFor(id);
  const grid = e.frames[Math.min(frameIdx, e.frames.length - 1)];
  const rows = grid.length, cols = grid[0].length;
  // 4x the dot grid, so each dot is a crisp 4px block under NearestFilter
  const DOT = 16, PAD = 8;
  const c = document.createElement('canvas');
  c.width = cols * DOT + PAD * 2;
  c.height = rows * DOT + PAD * 2;
  const x = c.getContext('2d');
  x.fillStyle = ph.ground;
  x.fillRect(0, 0, c.width, c.height);
  // the dots: a bright core with a soft bleed, which is what a phosphor dot
  // actually looks like and what stops an 8x8 face reading as a spreadsheet
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      if (!grid[r][q]) continue;
      const cx = PAD + q * DOT + DOT / 2;
      const cy = PAD + r * DOT + DOT / 2;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, DOT * 0.8);
      g.addColorStop(0, ph.core);
      g.addColorStop(0.35, ph.mid);
      g.addColorStop(1, `rgba(${ph.bleed}, 0)`);
      x.fillStyle = g;
      x.fillRect(cx - DOT, cy - DOT, DOT * 2, DOT * 2);
    }
  }
  // scanlines last, over the drawing, because that is where they are
  x.globalAlpha = 0.3;
  x.fillStyle = '#000';
  for (let y = 0; y < c.height; y += 4) x.fillRect(0, y, c.width, 2);
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;   // the bleed IS the softness; keep it
  isaoTex.set(key, tex);
  return tex;
}

// the A6 Isao: a clone with its own mixer; the face is a clip crossfade, the rotors and the hover bob are always-on layers
function makeBirudoron(tint) {
  const g = isaoProto.clone(true);
  if (tint !== 0xbfe6ff) tintModel(g, tint, { wash: 0.12 });   // the assistant keeps its amber so the pair never read as one
  const mixer = new THREE.AnimationMixer(g), byName = new Map(isaoClips.map((c) => [c.name, c]));
  const idle = ISAO_IDLE_CLIPS.map((n) => byName.get(n)).filter(Boolean).map((c) => { const a = mixer.clipAction(c); a.play(); return a; });
  const rotor = idle.find((a) => a.getClip().name === 'Rotor_Cycle');
  let face = null, action = null;
  g.userData.faces = EMOTION_IDS;
  g.userData.setFace = (name) => {
    if (!EMOTION_IDS.includes(name) || face === name) return;
    face = name;
    const clip = byName.get(ISAO_FACE_CLIPS[name]); if (!clip) return;
    // ONE HELD STATE PER EMOTION (owner, 2026-09-13: minimalism, no constant facial animation): the clip plays once into its pose and holds
    const next = mixer.clipAction(clip); next.reset(); next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; next.play();
    if (action && action !== next) next.crossFadeFrom(action, 0.25, false);
    action = next;
  };
  g.userData.tickFace = (dt) => mixer.update(dt);
  g.userData.getFace = () => face;
  g.userData.spinRotors = (dt, load = 0) => { if (rotor) rotor.timeScale = 1 + 1.3 * load; };
  g.userData.setWork = () => {};
  g.userData.nozzle = g.getObjectByName('TOOL_TIP') || null;
  g.userData.kind = 'fixture'; g.userData.asset = 'isao-birudoron';
  g.userData.setFace('neutral'); mixer.update(0);
  return g;
}
export function makeIsaoDrone(tint = 0xbfe6ff) {
  if (isaoProto) return makeBirudoron(tint);
  const g = makeFabricatorDrone(tint);
  if (!g) return null;
  // WHERE THE POD WAS. Read the position off the node rather than guessing
  // it: the fit group's units are not the file's, and a hand-placed monitor
  // hung off the belly instead of sitting on the nose. Same-source rule —
  // if the model knows where its face goes, ask the model.
  g.updateMatrixWorld(true);
  const podAt = new THREE.Vector3();
  const pod = g.getObjectByName('Sensor_Pod');
  if (pod) { pod.getWorldPosition(podAt); g.worldToLocal(podAt); }
  // off with the lamp head
  for (const n of ['Sensor_Pod', 'Sensor_Lens']) {
    const o = g.getObjectByName(n);
    if (o) o.scale.setScalar(0.0001);
  }
  // the monitor, where the pod was: a shallow bezel with a lit screen. The
  // fitted proto is ~0.55 tall, so these are in the same units the boom and
  // the rotors already live in.
  const crt = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.21, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.8, metalness: 0.2 }),
  );
  crt.add(bezel);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.215, 0.165),
    new THREE.MeshBasicMaterial({ map: isaoFaceTexture('neutral', 0), toneMapped: false }),
  );
  screen.position.z = 0.026;
  crt.add(screen);
  crt.name = 'Isao_CRT';
  // the pod's own place, or a sane nose position if the file ever loses it
  if (pod) crt.position.copy(podAt);
  else crt.position.set(0, 0.42, 0.28);
  g.add(crt);

  let face = 'neutral', shownFrame = -1, faceClock = 0;
  g.userData.faces = EMOTION_IDS;
  g.userData.setFace = (name) => {
    if (!EMOTION_IDS.includes(name) || face === name) return;
    face = name;
    faceClock = 0;
    shownFrame = -1;
    g.userData.tickFace(0);
  };
  // Animated expressions (blink, scan) advance on their OWN declared fps
  // rather than the frame rate — the lab authored them at a cadence and the
  // cadence is part of the expression. A static face costs one comparison.
  g.userData.tickFace = (dt) => {
    faceClock += dt;
    const e = emotion(face);
    const idx = e.frames.length === 1
      ? 0 : Math.floor(faceClock * e.fps) % e.frames.length;
    if (idx === shownFrame) return;
    shownFrame = idx;
    screen.material.map = isaoFaceTexture(face, idx);
    screen.material.needsUpdate = true;
  };
  g.userData.getFace = () => face;
  g.userData.tickFace(0);
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('isao') === '1') {
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const cb = new THREE.Box3().setFromObject(crt);
    console.log(`ISAO pod=${pod ? 'found' : 'MISSING'}`
      + ` crtLocal=${crt.position.toArray().map((v) => v.toFixed(3)).join(',')}`
      + ` crtBox=${cb.min.toArray().map((v) => v.toFixed(2)).join(',')}..${cb.max.toArray().map((v) => v.toFixed(2)).join(',')}`
      + ` droneBox=${bb.min.toArray().map((v) => v.toFixed(2)).join(',')}..${bb.max.toArray().map((v) => v.toFixed(2)).join(',')}`
      + ` inTree=${!!g.getObjectByName('Isao_CRT')}`);
  }
  return g;
}

// --- THE ASTRONAUT, as a game piece ---------------------------------------
//
// CLONING A RIGGED MODEL, without vendoring SkeletonUtils. Object3D.clone()
// copies a SkinnedMesh's `skeleton` BY REFERENCE, so every clone shares one
// set of bones — which means they all deform identically AND stand in the
// same place, because the skin is driven by those bones' world matrices and
// not by the clone's own transform. It looks like the model failed to load.
//
// The fix is twenty lines: clone the graph, pair source bones to clone bones
// by traversal order (clone preserves child order, so the two walks line up
// index for index), and re-`bind` every SkinnedMesh to a fresh Skeleton over
// the cloned bones. Geometry and materials stay SHARED, which is the whole
// reason this is cheap — one upload, N GPU-skinned instances.
//
// Written here rather than vendored on purpose: SkeletonUtils sits in four
// sibling repos' node_modules and all of them ship three r180 against this
// project's r160. "An addon from the sibling's node_modules" is already a
// recorded dead end in .deban, from the Line2 trio.
export function cloneSkinned(source) {
  const clone = source.clone(true);
  const src = [], dst = [];
  source.traverse((o) => src.push(o));
  clone.traverse((o) => dst.push(o));
  const boneMap = new Map();
  for (let i = 0; i < src.length; i++) if (src[i].isBone) boneMap.set(src[i], dst[i]);
  for (let i = 0; i < src.length; i++) {
    const s = src[i], d = dst[i];
    if (!s.isSkinnedMesh || !d.isSkinnedMesh || !s.skeleton) continue;
    const bones = s.skeleton.bones.map((b) => boneMap.get(b)).filter(Boolean);
    d.bind(new THREE.Skeleton(bones, s.skeleton.boneInverses), s.bindMatrix.clone());
    d.frustumCulled = false;   // a skinned bound box is the BIND pose's, not the frame's
  }
  return clone;
}

// TWO ASTRONAUTS, so the people you rescue are not one person repeated.
//
// They are not equals and the difference is the whole reason both are kept:
//   classic — 1 mesh, 25 joints, ONE walk clip. Cheap enough to put six on a
//             board without thinking about it.
//   compact — 51 meshes, 72 joints, ~96k triangles, and THREE clips: Walk,
//             Idle and Running. A real run cycle, which is the thing the
//             crew study was faking by driving a walk faster.
// So the roster is not "pick one", it is a cost the caller can see. Anything
// that spawns a crowd should say which it is asking for.
export const ASTRONAUT_URLS = {
  classic: 'assets/models/astronaut.glb',
  compact: 'assets/models/astronaut-compact.glb',
};
// HOW HARD TO LIFT EACH ONE. The board is lit at hemi 0.55 / sun 0.25
// (looks.js) and a standard material under that is near-black whatever its
// albedo, so the suit's materials take a dim emissive of their OWN colour.
// But how much lift depends on what the model already brings: `classic` is
// one flat material and needs the full push, while `compact` carries 22
// authored PBR materials including glass, and the same push drowns them into
// one glowing orange mass — the identical mistake tintModel made on the
// Workshop's turrets, which is why those keep their authored palette.
const ASTRO_LIFT = { classic: 0.55, compact: 0.18 };
export const ASTRONAUT_IDS = Object.keys(ASTRONAUT_URLS);

// CLIPS BY ROLE, not by index. `classic` carries one clip called
// "Armature|Armature|walking_man|baselayer" and `compact` carries "Mixamo
// Walk" / "Mixamo Idle" / "Mixamo Running", so every caller that wants "the
// run" has to either match names or guess an index — and guessing an index
// is how a survivor ends up idling while it crosses a room. Resolved once,
// here, with the walk as the fallback for everything: a model with no run
// still has to answer a request for one.
function clipRoles(clips) {
  const find = (re) => clips.find((c) => re.test(c.name)) || null;
  const walk = find(/walk/i) || clips[0] || null;
  return {
    walk,
    run: find(/run|sprint|jog/i) || walk,
    idle: find(/idle|stand/i) || walk,
  };
}

const astroLoads = {};
// The prototype: one unit tall, feet on y=0, centred in x/z, facing +Z —
// so a caller scales by ONE number in its own units and never touches the
// file's centimetres again. Same contract every other cast here honours.
export function preloadAstronaut(id = 'classic') {
  const url = ASTRONAUT_URLS[id] || ASTRONAUT_URLS.classic;
  if (astroLoads[id]) return astroLoads[id];
  astroLoads[id] = loadGlbWithClips(url).then((res) => {
    if (!res || !res.scene) { astroLoads[id] = null; return null; }
    const proto = res.scene;
    proto.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(proto);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.y, 1e-6);
    // the normalisation goes on a WRAPPER, not on the rig: scaling the
    // animated root would fight the clip, and re-centring it would move the
    // thing the bones are posed relative to
    const wrap = new THREE.Group();
    proto.scale.setScalar(k);
    proto.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    wrap.add(proto);
    // THE BOARD IS LIT AT HEMI 0.55 / SUN 0.25 (looks.js). A standard
    // material under that is near-black whatever its albedo — the same
    // reason the containers carry a hand-painted emissive rung. So each of
    // the suit's materials takes a dim emissive of its OWN colour: it reads
    // on the board without becoming a lamp, and it stays the model's colours
    // rather than a tint invented here.
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || !m.emissive || m.userData.astroLit) continue;
        m.userData.astroLit = true;
        m.emissive.copy(m.color).multiplyScalar(ASTRO_LIFT[id] ?? 0.55);
        m.emissiveMap = m.map || null;
        m.emissiveIntensity = 1;
        m.needsUpdate = true;
      }
    });
    // measured once, so a caller putting six of these on a board can see the
    // bill rather than discover it as a frame-rate report
    let tris = 0, meshes = 0;
    wrap.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
    });
    const roles = clipRoles(res.clips || []);
    console.log(`ASTRONAUT "${id}" ready: ${meshes} mesh(es), ${Math.round(tris)} tris,`
      + ` clips ${(res.clips || []).map((c) => c.name).join(' / ') || 'none'}`
      + ` -> walk=${roles.walk && roles.walk.name} run=${roles.run && roles.run.name} idle=${roles.idle && roles.idle.name}`);
    return { id, wrap, clips: res.clips, roles, tris: Math.round(tris), meshes };
  });
  return astroLoads[id];
}

// Load every variant. The rescue wants VARIETY, which means it needs them
// all in hand before it starts placing people — a survivor that pops into a
// different body two seconds after it appears is worse than one body twice.
export function preloadAstronauts(ids = ASTRONAUT_IDS) {
  return Promise.all(ids.map((i) => preloadAstronaut(i))).then((all) => all.filter(Boolean));
}

// One astronaut, ready to walk. `tick(dt)` drives its own mixer, so the
// caller owns nothing but a position and a heading.
export function makeAstronaut(proto) {
  if (!proto || !proto.wrap) return null;
  const obj = cloneSkinned(proto.wrap);
  const mixer = new THREE.AnimationMixer(obj);
  const roles = proto.roles || {};
  // one action per ROLE, all playing, all but the current one at zero weight —
  // the standard way to cross-fade without re-creating actions mid-blend
  const acts = {};
  for (const role of ['walk', 'run', 'idle']) {
    const clip = roles[role];
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat, Infinity);
    // a deterministic-looking offset per instance so a group of three does
    // not march in lockstep — the one thing that reads as "clones"
    a.time = (obj.id % 17) / 17 * clip.duration;
    a.setEffectiveWeight(0);
    a.play();
    acts[role] = a;
  }
  let cur = null;
  // THE FALLBACK IS THE POINT. `classic` has one clip, so its run IS its
  // walk — and asking it to run must still look like running, which means
  // driving that one cycle faster. `compact` has a real Running clip and
  // needs no such trick. setGait hides which model it is holding, so a
  // caller can spawn either and ask for the same thing.
  const CADENCE = { walk: 1, run: 1.75, idle: 1 };
  function setGait(role = 'walk') {
    const want = acts[role] ? role : 'walk';
    const a = acts[want];
    if (!a) return;
    if (cur !== a) {
      if (cur) cur.crossFadeTo(a, 0.25, false);
      a.setEffectiveWeight(1);
      a.enabled = true;
      cur = a;
    }
    // if the role resolved to a DIFFERENT clip we are genuinely running, so
    // the cycle runs at its own pace; if it fell back to the walk we have to
    // make the walk do the work
    const real = roles[role] && acts[role] && roles[role] !== roles.walk;
    a.timeScale = real ? 1 : (CADENCE[role] ?? 1);
  }
  setGait('walk');

  obj.userData.tick = (dt) => mixer.update(dt);
  obj.userData.setWalking = (on) => { if (cur) cur.paused = !on; };
  obj.userData.setGait = setGait;
  // ONE CLIP, TWO GAITS — for a model that has only one. The caller owns the
  // STRIDE (metres per second); this owns the CADENCE, and the two have to
  // move together or the feet skate. A model with a real run clip ignores
  // this in favour of the clip's own pace.
  obj.userData.setCadence = (mul) => { if (cur) cur.timeScale = mul; };
  obj.userData.hasRun = !!(roles.run && roles.walk && roles.run !== roles.walk);
  obj.userData.variant = proto.id || 'classic';
  obj.userData.dispose = () => { mixer.stopAllAction(); mixer.uncacheRoot(obj); };
  return obj;
}

export function preloadMkcx(id = 'mkcx2') {
  if (!MKCX_URLS[id]) return Promise.resolve(false);
  if (mkcxLoads[id]) return mkcxLoads[id];
  mkcxLoads[id] = loadGlb(MKCX_URLS[id]).then((scene) => {
    if (!scene) { mkcxLoads[id] = null; return false; }   // let a retry happen
    const marks = markCallouts(scene);
    // The merge parents each batch to its OWNER, and everything outside a
    // preserved pivot is owned by the root we hand it — the glTF SCENE, a
    // sibling of MKCX_Root rather than its parent. So the hull, nacelles and
    // details ended up beside the model instead of inside it, and the hover
    // split (which walks MKCX_Root's children) lifted only the articulated
    // pivots: the turret and secondaries rose while the hull stayed put.
    // attach() re-parents them without moving them.
    const merged = mergeByMaterial(scene, MKCX_PIVOTS, MKCX_DROP);
    const inner = MKCX_ROOTS.map((n) => merged.getObjectByName(n)).find(Boolean);
    if (inner) for (const c of [...merged.children]) if (c !== inner) inner.attach(c);
    const proto = fitModel(merged, {
      // NOTE which of these actually binds. The model is 10.82 long (the
      // barrel juts far forward) against 2.86 tall, so maxSpan decides the
      // scale and height never gets a say. Raising span is what makes the
      // tank bigger; the height stays as an upper guard.
      height: 1.3,
      maxSpan: 1.95,
      // The bounding box is skewed +1.46 in Z by the gun barrel while the
      // hull sits at the origin. Centring on the box would make the tank
      // pivot around a point out in FRONT of itself; centre on the hull.
      recentreOn: 'Hull_Mesh',
    });
    // The house look is a dark body wearing bright additive edges. An
    // imported model has none, which is most of why it read as a lump next
    // to the procedural units. Built on the PROTOTYPE so EdgesGeometry runs
    // once and every clone shares it.
    addEdgeOutlines(proto, { angle: 28, opacity: 0.85 });
    proto.userData.callouts = marks;
    mkcxProtos[id] = proto;
    for (let i = mkcxReadyCbs.length - 1; i >= 0; i--) {
      if (mkcxReadyCbs[i][0] === id) mkcxReadyCbs.splice(i, 1)[0][1]();
    }
    return true;
  });
  return mkcxLoads[id];
}

export function mkcxReady(id = 'mkcx2') { return !!mkcxProtos[id]; }

function makeMkcx(cols, id = 'mkcx2') {
  // self-starting: asking for it is enough to begin the load
  if (!mkcxProtos[id]) { preloadMkcx(id); return makeTank(cols); } // never nothing
  const g = mkcxProtos[id].clone(true);
  // A shade LADDER, not a flat wash. The model's four structural materials
  // sit within 0.05 luminance of each other — all muddy olive-grey — so one
  // uniform tint turned the whole tank into a single coloured mass. Giving
  // each material its own lightness rung is what makes armour, turret,
  // detail and steel read as separate plates.
  tintModel(g, cols.walkerHi ?? 0x7df9ff, {
    wash: 0.45,
    shades: { armour: 1.0, turret: 0.74, detail: 0.52, steel: 0.32 },
    sat: 0.5,
    lightFrom: 0.20,
    lightTo: 0.66,
  });

  // The contract td-tab reads off a player unit. turret and laserGuns are
  // the load-bearing ones: aim is derived from their WORLD quaternions, per
  // the house rule about never re-deriving a render-coupled direction.
  const turret = g.getObjectByName('Turret_Pivot');
  if (turret) {
    // The model ships the turret casually slewed 6 deg off the hull axis
    // (quaternion y = -0.0523). That is fine as sculpture and wrong as a
    // machine: this pivot is never rotated at runtime, and `fire()` derives
    // the shell's heading from its WORLD +Z, so the baked yaw made the tank
    // shoot six degrees off from where it visibly points. Zeroing the rest
    // pose squares the beam AND the aim in one move.
    turret.quaternion.identity();
    g.userData.turret = turret;
    turret.userData.baseZ = turret.position.z; // recoil slides back from here
  }
  const guns = ['Secondary_L_Gun_Pivot', 'Secondary_R_Gun_Pivot']
    .map((n) => g.getObjectByName(n))
    .filter(Boolean);

  // TOE THEM IN, SYMMETRICALLY (operator, 2026-09-01).
  //
  // The authored model gives both secondary turrets the SAME yaw:
  // Secondary_L_Pivot and Secondary_R_Pivot both carry
  // [0, -0.0785, 0, 0.9969] — about 9 degrees the same way round. One of
  // them therefore toes IN and the other toes OUT, which is why the pair
  // never converged and why the two beams could not meet at an apex.
  //
  // Corrected from each turret's OWN SIDE rather than from its name: a gun
  // left of the centreline must yaw toward +X and one right of it toward -X.
  // Deriving it from position means the fix cannot be defeated by an
  // L/R naming convention, in the model or in my head.
  applySecondaryToe(g, SECONDARY_TOE);

  // Split the tank in two so the hull can lift while the skirt stays down.
  // Raising the WHOLE unit reads as flight; raising only the body off a
  // planted skirt reads as weight on suspension. Everything that is not the
  // hover gear becomes one body group — hull, turret, secondaries, details.
  // Health is diegetic: the machine's own running lights read it out, instead
  // of a gauge bolted on beside them. The model puts every accent — six lift
  // emitters down the nacelles, the turret and hull glow strips, the secondary
  // rings, the headlights — on ONE material, `M_Glow`. So the tint is a single
  // material write that lands on all of them at once, wrapping the hull rather
  // than facing one way, which is what makes it legible from every camera.
  //
  // The material is cloned first, and the clone is shared back across every
  // batch that used it. The merge preserves material identity, so painting the
  // loaded instance in place would tint every OTHER mkcx on the field too —
  // they all descend from one cached prototype.
  let glow = null;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m || m.name !== 'M_Glow') continue;
      if (!glow) {
        glow = m.clone();
        if (glow.emissive) glow.emissiveIntensity = 1; // lit, not painted
      }
      if (Array.isArray(o.material)) o.material[i] = glow; else o.material = glow;
    }
  });
  if (glow) g.userData.healthBeam = glow;

  // Extra accents ON THE DECK. The authored glow strips all sit on the
  // flanks, so from the top-down build camera — which is half the game — the
  // health colour was not visible at all, and even side-on they were thin
  // enough to miss. These share the cloned M_Glow material, so they are
  // health-coded for free and cost no extra tint bookkeeping.
  //
  // Placed from the model's own deck fittings rather than by eye:
  // EngineDeck_Grille sits at (0, 1.57, -2.40) and Driver_Hatch at
  // (0, 1.56, 1.15), so the deck runs at y 1.56-1.57; the secondaries are at
  // z 2.30, and "behind" them is toward -z.
  const DECK_Y = 1.60;   // just proud of the deck, so it reads as fitted
  // mkcx2 authors its own deck indicators (Deck_Glow_1/2, on M_Glow, so the
  // health tint paints them); the three the game adds are the MK-CX's
  const deckStrips = glow && id === 'mkcx' ? [
    [0, DECK_Y, -2.92, 2.30, 0.05, 0.42],   // the long one across the stern
    [-0.86, DECK_Y, 1.72, 0.46, 0.05, 0.60], // behind the left secondary
    [0.86, DECK_Y, 1.72, 0.46, 0.05, 0.60],  // and the right
  ] : [];

  // --- the hover rig, in three tiers ---------------------------------------
  // The machine levitates ON the lift emitters, so THEY are what stays welded
  // to the ground; everything above them is free to move. One tier was not
  // enough: raising the whole skirt together made the tank look like it flew
  // off in one piece, with nothing left behind to measure the lift against.
  //
  //   HoverEmitters  planted. the ground reference, never moved.
  //   HoverGear      nacelles + pylons — the skirt, settles by gearDrop.
  //   HoverBody      hull and everything on it, rises by rise.
  //     HullVib      takes the idle vibration at full strength
  //     Weapons      takes a fraction of it, so the guns read as MOUNTED on
  //                  a shaking hull rather than shaking independently
  const gear = g.getObjectByName('Hover_Gear');
  const modelRoot = gear && gear.parent;
  if (modelRoot) {
    // Within the gear the emitters are already separated for us: the merge
    // batches per material, and the emitters are the only M_Glow parts down
    // there — the nacelles are M_Armour and the pylons M_Steel.
    const emitters = new THREE.Group();
    emitters.name = 'HoverEmitters';
    // Added to the model BEFORE anything is attached to it. attach() preserves
    // world transform, so attaching into a group that is not yet in the graph
    // bakes the whole ancestor chain — including fitModel's scale — into the
    // child's local matrix, and adding the group afterwards applies that scale
    // a second time. The emitters came out at k^2: present, correct, and a
    // tenth of the size they should be.
    modelRoot.add(emitters);
    for (const name of MKCX_LIFTERS) {
      const e = gear.getObjectByName(name);
      if (e) emitters.attach(e);
    }

    // Spaced evenly along the nacelle they sit under. The authored z values
    // (-2.35, -0.40, 1.70) are neither centred on the nacelle nor evenly
    // spread — the rear pair bunch and the front one overhangs its end.
    //
    // The span is read off the nacelle BATCH, not a node: `Nacelle_L` stopped
    // existing at the merge, so looking it up by name would quietly find
    // nothing and leave the spacing untouched. The nacelles are the only
    // M_Armour geometry inside the gear, and geometry bounds are already in
    // the space these positions are written in, so no conversion is needed.
    const armour = gear.children.find((c) => {
      const m = Array.isArray(c.material) ? c.material[0] : c.material;
      return c.isMesh && m && m.name === 'M_Armour';
    });
    if (armour && armour.geometry) {
      armour.geometry.computeBoundingBox();
      const nb = armour.geometry.boundingBox;
      const zs = [0.18, 0.5, 0.82];
      for (const e of emitters.children) {
        const i = Number(e.name.slice(-1)) - 1;
        if (i >= 0 && i < zs.length) e.position.z = nb.min.z + (nb.max.z - nb.min.z) * zs[i];
        // Fattened. At the authored 0.43 x 0.05 x 1.15 they were a hairline
        // at play distance, and a health gauge you have to squint at is not
        // one. Wider and taller rather than longer: the length already reads.
        e.scale.set(1.55, 1.8, 1.12);
      }
    }

    const body = new THREE.Group();
    body.name = 'HoverBody';
    // Skip the gear AND the emitters: both are ground-side, and the emitters
    // are already parented here. Without the explicit skip they would be
    // swept into the body and only pulled back out by the re-add below —
    // correct by accident, which is not a thing to leave in a rig.
    for (const c of [...modelRoot.children]) {
      if (c !== gear && c !== emitters) body.add(c);
    }

    // The weapons ride the body but shake less than it does. Both mounts go
    // in together — the primary turret and the secondaries' shared parent.
    const weapons = new THREE.Group();
    weapons.name = 'Weapons';
    // NB: look in `body`, not in `g`. The body group is populated here but
    // not re-attached to the model until further down, so for these few
    // lines everything it holds is invisible to a search from the unit.
    const secondaries = body.getObjectByName('Secondary_Turrets');
    for (const name of ['Turret_Pivot', 'Secondary_Turrets']) {
      const o = body.getObjectByName(name);
      if (o) weapons.add(o);
    }
    // What is left in the body once the weapons are out IS the hull group,
    // so it is moved wholesale rather than picked over by name.
    const hull = new THREE.Group();
    hull.name = 'HullVib';
    for (const c of [...body.children]) hull.add(c);
    // deck accents ride the hull, so they shake with it like the rest of it
    for (const [x, y, z, sx, sy, sz] of deckStrips) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glow);
      strip.position.set(x, y, z);
      strip.name = 'DeckGlow';
      hull.add(strip);
    }
    body.add(hull);
    body.add(weapons);

    modelRoot.add(body);

    g.userData.hoverEmitters = emitters;
    g.userData.hoverBody = body;   // td-tab lifts THIS, not the unit
    g.userData.hoverGear = gear;   // now the skirt alone
    g.userData.hoverHull = hull;
    g.userData.hoverWeapons = weapons;
    g.userData.secondaries = secondaries;
  }
  // The callout markers came along in the clone; collect the instance's own
  // copies (the prototype's would follow the wrong tank around).
  const callouts = [];
  g.traverse((o) => { if (o.userData && o.userData.callout) callouts.push(o); });
  if (callouts.length) g.userData.callouts = callouts;
  const muzzle = callouts.find((o) => o.userData.callout.node === 'Callout_4');
  if (muzzle) g.userData.muzzle = muzzle;   // where a shell leaves the gun

  if (guns.length) g.userData.laserGuns = guns;
  // The model has no shell rack of its own, so build the procedural tank's
  // one onto the turret roof: 3x3, row-major, index < ammo lit. Parented to
  // the turret so it sweeps with the gun exactly as the original does.
  // Turret_Pivot's local bounds are y 0.07..1.34, so the roof is ~1.34.
  // mkcx2 racks the shells IN THE HULL: nine sockets in the rear deck and
  // an empty at their centre, so the dots sit flush on the flat top with no
  // plate and no turret under them (they do not sweep with the gun, which is
  // the point — the deck is the rack).
  const rackMount = g.getObjectByName('ShellRack_Mount');
  if (rackMount) {
    g.userData.ammoDots = makeShellRack(rackMount, {
      y: 0.13, dot: 0.15, gapX: 0.46, gapZ: 0.50, plate: null,
    });
  } else if (turret) {
    // The turret roof the artist drew is a small hexagon; a 3x3 rack sized
    // to be readable overhangs it. So the rack brings its own dark plate,
    // sized to hold all nine — the same read as the procedural tank's.
    g.userData.ammoDots = makeShellRack(turret, {
      // Sampled the turret's roof height across z (|x|<1.2, turret-local):
      // it PEAKS at z=-1.0, y=1.71 and falls away both ways — 1.46 at
      // z=-1.5 and -0.5, 0.96 by z=0. So the rack centres on that crown at
      // z=-1.0, and y=1.98 puts the plate's underside at 1.76, clearing the
      // peak. Earlier values sat the plate BELOW the crown, which is why it
      // clipped through.
      y: 1.98, z: -1.0, dot: 0.15, gapX: 0.46, gapZ: 0.50,
      plate: { pad: 0.34, thickness: 0.14, color: 0x232a38,
        outline: cols.walkerHi ?? 0x7df9ff },
    });
  }
  // The pieces the model doesn't have but our tank does, so the two feel
  // like the same machine shop. Barrel_Pivot survives the merge as an empty
  // at (0, 0.54, 1.05) — a clean anchor for the sleeve.
  const barrel = g.getObjectByName('Barrel_Pivot');
  if (barrel) {
    g.userData.heatSleeve = makeHeatSleeve(barrel, {
      // 3x longer than it was, same radius: the cool->hot gauge is the most
      // legible thing on the tank and it was too short a band to read at
      // gameplay distance. Pushed forward so the longer sleeve still sits on
      // the barrel rather than starting inside the mantlet.
      radius: 0.34, len: MKCX_SLEEVES[id].main.len, z: MKCX_SLEEVES[id].main.z,
      color: cols.walkerHi ?? 0x7df9ff,
    });
  }
  // No added gun tubes: the model already HAS secondary gun barrels, and
  // laying ours over them read as glowing bars stuck through the deck. The
  // merged gun mesh is children[0] of each pivot, which is exactly where
  // td-tab looks for the heat gauge — so the model's own gun glows instead.
  // Both share one material so they heat together, as makeTank's do.
  if (guns.length === 2 && guns[0].children[0] && guns[1].children[0]) {
    // CLONE the gun material: mergeByMaterial can hand these meshes the
    // same material instance as other hull parts, so heating the shared
    // instance tinted half the deck by a hair and the guns by nothing
    // visible. A private clone, shared between the two guns only, heats
    // alone — and is stashed on userData so the tab can drive its EMISSIVE
    // channel too (a color multiply on a dark textured PBR gun is nearly
    // invisible; an emissive glow is what the bloom chain amplifies).
    const src = guns[0].children[0].material;
    if (!Array.isArray(src)) {
      const mat = src.clone();
      guns[0].children[0].material = mat;
      guns[1].children[0].material = mat;
      g.userData.gunHeatMat = mat;
      // ...and the emissive alone still never READ at gameplay distance
      // (operator confirmed on 1c834a26): the cannon's gauge is legible
      // because it is a dedicated MeshBasicMaterial SLEEVE, not the model's
      // own PBR. The secondaries get the same instrument — one sleeve per
      // gun, one shared material so both heat together.
      const sl = makeHeatSleeve(guns[0], {
        radius: 0.16, len: MKCX_SLEEVES[id].sec.len, z: MKCX_SLEEVES[id].sec.z, color: cols.walkerHi ?? 0x7df9ff });
      const sr = makeHeatSleeve(guns[1], {
        radius: 0.16, len: MKCX_SLEEVES[id].sec.len, z: MKCX_SLEEVES[id].sec.z, color: cols.walkerHi ?? 0x7df9ff });
      sr.material.dispose();
      sr.material = sl.material;
      g.userData.laserSleeveMat = sl.material;
    } else {
      guns[1].children[0].material = src;
    }
  }
  g.userData.tick = (t) => { if (turret) turret.rotation.y = Math.sin(t * 0.6) * 0.7; };
  g.userData.lift = 0.02;
  // Rendered size, NOT model normalization — fitModel already fixed the
  // model's proportions; this is what td-tab multiplies by.
  //
  // Measured against the PROCEDURAL TANK, which is the unit the board was
  // actually built around — an absolute measurement needs a reference, and
  // that is the only honest one available. Both units are multiplied by the
  // same `unitScale`, so comparing `baseScale * raw size` compares world
  // footprints directly and is free of any board-density term.
  //
  //            width    length   (world size per unit of unitScale)
  //   tank     0.508    0.729
  //   mkcx     0.382    1.051    at 0.54  — still read as small on the board
  //   mkcx     0.531    1.460    at 0.75  — a shade wider than the reference
  //
  // The previous 0.147 came from comparing the mkcx's LENGTH against a
  // corridor's WIDTH. The mkcx is 2.75:1 where the procedural tank is
  // 1.44:1, so that mistake shrank it by most of that ratio and it read as
  // a toy on the board. A tank may be longer than a lane is wide; it may
  // not be WIDER. 0.54 kept it a quarter narrower than the reference and it
  // still read as small in play, so it now sits just OVER that width — the
  // mkcx is the heavier machine, and the board is built for something this
  // size. The unit viewer divides this out, so its look is unaffected.
  g.userData.baseScale = 0.75;
  g.userData.kind = 'mesh';
  return g;
}

// --- pickups, as SOLIDS ---------------------------------------------------
// Half-dotted clouds are the ENEMY language in this game. Pickups were
// speaking it too, so a power-up on the ground read as something to shoot.
// Solid bodies with bright additive edges put them firmly on the player's
// side of the visual grammar, and shape alone tells the three apart before
// colour does.

// Bright edges, the house Tron read, without the dot cloud.
function solidWithEdges(geo, body, hi) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    color: body, emissive: new THREE.Color(body).multiplyScalar(0.55),
  }));
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({
    color: hi, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  return mesh;
}

// Shape carries the meaning: a spiked star for speed, a rounded cell for
// health, a ring for the regen charge you carry home.
const REWARD_GEO = {
  star: () => new THREE.OctahedronGeometry(1, 0),
  cell: () => new THREE.IcosahedronGeometry(0.92, 0),
  ring: () => new THREE.TorusGeometry(0.72, 0.3, 8, 14),
  dome: () => new THREE.SphereGeometry(0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
};

export function makeRewardSolid(shape, cols, phase = 0) {
  const g = new THREE.Group();
  const geo = (REWARD_GEO[shape] || REWARD_GEO.star)();
  const core = solidWithEdges(geo, cols.body, cols.hi ?? 0xffffff);
  g.add(core);
  // hovers and turns, so it reads as a thing placed there rather than debris
  g.userData.tick = (t) => {
    core.rotation.y = t * 0.9 + phase;
    core.rotation.x = Math.sin(t * 0.7 + phase) * 0.25;
    core.position.y = Math.sin(t * 1.6 + phase) * 0.18;
  };
  g.userData.kind = 'mesh';
  return g;
}

// One solid shell: a cone nose on a short body. Three of these make a triad.
export function makeShellSolid(cols) {
  return makeOrdnanceShell(1.62,'y');
}

// The roster the tab dropdowns are built from, and the `kind` the board tabs
// branch on. CAREFUL: `kind` here describes which ANIMATION PATH a unit takes
// — 'cloud' means the live Wave x Jelly deform with phagocytosis, 'mesh'
// means transform-only idle via userData.tick — NOT which builder produces
// it. Since the migration to buildCreature, a 'mesh' entry like drifter is
// built as a dot cloud and still takes the transform-only path, which is
// correct. Read this field as "how does it move", never as "what is it made
// of".
//
// The `make` functions for the hostiles (makeSaturn, makeCorona, makeMine and
// friends) are no longer reached for those types — buildCreature routes them
// to makeDotEnemy. They are kept because the roster and its dropdowns still
// name them, and deleting them is a separate decision from migrating.
export const UNITS = {
  amoeba: { kind: 'cloud' },
  phage: { kind: 'cloud' },
  jellyfish: { kind: 'cloud' },
  tank: { kind: 'mesh', make: makeTank },
  mkcx: { kind: 'mesh', make: (cols) => makeMkcx(cols, 'mkcx') },     // the relic
  mkcx2: { kind: 'mesh', make: (cols) => makeMkcx(cols, 'mkcx2') },   // legacy casting
  mork: { kind: 'mesh', make: cols => {
    const model = makeMork();
    if (model) return model;
    const fallback = makeTank(cols); fallback.userData.loading = true; return fallback;
  } },
  // REVIEW TIERS, pinned at 771e166 (docs/hover-tank-tiers-assets.lock.json).
  // mork-low is the articulated game tier that would replace the shipped hull;
  // mork-proxy is the static distance stand-in for bays and orbital views. Both
  // come out of mork.js's one prepare and one make, so reviewing them here is
  // reviewing exactly what the game would field — not a lookalike.
  'mork-low': { kind: 'mesh', make: cols => {
    const model = makeMorkTier('low');
    if (model) return model;
    const fallback = makeTank(cols); fallback.userData.loading = true; return fallback;
  } },
  'mork-proxy': { kind: 'mesh', make: cols => {
    const model = makeMorkProxy();
    if (model) return model;
    const fallback = makeTank(cols); fallback.userData.loading = true; return fallback;
  } },
  drone: { kind: 'mesh', make: makeDrone },
  ghost: { kind: 'mesh', make: makeGhost },
  scoutufo: { kind: 'mesh', make: makeUfo },
  gslime: { kind: 'mesh', make: makeSlime },
  drifter: { kind: 'mesh', make: makeSaturn },
  corona: { kind: 'mesh', make: makeCorona },
  // THE JELLY MASS — a boss-sized translucent body that wobbles in the
  // vertex shader. 3,380 triangles and one draw call, against the 144,464
  // and the 240 Hz soft body of the version that was measured and refused.
  jelly: { kind: 'mesh', make: makeJelly },
  barbed: { kind: 'mesh', make: makeMine },
  rolling: { kind: 'mesh', make: makeMine }, // HK reuses the seamine shape
  prime: { kind: 'mesh', make: makeMine },   // ditto — tint carries the tier
  knot: { kind: 'mesh', make: makeKnot },
};

export const UNIT_NAMES = Object.keys(UNITS);

// The ONE way to ask for a creature, so no tab has to remember which of the
// two representations is the real one.
//
// Every hostile has a mesh form in UNITS (makeSaturn, makeCorona, makeMine)
// that predates the dot clouds, and buildUnit still returns it. The clouds
// are what the tower-defence tab spawns, they carry the rammable/not tell,
// and they are what the unit viewer documents — so they are the truth, and a
// tab showing the mesh form is showing a creature the player never meets.
//
// The choice is made from ENEMY_SPEC rather than a list here: anything the
// game has a creature spec for gets its cloud, anything else (the tank, the
// mkcx, the drone) falls through to buildUnit unchanged.
export function buildCreature(name, cols) {
  // A HOSTILE MAY BE A MESH. Every enemy up to now has been a dot cloud, so
  // this asked one question — spec or not — and answered it with
  // makeDotEnemy. A type whose spec names `mesh` gets that unit instead, and
  // because this is the ONE door, the viewer, the radar sprites, the debrief
  // roster and the board all learn it at once. Without the dispatch here the
  // jelly renders as the cloud FALLBACK — a red ball with an octahedron in
  // it — everywhere, which is exactly what it did.
  const spec = ENEMY_SPEC[name];
  if (spec && spec.mesh && UNITS[spec.mesh]) return buildUnit(spec.mesh, cols);
  return spec ? makeDotEnemy(name, cols) : buildUnit(name, cols);
}

export function buildUnit(name, cols) {
  const u = UNITS[name] || UNITS.tank;
  return u.kind === 'cloud' ? makeCloud(name, cols) : u.make(cols);
}
