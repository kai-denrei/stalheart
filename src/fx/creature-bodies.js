// THE CREATURE BODIES' SEAM (owner, 2026-10-12; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md, "In the game").
// A creature enemy is an ordinary enemy RECORD (src/fx/enemy-step.js: it walks the cell graph to the heart, takes damage through
// damageEnemy, dies through killCreature) whose picture is not its own Object3D but a body in a family's kit. This module sits between
// the two: it hands the enemy factory a light PROXY for `e.obj` (an empty Object3D with the userData contract downstream code reads, and
// a stand-in material for the emergence's opacity), maps every record's point into the bodies' plane once a frame, and calls the family's
// body adapter (src/fx/creature-cutis.js; the Reed family is pass two) behind one interface:
//
//   family.add(tier, { x, z, angle, lift, pos }) -> handle | null    family.track(handle, { x, z, ax, az, lift, pos }) -> re-placed?
//   family.kill(handle)   family.free(handle)   family.step(dt, camera, height)   family.setPlanet(R)
//   family.roots() -> Object3D[]   family.stats()   family.view(handle)   family.dispose()
//
// (x, z) are metres in the plane of the bodies' root: the heart's surface point, +Y the normal, the azimuthal-equidistant projection round
// it (src/domain/surface-projection.js); `pos` is the record's unit sphere point, for a family that draws through a frame of its own.
// The root sits at the heart's point with one unit a metre (scale cellSide / metresPerCell), so a kit that bends its plane onto a sphere
// of radius R = metresPerCell / cellSide metres lands exactly on the planet.
import * as THREE from '../../vendor/three.module.js';
import { surfaceFrame, toPlane } from '../domain/surface-projection.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// `scene` the game's scene, `families` { name: (opts) => adapter } (made on first use with { parent, tiers, follow, death }), `tiers` the
// content's CREATURE_TIERS, `follow` CREATURE_FOLLOW, `death` CREATURE_DEATH, `metresPerCell` the planet's (10); `heart()` the heart now:
// [its unit point, its cell, the board's cell side] (null before the board)
export function createCreatureBodies({ scene, families, tiers, follow, death, metresPerCell, heart }) {
  const root = new THREE.Group(); root.name = 'Creature bodies'; scene.add(root);
  const adapters = new Map(), live = new Map();   // family -> adapter; record -> { family, h, stamp }
  const basis = new THREE.Matrix4(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let frame = null, at = -1, side = 0, R = 0, stamp = 0, replaced = 0;

  const has = (family) => typeof families[family] === 'function';
  function adapter(family) {
    let a = adapters.get(family);
    if (!a && has(family)) { a = families[family]({ parent: root, tiers: tiers[family], follow, death }); if (R > 0) a.setPlanet(R); adapters.set(family, a); }
    return a ?? null;
  }

  // the root on the heart's point: re-placed when the heart or the cell side changes (a rebuilt board)
  function place() {
    const h = heart();
    if (!h) return;
    const [heartPoint, heartIndex, cellSide] = h;
    if (frame && heartIndex === at && cellSide === side) return;
    frame = surfaceFrame(heartPoint); at = heartIndex; side = cellSide;
    const metre = cellSide / metresPerCell;
    R = metresPerCell / cellSide;
    root.position.set(frame.origin[0], frame.origin[1], frame.origin[2]);
    root.quaternion.setFromRotationMatrix(basis.makeBasis(v[0].fromArray(frame.ex), v[1].fromArray(frame.ey), v[2].fromArray(frame.ez)));
    root.scale.setScalar(metre);
    root.updateMatrixWorld(true);
    for (const a of adapters.values()) a.setPlanet(R);
  }

  // e.obj for a creature record: nothing to draw, the userData contract (lift 0: the record's point is on the ground; the body has its own)
  function proxy() {
    const obj = new THREE.Object3D(); obj.name = 'creature record';
    obj.material = { opacity: 1, transparent: true, dispose() {} };
    Object.assign(obj.userData, { kind: 'creature', lift: 0, reach: 1, tick() {}, setTint() {} });
    return obj;
  }

  const planeOf = (p) => toPlane(frame, p, R);
  // the record's lift under the ground while it rises out of a breach (src/fx/enemy-step.js's emergence, 1.2 s)
  const liftOf = (e, r0) => (e.breachSource && e.emergeAge < 1.2 ? -(1 - clamp01(e.emergeAge / 1.2)) * follow.emergeRadii * r0 : 0);
  // the point `follow.lead` seconds ahead along the record's walk (cells a second: its spec's speed x its own pace)
  function aheadOf(e) {
    const d = (e.spec?.speed ?? 0) * (e.paceJitter ?? 1) * follow.lead * side, p = e.pos, dir = e.dir ?? [0, 0, 0];
    return planeOf([p[0] + dir[0] * d, p[1] + dir[1] * d, p[2] + dir[2] * d]);
  }

  // a new record of a creature type (`e.spec.body` the family, `e.tier` its tier): its body, at the record's point
  function spawn(e) {
    place();
    const family = e.spec?.body, a = family && adapter(family), t = a && tiers[family]?.[e.tier];
    if (!t || !frame) return false;
    const [x, z] = planeOf(e.pos), [ax, az] = aheadOf(e);
    const h = a.add(e.tier, { x, z, angle: Math.atan2(az - z, ax - x) || 0, lift: liftOf(e, t.r0), pos: e.pos });
    if (!h) return false;
    live.set(e, { family, h, stamp, r0: t.r0 });
    return true;
  }

  // the record died: `fx` its death plays (deflate, fade); without, it is gone at once (the heart took it, a reset)
  function kill(e, fx = false) {
    const b = live.get(e);
    if (!b) return;
    live.delete(e);
    const a = adapters.get(b.family);
    if (fx) a.kill(b.h); else a.free(b.h);
  }

  // once a frame, after the records have walked: every body follows its record; a body whose record left the list without dying (the
  // board cleared) goes; then each family steps and draws for `camera` (`height` the canvas's device pixels, the kit's LOD)
  function step(dt, enemies, camera, height) {
    place();
    if (!frame) return;
    stamp++;
    for (const e of enemies) {
      const b = live.get(e);
      if (!b || !e.alive) continue;
      b.stamp = stamp;
      const [x, z] = planeOf(e.pos), [ax, az] = aheadOf(e);
      if (adapters.get(b.family).track(b.h, { x, z, ax, az, lift: liftOf(e, b.r0), pos: e.pos })) replaced++;
    }
    for (const [e, b] of live) if (b.stamp !== stamp) { live.delete(e); adapters.get(b.family).free(b.h); }
    for (const a of adapters.values()) a.step(dt, camera, height);
  }

  return {
    has, proxy, spawn, kill, step,
    roots: () => [...adapters.values()].flatMap((a) => a.roots()),
    // the bodies' books: up now, re-placed on the leash, and each family's tiers
    stats: () => ({ live: live.size, replaced, planetR: +R.toFixed(1), families: Object.fromEntries([...adapters].map(([k, a]) => [k, a.stats()])) }),
    // one record's body (the harness): its family's view of it, plus where its record is in the plane
    view: (e) => { const b = live.get(e); return b ? { ...adapters.get(b.family).view(b.h), record: frame ? planeOf(e.pos) : null } : null; },
    // a dead record's body by its handle, kept by the caller before the kill (the harness watches a death play out)
    handleOf: (e) => live.get(e) ?? null,
    viewHandle: (b) => (b ? adapters.get(b.family)?.view(b.h) ?? null : null),
    dispose() { for (const a of adapters.values()) a.dispose(); adapters.clear(); live.clear(); scene.remove(root); },
  };
}
