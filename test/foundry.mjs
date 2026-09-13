// foundry.mjs — the foundry's clock as invariants: the cues at their authored
// times, one barrel per cycle, the sections in order, spent once, never more.
import { FOUNDRY_TUNE } from '../src/content/foundry.js';
import { makeFoundry, deployFoundry, stepFoundry, foundryState } from '../src/domain/foundry.js';
let failures = 0;
const check = (what, ok) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const name = (e) => (typeof e === 'string' ? e : e.ev);
const run = (st, secs, cfg = FOUNDRY_TUNE) => { const log = []; for (let i = 0; i < Math.round(secs * 60); i++) { for (const e of stepFoundry(st, 1 / 60, cfg)) log.push({ t: +st.t.toFixed(3), e }); } return log; };   // t is the foundry's own clock

{
  const st = makeFoundry(FOUNDRY_TUNE);
  check('stowed: nothing happens', run(st, 30).length === 0 && st.phase === 'stowed');
  check('deploy is the only way in', deployFoundry(st) === 'deploy' && deployFoundry(st) === null);
}
{
  const cfg = FOUNDRY_TUNE, st = makeFoundry(cfg); deployFoundry(st);
  const log = run(st, cfg.deployDelay + cfg.firstCycle + 0.1);
  const names = log.map((l) => name(l.e));
  check('the first cycle: cycle, arc-on, arc-off, scrap, barrel', names.join(',') === 'cycle,arc-on,arc-off,scrap,barrel');
  const cycleT = log.find((l) => name(l.e) === 'cycle').t, at = (ev) => log.find((l) => name(l.e) === ev).t - cycleT;
  check('the cues land at the authored times', Math.abs(at('arc-on') - cfg.events.arcOn) < 0.03 && Math.abs(at('arc-off') - cfg.events.arcOff) < 0.03 && Math.abs(at('scrap') - cfg.events.scrap) < 0.03 && Math.abs(at('barrel') - cfg.events.barrel) < 0.03);
  check('scrap names the first section', log.find((l) => name(l.e) === 'scrap').e.section === cfg.sections[0]);
  check('one barrel, one section gone, waiting for the next', st.barrels === 1 && st.sections.length === cfg.sections.length - 1 && st.phase === 'waiting');
  const more = run(st, cfg.cycleSeconds * 3);
  const all = [...names, ...more.map((l) => name(l.e))];
  check('three barrels in all', st.barrels === 3 && all.filter((n) => n === 'barrel').length === 3);
  check('the sections go in order', more.filter((l) => name(l.e) === 'scrap').map((l) => l.e.section).join(',') === cfg.sections.slice(1).join(','));
  check('spent once, then silence', all.filter((n) => n === 'spent').length === 1 && st.phase === 'spent' && run(st, 60).length === 0);
  const gap = more.find((l) => name(l.e) === 'cycle').t - cycleT;
  check('the second cycle starts cycleSeconds after the first', Math.abs(gap - cfg.cycleSeconds) < 0.05);
  check('state is readable', foundryState(st).barrels === 3 && foundryState(st).sections === 0);
}
if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('foundry ok');
