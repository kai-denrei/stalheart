// boss-carcass-stages.mjs — the dead boss's carcass taken apart in stages (owner, 2026-10-10: "after the boss is dead, the user should still be able to shoot at
// its carcass ... 'stages of destruction' for the dead boss? limbs getting cut, parts disappearing in explosion, etc."; src/domain/boss-carcass.js, the lab
// src/labs/boss/remains.js): the boss's own limbs by the kit's rule, each gun's harm, the segments a break cuts off, the hop of a cut-off piece and of the core's
// chunks, a severed piece's crumble, the char and the stage machine; then a carcass of six limbs played through by the rules alone: three 40 mm landings on one
// limb's middle cut it, an MK-9 on the core cracks it, fire on what is left reaches SCORCHED.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { limbRings, blastBreaks, carcassDamage, severance, hopOf, hopPose, coreChunks, severedCrumble, charOf, carcassStage, stageLabel, STAGES } from '../src/domain/boss-carcass.js';

const B = T.bossCarcass, K = B.chain.segments;
const MIN_SEGS = 12, MAX_SEGS = 14;   // the owner's brief: "more segments per limb for its size, e.g. 12-14"
const MIN_CHUNKS = 3, MAX_CHUNKS = 5;  // "the core cracks into 3-5 chunks"
const SEVER_MAX_M = 12;                // a cut-off piece moves "a short distance" away

// the content
assert.ok(K >= MIN_SEGS && K <= MAX_SEGS && K > T.wave.carcass.chain.segments, `${K} pieces a limb, more than a Reed's`);
assert.ok(B.chain.thin > T.wave.carcass.chain.thin && B.chain.core >= T.wave.carcass.chain.core, 'thicker tubes, a fuller core');
assert.ok(B.segmentHp >= 2 && B.coreHp > B.segmentHp && B.chunkHp > 0, `segments of ${B.segmentHp}, a core of ${B.coreHp}, chunks of ${B.chunkHp}`);
assert.ok(B.settle > 0 && B.settle <= 3 && B.fade > 0 && B.fade <= 1.5, 'the collapse settles, then the skin fades into the carcass within a second or so');
assert.ok(B.chunks.min === MIN_CHUNKS && B.chunks.max === MAX_CHUNKS, 'three to five chunks');
assert.ok(B.crumble.span >= 60 && B.crumble.span <= 120, 'a severed piece crumbles slowly, over a minute or two');

// the boss's own cage: six limbs of rings by the kit's rule, enough rings for a smooth tube of K pieces
let limbsLine = '';
{
  const m = JSON.parse(readFileSync(new URL('../assets/creatures/nih-dairia/nih-dairia.json', import.meta.url), 'utf8'));
  const b = readFileSync(new URL('../assets/creatures/nih-dairia/nih-dairia.bin', import.meta.url)), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const rest = new Float64Array(ab, m.layout.particles.offset, m.layout.particles.length);
  const { torso, limbs } = limbRings(rest, m.limbCount ?? 6, { ...T.wave.carcass.chain, ...B.chain });
  assert.equal(limbs.length, 6, 'the boss\'s six limbs');
  assert.ok(torso.length > 50 && limbs.every((r) => r.length >= 8), `a torso and limbs of rings (${limbs.map((r) => r.length).join('/')})`);
  limbsLine = `the boss's ${limbs.length} limbs of ${limbs.map((r) => r.length).join('/')} rings round ${torso.length} torso nodes`;
}

// each gun's harm: the 25 mm a fifth of a hit point to a few, the 40 mm one to every target within its radius, the MK-9 destroys its ring
{
  const r25 = carcassDamage({ kind: 'rotary', radius: T.rotary.radius }, B.damage), r40 = carcassDamage({ kind: 'bofors', radius: T.bofors.radius }, B.damage);
  const mk9 = carcassDamage({ kind: 'nuke', radius: T.nuke.radius }, B.damage);
  assert.ok(r25.damage === 0.2 && r25.cap > 0 && r25.radius < r40.radius, 'the 25 mm: 0.2 to a few within its small radius');
  assert.ok(r40.damage === 1 && r40.cap === 0, 'the 40 mm: 1 to every target within its radius');
  assert.ok(mk9.damage === Infinity && mk9.radius === T.nuke.radius, 'the MK-9: everything in its own ring');
  assert.equal(carcassDamage({ kind: 'sol', radius: 9 }, B.damage), null, 'a kind with no harm does nothing');
  // a wide target is reached on its edge
  assert.deepEqual(blastBreaks([[0, 0], [10, 0]], () => true, [6, 0], 1, 0, [5.5, 0.5]), [0], 'the core is reached on its edge, the far piece is not');
  assert.deepEqual(blastBreaks([[0, 0], [10, 0]], () => true, [6, 0], 1, 0), [], 'without a reach, centres only');
}

