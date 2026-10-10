// sinkhole.js — the bait mode's emergences out of the game's own sinkhole (owner, 2026-10-10: "the initial Tremor is not just the ground shaking, it is our
// sinkhole animation from the game mode"). Nothing here draws a sinkhole: the host is src/game-breaches.js, the adapter td-tab.js opens every breach through
// (its `create`, `update`, `ready`, `seal`, `patch`, `warm`), and its sinkhole is src/sinkhole.js on the src/fx/sinkhole kit, unchanged. This file is the lab's
// td-tab.js for it, as ./game-seat.js is for the gunship seat:
//
// THE GAME'S UNITS. The adapter places a breach on the unit sphere (`create(normal, forward, scale)`: the group at the normal, `scale` one cell, the planet
// `1 / scale` cells round) and cuts its hole out of the ground in world space. The lab's sphere group is in metres round the planet's centre, so the breaches live
// in `host`, a group in it scaled by the planet's radius: inside it the world is the game's (a cell is planet.cellSide, the sinkhole's numbers read in cells as
// the game's do), and its world matrix follows the sphere group and the seat's scaling of the scene (the adapter re-reads each sinkhole's frame every update).
// THE GROUND: the lab planet's floors and their grid lines are patched as td-tab.js patches its floor and edge meshes, so the ground opens with the hole.
// THE CELL. The game opens a breach on a cell's centre because its spawn points are cells; nothing in the sinkhole is tied to the grid (the hole is a disc in the
// breach's own frame, the floor's cut a world-space test), so the lab opens it on the arena's centre itself, where the Reeds and the boss come up.
// THE TIMING is the game's: `open` creates the breach, the adapter triggers it once the stone maps are in (the quake's sound then, as td-tab.js plays it in
// `update`'s onOpen, at the camera's distance in the game's units), its 1.6 s rumble, then the ground breaking; `ready()` is the adapter's own (the opening run to
// its `duration`), the rule the game's spawn queue waits on before a body comes out of a breach (src/fx/enemy-step.js). The wall cells the game clears round a
// breach (`onClear`) are the game's board: the arena's centre is floor, so the lab passes nothing.
// AFTERWARDS: `seal()` lays the game's rubble cap over a breach (the adapter's `seal`, the game's sealed sinkhole), and a breach opened while a cap lies hides the
// caps once its ground breaks (they would sit over the new hole); `reset()` takes every breach and cap away for a new round.
import * as THREE from '../../../vendor/three.module.js';
import { createGameBreaches } from '../../game-breaches.js';
import { makeShaderWarmer } from '../../fx/shader-warm.js';

// `sphere` the planet-centred group in metres, `renderer`/`scene`/`camera` the lab's (the warmer compiles against them), `audio` the lab's sounds (the
// breach's quake is in them), `planet()` the lab planet ({ radius, cellSide }), `ground(x, z)` the sphere point under a local point, `north(w)` a tangent
// there (the breach's forward), `look()` the board's look by name; `makeSinkhole` the adapter's test seam (test/boss-sinkhole.mjs)
export function createLabSinkhole({ sphere, renderer, scene, camera, audio, planet, ground, north, look, makeSinkhole }) {
  const host = new THREE.Group(); host.name = 'sinkholes (game units)'; sphere.add(host);
  let breaches = null, current = null, who = null, opens = 0, caps = 0, capsShown = true, log = [], patched = [];
  const camW = new THREE.Vector3();
  function adapter() {
    if (breaches) return breaches;
    host.scale.setScalar(planet().radius); host.updateMatrixWorld(true);
    breaches = createGameBreaches(host, camera, audio, { look, ...(makeSinkhole ? { makeSinkhole } : {}) });   // the adapter's own test seam passed through
    return breaches;
  }
  // the camera's distance to a breach in the game's units (host-local: the unit sphere), the quake's distance as td-tab.js's camDist measures it
  function camDist(obj) {
    camera.getWorldPosition(camW); host.worldToLocal(camW);
    return camW.distanceTo(obj.position);
  }
  const entry = () => current?.userData.breach ?? null;
  return {
    host,
    // the lab planet's ground opens with the hole: its floors and their grid lines, as td-tab.js patches its floor and edge meshes
    patchGround(planetMesh) {
      const b = adapter(); patched = [];
      for (const name of ['floors', 'edges']) { const m = planetMesh.getObjectByName(name); if (m?.material) { b.patch(m.material); patched.push(name); } }
      return patched;
    },
    // the programs and stone maps before the first opening (the adapter's template, as td-tab.js warms it at boot)
    warm() { return adapter().warm(makeShaderWarmer(renderer, scene, camera)); },
    // a breach at the local point `at`, `size` cells wide (the game's is one), for `name` (who comes out of it); one open at a time: an open one is sealed first
    open(at, size = 1, name = null) {
      const b = adapter();
      if (current) this.seal();
      const w = ground(at[0], at[1]), l = Math.hypot(w[0], w[1], w[2]) || 1;
      current = b.create([w[0] / l, w[1] / l, w[2] / l], north(w), planet().cellSide * size);
      who = name; log.push({ who: name, at: [...at], size });
      return current;
    },
    // the open breach sealed with the game's rubble cap
    seal() {
      if (!current) return false;
      const done = breaches.seal(current); current = null; who = null;
      if (done) { caps++; capsShown = true; breaches.rubbleShow(true); }
      return done;
    },
    // the game's spawn rule: the breach has opened and run its duration (false with none open)
    ready: () => !!current && breaches.ready(current),
    // for whom the open breach is ('reeds', 'boss'; null with none open)
    who: () => who,
    // every frame: the adapter's update (its trigger, the opening, the hole into the ground's uniforms), the quake's sound on the opening, the caps hidden once
    // a new breach's ground breaks
    step(dt) {
      if (!breaches) return;
      breaches.update(dt, () => {}, (opened) => { opens++; audio.play('sinkhole_quake', { dist: Math.min(...opened.map(camDist)) }); });
      const e = entry();
      if (caps && capsShown && e && e.fx.state().phase === 'open') { capsShown = false; breaches.rubbleShow(false); }
    },
    reset() {
      if (!breaches) return;
      breaches.reset(); breaches.rubbleShow(true); current = null; who = null; caps = 0; capsShown = true; log = [];
    },
    // the handle's view: the module (the adapter's own state of each breach: phase, hole, opening age, ready...), the open one (for whom, where in local
    // metres is the caller's), the openings sounded, the caps laid, the ground patched
    state() {
      const e = entry(), all = breaches ? breaches.state() : [];
      return {
        module: 'src/game-breaches.js', open: !!current, who, opens, caps, capsShown, opened: log.map((o) => ({ ...o })),
        breach: e ? { ...e.fx.state(), age: e.age, started: e.started, ready: breaches.ready(current), craterRadius: e.fx.tune.craterRadius, scale: current.scale.x, name: current.name } : null,
        breaches: all.length, visible: !!current?.visible, ground: [...patched],
      };
    },
    dispose() { breaches?.dispose(); sphere.remove(host); },
  };
}
