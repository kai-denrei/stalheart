import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createDiscoParty } from '../src/fx/disco-party.js';
import { DAY_42 } from '../src/content/day-42.js';
// a Stålheart with the diorama's joint names and a tip, and a ball with the ball's, both plain groups
function gantry() { const names = ['GANTRY_TRAVEL_Y', 'CARRIAGE_TRAVEL_X', 'TOOL_LIFT_Z', 'J1_BASE_YAW', 'J2_SHOULDER', 'J3_ELBOW', 'J4_FOREARM_ROLL', 'J5_WRIST_PITCH', 'J6_TOOL_ROLL', 'EXTRUSION_TIP']; const root = new THREE.Group(); let p = root; for (const n of names) { const g = new THREE.Group(); g.name = n; p.add(g); p = g; } p.position.set(0, 11.6, 2.6); root.userData.actions = { Terraforming_Cycle: { paused: false } }; return root; }
function ball() { const root = new THREE.Group(); root.name = 'DISCO_BALL_ROOT'; for (const n of ['DISCO_PENDULUM_PIVOT', 'DISCO_SPHERE_SPIN', 'LIGHT_HALO_YAW', 'LASER_RING_YAW', 'STANDALONE_CRADLE']) { const g = new THREE.Group(); g.name = n; root.add(g); } return root; }
function host(o = {}) {
  const log = { briefs: [], callouts: [], shots: [], played: [], primed: [], armed: 0, stopped: 0, ducked: [] }, scene = new THREE.Scene(), stal = gantry(); scene.add(stal);
  const music = { stop: () => { log.stopped++; } };
  const h = {
    scene, camera: new THREE.PerspectiveCamera(), metres: () => 1, loadGlb: async () => ({ scene: ball() }),
    sfx: { loop: (k) => { if (o.decoded && !o.decoded()) return null; log.played.push(k); return music; }, prime: (k) => { log.primed.push(k); return Promise.resolve(true); }, play: (k) => log.played.push(k), duck: (b, d, s) => log.ducked.push([b, d, s]) },
    startShot: (s) => { log.shots.push(s.id); log.lastShot = s; }, snapCamera: () => {}, showBrief: (id) => log.briefs.push(id), callout: (t) => log.callouts.push(t), armWave: () => { log.armed++; },
    daylight: () => ({ day: () => o.day ?? 42 }), sectorRun: () => ({ breathing: () => o.breathing ?? true, state: () => ({ phase: o.phase ?? 'fighting' }), defNow: () => ({ boss: !!o.boss }) }),
    base: () => ({ structure: (id) => (id === 'stalheart' ? { root: stal, near: stal, far: stal, holder: stal } : null) }),
    shotActive: () => false, seated: () => false, card: () => false, alive: () => true, won: () => false, isaoBusy: () => false,
  };
  return { h, log, scene, stal };
}
const tickTo = (p, secs, dt = 0.1) => { for (let k = 0; k < secs / dt; k++) p.tick(dt); };
// the ball is fetched ahead (day 40), the party arms on the breath, the brief, the music and the hold come first, the shot at 1.5 s, the ball hangs under the tip
{
  const { h, log, scene, stal } = host({ day: 40 }); const p = createDiscoParty(h);
  p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); assert.equal(p.state().loaded, true, 'the ball loads two days ahead');
  assert.deepEqual(log.primed, [DAY_42.music.key], 'the lazy track is primed with the ball, two days ahead (2026-10-18)');
  assert.equal(p.state().phase, 'idle'); assert.equal(p.holding(), false);
}
{
  const { h, log, scene, stal } = host(); const p = createDiscoParty(h);
  p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1);
  assert.equal(p.state().phase, 'party'); assert.equal(p.holding(), true);
  assert.deepEqual(log.briefs, [DAY_42.briefs.start]); assert.deepEqual(log.played, [DAY_42.music.key]); assert.equal(log.ducked.length, 1);
  assert.deepEqual(log.shots, [], 'no cut before the words'); tickTo(p, 1.6); assert.deepEqual(log.shots, [DAY_42.shot.id]);
  assert.equal(stal.userData.actions.Terraforming_Cycle.paused, true, 'the Terraforming loop is paused for the party');
  // the shot's pose: the eye about `radius` from the tip, `height` above it, looking at it
  const out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; log.lastShot.poseAt(0.5, out);
  const tip = new THREE.Vector3(); stal.getObjectByName('EXTRUSION_TIP').getWorldPosition(tip); const flat = out.pos.clone().sub(tip); flat.y = 0;
  assert.ok(Math.abs(flat.length() - DAY_42.shot.radius) < 1, `the eye orbits at the radius (${flat.length()})`);
  tickTo(p, 4); const s = p.state(); assert.equal(s.hanging, true, 'the ball hangs'); assert.equal(s.lights, 4, 'four party floodlights');
  const ballRoot = scene.getObjectByName('DISCO_BALL_ROOT'); assert.ok(ballRoot, 'the ball is in the scene'); assert.equal(ballRoot.getObjectByName('STANDALONE_CRADLE').visible, false, 'hung: no cradle');
  const bp = new THREE.Vector3(); ballRoot.getWorldPosition(bp); stal.getObjectByName('EXTRUSION_TIP').getWorldPosition(tip); const hook = tip.clone().sub(tip.clone().normalize().multiplyScalar(6.2)); assert.ok(bp.distanceTo(hook) < 0.05, `the hook 6.2 m under the tip, toward the planet's centre (${bp.toArray()} vs ${hook.toArray()})`);
  assert.ok(stal.getObjectByName('DISCO_SPHERE_SPIN') === undefined && ballRoot.getObjectByName('DISCO_SPHERE_SPIN').rotation.y !== 0, 'the sphere spins');
  // the end: the music stopped, the klaxon, the callout, the second line, the wave armed, the hold released; then the ball and the lights gone, the loop resumed
  tickTo(p, DAY_42.seconds - 5.5); assert.equal(p.state().phase, 'over'); assert.equal(log.stopped, 1); assert.ok(log.played.includes('danger_alert')); assert.deepEqual(log.callouts, [DAY_42.callout]);
  assert.deepEqual(log.briefs, [DAY_42.briefs.start, DAY_42.briefs.over]); assert.equal(log.armed, 1); assert.equal(p.holding(), false);
  tickTo(p, DAY_42.lower + 0.5); assert.equal(p.state().phase, 'done'); assert.equal(p.state().lights, 0); assert.equal(scene.getObjectByName('DISCO_BALL_ROOT'), undefined, 'the ball is gone');
  assert.equal(stal.userData.actions.Terraforming_Cycle.paused, false, 'the Terraforming loop resumes');
  tickTo(p, 60); assert.equal(log.armed, 1, 'once a run'); p.restore(); assert.equal(p.state().phase, 'idle');
}
// no armWave when the sector is secure (nothing to arm); the arena never parties; force() arms whatever the day
{ const { h, log } = host({ phase: 'secure', breathing: false }); const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); assert.equal(p.state().phase, 'party'); tickTo(p, DAY_42.seconds + 1); assert.equal(log.armed, 0); }
{ const { h } = host({ boss: true }); const p = createDiscoParty(h); tickTo(p, 2); assert.equal(p.state().phase, 'idle'); }
{ const { h } = host({ day: 3, breathing: false }); const p = createDiscoParty(h); p.force(); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); assert.equal(p.state().phase, 'party'); }
// the review's guards (2026-10-18): no party while the board's wave warning rings; the hull lost mid-party ends it at once, the hold
// released, no klaxon and no wave armed; the ball still goes down and away
{ let warn = true; const { h } = host(); h.warning = () => warn; const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); tickTo(p, 2); assert.equal(p.state().phase, 'idle', 'not over the warning'); warn = false; p.tick(0.1); assert.equal(p.state().phase, 'party'); }
{ let alive = true; const { h, log, scene } = host(); h.alive = () => alive; const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); tickTo(p, 5);
  const carriage = scene.getObjectByName('CARRIAGE_TRAVEL_X'), x0 = carriage.position.x;
  alive = false; p.tick(0.1); assert.equal(p.state().phase, 'over'); assert.ok(Math.abs(carriage.position.x - x0) < 0.25, `the arm lowers from where it is (${x0} -> ${carriage.position.x})`); assert.equal(p.holding(), false); assert.equal(log.stopped, 1); assert.ok(!log.played.includes('danger_alert')); assert.equal(log.armed, 0); assert.equal(p.state().lights, 0);
  tickTo(p, DAY_42.lower + 0.5); assert.equal(p.state().phase, 'done'); assert.equal(scene.getObjectByName('DISCO_BALL_ROOT'), undefined); }
