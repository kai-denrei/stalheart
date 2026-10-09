// bait.js — the boss lab's bait mode (2026-10-09; spec docs/superpowers/specs/2026-10-09-boss-bait-mode-design.md, Task 2): Isao the drone
// flies low on autopilot as the creature's prey, twelve hit points on a bar under the creature's, his lines as captions until they are
// recorded. The rules are src/domain/boss-bait.js (the autopilot's plan and move, the falloff, the hold that takes him); this file
// wires them to the lab: his model, his routing round the obstacles, the health row, the LOST cards and the line triggers.
//
// THE MODE is the lab's (`setOn`); off, nothing here moves, draws or speaks. ISAO'S GROUND POINT is the creature's target (the lab
// writes it through the tank's own target writer); his altitude is the panel's knob (`params.altitude`, 4 m: flying low), eased toward
// the knob so a drag of it is a climb, not a jump. The domain's own altitude (the game's 3.4 wall-heights, 17.75 m) is content and untouched.
//
// THE HITS: the friendlies' landings and live streams reach `hurt(plan)` and `burn(plan, dt)` (the lab's hooks); both count only in a
// running fight. At zero the round is LOST `Isao down`; a floor contact within three metres for half a second is LOST `Isao taken`.
// Either way he goes in a burst and stays gone until the round's reset (`reset(at)` puts him back, hit points whole).
//
// THE EDGE HE KEEPS is the creature's recently grounded extremities, not this frame's: the soft body's feet lift and land, and the front
// edge (`lineOf`'s projection over the floor contacts) jumps by an arm's length when one does, which sent a planner that follows it
// lunging in and fleeing out. `heldView` keeps each contact for `HOLD` seconds after the foot is last down (the creature as the planner
// sees it); the hold on him (`baitCaught`) and the taunt read the real contacts.
//
// THE LINES (wave B, 2026-10-09: the chatter director, ./chatter.js and src/domain/boss-chatter.js: one line at a time, 6 s apart at least, the situational
// lines over the fly-over's chatter). The triggers, each a want the director weighs (BOSS_FIGHT.chatter.triggers the numbers): `hurt` on his first and second
// hits, `taunt` when a floor contact first comes within 25 m, `death` when he drops below 30 % (`notToday` follows it once he is still flying), `closeCall` a
// landing just outside his ring (within `closeRing` of its edge) or an escape from an arm that came within `closeEscape`, `help` pinned against the bound or
// an escape from under the creature, `barrage` a body node within `barrageNear` and no player fire for `barrageQuiet` s, `useForty` no 40 mm for `fortyQuiet` s
// with a node within `fortyNear`, `nukeCareful` the MK-9 selected or aimed with him inside its ring, `nukeFace` an MK-9 landing within `faceNear` he survives,
// `flyover` a hop's start (one hop in three; a forced hop always asks), `stagger` the lab's (the round's first 40 mm fright, `want`). The player's fire comes
// from the seat (`gunner()`: { gun, reticle, shotAt, fortyAt } or null).
//
// NUKE CLEAR (wave B: "create an opportunity for a clean nuke"): at the end of his row, lit while he is beyond the MK-9's radius plus `nukeClear` metres from the
// creature's centre, grey otherwise; shown while he flies in a running round.
//
// THE ARENA AND THE FEEL (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, items 1 and 3): the routed wanted point is
// held inside the bound (`clamp`, the arena's, `bounds.radius - bounds.baitMargin`); the flight is the domain's erratic one (`bait.erratic`,
// the panel's `Isao erratic`), seeded by the round's seed, and its `bob` is added to his altitude.
//
// THE FLY-OVER (owner, 2026-10-09: "Isao gets stuck between an invisible wall (the boundaries) and the creature too often. once in a while have
// Isao fly OVER it"): the domain's `hopBait` runs before the autopilot each frame of a running fight, on the real contacts and the bound (`bound()`,
// the arena's disc with Isao's margin; null with the bound off). While a hop flies, his altitude is the hop's (no bob, no ease to the knob) and the
// autopilot rests; the creature's target is still his ground point. The hop's start asks for `flyover` (above). `hop()` forces one (the acceptance's). Under the creature (owner,
// 2026-10-09: "Isao gets stuck too easily under the creature") the domain's escape hop takes him up and out at once.
//
// THE REACH ENVELOPE (owner's predator, 2026-10-09: its arms sweep to about 90 m, and the keep from the floor contacts had him escaping from under them
// all the time): the planner's creature carries the body's nodes (`nodes()`, every node in local metres, the arms with the feet), so the domain keeps him
// `keep` beyond the outermost node toward him, smoothed over a second, and panics on the nodes near the ground (`envelopeBait`, `planBait`). After the
// move his ground point is held inside the bound itself (`hold`): a jink off a wanted point on the circle could carry him out.
//
// ISAO'S CAMERA (owner, 2026-10-09: "the camera still says 'ground truth/impact', it is not the POV of Isao"; a quadcopter that can fly away while looking
// straight at the creature): his body faces the creature's centre (`face`, eased at the autopilot's `turn` rad/s) whatever way he flies (`heading`, the
// domain's, stays the flight's), and `cam(aim)` is the GROUND TRUTH monitor's eye on his nose, NOSE metres ahead of his origin along his facing and UNDER
// metres under it (his body behind and above the lens), looking at `aim` along his facing's azimuth at the true pitch, never steeper than PITCH from the
// horizon. The monitor's camera keeps the planet's up, so a look straight down leaves its roll to the look's azimuth: the bearing to the creature flips as a
// hop crosses over it, and the picture would spin; the facing turns at `turn` rad/s, and so does the picture.
//
// Positions are the lab's local metres [x, z]; the host gives the ground under a point and the frame there, so this file knows no planet.
import * as THREE from '../../../vendor/three.module.js';
import { makeBait, planBait, moveBait, hurtBait, baitCaught, hopBait, startHop, envelopeBait, reachOf } from '../../domain/boss-bait.js';
import { lineOf, capture } from '../../domain/boss-fight.js';
import { makeIsaoDrone, preloadFabricator } from '../../units.js';
import { STORY_SCALE } from '../../content/story-defaults.js';
import { createChatter } from './chatter.js';

