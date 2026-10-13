// THE PEARL SET'S BODIES IN THE STORY (owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the Cutis-Maku-Pearl set"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "The kit"): the `pearl` family behind src/fx/creature-bodies.js's family interface, as
// src/fx/creature-cutis.js is for ?creatures=cutis. ONE SWARM PER PEARL TIER (the stable per-tier pool Jelly-Baby's handoff asks for: a slot is a body's
// for its whole life and is freed only by its death, so index compaction can never swap two enemies' identities), made on the tier's first body, its
// group a child of the bodies' root (the heart's surface point, one unit a metre); a cored tier adds one instanced pearl mesh (src/fx/cutis-maku/hard-core.js)
// placed each frame from the swarm's getCoreContact and bent onto the planet as the membrane is. One tier draws several game types of different sizes:
// the swarm's r0 is its smallest type's and each body's instance scale is its own type's r0 over it (times the record's damage shrink, as the dot cloud
// shrinks with its hit points). A record's `tier` here is its game TYPE (the content's table is keyed by type: src/domain/pearl-bodies.js pearlBodies).
//
// FOLLOWING THE RECORD (src/content/pearl-enemies.js PEARL_FOLLOW, src/domain/pearl-bodies.js): the record owns the position; the body hunts the record's
// point `leadHops` of its own hop ahead, at a base pace scaled to its record's speed (pearlPace) and faster the further behind it is (CREATURE_FOLLOW's
// catch-up), and is put back on the record's point when it falls past the leash (pearlLeash) for CREATURE_FOLLOW.grace seconds, or twice the leash at once.
// A SQUAD (one record, `members` bodies) is that many bodies round the record (squadSpots), each following its own spot; a member the squad sheds deflates.
// THE CLOAK AND THE EMERGENCE: the record's stand-in carries the opacity the enemy loop writes for a dot cloud (src/fx/enemy-step.js: the rise out of a
// breach, the phantom's camo); over PEARL_FOLLOW.opacityRef it is the body's (membrane, inner core and pearl alike: the kit's life opacity).
// THE DEATH (CREATURE_DEATH, as the Cutis family's): the hop held, the membrane deflates into its puddle, then fades and sinks; the core sinks with the
// flattening body and fades with it; then the slot is free.
//
// add(type, { x, z, angle, lift, opacity, grow, members, speed }) -> handle | null    track(handle, { x, z, ax, az, lift, dt, opacity, grow, members, speed })
// kill(handle)   free(handle)   step(dt, camera, height)   setPlanet(R)   roots()   stats()   view(handle)   dispose()
import * as THREE from '../../vendor/three.module.js';
import { CutisSwarm } from './cutis-maku/swarm.js';
import { DEFAULT_CONFIG } from './cutis-maku/config.js';
import { createSwarmGeometry } from './cutis-maku/geometry.js';
import { createHardCores, corePose } from './cutis-maku/hard-core.js';
import { pearlPace, pearlLead, pearlLeash, squadSpots } from '../domain/pearl-bodies.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// `parent` the bodies' root, `tiers` the bodies by type (pearlBodies), `follow` CREATURE_FOLLOW, `death` CREATURE_DEATH, `set` PEARL_TIERS, `tune` PEARL_FOLLOW
export function createPearlFamily({ parent, tiers, follow, death, set, tune }) {
  const group = new THREE.Group(); group.name = 'Pearl enemies'; parent.add(group);
  const byId = Object.fromEntries(set.map((t) => [t.id, t]));
  // each tier's base radius: its smallest type's
  const baseR0 = {};
  for (const b of Object.values(tiers)) baseR0[b.tier] = Math.min(baseR0[b.tier] ?? Infinity, b.r0);
  const pools = new Map();   // tier id -> { swarm, geo, cores, free, next, dying: Map(slot -> { at, op }), live, peak, placed, replaced, deaths, full, shed }
  let planetR = 0, clock = 0;

  function poolOf(id) {
    let p = pools.get(id);
    if (p) return p;
    const def = byId[id], config = { ...DEFAULT_CONFIG, ...def.values, r0: baseR0[id], separation: tune.separation ?? DEFAULT_CONFIG.separation };   // the neighbour push eased: the records space themselves
    const swarm = new CutisSwarm(config, { capacity: tune.capacity[id] ?? 600 });
    const geo = createSwarmGeometry(swarm, { planetR }); geo.group.name = `Pearl ${id}`; group.add(geo.group);
    const cores = def.cored ? createHardCores(swarm, { planetR }) : null;
    if (cores) { cores.group.name = `Pearl ${id} cores`; group.add(cores.group); }
    p = { id, def, swarm, geo, cores, free: [], next: 0, dying: new Map(), live: 0, peak: 0, placed: 0, replaced: 0, deaths: 0, full: 0, shed: 0 };
    pools.set(id, p);
    return p;
  }
  function take(p) {
    if (p.free.length) { p.free.sort((a, b) => b - a); return p.free.pop(); }
    if (p.next < p.swarm.capacity) return p.next++;
    p.full++; return -1;
  }
  function release(p, i) { p.swarm.active[i] = 0; p.swarm.resetLife(i); p.swarm.hold[i] = 0; p.free.push(i); }

  // a spot [across, along] round (x, z) facing (dx, dz)
  const at = (x, z, dx, dz, s) => [x + dx * s[1] + dz * s[0], z + dz * s[1] - dx * s[0]];
  const opacityOf = (o) => clamp01((o ?? tune.opacityRef) / tune.opacityRef);

  function add(type, { x, z, angle = 0, lift = 0, opacity, grow = 1, members = 0, speed = 0 }) {
    const b = tiers[type];
    if (!b) return null;
    const p = poolOf(b.tier), sw = p.swarm, c = sw.config, r = b.r0;
    const pace = pearlPace({ cycle: c.cycleDuration, reach: c.reach, seek: c.seekCount, r, speed }, tune);
    const h = { p, type, r, pace, speed, slots: [], dead: false, dx: Math.cos(angle), dz: Math.sin(angle), op: opacityOf(opacity) };
    const spots = members > 1 ? squadSpots(members, r, tune.squad) : [[0, 0]];
    spots.forEach((s, k) => {
      const i = take(p);
      if (i < 0) return;
      const [px, pz] = at(x, z, h.dx, h.dz, s);
      sw.scale[i] = (r / c.r0) * grow;
      sw.setTarget(i, px, pz); sw.place(i, px, pz, angle); sw.pace[i] = pace;
      sw.life[i * 4] = lift; sw.life[i * 4 + 2] = h.op;
      h.slots.push({ i, k, s, behind: 0 });
    });
    if (!h.slots.length) return null;
    p.live += h.slots.length; p.placed += h.slots.length; p.peak = Math.max(p.peak, p.live);
    return h;
  }

  function die(h, slot) {
    const { p } = h, sw = p.swarm, i = slot.i;
    sw.hold[i] = 1; sw.life[i * 4] = 0;
    p.dying.set(i, { at: clock, op: sw.life[i * 4 + 2] }); p.live--; p.deaths++;
  }

  function track(h, { x, z, ax = x, az = z, lift = 0, dt = 0, opacity, grow = 1, members = 0, speed = h?.speed ?? 0 }) {
    if (!h || h.dead) return false;
    const { p } = h, sw = p.swarm, c = sw.config;
    // the squad sheds: the members its record no longer holds deflate, the last spots first
    if (members > 0) while (h.slots.length > Math.max(1, members)) { die(h, h.slots.pop()); p.shed++; }
    const d = Math.hypot(ax - x, az - z);
    if (d > 1e-6) { h.dx = (ax - x) / d; h.dz = (az - z) / d; }
    h.speed = speed; h.op = opacityOf(opacity);
    const ahead = speed * pearlLead({ cycle: c.cycleDuration, pace: h.pace }, tune), leash = pearlLeash({ r: h.r, speed }, follow, tune);
    const ang = Math.atan2(h.dz, h.dx);
    let replaced = false;
    for (const slot of h.slots) {
      const i = slot.i, k = i * 3, [px, pz] = at(x, z, h.dx, h.dz, slot.s), [tx, tz] = at(x + h.dx * ahead, z + h.dz * ahead, h.dx, h.dz, slot.s);
      const pos = sw.position(i), lag = Math.min(Math.hypot(pos[0] - px, pos[2] - pz), Math.hypot(sw.anchor[k] - px, sw.anchor[k + 2] - pz));
      sw.scale[i] = (h.r / c.r0) * grow;
      sw.life[i * 4] = lift; sw.life[i * 4 + 2] = h.op;
      slot.behind = lag > leash ? slot.behind + dt : 0;
      sw.setTarget(i, tx, tz);
      if (lag > 2 * leash || slot.behind > follow.grace) {
        slot.behind = 0; sw.place(i, px, pz, ang); sw.life[i * 4] = lift; sw.life[i * 4 + 2] = h.op; p.replaced++; replaced = true;
      }
      sw.pace[i] = Math.max(tune.floor, h.pace / (1 + lag / (follow.catchRadii * h.r)));
    }
    return replaced;
  }

  function kill(h) {
    if (!h || h.dead) return;
    h.dead = true;
    for (const slot of h.slots) die(h, slot);
  }

  function free(h) {
    if (!h) return;
    const { p } = h;
    for (const slot of h.slots) {
      if (p.dying.has(slot.i)) { p.dying.delete(slot.i); release(p, slot.i); } else if (!h.dead) { p.live--; release(p, slot.i); }
    }
    h.dead = true; h.slots = [];
  }

  function step(dt, camera, height) {
    clock += dt;
    for (const p of pools.values()) {
      const sw = p.swarm;
      for (const [i, d0] of p.dying) {
        const k = clock - d0.at, d = clamp01(k / Math.max(1e-6, death.deflate)), f = clamp01((k - death.deflate) / Math.max(1e-6, death.fade));
        sw.life[i * 4 + 1] = d; sw.life[i * 4 + 2] = d0.op * (1 - f); sw.life[i * 4] = -f * death.sink * sw.config.r0 * sw.scale[i];
        if (f >= 1) { p.dying.delete(i); release(p, i); }
      }
      sw.advance(dt);
      if (camera) { p.geo.update(camera, height, 0, false, false); p.cores?.update(); }
    }
  }

  function setPlanet(R) {
    if (!(R > 0) || R === planetR) return;
    planetR = R;
    for (const p of pools.values()) { p.geo.setPlanetR(R); p.cores?.setPlanetR(R); }
  }

  return {
    add, track, kill, free, step, setPlanet,
    roots: () => [group],
    // each tier present: bodies up, dying, the most up at once, placed, re-placed on the leash, deaths, squad members shed, refused for want of a slot
    stats: () => Object.fromEntries([...pools.values()].map((p) => [p.id, { live: p.live, dying: p.dying.size, peak: p.peak, placed: p.placed, replaced: p.replaced, deaths: p.deaths, shed: p.shed, full: p.full, capacity: p.swarm.capacity, r0: p.swarm.config.r0, cored: p.def.cored, cores: p.cores?.mesh.count ?? 0 }])),
    // one body's view (the harness): its first member's plane centre, radius, life [lift, deflate, opacity], hop stage, the pearl's pose (plane, unbent)
    view(h) {
      if (!h) return null;
      const slot = h.slots[0];
      if (!slot) return { tier: h.p.id, type: h.type, slots: 0, dead: h.dead };
      const { p } = h, sw = p.swarm, i = slot.i, pos = sw.position(i), L = sw.life;
      return { tier: p.id, type: h.type, slot: i, slots: h.slots.length, centre: [pos[0], pos[2]], radius: sw.config.r0 * sw.scale[i], lift: L[i * 4], deflate: L[i * 4 + 1], opacity: L[i * 4 + 2],
        stage: sw.getState(i), active: !!sw.active[i], dead: h.dead, cored: p.def.cored, pace: +h.pace.toFixed(3), core: p.def.cored ? corePose(sw, i, 0) : null };
    },
    dispose() { for (const p of pools.values()) { p.geo.dispose(); p.cores?.dispose(); } pools.clear(); parent.remove(group); },
  };
}
