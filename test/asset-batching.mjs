// asset-batching.mjs — batching a landmark keeps what the picture needs (2026-11-06, the perf pass: the base drawn in hundreds of calls).
//
// mergeByMaterial welds the static parts of a model into one mesh per material. It used to keep only position, normal and uv, so a
// vertex-coloured model lost its colours in the weld (the solar complex, the bio cassettes, the greenhouse, the chip writer, the ammo:
// their materials kept vertexColors on with no attribute behind it). With keepShared an attribute every part of a batch carries, at one
// item size, survives; one a part lacks is dropped from the batch, as uv is. And batchStaticAsset must leave the loader's CACHED scene
// alone: it welded that scene in place, so two structures from one file (the rockets, the cassettes) would fight over one root.
import * as THREE from '../vendor/three.module.js';
import { mergeByMaterial } from '../src/glbmodels.js';
import { batchStaticAsset } from '../src/fx/asset-batching.js';

let failures = 0;
const check = (name, cond, detail = '') => { if (cond) console.log(`  ok   ${name}`); else { console.error(`  FAIL ${name} ${detail}`); failures++; } };
const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
function part(name, material, { color = true, colorSize = 3, extra = null } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
  if (color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * colorSize).fill(0.5), colorSize));
  if (extra) g.setAttribute(extra, new THREE.BufferAttribute(new Float32Array([1, 2, 3]), 1));
  g.setIndex([0, 1, 2]);
  const m = new THREE.Mesh(g, material); m.name = name; return m;
}
const paint = () => new THREE.MeshStandardMaterial({ vertexColors: true });

console.log('mergeByMaterial, keepShared:');
{
  const mat = paint(), root = new THREE.Group(); root.add(part('a', mat), part('b', mat));
  mergeByMaterial(root, [], [], { keepShared: true });
  const ms = meshes(root);
  check('two parts of one material weld into one mesh', ms.length === 1, `${ms.length}`);
  check('the colour every part carries survives the weld', !!ms[0]?.geometry.attributes.color && ms[0].geometry.attributes.color.count === 6, JSON.stringify(Object.keys(ms[0]?.geometry.attributes ?? {})));
  check('uv survives too', ms[0]?.geometry.attributes.uv?.count === 6);
}
{
  const mat = paint(), root = new THREE.Group(); root.add(part('a', mat, { extra: '_yushi' }), part('b', mat, { extra: '_yushi' }));
  mergeByMaterial(root, [], [], { keepShared: true });
  const g = meshes(root)[0]?.geometry;
  check('a custom attribute every part carries survives', g?.attributes._yushi?.count === 6, JSON.stringify(Object.keys(g?.attributes ?? {})));
}
{
  const mat = paint(), root = new THREE.Group(); root.add(part('a', mat), part('b', mat, { color: false }));
  mergeByMaterial(root, [], [], { keepShared: true });
  const ms = meshes(root);
  check('an attribute one part lacks is dropped from the batch, and the batch still welds', ms.length === 1 && !ms[0].geometry.attributes.color, `${ms.length} ${JSON.stringify(Object.keys(ms[0]?.geometry.attributes ?? {}))}`);
}
{
  const mat = paint(), root = new THREE.Group(); root.add(part('a', mat, { colorSize: 3 }), part('b', mat, { colorSize: 4 }));
  mergeByMaterial(root, [], [], { keepShared: true });
  const ms = meshes(root);
  check('a colour of two item sizes keeps the parts apart rather than welding garbage', ms.length === 2 && ms.every((m) => m.geometry.attributes.color), `${ms.length}`);
}
{
  const mat = paint(), root = new THREE.Group(); root.add(part('a', mat), part('b', mat));
  mergeByMaterial(root);
  check('without keepShared the weld keeps only position, normal and uv (the other callers unchanged)', !meshes(root)[0]?.geometry.attributes.color);
}

console.log('batchStaticAsset:');
{
  const mat = paint(), scene = new THREE.Group(); scene.name = 'cached'; scene.add(part('a', mat), part('b', mat));
  const out = batchStaticAsset(scene, []);
  check('the source scene is left untouched', meshes(scene).length === 2 && meshes(scene).every((m) => m.geometry.attributes.position.count === 3), `${meshes(scene).length}`);
  check('the result is another root', out !== scene && out.parent === null);
  check('the result is the weld', meshes(out).length === 1 && meshes(out)[0].geometry.attributes.position.count === 6, `${meshes(out).length}`);
  check('the weld keeps the colour', meshes(out)[0]?.geometry.attributes.color?.count === 6);
  const again = batchStaticAsset(scene, []);
  check('a second batch of the same source is a second, whole root', again !== out && meshes(again).length === 1 && meshes(again)[0].geometry.attributes.position.count === 6);
}
{
  const mat = paint(), scene = new THREE.Group(); scene.add(part('a', mat), part('b', mat), part('PORT_CAP_N', mat));
  const out = batchStaticAsset(scene, [], ['PORT_CAP_N']);
  const cap = out.getObjectByName('PORT_CAP_N');
  check('a named node to keep stays its own mesh', !!cap && cap.isMesh && cap.geometry.attributes.position.count === 3);
  check('the rest welds round it', meshes(out).length === 2, `${meshes(out).length}`);
}
{
  const mat = paint(), scene = new THREE.Group(); const hinge = new THREE.Group(); hinge.name = 'ARRAY'; hinge.add(part('dish', mat)); scene.add(part('base', mat), hinge);
  const clip = new THREE.AnimationClip('Array_Slew', 1, [new THREE.NumberKeyframeTrack('ARRAY.rotation[y]', [0, 1], [0, 1])]);
  const out = batchStaticAsset(scene, [clip]);
  check('an animated node keeps its own mesh under it', out.getObjectByName('ARRAY')?.children.some((c) => c.isMesh && c.geometry.attributes.position.count === 3));
  check('the static part welds on its own', meshes(out).length === 2, `${meshes(out).length}`);
}

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nasset batching keeps the picture');
