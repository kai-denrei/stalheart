// cine/tankscene.js — THE TANK. A 12-second cinematic (plan phase 3): the
// MK-CX/2 low and large, three shells, then the plasma, then rolling out
// over the wire planet under the galaxy sky.
//
// Draws the game's own machine: the cast from units.js (buildCreature
// 'mkcx2', the same call the beam lab and the board make), the weathered
// metal from 1b bound by material name, the shell as makeBulletCloud, the
// recoil as tankfeel's own applyTankFeel, the plasma as beamdraw's rig at
// a cinema point count — the beam lab's exact client contract: planet at
// the origin, tank at the pole, +Z a tangent. What the game lacks and this
// adds (plan §2.11): a muzzle flash as a sprite plus a point light that
// touches the hull for a few frames.
//
// Every time-dependent thing is SET from t. tankfeel's recoil clock is a
// countdown the game steps by dt; here it is written from the shot times,
// so a seek lands on the same frame as a play-through.
import * as THREE from '../../vendor/three.module.js';
import { buildCreature, preloadMkcx, makeBulletCloud } from '../units.js';
import { bakeGalaxyCube } from '../galaxybake.js';
import { SKY_PRESET } from '../galaxyseed.js';
import { LOOKS } from '../looks.js';
import { compileRail } from './rail.js';
import { makeWirePlanet, widenWire } from './planet.js';
import { applyWeatheredMaterial } from './materials.js';
import { createBeamRig, PLASMA_DEFAULTS, BOARD_PRESET, BEAM_PEAK } from '../beamdraw.js';
import { TANK_FEEL, makeTankFeel, applyTankFeel } from '../tankfeel.js';

export const TANK_LEN = 12;

// THE SCALE. The board runs the tank at 0.85 of a cell on a planet of ~12.5
// cells' radius; a hero shot wants a cell of a few metres, so: 3.2 m cells,
// a 40 m planet, a tank about five metres long. The ratio is the game's.
const CELL = 3.2, R = 12.5 * CELL;
const T = new THREE.Vector3(0, R, 0);      // the tank stands at the pole

// the beats (ruling D, 2026-09-04)
const SHOTS = [3.6, 4.7, 5.8];             // three shells
const FLASH = 0.09, SHELL_V = 55, SHELL_LIFE = 1.4;
const BURST = { t0: 6.3, len: 2.7 };       // the plasma's one bell
const ROLL = { t0: 9.0, speed: 6.5 };      // m/s, over the wire

// the rail, relative to the tank (T is added at compile)
const TANK_RAIL_REL = [
  { t: 0.0, pos: [-6.5, 1.1, 7.0], look: [0, 1.3, 0], fov: 38 },      // low hero, three-quarter front
  { t: 3.0, pos: [-5.2, 1.5, 5.4], look: [0, 1.4, 0.6] },
  { t: 6.0, pos: [4.6, 2.2, 6.8], look: [0, 1.5, 2.0] },              // side-front: the gun fires past
  { t: 9.0, pos: [5.4, 1.7, 14.0], look: [0, 1.5, 1.0] },             // ahead: the plasma comes by
  { t: 12.0, pos: [-10.0, 7.5, 19.0], look: [0, 0.6, 2.0] },          // back and up: the planet's curve
];

let softTex = null;
function softSprite() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  softTex.colorSpace = THREE.SRGBColorSpace;
  return softTex;
}

