// THE WAVE SIMULATOR'S RUN END (?sim=; the default suite's sim-roster-2 step): the watch the frame loop calls after each
// fast-forward batch, and the schema-2 result it publishes: the diagnostics record, window.__stalheartSimResult for the acceptance
// runs, a SIMRESULT console line for the batch runner and, in a frame, a message to the Workshop's sim tab (src/simresult.js
// reads it back). Moved out of the controller unchanged: a cleared sector breaches the next one unless ?simscope=sector, a run
// that cannot go on is 'stalled', one past ?simcap= sim-seconds a 'timeout'.
//
// `host` hands in the controller: its fixed objects and functions as values (player, params, towers, simCurve, campaign,
// endShot, breachNextSector, setView, SECTORS_TOTAL), what it rebinds as getters (simDone, heartHP, playerHP, round, wave, t,
// simCap, simStyle, score, eco, ecoClockT, ecoAffordT) and setSimDone for the one let the result writes (the frame loop reads it).
import { record } from '../diagnostics.js';
import { CONTENT } from '../content/runtime.js';
import { ROSTER } from '../towers.js';
import { simOutcome } from '../domain/campaign.js';

export function createSimRun(host) {
  const { player, params, towers, simCurve, campaign, endShot, breachNextSector, setView, SECTORS_TOTAL } = host;
  function simWatch() {
    if (host.simDone()) return;
    if (player.won) {
      const outcome = simOutcome({ heart: host.heartHP(), lives: host.playerHP(), round: host.round(), total: SECTORS_TOTAL });
      if (outcome === 'sector-clear' && new URLSearchParams(location.search).get('simscope') !== 'sector') {
        endShot();
        if (!breachNextSector()) { simEmit('stalled'); return; }
        endShot(); setView('third');
        return;
      }
      simEmit(outcome);
    }
    else if (host.t() > host.simCap()) simEmit('timeout');
  }
  function simEmit(outcome) {
    host.setSimDone(true);
    const payload = { schema: 2, application: 'stalheart',
      build: document.querySelector('meta[name="cb"]')?.content || 'source',
      scope: new URLSearchParams(location.search).get('simscope') === 'sector' ? 'sector' : 'campaign',
      balance: 'migration-1', content: CONTENT.id, generator: 'research-1900c9d', roster: ROSTER.id,
      mission: new URLSearchParams(location.search).get('mission') || 'defense',
      runId: new URLSearchParams(location.search).get('runid') || 'standalone',
      config: { ...params }, simulationStep: 1 / 30,
      style: host.simStyle(), seed: params.seed >>> 0, outcome, wave: host.wave(), round: host.round(),
      score: host.score().points, heart: host.heartHP(), lives: host.playerHP(),
      towers: towers.length, biomass: host.eco().biomass, simT: Math.round(host.t()),
      curve: simCurve, sectors: campaign,
      // ECONOMY MEASURE (operator, 2026-09-02: "biomass is much too easy to
      // acquire, but rather than going by feel, let's be systematic"). Two
      // numbers the feeling turns on: how much of the run the purse could
      // afford the cheapest tower without waiting (a purse that is never short
      // is not an economy), and how much of what was earned was ever spent.
      // The controller's frame loop runs the two clocks (ecoClockT, ecoAffordT).
      economy: {
        earned: host.eco().earned, spent: host.eco().spent, peak: host.eco().peak, held: host.eco().biomass,
        starting: host.eco().starting, ledger: host.eco().ledger, netSpent: host.eco().spent - host.eco().ledger.refunds,
        spendRatio: host.eco().starting + host.eco().earned ? +((host.eco().spent - host.eco().ledger.refunds) / (host.eco().starting + host.eco().earned)).toFixed(2) : 0,
        affordable: host.ecoClockT() ? +(host.ecoAffordT() / host.ecoClockT()).toFixed(2) : 0,
        perWave: host.wave() ? Math.round(host.eco().earned / host.wave()) : 0,
      } };
    record('sim.result', payload);
    window.__stalheartSimResult = payload;
    console.log('SIMRESULT ' + JSON.stringify(payload));
    try {
      if (window.parent !== window) window.parent.postMessage({ simresult: payload }, location.origin);
    } catch { /* sandboxed parent */ }
  }
  return { simWatch, simEmit };
}