// restore() mid-party leaves nothing in the scene and the loop running
{ const { h, scene, stal } = host(); const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); tickTo(p, 3); const before = scene.children.length;
  p.restore(); assert.equal(scene.getObjectByName('DISCO_BALL_ROOT'), undefined); assert.equal(scene.children.length, before - 1); assert.equal(stal.userData.actions.Terraforming_Cycle.paused, false); assert.equal(p.holding(), false);
  let lights = 0; scene.traverse((o) => { if (o.isLight) lights++; }); assert.equal(lights, 0, 'no light of the party left'); }
// the real loader resolves the glTF's scene group with DISCO_BALL_ROOT inside it: not hanging until the party, then in the world itself
{ const { h, scene } = host(); h.loadGlb = async () => { const g = new THREE.Group(); g.add(ball()); return g; }; let day = 41; h.daylight = () => ({ day: () => day }); const p = createDiscoParty(h);
  p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); assert.equal(p.state().phase, 'idle'); assert.equal(p.state().hanging, false, 'loaded, not hanging');
  day = 42; p.tick(0.1); p.tick(0.1); assert.equal(p.state().phase, 'party'); assert.equal(scene.getObjectByName('DISCO_BALL_ROOT')?.parent, scene, 'the ball hangs in the world'); }
// loadGlb caches one scene per URL for the page's life: a second party in the same page (the harness restart, the dev GUI's regenerate) is handed
// the SAME group and must still get the whole ball and its four lights; the cached group is left as it was found
{ const cached = new THREE.Group(); cached.add(ball());
  const run = async () => { const { h, scene } = host(); h.loadGlb = async () => cached; const p = createDiscoParty(h);
    p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); tickTo(p, 5); return { p, scene }; };
  const a = await run(); assert.equal(a.p.state().hanging, true, 'the first party hangs'); assert.equal(a.p.state().lights, 4);
  a.p.restore(); assert.equal(cached.getObjectByName('DISCO_BALL_ROOT')?.parent, cached, 'the cached scene keeps its ball'); assert.equal(cached.getObjectByName('STANDALONE_CRADLE').visible, true, 'the cached cradle is untouched');
  const b = await run(); assert.equal(b.p.state().hanging, true, 'the second party hangs'); assert.equal(b.p.state().lights, 4, 'the second party has its four lights');
  assert.ok(b.scene.getObjectByName('DISCO_BALL_ROOT'), 'DISCO_BALL_ROOT is in the second scene'); assert.equal(b.p.state().failed, false); }
