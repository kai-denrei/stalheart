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

  // The layer programs are shared by every module. r160 keys a program on the scene's light counts and on the
  // output colour space and tone mapping, so the pinned prewarm's own empty scene would still leave a link for the
  // first impact. The compile therefore takes its lights from the game scene (call this after the lights are in),
  // and runs twice: once for the screen and once for a linear offscreen target like the bloom chain's.
  function prewarm(renderer, camera) {
    const warm = { compile: (s, c) => renderer.compile(s, c, scene) };
    const target = new THREE.WebGLRenderTarget(1, 1);
    let previous;
    try {
      modules['rotary-pop'].prewarm(warm, camera);
      previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      modules['rotary-pop'].prewarm(warm, camera);
      renderer.setRenderTarget(previous);
    } catch (error) {
      if (previous !== undefined) renderer.setRenderTarget(previous);
      available = false; onError(error);
    }
    target.dispose();
    return available;
  }

  function spawn(use, point, surfaceNormal, cellSide) {
    const spec = EXPLOSION_USES[use], mod = spec && modules[spec.module];
    if (!available || !mod) return false;
    const size = mod.meta.size;
    let count = 0, oldest = -1;
    for (let i = 0; i < live.length; i++) if (live[i].size === size && count++ === 0) oldest = i;
    if (count >= EXPLOSION_CAPS[size]) { live[oldest].fx.dispose(); live.splice(oldest, 1); }
    let fx;
    // Metres become scene units through the module's own uScale, never object.scale: a puff's quad is widened after
    // modelViewMatrix, in view space, so an object scale shrinks where puffs sit but not how big they are. With uScale
    // in scene units the bend's radius is in scene units too: the distance from the planet's centre to the impact.
    const units = spec.scale * cellSide / METRES_PER_CELL;
    try { fx = mod.createExplosion({ palette: EXPLOSION_PALETTE, scale: units, seed: seed++, planetRadius: Math.hypot(point[0], point[1], point[2]) }); }
    catch (error) { available = false; onError(error); return false; }
    fx.object.position.set(point[0], point[1], point[2]);
    fx.object.quaternion.setFromUnitVectors(Y, normal.set(surfaceNormal[0], surfaceNormal[1], surfaceNormal[2]).normalize());
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
