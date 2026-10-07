import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
// the module's own imports, for the original text's free names
const imps = {};
for (const line of fs.readFileSync(R + 'src/fx/hull-drive.js', 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) imps[n] = mod[n];
}
const { makeKick } = await import(R + 'src/domain/hover-kick.js'), { makeStuck } = await import(R + 'src/domain/hull-stuck.js');
const { makeDriveRamp } = await import(R + 'src/domain/drive-ramp.js'), { makeSteerEase } = await import(R + 'src/domain/steer-ease.js');
const { mulberry32 } = await import(R + 'src/rng.js');
const { createHullDrive } = await import(R + 'src/fx/hull-drive.js');
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(9) : Array.isArray(x) ? x.map(r6) : x);
function world(log, manual) {
  const N = 40, centers = [], normals = [], adj = [];
  for (let i = 0; i < N; i++) { const a = i * 0.05; centers.push([Math.cos(a), Math.sin(a), 0]); normals.push([Math.cos(a), Math.sin(a), 0]); adj.push([(i + 1) % N, (i + N - 1) % N]); }
  const tags = Array(N).fill(1); tags[14] = imps.BLOCKED;
  const graph = { centers, normals, adj }, dungeon = { tags, heart: 0, distToHeart: centers.map((_, i) => Math.min(i, N - i)) };
  const near = (p) => { let b = -1, bd = Infinity; centers.forEach((c, i) => { const d = imps.dist3(c, p); if (d < bd) { bd = d; b = i; } }); return b; };
  const player = { cur: 2, prev: -1, next: 3, prog: 0, pos: centers[2].slice(), travelDir: [0, 1, 0], smoothDir: [0, 1, 0], heading: [0, 1, 0], segLen: 0.05, freeMode: manual, virtualStart: null, moves: 0, visited: new Set(), won: false };
  const st = { cellIndex: near, towerCells: new Set(), cellSide: 0.05, cruise: false, dungeon, gotoField: null, graph, kick: makeKick(), playerDown: false, portalDist: null, speedBonus: 1, storyBase: null, stuck: makeStuck(), throttle: 0, whim: mulberry32(7), autoMode: !manual, respawnClock: 0, steerHold: 5 };
  const rec = (n) => (...a) => log.push([n, ...r6(a)]);
  const fixed = { MOVES: { mork: { speed: () => 1 } }, breachBlocked: () => false, bumpFactor: () => 0, checkAbsorb: rec('absorb'), containerBlocked: () => false, driveRamp: makeDriveRamp(), enemies: [],
    floorColorOf: (ci) => ci, freeBlocked: (p) => tags[near(p)] === imps.BLOCKED, keys: { left: false, right: false, fast: manual, slow: false }, manualActive: () => !st.autoMode, nearestWall: (p) => centers[14],
    orbMeshes: new Map(), paintCell: rec('paint'), params: { creature: 'mork', speed: 1, orbs: 0, directive: 'wander', wallHeight: 0.04 }, pedestalBlocked: () => false, player, runContext: { time: 0 }, spawnOneOrb: rec('orb'),
    steerEase: makeSteerEase(), steeringActive: () => st.steerHold < 1.2, towerCells: new Set(), updateHud: rec('hud'), wallCushion: (p) => p };
  return { st, fixed, player };
}
function run(make, manual) {
  const log = [], w = world(log, manual), d = make(w);
  for (let i = 0; i < 160; i++) { if (manual) w.fixed.keys.left = i > 40 && i < 70; d.advanceMotion(1 / 30); const p = w.player; log.push(['f', p.cur, p.next, r6(p.prog), r6(p.pos), r6(p.heading), r6(p.smoothDir), w.st.autoMode, r6(w.st.steerHold), r6(w.st.respawnClock)]); }
  return log;
}
const spec = {"MOVES":"value","breachBlocked":"value","bumpFactor":"value","checkAbsorb":"value","containerBlocked":"value","driveRamp":"value","enemies":"value","floorColorOf":"value","freeBlocked":"value","keys":"value","manualActive":"value","nearestWall":"value","orbMeshes":"value","paintCell":"value","params":"value","pedestalBlocked":"value","player":"value","runContext":"value","spawnOneOrb":"value","steerEase":"value","steeringActive":"value","updateHud":"value","wallCushion":"value","cellIndex":"get","towerCells":"get","cellSide":"get","cruise":"get","dungeon":"get","gotoField":"get","graph":"get","kick":"get","playerDown":"get","portalDist":"get","speedBonus":"get","storyBase":"get","stuck":"get","throttle":"get","whim":"get","autoMode":"set","respawnClock":"set","steerHold":"set"};
const getN = Object.keys(spec).filter((k) => spec[k] !== 'value');
let all = '';
for (const manual of [false, true]) {
  const newLog = run((w) => { const host = { ...w.fixed }; for (const k of getN) { host[k] = () => w.st[k]; host['set' + k[0].toUpperCase() + k.slice(1)] = (v) => (w.st[k] = v); } return createHullDrive(host); }, manual);
  all += JSON.stringify(newLog);
  assert.ok(newLog.filter((x) => x[0] === 'paint').length > 0, 'the hull crosses cells');
}
// THE ORIGINAL BLOCK's logs on these fakes (src/td-tab.js before the refactor run's Task 9, through new Function beside the module):
// 160 frames of the wanderer on auto past a blocked cell, and 160 driven by hand with a turn
assert.equal(createHash('sha256').update(all).digest('hex').slice(0, 16), '3ee1520209a9ce12', 'the drive behaves as the controller block did');
print('Hull drive: the wanderer picks its exits and the hand-driven hull steers, glides and arrives, as the controller block did.');
