// THE DROP'S LOOK (owner, 2026-10-23, after the first test of the FEIDS-26 drop: "the blue flames and burn animation needs work 2) the mechs too are
// surrounded by an orange bubble, it should be a more believable mix of re-entry burn and smoke/wind effects. 3) more rubbles when they land";
// spec docs/superpowers/specs/2026-10-23-drop-fx-design.md). The owner's demo is the reference (SentryTowers_A6 feids26/viewer.js, shield-heat.js,
// ridgeback-drop/effects.js); its effects ported here, in the demo's metres, as functions of the drop's clock (no particle history: a seek, a skip or
// a slow frame lands on the same picture), every pool built once at the drop's begin():
//   createFeidsKit()             -> the shared parts: the soft round sprite (the demo's radial-gradient CanvasTexture), the 24 flame-trail strips along
//                                   the capsule's spindle (radiusAt over the PROFILE, AXIAL_STRETCH 1.4), the crack lines, the rock chunk; kit.dispose()
//   capsuleHeat(kit)             -> { group, update(heat, t), dispose() } the shield's burn: the blue glow, the white torus rim at the shield, the 24 trails
//                                   streaming along local -Z (the tail); placed at the capsule's axis in its own frame (the leading shield is local +Z)
//   thermalShell(root)           -> { update(heat, t), dispose() } the shell's thermal emissive (shield-heat.js) on CLONES of the GLB's materials
//   mechBurn(kit, index)         -> { group, update(s, t), dispose() } a falling Ridgeback's re-entry: 45 fire sprites rising behind the body and 16 grey
//                                   smoke sprites farther up, pulled along -x by a constant wind; the group sits at the body's point, not turned with it
//   touchdownFx(kit, index, k)   -> { group, update(s), dispose() } at the touchdown: the demo's 42 smoke sprites (opacity x k), its crack lines, and 24
//                                   rock chunks thrown from the feet in a ring, ballistic, settling and staying as rubble
//   chunkAt(i, index, tau, out)  -> a chunk's offset from the feet (metres, y up) and its tumble angle `tau` s after the touchdown (pure, tested; src/fx/rock-chunks.js, re-exported)
import * as THREE from '../../vendor/three.module.js';
import { ROCK, createRockChunks } from './rock-chunks.js';   // the chunks' flight lifted out for THE ARENA's lip too (2026-10-23, arena-road spec decision 3)
export { chunkAt } from './rock-chunks.js';

// the capsule's spindle (the demo's assets/feids26/runtime.js PROFILE): [z, radius] in metres, z along the shell's axis, +Z the leading shield
const AXIAL_STRETCH = 1.4;
export const PROFILE = [[-7.2, 0.04], [-5.76, 1.35], [-4.32, 2.4], [-2.88, 3.15], [-1.44, 3.6], [0, 3.75], [1.44, 3.6], [2.88, 3.15], [4.32, 2.4], [5.76, 1.35], [7.2, 0.04]].map(([z, r]) => [z * AXIAL_STRETCH, r]);
export function radiusAt(z) {
  for (let i = 1; i < PROFILE.length; i++) if (z <= PROFILE[i][0]) { const [a, r] = PROFILE[i - 1], [b, s] = PROFILE[i]; return r + (s - r) * (z - a) / (b - a); }
  return 0.08;
}

const FIRE = 45, FIRE_HOT = 0xff6a16, FIRE_CORE = 0xffdca0, SMOKE = 16, SMOKE_TINTS = [0x71695c, 0x55585a], WIND = 0.8;
const DUST = 42;
const frac = (x) => x - Math.floor(x);