// a failed load is diagnosable: one warning, failed in state()
{ const { h } = host(); h.loadGlb = async () => null; let warns = 0; const w = console.warn; console.warn = () => { warns++; };
  const p = createDiscoParty(h); try { p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1); p.tick(0.1); } finally { console.warn = w; }
  assert.equal(p.state().failed, true); assert.equal(p.state().loaded, false); assert.equal(warns, 1, 'one warning, not one a frame'); }
// the track is lazy (final review, 2026-10-18): a decode slower than the cut still starts it within `music.retry`, asking to decode again meanwhile
{ let decoded = false; const { h, log } = host({ decoded: () => decoded }); const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1);
  assert.equal(p.state().phase, 'party'); assert.equal(p.state().music, false, 'not decoded: no music yet'); tickTo(p, 3);
  assert.ok(log.primed.length > 2, `asked to decode again while it waits (${log.primed.length})`); assert.ok(3 < DAY_42.music.retry, 'the test sits inside the retry window');
  decoded = true; p.tick(0.1); assert.equal(p.state().music, true, 'started at 3 s, after the cut'); assert.deepEqual(log.played, [DAY_42.music.key]); }
// the wall gap (final review, 2026-10-18): the host stops ticking the party while paused and the track plays on; a 2 s gap between ticks
// stops the music and ends the party at its alarm on the next tick; a non-live shot (zero-dt ticks) counts the same; steady frames do not
{ let wall = 0; const { h, log } = host(); h.now = () => wall; const p = createDiscoParty(h); const step = (dt) => { wall += dt * 1000; p.tick(dt); };
  step(0.1); await new Promise((r) => setTimeout(r, 5)); step(0.1); for (let k = 0; k < 50; k++) step(0.1);
  assert.equal(p.state().phase, 'party', 'steady frames: still the party'); assert.equal(p.state().music, true); assert.equal(log.stopped, 0);
  wall += 2000; step(0.1); assert.equal(log.stopped, 1, 'the music stopped'); assert.equal(p.state().phase, 'over', 'over on the first tick back');
  assert.equal(p.state().music, false); assert.ok(log.played.includes('danger_alert'), 'at its alarm'); assert.equal(log.armed, 1); assert.equal(p.holding(), false); }
{ let wall = 0; const { h, log } = host(); h.now = () => wall; const p = createDiscoParty(h); const step = (dt, adv = dt) => { wall += adv * 1000; p.tick(dt); };
  step(0.1); await new Promise((r) => setTimeout(r, 5)); step(0.1); for (let k = 0; k < 20; k++) step(0.1);
  for (let k = 0; k < 60; k++) step(0, 1 / 60); assert.equal(p.state().phase, 'party', 'frozen ticks advance nothing'); step(0.1); assert.equal(p.state().phase, 'over', 'a second of frozen frames: over'); assert.equal(log.stopped, 1); }
// the cut asks the seat again (final review, 2026-10-18): seated at 1.5 s, no cut and the party goes on to its alarm; a shot already up, the same
for (const k of ['seated', 'shotActive']) { let on = false; const { h, log } = host(); h[k] = () => on; const p = createDiscoParty(h); p.tick(0.1); await new Promise((r) => setTimeout(r, 5)); p.tick(0.1);
  assert.equal(p.state().phase, 'party'); tickTo(p, 1.2); on = true; tickTo(p, 0.5); assert.deepEqual(log.shots, [], `${k} at the cut: no startShot`);
  tickTo(p, DAY_42.seconds); assert.equal(p.state().phase, 'over', `${k}: the party still reaches its alarm`); assert.ok(log.played.includes('danger_alert')); }
console.log('disco-party ok');