export function createTank({ renderer, scene, camera, tier = {} }) {
  const q = new URLSearchParams(location.search);
  const look = LOOKS.tronColors;
  const rail = compileRail(TANK_RAIL_REL.map((k) => ({
    ...k, pos: [k.pos[0] + T.x, k.pos[1] + T.y, k.pos[2] + T.z], look: [k.look[0] + T.x, k.look[1] + T.y, k.look[2] + T.z],
  })), { fov: 38 });

  // THE SKY, and the sky as light: the hull reflects its own galaxies
  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: tier.skyFace ?? 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(sky.texture).texture;
  scene.environmentIntensity = 0.35;

  // LIGHT: a key that casts onto the planet, aimed at the tank
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.position.copy(T).add(new THREE.Vector3(12, 18, 10));
  sun.target.position.copy(T);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
  sun.shadow.camera.right = sun.shadow.camera.top = 12;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], 0.35));
  // a cool fill from the lens side: beat 1 looks at the hull's shadow side
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.9);
  fill.position.copy(T).add(new THREE.Vector3(-10, 6, 9));
  fill.target.position.copy(T);
  scene.add(fill, fill.target);

  const root = new THREE.Group();
  scene.add(root);

  // THE PLANET at the origin — the beam rig's frame — the tank on its pole
  const planet = makeWirePlanet({ seed: 4414, n: 600, relaxIters: 80, edges: look.edges, body: look.bg });
  planet.scale.setScalar(R);
  root.add(planet);
  const wide = q.get('wide') != null ? parseFloat(q.get('wide')) : Math.max(1.5, renderer.domElement.height / 360);
  let wideReady = !(wide > 0);
  if (wide > 0) widenWire(planet, { width: wide, resolution: [renderer.domElement.width, renderer.domElement.height] }).then(() => { wideReady = true; });

  // THE PLASMA RIG at a cinema point count (?plasma=N per gun)
  const plasma = { ...PLASMA_DEFAULTS, points: parseInt(q.get('plasma')) || PLASMA_DEFAULTS.points * 4 };
  const rig = createBeamRig({ scene, guns: 2, preset: { ...BOARD_PRESET }, plasma, seed: 4414 });
  rig.hide();

  // THE FLASH: a sprite and a light, at the muzzle, for a few frames
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softSprite(), color: 0xfff1c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flash.scale.setScalar(1.3); flash.visible = false;   // bloom doubles it
  const flashLight = new THREE.PointLight(0xffd9a0, 0, 14, 2);
  root.add(flash, flashLight);

  // THE SHELLS: the game's tracer, one per shot, SET along a line from t
  const shells = SHOTS.map(() => {
    const m = makeBulletCloud({ body: look.walkerHi, hi: 0xffffff });
    m.scale.setScalar(CELL * 0.16);
    m.visible = false;
    root.add(m);
    return m;
  });

  let tank = null, turret = null, muzzle = null, guns = null;
  const feel = makeTankFeel();
  preloadMkcx('mkcx2').then((ok) => {
    if (!ok) return;
    tank = buildCreature('mkcx2', { walker: look.walker ?? 0x9fdcff, walkerHi: look.walkerHi ?? 0xffffff });
    tank.scale.setScalar(0.85 * CELL);
    tank.position.copy(T);
    tank.position.y += (tank.userData.lift ?? 0.02) * CELL;
    tank.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // the weathered metal (1b), by name — ?weather=0 for the flat cast
    if (q.get('weather') !== '0') {
      const n = applyWeatheredMaterial(tank, {
        seed: 4414, size: tier.name === 'cinema' ? 1024 : 512,
        repeat: parseFloat(q.get('wrepeat')) || 2, normalScale: parseFloat(q.get('wnormal')) || 0.6,
      });
      console.log(`WEATHER dressed ${n} materials on the tank`);
    }
    // THE OUTLINES. The cast wears the game's blueprint pass — a white line
    // on every edge at 0.85 — which is the tank's read on a black board at
    // a cell's size. Five metres from a lens, under bloom, the lines wall
    // the hull in white and the metal under them never shows (the first
    // three stills: a paper cut-out with a dark barrel). They stay, as a
    // rim: the look's accent at ?outline=N opacity (default 0.22). The deck
    // glow stays lit but not white-hot.
    const ol = q.get('outline') == null ? 0.22 : parseFloat(q.get('outline'));
    tank.traverse((o) => {
      // only the line sets the cast shows; a hidden set (a callout, a bound) stays hidden
      if (o.isLineSegments && o.material && o.visible) { o.material.opacity = ol; o.material.transparent = true; o.material.color.setHex(look.walkerHi ?? 0xffffff); o.visible = ol > 0; }
      // the glow parts — lift emitters, deck strips, the turret drum — wear a
      // WHITE emissive on the board; here they take the CRT cyan, dim, and
      // the unlit basics (heat sleeves, the shell rack) go the same way. A
      // matprobe named every one of them (BRIGHT lines) before this touched
      // any.
      if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m) continue;
        if (/^M_Glow/.test(m.name || '') && m.emissive) { m.emissive.setHex(0x7df9ff); m.emissiveIntensity = 0.45; m.color.setHex(0x101418); }
        else if (m.type === 'MeshBasicMaterial' && m.color) m.color.setHex(0x3f8a9c);
      }
    });
    root.add(tank);
    turret = tank.userData.turret || null;
    guns = tank.userData.laserGuns || null;
    // THE MUZZLE, measured off the cast: the mkcx2 carries no Callout_4, so
    // the tip is the +Z extent of the barrel's own subtree in the barrel's
    // frame — the beam lab's gunTipZ, for the main gun — kept as an empty
    // parented to the barrel so it recoils and traverses with it.
    muzzle = tank.userData.muzzle || null;
    if (!muzzle) {
      const barrel = tank.getObjectByName('Barrel_Pivot') || turret;
      if (barrel) {
        barrel.updateWorldMatrix(true, true);
        const inv = new THREE.Matrix4().copy(barrel.matrixWorld).invert();
        const bb = new THREE.Box3(); const v = new THREE.Vector3();
        barrel.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          for (let c = 0; c < 8; c++) {
            v.set(c & 1 ? b.max.x : b.min.x, c & 2 ? b.max.y : b.min.y, c & 4 ? b.max.z : b.min.z)
              .applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            bb.expandByPoint(v);
          }
        });
        muzzle = new THREE.Object3D();
        muzzle.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.max.z);
        barrel.add(muzzle);
      }
    }
    console.log(`TANK cast: turret=${!!turret} muzzle=${!!muzzle} guns=${guns ? guns.length : 0}`);
    // ?matprobe=1 — every material on the cast with its channels and maps
    if (q.get('matprobe') === '1') {
      const seen = new Map();
      tank.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const e = seen.get(m) || { n: 0, uv: !!(o.geometry && o.geometry.attributes.uv), type: o.type };
          e.n++; seen.set(m, e);
        }
      });
      tank.traverse((o) => {
        if (!o.isMesh) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && (m.type === 'MeshBasicMaterial' || /^M_Glow/.test(m.name || ''))) console.log(`BRIGHT mesh=${o.name || '(unnamed)'} parent=${o.parent ? o.parent.name : '-'} mat=${m.name || m.type} color=#${m.color.getHexString()}`);
      });
      for (const [m, e] of seen) console.log(`MAT ${m.name || '(unnamed)'} ${m.type} color=#${m.color ? m.color.getHexString() : '-'}`
        + ` emissive=#${m.emissive ? m.emissive.getHexString() : '-'} ei=${m.emissiveIntensity ?? '-'} rough=${m.roughness ?? '-'} metal=${m.metalness ?? '-'}`
        + ` map=${!!m.map} uv=${e.uv} meshes=${e.n}`);
    }
  });

  const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), fwd = new THREE.Vector3();
  const from3 = [0, 0, 0], dir3 = [0, 0, 0];
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  // the gun's world muzzle and forward, off the render transform (never
  // re-derived): the muzzle callout when the cast has one, the turret's +Z
  function gunFrame(out) {
    if (muzzle) muzzle.getWorldPosition(out.p); else { out.p.copy(T); out.p.y += 1.4 * CELL * 0.4; out.p.z += 2.4; }
    (turret || tank).getWorldQuaternion(tmpQ);
    out.d.set(0, 0, 1).applyQuaternion(tmpQ);
  }
  const gf = { p: new THREE.Vector3(), d: new THREE.Vector3() };

  function update(t) {
    // the turret: an idle sweep, then it comes to bear for the shots and
    // the burst, then sweeps again as the tank rolls out
    if (turret) {
      const bear = smooth((t - 2.2) / 0.9) * (1 - smooth((t - 9.6) / 1.2));
      turret.rotation.y = Math.sin(t * 0.6) * 0.55 * (1 - bear) + 0.0 * bear;
    }
    // the recoil clock, written from the shots — tankfeel draws it
    feel.recoil = 0;
    for (const ts of SHOTS) { const a = t - ts; if (a >= 0 && a < TANK_FEEL.recoilLen) feel.recoil = Math.max(feel.recoil, TANK_FEEL.recoilLen - a); }
    feel.hoverT = smooth((t - ROLL.t0) / 0.8);
    feel.t = t;
    if (tank) applyTankFeel(tank, feel, TANK_FEEL);

    if (tank) gunFrame(gf);
    // the flash and the light
    let fl = 0;
    for (const ts of SHOTS) { const a = t - ts; if (a >= 0 && a < FLASH) fl = Math.max(fl, 1 - a / FLASH); }
    flash.visible = fl > 0;
    if (fl > 0) { flash.position.copy(gf.p).addScaledVector(gf.d, 0.6); flash.material.opacity = fl; }
    flashLight.position.copy(gf.p).addScaledVector(gf.d, 0.9);
    flashLight.intensity = fl * 60;
    // the shells: straight out of the gun, SET from age
    for (let i = 0; i < SHOTS.length; i++) {
      const a = t - SHOTS[i];
      const m = shells[i];
      if (a < 0 || a > SHELL_LIFE || !tank) { m.visible = false; continue; }
      m.visible = true;
      m.position.copy(gf.p).addScaledVector(gf.d, 0.8 + SHELL_V * a);
      m.quaternion.copy(tmpQ);
    }
    // the plasma: one bell, both guns, drawn on the planet's own curvature
    const h = (t - BURST.t0) / BURST.len;
    if (h >= 0 && h <= 1 && tank && guns && guns.length >= 2) {
      for (let g = 0; g < 2; g++) {
        const pivot = guns[g];
        tmp.set(0, 0, 0.9); pivot.localToWorld(tmp);
        const r = tmp.length();
        from3[0] = tmp.x / r; from3[1] = tmp.y / r; from3[2] = tmp.z / r;
        pivot.getWorldQuaternion(tmpQ);
        fwd.set(0, 0, 1).applyQuaternion(tmpQ);
        const k = fwd.x * from3[0] + fwd.y * from3[1] + fwd.z * from3[2];
        dir3[0] = fwd.x - from3[0] * k; dir3[1] = fwd.y - from3[1] * k; dir3[2] = fwd.z - from3[2] * k;
        const dl = Math.hypot(dir3[0], dir3[1], dir3[2]) || 1;
        dir3[0] /= dl; dir3[1] /= dl; dir3[2] /= dl;
        rig.draw(g, { from: from3.slice(), dir: dir3.slice(), len: 26 / R, heat: h, lift: r, scale: CELL, time: t, peak: BEAM_PEAK });
      }
    } else rig.hide();
    const wm = planet.userData.wire && planet.userData.wire.material;
    if (wm && wm.resolution) wm.resolution.set(renderer.domElement.width, renderer.domElement.height);
    // the roll: the wire moves under a tank that stays at the pole
    const roll = Math.max(0, t - ROLL.t0);
    planet.rotation.x = -(ROLL.speed * roll) / R;

    const p = rail.poseAt(t);
    camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    camera.up.set(p.up[0], p.up[1], p.up[2]);
    camera.lookAt(tmp.set(p.look[0], p.look[1], p.look[2]));
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
  }

  return {
    name: 'tank', duration: TANK_LEN, update,
    ready: () => !!tank && wideReady,
    wormhole: null,
    dispose() { sky.dispose(); pmrem.dispose(); },
  };
}
