// cine/cloud.js — A DOT ENEMY AT CINEMA DENSITY.
//
// The game's enemy is a Braille dot cloud: ~150–500 hard 2 px specks, the
// read every player knows. A cinematic wants the same creature with ten
// times the points, drawn as a body — a hard core of the generator's own
// points and a soft additive halo scattered around each of them, both
// size-attenuated so the thing grows as it comes at the camera.
//
// The generator is NOT touched. creatures.js is a verbatim port of the lab
// ("copy, don't improve"), and densifying a shape is a property of the
// cloud, not the shape: every base point becomes one core point plus
// (density − 1) halo points jittered by a seeded gaussian. The silhouette,
// the foot tips that pop, the tail sheath — all of it is exactly the game's
// phage, only fuller. Plan §2.9(a), ruled in for the swarm.
import * as THREE from '../../vendor/three.module.js';
import { dotShapePts } from '../units.js';
import { mulberry32 } from '../rng.js';

let softTex = null;
// a radial-falloff sprite: a point is a SQUARE unless told otherwise
function softSprite() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  softTex.colorSpace = THREE.SRGBColorSpace;
  return softTex;
}

function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v);
}

/**
 * @param type   a DOT_SHAPES key (phage, ghost, drifter, …)
 * @param density  points per base point; 10 is the plan's number
 * @param spread   halo scatter, in the shape's own unit
 * @param body / accent  the belt colour and its accent, as the game paints them
 * @param size   world scale of the unit shape
 * @param seed   the halo's scatter is seeded — a capture is byte-stable
 */
export function makeCinemaCloud(type, {
  // judged on stills at t=9.6 / 11.4: spread 0.035, halo 0.075 @ 0.28 read
  // as cotton — the skeleton lost under its own glow. The core is bigger and
  // the halo tighter and dimmer now, so the lander's legs and capsid stay
  // legible and the glow is a rim on them, not a cloud around them.
  density = 10, spread = 0.022, body = 0xe8f4ff, accent = 0xffffff, size = 1, seed = 1,
  coreSize = 0.032, haloSize = 0.048, haloOpacity = 0.15,
} = {}) {
  const base = dotShapePts(type);
  const rng = mulberry32((seed >>> 0) || 1);
  const cBody = new THREE.Color(body), cHi = new THREE.Color(accent);
  const n = base.length, m = n * Math.max(0, density - 1);

  const cPos = new Float32Array(n * 3), cCol = new Float32Array(n * 3);
  const hPos = new Float32Array(m * 3), hCol = new Float32Array(m * 3);
  let h = 0;
  for (let i = 0; i < n; i++) {
    const p = base[i];
    const c = p[3] === 1 ? cHi : cBody;
    cPos[i * 3] = p[0]; cPos[i * 3 + 1] = p[1]; cPos[i * 3 + 2] = p[2];
    cCol[i * 3] = c.r; cCol[i * 3 + 1] = c.g; cCol[i * 3 + 2] = c.b;
    for (let k = 1; k < density; k++, h++) {
      hPos[h * 3] = p[0] + gaussian(rng) * spread;
      hPos[h * 3 + 1] = p[1] + gaussian(rng) * spread;
      hPos[h * 3 + 2] = p[2] + gaussian(rng) * spread;
      // the halo carries the body colour, dimmed: additive blending sums it
      hCol[h * 3] = c.r * 0.7; hCol[h * 3 + 1] = c.g * 0.7; hCol[h * 3 + 2] = c.b * 0.7;
    }
  }
  const geo = (pos, col) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  // THE CORE: hard, opaque, the generator's own points — the silhouette
  const core = new THREE.Points(geo(cPos, cCol), new THREE.PointsMaterial({
    size: coreSize, sizeAttenuation: true, vertexColors: true,
    map: softSprite(), alphaTest: 0.4, transparent: true, depthWrite: false,
  }));
  // THE HALO: soft, additive, never writes depth — a glow around the body
  const halo = new THREE.Points(geo(hPos, hCol), new THREE.PointsMaterial({
    size: haloSize, sizeAttenuation: true, vertexColors: true,
    map: softSprite(), transparent: true, opacity: haloOpacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const g = new THREE.Group();
  g.add(core, halo);
  g.scale.setScalar(size);
  g.userData.points = n + m;
  return g;
}
