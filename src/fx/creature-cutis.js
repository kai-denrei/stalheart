// THE CUTIS-MAKU FAMILY'S BODIES IN THE GAME (owner, 2026-10-12; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md,
// "Cutis drawing"): one body adapter behind src/fx/creature-bodies.js's family interface. One instanced swarm of the ported kit
// (src/fx/cutis-maku) per tier present, made on the tier's first body, its group a child of the bodies' root (the heart's surface point,
// +Y the normal, one unit a metre), so every instance's plane point is its azimuthal-equidistant position round the heart and the kit's
// shader bends it onto the sphere (uPlanetR the planet's radius in metres). The record owns the position: each frame a body hunts the
// record's point a little ahead (setTarget), hops faster the further behind it is (pace), and is put on the record's point when it falls
// more than the leash behind (counted). Death as in the boss lab (src/labs/boss/cutis-scenario.js puddle): the hop held, deflate, fade and
// sink, then the slot is free for the next body (a free list, lowest slot first).
//
// THE FAMILY INTERFACE (what src/fx/creature-bodies.js calls; a second family implements the same):
//   add(tierKey, { x, z, angle, lift, pos })   -> handle      a body at plane point (x, z) metres, facing `angle`, `lift` m (below 0: under ground)
//   track(handle, { x, z, ax, az, lift, pos, dt }) -> boolean follow the record at (x, z), aiming at (ax, az); true when it was re-placed
//   kill(handle)                                              its death starts (it frees its own slot when done)
//   free(handle)                                              gone now (a board reset)
//   step(dt, camera, height, cull)                            advance and draw (the kit's 1/120 s stepping; the LOD and culling from `camera`)
//   setPlanet(R)                                              the planet's radius in plane units (metres)
//   roots() -> Object3D[]   stats() -> { [tier]: {...} }      dispose()
import * as THREE from '../../vendor/three.module.js';
import { CutisSwarm } from './cutis-maku/swarm.js';
import { createSwarmGeometry } from './cutis-maku/geometry.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// `parent` the bodies' root group (plane metres), `tiers` the family's table (src/content/creature-enemies.js CREATURE_TIERS.cutis),
// `follow` CREATURE_FOLLOW, `death` CREATURE_DEATH, `lod` the swarms' level object (src/fx/cutis-maku/geometry.js; the bestiary's stage forces the high
// hull, owner 2026-10-14: "enemies at high resolution"; null: the kit's CUTIS_LOD, as before)
export function createCutisFamily({ parent, tiers, follow, death, lod = null }) {
  const group = new THREE.Group(); group.name = 'Cutis-Maku enemies'; parent.add(group);
  const swarms = new Map();   // tier -> { swarm, geo, free: [], dying: Set, live: number, peak, placed, replaced, deaths }
  let planetR = 0, clock = 0;

  function tierOf(key) {
    let t = swarms.get(key);
    if (t) return t;
    const def = tiers[key];
    const swarm = new CutisSwarm({ ...def.config }, { capacity: def.capacity });
    const geo = createSwarmGeometry(swarm, { planetR, lod });
    geo.group.name = `Cutis-Maku ${key}`; group.add(geo.group);
    t = { key, def, swarm, geo, free: [], next: 0, dying: new Map(), live: 0, peak: 0, placed: 0, replaced: 0, deaths: 0, full: 0 };
    swarms.set(key, t);
    return t;
  }
  const radius = (t, i) => t.swarm.config.r0 * t.swarm.scale[i];

  function add(key, { x, z, angle = 0, lift = 0 }) {
    const t = tierOf(key);
    let i;
    if (t.free.length) { t.free.sort((a, b) => b - a); i = t.free.pop(); } else if (t.next < t.swarm.capacity) i = t.next++; else { t.full++; return null; }
    const sw = t.swarm;
    sw.setTarget(i, x, z); sw.place(i, x, z, angle); sw.pace[i] = 1;
    sw.life[i * 4] = lift;
    t.live++; t.placed++; t.peak = Math.max(t.peak, t.live);
    return { t, i, dead: false };
  }

  function track(h, { x, z, ax = x, az = z, lift = 0, dt = 0 }) {
    if (!h || h.dead) return false;
    const { t, i } = h, sw = t.swarm, k = i * 3, r = radius(t, i);
    // how far behind: the nearer of where it stands now and where its hop is landing; past the leash it has `grace` seconds to catch
    // up (a record that jumps, out of its breach's spread or under a shove, is caught by a hop), past twice the leash none
    const p = sw.position(i), lag = Math.min(Math.hypot(p[0] - x, p[2] - z), Math.hypot(sw.anchor[k] - x, sw.anchor[k + 2] - z));
    const leash = Math.max(follow.leashRadii * r, follow.leashMin);
    sw.life[i * 4] = lift;
    h.behind = lag > leash ? (h.behind ?? 0) + dt : 0;
    if (lag > 2 * leash || h.behind > follow.grace) {
      h.behind = 0;
      const a = Math.atan2(az - z, ax - x);
      sw.setTarget(i, ax, az); sw.place(i, x, z, Number.isFinite(a) ? a : 0); sw.life[i * 4] = lift; t.replaced++;
      return true;
    }
    sw.setTarget(i, ax, az);
    sw.pace[i] = Math.max(follow.fastest, 1 / (1 + lag / (follow.catchRadii * r)));
    return false;
  }

  function kill(h) {
    if (!h || h.dead) return;
    h.dead = true;
    const { t, i } = h, sw = t.swarm;
    sw.hold[i] = 1; sw.life[i * 4] = 0;
    t.dying.set(i, clock); t.live--; t.deaths++;
  }

  function release(t, i) { t.swarm.active[i] = 0; t.swarm.resetLife(i); t.swarm.hold[i] = 0; t.free.push(i); }
  function free(h) {
    if (!h) return;
    const { t, i } = h;
    if (t.dying.has(i)) { t.dying.delete(i); release(t, i); return; }
    if (h.dead) return;
    h.dead = true; t.live--; release(t, i);
  }

  function step(dt, camera, height, cull = true) {
    clock += dt;
    for (const t of swarms.values()) {
      const sw = t.swarm;
      for (const [i, at] of t.dying) {
        const k = clock - at, d = clamp01(k / Math.max(1e-6, death.deflate)), f = clamp01((k - death.deflate) / Math.max(1e-6, death.fade));
        sw.life[i * 4 + 1] = d; sw.life[i * 4 + 2] = 1 - f; sw.life[i * 4] = -f * death.sink * radius(t, i);
        if (f >= 1) { t.dying.delete(i); release(t, i); }
      }
      sw.advance(dt);
      if (camera) t.geo.update(camera, height, 0, false, !!t.def.multicolored, cull);
    }
  }

  function setPlanet(R) {
    if (!(R > 0) || R === planetR) return;
    planetR = R;
    for (const t of swarms.values()) t.geo.setPlanetR(R);
  }

  return {
    add, track, kill, free, step, setPlanet,
    roots: () => [group],
    // each tier present: bodies up, dying, the most up at once, placed, re-placed on the leash, deaths, refused for want of a slot, draw
    // calls (two LODs x membrane and core, and the shadows)
    stats: () => Object.fromEntries([...swarms.values()].map((t) => [t.key, { live: t.live, dying: t.dying.size, peak: t.peak, placed: t.placed, replaced: t.replaced, deaths: t.deaths, full: t.full, capacity: t.swarm.capacity, r0: t.def.r0 }])),
    // one body's view, for the harness: plane centre, radius, life [lift, deflate, opacity], the hop's stage, active
    view(h) {
      if (!h) return null;
      const { t, i } = h, sw = t.swarm, p = sw.position(i), L = sw.life;
      return { tier: t.key, slot: i, centre: [p[0], p[2]], radius: radius(t, i), lift: L[i * 4], deflate: L[i * 4 + 1], opacity: L[i * 4 + 2], stage: sw.getState(i), active: !!sw.active[i], dead: h.dead };
    },
    dispose() { for (const t of swarms.values()) t.geo.dispose(); swarms.clear(); parent.remove(group); },
  };
}
