// arena-fight.js — THE ARENA'S FIGHT ON THE LAB'S ENGINE (owner, 2026-10-23: "the Nih-Dairia fight; there is a well-tuned version in the lab and we keep reproducing
// something that does not work ... b) nih-dairia aggro is different, c) the whole idea is the monster aggro on the tank, acting as a lure, and it leaves time for the
// player to use the gunship to hit it, d) it should stay in the arena, e) the gameplay is that it tries to aggro on the tank, but fears the 40mm, so the gunship fires
// 40mm between the boss and the auto-moving tank, leaving room for a clean nuke"; spec docs/superpowers/specs/2026-10-23-arena-lab-fight-design.md, decisions 3-4).
//
// THE BODY OWNS HER POSITION. src/fx/boss-run.js makes one of these for THE ARENA's boss once her body is made (src/fx/creature-reed.js body()) and steps it each frame
// of the boss phase: it runs the lab's own fear per gun (./fear.js, gunFear on: the 25 mm's barrage meter, the 40 mm's wild flight, the MK-9's panic) and the lab's
// own temperament (./temperament.js: the lunges and the flight's speed written into the kit's live settings over the base the kit was made with), and returns the
// point her body hunts (the record's `bodyAim`): the hull's point (pulled BOSS_FIGHT.arenaBoss.keep m back toward her: she stalks it, see the content), the fear's flee point, her own centre while stunned, the arena's centre while she stands on the
// sinkhole (`ground`), clamped to the disc's radius less BOSS_FIGHT.bounds.creatureMargin. The kit pursues it at its own (the predator preset's) speed; the record
// takes its point from the body (src/fx/enemy-step.js ledPoint).
//
// ONE PLANE. Everything is in local metres on the arena's own plane: the azimuthal-equidistant projection round the arena's cell (src/domain/surface-projection.js),
// `R` the planet's metres a world unit; the body's contacts and nodes are mapped into it through its own frame (body.shape(toLocal)). The disc is 120 m round a
// planet several kilometres round, so the projection's stretch there is nothing the fight can see.
//
// THE STUN. The lab's bait mode panics on the MK-9 with no stun (gunFear.nuke.stun 0); the arena keeps note 8c's stun (owner, 2026-10-18: "launch big nuke, time it";
// BOSS_FIGHT.nuke.stun, 1.5 s, the old stunRecord's), so an MK-9 within reach holds her still (the kit's motion off) and the panic's flight follows it.
// THE SPEEDS. Her ground speed and the hull's, each its displacement over the last `SPEED_WINDOW` s, for the harness (the owner wants a kite, not a catch).
//
// THE KING (owner, 2026-11-12 night: "we tune the aggro of the King so that it aims for the mechs and the tank ... time the shells so they ... stop the King in its
// track and funnels it to a spot where a nuke is about to drop"; docs/DECISIONS.md "The arena fight"): made with `king` (src/content/arena-king.js ARENA_KING) and
// stepped with `targets` ([{ id, pos (unit point), attackedAt?, lure? }]: the hull and the standing Ridgebacks), its will is src/domain/king-fight.js stepKing: it
// stalks the chosen target `keep` short, tells (it holds, the kit's chase speed at its floor and the arms stretched toward the locked point), charges (the chase
// speed at ARENA_KING.charge.speed) and recovers; hits() hands the run the targets its charge reached since the last call. A 40 mm near its body staggers it
// (the kit's motion off) and veers it away from the burst (shellHit), instead of the lab's wild flight; the 25 mm's barrage and the MK-9's stun and panic are the lab's.
// Priority each frame: the sinkhole, the MK-9's stun, the stagger, the lab's flight, the King's will.
import { createFear } from './fear.js';
import { createTemperament } from './temperament.js';
import { TEMPERAMENT_KEYS } from '../../domain/boss-temperament.js';
import { surfaceFrame, toPlane, fromPlane } from '../../domain/surface-projection.js';
import { clampTo } from '../../domain/boss-arena.js';
import { BOSS_FIGHT } from '../../content/boss-fight.js';
import { GUNSHIP_GUNS, GUNSHIP_PLATFORM } from '../../content/gunship.js';
import { makeKing, stepKing, shellHit, nearBody } from '../../domain/king-fight.js';
import { MOTION_CONTROLS } from '../nih-dairia/motion-settings.js';

const LIMITS = Object.fromEntries(MOTION_CONTROLS.map((c) => [c.key, [c.min, c.max]]));
const lim = (k, v) => Math.min(LIMITS[k]?.[1] ?? v, Math.max(LIMITS[k]?.[0] ?? v, v));