// the cut: every segment still on the limb beyond the first break, in runs
{
  const W = (n) => Array(n).fill('whole');
  assert.deepEqual(severance(W(8), new Set([3])), [[4, 5, 6, 7]], 'a break in the middle cuts off the rest');
  assert.deepEqual(severance(W(8), new Set([7])), [], 'a tip breaks alone');
  assert.deepEqual(severance(W(8), new Set([2, 3, 4])), [[5, 6, 7]], 'a wide break: what lies beyond it');
  assert.deepEqual(severance(W(8), new Set([2, 5])), [[3, 4], [6, 7]], 'two breaks: two pieces');
  assert.deepEqual(severance(['whole', 'whole', 'gone', 'severed', 'severed'], new Set([1])), [], 'what is already off is not cut again');
  assert.deepEqual(severance(['whole', 'severed', 'severed'], new Set([1])), [], 'a break on a severed piece cuts nothing');
}

// the hop: away from the cut, up and down again, turned, settled; a chunk ends on the ground
{
  const h = hopOf([0, 0], [10, 0], B.sever, 3), p0 = hopPose(h, 0), mid = hopPose(h, h.time / 2), end = hopPose(h, h.time);
  assert.ok(h.dir[0] > 0.9 && h.dist >= 0.75 * B.sever.distance && h.dist <= SEVER_MAX_M, `away from the cut, a short way (${h.dist.toFixed(1)} m)`);
  assert.ok(p0.offset.every((v) => Math.abs(v) < 1e-12), 'it starts where it was cut');
  assert.ok(mid.offset[1] > 0 && mid.offset[0] > 0 && mid.tilt !== 0 && !mid.done, 'up in the air, on its way, rocked');
  assert.ok(Math.abs(end.offset[1]) < 1e-9 && Math.abs(end.tilt) < 1e-9 && end.done && Math.abs(end.offset[0] - h.dist * h.dir[0]) < 1e-9, 'down, level, at rest');
  assert.ok(hopPose(h, h.time * 0.5).offset[0] > h.dist * 0.5, 'it slows to rest');
  const c = hopOf([0, 0], [0, 0], B.chunk, 4, -3), ce = hopPose(c, c.time);
  assert.ok(Number.isFinite(c.dir[0]) && Math.abs(ce.offset[1] + 3) < 1e-9, 'a chunk on the core\'s centre: a seeded bearing, and down onto the ground');
}

// the chunks: three to five, seeded, round the core
{
  const counts = new Set();
  for (let s = 1; s <= 40; s++) {
    const ch = coreChunks(B.chunks, s);
    assert.ok(ch.length >= MIN_CHUNKS && ch.length <= MAX_CHUNKS && ch.every((c) => Math.abs(c.lift) <= 0.5), `seed ${s}: ${ch.length} chunks`);
    counts.add(ch.length);
  }
  assert.deepEqual(coreChunks(B.chunks, 7), coreChunks(B.chunks, 7), 'seeded');
  assert.ok(counts.size >= 2, `the count varies (${[...counts]})`);
}

// a severed piece's crumble: tip first, within its span
{
  const js = [5, 6, 7, 8, 9], at = severedCrumble(js, B.crumble, 9);
  for (let k = 1; k < js.length; k++) assert.ok(at[k] < at[k - 1], 'the tip goes first');
  assert.ok(Math.min(...at) >= B.crumble.from * B.crumble.span && Math.max(...at) <= B.crumble.span, 'within the span');
}

// the char and the stages
{
  assert.equal(charOf(3, 3, B.char), 0, 'whole: no char');
  assert.ok(charOf(2, 3, B.char) > 0 && charOf(1, 3, B.char) > charOf(2, 3, B.char) && charOf(0, 3, B.char) === B.char, 'each hit darker');
  assert.deepEqual(STAGES, ['INTACT', 'LIMBS SEVERED', 'CORE CRACKED', 'SCORCHED']);
  assert.equal(carcassStage(0, { cut: 0, cracked: false, standing: 80 }), 0, 'intact');
  assert.equal(carcassStage(0, { cut: 2, cracked: false, standing: 70 }), 1, 'limbs severed');
  assert.equal(stageLabel(1, { cut: 2, limbs: 6 }), 'LIMBS SEVERED 2/6');
  assert.equal(carcassStage(1, { cut: 2, cracked: true, standing: 40 }), 2, 'core cracked');
  assert.equal(carcassStage(2, { cut: 0, cracked: false, standing: 40 }), 2, 'never back');
  assert.equal(carcassStage(2, { cut: 6, cracked: true, standing: 0 }), 3, 'scorched once nothing stands');
}