export function createFeidsKit() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  // the 24 flame trails (viewer.js): vertex-coloured strips from the shield (z 9.35) back 18.3 m, widening off the hull, blue fading to nothing
  const trails = [];
  for (let k = 0; k < 24; k++) {
    const positions = [], colors = [], indices = [], steps = 18;
    for (let j = 0; j <= steps; j++) {
      const u = j / steps, z = 9.35 - u * 18.3, r = radiusAt(z) + 0.2 + u * 1.25, a = k * Math.PI / 12 + Math.sin(u * 8 + k) * 0.035, width = 0.12 + Math.sin(Math.PI * u) * 0.2, fade = (1 - u) ** 0.65;
      for (const side of [-1, 1]) { const th = a + side * width / r; positions.push(Math.cos(th) * r, Math.sin(th) * r, z); colors.push(0.1 * fade, 0.45 * fade, fade); }
      if (j < steps) { const n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices);
    trails.push(geo);
  }
  // the crack lines (effects.js): 18 rays of four kinked segments with a branch, on the ground at 0.025 m
  const verts = [];
  for (let k = 0; k < 18; k++) {
    let x = Math.cos(k * 2.4) * 1.3, z = Math.sin(k * 2.4) * 1.3;
    for (let j = 0; j < 4; j++) {
      const a = k * 2.4 + Math.sin(k * 19 + j * 5) * 0.28, nx = x + Math.cos(a) * (0.3 + j * 0.14), nz = z + Math.sin(a) * (0.3 + j * 0.14);
      verts.push(x, 0.025, z, nx, 0.025, nz);
      if (j === 2) verts.push(nx, 0.026, nz, nx + Math.cos(a + 0.8) * 0.6, 0.026, nz + Math.sin(a + 0.8) * 0.6);
      x = nx; z = nz;
    }
  }
  const cracks = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const chunk = new THREE.IcosahedronGeometry(1, 0), rock = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 1, flatShading: true });
  return { texture, trails, cracks, chunk, rock, dispose() { texture.dispose(); for (const t of trails) t.dispose(); cracks.dispose(); chunk.dispose(); rock.dispose(); } };
}

const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
const sprite = (kit, color, additive) => new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.texture, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
const disposeOwn = (group) => group.traverse((o) => { if (o.material && !o.userData.shared) o.material.dispose(); if (o.geometry && o.userData.ownGeometry) o.geometry.dispose(); });

export function capsuleHeat(kit) {
  const group = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMat(0x2689ff, 0.3)); glow.scale.set(1.7, 1.7, 1.5); glow.position.z = 8.8; glow.userData.ownGeometry = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.28, 6, 32), glowMat(0xf5f7ff, 1)); rim.position.z = 8.9; rim.userData.ownGeometry = true;
  group.add(glow, rim);
  const trails = kit.trails.map((geo) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); group.add(m); return m; });
  return {
    group,
    // the demo's pulse: the group breathing 2.5 % at 71 rad/s, the glow at half the heat, the rim at the heat, each trail 0.58 x heat x (0.8 + 0.2 sin)
    update(heat, t) {
      group.visible = heat > 0.001; if (!group.visible) return;
      group.scale.setScalar(1 + 0.025 * Math.sin(t * 71));
      glow.material.opacity = heat * 0.5; rim.material.opacity = heat;
      trails.forEach((m, k) => { m.material.opacity = heat * 0.58 * (0.8 + 0.2 * Math.sin(t * 31 + k * 2.4)); });
    },
    dispose() { disposeOwn(group); group.removeFromParent(); },
  };
}

