// THE ENDING'S HOST (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): the sector loop's interlude
// (retired) and the finale. playDiorama (src/fx/finale-diorama.js) gets its own literal of the seven members it reads, story, startShot, scene,
// cellSide, hull, isao and spawnIsao (refactor round 2: `c` is no longer handed on); the finale itself reads storyBase, map, dungeon, graph, pause, hud and sfx.
import * as THREE from '../../vendor/three.module.js';
import { playDiorama } from './finale-diorama.js';
import { playOrbitalFinale } from './orbital-finale.js';

export function createEndingHost(c) {
  return {
    // THE PAINT SHOP AT THE BREAK is retired (2026-10-03: the palettes are all open, the bays' purple pad is the shop): the sector loop's
    // ask is answered no, and the next sector begins as it always did
    interlude: () => false,
    // THE FINALE (src/fx/finale-diorama.js, then src/fx/orbital-finale.js): the world runs again under the host's own shot, and
    // `then` (the next sector, or a new run) runs when they end
    finale: (then) => {
      // OUR OWN PLANET under the constellation (owner, 2026-10-06, twenty-seventh notes, 9): the board's own surface, the base at the pad
      // ...AND THE BASE ITSELF on it (owner, 2026-10-07: the ARC-01 should be the one in our base; an extension of the base): its group
      // cloned, its launcher's point and scale for the heads' rail
      const sb = c.storyBase(), la = sb?.structure?.('launcher')?.holder;
      const planet = c.map && c.dungeon() ? { map: c.map(), heart: c.graph().centers[c.dungeon().heart], base: sb?.group ?? null, launcher: la ? la.getWorldPosition(new THREE.Vector3()).toArray() : null, metres: la ? la.getWorldScale(new THREE.Vector3()).x : null } : null;
      const orbit = () => { c.pause?.(true); playOrbitalFinale(c.hud ?? document.body, { sfx: c.sfx, done: then, planet }); };   // the game holds under it; `then` lets it go
      c.pause?.(false); if (!playDiorama({ story: c.story, startShot: c.startShot, scene: c.scene, cellSide: c.cellSide, hull: c.hull, isao: c.isao, spawnIsao: c.spawnIsao }, orbit)) orbit(); return true;
    },
  };
}
