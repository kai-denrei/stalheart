import assert from 'node:assert/strict';
import { createSectorRun } from '../src/fx/sector-run.js';
import { SECTORS, SECTOR_TIMING, SECTOR_GATE } from '../src/content/sectors.js';

// THE SECTOR CLOCK (docs/superpowers/specs/2026-09-24-session-pacing-design.md A and B), driven through fake hooks: no page, no
// planet. A ring of 120 cells; walking hops from the heart climb 30..59 round it; cells 200.. are the back candidates.
function world({ firstSector = 1, gate = false } = {}) {
  const w = { t: 0, enemies: [], queue: [], opened: [], briefs: [], scrambles: 0, backDoors: 0 };
  const centers = [], dist = [];
  for (let i = 0; i < 260; i++) { const a = (i / 120) * Math.PI * 2; centers.push([Math.cos(a), Math.sin(a), i >= 200 ? 1 : 0]); dist.push(i >= 200 ? 30 : 30 + (i % 30)); }
  const story = { sealed: () => false, gateCell: gate ? 5 : -1 };
  const api = { openBackDoor: () => { w.backDoors++; }, backBreachCandidates: () => [{ cell: 210, hops: 30 }, { cell: 220, hops: 31 }], backScramble: (k) => { if (k === 0) w.scrambles++; w.rings = (w.rings ?? 0) + 1; }, backOmen: (o) => { (w.omens ??= []).push(o.id); } };
  w.run = createSectorRun({
    story, api, waveSize: 4, threatMult: 1, hardcore: 'knot', spawnGap: { spread: 3.2, max: 0.45 }, store: null, rng: () => 0,
    now: () => w.t, ready: () => true, firstSector,
    field: () => ({ cellSide: 0.001, centers, dist, rim: centers.map((_, i) => (i % 2 ? 4 : 20)), inside: () => false, excluded: [], farHops: 69, fallback: () => 0 }),   // odd cells lie within a breach's blast of the base's rim
    open: (cell, o) => { const sp = { ci: cell, alive: true, obj: { cell }, quiet: !!o?.quiet }; w.opened.push(sp); return sp; },
    collapse: (sp) => { sp.alive = false; }, breaches: () => w.opened, enemies: () => w.enemies, queue: () => w.queue,
    queued: (sp) => w.queue.some((q) => q.sp === sp), push: (qs) => w.queue.push(...qs), seal: () => {}, clearField: () => {},
    poll: () => ({ passes: 0, drawn: 0, delivered: [], earned: 0, spent: 0, shieldUp: false, laser: null }),
    bank: () => ({}), pause: () => {}, brief: (id) => w.briefs.push(id), callout: () => {}, hud: () => {}, sfx: () => {}, pay: () => {},
    centers: () => centers, cellSide: () => 0.001, reload: () => {},
  });
  w.step = (secs, dt = 0.25) => { for (let k = 0; k < secs / dt; k++) { w.t += dt; w.run.tick(dt); } };
  // the board's spawner: a released pulse becomes live bodies at once (the clock rule does not care how they walk in)
  w.spawn = (entries) => { for (const q of entries) w.enemies.push({ alive: true, guard: null, breachSource: q.sp.obj, pace: q.pace, type: q.type }); };
  return w;
}

{
  const w = world();
  assert.equal(w.run.pulseGap(), null, 'no sector yet: the board keeps its own gap');
  w.step(0.5);   // the first tick begins the sector, the next opens what is due
  const s = w.run.state();
  assert.equal(s.phase, 'fighting', 'the breaches are placed at once, under the brief card');
  assert.equal(s.breaches.length, 2);
  assert.ok(s.breaches.every((b) => b.cell >= 0), 'gate breaches stand on the near ring');
  assert.ok(s.breaches.every((b) => b.cell % 2 === 0), 'never within a breach\'s blast of the base\'s rim');
  assert.equal(w.run.pulseGap(), SECTORS[0].pulse, 'the sector keeps its own clock');
  assert.equal(w.opened.length, 1, 'the first breach opens at once');
  assert.equal(w.run.canRelease(), true, 'a pulse may arm while the first breach is still opening and the second is still due');
  const first = w.run.release(w.t);
  assert.ok(first.length > 0 && first.every((q) => q.pace === SECTOR_TIMING.pace), 'every sector body marches at the sector pace');
  assert.ok(first.every((q) => q.sp === w.opened[0]), 'a breach not yet open joins a later pulse');
  w.step(2);
  assert.equal(w.opened.length, 2, 'the second breach opens a stagger later');
  assert.equal(w.opened[1].quiet, true, 'a breach opening mid-fight opens quietly');
  assert.equal(w.run.pulseOver([{ guard: { site: 'x' } }]), true, 'guards are not the sector\'s');
  assert.equal(w.run.pulseOver([{ sp: w.opened[0] }]), false);
  // the budget: a crowded field holds the next pulse, an empty one never does
  for (let i = 0; i < SECTOR_TIMING.aliveBudget; i++) w.enemies.push({ alive: true, guard: null });
  assert.equal(w.run.canRelease(), false, 'a full field holds the next pulse');
  w.enemies.length = 0;
  assert.equal(w.run.canRelease(), true, 'an empty field takes it');
}