// THE PLAY: six limbs of K segments 1.3 m apart out from a core of radius 4.5 m, by the rules alone
let play = '';
{
  const SEG = 1.3, CORE_R = 4.5, pieces = [];
  for (let l = 0; l < 6; l++) for (let j = 0; j < K; j++) {
    const a = l * Math.PI / 3, r = CORE_R + (j + 0.5) * SEG;
    pieces.push({ kind: 'segment', limb: l, j, own: [Math.cos(a) * r, Math.sin(a) * r], reach: 0.5, hp: B.segmentHp, max: B.segmentHp, state: 'whole', by: null });
  }
  const core = { kind: 'core', limb: -1, j: 0, own: [0, 0], reach: CORE_R, hp: B.coreHp, max: B.coreHp, state: 'whole' };
  pieces.push(core);
  let stage = 0, cracked = false;
  const facts = () => ({ limbs: 6, cut: new Set(pieces.filter((p) => p.kind === 'segment' && p.by === 'blast').map((p) => p.limb)).size, cracked, standing: pieces.filter((p) => p.state === 'whole').length });
  const fire = (kind, at) => {
    const D = carcassDamage({ kind, radius: T[kind].radius }, B.damage);
    const hit = blastBreaks(pieces.map((p) => p.own), (i) => pieces[i].state === 'whole' || pieces[i].state === 'severed', at, D.radius, D.cap, pieces.map((p) => p.reach));
    const breaking = [], cuts = new Map();
    for (const i of hit) { const p = pieces[i]; p.hp = Math.max(0, p.hp - D.damage); if (p.hp > 0) continue; breaking.push(p); if (p.kind === 'segment' && p.state === 'whole') (cuts.get(p.limb) ?? cuts.set(p.limb, new Set()).get(p.limb)).add(p.j); }
    const runs = [];
    for (const [l, js] of cuts) { const chain = pieces.filter((p) => p.kind === 'segment' && p.limb === l); for (const run of severance(chain.map((p) => p.state), js)) runs.push(run.map((j) => chain[j])); }
    for (const p of breaking) { if (p.kind === 'core') { cracked = true; p.state = 'gone'; for (let k = 0; k < 4; k++) pieces.push({ kind: 'chunk', own: [Math.cos(k) * 7, Math.sin(k) * 7], reach: 1.5, hp: B.chunkHp, max: B.chunkHp, state: 'whole' }); } else { p.state = 'gone'; p.by = 'blast'; } }
    for (const run of runs) for (const p of run) p.state = 'severed';
    stage = carcassStage(stage, facts());
    return { hit: hit.length, broke: breaking.length, runs: runs.map((r) => r.map((p) => p.j)) };
  };
  const mid = pieces.find((p) => p.limb === 0 && p.j === Math.floor(K / 2));
  const a = fire('bofors', mid.own), b = fire('bofors', mid.own);
  assert.ok(a.broke === 0 && b.broke === 0 && stage === 0, 'two 40 mm landings scorch, nothing breaks: INTACT');
  const c = fire('bofors', mid.own);
  assert.ok(c.broke >= 1 && c.runs.length === 1 && c.runs[0].at(-1) === K - 1, `the third cuts the limb: the outer piece (${c.runs[0]}) is off`);
  assert.equal(stageLabel(stage, facts()), 'LIMBS SEVERED 1/6');
  const n = fire('nuke', [0, 0]);
  assert.ok(cracked && stage === 2 && n.broke > 0, 'an MK-9 on the core cracks it: CORE CRACKED');
  let rounds = 0;
  while (stage < 3 && rounds < 200) { const left = pieces.find((p) => p.state === 'whole'); if (!left) break; fire('bofors', left.own); rounds++; }
  assert.equal(stage, 3, 'enough fire on what is left: SCORCHED');
  play = `three 40 mm landings cut limb 0 at ${K - c.runs[0].length} of ${K}, the MK-9 cracked the core, ${rounds} more to SCORCHED`;
}

console.log(`boss-carcass-stages.mjs: ${limbsLine}; ${K} pieces a limb of ${B.segmentHp} hp, the core ${B.coreHp} hp into ${MIN_CHUNKS}-${MAX_CHUNKS} chunks of ${B.chunkHp}; ${play}`);
