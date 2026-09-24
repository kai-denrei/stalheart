// sim-run.mjs — the wave simulator's run end (src/platform/sim-run.js) over a recording host and a stand-in page: nothing before
// the end; a timeout past the cap; a cleared sector breaches the next one (the camera back on the tank) unless ?simscope=sector,
// and a run that cannot go on is 'stalled'; a lost heart is a loss; the result is published once, schema 2, to the diagnostics
// ring, window.__stalheartSimResult, the SIMRESULT console line and a framed page's parent (whose refusal is swallowed).
import assert from 'node:assert/strict';
import { createSimRun } from '../src/platform/sim-run.js';
import { diagnosticBundle } from '../src/diagnostics.js';
import { ROSTER } from '../src/towers.js';

function run({ search = '', framed = null, next = true } = {}) {
  const log = [], s = { simDone: false, heartHP: 10, playerHP: 3, round: 1, wave: 4, t: 12, simCap: 180, simStyle: 'style1', ecoClockT: 100, ecoAffordT: 25,
    score: { points: 777 }, eco: { biomass: 60, earned: 300, spent: 250, peak: 320, starting: 190, ledger: { refunds: 40, bounty: 12 } } };
  const player = { won: false }, params = { seed: -1, directive: 'ram' };
  const host = { player, params, towers: [{}, {}], simCurve: [{ w: 1 }], campaign: [], SECTORS_TOTAL: 5,
    endShot: () => log.push('endShot'), breachNextSector: () => { log.push('next'); return next; }, setView: (v) => log.push(`view ${v}`), setSimDone: (v) => { s.simDone = v; } };
  for (const k of ['simDone', 'heartHP', 'playerHP', 'round', 'wave', 't', 'simCap', 'simStyle', 'score', 'eco', 'ecoClockT', 'ecoAffordT']) host[k] = () => s[k];
  const win = {}; win.parent = framed ?? win;
  globalThis.window = win; globalThis.location = { search, origin: 'http://127.0.0.1:1' };
  globalThis.document = { querySelector: (q) => (q === 'meta[name="cb"]' ? { content: 'abc123' } : null) };
  const lines = [], { simWatch } = createSimRun(host);
  const watch = () => { const real = console.log; console.log = (l) => lines.push(l); try { simWatch(); } finally { console.log = real; } };
  return { s, log, lines, player, win, watch };
}
// NOTHING BEFORE THE END; a timeout past the cap, published once
{
  const r = run(); r.watch(); assert.equal(r.win.__stalheartSimResult, undefined);
  r.s.t = 181; r.watch();
  const p = r.win.__stalheartSimResult;
  assert.equal(p.outcome, 'timeout'); assert.equal(r.s.simDone, true);
  assert.deepEqual(Object.keys(p), ['schema', 'application', 'build', 'scope', 'balance', 'content', 'generator', 'roster', 'mission', 'runId', 'config', 'simulationStep', 'style', 'seed', 'outcome', 'wave', 'round', 'score', 'heart', 'lives', 'towers', 'biomass', 'simT', 'curve', 'sectors', 'economy']);
  assert.deepEqual([p.schema, p.build, p.scope, p.roster, p.mission, p.runId, p.seed, p.simT, p.score, p.towers, p.simulationStep], [2, 'abc123', 'campaign', ROSTER.id, 'defense', 'standalone', 4294967295, 181, 777, 2, 1 / 30]);
  assert.deepEqual(p.economy, { earned: 300, spent: 250, peak: 320, held: 60, starting: 190, ledger: { refunds: 40, bounty: 12 }, netSpent: 210, spendRatio: 0.43, affordable: 0.25, perWave: 75 });
  assert.deepEqual(r.lines, ['SIMRESULT ' + JSON.stringify(p)]);
  assert.equal(diagnosticBundle().events.filter((e) => e.type === 'sim.result').length, 1);
  r.s.t = 999; r.watch(); assert.equal(r.lines.length, 1, 'a finished run publishes nothing more');
}
// A CLEARED SECTOR goes on to the next one; one that cannot is stalled; ?simscope=sector reports the clear; a lost heart a loss
{
  const r = run(); r.player.won = true; r.watch();
  assert.deepEqual(r.log, ['endShot', 'next', 'endShot', 'view third']); assert.equal(r.win.__stalheartSimResult, undefined);
  const stuck = run({ next: false }); stuck.player.won = true; stuck.watch();
  assert.deepEqual([stuck.log, stuck.win.__stalheartSimResult.outcome], [['endShot', 'next'], 'stalled']);
  const parent = []; const scoped = run({ search: '?simscope=sector&mission=raid&runid=r7', framed: { postMessage: (m, o) => parent.push([m, o]) } }); scoped.player.won = true; scoped.watch();
  const p = scoped.win.__stalheartSimResult;
  assert.deepEqual([p.outcome, p.scope, p.mission, p.runId, scoped.log], ['sector-clear', 'sector', 'raid', 'r7', []]);
  assert.deepEqual(parent, [[{ simresult: p }, 'http://127.0.0.1:1']], 'the framing page hears the result');
  const lost = run({ framed: { postMessage: () => { throw Error('sandboxed'); } } }); lost.player.won = true; lost.s.heartHP = 0; lost.watch();
  assert.equal(lost.win.__stalheartSimResult.outcome, 'loss', 'a refusing parent is swallowed');
}
console.log('Sim run: nothing before the end, timeout past the cap, the next sector or stalled, the scoped clear, the loss; one schema-2 result everywhere it goes.');
