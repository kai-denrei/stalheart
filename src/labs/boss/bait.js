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
// THE LINES: `bait_hurt` on his first and second hits, `bait_taunt` when a floor contact first comes within 25 m, `bait_death` when he
// first drops below 30 %, `bait_not_today` 2 s after `bait_death` if he is alive; one line every 4 s at most (`bait_not_today` follows
// `bait_death` on its own clock), each once a round (`bait_hurt` twice). Through the game's Isao voice when the export has the trigger
// (src/fx/isao-voice.js), else the text as a caption on the stage.
//
// Positions are the lab's local metres [x, z]; the host gives the ground under a point and the frame there, so this file knows no planet.
import * as THREE from '../../../vendor/three.module.js';
import { makeBait, planBait, moveBait, hurtBait, baitCaught } from '../../domain/boss-bait.js';
import { lineOf, capture } from '../../domain/boss-fight.js';
import { makeIsaoDrone, preloadFabricator } from '../../units.js';
import { STORY_SCALE } from '../../content/story-defaults.js';
import { ISAO_TRIGGERS } from '../../content/isao-voice.js';
import { isaoSay } from '../../fx/isao-voice.js';

const ALTITUDE = 4;        // the lab's default flying height, metres (the knob's range is the panel's)
const CLIMB = 8;           // metres a second his altitude eases toward the knob
const TAUNT_AT = 25;       // a floor contact this close first draws his taunt
const DEATH_SHARE = 0.3;   // below this share of his hit points, his line of death
const NOT_TODAY = 2;       // seconds after that line, if he is alive
const GAP = 4;             // seconds between two lines at the least
const LOW = 0.25;          // the row's amber, as the creature's bar
const LINES = {
  hurt1: { id: 'bait_hurt', text: "It's just a flesh wound." },
  hurt2: { id: 'bait_hurt', text: 'This is but a scratch.' },
  taunt: { id: 'bait_taunt', text: 'Come at me, bro!' },
  death: { id: 'bait_death', text: 'What do we say to death?' },
  notToday: { id: 'bait_not_today', text: 'Not today.' },
};
const CAPTION_SECONDS = 2;
const HOLD = 2.5;              // seconds a floor contact stays in the planner's picture of the creature after the foot lifts
const CELL = 2;              // metres: contacts closer than this share an entry of that picture
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// `stage` the lab's stage (the health row joins the round's `.sw-hud` in it, built first), `sphere` the planet-centred group the model
// lives in; `tune()` the lab's fight numbers (`.bait`), `fight()` the round's state, `now()` the lab's clock, `creature()` the rules'
// creature, `route(from, to)` the arena's waypoint, `ground(x, z)` the sphere-space point on the surface and `tangent(world)` the frame
// there ({ east, up, north }), `burst(x, z, alt)` Isao's end, `caption(text, seconds)` a line on the stage, `sfx` the sound engine
export function createBaitMode({ stage, sphere, tune, fight, now, creature, route, ground, tangent, burst, caption, sfx }) {
  const params = { altitude: ALTITUDE };
  const hud = stage.querySelector('.sw-hud');
  const row = document.createElement('div');
  row.className = 'ih-row ih-gate'; row.hidden = true;
  row.innerHTML = '<span class="ih-lbl">ISAO</span><span class="ih-bar"><i></i></span><span class="ih-num"></span>';
  hud.append(row);
  const fill = row.querySelector('i'), num = row.querySelector('.ih-num');

  let on = false, bait = null, alt = ALTITUDE, gone = false, model = null, disposed = false, drawn = '';
  let hits = 0, lastLineAt = -Infinity, deathAt = null, notTodayDone = false;
  const air = [0, 0, 0];                        // his place in sphere space
  const held = new Map();                       // cell -> { p, at }: the contacts of the last HOLD seconds, newest position per cell
  let view = null;                              // the creature as the planner sees it this frame
  const counted = new WeakSet();                // the streams that have touched him (one hit each, as the creature's burnt set)
  const due = { hurt1: false, hurt2: false, taunt: false, death: false };   // a line an event has called for and the gap has not yet let through
  const said = new Set();

  preloadFabricator().then((ok) => {
    if (!ok || disposed) return;
    const m = makeIsaoDrone();
    if (!m) return;
    m.scale.setScalar(STORY_SCALE.isaoMetres / 0.55); m.name = 'Isao'; m.visible = false;
    sphere.add(m); model = m; place();
  }).catch(() => { /* the rules run without the model */ });

  const basis = new THREE.Matrix4(), turnQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  // the model on the ground under him, `alt` metres up, facing the way he flies (yaw 0 is +z, as the tank's)
  function place() {
    if (!bait) return;
    const w = ground(bait.pos[0], bait.pos[1]), tf = tangent(w);
    for (let i = 0; i < 3; i++) air[i] = w[i] + tf.up[i] * alt;
    if (!model) return;
    model.position.set(air[0], air[1], air[2]);
    model.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    model.quaternion.multiply(turnQ.setFromAxisAngle(Y, Math.PI / 2 - bait.heading));
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

  function say(key) {
    const line = LINES[key];
    lastLineAt = now(); said.add(key);
    if (ISAO_TRIGGERS[line.id] && isaoSay(sfx, line.id, { force: true })) return;   // recorded: his own voice
    caption(line.text, CAPTION_SECONDS);
  }
  function lines() {
    const t = now();
    if (deathAt !== null && bait.hp > 0 && !notTodayDone && t - deathAt >= NOT_TODAY) { notTodayDone = true; say('notToday'); return; }
    if (t - lastLineAt < GAP) return;
    for (const key of ['death', 'hurt1', 'hurt2', 'taunt']) if (due[key] && !said.has(key)) {
      if (key === 'death') deathAt = t;
      say(key); return;
    }
  }

  function hit() { hits++; if (hits === 1) due.hurt1 = true; else if (hits === 2) due.hurt2 = true; }

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

  return {
    params,
    // the mode switch: off hides him; the lab starts a round after it (`reset`)
    setOn(v) { on = !!v; if (model) model.visible = on && !!bait && !gone; draw(); },
    active: () => on,
    has: () => !!bait,
    gone: () => gone,
    // a new round: Isao at `at`, hit points whole, facing the creature; no line spoken, none due
    reset(at) {
      const T = tune(), c = creature();
      bait = makeBait(at, T);
      bait.heading = Math.atan2(c.centre[1] - at[1], c.centre[0] - at[0]);
      alt = params.altitude; gone = false; hits = 0; lastLineAt = -Infinity; deathAt = null; notTodayDone = false;
      held.clear(); view = null;
      said.clear(); for (const k of Object.keys(due)) due[k] = false;
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
      const T = tune();
      if (fight().phase === 'fight') {
        view = heldView(creature());
        const want = planBait(bait, view, T);
        moveBait(bait, dt, route(bait.pos, want), T);
      }
      alt += Math.max(-CLIMB * dt, Math.min(CLIMB * dt, params.altitude - alt));
      place();
    },
    // a landing the friendlies resolved, or a stream's burn for dt seconds, on him; only in a running fight, and only what touches counts
    hurt(plan) {
      if (!on || !bait || gone || fight().phase !== 'fight') return 0;
      const dealt = hurtBait(bait, plan, 0);
      if (dealt > 0) hit();
      return dealt;
    },
    burn(plan, dt) {
      if (!on || !bait || gone || fight().phase !== 'fight') return 0;
      const dealt = hurtBait(bait, plan, dt);
      if (dealt > 0 && !counted.has(plan)) { counted.add(plan); hit(); }
      return dealt;
    },
    // after the round's tick: the end of the round if he is downed or taken, the lines, the row
    tick(dt) {
      if (!on || !bait) { draw(); return; }
      const s = fight();
      // downed is downed whatever the phase: a shared frame (the MK-9 finishing both) leaves the round KILLED, and he still goes in his burst
      if (bait.hp <= 0 && !gone) { capture(s, 'Isao down'); vanish(); }   // `capture` is a no-op outside a running fight
      else if (s.phase === 'fight' && !gone) {
        const T = tune(), c = creature();
        if (baitCaught(bait, c, dt, T)) { capture(s, 'Isao taken'); vanish(); }
        else {
          if (bait.hp / bait.max < DEATH_SHARE) due.death = true;
          if (!due.taunt && (c.contacts ?? []).some((p) => dist(p, bait.pos) < TAUNT_AT)) due.taunt = true;
          lines();
        }
      }
      draw();
    },
    // the KILLED card's addition: his hit points, or `Isao down` when the same blow that killed the creature downed him (a pyrrhic win, still KILLED)
    cardText: () => (on && bait ? (bait.hp <= 0 ? ' · Isao down' : ` · Isao ${Math.ceil(bait.hp)}/${bait.max}`) : ''),
    // the handle's view, and the gap to the creature's front edge along the line toward him
    state() {
      if (!bait) return null;
      const c = creature(), here = lineOf(view ?? c, bait);
      return { pos: [...bait.pos], hp: bait.hp, max: bait.max, heading: bait.heading, alt, gone, fleeing: bait.fleeing, gap: dist(bait.pos, c.centre) - here.e, hits, said: [...said] };   // gap: against the held edge
    },
    dispose() {
      disposed = true; row.remove();
      if (model) { sphere.remove(model); model = null; }   // the geometry is the shared unit cache's: not disposed
    },
  };
}
