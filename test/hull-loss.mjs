// hull-loss.mjs — a hull lost (src/fx/hull-loss.js) over a recording host: the wreck, the combo gone with it, MÖRK DOWN! with the
// hulls left and the rank that carries over; after the death hold on the run's timers, nothing if the run was won or the mesh is
// gone meanwhile, else the orbit view (build mode keeps its own), the one-second dash from the wreck's camera to the berth's DEPLOY
// pose, and the next hull out of the berth its count picks, painted for its health.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createHullLoss } from '../src/fx/hull-loss.js';
import { rankLabel } from '../src/ranks.js';

function lose({ rank = 0, hp = 2, build = false } = {}) {
  const log = [], timers = [], shots = [];
  const s = { tankRank: rank, playerHP: hp, playerMesh: { visible: false, userData: {} }, buildMode: build, tankLostDeploys: 4, ramCombo: 9, ramComboT: 2, playerDown: true };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(1, 2, 3);
  const camA = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const host = {
    runTimers: { after: (ms, cb) => { log.push(['after', ms]); timers.push(cb); } }, player: { won: false }, camera, camA, feel: { hoverT: 0.7, settleT: 1 },
    DEATH_HOLD: 1.15, PLAYER_MAX: 3, destroyPlayer: () => log.push(['destroyPlayer']), syncCombo: () => log.push(['syncCombo']), showToast: (html, ms) => log.push(['toast', html, ms]),
    setView: (v) => log.push(['view', v]), startShot: (o) => shots.push(o), deployFramePoseFor: (n, cam) => { cam.pos.set(0, 0, 10 + n); cam.quat.identity(); },
    deployStart: (n) => log.push(['deployStart', n]),
    setRamCombo: (v) => { s.ramCombo = v; }, setRamComboT: (v) => { s.ramComboT = v; }, setTankLostDeploys: (v) => { s.tankLostDeploys = v; }, setPlayerDown: (v) => { s.playerDown = v; },
  };
  for (const k of ['tankRank', 'playerHP', 'playerMesh', 'buildMode', 'tankLostDeploys']) host[k] = () => s[k];
  createHullLoss(host)();
  return { s, log, timers, shots, host, camA };
}
// THE WRECK: destroyed, the combo gone with it, the toast held through the hold and the dash
{
  const k = lose({ rank: 5, hp: 2 });
  assert.deepEqual(k.log.slice(0, 3), [['destroyPlayer'], ['syncCombo'], ['toast', `<div class="td-down">MÖRK DOWN!</div><div class="td-down-sub">2 left · ${rankLabel(5)} carries over</div>`, 2150]]);
  assert.deepEqual([k.s.ramCombo, k.s.ramComboT, k.log[3]], [0, 0, ['after', 1150]]);
  assert.equal(lose({ rank: 0, hp: 1 }).log[2][1], '<div class="td-down">MÖRK DOWN!</div><div class="td-down-sub">1 left</div>', 'no rank, no carry line');
}
// THE HOLD: nothing when the run was won or the mesh went meanwhile
{
  const won = lose(); won.host.player.won = true; won.timers[0](); assert.equal(won.shots.length, 0);
  const gone = lose(); gone.s.playerMesh = null; gone.timers[0](); assert.equal(gone.shots.length, 0);
}
// THE DASH: orbit (build keeps its view), from the wreck's camera to the DEPLOY pose of the berth the count picks; then the hull
{
  const k = lose({ hp: 2 }); k.timers[0]();
  assert.deepEqual(k.log.at(-1), ['view', 'orbit']);
  const b = lose({ build: true }); b.timers[0](); assert.ok(!b.log.some((e) => e[0] === 'view'), 'build mode keeps its view');
  const [shot] = k.shots;
  assert.deepEqual([shot.id, shot.dur], ['downdash', 1.0]);
  const out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  shot.poseAt(0, out); assert.deepEqual(out.pos.toArray(), [1, 2, 3], 'it starts on the wreck');
  shot.poseAt(1, out); assert.deepEqual(out.pos.toArray(), [0, 0, 11], 'and lands on berth #2\'s DEPLOY pose');
  shot.poseAt(0.5, out); assert.deepEqual(out.pos.toArray(), [0.5, 1, 7], 'eased (smoothstep 0.5 is the midpoint)');
  shot.onEnd();
  assert.deepEqual([k.s.tankLostDeploys, k.s.playerMesh.visible, k.s.playerDown, k.host.feel.hoverT, k.host.feel.settleT], [5, true, false, 0, 0]);
  assert.deepEqual(k.log.at(-1), ['deployStart', 1]);
}
console.log('Hull loss: the wreck and its toast, the hold that yields to a win or a lost mesh, the dash home, the next hull out.');
