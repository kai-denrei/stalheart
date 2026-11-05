// stalheart-pad.mjs — the pad under the whole Stålheart (owner, 2026-11-05, round 5 note 2: "the Stalheart's base is not under it; half the rails
// are off"): every mesh of the model within 1.5 m of the ground (the rails, sleepers, stops, the column covers) lies on its island's slab, in both
// shipped tiers, read from the GLBs' own accessor bounds at the rest pose; the model stands where it stood (island x + offset 14.5, the gantry
// centred on its plot since 2026-09-11), so nothing that frames it moved.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { ISLANDS, STRUCTURES } from '../src/content/base-layout.js';

const isl = ISLANDS.find((i) => i.id === 'stalheart'), st = STRUCTURES.find((s) => s.id === 'stalheart');
assert.equal(isl.x + st.offset[0], 14.5, 'the model where it stood'); assert.equal(isl.z + st.offset[2], 0); assert.equal(st.scale, 1);
assert.equal(isl.x - isl.w / 2, -24, 'the slab\'s -X edge where it was');
function groundBox(file, ymax = 1.5) {
  const buf = readFileSync(file), j = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString()), all = new THREE.Box3();
  const walk = (i, parent) => {
    const n = j.nodes[i], m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix); else m.compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
    const w = parent.clone().multiply(m);
    if (n.mesh != null) for (const p of j.meshes[n.mesh].primitives) { const a = j.accessors[p.attributes.POSITION]; const b = new THREE.Box3(new THREE.Vector3(...a.min), new THREE.Vector3(...a.max)).applyMatrix4(w); if (b.min.y <= ymax) all.union(b); }
    for (const c of n.children ?? []) walk(c, w);
  };
  for (const r of j.scenes[j.scene ?? 0].nodes) walk(r, new THREE.Matrix4());
  return all;
}
for (const file of [st.asset, st.far]) {
  const b = groundBox(file), x0 = isl.x + st.offset[0] + b.min.x, x1 = isl.x + st.offset[0] + b.max.x, z0 = isl.z + b.min.z, z1 = isl.z + b.max.z;
  const sx = [isl.x - isl.w / 2, isl.x + isl.w / 2], sz = [isl.z - isl.d / 2, isl.z + isl.d / 2];
  assert.ok(x0 >= sx[0] && x1 <= sx[1], `${file}: the ground parts x ${x0.toFixed(2)}..${x1.toFixed(2)} on the slab ${sx}`);
  assert.ok(z0 >= sz[0] && z1 <= sz[1], `${file}: the ground parts z ${z0.toFixed(2)}..${z1.toFixed(2)} on the slab ${sz}`);
  assert.ok(sx[1] - x1 >= 0.5, `${file}: half a metre of slab past the rails' +X end (${(sx[1] - x1).toFixed(2)})`);
}
console.log(`stalheart-pad: the rails and sleepers on the slab (-24..${isl.x + isl.w / 2}), the model where it stood`);
