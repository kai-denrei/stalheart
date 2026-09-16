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
import { makeMork, makeMorkTier, makeMorkProxy, MORK_UNIT } from './mork.js';
import { DEFAULT_TANK } from './content/tank.js';
export { preloadMork, preloadMorkTier, preloadMorkProxy } from './mork.js';
import { makeJelly } from './jelly.js';
import { EMOTION_IDS, emotion, phosphorFor } from './emotions.js';
import { printPhase, printOffset, printOn } from './printpath.js';
import { ISAO_MODEL, ISAO_FACE_CLIPS, ISAO_IDLE_CLIPS } from './content/isao-faces.js';
import { loadGlb, loadGlbWithClips, mergeByMaterial, fitModel, tintModel, makeShellRack,
  addEdgeOutlines, makeHeatSleeve } from './glbmodels.js';
import { CREATURES, thinCloud, spherePts, bulletPts, missilePts, heartPts, torusPts, cloudFormPoints, enemyDotPts } from './creatures.js';
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

/* THE HULL IS MÖRK OR IT IS NOTHING. Every tier of the tank is a GLB, so a
   board built before the bytes land needs SOMETHING under the unit contract —
   and that something used to be a procedural survey-tank casting, drawn for a
   frame and then replaced (owner, 2026-09-16: "there is still a frame where
   the old tank loads and is then replaced"). This is the same placeholder with
   no body: it carries MÖRK's own baseScale, lift and asset, so every consumer
   sizes and places it exactly as the hull it stands in for, and it draws
   nothing at all. `loading` is the flag the game, the labs and the acceptance
   probes already read, so nobody has to learn a new tell. */
function makePendingHull() {
  const g = new THREE.Group();
  Object.assign(g.userData, MORK_UNIT, { loading: true, tick: () => {}, dispose: () => {} });
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
// densify the game's own creature instead of carrying a copy.
export function dotShapePts(type, dens = 1) {
  return (DOT_SHAPES[type] || ((d = 1) => spherePts(Math.round(140 * d))))(dens);
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
// model's own `secondaryPivots`, else any gun objects it hangs on
// `userData.laserGuns`.
//
// The second lookup is not cosmetic. A name-only lookup for
// `Secondary_*_Pivot` found nothing on MÖRK, silently did nothing, and left a
// reach-solved toe reading as the old fixed one in every measurement.
// `userData.laserGuns` is the handle the beams themselves are found by, so it
// is the right one here too. A hull that has not loaded has neither, and the
// empty list is the honest answer: there is nothing to toe yet.
export function secondaryPivots(g) {
  if (g.userData?.secondaryPivots) return g.userData.secondaryPivots;
  const named = ['Secondary_L_Pivot', 'Secondary_R_Pivot']
    .map((nm) => g.getObjectByName(nm)).filter(Boolean);
  if (named.length >= 2) return named;
  const guns = g.userData && g.userData.laserGuns;
  return Array.isArray(guns) ? guns.filter(Boolean) : [];
}

// Authored GLBs ship their collision volumes as visible red wireframes —
// helper meshes for the DCC, noise everywhere else. Hidden, not removed:
// a future physics pass may want to read them.
function hideCollisionNodes(root) {
  root.traverse((o) => { if (/collision/i.test(o.name || '')) o.visible = false; });
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
// CLONING A RIGGED MODEL is src/fx/skinned-clone.js: the story base's landmarks
// clone cached glTFs too, and a shared skeleton there draws a sheet across the sky.
export { cloneSkinned } from './fx/skinned-clone.js';

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
  mork: { kind: 'mesh', make: () => {
    const model = makeMork();
    if (model) return model;
    return makePendingHull();
  } },
  // REVIEW TIERS, pinned at 771e166 (docs/hover-tank-tiers-assets.lock.json).
  // mork-low is the articulated game tier that would replace the shipped hull;
  // mork-proxy is the static distance stand-in for bays and orbital views. Both
  // come out of mork.js's one prepare and one make, so reviewing them here is
  // reviewing exactly what the game would field — not a lookalike.
  'mork-low': { kind: 'mesh', make: () => {
    const model = makeMorkTier('low');
    if (model) return model;
    return makePendingHull();
  } },
  'mork-proxy': { kind: 'mesh', make: () => {
    const model = makeMorkProxy();
    if (model) return model;
    return makePendingHull();
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
  const u = UNITS[name] || UNITS[DEFAULT_TANK];
  return u.kind === 'cloud' ? makeCloud(name, cols) : u.make(cols);
}
