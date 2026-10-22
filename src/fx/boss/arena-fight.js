// arena-fight.js — THE ARENA'S FIGHT ON THE LAB'S ENGINE (owner, 2026-10-23: "the Nih-Dairia fight; there is a well-tuned version in the lab and we keep reproducing
// something that does not work ... b) nih-dairia aggro is different, c) the whole idea is the monster aggro on the tank, acting as a lure, and it leaves time for the
// player to use the gunship to hit it, d) it should stay in the arena, e) the gameplay is that it tries to aggro on the tank, but fears the 40mm, so the gunship fires
// 40mm between the boss and the auto-moving tank, leaving room for a clean nuke"; spec docs/superpowers/specs/2026-10-23-arena-lab-fight-design.md, decisions 3-4).
//
// THE BODY OWNS HER POSITION. src/fx/boss-run.js makes one of these for THE ARENA's boss once her body is made (src/fx/creature-reed.js body()) and steps it each frame
// of the boss phase: it runs the lab's own fear per gun (./fear.js, gunFear on: the 25 mm's barrage meter, the 40 mm's wild flight, the MK-9's panic) and the lab's
// own temperament (./temperament.js: the lunges and the flight's speed written into the kit's live settings over the base the kit was made with), and returns the
// point her body hunts (the record's `bodyAim`): the hull's point, the fear's flee point, her own centre while stunned, the arena's centre while she stands on the
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
import { createFear } from './fear.js';
import { createTemperament } from './temperament.js';
import { TEMPERAMENT_KEYS } from '../../domain/boss-temperament.js';
import { surfaceFrame, toPlane, fromPlane } from '../../domain/surface-projection.js';
import { clampTo } from '../../domain/boss-arena.js';
import { BOSS_FIGHT } from '../../content/boss-fight.js';
import { GUNSHIP_GUNS, GUNSHIP_PLATFORM } from '../../content/gunship.js';

const SPEED_WINDOW = 1;   // seconds: a speed is the displacement over this long
const KIND = { rotary: 'rotary', bofors: 'bofors', heavy: 'nuke' };

// `now()` the game's clock (seconds), `tune` the fight's numbers (BOSS_FIGHT), `seed` the temperament's lunges
export function createArenaFight({ now, tune = BOSS_FIGHT, seed = 1 }) {
  const T = { ...tune, gunFear: { ...tune.gunFear, nuke: { ...tune.gunFear.nuke, stun: tune.nuke.stun } } };   // THE STUN, above
  let body = null, frame = null, frameAt = null, R = 1, base = null, shape = null, hull = [0, 0], ground = false, alive = false, stunned = false, mode = 'hunt', aimNow = null;
  const marks = [], hullMarks = [];
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
      mode = ground ? 'ground' : r.mode;
      if (r.mode === 'stun') { stunned = true; m.active = false; } else if (stunned) { stunned = false; m.active = true; }
      const want = ground ? [0, 0] : r.mode === 'stun' ? c : r.mode === 'flee' ? r.point : hull;
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
        hullSpeed: +hullSpeed.toFixed(2), hullMean: hullN ? +(hullSum / hullN).toFixed(2) : 0, aim: aimNow ? aimNow.map((v) => +v.toFixed(1)) : null };
    },
  };
}
