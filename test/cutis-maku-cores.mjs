// cutis-maku-cores.mjs — the kit's hard cores (src/fx/cutis-maku, brought up to Jelly-Baby 3a985e1 for the Pearl set, owner 2026-10-13): the Core keys, the
// core on the shared transfer path (getCoreContact) against the membrane shader's own centre (the uHardRadius block, pinned verbatim and transcribed here),
// the core inside its padded shell over sampled phases, PLANET_BEND's JS twin, the drawn pose (deflate, lift, bend) and the materials. A config without the
// Core keys (the boss lab's, the creature probe's) stays the soft body it was.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { CutisSwarm, STEP } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG, CORE_SHAPES, coreContact, sanitizeConfig, transferProgress } from '../src/fx/cutis-maku/config.js';
import { MEMBRANE_VERT, MEMBRANE_FRAG, PLANET_BEND, bendPoint } from '../src/fx/cutis-maku/shaders.js';
import { createMembraneMaterial, updateMaterial } from '../src/fx/cutis-maku/material.js';
import { createSwarmGeometry } from '../src/fx/cutis-maku/geometry.js';
import { createHardCores, corePose } from '../src/fx/cutis-maku/hard-core.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the Core keys ----
for (const [k, v] of Object.entries({ membraneOpacity: 1, coreShape: 0, coreSize: .28, pearlVariant: 0, coreTint: 0xff242c, contactDamage: 0, health: 60 })) assert.equal(DEFAULT_CONFIG[k], v, k);
assert.deepEqual(CORE_SHAPES, ['Soft interior', 'Dodecahedron', 'Inverted pyramids', 'Pearl']);
assert.equal(sanitizeConfig({ coreShape: 2.6 }).coreShape, 3); assert.equal(sanitizeConfig({ pearlVariant: .7 }).pearlVariant, 1); assert.equal(sanitizeConfig({ membraneOpacity: 0 }).membraneOpacity, .08);
{ const soft = coreContact(DEFAULT_CONFIG), hard = coreContact({ ...DEFAULT_CONFIG, coreShape: 3, contactDamage: 8 });
  assert.deepEqual([soft.rammable, soft.proximityWarning, soft.radarBlipSize, soft.collisionRadius, soft.contactDamagePerSecond], [true, false, 2.5, 0, 0]);
  assert.deepEqual([hard.rammable, hard.proximityWarning, hard.radarBlipSize, hard.coreShape, hard.contactDamagePerSecond], [false, true, 4, 'Pearl', 8]);
  close(hard.collisionRadius, .2 * .28, 1e-12, 'collision radius r0 x coreSize');
  assert.equal(coreContact({ r0: 1 }).rammable, true, 'a config without the Core keys is soft'); }
console.log('PASS the Core keys, CORE_SHAPES, sanitize rounding, coreContact');

// ---- the shader's centre, pinned and transcribed ----
const HARD_BLOCK = `  if(uHardRadius>0.){
    float bodyU=clamp((accelerated-uDelay*.5)/max(.02,1.-uDelay),0.,1.);
    vec3 center=mix(iOffset,iAnchor,2.*bodyU-bodyU*bodyU);
    center.y=r*.78*((1.-bodyU)*(1.-bodyU)+bodyU*bodyU)+2.*(1.-bodyU)*bodyU*.014*SC;
    if(phase>=.85){float settle=(phase-.85)/.15;center=iAnchor+iHeading*r*.12*exp(-6.*settle)*sin(settle*22.)*iParams.w;center.y=r*.78;}
    float lift=max(0.,r*uHardRadius*1.3+.018*SC-center.y);center.y+=lift;p.y+=lift;`;
