// boss-cutis-scenario.mjs — the boss lab's Cutis-Maku scenario (src/labs/boss/cutis-scenario.js; spec docs/superpowers/specs/2026-10-12-cutis-maku-boss-design.md) in
// node, the lab faked round it: the wave waits below until the sinkhole is ready, comes up one by one through its lip (under the ground first, never hittable nor hunted
// before its first hop commits), keeps Isao off the centre meanwhile; a round hurts by the phase (none in TRANSFER, flashed; full in EXTEND; half at rest); the last
// small one dead opens the boss's sinkhole and puts Isao out of the way; the boss comes up and takes the fight's damage (`hurt`, hits counted as `burn` counts them);
// KILLED deflates it into a puddle that fades and goes; R clears the puddles; ?cutis=N; the re-anchor's shift; the fear's stun holds the hop; the lunge shortens it.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createCutisScenario, cutisCount } from '../src/labs/boss/cutis-scenario.js';
import { makeFight, startFight, kill, hurt } from '../src/domain/boss-fight.js';
import { frameAt } from '../src/domain/surface-frame.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';
import { CUTIS_WAVE, CUTIS_BOSS, CUTIS_DEATH, CUTIS_EMERGE, CUTIS_LUNGE } from '../src/content/cutis-maku.js';

const R = 753, DT = 1 / 60;
const tune = JSON.parse(JSON.stringify(BOSS_FIGHT));
let t = 0, fight = makeFight({ ...tune, health: CUTIS_BOSS.health });
startFight(fight);
const sphere = new THREE.Group(), frame = frameAt([0, 1, 0], R, 0), camera = new THREE.PerspectiveCamera(30, 1.6, 0.5, 6000);
camera.position.set(0, R + 300, 200); camera.lookAt(0, R, 0); camera.updateMatrixWorld();
const ground = (x, z) => { const l = Math.hypot(x, R, z); return [x / l * R, R / l * R, z / l * R]; };
// the lab's sinkhole: opened by the lab for the wave, by the scenario for the boss; ready after `readyAfter` seconds
const sink = { open: null, who: null, at: null, readyAt: Infinity, opens: [] };
const sinkhole = {
  open(at, size, who) { sink.who = who; sink.at = [...at]; sink.readyAt = t + 1; sink.opens.push({ who, at: [...at], size }); },
  who: () => sink.who, ready: () => sink.who !== null && t >= sink.readyAt, radius: () => (sink.who ? (sink.who === 'boss' ? 10 : 5) : 0),
  seal() { sink.who = null; },
};
let isao = [60, 0], put = [], callouts = [], staggers = 0;
const scenario = createCutisScenario({
  sphere, frame: () => frame, planetR: () => R, tune: () => tune, fight: () => fight, now: () => t, ground,
  aim: (from, to) => [to[0], to[1]], isao: () => ({ pos: isao, radius: 0 }), isaoPos: () => isao, putIsao: (p) => { put.push([...p]); isao = [...p]; },
  camera: () => camera, height: () => 900, sinkhole: () => sinkhole, count: '4', callout: (text) => callouts.push(text), stagger: () => staggers++,
});
const step = (seconds) => { for (let k = 0; k < Math.round(seconds / DT); k++) { t += DT; scenario.step(DT); } };
const newRound = (seed = 1) => { sink.who = null; sink.opens.length = 0; const n = scenario.reset(20, [0, 0], seed); if (n) sinkhole.open([0, 0], 1, 'reeds'); fight = makeFight({ ...tune, health: CUTIS_BOSS.health }); startFight(fight); return n; };

// ?cutis=N
assert.equal(cutisCount('4'), 4); assert.equal(cutisCount('0'), 0); assert.equal(cutisCount('250'), CUTIS_WAVE.max); assert.equal(cutisCount(null), CUTIS_WAVE.count); assert.equal(cutisCount('x'), CUTIS_WAVE.count);
// the scenario's face to the lab: it always holds the Nih-Dairia boss back and never lets it enter
assert.equal(scenario.holds(), true); assert.equal(scenario.bossEnters(), false);
assert.equal(scenario.group.getObjectByName('Cutis-Maku wave')?.isGroup, true, 'the wave\'s instanced meshes under the scenario\'s group (the thermal heats it)');