const ALTITUDE = 4;        // the lab's default flying height, metres (the knob's range is the panel's)
const CLIMB = 8;           // metres a second his altitude eases toward the knob
const TAUNT_AT = 25;       // a floor contact this close first draws his taunt
const DEATH_SHARE = 0.3;   // below this share of his hit points, his line of death
const LOW = 0.25;          // the row's amber, as the creature's bar
const HOLD = 2.5;              // seconds a floor contact stays in the planner's picture of the creature after the foot lifts
const CELL = 2;              // metres: contacts closer than this share an entry of that picture
const NOSE = 1.5;            // metres: the camera ahead of his origin along his facing (his body is within 1.4 m of it)
const UNDER = 0.3;           // metres: and under it
const PITCH = 80 * Math.PI / 180;   // the camera's look is never steeper than this from the horizon
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const wrap = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

// `stage` the lab's stage (the health row joins the round's `.sw-hud` in it, built first), `sphere` the planet-centred group the model
// lives in; `tune()` the lab's fight numbers (`.bait`), `fight()` the round's state, `now()` the lab's clock, `creature()` the rules'
// creature, `route(from, to)` the arena's waypoint, `ground(x, z)` the sphere-space point on the surface and `tangent(world)` the frame
// there ({ east, up, north }), `burst(x, z, alt)` Isao's end, `caption(text, seconds)` a line on the stage, `sfx` the sound engine,
// `clamp(point)` the wanted point held inside the arena's bound (a fresh array), `hold(point)` his ground point held inside the bound itself (a fresh
// array), `bound()` the bound for the fly-over ({ at, radius, inset } or null), `nodes()` the body's nodes ([x, z, height] local metres) for the reach envelope,
// `gunner()` the seat's fire for the lines ({ gun, reticle, shotAt, fortyAt } or null)
export function createBaitMode({ stage, sphere, tune, fight, now, creature, route, ground, tangent, burst, caption, sfx, clamp = (p) => [p[0], p[1]], hold = (p) => [p[0], p[1]], bound = () => null, nodes = () => [], gunner = () => null }) {
  const params = { altitude: ALTITUDE };
  const hud = stage.querySelector('.sw-hud');
  const row = document.createElement('div');
  row.className = 'ih-row ih-gate'; row.hidden = true;
  row.innerHTML = '<span class="ih-lbl">ISAO</span><span class="ih-bar"><i></i></span><span class="ih-num"></span>';
  const cue = document.createElement('span');   // NUKE CLEAR, at the end of his row (a row of its own would push the HUD onto the seat's panel)
  cue.className = 'nk-cue'; cue.hidden = true; cue.textContent = 'NUKE CLEAR';
  row.append(cue); hud.append(row);
  const fill = row.querySelector('i'), num = row.querySelector('.ih-num');
  const chatter = createChatter({ tune, now, sfx, caption });

  let on = false, bait = null, face = 0, alt = ALTITUDE, bob = 0, gone = false, model = null, disposed = false, drawn = '';
  let hits = 0, clear = false, cueKey = '', gunWas = null, quietFrom = 0, escape = null, near = { low: Infinity, node: Infinity };
  const air = [0, 0, 0];                        // his place in sphere space
  const held = new Map();                       // cell -> { p, at }: the contacts of the last HOLD seconds, newest position per cell
  let view = null;                              // the creature as the planner sees it this frame
  const counted = new WeakSet();                // the streams that have touched him (one hit each, as the creature's burnt set)

  preloadFabricator().then((ok) => {
    if (!ok || disposed) return;
    const m = makeIsaoDrone();
    if (!m) return;
    m.scale.setScalar(STORY_SCALE.isaoMetres / 0.55); m.name = 'Isao'; m.visible = false;
    sphere.add(m); model = m; place();
  }).catch(() => { /* the rules run without the model */ });

  const basis = new THREE.Matrix4(), turnQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  // the model on the ground under him, `alt` metres up, facing the creature (`face`; yaw 0 is +z, as the tank's)
  function place() {
    if (!bait) return;
    const w = ground(bait.pos[0], bait.pos[1]), tf = tangent(w);
    for (let i = 0; i < 3; i++) air[i] = w[i] + tf.up[i] * (alt + bob);
    if (!model) return;
    model.position.set(air[0], air[1], air[2]);
    model.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    model.quaternion.multiply(turnQ.setFromAxisAngle(Y, Math.PI / 2 - face));
    model.visible = on && !gone;
  }

  // the creature with its contacts held (see above); `c` the rules' creature now
  function heldView(c) {
    const t = now();
    for (const p of c.contacts ?? []) {
      const key = `${Math.round(p[0] / CELL)},${Math.round(p[1] / CELL)}`, e = held.get(key);
      if (e) { e.p[0] = p[0]; e.p[1] = p[1]; e.at = t; } else held.set(key, { p: [p[0], p[1]], at: t });
    }
    const contacts = [];
    for (const [key, e] of held) { if (t - e.at > HOLD) held.delete(key); else contacts.push(e.p); }
    return { ...c, contacts };
  }

  // the nearest arm near the ground (a floor contact, or a body node under `panicHeight`) and the nearest body node at any height, from his ground point
  function nearest(c, list) {
    const T = tune(), at = bait.pos;
    let low = Infinity, node = Infinity;
    for (const p of c.contacts ?? []) low = Math.min(low, dist(p, at));
    for (const p of list) { const d = dist(p, at); node = Math.min(node, d); if (p[2] < T.bait.panicHeight) low = Math.min(low, d); }
    near = { low, node: Math.min(node, low) };
  }
  // a landing or a stream's round at `plan.at`: a close call just outside his ring; an MK-9 he survives within `faceNear` is in his face
  function landingLines(plan) {
    const K = tune().chatter.triggers, d = dist(bait.pos, plan.at);
    if (d >= plan.radius && d <= plan.radius + K.closeRing) chatter.want('closeCall');
    if (plan.kind === 'nuke' && d <= K.faceNear && bait.hp > 0) chatter.want('nukeFace');
  }
  // the lines a frame asks for in a running round (the events' own are asked where they happen)
  function lines(c) {
    const T = tune(), K = T.chatter.triggers, t = now(), g = gunner();
    if (bait.hp / bait.max < DEATH_SHARE) chatter.want('death');
    if ((c.contacts ?? []).some((p) => dist(p, bait.pos) < TAUNT_AT)) chatter.want('taunt');
    if (bait.trapT >= T.bait.trapFor / 2) chatter.want('help');
    if (g) {
      const shot = Math.max(quietFrom, g.shotAt ?? -Infinity), forty = Math.max(quietFrom, g.fortyAt ?? -Infinity);
      if (near.node <= K.barrageNear && t - shot >= K.barrageQuiet) chatter.want('barrage');
      if (near.node <= K.fortyNear && t - forty >= K.fortyQuiet) chatter.want('useForty');
      if (g.gun === 'nuke' && (gunWas !== 'nuke' || (g.reticle && dist(g.reticle, bait.pos) <= T.nuke.radius))) chatter.want('nukeCareful');
      gunWas = g.gun;
    }
    chatter.tick();
  }

  function hit() { hits++; if (hits <= 2) chatter.want('hurt'); }
  // a hop's start: the fly-over's line (one hop in three; `force` the acceptance's forced hop); an escape from under the creature asks for help as well
  function flyover(force = false) { if (bait.hop?.why === 'under') chatter.want('help'); chatter.want('flyover', { force }); }

  function vanish() {
    gone = true;
    if (model) model.visible = false;
    burst(bait.pos[0], bait.pos[1], alt);
  }

  function draw() {
    const share = bait && bait.max > 0 ? Math.max(0, bait.hp / bait.max) : 0, key = `${Math.round(share * 1000)}|${on}`;
    if (key === drawn) return;
    drawn = key;
    row.hidden = !on;
    fill.style.width = `${(share * 100).toFixed(1)}%`;
    num.textContent = `${Math.ceil(bait?.hp ?? 0)}/${bait?.max ?? 0}`;
    row.classList.toggle('ih-low', share <= LOW);
  }
  // the NUKE CLEAR cue: shown while he flies in a running round, lit beyond the MK-9's radius plus `nukeClear` from the creature's centre
  function drawCue(show) {
    const T = tune();
    clear = show && dist(bait.pos, creature().centre) > T.nuke.radius + T.nukeClear;
    const key = `${show}|${clear}`;
    if (key === cueKey) return;
    cueKey = key; cue.hidden = !show; cue.classList.toggle('nk-on', clear);
  }

  return {
    params,
    // the mode switch: off hides him; the lab starts a round after it (`reset`)
    setOn(v) { on = !!v; if (model) model.visible = on && !!bait && !gone; draw(); if (!on) { cue.hidden = true; cueKey = ''; } },
    active: () => on,
    has: () => !!bait,
    gone: () => gone,
    // a new round: Isao at `at`, hit points whole, facing the creature; no line spoken, none due
    reset(at) {
      const T = tune(), c = creature();
      bait = makeBait(at, T, T.seed ?? 1);   // the round's seed: a round flies one way
      bait.heading = Math.atan2(c.centre[1] - at[1], c.centre[0] - at[0]); face = bait.heading;
      alt = params.altitude; bob = 0; gone = false; hits = 0; gunWas = gunner()?.gun ?? null; quietFrom = now(); escape = null;
      held.clear(); view = null;
      chatter.reset(T.seed ?? 1);
      drawn = ''; place(); draw();
    },
    pos: () => (bait ? [...bait.pos] : null),
    // the rules' view of him as a target (the fear's line toward him): a point, no hull
    asTank: () => ({ pos: bait ? bait.pos : [1e9, 1e9], radius: 0 }),
    // his ground point in sphere space, for a re-anchored round that places him by where he stood
    groundWorld: () => (bait ? ground(bait.pos[0], bait.pos[1]) : null),
    air: () => [...air],
    // a re-anchor of the lab's frame moves every local position by the same vector
    shift(sx, sz) {
      if (bait) { bait.pos[0] += sx; bait.pos[1] += sz; }
      for (const e of held.values()) { e.p[0] += sx; e.p[1] += sz; }
    },
    // the autopilot, each frame of a running fight: plan, route round the obstacles, move; the altitude eases to the knob
    step(dt) {
      if (!on || !bait || gone) return;
      const T = tune(), cc = creature().centre;
      face += Math.max(-T.bait.turn * dt, Math.min(T.bait.turn * dt, wrap(Math.atan2(cc[1] - bait.pos[1], cc[0] - bait.pos[0]) - face)));   // his body toward the creature (ISAO'S CAMERA)
      if (fight().phase === 'fight') {
        const c = creature();
        view = { ...heldView(c), nodes: nodes() };   // the held contacts and every body node: the planner's reach envelope and panic
        envelopeBait(bait, view, dt, T);   // smoothed through the hops too, so the landing plans from the reach as it is
        const flying = hopBait(bait, dt, { ...c, nodes: view.nodes }, T, { bound: bound(), alt, base: params.altitude });   // the fly-over first: trapped, at random, or flying (its goal beyond the reach envelope)
        if (flying) { alt = flying.alt; bob = 0; if (flying.started) flyover(); escape = null; }
        else {
          const want = planBait(bait, view, T);
          ({ bob } = moveBait(bait, dt, clamp(route(bait.pos, want)), T));
          const kept = hold(bait.pos); bait.pos[0] = kept[0]; bait.pos[1] = kept[1];   // a jink off a wanted point on the circle does not carry him out
        }
        nearest(c, view.nodes);
        // an escape from an arm: the nearest low arm through a panic; under `closeEscape` it was a close call once the panic ends with him flying
        if (bait.fleeing) escape = Math.min(escape ?? Infinity, near.low);
        else if (escape !== null) { if (escape < T.chatter.triggers.closeEscape) chatter.want('closeCall'); escape = null; }
      }
      if (!bait.hop) alt += Math.max(-CLIMB * dt, Math.min(CLIMB * dt, params.altitude - alt));
      place();
    },
    // ISAO'S CAMERA (above): { from, pos } in sphere space, the monitor's eye and the point it looks at; `aim` the creature's point (sphere space); null while he
    // is not in the sky
    cam(aim) {
      if (!on || !bait || gone) return null;
      const tf = tangent(ground(bait.pos[0], bait.pos[1])), u = tf.up, cf = Math.cos(face), sf = Math.sin(face), from = [0, 0, 0], d = [0, 0, 0], f = [0, 0, 0];
      for (let i = 0; i < 3; i++) { f[i] = tf.east[i] * cf + tf.north[i] * sf; from[i] = air[i] + f[i] * NOSE - u[i] * UNDER; d[i] = aim[i] - from[i]; }
      const dv = d[0] * u[0] + d[1] * u[1] + d[2] * u[2], dh = Math.max(Math.hypot(d[0] - dv * u[0], d[1] - dv * u[1], d[2] - dv * u[2]), Math.abs(dv) / Math.tan(PITCH));
      return { from, pos: [0, 1, 2].map((i) => from[i] + f[i] * dh + u[i] * dv) };
    },
    // a fly-over now, from where he is (the acceptance's): false while one flies or he is gone
    hop() {
      if (!on || !bait || gone || bait.hop || fight().phase !== 'fight') return false;
      startHop(bait, creature(), tune(), 'forced', alt, bound()); flyover(true);
      return true;
    },
    // Isao put at a ground point (local metres) as he flies, the round going on: the acceptance's case of him under the creature
    putAt(at) {
      if (!on || !bait || gone) return false;
      bait.pos[0] = at[0]; bait.pos[1] = at[1]; bait.held = 0; place();
      return true;
    },
    // a landing the friendlies resolved, or a stream's burn for dt seconds, on him; only in a running fight, and only what touches counts
    hurt(plan) {
      if (!on || !bait || gone || fight().phase !== 'fight') return 0;
      const dealt = hurtBait(bait, plan, 0);
      if (dealt > 0) hit();
      landingLines(plan);
      return dealt;
    },
    burn(plan, dt) {
      if (!on || !bait || gone || fight().phase !== 'fight') return 0;
      const dealt = hurtBait(bait, plan, dt);
      if (dealt > 0 && !counted.has(plan)) { counted.add(plan); hit(); }
      landingLines(plan);
      return dealt;
    },
    // after the round's tick: the end of the round if he is downed or taken, the lines, the row
    tick(dt) {
      if (!on || !bait) { draw(); return; }
      const s = fight();
      drawCue(s.phase === 'fight' && !gone && bait.hp > 0);
      // downed is downed whatever the phase: a shared frame (the MK-9 finishing both) leaves the round KILLED, and he still goes in his burst
      if (bait.hp <= 0 && !gone) { capture(s, 'Isao down'); vanish(); }   // `capture` is a no-op outside a running fight
      else if (s.phase === 'fight' && !gone) {
        const T = tune(), c = creature();
        if (baitCaught(bait, c, dt, T)) { capture(s, 'Isao taken'); vanish(); }
        else lines(c);
      }
      draw();
    },
    // the KILLED card's addition: his hit points, or `Isao down` when the same blow that killed the creature downed him (a pyrrhic win, still KILLED)
    cardText: () => (on && bait ? (bait.hp <= 0 ? ' · Isao down' : ` · Isao ${Math.ceil(bait.hp)}/${bait.max}`) : ''),
    // what the gunner's optic marks: his place in the air (sphere space) and his hit points; null when he is not in the sky
    marker: () => (on && bait && !gone ? { air: [...air], hp: bait.hp, max: bait.max } : null),
    // the handle's view, and the gap to the creature's front edge along the line toward him
    state() {
      if (!bait) return null;
      const c = creature(), here = lineOf(view ?? c, bait), rho = dist(bait.pos, c.centre), reach = reachOf({ ...c, nodes: nodes() }, bait.pos).e;
      return { pos: [...bait.pos], hp: bait.hp, max: bait.max, heading: bait.heading, facing: face, alt, bob, speed: bait.flight?.speed ?? null, gone, fleeing: bait.fleeing, gap: rho - here.e, hits, said: chatter.said(),
        lines: chatter.log(), nukeClear: clear, cue: !cue.hidden, near: { ...near },   // the run's lines ({ key, variant, at, via }), the NUKE CLEAR cue (lit, shown), the nearest low arm and body node (m)
        hop: bait.hop?.phase ?? null, hopWhy: bait.hop?.why ?? null, hops: bait.hops, trapped: bait.trapT,
        // the reach envelope: `reach` the outermost node toward him now, `envelope` the planner's smoothed one; `keep` his distance beyond `reach`, `keepSmoothed` beyond `envelope`
        reach, envelope: bait.reach?.e ?? null, keep: rho - reach, keepSmoothed: bait.reach ? rho - bait.reach.e : null };   // gap: against the held edge; hop: the fly-over's phase
    },
    // a line asked for by the lab (the round's first 40 mm fright: `stagger`)
    want: (key, o) => chatter.want(key, o),
    dispose() {
      disposed = true; row.remove();
      if (model) { sphere.remove(model); model = null; }   // the geometry is the shared unit cache's: not disposed
    },
  };
}