assert(MEMBRANE_VERT.includes(HARD_BLOCK), 'the membrane shader\'s hard-core block is the one transcribed below');
assert(MEMBRANE_VERT.includes('if(uHardRadius>0.)delay=uDelay*.5;'), 'one transfer clock for a cored body');
assert(MEMBRANE_VERT.includes('vec3 rest=n*max(mix(radius,rounded,cube),uHardRadius*3.6)*r;'), 'the rest shape held clear of the core');
assert(MEMBRANE_VERT.includes('shell=r*uHardRadius*2.;'), 'the shell padded to twice the core');
assert(MEMBRANE_FRAG.includes('if(uCore<.5)alpha*=uOpacity;') && MEMBRANE_FRAG.includes('uPaletteSkin[palette]'), 'uOpacity, and the multicolour kept');
// the block in JS: the centre the shell is padded round (before the ground clamp, the deflate, the lift and the bend)
function shaderCentre(sw, i) {
  const c = sw.config, k = i * 3, r = c.r0 * sw.scale[i], SC = c.r0 / .2, phase = sw.phase[i], hard = c.coreSize;
  const transfer = Math.max(0, Math.min(1, (phase - .62) / .23)), accelerated = Math.pow(transfer, c.transferAcceleration);
  const bodyU = Math.max(0, Math.min(1, (accelerated - c.delaySpread * .5) / Math.max(.02, 1 - c.delaySpread))), m = 2 * bodyU - bodyU * bodyU;
  const ctr = [sw.offset[k] + (sw.anchor[k] - sw.offset[k]) * m, 0, sw.offset[k + 2] + (sw.anchor[k + 2] - sw.offset[k + 2]) * m];
  ctr[1] = r * .78 * ((1 - bodyU) ** 2 + bodyU ** 2) + 2 * (1 - bodyU) * bodyU * .014 * SC;
  if (phase >= .85) { const settle = (phase - .85) / .15, w = r * .12 * Math.exp(-6 * settle) * Math.sin(settle * 22) * sw.params[i * 4 + 3]; ctr[0] = sw.anchor[k] + sw.heading[k] * w; ctr[1] = sw.anchor[k + 1] + sw.heading[k + 1] * w; ctr[2] = sw.anchor[k + 2] + sw.heading[k + 2] * w; ctr[1] = r * .78; }
  ctr[1] += Math.max(0, r * hard * 1.3 + .018 * SC - ctr[1]);
  return { ctr, shell: r * hard * 2 };
}
// cored bodies at the game's sizes hop after a moving target; at every sampled frame the core (JS) sits on the shader's centre, inside the padded shell
for (const [r0, size, delaySpread, acc] of [[.2, .28, .25, 1.8], [2.8, .28, .25, 1.8], [4.5, .22, .6, 2.5], [6.7, .18, .9, 2.5]]) {
  const sw = new CutisSwarm({ ...DEFAULT_CONFIG, r0, coreShape: 3, coreSize: size, delaySpread, transferAcceleration: acc, seekCount: 2, cycleDuration: 2.5 }, { capacity: 4 });
  sw.reset(3); for (let i = 0; i < 3; i++) { sw.setTarget(i, 40 * r0, i * r0); sw.place(i, i * 3 * r0, 0, 0); sw.scale[i] = .8 + .2 * i; }
  const seen = new Set(); let worst = 0;
  for (let f = 0; f < 120 * 12; f++) {
    if (f % 240 === 0) for (let i = 0; i < 3; i++) sw.setTarget(i, Math.sin(f) * 30 * r0, Math.cos(f) * 30 * r0);
    sw.step(STEP);
    for (let i = 0; i < 3; i++) {
      const c = sw.getCoreContact(i), { ctr, shell } = shaderCentre(sw, i);
      const gap = Math.hypot(c.center.x - ctr[0], c.center.y - ctr[1], c.center.z - ctr[2]);
      worst = Math.max(worst, gap / shell);
      assert(c.radius + gap <= shell * (1 - .45), `the core inside its padded shell (r0 ${r0}, phase ${sw.phase[i].toFixed(3)}: core ${c.radius}, gap ${gap}, shell ${shell})`);
      close(c.radius, r0 * size * sw.scale[i], 1e-9, 'the core is rigid through the hop');
      const p = sw.position(i); close(p[0], c.center.x, 1e-12, 'a cored body\'s position is its core'); close(p[2], c.center.z, 1e-12, 'position z');
      seen.add(sw.getState(i));
    }
  }
  for (const st of ['COIL', 'EXTEND', 'ANCHOR', 'TRANSFER', 'SETTLE']) assert(seen.has(st), `sampled ${st}`);
  assert(worst < 1e-5, `the JS core and the shader's centre agree (worst ${worst})`);
}
// a soft body: no core, its position the transfer-only point it always was
{ const sw = new CutisSwarm({ ...DEFAULT_CONFIG, r0: 1.5 }, { capacity: 2 }); sw.reset(1); sw.setTarget(0, 50, 0); sw.place(0, 0, 0, 0);
  for (let f = 0; f < 900; f++) { sw.step(STEP); const k = 0, t = sw.phase[0] < .62 ? 0 : transferProgress((sw.phase[0] - .62) / .23, 1), p = sw.position(0); close(p[0], sw.offset[k] + (sw.anchor[k] - sw.offset[k]) * t, 1e-12, 'soft position'); assert.equal(sw.getCoreContact(0).radius, 0); } }
