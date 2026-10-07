// THE HULL'S DRIVE (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): movement over the cell graph: the
// wanderer's exit choice, the arrival at a cell, the per-frame steer, glide, respawn and absorb (advanceMotion), the heading's
// rotation and the smoothed direction the cameras follow. The rules it calls stay in src/domain (drive-ramp, steer-ease,
// hull-contact, hover-kick, hull-stuck).
// `host` hands in the controller: its fixed objects and functions as values (MOVES, breachBlocked, bumpFactor, checkAbsorb,
// containerBlocked, driveRamp, enemies, floorColorOf, freeBlocked, keys, manualActive, nearestWall, orbMeshes, paintCell, params,
// pedestalBlocked, player, runContext, spawnOneOrb, steerEase, steeringActive, updateHud, wallCushion), what it rebinds or declares later
// as getters (cellIndex, towerCells, cellSide, cruise, dungeon, gotoField, graph, kick, playerDown, portalDist, speedBonus, storyBase, stuck,
// throttle, whim) and the lets this writes as setters (setAutoMode) and getters with setters (respawnClock, steerHold).
import { TANK_DRIVE, TANK_STEER, TANK_WALL, TANK_KICK, HULL_STUCK } from '../content/tank.js';
import { stepDriveRamp, scrubDriveRamp } from '../domain/drive-ramp.js';
import { stepSteerEase } from '../domain/steer-ease.js';
import { stepStuck, unstick } from '../domain/hull-stuck.js';
import { startKick, stepKick, kicking, planKick, glideHeading } from '../domain/hover-kick.js';
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { sub3, add3, scale3, dot3, cross3, norm3, len3, dist3, tangentDir } from '../vec3.js';

