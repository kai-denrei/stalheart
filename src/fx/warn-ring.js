// THE WARN RINGS (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the pooled point cloud every warning ring
// is drawn in (a gate's countdown beats, a round's impact, a strike's mark), ring() to start one and tick(dt) to age and draw them.
// `host` hands in the board as getters (graph, cellSide).
import * as THREE from '../../vendor/three.module.js';
import { add3, scale3, cross3, norm3, len3 } from '../vec3.js';

export function createWarnRing(scene, host) {
  // One pooled cloud for every ring, main view only — the map has its blips.
  const WARN_MAX = 1200;   // ~4 rings alive per gate at the fastest cadence
  const warnPos = new Float32Array(WARN_MAX * 3);
  const warnCol = new Float32Array(WARN_MAX * 3);
  const warnGeo = new THREE.BufferGeometry();
  warnGeo.setAttribute('position', new THREE.BufferAttribute(warnPos, 3));
  warnGeo.setAttribute('color', new THREE.BufferAttribute(warnCol, 3));
  warnGeo.setDrawRange(0, 0);
  const warnMesh = new THREE.Points(warnGeo, new THREE.PointsMaterial({
    size: 3.6, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.9,
  }));
  warnMesh.frustumCulled = false;   // the buffer is rewritten; its bounds lie
  scene.add(warnMesh);
  const warnFx = [];   // { c, t1, t2, a, r0, r1, t, life, col }

  // A ring lying ON the surface, so it reads as a shock across the floor
  // rather than a sphere hanging in the air. The basis comes from the cell's
  // own normal; a fixed up-vector degenerates wherever the sphere faces it.
  function warnRing(ci, hex, life, r1, at = null) {   // `at`: ring this point (a round's exact impact), not the cell's centre
    const nrm = at ? norm3(at) : host.graph().normals[ci];
    let t1 = cross3(nrm, [0, 1, 0]);
    if (len3(t1) < 1e-3) t1 = cross3(nrm, [1, 0, 0]);
    t1 = norm3(t1);
    const t2 = norm3(cross3(nrm, t1));
    const c = add3(at ?? host.graph().centers[ci], scale3(nrm, host.cellSide() * 0.12));
    // dense enough to read as a RING and not as scattered dots: the radius
    // grows to several cells, and 34 points across that is just confetti
    const N = 72;
    for (let i = 0; i < N && warnFx.length < WARN_MAX; i++) {
      warnFx.push({ c, t1, t2, a: (i / N) * Math.PI * 2, r0: host.cellSide() * 0.3, r1,
        t: 0, life, col: new THREE.Color(hex) });
    }
  }

  function stepWarnFx(dt) {
    let k = 0;
    for (let i = warnFx.length - 1; i >= 0; i--) {
      warnFx[i].t += dt;
      if (warnFx[i].t >= warnFx[i].life) warnFx.splice(i, 1);
    }
    for (const f of warnFx) {
      const u = f.t / f.life;
      const r = f.r0 + (f.r1 - f.r0) * u;
      const ca = Math.cos(f.a) * r, sa = Math.sin(f.a) * r;
      warnPos[k * 3] = f.c[0] + f.t1[0] * ca + f.t2[0] * sa;
      warnPos[k * 3 + 1] = f.c[1] + f.t1[1] * ca + f.t2[1] * sa;
      warnPos[k * 3 + 2] = f.c[2] + f.t1[2] * ca + f.t2[2] * sa;
      const fade = 1 - u;
      warnCol[k * 3] = f.col.r * fade;
      warnCol[k * 3 + 1] = f.col.g * fade;
      warnCol[k * 3 + 2] = f.col.b * fade;
      k++;
    }
    warnGeo.setDrawRange(0, k);
    warnGeo.attributes.position.needsUpdate = true;
    warnGeo.attributes.color.needsUpdate = true;
  }
  return { ring: warnRing, tick: stepWarnFx };
}