const SPEED_WINDOW = 1;   // seconds: a speed is the displacement over this long
const KIND = { rotary: 'rotary', bofors: 'bofors', heavy: 'nuke' };
// the point `keep` metres from `h` on the line toward `c`: from farther she closes to it, from nearer she backs off to it (the third --arena-fight run: with the
// aim clamped at her own centre once she was inside `keep`, she stood on the hull pinned at the disc's rim, 1 cell off, for seconds)
const short = (h, c, keep) => { const dx = c[0] - h[0], dz = c[1] - h[1], d = Math.hypot(dx, dz); if (!(keep > 0)) return [h[0], h[1]]; if (d < 1e-9) return [c[0], c[1]]; return [h[0] + dx * keep / d, h[1] + dz * keep / d]; };

// `now()` the game's clock (seconds), `tune` the fight's numbers (BOSS_FIGHT), `seed` the temperament's lunges
export function createArenaFight({ now, tune = BOSS_FIGHT, seed = 1, king = null }) {
  const T = { ...tune, gunFear: { ...tune.gunFear, nuke: { ...tune.gunFear.nuke, stun: tune.nuke.stun } } };   // THE STUN, above
  let body = null, frame = null, frameAt = null, R = 1, base = null, shape = null, hull = [0, 0], ground = false, alive = false, stunned = false, mode = 'hunt', aimNow = null;
  const marks = [], hullMarks = [];
  const K = king ? makeKing() : null; let will = null, hits = [], held = false;   // THE KING: its state, this frame's will, the hits not yet handed over, the kit held still by the stagger
  let speed = 0, hullSpeed = 0, peak = 0, sum = 0, n = 0, hullSum = 0, hullN = 0;
  const local = (u) => toPlane(frame, u, R);
  const shapeNow = () => (shape ??= body.shape(local));
  const fear = createFear({
    tune: () => T, now, kit: () => body?.kit ?? null, on: () => alive && !ground, gunFear: () => true,
    creature: () => { const s = shapeNow(); return { centre: s.centre, get contacts() { return s.contacts; } }; },
    tank: () => ({ pos: hull, radius: T.hull.radius }), fight: () => ({ phase: 'fight' }), nodes: () => shapeNow().nodes,
  });
  const temperament = createTemperament({ tune: () => T, kit: () => body?.kit ?? null, base: () => base, on: () => alive });
  // a speed over the window from the marks (t, x, z); the marks older than it dropped but the one at its edge
  const speedOf = (list, t, p) => { list.push([t, p[0], p[1]]); while (list.length > 2 && list[1][0] <= t - SPEED_WINDOW) list.shift(); const a = list[0], dt = t - a[0]; return dt > 0.25 ? Math.hypot(p[0] - a[1], p[1] - a[2]) / dt : 0; };

  return {
    // one frame of the boss phase: `body` her body ({ kit, point, shape }), `centre` the arena's unit point, `R` metres a world unit, `hull` the hull's unit point,
    // `radius` the disc in metres, `ground` she still stands on the sinkhole. -> the unit point her body hunts
    step(dt, ctx) {
      body = ctx.body; R = ctx.R; ground = !!ctx.ground; alive = !!body?.kit; shape = null;
      if (!alive) return null;
      if (frameAt !== ctx.centre) { frame = surfaceFrame(ctx.centre); frameAt = ctx.centre; }
      if (!base) { base = {}; for (const k of TEMPERAMENT_KEYS) base[k] = body.kit.settings[k]; }   // the kit's own motion, the temperament's base
      hull = ctx.hull ? local(ctx.hull) : [1e9, 1e9];
      const t = now(), r = fear.step(t), m = body.kit.motion, c = shapeNow().centre;
      temperament.step(dt, r.flight);
      // THE KING'S WILL (above): its own clock is the game's; the targets in the plane
      will = K && !ground ? stepKing(K, { now: t, centre: c, targets: (ctx.targets ?? []).map((x) => ({ ...x, pos: local(x.pos) })) }, king) : null;
      if (will?.hits.length) hits.push(...will.hits);
      const kingMode = will?.mode ?? null, stagger = kingMode === 'stagger';
      mode = ground ? 'ground' : r.mode === 'stun' ? 'stun' : stagger ? 'stagger' : r.mode !== 'hunt' || !will ? r.mode : `king:${kingMode}`;
      if (r.mode === 'stun') { stunned = true; m.active = false; } else if (stunned) { stunned = false; m.active = true; }
      if (stagger && !stunned) { held = true; m.active = false; } else if (held) { held = false; if (!stunned) m.active = true; }
      // the tell: barely moving, the arms long toward the lock; the charge: the chase speed up (over what the temperament wrote this frame)
      if (will && r.mode === 'hunt' && kingMode === 'tell') { body.kit.settings.speed = lim('speed', 0); body.kit.settings.stretch = lim('stretch', (base.stretch ?? 1) * 1.5); }
      if (will && r.mode === 'hunt' && kingMode === 'charge') body.kit.settings.speed = lim('speed', king.charge.speed);
      const kingAim = will ? (kingMode === 'tell' ? will.lock ?? c : will.aim ?? c) : null;
      const want = ground ? [0, 0] : r.mode === 'stun' || stagger ? c : r.mode === 'flee' ? r.point : kingAim ?? short(hull, c, T.arenaBoss?.keep ?? 0);
      aimNow = clampTo(want, (ctx.radius ?? T.bounds.radius) - T.bounds.creatureMargin);
      if (dt > 0) {
        speed = speedOf(marks, t, c); peak = Math.max(peak, speed); if (speed > 0) { sum += speed; n++; }
        if (ctx.hull) { hullSpeed = speedOf(hullMarks, t, hull); if (hullSpeed > 0) { hullSum += hullSpeed; hullN++; } }
      }
      return fromPlane(frame, aimNow[0], aimNow[1], R);
    },
    // a gunship round landed at unit point `point` (the rig's every shell, src/fx/gunship-rig.js landed and blast): the 25 mm fills the barrage, the 40 mm sends her
    // wild, the MK-9 stuns her and panics her, each only within its blast + BOSS_FIGHT.fear.reach of a contact or a node. -> whether it scared or stunned her
    landed(gun, point) {
      const kind = KIND[gun], g = GUNSHIP_GUNS[gun];
      if (!kind || !point || !alive || !frame) return false;
      // THE KING: a 40 mm within its blast + the stagger's reach of the centre or a contact stops it and turns it (not the lab's wild flight); none on the sinkhole
      if (K && kind === 'bofors') { if (ground) return false; const at = local(point), s = shapeNow(); if (!nearBody(at, s.centre, s.contacts ?? [], (g?.blastCells ?? 0) * GUNSHIP_PLATFORM.metresPerCell + king.stagger.reach)) return false; shellHit(K, s.centre, at, now(), king); return true; }
      const before = fear.guns(), stuns0 = fear.counts().stuns, plan = { kind, radius: (g?.blastCells ?? 0) * GUNSHIP_PLATFORM.metresPerCell }, at = local(point);
      if (kind === 'rotary') fear.round(plan, at); else fear.landed(plan, at);
      const after = fear.guns();
      return after.flinch + after.wild + after.panic > before.flinch + before.wild + before.panic || fear.counts().stuns > stuns0;
    },
    // the harness's read: led, the mode (hunt, flee, stun, ground), the scares by level, the stuns, the barrage meter, the flight's level, the temperament's
    // phase and lunges, her speed and the hull's (m/s over the last second, their means over the fight and her peak), the aim in the arena's plane (m)
    state() {
      const g = fear.guns(), k = fear.counts(), tp = temperament.state();
      return { led: alive, mode, flinch: g.flinch, wild: g.wild, panic: g.panic, stuns: k.stuns, meter: +g.meter.toFixed(2), flight: g.flight?.level ?? null, stunned,
        temper: tp.phase, lunges: tp.lunges, speed: +speed.toFixed(2), speedMean: n ? +(sum / n).toFixed(2) : 0, speedPeak: +peak.toFixed(2),
        hullSpeed: +hullSpeed.toFixed(2), hullMean: hullN ? +(hullSum / hullN).toFixed(2) : 0, aim: aimNow ? aimNow.map((v) => +v.toFixed(1)) : null,
        ...(K ? { king: { mode: will?.mode ?? null, target: K.target, lock: K.lock ? K.lock.map((v) => +v.toFixed(1)) : null, staggers: K.staggers, veers: K.veers, tells: K.tells, charges: K.charges, resist: +K.resist.toFixed(2), veer: K.veer ? { from: K.veer.from.map((v) => +v.toFixed(1)), point: K.veer.point.map((v) => +v.toFixed(1)) } : null } } : {}) };
    },
    // THE KING: the targets its charge reached since the last call (ids), handed over once
    hits() { const out = hits; hits = []; return out; },
    // a unit point in the arena's plane (m), for the run's own geometry (the burst, the nuke)
    plane: (p) => (frame && p ? local(p) : null),
    centre: () => (alive && frame ? shapeNow().centre : null),
  };
}