console.log('PASS the core on the shared transfer path: the shader\'s centre, inside the padded shell, rigid, the position; soft bodies unchanged');

// ---- PLANET_BEND's JS twin ----
assert(PLANET_BEND.includes('float d=length(p.xz),t=d/R,rr=R+p.y,s=sin(t),h=sin(t*.5);') && PLANET_BEND.includes('return vec3(dir.x*rr*s,p.y*cos(t)-2.*R*h*h,dir.y*rr*s);') && PLANET_BEND.includes('vec2 dir=p.xz/max(d,1e-6);'), 'the GLSL transcribed below');
const glslBend = (x, y, z, R) => { if (R <= 0) return [x, y, z]; const d = Math.hypot(x, z), t = d / R, rr = R + y, s = Math.sin(t), h = Math.sin(t * .5), m = Math.max(d, 1e-6); return [x / m * rr * s, y * Math.cos(t) - 2 * R * h * h, z / m * rr * s]; };
for (const R of [0, 690, 750, 5000]) for (const [x, y, z] of [[0, 0, 0], [3, 1, -2], [120, 4, 300], [-600, .5, 10], [1e-8, 2, 0]]) {
  const a = bendPoint(x, y, z, R), b = glslBend(x, y, z, R);
  for (let j = 0; j < 3; j++) close(a[j], b[j], 1e-9 * Math.max(1, R), `bendPoint(${x},${y},${z},${R})[${j}]`);
  if (R > 0) close(Math.hypot(a[0], a[1] + R, a[2]), R + y, 1e-7 * R, 'on the sphere of radius R + y');
}
console.log('PASS bendPoint is PLANET_BEND term for term, on the sphere');

