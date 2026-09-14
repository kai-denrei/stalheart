// The game's explosions: the pinned lab modules (src/fx/explosions/) stood on the planet, scaled from their
// metres to scene units, capped per size and reaped. A module that fails to load or compile turns the adapter
// off and callers keep their dot bursts.
import * as THREE from '../../vendor/three.module.js';
import { METRES_PER_CELL } from '../core/stage-units.js';
import { EXPLOSION_USES, EXPLOSION_PALETTE, EXPLOSION_CAPS } from '../content/explosions.js';
import * as rotaryPop from './explosions/rotary-pop.js';
import * as boforsBurst from './explosions/bofors-burst.js';
import * as howitzerBlast from './explosions/howitzer-blast.js';
import * as orbitalStrike from './explosions/orbital-strike.js';

const MODULES = { 'rotary-pop': rotaryPop, 'bofors-burst': boforsBurst, 'howitzer-blast': howitzerBlast, 'orbital-strike': orbitalStrike };
const Y = new THREE.Vector3(0, 1, 0);

export function createExplosions(scene, { modules = MODULES, onError = () => {} } = {}) {
  const live = [];        // { fx, size }, oldest first
  const spawned = {};
  const normal = new THREE.Vector3();
  let seed = 1, available = true;

  function prewarm(renderer, camera) {
    try { modules['rotary-pop'].prewarm(renderer, camera); }   // the layer programs are shared by every module
    catch (error) { available = false; onError(error); }
    return available;
  }

  function spawn(use, point, surfaceNormal, cellSide) {
    const spec = EXPLOSION_USES[use], mod = spec && modules[spec.module];
    if (!available || !mod) return false;
    const size = mod.meta.size;
    const same = live.filter((l) => l.size === size);
    if (same.length >= EXPLOSION_CAPS[size]) { same[0].fx.dispose(); live.splice(live.indexOf(same[0]), 1); }
    let fx;
    try { fx = mod.createExplosion({ palette: EXPLOSION_PALETTE, scale: spec.scale, seed: seed++, planetRadius: METRES_PER_CELL / cellSide }); }
    catch (error) { available = false; onError(error); return false; }
    fx.object.position.set(point[0], point[1], point[2]);
    fx.object.quaternion.setFromUnitVectors(Y, normal.set(surfaceNormal[0], surfaceNormal[1], surfaceNormal[2]).normalize());
    fx.object.scale.setScalar(cellSide / METRES_PER_CELL);
    scene.add(fx.object);
    live.push({ fx, size });
    spawned[use] = (spawned[use] || 0) + 1;
    return true;
  }

  function tick(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      live[i].fx.tick(dt);
      if (!live[i].fx.alive()) { live[i].fx.dispose(); live.splice(i, 1); }
    }
  }

  function clear() { for (const l of live) l.fx.dispose(); live.length = 0; }

  return {
    prewarm, spawn, tick, clear, dispose: clear,
    get available() { return available; },
    state: () => ({ available, live: live.length, spawned: { ...spawned } }),
  };
}