// THE BACK DOOR: the feast first, the clock held while it is fought, then the scramble and the gate side
{
  const w = world({ firstSector: 2 });
  w.step(0.25);
  let s = w.run.state();
  assert.equal(s.breaches[0].side, 'back', 'the back breach is picked first');
  assert.equal(w.opened.length, 0, 'behind a mouth that just fell, the breach waits the lead');
  w.step(SECTOR_TIMING.backDoorLead + 0.5);
  assert.equal(w.opened.length, 1);
  assert.equal(w.opened[0].ci >= 200, true, 'the back breach opens first');
  const feast = w.run.release(w.t);
  const want = SECTORS[1].feast.entries.reduce((n, e) => n + e.count, 0);
  assert.equal(feast.length, want, 'the first back wave is the feast');
  assert.ok(feast.every((q) => ['amoeba', 'phage'].includes(q.type) && q.pace === SECTORS[1].feast.pace), 'soft bodies at the surge pace');
  assert.equal(w.run.state().breaches[0].wavesReleased, 1, 'the books count it as the first wave');
  w.spawn(feast);
  assert.equal(w.run.canRelease(), false, 'the clock holds while the feast is fought');
  w.step(20);
  assert.equal(w.opened.length, 1, 'the gate side waits for the scramble');
  assert.equal(w.scrambles, 0);
  for (const e of w.enemies.slice(0, Math.ceil(want * 0.7))) e.alive = false;   // the tank goes through them
  w.step(0.5);
  assert.equal(w.scrambles, 1, 'the scramble once the feast is mostly down');
  assert.equal(w.run.canRelease(), true, 'the clock resumes');
  w.step(SECTORS[1].feast.gateAfter + 0.5);
  assert.equal(w.opened.length, 2, 'the gate side opens after the scramble');
  const second = w.run.release(w.t);
  assert.ok(second.some((q) => q.sp === w.opened[0]) && second.some((q) => q.sp === w.opened[1]), 'then both sides on the clock');
  w.step(1);
  assert.equal(w.scrambles, 1, 'once');
}
{
  // a player who never goes to the back still gets the rest of the sector
  const w = world({ firstSector: 2 });
  w.step(SECTOR_TIMING.backDoorLead + 1);
  w.spawn(w.run.release(w.t));
  w.step(SECTORS[1].feast.timeout + 1);
  assert.equal(w.scrambles, 1, 'the scramble comes on its timeout');
}
// THE BACK DOOR RUMBLES in sector 1: the rumble with the second pulse, the crack with the last, nothing in the pulses between
{
  const w = world();
  w.step(3);
  const pulses = [];
  for (let k = 1; k <= SECTORS[0].waves; k++) { w.run.release(w.t); pulses.push([k, [...(w.omens ?? [])]]); w.step(0.5); }
  assert.deepEqual(pulses.map(([k, o]) => o.length), [0, 1, 1, 1, 1, 2], `the rumble at pulse 2, the crack at the last (${JSON.stringify(pulses)})`);
  assert.deepEqual(w.omens, ['rumble', 'crack']);
}
{
  // the scramble's markers ring for their seconds and then stop
  const w = world({ firstSector: 2 });
  w.step(SECTOR_TIMING.backDoorLead + 1);
  w.spawn(w.run.release(w.t));
  for (const e of w.enemies) e.alive = false;
  w.step(20);
  assert.equal(w.scrambles, 1);
  assert.ok(w.rings >= 6 && w.rings <= 10, `the sockets ring for BACK_SCRAMBLE.seconds (${w.rings})`);
  assert.equal(w.omens, undefined, 'no omens once the door has fallen');
}
// ISAO WAITS FOR THE LANE TO CLEAR before a repair trip: a body within quietCells of a standing door makes the doors loud
{
  const w = world({ gate: true });
  w.step(0.5);
  assert.equal(w.run.doorsQuiet(), true, 'an empty lane is quiet');
  w.enemies.push({ alive: true, guard: null, pos: [Math.cos(5 / 120 * Math.PI * 2), Math.sin(5 / 120 * Math.PI * 2), 0], cur: 5, spec: { rammable: true } });
  w.step(0.25);
  assert.equal(w.run.doorsQuiet(), false, 'a body at the gate is not');
  w.enemies[0].alive = false; w.step(0.25);
  assert.equal(w.run.doorsQuiet(), true, 'and quiet again once it is gone');
  w.enemies.push({ alive: true, guard: null, harmless: true, pos: w.enemies[0].pos, cur: 5, spec: { rammable: true } });
  w.step(0.25);
  assert.equal(w.run.doorsQuiet(), true, 'harmless fodder at the gate neither wears it nor keeps Isao off it');
  w.step(3); assert.equal(w.run.state().gate.hp, SECTOR_GATE.hp, 'the gate is untouched');
}
console.log('Sector run: the back door\'s omens, breaches open under the card, pulses on the clock and under the budget, the feast, the scramble and the gate side after it.');
