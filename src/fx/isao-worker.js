// ISAO THE WORKER (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the construction drone and his assistant,
// the order book (orders, orderByCell), the travel and the print, the print beam, and flying him by hand in the drone view.
// The controller keeps the two drones themselves (isao, assistant: its lets, read everywhere) and hands them in with setters.
// `host` hands in the controller: its fixed objects and functions as values (X_AXIS, Z_AXIS, automated, checkAchievements,
// commitTower, disposeObj, effectiveStats, flashShopNote, keys, params, placeError, placeTowerObj, scene, sfx, showBrief,
// showRangeRing, tmpObj, tmpQ, towers, updateHud), what it rebinds or declares later as getters (cellSide, dungeon, eco, graph, run,
// sectorRun, story, storyApi, t, throttle) and the two drones as getters with setters (isao/setIsao, assistant/setAssistant).
import { BASE_BUILDER } from '../content/base-programme.js';
import { unlockedTowers } from '../domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';
import { makeSiteRing as siteRing, disposeSiteRing } from './site-ring.js';
import { printGhost, skinIn } from './tower-print.js';
import * as THREE from '../../vendor/three.module.js';
import { printPhase, printOffset, printOn, patternSecsFor } from '../printpath.js';
import { sub3, add3, scale3, dot3, cross3, norm3, len3, dist3, tangentBasis } from '../vec3.js';
import { lookIsao } from './isao-look.js';
import { preloadFabricator, makeIsaoDrone } from '../units.js';
import { TOWER_BY_KEY, upgradeCost } from '../towers.js';
import { buildTowerLook } from '../towerlooks.js';