// ---- the drawn pose: the core follows its body through the clamp, the deflate, the lift and the bend ----
{
  const R = 690, sw = new CutisSwarm({ ...DEFAULT_CONFIG, r0: 3, coreShape: 3, coreSize: .28 }, { capacity: 3 });
  sw.reset(2); sw.setTarget(0, 300, 40); sw.place(0, 200, 30, 0); sw.setTarget(1, 0, 0); sw.place(1, -50, 0, 0);
  for (let f = 0; f < 700; f++) sw.step(STEP);
  const flat = corePose(sw, 0, 0), bent = corePose(sw, 0, R), c = sw.getCoreContact(0), b = bendPoint(c.center.x, c.center.y, c.center.z, R);
  for (let j = 0; j < 3; j++) { close(flat[j], [c.center.x, c.center.y, c.center.z][j], 1e-9, 'alive, no lift: the contact centre'); close(bent[j], b[j], 1e-7, 'bent as the shell is'); }
  sw.hold[0] = 1; sw.phase[0] = .3; sw.life[1] = 1; sw.life[2] = .4; sw.life[0] = -1.5;   // a dead one: deflated, faded, sinking
  const dead = corePose(sw, 0, 0), alive = sw.getCoreContact(0);
  assert(dead[1] < alive.center.y * .2 - 1.4, `the core sinks with the puddle (${dead[1]} from ${alive.center.y})`);
  close(dead[3], alive.radius, 1e-12, 'the radius stays');
  const cores = createHardCores(sw, { planetR: R });
  cores.update(); assert.equal(cores.mesh.count, 2); close(cores.mesh.geometry.getAttribute('iFade').array[0], .4, 1e-6, 'the core fades with the body');
  sw.active[1] = 0; cores.update(); assert.equal(cores.mesh.count, 1, 'inactive instances draw no core');
  const m = new THREE.Matrix4(), v = new THREE.Vector3(); cores.mesh.getMatrixAt(0, m); v.setFromMatrixPosition(m); const want = corePose(sw, 0, R);
  for (let j = 0; j < 3; j++) close(v.getComponent(j), want[j], 1e-3, 'the instance sits on the pose');
  assert(cores.mesh.material instanceof THREE.MeshPhysicalMaterial && cores.mesh.material.clearcoat === 1 && cores.mesh.material.transparent, 'the pearl material');
  cores.dispose();
  // round two: each pearl at its body's level (./geometry.js levelOf): the kit's sphere under a high hull, a coarse one under the others, none culled
  { sw.active[1] = 1; const sw3 = sw; sw3.place(2, 1, 1, 0); const levelOf = new Uint8Array(sw3.capacity); levelOf.set([0, 2, 3]); const lod = createHardCores(sw3, { planetR: R, levelOf });
    lod.update(); assert.deepEqual(lod.meshes.map((x) => x.count), [1, 1], 'one fine, one coarse, the culled one none'); assert.equal(lod.count, 2);
    assert(lod.meshes[1].geometry.getAttribute('position').count < lod.meshes[0].geometry.getAttribute('position').count / 3, 'the coarse sphere');
    close(lod.meshes[1].geometry.getAttribute('iFade').array[0], sw3.life[1 * 4 + 2], 1e-6, 'the coarse one fades with its body'); lod.dispose(); }
  const soft = new CutisSwarm({ ...DEFAULT_CONFIG }, { capacity: 2 }); soft.populate(2); const none = createHardCores(soft); none.update(); assert.equal(none.mesh.count, 0, 'a soft swarm draws no cores'); none.dispose();
}
console.log('PASS the drawn core: the contact centre, bent as the shell, deflated, faded and sunk with its body; the pearl material; its resolution by its body\'s level');

// ---- the materials: a config without the Core keys reads as the opaque soft body it was ----
{
  const plain = { cycleDuration: 3, r0: 1.5, seekCount: 3 }, a = createMembraneMaterial({ ...DEFAULT_CONFIG, ...plain, membraneOpacity: undefined, coreShape: undefined });
  assert.equal(a.uniforms.uOpacity.value, 1); assert.equal(a.uniforms.uHardRadius.value, 0);
  updateMaterial(a, { ...DEFAULT_CONFIG, coreShape: 3, coreSize: .18, membraneOpacity: .32 }, 1); assert.equal(a.uniforms.uOpacity.value, .32); assert.equal(a.uniforms.uHardRadius.value, .18);
  updateMaterial(a, { r0: 1 }, 1); assert.equal(a.uniforms.uOpacity.value, 1); assert.equal(a.uniforms.uHardRadius.value, 0);
  a.dispose();
  const sw = new CutisSwarm({ ...DEFAULT_CONFIG, r0: 2, coreShape: 3 }, { capacity: 4 }); sw.populate(3);
  const geo = createSwarmGeometry(sw, { planetR: 690 }), cam = new THREE.PerspectiveCamera(50, 1, .1, 1e5); cam.position.set(0, 40, 60); cam.updateMatrixWorld();
  geo.update(cam, 800); assert(geo.levels.every((l) => !l.core?.visible), 'a cored body hides the soft inner core'); assert(geo.levels.some((l) => l.membrane.visible));
  geo.dispose();
}
console.log('PASS materials: the soft default, the cored uniforms; the soft inner core hidden under a hard one');