export function createHullDrive(host) {
  // --- movement over the cell graph ---------------------------------------
  // the projection itself lives in vec3.js, so berths.js (pure, Node-tested)
  // and this file cannot drift apart; the wrapper just supplies `graph`
  const tangentDirTo = (from, to) =>
    tangentDir(host.graph().normals[from], host.graph().centers[from], host.graph().centers[to]);

  function openNeighbors(ci) {
    // towers block PATHING for everyone — they are the walls you buy
    return host.graph().adj[ci].filter((nb) => host.dungeon().tags[nb] !== BLOCKED && !host.towerCells().has(nb));
  }

  // --- the wanderer: exit choice = steering bias + its own whims -----------
  // Scored, not commanded: alignment with the steering intent dominates when
  // the player is actively steering, but unvisited-cell curiosity, a
  // backtrack penalty, and noise keep the walker willful.
  function chooseNext() {
    let exits = openNeighbors(host.player.cur);
    // auto never routes THROUGH a berth (free movement already refuses);
    // if the boxes somehow wall the only way out, solidity yields
    const clear = exits.filter((e2) => !host.containerBlocked(e2) && !host.pedestalBlocked(e2) && !host.breachBlocked(host.graph().centers[e2], 0.2));   // the autopilot keeps off the sinkholes too
    if (clear.length) exits = clear;
    if (exits.length === 0) return -1;
    // control mode: while the user steers, their intent dominates — the
    // creature's curiosity, backtrack aversion, and whims all yield
    const active = host.steeringActive() || host.manualActive();
    // DIRECTIVE: a high-level order shapes the wander. Vector goals
    // (avoid/ram) become a tangent to chase or flee; field goals
    // (home/portal) score descending hop-distance.
    let goalVec = null, goalField = null, goalSign = 1;
    if (!active) {
      const d = host.params.directive;
      if (d === 'home') goalField = host.dungeon().distToHeart;
      else if (d === 'goto' && host.gotoField()) goalField = host.gotoField();
      else if (d === 'portal' && host.portalDist()) goalField = host.portalDist();
      else if (d === 'avoid' || d === 'ram') {
        let bt = null, bd = Infinity;
        for (const en of host.enemies) {
          if (!en.alive) continue;
          if (d === 'ram' && !en.spec.rammable) continue;
          const dd = dist3(host.player.pos, en.pos);
          if (dd < bd) { bd = dd; bt = en; }
        }
        if (bt && bd < host.cellSide() * 14) {
          const n = norm3(host.player.pos);
          const raw = sub3(bt.pos, host.player.pos);
          const flat = sub3(raw, scale3(n, dot3(raw, n)));
          const l = len3(flat);
          if (l > 1e-9) {
            goalVec = scale3(flat, 1 / l);
            goalSign = d === 'avoid' ? -1 : 1;
          }
        }
      }
    }
    // SOLID units hurt to touch, and no autopilot order should drive the hull through one (operator ruling, filed against
    // seek-home): every directive except RAM (its chase must not be disrupted) and AVOID (which already flees everything) gets a
    // flee vector away from the dangerous tier, weighted by proximity so it outvotes the goal field only at close range.
    let fleeVec = null;
    if (!active && host.params.directive !== 'ram' && host.params.directive !== 'avoid') {
      const R = host.cellSide() * 4;
      let fx = 0, fy = 0, fz = 0, any = false;
      for (const en of host.enemies) {
        if (!en.alive || en.spec.rammable) continue;
        const dd = dist3(host.player.pos, en.pos);
        if (dd > R) continue;
        const w = 1 - dd / R;
        fx += (host.player.pos[0] - en.pos[0]) * w;
        fy += (host.player.pos[1] - en.pos[1]) * w;
        fz += (host.player.pos[2] - en.pos[2]) * w;
        any = true;
      }
      if (any) {
        const n = norm3(host.player.pos);
        const raw = [fx, fy, fz];
        const flat = sub3(raw, scale3(n, dot3(raw, n)));
        const l = len3(flat);
        if (l > 1e-9) fleeVec = scale3(flat, Math.min(1, l / host.cellSide()) / l);
      }
    }
    let best = exits[0], bestScore = -Infinity;
    for (const e of exits) {
      const dir = tangentDirTo(host.player.cur, e);
      let score = (active ? 4.5 : 2.2) * dot3(host.player.heading, dir);
      if (!active && !host.player.visited.has(e)) score += 1.1;      // curiosity
      if (!active && e === host.player.prev && exits.length > 1) score -= 2.4;
      if (goalVec) score += 3.2 * goalSign * dot3(dir, goalVec);
      if (fleeVec) score += 3.6 * dot3(dir, fleeVec);
      if (goalField) {
        const gain = goalField[host.player.cur] - goalField[e];      // +1 closer
        score += 3.2 * Math.max(-1, Math.min(1, gain));
      }
      score += (host.whim()() - 0.5) * (active ? 0.4 : 1.6);           // its own will
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // NOTE: reaching the heart is NOT a win here (that's the maze tabs'
  // rule) — the pole is home turf. The only victory is checkVictory's:
  // every spawn point destroyed and the field cleared.
  function arriveAt(cell) {
    host.player.prev = host.player.cur;
    host.player.cur = cell;
    host.player.moves++;
    host.player.visited.add(cell);
    host.paintCell(host.player.prev, host.floorColorOf(host.player.prev));
    host.updateHud();
  }

  // called once per frame: steer, glide (creature-paced), respawn, absorb
  function advanceMotion(dt) {
    if (host.player.won || host.playerDown() || host.player.next === -1) return;

    // continuous steering while held; ANY key claims manual control, and an engaged cruise keeps manual alive without a key
    const anyKey = host.keys.left || host.keys.right || host.keys.fast || host.keys.slow;
    if (anyKey || host.cruise()) host.setAutoMode(false); // any drive input takes the wheel — sticky, no timer
    host.setSteerHold(anyKey ? 0 : host.steerHold() + dt);
    const manual = host.manualActive();
    const steerRate = stepSteerEase(host.steerEase, dt, (host.keys.left ? 1 : 0) - (host.keys.right ? 1 : 0), TANK_STEER);   /* the hull eases into a turn and settles out of it instead of snapping (owner, 2026-09-16; src/domain/steer-ease.js) */
    if (steerRate) rotate(steerRate * dt);

    // MANUAL = FREE movement: kinematics leave the grid entirely (W drives along the heading, S reverses, A/D steer); the grid is
    // only a collision oracle (blocked cell? no entry) and keeps the semantics (current cell, visited, absorption) in sync
    if (manual) {
      host.player.freeMode = true;
      // forward is PLAYER-TRIGGERED: hold W to drive, or double-tap W/▲ for CRUISE (rolls on its own; W boosts, S kills it); the old
      // always-rolls-forward manual proved too aggressive. Keys override (a held key is an explicit act), else the lever's rest is the speed
      const drive = host.keys.slow ? -0.55
        : host.keys.fast ? (host.cruise() ? 1.45 : 1)
        : (host.throttle() !== 0 ? host.throttle() : (host.cruise() ? 1 : 0)); const rampMul = stepDriveRamp(host.driveRamp, dt, drive, host.keys.left || host.keys.right, TANK_DRIVE);
      const kp = stepKick(host.kick(), dt, TANK_KICK);   // THE HOVER KICK (src/domain/hover-kick.js): while it runs it alone moves the hull
      if (kp) { host.player.pos = kp; const ci = host.cellIndex()(kp); if (ci !== -1 && ci !== host.player.cur) arriveAt(ci); }
      else if (drive !== 0) {
        const v = host.params.speed * host.speedBonus() * host.cellSide() * 1.6 * drive * rampMul
          * (1 - 0.65 * host.bumpFactor()) * (host.storyBase()?.gateEase(host.player.pos) ?? 1); // run-over drag; a door opening (story-base gateEase)
        { const ahead = norm3(add3(host.player.pos, scale3(host.player.heading, host.cellSide() * TANK_KICK.ahead))), w = !steerRate && host.freeBlocked(ahead) ? host.nearestWall(ahead) : null; if (w) host.player.heading = glideHeading(host.player.pos, host.player.heading, norm3(sub3(w, host.player.pos)), dt, TANK_KICK); }   // THE HOVER GLIDE (src/domain/hover-kick.js), never against the player's own steer (it pinned the hull in bends)
        const step = scale3(host.player.heading, v * dt), before = host.player.pos;
        let cand = norm3(add3(host.player.pos, step));
        if (host.freeBlocked(cand)) {
          // slide: strip the into-wall component and try again; a building that stops the hull (solidAt) is the wall, its centre the way in
          const sid = host.storyBase()?.solidAt(cand), w = sid ? host.storyBase().structure(sid)?.holder?.getWorldPosition(new THREE.Vector3()).toArray() ?? host.nearestWall(cand) : host.nearestWall(cand);
          if (w) {
            const toWall = norm3(sub3(w, host.player.pos));
            const into = Math.max(0, dot3(step, toWall));
            // a mostly head-on hit THUDS like running something over; the bumpLeft gate keeps a grind from re-triggering every frame
            const slid = sub3(step, scale3(toWall, into)), share = into / (len3(step) || 1), kq = host.kick().cool > 0 ? null : planKick({ pos: host.player.pos, heading: host.player.heading, toWall, slid, share, cellSide: host.cellSide(), blocked: host.freeBlocked }, TANK_KICK);
            if (kq && startKick(host.kick(), { from: host.player.pos, ...kq }, TANK_KICK)) { scrubDriveRamp(host.driveRamp, 1 - TANK_KICK.keep, TANK_DRIVE); host.player.heading = kq.heading; }
            scrubDriveRamp(host.driveRamp, share * TANK_WALL.scrub * dt, TANK_DRIVE); if (len3(slid) > 1e-9) host.player.heading = norm3(add3(host.player.heading, scale3(norm3(slid), share * TANK_WALL.align * dt)));   // A WALL IS FRICTION, NOT A THUD (src/content/tank.js TANK_WALL)
            cand = norm3(add3(host.player.pos, slid));
            if (host.freeBlocked(cand)) cand = null;
          } else { cand = null; for (const a of TANK_WALL.glance) { const n0 = norm3(host.player.pos), r = add3(scale3(step, Math.cos(a)), scale3(cross3(n0, step), Math.sin(a))), c2 = norm3(add3(host.player.pos, scale3(r, Math.cos(a)))); if (!host.freeBlocked(c2)) { cand = c2; break; } } }   // a building: glance off it
          // wedged with nowhere to slide? creep toward the CURRENT cell's centre: open ground by definition, so it can always un-stick
          if (!cand) { scrubDriveRamp(host.driveRamp, 1, TANK_DRIVE);   // wedged: nothing built survives
            const home = host.graph().centers[host.player.cur];
            const toHome = sub3(home, host.player.pos);
            const l = len3(toHome);
            if (l > 1e-6) {
              const creep = norm3(add3(host.player.pos,
                scale3(toHome, Math.min(1, (v * dt) / l))));
              if (!host.freeBlocked(creep)) cand = creep;
            }
          }
        }
        if (cand) {
          host.player.pos = cand;
          host.player.travelDir = drive > 0 ? host.player.heading.slice() : scale3(host.player.heading, -1);
          const ci = host.cellIndex()(cand);
          if (ci !== -1 && ci !== host.player.cur) arriveAt(ci);
        }
        const k = stepStuck(host.stuck(), { driving: true, moved: dot3(sub3(host.player.pos, host.stuck().p ?? before), host.player.heading) * Math.sign(drive), expected: Math.abs(v) * dt, dt }, HULL_STUCK);   // wedged: eased to open ground; progress counts from where the last frame left it (creep, ease and cushion included)
        if (k > 0) host.player.pos = unstick(host.player.pos, host.graph().centers[host.player.cur], k * HULL_STUCK.rate * host.cellSide() * dt);
      } else stepStuck(host.stuck(), { driving: false, moved: 0, expected: 0, dt }, HULL_STUCK);
      if (!kicking(host.kick())) host.player.pos = host.wallCushion(host.player.pos);
      host.stuck().p = host.player.pos.slice();
      const nf = norm3(host.player.pos);
      host.player.heading = norm3(sub3(host.player.heading, scale3(nf, dot3(host.player.heading, nf))));
      updateSmoothDir(dt);
      // food systems keep running while driving free
      if (host.params.orbRespawn > 0) {
        host.setRespawnClock(host.respawnClock() + (dt));
        if (host.respawnClock() >= host.params.orbRespawn) {
          host.setRespawnClock(0);
          if (host.orbMeshes.size < host.params.orbs) host.spawnOneOrb();
        }
      }
      host.checkAbsorb();
      return;
    }

    // AUTO resumes from wherever free movement left off: the nearest open
    // cell becomes home, and the first glide eases out from the actual
    // position (virtualStart) instead of snapping to a cell center
    if (host.player.freeMode) {
      host.player.freeMode = false;
      const ci = host.cellIndex()(host.player.pos);
      if (ci !== -1 && host.dungeon().tags[ci] !== BLOCKED) host.player.cur = ci;
      host.player.prev = -1;
      host.player.next = chooseNext();
      host.player.prog = 0;
      host.player.virtualStart = host.player.pos.slice();
      if (host.player.next !== -1) {
        host.player.segLen = Math.max(1e-9, dist3(host.player.pos, host.graph().centers[host.player.next]));
      }
    }

    // U-turn: heading swung behind the motion — reverse the glide in place.
    if (host.steeringActive() && dot3(host.player.heading, host.player.travelDir) < -0.35
      && host.player.prog > 0.04 && host.player.prog < 0.96) {
      const old = host.player.cur;
      host.player.cur = host.player.next;
      host.player.next = old;
      host.player.prog = 1 - host.player.prog;
      host.player.prev = -1;
    }

    // orb respawn: the maze regrows food over time
    if (host.params.orbRespawn > 0) {
      host.setRespawnClock(host.respawnClock() + (dt));
      if (host.respawnClock() >= host.params.orbRespawn) {
        host.setRespawnClock(0);
        if (host.orbMeshes.size < host.params.orbs) host.spawnOneOrb();
      }
    }

    // world-space motion: speed is distance/sec over THIS segment's length, so a long chord between large cells takes
    // proportionally longer — the grid offers the space, the motion traverses it. The creature's own locomotion profile modulates
    // the pace on top. manual: motion only while W/S are held; auto: the creature's own pace
    const prof = host.MOVES[host.params.creature];
    const pace = host.params.speed * host.speedBonus() * (prof ? prof.speed(host.runContext.time) : 1)
      * (1 - 0.65 * host.bumpFactor()); // the run-over drag
    host.player.prog += (pace * host.cellSide() * dt) / host.player.segLen;
    while (host.player.prog >= 1 && !host.player.won) {
      const carry = (host.player.prog - 1) * host.player.segLen; // leftover distance
      host.player.virtualStart = null;
      arriveAt(host.player.next);
      // idle: steering intent drifts toward actual travel; while the user
      // steers, their intent is left untouched
      if (!host.steeringActive() && !host.manualActive()) {
        const td = tangentDirTo(host.player.prev, host.player.cur);
        host.player.heading = norm3(add3(scale3(host.player.heading, 0.65), scale3(td, 0.35)));
      }
      host.player.next = chooseNext();
      if (host.player.next === -1) { host.player.prog = 0; break; }
      host.player.segLen = Math.max(1e-9, dist3(host.graph().centers[host.player.cur], host.graph().centers[host.player.next]));
      host.player.prog = carry / host.player.segLen;
    }
    // interpolate along the chord, then push back onto the sphere
    const a = host.player.virtualStart || host.graph().centers[host.player.cur];
    const b = host.graph().centers[host.player.next === -1 ? host.player.cur : host.player.next];
    const f = Math.min(host.player.prog, 1);
    const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    host.player.pos = norm3(p); // radius 1
    const n = host.player.pos;
    const d = sub3(b, host.player.pos);
    const flat = sub3(d, scale3(n, dot3(d, n)));
    const l = Math.hypot(flat[0], flat[1], flat[2]);
    if (l > 1e-9) host.player.travelDir = scale3(flat, 1 / l);
    // cushion AFTER travelDir so the push shifts the body, not the aim
    host.player.pos = host.wallCushion(host.player.pos);
    // keep the steering intent in the local tangent plane as we move
    host.player.heading = norm3(sub3(host.player.heading, scale3(n, dot3(host.player.heading, n))));

    updateSmoothDir(dt);
    host.checkAbsorb();
  }
  function rotate(theta) {
    const n = norm3(host.player.pos);
    const h = host.player.heading;
    const c = Math.cos(theta), s = Math.sin(theta);
    const nxh = cross3(n, h);
    host.player.heading = norm3(add3(scale3(h, c), scale3(nxh, s)));
  }

  // smoothDir chases travelDir at a bounded angular rate — the no-jump
  // guarantee for cameras and the creature at exits and U-turns
  const SMOOTH_RATE = 5.0; // rad/s
  function updateSmoothDir(dt) {
    const n = norm3(host.player.pos);
    let s = norm3(sub3(host.player.smoothDir, scale3(n, dot3(host.player.smoothDir, n))));
    const raw = host.manualActive() ? host.player.heading : host.player.travelDir;
    const g = norm3(sub3(raw, scale3(n, dot3(raw, n))));
    const ang = Math.atan2(dot3(cross3(s, g), n), Math.max(-1, Math.min(1, dot3(s, g))));
    const step = Math.max(-SMOOTH_RATE * dt, Math.min(SMOOTH_RATE * dt, ang));
    const c = Math.cos(step), si = Math.sin(step);
    const nxs = cross3(n, s);
    host.player.smoothDir = norm3(add3(scale3(s, c), scale3(nxs, si)));
  }

  return { tangentDirTo, openNeighbors, chooseNext, arriveAt, advanceMotion, rotate, updateSmoothDir };
}