// THE WAVE COMES UP
{
  assert.equal(newRound(), 4, 'the wave is ?cutis=N, not the Reeds\' slider');
  assert.deepEqual(scenario.bar(), { alive: 4, count: 4 });
  step(0.5);
  let r = scenario.readout();
  assert.equal(r.wave.made, 0, 'nothing comes up before the sinkhole is ready');
  assert.deepEqual(scenario.keep(), { at: [0, 0], radius: tune.wave.emerge.keep }, 'Isao kept off the centre while any is still to come');
  assert.deepEqual(scenario.hunted().contacts, [], 'nothing up: no contacts to take Isao');
  const seen = new Map();
  for (let k = 0; k < 60 * 20 && scenario.readout().wave.emerged < 4; k++) {
    t += DT; scenario.step(DT);
    for (const c of scenario.readout().wave.creatures) {
      const s = seen.get(c.id) ?? { states: [], lifts: [] }; seen.set(c.id, s);
      if (s.states.at(-1) !== c.state) s.states.push(c.state);
      if (c.state === 'rising') s.lifts.push(c.lift);
      if (c.state === 'rising') assert.equal(scenario.land('wave', c.id, 0.3), null, 'a creature still rising cannot be hit');
    }
  }
  r = scenario.readout();
  assert.equal(r.wave.emerged, 4, `all four came up (${JSON.stringify(r.wave.creatures.map((c) => c.state))})`);
  for (const [id, s] of seen) {
    assert.deepEqual(s.states.slice(0, 3), ['waiting', 'rising', 'up'], `creature ${id} waited, rose, came up`);
    const r0 = CUTIS_WAVE.config.r0;
    assert(s.lifts[0] < -r0 * 0.85 * CUTIS_EMERGE.depthRadii + 1e-6, `creature ${id} started ${CUTIS_EMERGE.depthRadii} radii under the ground (${s.lifts[0]})`);
  }
  for (const c of r.wave.creatures) {
    assert.equal(c.lift, 0, 'up: on the surface'); assert(c.cycles >= 1, 'its first hop committed');
    const d = Math.hypot(c.centre[0], c.centre[1]);
    assert(d > 5 && d < 30, `creature ${c.id} out of the hole near its lip (${d.toFixed(1)} m)`);
  }
  assert.equal(scenario.keep(), null, 'every one up: the keep-out ends (the lab seals the sinkhole)');
  assert.notEqual(scenario.hunted().contacts.length, 0, 'the nearest one up is Isao\'s creature');
  assert(scenario.huntedNodes().length > 8, 'its reach ring for his planner');
  const ring = scenario.huntedNodes(), c0 = ring[0], far = Math.max(...ring.map((p) => Math.hypot(p[0] - c0[0], p[1] - c0[1])));
  assert(far > CUTIS_WAVE.config.reach * CUTIS_WAVE.config.r0 * 0.8, `the ring at reach x r (${far.toFixed(1)} m)`);
}
// THE HUNT: the targets are Isao's ground point
{
  isao = [80, 20];
  step(0.2);
  const r = scenario.readout();
  assert(r.hunted && r.hunted.who === 'wave', 'the hunted one is a small one');
}
// THE PHASE RULE (CUTIS_HITS): TRANSFER absorbs and flashes, EXTEND hurts in full, REST half
{
  const transfer = scenario.land('wave', 0, 0.7);
  assert.equal(transfer.damage, 0, 'TRANSFER: no damage'); assert.equal(transfer.absorbed, true, 'absorbed'); assert.equal(transfer.after, transfer.before);
  assert(scenario.readout().flash.fired >= 1, 'the absorbed flash fired');
  const extend = scenario.land('wave', 0, 0.3);
  assert(extend.damage > 0 && extend.after < extend.before, `EXTEND: hurt (${JSON.stringify(extend)})`);
  assert.equal(extend.damage, tune.bofors.damage, 'a landing on its centre in EXTEND: the gun\'s full damage');
  const settle = scenario.land('wave', 1, 0.9);
  assert.equal(settle.damage, tune.bofors.damage * 0.5, 'SETTLE: half');
}
// THE NUKE'S STUN HOLDS THE HOP, THE LUNGE SHORTENS IT
{
  tune.gunFear.nuke.stun = 1.5;
  const c = scenario.readout().wave.creatures[2];
  scenario.resolve({ kind: 'nuke', player: true, radius: 2, damage: 0.001, at: [c.centre[0] + 20, c.centre[1]], land: t }, 0);
  step(DT * 2);
  assert.equal(scenario.readout().wave.creatures[2].hold, true, 'the MK-9 within reach stuns it: its hop held');
  step(2);
  assert.equal(scenario.readout().wave.creatures[2].hold, false, 'the stun over');
  tune.gunFear.nuke.stun = BOSS_FIGHT.gunFear.nuke.stun;
  let fastest = 1;
  for (let k = 0; k < 60 * 12; k++) { t += DT; scenario.step(DT); for (const x of scenario.readout().wave.creatures) if (x.state === 'up') fastest = Math.min(fastest, x.pace); }
  assert(fastest < 0.8 && fastest >= CUTIS_LUNGE.fastest - 1e-9, `a lunge shortens the hop toward ${CUTIS_LUNGE.fastest} (${fastest.toFixed(3)})`);
}
// THE WAVE CLEARED: the boss's entry
{
  isao = [3, 0];
  assert(scenario.killAll() >= 1, 'the acceptance\'s cheat kills the rest');
  assert.deepEqual(scenario.bar(), { alive: 0, count: 4 });
  step(DT);
  assert.equal(scenario.bar(), null, 'the bar is the boss\'s hit points');
  step(DT);
  assert.equal(sink.opens.at(-1).who, 'boss', 'the boss\'s sinkhole opens'); assert.equal(sink.opens.at(-1).size, tune.wave.sinkhole.boss);
  assert.deepEqual(callouts.at(-1), 'CUTIS-MAKU');
  assert(put.length && Math.hypot(put.at(-1)[0], put.at(-1)[1]) >= tune.wave.clear - 1e-6, 'Isao put out of its way');
  assert.deepEqual(scenario.keep(), { at: [0, 0], radius: tune.wave.clear }, 'kept off the centre while it comes up');
  assert.equal(scenario.readout().puddles >= 1, true, 'the dead lie as puddles');
  let r = scenario.readout();
  assert.equal(r.boss.stage, 'waiting');
  for (let k = 0; k < 60 * 30 && scenario.readout().boss.stage !== 'up'; k++) { t += DT; scenario.step(DT); if (scenario.readout().boss.stage === 'rising') assert.equal(scenario.land('boss', 0, 0.3), null, 'not hittable while it rises'); }
  r = scenario.readout();
  assert.equal(r.boss.stage, 'up', 'the boss came up'); assert.equal(r.boss.lift, 0);
  assert.equal(scenario.keep(), null);
  assert(scenario.hunted().radius > 4, 'the boss is Isao\'s creature');
}
// THE BOSS TAKES THE FIGHT'S DAMAGE BY THE PHASE
{
  const hits0 = fight.hits, a = scenario.land('boss', 0, 0.7);
  assert.equal(a.damage, 0); assert.equal(a.absorbed, true); assert.equal(fight.hits, hits0, 'an absorbed round is no hit');
  const b = scenario.land('boss', 0, 0.3);
  assert(b.damage > 0 && fight.hp < CUTIS_BOSS.health, 'the fight\'s hit points'); assert.equal(fight.hits, hits0 + 1, 'one hit');
  assert.equal(fight.byKind.bofors, b.dealt);
}
// hurt(): a stream counts one hit a plan
{
  const f = makeFight({ ...tune, health: 50 }); startFight(f);
  const stream = { kind: 'rotary', moving: true }, shell = { kind: 'bofors' };
  assert.equal(hurt(f, stream, 2), 2); assert.equal(hurt(f, stream, 2), 2); assert.equal(f.hits, 1, 'a stream: one hit');
  hurt(f, shell, 3); assert.equal(f.hits, 2); assert.equal(f.byKind.rotary, 4); assert.equal(f.byKind.bofors, 3);
  assert.equal(hurt(f, shell, 100), 43, 'never past 0'); assert.equal(f.hp, 0);
  kill(f); assert.equal(hurt(f, shell, 5), 0, 'nothing after the fight');
}
// KILLED: a puddle that deflates, fades and goes
{
  assert.equal(scenario.killBoss(), true);
  kill(fight); scenario.killed();
  let r = scenario.readout();
  assert.equal(r.boss.stage, 'dead'); assert.equal(r.boss.hold, true, 'its hop held');
  step(CUTIS_DEATH.deflate / 2);
  r = scenario.readout();
  assert(r.boss.deflate > 0.3 && r.boss.deflate < 0.7 && r.boss.opacity === 1, `half deflated (${r.boss.deflate})`);
  step(CUTIS_DEATH.deflate / 2 + 0.1);
  assert.equal(scenario.readout().boss.deflate, 1, 'flat');
  scenario.deathTimes(undefined, 2);
  step(1);
  r = scenario.readout();
  assert(r.boss.opacity < 1 && r.boss.opacity > 0 && r.boss.lift < 0, 'fading and sinking');
  step(1.2);
  assert.equal(scenario.readout().boss.stage, 'gone', 'gone'); assert(scenario.group.getObjectByName('Cutis-Maku boss').children.every((m) => !m.isInstancedMesh || m.count === 0), 'nothing of it drawn');
  scenario.deathTimes(CUTIS_DEATH.deflate, CUTIS_DEATH.fade);
}
// R: a new round clears the puddles; the shift moves every local position
{
  newRound(2);
  let r = scenario.readout();
  assert.equal(r.puddles, 0); assert.equal(r.boss.stage, 'waiting'); assert.equal(r.wave.made, 0);
  step(1.2 + 3);
  r = scenario.readout();
  const c = r.wave.creatures.find((x) => x.centre);
  scenario.shift(10, -5);
  const d = scenario.readout().wave.creatures.find((x) => x.id === c.id);
  assert(Math.abs(d.centre[0] - c.centre[0] - 10) < 1e-3 && Math.abs(d.centre[1] - c.centre[1] + 5) < 1e-3, 'the shift moves the creatures with the frame');
  assert.deepEqual(scenario.readout().centre, [10, -5]);
}
// no wave: the boss at once
{
  scenario.params.count = 0;
  assert.equal(newRound(3), 0);
  step(DT);
  assert.equal(sink.opens.at(-1)?.who, 'boss', 'a count of 0 opens the boss\'s sinkhole at once');
  scenario.params.count = 4;
}
scenario.dispose();
assert.equal(sphere.children.length, 0, 'disposed: nothing left in the sphere');
console.log('boss-cutis-scenario: ok');
