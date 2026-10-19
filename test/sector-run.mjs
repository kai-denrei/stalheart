import assert from 'node:assert/strict';
import { createSectorRun } from '../src/fx/sector-run.js';
import { SECTORS, SECTOR_TIMING, SECTOR_GATE, SECTOR_DOOR, BACK_DOOR_SECTOR, SIDE_BREACH, CANYON, SECTOR_HOLD, BOTH_WALLS_SECTOR, SECTOR_GENERATOR, SECTOR_CANYON_AGAIN } from '../src/content/sectors.js';
import { sectorDef } from '../src/domain/sectors.js';

// THE SECTOR CLOCK (docs/superpowers/specs/2026-09-24-session-pacing-design.md A and B), driven through fake hooks: no page, no
// planet. A ring of 120 cells; walking hops from the heart climb 30..59 round it; cells 200.. are the back candidates.
function world({ canyon = { floor: [250, 251], rock: [252], spawn: 250, mouth: 251, axis: [1, 0, 0] }, firstSector = 1, gate = false, lateStart = true, bossStart = false, delivered = [], unlocked = false, sideCandidates = [{ cell: 240, carve: [241, 242, 243] }], backCandidates = [{ cell: 210, hops: 30 }, { cell: 221, hops: 40 }, { cell: 220, hops: 31 }], hold = undefined, clockHeld = () => false, excluded = [] } = {}) {
  const w = { t: 0, enemies: [], queue: [], opened: [], briefs: [], scrambles: 0, backDoors: 0 };
  const centers = [], dist = [];
  for (let i = 0; i < 260; i++) { const a = (i / 120) * Math.PI * 2; centers.push([Math.cos(a), Math.sin(a), i >= 200 ? 1 : 0]); dist.push(i >= 200 ? 30 : 30 + (i % 30)); }
  const story = { sealed: () => false, gateCell: gate ? 5 : -1, lateStart, bossStart, expeditions: unlocked ? { sites: [{ id: 'a', state: 'delivered' }] } : null };
  const api = { openBackDoor: () => { w.backDoors++; }, backBreachCandidates: () => backCandidates, /* by default 221 is the farthest, and within a blast of the rim */ backScramble: (k) => { if (k === 0) w.scrambles++; w.rings = (w.rings ?? 0) + 1; }, backOmen: (o) => { (w.omens ??= []).push(o.id); }, sideBreachCandidates: () => sideCandidates, canyonPlan: () => canyon, canyonCut: (plan) => { w.cut = plan; }, canyonPass: (o) => { w.pass = o; }, breakSide: (cells) => { (w.broken ??= []).push(...cells); return cells.length; } };
  w.run = createSectorRun({
    story, api, waveSize: 4, threatMult: 1, hardcore: 'knot', spawnGap: { spread: 3.2, max: 0.45 }, store: null, rng: () => 0,
    ready: () => true, firstSector,
    field: () => ({ cellSide: 0.001, centers, dist, rim: centers.map((_, i) => (i % 2 ? 4 : 20)), inside: () => false, excluded, farHops: 69, fallback: () => 0 }),   // odd cells lie within a breach's blast of the base's rim
    open: (cell, o) => { const sp = { ci: cell, alive: true, obj: { cell }, quiet: !!o?.quiet, clear: o?.clear, keep: !!o?.keep }; w.opened.push(sp); return sp; },
    collapse: (sp) => { sp.alive = false; }, breaches: () => w.opened, enemies: () => w.enemies, queue: () => w.queue,
    queued: (sp) => w.queue.some((q) => q.sp === sp), push: (qs) => w.queue.push(...qs), seal: () => {}, clearField: () => {},
    poll: () => ({ passes: 0, drawn: 0, delivered, earned: 0, spent: 0, shieldUp: false, laser: null }),
    bank: () => ({}), pause: () => {}, brief: (id) => w.briefs.push(id), callout: () => {}, hud: () => {}, sfx: () => {}, pay: () => {},
    centers: () => centers, cellSide: () => 0.001, reload: () => {}, hold, clockHeld,
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
  // THE BREATH (2026-10-15, sector shapes): the next pulse waits for the sector's pulse to pass AND the last one to be mostly dead, or its ceiling
  w.spawn(first);
  assert.equal(w.run.canRelease(), false, 'the pulse has not passed');
  w.step(SECTORS[0].pulse + 1);
  assert.equal(w.run.canRelease(), false, 'the wave is still up: the breath holds');
  for (const e of w.enemies.slice(0, Math.ceil(w.enemies.length * (1 - SECTORS[0].breath.at)))) e.alive = false;
  assert.equal(w.run.canRelease(), true, 'mostly dead and the pulse passed: due');
  w.enemies.forEach((e) => { e.alive = true; });
  w.step(SECTORS[0].breath.max);
  assert.equal(w.run.canRelease(), true, 'the ceiling: a player who falls behind is stacked');
  w.enemies.length = 0;
}

// ?boss=1 (2026-10-16): a run opened past the door's earliest opens ON THE BOSS, the door counted as the sector before
{
  const w = world({ firstSector: SECTOR_DOOR.earliest + 1, bossStart: true });
  w.step(0.25);
  assert.equal(w.run.state().name, 'THE ARENA', `opens on the boss sector, THE ARENA (${w.run.state().name})`); assert.equal(w.run.state().doorAt, SECTOR_DOOR.earliest);
  const w2 = world({ firstSector: SECTOR_DOOR.earliest + 1 });
  w2.step(0.25);
  assert.equal(w2.run.state().name, 'THE BACK DOOR', 'without the flag the late start is the door, as before');
}
// THE BACK DOOR: the feast first, the clock held while it is fought, then the scramble and the gate side
{
  const w = world({ firstSector: SECTOR_DOOR.earliest });
  w.step(0.25);
  let s = w.run.state();
  assert.equal(s.breaches[0].side, 'back', 'the back breach is picked first');
  assert.equal(w.opened.length, 0, 'behind a mouth that just fell, the breach waits the lead');
  w.step(SECTOR_TIMING.backDoorLead + 0.5);
  assert.equal(w.opened.length, 1);
  assert.equal(w.opened[0].ci >= 200, true, 'the back breach opens first');
  assert.notEqual(w.opened[0].ci, 221, 'never where its blast reaches the base\'s rim, however far out it stands');
  const feast = w.run.release(w.t);
  const want = BACK_DOOR_SECTOR.feast.entries.reduce((n, e) => n + e.count, 0);
  assert.equal(feast.length, want, 'the first back wave is the feast');
  assert.ok(feast.every((q) => ['amoeba', 'phage'].includes(q.type) && q.pace === BACK_DOOR_SECTOR.feast.pace), 'soft bodies at the surge pace');
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
  w.step(BACK_DOOR_SECTOR.feast.gateAfter + 0.5);
  assert.equal(w.opened.length, 2, 'the gate side opens after the scramble');
  const second = w.run.release(w.t);
  assert.ok(second.some((q) => q.sp === w.opened[0]) && second.some((q) => q.sp === w.opened[1]), 'then both sides on the clock');
  w.step(1);
  assert.equal(w.scrambles, 1, 'once');
}
{
  // the back breach sealed before its feast rose: the gate side opens anyway, and the sector can be secured
  const w = world({ firstSector: SECTOR_DOOR.earliest });
  w.step(SECTOR_TIMING.backDoorLead + 0.5);
  assert.equal(w.opened.length, 1);
  w.run.closed(w.opened[0], 'laser');
  w.step(2);
  assert.equal(w.opened.length, 2, 'the gate side opens without a feast to wait for');
  assert.equal(w.scrambles, 0, 'and Isao asks for no turrets against a breach that is shut');
}
{
  // a feast sector that found no back ground: its breaches all stand on the gate side and none of them waits for a feast
  const w = world({ firstSector: SECTOR_DOOR.earliest, backCandidates: [] });
  w.step(SECTOR_TIMING.backDoorLead + 3);
  assert.deepEqual(w.run.state().breaches.map((b) => b.side), ['gate', 'gate']);
  assert.equal(w.opened.length, 2, 'both open, one after the other');
}
{
  // a player who never goes to the back still gets the rest of the sector
  const w = world({ firstSector: SECTOR_DOOR.earliest });
  w.step(SECTOR_TIMING.backDoorLead + 1);
  w.spawn(w.run.release(w.t));
  w.step(BACK_DOOR_SECTOR.feast.timeout + 1);
  assert.equal(w.scrambles, 1, 'the scramble comes on its timeout');
}
// THE BACK DOOR RUMBLES in the sector before it (2026-10-01: the schedule decides the door a sector ahead): the rumble with the
// second pulse, the crack with the last, nothing in the pulses between, and nothing in a sector the door does not follow
{
  // (the sector before the door is the canyon again; with no canyon to cut on this planet it runs as a held sector, and its pulses
  // carry the omens exactly as a held one's would. The canyon's own run is tested below.)
  const w = world({ firstSector: SECTOR_DOOR.earliest - 1, unlocked: true, canyon: null });   // everything unlocked: the door is next
  w.step(3);
  assert.equal(w.run.state().doorAt, SECTOR_DOOR.earliest, 'the door is decided at the start of the sector before it');
  assert.equal(w.run.state().name, SECTOR_CANYON_AGAIN.name, 'the sector before the door is the canyon again');
  const pulses = [], waves = sectorDef(SECTOR_DOOR.earliest - 1, SECTORS, SECTOR_GENERATOR, { hold: SECTOR_HOLD, door: BACK_DOOR_SECTOR, both: BOTH_WALLS_SECTOR, doorAt: SECTOR_DOOR.earliest, canyonAgain: SECTOR_CANYON_AGAIN }).waves;
  for (let k = 1; k <= waves; k++) { w.run.release(w.t); pulses.push([k, [...(w.omens ?? [])]]); w.step(0.5); }
  assert.deepEqual(pulses.map(([k, o]) => o.length), [0, ...Array(waves - 2).fill(1), 2], `the rumble at pulse 2, the crack at the last (${JSON.stringify(pulses)})`);
  assert.deepEqual(w.omens, ['rumble', 'crack']);
}
{
  const w = world();
  w.step(3);
  for (let k = 1; k <= SECTORS[0].waves; k++) { w.run.release(w.t); w.step(0.5); }
  assert.equal(w.omens, undefined, 'sector 1 is quiet: the door is sectors away');
  assert.equal(w.run.state().doorAt, null);
}
{
  // EVERYTHING UNLOCKED: the door is next as soon as the schedule allows, a sector ahead of earliest
  const w = world({ firstSector: SECTOR_DOOR.earliest - 1, unlocked: true });
  w.step(0.5);
  assert.equal(w.run.state().doorAt, SECTOR_DOOR.earliest);
  // a late start (a drawer jump, the harness) one sector before the earliest door is the canyon again with the door next, whatever is
  // unlocked; a run that walks there from sector 1 decides on backDoorNext alone
  const w2 = world({ firstSector: SECTOR_DOOR.earliest - 1 });
  w2.step(0.5);
  assert.equal(w2.run.state().doorAt, SECTOR_DOOR.earliest, 'a late start one before the earliest: the door next');
  const w3 = world({ firstSector: SECTOR_DOOR.earliest - 2 });
  w3.step(0.5);
  assert.equal(w3.run.state().doorAt, null, 'not unlocked and not at latest: held');
}
{
  // the scramble's markers ring for their seconds and then stop
  const w = world({ firstSector: SECTOR_DOOR.earliest });
  w.step(SECTOR_TIMING.backDoorLead + 1);
  w.spawn(w.run.release(w.t));
  for (const e of w.enemies) e.alive = false;
  w.step(20);
  assert.equal(w.scrambles, 1);
  assert.ok(w.rings >= 6 && w.rings <= 10, `the sockets ring for BACK_SCRAMBLE.seconds (${w.rings})`);
  assert.equal(w.omens, undefined, 'no omens once the door has fallen');
}
// THE SIDE WALL (sector 5, owner 2026-10-01: "it reveals that the walls can be breached"): the side breach is placed first from the
// host's candidates, opens with its own small blast, breaks the wall on its lane and says so; with no candidate it is a gate breach
{
  const w = world({ firstSector: 5 });
  w.step(0.5);
  const s = w.run.state();
  assert.equal(s.name, SECTORS[4].name);
  assert.deepEqual(s.breaches.map((b) => b.side), ['side', 'gate'], 'the side breach first, then the lane');
  assert.equal(s.breaches[0].cell, 240);
  assert.equal(w.opened[0].clear, SIDE_BREACH.clearRadius, 'its blast is the side breach\'s own, not a breach\'s six cells');
  assert.deepEqual(w.broken, [241, 242, 243], 'its lane and the wall are broken as it opens');
  assert.equal(s.breaches[0].broke, true);
  assert.ok(w.briefs.includes(SIDE_BREACH.brief), 'Isao says the wall is breached');
  const w2 = world({ firstSector: 5, sideCandidates: [] });
  w2.step(0.5);
  assert.deepEqual(w2.run.state().breaches.map((b) => b.side), ['gate', 'gate'], 'no place for it: both on the gate side');
  assert.equal(w2.broken, undefined);
}
// THE CANYON (sector 3, owner 2026-10-01: SOL-82's first use): the canyon is cut as the sector begins, its breach opens quietly and
// unsealable after the gate's, sends one swarm of five two-breach pulses, which the frame budget does not weigh against the base's own
// waves; once all of it is up and has had its seconds, the pass is laid over the canyon with its own numbers
{
  const w = world({ firstSector: 3 });
  w.step(0.25);
  let s = w.run.state();
  assert.equal(s.name, 'THE CANYON');
  assert.equal(w.cut?.spawn, 250, 'the canyon is cut as the sector begins');
  assert.deepEqual(s.breaches.map((b) => b.side), ['gate', 'canyon']);
  assert.equal(s.breaches[1].wavesPlanned, 1, 'the canyon sends its swarm once');
  w.step(2);
  const far = w.opened.find((sp) => sp.ci === 250);
  assert.ok(far && far.quiet && !far.keep, 'it opens quietly and SOL-82 may seal it (2026-10-15: the hole stays open for the beam)');
  assert.equal(w.opened.length, 1, 'the base\'s breach waits: the player will be in SOL-82\'s seat');
  assert.ok(w.briefs.includes(CANYON.brief), 'Isao sees them rise');
  const pulse = w.run.release(w.t), swarm = pulse.filter((q) => q.sp === far);
  const one = (await import('../src/enemyspec.js')).computeWavePlan(SECTORS[2].ladderStart + CANYON.ladder, 1, 4, SECTORS[2].threat).entries.reduce((n, e) => n + e.count, 0);
  const bodies = swarm.reduce((n, q) => n + (q.squad || 1), 0);   // a big swarm comes partly in squads (src/domain/squads.js)
  assert.equal(bodies, CANYON.bodies.first, `the canyon's own count at once (${bodies} bodies, the ladder's mix of ${one})`); assert.ok(swarm.some((q) => q.squad), 'the swarm packs squads');
  assert.ok(swarm.every((q) => q.spread === CANYON.spread && q.dens === CANYON.dens), 'risen with the canyon\'s scatter, drawn light');
  { const column = [250, 251].slice(0, Math.max(1, Math.round(2 * CANYON.fill)));   // the deepest `fill` of this world's two-cell floor
    assert.ok(swarm.every((q) => column.includes(q.cell)) && column.every((c) => swarm.some((q) => q.cell === c)), `a column along the deep floor, every cell of it taken (2026-10-15; ${JSON.stringify(column)})`); }
  w.spawn(pulse);
  w.step(CANYON.seatAfter - 1);
  assert.equal(w.pass, undefined, 'the pass waits for the canyon to fill');
  w.step(1.5);
  assert.deepEqual([w.pass?.overhead, w.pass?.energy, w.pass?.radius], [CANYON.pass.overhead, CANYON.pass.energy, CANYON.pass.radius], 'the canyon\'s pass, with its own numbers');
  assert.deepEqual(w.pass.axis, [1, 0, 0], 'forward along the canyon');
  assert.ok(w.briefs.includes(CANYON.passBrief));
  assert.equal(w.run.state().canyon.phase, 'pass');
  assert.equal(w.run.state().secure, false, 'the swarm is still the sector\'s: it must be burned or fought');
  assert.ok(w.run.state().breaches.find((b) => b.side === 'canyon').live, 'the hole stands open under the pass for the beam to seal (2026-10-15)');
  w.step(CANYON.pass.overhead + CANYON.gateAfter - 1);
  assert.equal(w.opened.length, 1, 'the gate side still waits while the pass is up');
  w.step(2);
  assert.equal(w.opened.length, 2, 'the pass over, the gate side opens');
  assert.ok(!w.run.state().breaches.find((b) => b.side === 'canyon').live, 'the pass over and the beam never on it: the hole collapses on its own');
  assert.equal(w.run.canRelease(), true, 'the swarm on the far side does not hold the base\'s pulses');
}

// THE QUEUE NEED NOT EMPTY (owner, 2026-10-16: 'sector 3, the canyon: it fails to unlock and give us the SOL control'): the crowd gate on a slow
// machine holds part of the column in the queue, which only drains as the base kills far away; CANYON.queueWait seconds after the first body is
// up the pass is laid anyway
{
  const w = world({ firstSector: 3 });
  w.step(2.25);
  const far = w.opened.find((sp) => sp.ci === 250), pulse = w.run.release(w.t);
  w.queue.push(...pulse.filter((q) => q.sp === far));   // held at the gate: none of it spawned, all of it queued
  w.step(CANYON.seatAfter + 1);
  assert.equal(w.pass, undefined, 'the pass still waits on the queue inside queueWait');
  w.step(CANYON.queueWait + CANYON.seatAfter);
  assert.ok(w.pass && w.run.state().canyon.phase === 'pass', `the pass comes queueWait (and seatAfter) seconds after the first body is up, the queue still held (${JSON.stringify(w.run.state().canyon)})`);
}
{
  const w = world({ firstSector: 3, canyon: null });
  w.step(0.25);
  assert.deepEqual(w.run.state().breaches.map((b) => b.side), ['gate'], 'no canyon to be cut: the gate alone');
}
// THE SECTOR'S OWN CLOCK: time the world spends frozen or paused (no tick) does not count, so nothing the sector waits for runs
// out behind a dive shot
{
  const w = world({ firstSector: SECTOR_DOOR.earliest });
  w.step(0.5);
  assert.equal(w.opened.length, 0, 'behind the fallen mouth the breach waits the lead');
  w.t += 60;   // a minute of frozen world: the controller does not tick the sector
  w.run.tick(0.25);
  assert.equal(w.opened.length, 0, 'the lead is sector time, not the page\'s');
  w.step(SECTOR_TIMING.backDoorLead);
  assert.equal(w.opened.length, 1, 'and runs out once the world does');
}

// THE FIRST SECTOR WAITS FOR THE EXPEDITION on a run that played into it: a part home, or the grace
{
  const delivered = [];
  const w = world({ lateStart: false, delivered });
  w.step(10);
  assert.equal(w.run.state().phase, 'idle', 'the tank is out on its first expedition');
  delivered.push('rocket-a'); w.step(0.5);
  assert.equal(w.run.state().phase, 'fighting', 'the part home opens sector 1');
}
{
  const w = world({ lateStart: false });
  w.step(SECTOR_TIMING.firstGrace - 1);
  assert.equal(w.run.state().phase, 'idle');
  w.step(1.5);
  assert.equal(w.run.state().phase, 'fighting', 'the grace opens it whatever the tank is doing');
}
{
  const w = world({ lateStart: false, firstSector: SECTOR_DOOR.earliest });
  w.step(0.5);
  assert.notEqual(w.run.state().phase, 'idle', 'a run opened past the lane (the back door jump) opens at once');
  assert.equal(w.run.state().name, BACK_DOOR_SECTOR.name, 'opened at the door\'s earliest: the door');
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
// THE ENDING BEFORE THE SCORE (owner, 2026-10-06, twenty-seventh notes, 9: "play as a celebration cinematic AFTER the final wave, before
// the score is looked at"): the door sector held shows its report at once; the sector after it (BOTH WALLS) held plays the host's finale
// first, its report when the finale hands back, then the campaign card, and leaving the card goes straight on, no finale again
{
  const w = world({ firstSector: SECTOR_DOOR.earliest, unlocked: true, canyon: null }), log = [];
  const debrief = { show: () => log.push(['report', run.state().n]), showCampaign: () => log.push(['campaign']), hide: () => {}, isOpen: () => false };
  let hand = null;
  // the same world with a finale and a fake card: rebuilt through its own hooks
  const api = { openBackDoor: () => {}, backBreachCandidates: () => [], sideBreachCandidates: () => [], canyonPlan: () => null, finale: (then) => { log.push(['finale']); hand = then; return true; }, engaged: () => !!ww.engaged, bossTalking: () => !!ww.talking };
  const { createSectorRun: make } = await import('../src/fx/sector-run.js');
  const centers = [], dist = [];
  for (let i = 0; i < 260; i++) { const a = (i / 120) * Math.PI * 2; centers.push([Math.cos(a), Math.sin(a), i >= 200 ? 1 : 0]); dist.push(i >= 200 ? 30 : 30 + (i % 30)); }
  const ww = { t: 0, enemies: [], queue: [], opened: [] };
  const story = { sealed: () => false, gateCell: -1, lateStart: true, expeditions: { sites: [{ id: 'a', state: 'delivered' }] }, arena: { cell: 230, hops: 30 } };   // the arena's cell (2026-10-16)
  const run = make({
    story, api, waveSize: 4, threatMult: 1, hardcore: 'knot', spawnGap: { spread: 3.2, max: 0.45 }, store: null, rng: () => 0, ready: () => true, firstSector: SECTOR_DOOR.earliest,
    field: () => ({ cellSide: 0.001, centers, dist, rim: centers.map((_, i) => (i % 2 ? 4 : 20)), inside: () => false, excluded: [], farHops: 69, fallback: () => 0 }),
    open: (cell, o) => { const sp = { ci: cell, alive: true, obj: { cell }, quiet: !!o?.quiet, clear: o?.clear, keep: !!o?.keep, radius: o?.radius }; ww.opened.push(sp); return sp; },
    collapse: (sp) => { sp.alive = false; }, breaches: () => ww.opened, enemies: () => ww.enemies, queue: () => ww.queue,
    queued: (sp) => ww.queue.some((q) => q.sp === sp), push: (qs) => ww.queue.push(...qs), seal: () => {}, clearField: () => {},
    poll: () => ({ passes: 0, drawn: 0, delivered: ['a'], earned: 0, spent: 0, shieldUp: false, laser: null }),
    bank: () => ({}), pause: () => {}, brief: () => {}, callout: () => {}, hud: () => {}, sfx: () => {}, pay: () => {},
    centers: () => centers, cellSide: () => 0.001, reload: () => log.push(['reload']), makeDebrief: () => debrief,
  });
  const step = (secs, dt = 0.25) => { for (let k = 0; k < secs / dt; k++) { ww.t += dt; run.tick(dt); } };
  // hold a sector: every pulse released and spawned, every body killed, the breaches spent, the secure pause out
  const hold = () => {
    for (let guard = 0; guard < 400 && run.state().phase === 'fighting'; guard++) {
      run.release(ww.t); step(0.5);
      ww.enemies.push(...ww.queue.splice(0).map((q) => ({ alive: false, guard: null, breachSource: q.sp.obj, type: q.type })));
      step(SECTOR_TIMING.stall + 1);
    }
    assert.ok(['secure', 'finale', 'debrief'].includes(run.state().phase), `held (${run.state().phase})`);
    step(SECTOR_TIMING.securePause + 1);
  };
  step(1); assert.equal(run.state().n, SECTOR_DOOR.earliest, 'the door sector'); assert.equal(run.state().doorAt, SECTOR_DOOR.earliest);
  hold();
  assert.deepEqual(log, [['report', SECTOR_DOOR.earliest]], 'the door sector held: its report, no finale');
  // THE BOSS (2026-10-15): the sector after the door, held like any; BOTH WALLS, the final sector, after it
  run.test.cont(); step(1); assert.equal(run.state().n, SECTOR_DOOR.earliest + 1, 'THE ARENA'); assert.equal(run.state().name, 'THE ARENA');
  // STRAIGHT TO THE MOTHER (owner, 2026-10-19, round 4, note 4: "skip the "boss phase 1" of smaller reed ... straight to the boss nih-dairia"): the arena's one
  // pulse is the mother, and it goes at the first release the open breach allows (a sector's first pulse is due at once, pulseDue)
  { let q = [], tries = 0, opened = null; for (let g = 0; g < 200 && !q.length; g++) { if (opened == null && ww.opened.length && ww.opened.at(-1).ci === 230) opened = g; q = run.release(ww.t) ?? []; ww.queue.push(...q); tries = g; step(0.5); }   // release() returns the entries the controller queues (src/fx/enemy-step.js: into the spawn queue at once)
    assert.equal(q.length, 1, `the arena row's one pulse: one entry (${q.length}; ${JSON.stringify(run.state().breaches?.[0] ?? run.state())})`);
    assert.ok(q.every((e) => e.type === 'reed' && e.tier === 'huge' && e.hunter && e.spec?.hp === 180 && e.sp && !e.sizeMul), `the mother, a hunter at 180 off the breach (${JSON.stringify(q[0])})`);
    assert.ok(opened != null && tries <= opened, `released the first try the hole is open (opened at try ${opened}, released at ${tries})`);
    const ab = ww.opened.at(-1); assert.deepEqual([ab.ci, ab.radius, ab.keep], [230, 3, true], `the arena's breach on the story's arena cell, three cells wide, kept (${JSON.stringify(ab)})`);
    assert.equal(run.state().breaches?.[0]?.side, 'arena', 'the arena side'); }
  { // NO STRAGGLERS AND NO STALL IN A BOSS SECTOR (2026-10-16): the mother alone, alive and unhurt for twenty seconds, holds the arena open where a held
    // sector's twenty stragglers or twenty idle seconds would close it
    const dead = (q) => ({ alive: false, guard: null, breachSource: q.sp.obj, type: q.type }); let boss = null;
    for (let g = 0; g < 60 && !boss; g++) { run.release(ww.t);
      if ((run.state().breaches?.[0]?.wavesReleased ?? 0) >= 1) { boss = { alive: true, guard: null, hunter: true, tier: 'huge', breachSource: ww.opened.at(-1).obj, type: 'reed' }; ww.enemies.push(boss); }   // the mother up with the last wave
      step(0.5); ww.enemies.push(...ww.queue.splice(0).map(dead)); if (!boss) step(SECTOR_TIMING.stall + 1); }
    assert.ok(boss, 'the one pulse released (note 4)');
    step(SECTOR_TIMING.stall + 5); assert.equal(run.state().phase, 'fighting', `the mother alive holds the arena open (${run.state().phase})`);
    // THE BOSS'S DEATH IS THE SECTOR'S END (owner, 2026-10-18, note 10: "kill Nih Dairia fails to trigger the next phase"; probe r3-g): the stragglers the door
    // sector left alive (50 in the probe, walking or stuck by the base), a small Reed and a pup that walked off, and a fight round the hull do not hold the arena open
    const left = [{ alive: true, guard: null, type: 'gslime' }, { alive: true, guard: null, type: 'ghost' }, { alive: true, guard: null, hunter: true, tier: 'small', type: 'reed' }, { alive: true, guard: null, hunter: true, tier: 'pup', type: 'reed' }];
    ww.enemies.push(...left); ww.engaged = true;
    step(SECTOR_TIMING.stall + 5); assert.equal(run.state().phase, 'fighting', `the mother alive still holds it (${run.state().phase})`);
    boss.alive = false; ww.talking = true; step(0.5); assert.equal(run.state().phase, 'secure', `the mother dead: SECURE with four bodies alive elsewhere (${run.state().phase})`);
    // THE NEST AND THE QUEEN (owner, 2026-10-19, note 9): Isao's boss_dead and arena_decoded are read before the debrief pauses the game (api.bossTalking)
    step(SECTOR_TIMING.securePause + 0.5); assert.deepEqual(log.slice(1), [], 'Isao still talking: no report yet');
    ww.talking = false; step(0.5); assert.deepEqual(log.slice(1), [['report', SECTOR_DOOR.earliest + 1]], 'and the report as he stops: a fight round the hull does not hold the boss sector\'s debrief');
    for (const e of left) e.alive = false; ww.engaged = false; }
  if (run.state().phase === 'fighting') hold();
  assert.equal(ww.opened.at(-1).alive, true, 'the arena\'s hole is spent, not sealed: the nest\'s mouth stays open');
  assert.deepEqual(log.slice(1), [['report', SECTOR_DOOR.earliest + 1]], 'the boss sector held: its report, no finale');
  run.test.cont(); step(1); assert.equal(run.state().n, SECTOR_DOOR.earliest + 2, 'BOTH WALLS'); assert.equal(run.state().name, 'BOTH WALLS');
  hold();
  assert.deepEqual(log.slice(2), [['finale']], 'the final sector held: the finale first, before any score');
  assert.equal(run.state().phase, 'finale'); assert.equal(run.state().secure, true, 'held, under the finale');
  hand();
  assert.deepEqual(log.slice(3), [['report', SECTOR_DOOR.earliest + 2]], 'the finale over: the report');
  run.test.cont(); assert.deepEqual(log.slice(4), [["campaign"]], "then the campaign card");
  run.test.keepHolding(); step(1);
  assert.ok(!log.slice(5).some((l) => l[0] === 'finale'), `leaving the card plays no finale again (${JSON.stringify(log.slice(5))})`);
  assert.equal(run.state().n, SECTOR_DOOR.earliest + 3, 'and the next sector begins');
  assert.equal(run.state().phase, 'fighting');
}
// THE CREATURE PROBE HOLDS THE SECTOR OPEN (owner, 2026-10-12; src/fx/creature-enemies.js): every pulse out and every body dead, the
// sector stays 'fighting' while `hold` says so (the probe keeps stepping), and is secured once it lets go
{
  let held = true;
  const w = world({ hold: () => held });
  w.step(0.5);
  for (let guard = 0; guard < 400 && !w.run.state().breaches.every((b) => !b.live && b.wavesReleased >= b.wavesPlanned); guard++) {
    w.run.release(w.t); w.step(0.5);
    w.enemies.push(...w.queue.splice(0).map((q) => ({ alive: false, guard: null, breachSource: q.sp.obj, type: q.type })));
    w.step(SECTOR_TIMING.stall + 1);
  }
  assert.ok(w.run.state().breaches.every((b) => b.wavesReleased >= b.wavesPlanned), 'every wave out');
  w.step(30);
  assert.equal(w.run.state().phase, 'fighting', 'held open: not secured');
  held = false; w.step(1);
  assert.equal(w.run.state().phase, 'secure', 'let go: secured');
}
// THE CLOCK HELD (2026-10-18, DAY 42: the party is a lull the sector may not end): while the host holds it the sector's clock stands,
// pulseGap reads Infinity so the board's own between-waves clock never arms, and no stall is counted (asserted here: the clock, pulseGap and
// the stall; the gates and releases skipped with the tick body are not). breathing() reads the pulse's breath (the field under breath.at of
// the last pulse) and is false right after a release
{
  let held = false; const w = world({ clockHeld: () => held });
  w.step(0.5); assert.equal(w.run.state().phase, 'fighting');
  assert.equal(w.run.breathing(), false, 'no pulse sent yet: not a breath');
  const q = w.run.release(w.t); assert.ok(q.length > 0); w.spawn(q);
  assert.equal(w.run.breathing(), false, 'the pulse is alive');
  for (const e of w.enemies) e.alive = false;
  assert.equal(w.run.breathing(), true, 'the field dead: a breath');
  const c0 = w.run.state().clock; held = true; w.step(30);
  assert.equal(w.run.state().clock, c0, 'the clock stands while held'); assert.equal(w.run.pulseGap(), Infinity, 'no pulse arms while held');
  held = false; w.step(1); assert.ok(w.run.state().clock > c0, 'and runs again'); assert.equal(w.run.pulseGap(), SECTORS[0].pulse);
  assert.equal(w.run.state().phase, 'fighting', 'thirty held seconds were not a stall');
}
// breathing()'s two shapes (final review, 2026-10-18): a flow sector breathes with the lane under a quarter of its target (THE PRESS, no crowd
// cap in node, no swell); a pulse sector at its own breath.at of the last pulse, not the 0.25 default
{
  const w = world({ firstSector: 4 }); w.step(0.5);
  const def = w.run.defNow(); assert.equal(def.shape, 'flow'); assert.equal(w.run.state().phase, 'fighting');
  const target = def.flow.alive, body = () => ({ alive: true, guard: null, breachSource: w.opened[0]?.obj ?? null });
  w.enemies.push(...Array.from({ length: Math.round(target * 0.9) }, body));
  assert.equal(w.run.breathing(), false, `the lane near its target (${w.enemies.length}/${target}): not a breath`);
  for (const e of w.enemies.slice(Math.floor(target * 0.25) - 1)) e.alive = false;
  assert.equal(w.run.breathing(), true, `under a quarter of the target (${w.enemies.filter((e) => e.alive).length}/${target}): a breath`);
}
{
  const w = world(); w.step(0.5); w.run.defNow().breath = { at: 0.6, max: 60 };
  const q = w.run.release(w.t); w.spawn(q); const n = w.enemies.length;
  for (const e of w.enemies.slice(0, Math.floor(n * 0.5))) e.alive = false;   // half left: above 0.25, under 0.6
  assert.equal(w.run.breathing(), true, `${n - Math.floor(n * 0.5)} of ${n} alive, at or under breath.at 0.6: a breath`);
  w.run.defNow().breath = { at: 0.25, max: 60 }; assert.equal(w.run.breathing(), false, 'the same field over breath.at 0.25: not a breath');
}
// THE PRESS IS IN SIGHT (owner, 2026-10-19, third round, note 3: "sector 4 and sector 5 have the tremor, but the first wave seems empty? There is a long
// delay before enemies arrive"): a flow sector's first gate breach stands on the near ring (SECTOR_PLACEMENT.flowFirstHops) and opens first; the
// second keeps ringHops; a side breach still goes first (sector 5); a pulse sector keeps both on ringHops; no cell on the near ring, the ring as before; the door, BOTH WALLS and the hold sectors keep the ring (nearFirst is the rows' own, sectors 4 and 5)
{
  const { SECTOR_PLACEMENT } = await import('../src/content/sectors.js');
  const near = SECTOR_PLACEMENT.flowFirstHops, ring = SECTOR_PLACEMENT.ringHops, hops = (cell) => (cell >= 200 ? 30 : 30 + (cell % 30));
  assert.ok(near < ring - 6, 'the near ring is nearer than the ring\'s band');
  const w = world({ firstSector: 4 }); w.step(0.5);
  const b = w.run.state().breaches;
  assert.deepEqual(b.map((x) => x.side), ['gate', 'gate']);
  assert.ok(hops(b[0].cell) >= near - 6 && hops(b[0].cell) <= near + 3, `THE PRESS: the first breach on the near ring (${hops(b[0].cell)} hops)`);
  assert.ok(hops(b[1].cell) >= ring - 6, `the second on the ring (${hops(b[1].cell)} hops)`);
  assert.equal(w.opened[0].ci, b[0].cell, 'the near one opens first, under the dive');
  assert.ok(b.every((x) => x.cell % 2 === 0), 'neither within a blast of the rim');
  const w5 = world({ firstSector: 5 }); w5.step(2);
  const b5 = w5.run.state().breaches;
  assert.deepEqual(b5.map((x) => x.side), ['side', 'gate'], 'THE SIDE WALL: the side breach first');
  assert.ok(hops(b5[1].cell) <= near + 3, `its gate breach on the near ring (${hops(b5[1].cell)} hops)`);
  const w1 = world(); w1.step(0.5);
  assert.ok(w1.run.state().breaches.every((x) => hops(x.cell) >= ring - 6), 'a pulse sector keeps both on the ring');
  // the flag is the row's: the door, BOTH WALLS and a hold sector keep their gate breach on the ring (their feast and gateAfter timing was tuned there)
  const onRing = (w, what) => { const g = w.run.state().breaches.filter((x) => x.side === 'gate'); assert.ok(g.length && g.every((x) => hops(x.cell) >= ring - 6), `${what}: the gate breach on the ring (${g.map((x) => hops(x.cell))})`); };
  const wd = world({ firstSector: SECTOR_DOOR.earliest }); wd.step(0.5); assert.equal(wd.run.state().name, BACK_DOOR_SECTOR.name); onRing(wd, 'THE BACK DOOR');
  const wb = world({ firstSector: SECTOR_DOOR.earliest + 2 }); wb.step(0.5); onRing(wb, wb.run.state().name);
  const wh = world({ firstSector: SECTORS.length + 1, canyon: null }); wh.step(0.5); onRing(wh, wh.run.state().name);
  // no usable cell on the near ring (every one excluded): the sector still has both breaches, on the ring as before
  const wx = world({ firstSector: 4, excluded: Array.from({ length: 260 }, (_, i) => i).filter((i) => hops(i) <= near + 3 && hops(i) >= near - 6) }); wx.step(0.5);
  const bx = wx.run.state().breaches;
  assert.deepEqual(bx.map((x) => x.side), ['gate', 'gate'], 'the near ring empty: both gate breaches still placed');
  assert.ok(bx.every((x) => hops(x.cell) >= ring - 6), `both on the ring (${bx.map((x) => hops(x.cell))})`);
}
console.log('Sector run: the back door\'s omens, breaches open under the card, pulses on the clock and under the budget, the feast, the scramble and the gate side after it.');