export function createIsaoWorker(host) {
  // --- ISAO: the industrial construction drone. Nothing the player builds is built by the player: an order is placed, he flies to the
  // cell and prints, so TRAVEL and BUILD stand between wanting a tower and having one. Biomass leaves at ORDER time (no free queue to spam),
  // a cancelled order refunds in full. He flies out of reach: a simplification, making him killable is a design lever for a decision
  const ISAO_TINT = 0xbfe6ff;      // pale works blue — the CRT is the warm thing on him now
  const ISAO_ALT = 3.4;            // in wall-heights above the wall tops
  let isaoAlt = ISAO_ALT;          // ...and where the pilot has put him
  const ISAO_CELLS_SEC = BASE_BUILDER.cellsPerSecond;   // cruise, in cells per second (content)
  const ISAO_BUILD_BASE = 2.0;     // seconds before cost is considered
  const ISAO_BUILD_PER_KG = 1 / 55; // ...and per kg of biomass printed
  const buildSeconds = (cost) => ISAO_BUILD_BASE + cost * ISAO_BUILD_PER_KG;
  const workers = () => (host.assistant() ? [host.isao(), host.assistant()] : [host.isao()]).filter(Boolean);
  const ASSIST_TINT = 0xffb347;    // amber, so the two never read as one drone
  function spawnAssistant() {
    if (host.assistant() || !host.graph() || !host.dungeon()) return Promise.resolve(false);
    return preloadFabricator().then((ok) => {
      if (!ok || host.assistant() || !host.graph() || !host.dungeon()) return false;
      const obj = makeIsaoDrone(ASSIST_TINT);
      if (!obj) return false;
      obj.scale.setScalar(host.cellSide() * 1.15);
      // parked a couple of cells off the heart's other side, so the pair do
      // not spawn inside each other
      const hd = norm3(host.graph().centers[host.dungeon().heart]);
      const [u2] = tangentBasis(hd);
      const dir = norm3(add3(hd, scale3(u2, host.cellSide() * 2.2)));
      host.setAssistant({ obj, dir, state: 'idle', t: 0, dur: 0, order: null, loiter: dir.slice(), gleeT: 0 });
      placeWorker(host.assistant());
      host.scene.add(obj);
      host.updateHud();
      return true;
    });
  }
  let printBeam = null;             // one Line, reused for every print
  const PRINT_TRAIL = 8;            // bead segments behind the head
  const PRINT_TRAIL_STEP = 0.014;   // how far back along the path each one sits
  const orders = [];                // FIFO; orders[0] is the live one
  const orderByCell = new Map();    // ci -> order, for the shop and the cancel
  const isaoRadius = () => 1 + host.params.wallHeight * isaoAlt + host.cellSide() * 0.5;

  function isaoPos(dir) {
    const r = isaoRadius();
    return [dir[0] * r, dir[1] * r, dir[2] * r];
  }
  // shortest path over the sphere, capped at maxAngle radians this step
  function stepDir(from, to, maxAngle) {
    const d = Math.max(-1, Math.min(1, dot3(from, to)));
    const ang = Math.acos(d);
    if (ang < 1e-5 || maxAngle >= ang) return to.slice();
    const k = maxAngle / ang;
    const s0 = Math.sin((1 - k) * ang) / Math.sin(ang);
    const s1 = Math.sin(k * ang) / Math.sin(ang);
    return norm3(add3(scale3(from, s0), scale3(to, s1)));
  }

  function spawnIsao() {
    if (host.isao() || !host.graph() || !host.dungeon()) return Promise.resolve(false);
    return preloadFabricator().then((ok) => {
      if (!ok || host.isao() || !host.graph() || !host.dungeon()) return;
      const obj = makeIsaoDrone(ISAO_TINT);
      if (!obj) return;
      obj.scale.setScalar(host.cellSide() * 1.15);
      const dir = norm3(host.graph().centers[host.story()?.home ?? host.dungeon().heart]);
      host.setIsao({ obj, dir, state: 'idle', t: 0, dur: 0, order: null, loiter: dir.slice(), gleeT: 0, assistAt: host.story()?.assistAt ?? null }); if (host.story()) host.story().assistAt = null;   /* a foundry that deployed before he landed is still his to tend */
      placeIsao();
      host.scene.add(obj);
      return true;
    });
  }
  function placeWorker(w = host.isao()) {
    const p = isaoPos(w.dir);
    w.obj.position.set(p[0], p[1], p[2]);
    // up is its own radial; face where it is going (or where it is working)
    // he faces what he is doing: the site while flying to it AND while
    // printing it, his drift when idle. The build case used to fall through
    // to a stale loiter point, so he printed with his back to the work —
    // invisible until a camera was hung off his facing.
    host.tmpObj.position.copy(w.obj.position);
    host.tmpObj.up.set(w.dir[0], w.dir[1], w.dir[2]);

    // WHILE PILOTED HE FACES WHERE HE IS FLYING. This is the bug the operator saw as "rotates on an unnatural axis": the aim
    // below falls back to w.loiter, and pilotIsao sets loiter to his own POSITION, so the lookAt target sat on top of him, the
    // distance guard skipped the lookAt entirely, and his quaternion was left stale from whatever it last was. He was not
    // rotating oddly — he was not being oriented at all.
    if (w === host.isao() && host.params.view === 'drone' && isaoHeading) {
      const ahead = add3(p, scale3(isaoHeading, host.cellSide()));
      host.tmpObj.lookAt(ahead[0], ahead[1], ahead[2]);
      w.obj.quaternion.copy(host.tmpObj.quaternion);
      // LEAN AND BANK, composed as quaternions onto the facing — never written as Euler on the same object, which would replace
      // the whole orientation and put us straight back to an unnatural axis. This project has that dead end on record twice.
      host.tmpQ.setFromAxisAngle(host.X_AXIS, isaoLean);
      w.obj.quaternion.multiply(host.tmpQ);
      host.tmpQ.setFromAxisAngle(host.Z_AXIS, isaoRoll);
      w.obj.quaternion.multiply(host.tmpQ);
      return;
    }

    // autonomous: he faces what he is doing — the site while flying to it AND
    // while printing it, his drift when idle
    const aim = w.order ? norm3(host.graph().centers[w.order.ci]) : w.loiter;
    const t = isaoPos(aim);
    if (dist3(t, p) > 1e-4) host.tmpObj.lookAt(t[0], t[1], t[2]);
    w.obj.quaternion.copy(host.tmpObj.quaternion);
  }
  const placeIsao = () => placeWorker(host.isao());

  // the site marker: a ring of points on the wall top, in the tower's own
  // colour, that says "something is coming here". It is the ONLY thing an
  // ordered-but-unbuilt cell shows until Isao arrives — the tower itself
  // grows out of the ground while he prints it, which is a better progress
  // bar than a progress bar.
  function makeSiteRing(ci, color) { return siteRing(host.scene, host.graph().centers[ci], host.graph().normals[ci], host.cellSide(), host.params.wallHeight, color); }   // src/fx/site-ring.js
  function dropSiteRing(order) { if (!order.ring) return; disposeSiteRing(host.scene, order.ring); order.ring = null; }

  // `quiet` is for orders the GAME places rather than the player: no click,
  // no range ring, and no printer brief — that brief exists to fire the first
  // time the PLAYER commits to an order, and having the opening garrison
  // spend it teaches the mechanic to nobody.
  function orderTower(key, ci, { quiet = false } = {}) {
    const def = TOWER_BY_KEY[key];
    if (!def) return false; if (host.automated() && !unlockedTowers(host.story().expeditions, STORY_EXPEDITIONS.base).includes(key)) { host.flashShopNote('PART NOT HOME'); return false; }   /* the part for this wall is still out at a landing site: the same shop note the other refusals use */
    const err = host.placeError(ci);
    if (err) { host.flashShopNote(err); return false; }
    if (orderByCell.has(ci)) { host.flashShopNote('already on the list'); return false; }
    if (!host.eco().spend(def.cost)) {
      host.flashShopNote('not enough biomass');
      host.showBrief('biomass');   // he has an opinion about this
      return false;
    }
    const order = { kind: 'tower', ci, key, def, cost: def.cost, ring: makeSiteRing(ci, def.color) };
    orders.push(order);
    orderByCell.set(ci, order);
    if (!quiet) host.showBrief('printer');   // the first order is when the mechanic is real
    host.run().maxQueue = Math.max(host.run().maxQueue, orders.length);
    host.checkAchievements();
    spawnIsao();
    if (!quiet) {
      host.sfx.play('laser_click'); // the order goes on the book, not a tower on the wall
      host.showRangeRing(ci, host.effectiveStats(def, 0).range, def.color, 1.6);
    }
    host.updateHud();
    return true;
  }
  function orderUpgrade(tower) {
    const cost = upgradeCost(tower.def, tower.tier);
    if (cost === null) return false;
    if (orderByCell.has(tower.ci)) { host.flashShopNote('already on the list'); return false; }
    if (!host.eco().spend(cost)) { host.flashShopNote('not enough biomass'); return false; }
    const order = { kind: 'upgrade', ci: tower.ci, tower, cost,
      ring: makeSiteRing(tower.ci, tower.def.color) };
    orders.push(order);
    orderByCell.set(tower.ci, order);
    spawnIsao();
    host.updateHud();
    return true;
  }
  // Cancelling costs nothing: nothing has been printed. The one exception is
  // the order Isao is already standing over — the biomass is in the nozzle
  // by then, and half of it does not come back.
  function cancelOrder(ci, why = null) {
    const order = orderByCell.get(ci);
    if (!order) return false;
    const live = !!(order.worker && order.worker.state === 'build');
    host.eco().addBiomass(live ? Math.round(order.cost * 0.5) : order.cost, { category: 'refund' });
    dropSiteRing(order);
    if (order.ghost) { host.scene.remove(order.ghost); host.disposeObj(order.ghost); order.ghost = null; }
    orders.splice(orders.indexOf(order), 1);
    orderByCell.delete(ci);
    if (host.isao() && host.isao().order === order) { host.isao().order = null; host.isao().state = 'idle'; }
    host.flashShopNote(why ? `${why} — ${live ? 'half back' : 'biomass returned'}`
      : (live ? 'order aborted — half back' : 'order cancelled'));
    host.updateHud();
    return true;
  }

  function finishOrder(order) {
    dropSiteRing(order);
    if (order.kind === 'structure') { host.storyApi().printed(order.step); host.sfx.play('tower_upgrade'); } else if (order.kind === 'repair') { host.storyApi().repaired(order.repair); host.sfx.play('tower_upgrade'); } else if (order.kind === 'receive') { order.done?.(); /* the part is in: the glue calls the unlock */ } else if (order.kind === 'tower') {   /* a piece of the base Isao printed, or a piece of it the swarm took back (src/content/base-programme.js, src/domain/repair-orders.js) */
      const ghost = order.ghost, drop = () => { if (ghost) { host.scene.remove(ghost); host.disposeObj(ghost); } }; order.ghost = null;
      // re-check: the world moved while he flew (a strike, a sell, a tower
      // someone else put here). If the cell went bad, the biomass comes back.
      if (host.placeError(order.ci)) {
        host.eco().addBiomass(order.cost, { category: 'refund' });
        host.flashShopNote('site lost — biomass returned'); drop();
      } else {
        const t = host.commitTower(order.key, order.ci, order.cost); if (ghost) skinIn(t.obj, ghost, { onDone: drop }); else drop();   // the skin rises over the wireframe
        host.sfx.play('tower_upgrade'); host.sectorRun()?.note({ type: 'print', id: order.key });
      }
    } else if (host.towers.includes(order.tower)) {
      order.tower.tier++;
      order.tower.spent += order.cost;
      if (order.tower.obj.userData.setTier) order.tower.obj.userData.setTier(order.tower.tier);
      host.placeTowerObj(order.tower);
      host.showRangeRing(order.ci, host.effectiveStats(order.tower.def, order.tower.tier).range,
        order.tower.def.color, 1.4);
      host.sfx.play('tower_upgrade'); host.sectorRun()?.note({ type: 'print', id: order.tower.key });
    } else {
      host.eco().addBiomass(order.cost, { category: 'refund' });   // the tower was sold or destroyed mid-flight
    }
    const at = orders.indexOf(order);
    if (at >= 0) orders.splice(at, 1);   // by identity: with two workers it is not always orders[0]
    orderByCell.delete(order.ci);
    const w = order.worker || host.isao();
    if (w) { w.gleeT = 2.2; w.order = null; w.state = 'idle'; w.t = 0; }
    order.worker = null;
    host.updateHud();
  }

  // --- FLYING HIM YOURSELF --------------------------------------------------
  // The drone camera started as a view. The operator wants the machine: in
  // drone view you have the stick, and Isao goes where you point him.
  //
  // His WORK is suspended while you fly — a drone cannot be halfway to a
  // print and under your hand at the same time, and pretending otherwise
  // would mean an order that never completes because you flew off with it.
  // Leave the view and he picks the queue straight back up.
  let isaoHeading = null;    // unit tangent at isao.dir; the way he is pointed
  const ISAO_TURN = 1.9;     // rad/s
  const ISAO_CLIMB = 2.4;    // altitude units per second, held
  // MEASURED. The demand maps about 1:1 to the tilt once it is measured
  // against his CURRENT local up — the early readings of 52 and 37 degrees
  // were the sphere's curvature leaking into the probe, not the model. 0.32
  // rad is a visible ~18 degrees: enough to read as a quadcopter tipping into
  // its acceleration, short of looking like a stall.
  const ISAO_LEAN = 0.32;    // rad of nose-down at full forward
  const ISAO_ROLL = 0.24;    // rad of bank into a turn
  let isaoLean = 0, isaoRoll = 0;
  const ISAO_FLY = 3.4;      // cells/s under power
  function pilotIsao(dt) {
    const up = host.isao().dir;
    // re-project the heading onto the tangent plane every frame: he is
    // flying over a sphere, so "forward" drifts out of plane as he moves
    if (!isaoHeading) {
      const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      isaoHeading = norm3(cross3(up, ref));
    }
    let h = sub3(isaoHeading, scale3(up, dot3(isaoHeading, up)));
    const hl = len3(h);
    h = hl > 1e-6 ? scale3(h, 1 / hl) : norm3(cross3(up, [0, 1, 0]));
    const steer = (host.keys.left ? 1 : 0) - (host.keys.right ? 1 : 0);
    if (steer) {
      // rotate the heading about the local up — Rodrigues, with the sin/cos
      // of a small angle, which is all a turn on a sphere ever needs
      const a = steer * ISAO_TURN * dt;
      const ca = Math.cos(a), sa = Math.sin(a);
      h = norm3(add3(scale3(h, ca), scale3(cross3(up, h), sa)));
    }
    isaoHeading = h;
    const drive = host.keys.fast ? 1 : host.keys.slow ? -0.6 : (host.throttle() !== 0 ? host.throttle() : 0);
    if (drive) {
      const step = ISAO_FLY * host.cellSide() * drive * dt;
      host.isao().dir = norm3(add3(host.isao().dir, scale3(h, step)));
      host.isao().loiter = host.isao().dir.slice();   // he holds where you left him
    }
    // ALTITUDE ON SPACE / SHIFT, held rather than tapped — a drone climbs
    // while you hold the stick. Q/E still step it discretely for anyone who
    // learned it that way.
    const climb = (host.keys.droneUp ? 1 : 0) - (host.keys.droneDown ? 1 : 0);
    if (climb) isaoAlt = Math.max(1.2, Math.min(9, isaoAlt + climb * ISAO_CLIMB * dt));
    // LEAN. A quadcopter does not translate flat: it tips into the direction
    // it is accelerating and rights itself when it stops. The lean EASES
    // toward the demand rather than snapping, which is most of why it reads
    // as a flying thing rather than a sliding one.
    const wantLean = drive * ISAO_LEAN;
    isaoLean += (wantLean - isaoLean) * Math.min(1, dt * 4.5);
    const wantRoll = -steer * ISAO_ROLL;
    isaoRoll += (wantRoll - isaoRoll) * Math.min(1, dt * 4.5);
    host.isao().obj.userData.spinRotors(dt, Math.abs(drive) * 0.8 + 0.2);
    if (host.isao().obj.userData.setFace) {
      host.isao().obj.userData.setFace(drive ? 'focused' : 'curious');
      host.isao().obj.userData.tickFace(dt);
    }
    placeIsao();
  }

  // ONE STATE MACHINE, ANY NUMBER OF WORKERS (operator, 2026-09-02: "another
  // Drone, assists Isao"). This body was updateIsao's, written against the
  // singleton; it now takes the worker it drives. isao is workers()[0] and
  // every camera / face / probe site that names him is untouched.
  function stepWorker(w, dt) {
    const speed = ISAO_CELLS_SEC * host.cellSide();   // radians per second
    if (w.state === 'idle') {
      // CLAIM THE FIRST ORDER NOBODY HAS. With two workers on one FIFO this
      // is the whole change: the queue stays the queue, each drone takes the
      // oldest unclaimed job, and the order carries its worker so finishing
      // and cancelling can find the right one.
      const free = orders.find((o) => !o.worker && o.kind !== 'receive') ?? orders.find((o) => !o.worker);   /* a part to receive waits for every print */
      if (free) {
        free.worker = w;
        w.order = free;
        w.state = 'travel'; w.assistAt = null;
      } else {
        // LOITER. He does not park: he drifts a couple of cells around the
        // heart, which is what makes him read as a machine on shift rather
        // than a prop bolted to the sky.
        const hd = norm3(w.assistAt ?? host.graph().centers[host.dungeon().heart]);   // or the foundry he is tending on landing
        if (dot3(w.dir, w.loiter) > 0.99999 || dist3(w.loiter, hd) < 1e-9) {
          const a = host.t() * 0.37;
          const ref = Math.abs(hd[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          const t1 = norm3(cross3(hd, ref));
          const t2 = cross3(hd, t1);
          const off = host.cellSide() * 2.2;
          w.loiter = norm3(add3(hd,
            add3(scale3(t1, Math.cos(a) * off), scale3(t2, Math.sin(a) * off))));
        }
        w.dir = stepDir(w.dir, w.loiter, speed * 0.35 * dt);
      }
    }
    if (w.state === 'travel' && w.order?.kind === 'receive' && orders.some((o) => !o.worker && o.kind !== 'receive')) { w.order.worker = null; w.order = null; w.state = 'idle'; } /* a print ordered while he flies to the crate takes him off it; the crate keeps waiting */ if (w.state === 'travel' && w.order) {
      const target = norm3(host.graph().centers[w.order.ci]);
      w.dir = stepDir(w.dir, target, speed * dt);
      if (dot3(w.dir, target) > 0.99995) {
        w.state = 'build';
        w.dur = w.order.seconds ?? buildSeconds(w.order.cost);
        w.t = (w.order.head ?? 0) * w.dur;
        w.shown = -1;
        if (w.order.kind === 'tower') {
          // the print: the tower itself grows out of the wall top. Built here rather than at order time so a queued site costs
          // nothing but a ring of points.
          const g = buildTowerLook(host.params.towerLook, w.order.def); printGhost(g, w.order.def.color);   // printed in wireframe (src/fx/tower-print.js)
          w.order.ghost = g;
          host.scene.add(g);
        }
      }
    } else if (w.state === 'build' && w.order) {
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      const g = w.order.ghost; if (w.order.step) host.story()?.print.progress(w.order.step, k); else if (w.order.repair?.kind === 'gate') host.sectorRun()?.repairGateTo(k, w.order.repair.id ?? 'gate');   /* a structure rises with the print; the gate's own percentage climbs with it */
      if (g) { host.placeTowerObj({ obj: g, ci: w.order.ci, tier: 0, def: w.order.def }); g.userData.print?.set(k); }   // at the sentry's own size and perch, the wireframe rising with the print
      const step = Math.floor(k * (w.order.step?.readout ? 100 : 10));   /* a step read on the HUD (src/fx/build-readout.js) counts by the percent */
      if (step !== w.shown) { w.shown = step; host.updateHud(); }
      if (w.t >= w.dur) finishOrder(w.order);
    }
  }

  function updateIsao(dt) {
    if (!host.isao()) return; if (host.isao().held) { lookIsao(host.isao(), dt); return; }   // a set piece has him (src/fx/isao-strike.js)
    // piloted: the queue waits, and so does everything else he does
    if (host.params.view === 'drone') { pilotIsao(dt); return; }
    isaoHeading = null;
    const speed = ISAO_CELLS_SEC * host.cellSide();   // radians per second
    for (const w of workers()) stepWorker(w, dt);
    if (host.assistant()) placeWorker(host.assistant());
    if (!host.isao()) return;
    const working = host.isao().state === 'build';
    lookIsao(host.isao(), dt);   // his face, rotors and work light (src/fx/isao-look.js; a shot runs it too, frozen)
    // the print beam: ONE line object, rewritten in place (activity must not add objects)
    if (working) {
      const noz = host.isao().obj.userData.nozzle;
      const a = new THREE.Vector3();
      if (noz) noz.getWorldPosition(a); else a.copy(host.isao().obj.position);
      const c = host.graph().centers[host.isao().order.ci];
      const top = 1 + host.params.wallHeight;
      if (!printBeam) {
        printBeam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position',
          new THREE.BufferAttribute(new Float32Array((PRINT_TRAIL + 2) * 3), 3)),
          new THREE.LineBasicMaterial({
            color: ISAO_TINT, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }));
        printBeam.frustumCulled = false;   // the buffer is rewritten; its bounds lie (it was culled off most prints)
        host.scene.add(printBeam);
      }
      // THE HEAD MOVES. A steady line from the nozzle to the cell's middle reads as a laser; a printer rasters, walks a perimeter and stops
      // extruding while it travels (printpath.js owns the three patterns and their cycle; this lays them on the cell's tangent plane). The
      // trail is sampled BACKWARDS along the same path, not remembered: deterministic, no state, and what makes a zigzag legible as one
      const { pattern, u } = printPhase(host.isao().t, patternSecsFor(host.isao().dur));
      const nrm = host.graph().normals[host.isao().order.ci];
      const [t1, t2] = tangentBasis(nrm);
      const R = host.cellSide() * 0.38;
      const bed = host.isao().order.bed ? (uu) => host.isao().order.bed(...printOffset(pattern, uu), host.isao().t / host.isao().dur) : (uu) => {   /* a structure's bed is its whole plot at the rising print height */
        const [ox, oy] = printOffset(pattern, uu);
        return [0, 1, 2].map((i) =>
          c[i] * top + t1[i] * ox * R + t2[i] * oy * R);
      };
      const pa = printBeam.geometry.attributes.position;
      pa.setXYZ(0, a.x, a.y, a.z);            // the nozzle
      for (let k = 0; k <= PRINT_TRAIL; k++) {
        // clamped at 0 so a trail never wraps into the previous pattern
        const p = bed(Math.max(0, u - k * PRINT_TRAIL_STEP));
        pa.setXYZ(k + 1, p[0], p[1], p[2]);
      }
      pa.needsUpdate = true;
      // the gaps are the point: a nozzle that never stops extruding is a
      // laser again. Retractions at the raster turnarounds, and the whole
      // third pattern is travel moves.
      printBeam.visible = printOn(pattern, u);
      // a printer's flow is not steady; the flicker is deterministic
      printBeam.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(host.isao().t * 21));
    } else if (printBeam) printBeam.visible = false;
    placeIsao();
  }
  return {
    orders,
    orderByCell,
    workers,
    spawnIsao,
    spawnAssistant,
    placeWorker,
    placeIsao,
    isaoPos,
    makeSiteRing,
    dropSiteRing,
    orderTower,
    orderUpgrade,
    cancelOrder,
    finishOrder,
    pilotIsao,
    stepWorker,
    updateIsao,
    alt: () => isaoAlt,
    setAlt: (v) => (isaoAlt = v),
    heading: () => isaoHeading,
  };
}
