// a6-kidou-sai93-crystals.mjs — the owner's note of 2026-11-07 imported (docs/a6-kidou-sai93-assets.lock.json, docs/lab-crystals.lock.json):
// STALHEART-KIDOU, the mobile gantry, and the SAI-93 hopper at SentryTowers_A6 87a87206, and the crystal lab's kit at lab-crystals 9dfb33c7.
// Import only, nothing wired: these hold the files to their pins, the facts the lock records, and the author's adapters to the GLBs they drive.
// The pack-safety condition is held here too: the build meshopt-packs these GLBs, which is safe only while they carry no custom vertex attribute
// (gltfpack drops one even with -kv, the Yushi045's `_YUSHI` lesson of round 8); a later revision that adds one must go on scripts/build.mjs's UNPACKED list.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { applyKidou, stateAt, STATIONS } from '../assets/models/stalheart-kidou/runtime.js';
import { applySai93 } from '../assets/models/sai93/runtime.js';
import { vertexShader, fragmentShader } from '../assets/models/crystals/shaders.js';

let failures = 0;
const check = (name, cond, detail = '') => { if (cond) console.log(`  ok   ${name}`); else { console.error(`  FAIL ${name} ${detail}`); failures++; } };
const root = new URL('../', import.meta.url).pathname;
const sha = p => createHash('sha256').update(readFileSync(root + p)).digest('hex');
const glbJson = p => { const b = readFileSync(root + p); return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))); };
const parse = async p => { const b = readFileSync(root + p); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const at = (scene, name) => scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

const a6 = JSON.parse(readFileSync(root + 'docs/a6-kidou-sai93-assets.lock.json', 'utf8'));
const crystals = JSON.parse(readFileSync(root + 'docs/lab-crystals.lock.json', 'utf8'));
check('the A6 lock pins upstream 87a87206', a6.revision.startsWith('87a87206') && a6.baseUrl.includes(a6.revision));
check('the crystal lock pins lab-crystals 9dfb33c7', crystals.revision.startsWith('9dfb33c7') && crystals.baseUrl.includes(crystals.revision));
const want = ['stalheart-kidou/stalheart_kidou_d0_lod1.glb', 'stalheart-kidou/stalheart_kidou_d0_lod2.glb', 'stalheart-kidou/runtime.js', 'sai93/sai93_unit_d0_lod1.glb', 'sai93/sai93_unit_d0_lod2.glb', 'sai93/runtime.js'].map(p => 'assets/models/' + p);
check('the A6 lock lists the two models and their adapters', want.every(p => a6.files.some(f => f.path === p)));
for (const f of [...a6.files, ...crystals.files]) check(`${f.path} on disk matches its pin`, existsSync(root + f.path) && sha(f.path) === f.sha256 && readFileSync(root + f.path).length === f.bytes);
const scriptAssets = readFileSync(root + 'scripts/assets.mjs', 'utf8');
check('npm run assets:check reads both new locks', scriptAssets.includes('docs/a6-kidou-sai93-assets.lock.json') && scriptAssets.includes('docs/lab-crystals.lock.json'));
check('the SAI-93 bay is the pinned SAI-92 bay (not pinned twice)', sha('assets/models/sai92/sai92_bay_d0_lod1.glb').startsWith('efa93366') && sha('assets/models/sai92/sai92_bay_d0_lod2.glb').startsWith('e1454345'));

const UNPACKED = /^assets\/models\/yushi045\//;
for (const f of a6.files.filter(f => f.path.endsWith('.glb'))) {
  const j = glbJson(f.path);
  const attrs = [...new Set(j.meshes.flatMap(m => m.primitives.flatMap(p => Object.keys(p.attributes))))];
  check(`${f.path} is pack-safe (no custom vertex attribute) or ships unpacked`, attrs.every(a => !a.startsWith('_')) || UNPACKED.test(f.path), attrs.join(','));
  check(`${f.path} has no baked clips, as the lock says`, (j.animations || []).length === 0 && f.clips.length === 0);
  check(`${f.path} carries no texture or skin`, !(j.images || []).length && !(j.skins || []).length);
  check(`${f.path} is ${f.static ? '' : 'not '}the static tier`, !!j.nodes[j.scenes[0].nodes[0]].extras?.static === f.static && f.static === f.path.endsWith('_lod2.glb'));
}

// THE KIDOU: the adapter poses LOD1 on flat ground and parks the tool above a MORK; LOD2 is a frozen proxy.
{
  const g = await parse('assets/models/stalheart-kidou/stalheart_kidou_d0_lod1.glb'); const s = g.scene;
  const box = new THREE.Box3().setFromObject(s).getSize(new THREE.Vector3());
  check('KIDOU LOD1 measures 42.09 x 39.86 x 24.00 m', near(box.x, 42.086) && near(box.y, 39.8569) && near(box.z, 24), box.toArray().join(' x '));
  check('KIDOU LOD1 parks the extrusion tip 3.21 m up over the fabrication origin', near(at(s, 'EXTRUSION_TIP').y, 3.2104) && near(at(s, 'SOCKET_FABRICATION_ORIGIN').z, 2.6));
  check('KIDOU has eight wheel stations at X +-16', STATIONS.length === 8 && STATIONS.every(l => near(Math.abs(at(s, 'SOCKET_CONTACT_' + l.id).x), 16)));
  let worst = 0, finite = true;
  for (const mode of ['park', 'drive', 'crab', 'turn', 'suspension', 'fabricate']) for (const t of [0, 3.3, 9.1]) {
    const c = applyKidou(THREE, s, { ...stateAt(t, mode), terrain: () => 0 });
    worst = Math.max(worst, c.maxContactError); s.updateMatrixWorld(true);
    finite = finite && ['EXTRUSION_TIP', 'SOCKET_CONTACT_L1', 'SOCKET_CONTACT_R4'].every(n => at(s, n).toArray().every(Number.isFinite));
  }
  check('the KIDOU adapter keeps every wheel on flat ground in all six modes', worst < 1e-3 && finite, `max contact error ${worst}`);
  const far = await parse('assets/models/stalheart-kidou/stalheart_kidou_d0_lod2.glb');
  check('the KIDOU adapter leaves LOD2 frozen', applyKidou(THREE, far.scene, stateAt(2, 'drive')).static === true);
}

// THE SAI-93: the adapter poses LOD1 (anchored drilling, folded flight, offload) and the ore gauge follows fill; LOD2 is frozen.
{
  const g = await parse('assets/models/sai93/sai93_unit_d0_lod1.glb'); const s = g.scene;
  check('SAI-93 has no head (no SENSOR_YAW)', !s.getObjectByName('SENSOR_YAW') && !s.getObjectByName('SENSOR_SURFACE'));
  check('SAI-93 ore outlet sits at (0, 2.04, 1.80)', at(s, 'SOCKET_ORE_OUT').distanceTo(new THREE.Vector3(0, 2.04, 1.8)) < 1e-3);
  applySai93(THREE, s, { fill: 0.3, anchor: 1, deploy: 1, drillAngle: 1, terrain: () => 0 });
  check('the SAI-93 ore gauge follows fill', near(s.getObjectByName('ORE_GAUGE_FILL').scale.y, 0.3) && near(s.getObjectByName('ORE_WINDOW_MASK').scale.y, 0.7));
  const out0 = at(s, 'SOCKET_ORE_OUT').z; applySai93(THREE, s, { offload: 1 }); s.updateMatrixWorld(true);
  check('a full offload pushes the outlet 1.38 m forward (two 0.69 m stages)', near(at(s, 'SOCKET_ORE_OUT').z - out0, 1.38, 1e-2), String(at(s, 'SOCKET_ORE_OUT').z - out0));
  const far = await parse('assets/models/sai93/sai93_unit_d0_lod2.glb');
  check('the SAI-93 adapter leaves LOD2 frozen', applySai93(THREE, far.scene, { fold: 1 }).static === true);
}

// THE CRYSTALS: code, not a model. The shader module is self-contained; geometry.js needs the game's Three (bare imports, ConvexGeometry).
check('the crystal shader traces up to 40 convex planes', /uniform vec4 uPlanes\[40\]/.test(fragmentShader) && vertexShader.includes('vEye'));
check('the crystal geometry still asks for bare three and ConvexGeometry (not loadable as it is: see the lock facts)', /from 'three'/.test(readFileSync(root + 'assets/models/crystals/geometry.js', 'utf8')));

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('A6 KIDOU, SAI-93 and the crystal kit: pinned, pack-safe and posed by their adapters.');