// the shell's thermal emissive (the demo's shield-heat.js): a hot band over the leading half, red at the shoulder, blue-white at the tip, its crests
// moving toward local -Z (upward in the nose-down entry); one clone of each GLB material the shell's meshes carry, the GLB's own left cold
export function thermalShell(root) {
  const uniforms = { shieldHeat: { value: 0 }, shieldTime: { value: 0 } }, clones = new Map(), tip = PROFILE.at(-1)[0].toFixed(4);
  const thermal = (source) => {
    const material = source.clone();
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 shieldLocal; varying vec3 shieldNormal;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nshieldLocal=position; shieldNormal=normal;');
      shader.fragmentShader = 'uniform float shieldHeat; uniform float shieldTime; varying vec3 shieldLocal; varying vec3 shieldNormal;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float tip=clamp(shieldLocal.z/${tip},0.0,1.0);
  float outside=smoothstep(0.0,0.4,dot(shieldNormal.xy,normalize(shieldLocal.xy+vec2(.0001))));
  float band=.7+.3*sin(shieldLocal.z*8.0+shieldTime*17.0+sin(shieldLocal.x*11.0));
  float mask=smoothstep(0.0,1.1,shieldLocal.z)*outside;
  vec3 hot=mix(vec3(1.0,.13,.025),vec3(.3,.65,1.0),smoothstep(.65,1.0,tip));
  totalEmissiveRadiance+=hot*shieldHeat*mask*(.3+pow(tip,1.7)*2.8)*band;
`);
    };
    material.customProgramCacheKey = () => 'feids-shield-heat-v2';
    return material;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => { if (!clones.has(m)) clones.set(m, thermal(m)); return clones.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return {
    update(heat, t) { uniforms.shieldHeat.value = heat; uniforms.shieldTime.value = t; },
    dispose() { for (const m of clones.values()) m.dispose(); clones.clear(); },
  };
}

export function mechBurn(kit, index) {
  const group = new THREE.Group();
  const fire = Array.from({ length: FIRE }, (_, i) => sprite(kit, i % 4 ? FIRE_HOT : FIRE_CORE, true));
  const smoke = Array.from({ length: SMOKE }, (_, i) => sprite(kit, SMOKE_TINTS[i % 2], false));
  for (const m of smoke) m.renderOrder = -1;   // the smoke behind the flames it trails
  group.add(...smoke, ...fire);
  return {
    group,
    // s: the cargo's state (heat, the body's fall); the group placed by the caller at the body's point + 0.7 m, in the drop's frame
    update(s, t) {
      const heat = s.heat; group.visible = heat > 0.001; if (!group.visible) return;
      fire.forEach((m, i) => {   // effects.js: rising q * (5 + heat * 8) m behind the falling body, stretched as they rise, fading out
        const q = frac(t * (0.7 + (i % 3) * 0.12) + i * 0.618), a = i * 2.399 + index;
        m.position.set(Math.cos(a) * (1.15 + q * 0.5), q * (5 + heat * 8), Math.sin(a) * (1.1 + q * 0.5));
        m.scale.set((0.5 + q) * heat, (1 + q * 4) * heat, 1); m.material.opacity = heat * (1 - q) * 0.6;
      });
      smoke.forEach((m, i) => {   // the wind and smoke the demo lacks: farther up, wider, fading, pulled along -x
        const q = frac(t * (0.38 + (i % 4) * 0.07) + i * 0.381), a = i * 2.399 + index * 1.7, spread = 1.5 + q * 2;
        m.position.set(Math.cos(a) * spread - WIND * q, q * (9 + heat * 10), Math.sin(a) * spread);
        m.scale.setScalar((1.6 + q * 3.4) * (0.6 + 0.4 * heat)); m.material.opacity = 0.35 * heat * (1 - q);
      });
    },
    dispose() { disposeOwn(group); group.removeFromParent(); },
  };
}

export function touchdownFx(kit, index, smokeK = 0.65) {
  const group = new THREE.Group(); group.visible = false;
  const dust = Array.from({ length: DUST }, (_, i) => sprite(kit, i % 2 ? 0x71695c : 0x55585a, false));
  const cracks = new THREE.LineSegments(kit.cracks, new THREE.LineBasicMaterial({ color: 0x151515 }));
  const rocks = createRockChunks({ geometry: kit.chunk, material: kit.rock, index });
  group.add(cracks, rocks.mesh, ...dust);
  return {
    group,
    // s: the cargo's state (hit: seconds since its touchdown, yaw); the group placed by the caller on the ground at the landing spot, in the drop's frame
    update(s) {
      group.visible = s.hit >= 0; if (!group.visible) return;
      cracks.rotation.y = s.yaw; cracks.scale.setScalar(Math.min(1, Math.max(1e-3, s.hit * 7)));
      dust.forEach((m, i) => {   // effects.js: the impact's smoke ring spreading, rising and thinning over 5 s
        const a = i * 2.399, age = s.hit - (i % 5) * 0.035, spread = 1 + Math.max(0, age) * (0.9 + (i % 4) * 0.35);
        m.visible = age >= 0 && age < 5; if (!m.visible) return;
        m.position.set(Math.cos(a) * spread, 0.2 + Math.max(0, age) * (0.3 + (i % 3) * 0.13), Math.sin(a) * spread);
        m.scale.setScalar(0.7 + Math.max(0, age) * 1.3); m.material.opacity = Math.max(0, 0.5 - age * 0.1) * smokeK;
      });
      rocks.update(s.hit);   // src/fx/rock-chunks.js: the 24 chunks thrown from the feet, resting and staying
    },
    dispose() { rocks.dispose(); disposeOwn(group); group.removeFromParent(); },
  };
}
