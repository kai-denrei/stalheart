// CLONING A RIGGED MODEL, without vendoring SkeletonUtils. Object3D.clone()
// copies a SkinnedMesh's `skeleton` BY REFERENCE, so every clone shares one
// set of bones — which means they all deform identically AND stand in the
// same place, because the skin is driven by those bones' world matrices and
// not by the clone's own transform. For a game piece that looks like the
// model failed to load. For a landmark cloned off a CACHED glTF whose own
// scene is never added to anything, nothing ever updates those bones, and
// the bind pose resolves into a vast flat sheet across the sky instead.
//
// The fix is twenty lines: clone the graph, pair source bones to clone bones
// by traversal order (clone preserves child order, so the two walks line up
// index for index), and re-`bind` every SkinnedMesh to a fresh Skeleton over
// the cloned bones. Geometry and materials stay SHARED, which is the whole
// reason this is cheap — one upload, N GPU-skinned instances. A graph with
// no skin at all comes back as a plain deep clone, so this is safe to use
// wherever a loaded asset is mounted.
//
// Written here rather than vendored on purpose: SkeletonUtils sits in four
// sibling repos' node_modules and all of them ship three r180 against this
// project's r160. "An addon from the sibling's node_modules" is already a
// recorded dead end in .deban, from the Line2 trio.
import * as THREE from '../../vendor/three.module.js';

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
