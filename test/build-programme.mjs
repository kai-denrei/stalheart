import assert from 'node:assert/strict';
import { BASE_PROGRAMME, BASE_PERKS, BASE_BUILDER } from '../src/content/base-programme.js';
import { makeBuildProgramme, due, whenHolds, begin, finish, perks, hasPerk, rebuildDue, snapshot, lose, lost, buy, openingSteps } from '../src/domain/build-programme.js';
import { OPENING_PROGRAMME } from '../src/content/base-programme.js';
import { STORY_PHASES } from '../src/domain/automation.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { createBasePrint } from '../src/fx/base-print.js';

// what a step grew, so a beat that only works a standing machine can be shown to grow nothing
const grown = [];
const growStub = () => ({ growIsland: (id, k) => grown.push(['island', id, k]), grow: (id, k) => grown.push(['structure', id, k]), growGate: (k) => grown.push(['gate', k]), growWall: (i, k) => grown.push(['wall', i, k]) });

// the content: unique ids, real phases and briefs, and every piece a grown stage-1 base leaves pending is printed by exactly one step
{
  assert.equal(new Set(BASE_PROGRAMME.map((s) => s.id)).size, BASE_PROGRAMME.length, 'unique step ids');
  for (const s of BASE_PROGRAMME) {
    assert.ok(s.seconds > 0 && s.metres > 0 && s.label, `${s.id}: seconds, metres and a label`);
    assert.ok(s.seconds >= 4, `${s.id}: a print must still be SEEN to happen (${s.seconds} s); the opening is trimmed by cutting waits, not prints`);
    if (s.when.phase) assert.ok(STORY_PHASES.includes(s.when.phase), `${s.id}: ${s.when.phase} is a story phase`);
    assert.ok(BRIEFS[s.brief] && BRIEFS[s.brief].lines.length <= 2, `${s.id}: Isao's brief ${s.brief} exists, two lines at most`);
  }
  assert.deepEqual(BASE_PROGRAMME.map((s) => s.perk).filter(Boolean).sort(), ['armory', 'backgate', 'board', 'chips', 'depot', 'farm', 'garage', 'gate', 'gunship', 'hulls', 'launcher', 'rebuild', 'stalheart', 'station', 'uplink'], 'the perks the other systems consult');
  assert.ok(BASE_PERKS.gunshipMeter > 1 && BASE_PERKS.rebuildHulls >= 1);
  const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
  const plan = planBase(planet, { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES }, 1, { reach: STAGES.length - 1 });
  const count = (id, key) => BASE_PROGRAMME.filter((s) => s[key].includes(id)).length;
  for (const i of plan.islands.filter((x) => x.pending)) assert.equal(count(i.id, 'islands'), 1, `island ${i.id} is printed once`);
  for (const s of plan.structures.filter((x) => x.pending && x.id !== 'rotor')) assert.equal(count(s.id, 'structures'), 1, `structure ${s.id} is printed once`);   // the Rotor is the beats' own print
  assert.equal(BASE_PROGRAMME.filter((s) => s.gate).length, 2, 'two gate steps: the front door and the back one'); assert.ok(BASE_PROGRAMME.find((s) => s.gate === true).walls, 'the walls come with the front gate'); { const b = BASE_PROGRAMME.find((s) => s.gate === 'back'); assert.ok(b && !b.walls && b.plot && b.when.back === 'held' && b.perk === 'backgate', 'the back gate is a wall-less door that waits for the surprise to be held'); { const colony = BASE_PROGRAMME.filter((x) => !/^(dome|bridge)-/.test(x.id)); assert.equal(colony.at(-2).id, 'launcher', 'last of the colony but the fourth Bio-Pearl (round 8)'); assert.equal(colony.at(-1).id, 'pearl'); assert.ok(BASE_PROGRAMME.slice(BASE_PROGRAMME.indexOf(colony.at(-1)) + 1).every((x) => /^(dome|bridge)-/.test(x.id)), 'only the dome city after it (the owner\'s note of 2026-11-07)'); } }
  // (2026-10-03, "faster intro, more intensity") the gate is the first print, the recycler's work comes after the Stålheart's print
  assert.equal(BASE_PROGRAMME[0].id, 'gate', 'the gate prints first of the base: the tremor waits for it');
  assert.ok(BASE_PROGRAMME.findIndex((s) => s.id === 'foundry') > BASE_PROGRAMME.findIndex((s) => s.id === 'stalheart'), 'the recycler beat is off the critical path');
  // SECTOR 0 (owner, 2026-09-24: "The Tank is built by the Stalheart"): the Stålheart is the next print, due from the deploy (2026-11-08; with the Rotor before), and its
  // long print IS the construction the first waves attack; the first hull rolls out of it and the HUD reads its progress
  { const sh = BASE_PROGRAMME[1];
    assert.equal(sh.id, 'stalheart', 'the Stålheart prints straight after the gate'); assert.equal(sh.when.phase, 'foundry', 'due from the deploy (2026-11-08, THE SETTLING: the Rotor is the first orders\', no longer the gate\'s wait): it waits only for the gate and the Quiver ahead of it');
    assert.ok(sh.seconds >= 45, `its print is the sector-0 clock, not a four-second rise (${sh.seconds} s)`);
    assert.equal(sh.hull, true, 'the first hull rolls out of it'); assert.equal(sh.readout, 'STÅLHEART', 'its progress is the objective on the HUD');
    assert.equal(BASE_PROGRAMME.filter((s) => s.hull).length, 1, 'one step issues the hull'); }
  // THE OPENING'S PACE (owner, 2026-09-18): everything before the first wave is on the tremor's critical path, so the two steps
  // ahead of it are capped — and Isao's cruise is a content number, not a controller constant
  assert.ok(BASE_PROGRAMME[0].seconds <= 9, `the gate print is on the critical path to the first wave (${BASE_PROGRAMME[0].seconds} s)`);
  assert.ok(BASE_BUILDER.cellsPerSecond >= 3.5, `Isao's flights between plots are dead time (${BASE_BUILDER.cellsPerSecond} cells/s)`);
  // the foundry beat is work on a machine that already stands: it prints nothing, carries no perk, and holds the beam over the AFR-01
  {
    const f = BASE_PROGRAMME.find((s) => s.id === 'foundry');
    assert.deepEqual([f.islands, f.structures, f.perk, f.gate ?? false, f.walls ?? false], [[], [], null, false, false], 'the foundry beat builds nothing');
    assert.equal(f.over, 'foundry'); assert.equal(f.plot.length, 2); assert.ok(f.plot.every((v) => v > 0), 'the plot is the machine footprint');
    assert.ok(f.seconds <= 10, `the beat must not push the first wave late: the tremor waits for the gate behind it (${f.seconds} s)`);
    const print = createBasePrint({ base: growStub(), plan, placer: { toWorld: (p) => ({ toArray: () => p.slice() }) } });
    assert.ok(print.cellOf(f) >= 0, 'the beat has a cell to fly to: a -1 would stall the whole programme');
    const bed = print.bed(f), mid = bed(0, 0, 0), late = bed(0, 0, 1), corner = bed(1, 1, 0.5);
    const machine = plan.structures.find((s) => s.id === f.over);
    assert.ok(machine && !machine.pending, `${f.over} stands in the plan: src/platform/story-world.js keeps an \`over\` beat only while its machine is planned`);
    assert.deepEqual([mid[0], mid[2]], [machine.x, machine.z], 'the beam rasters over the machine, not the island around it');
    assert.equal(mid[1], f.metres); assert.equal(late[1], f.metres, 'no climb: he works at the machine height from the first frame');
    assert.ok(Math.abs(corner[0] - machine.x) <= f.plot[0] && Math.abs(corner[2] - machine.z) <= f.plot[1], 'the raster stays on the deck');
    print.progress(f, 0.5); print.finish(f);
    assert.deepEqual(grown, [], 'working the foundry grows nothing');
  }
  const at = (id) => BASE_PROGRAMME.findIndex((s) => s.id === id), handover = STORY_PHASES.indexOf('settled');
  assert.ok(STORY_PHASES.indexOf(BASE_PROGRAMME[at('stalheart')].when.phase) < handover, 'the Stålheart is due before the handover');
}

// the rules: in order, one at a time, gated by phase, sector and idle
{
  const steps = [
    { id: 'a', when: { phase: 'rotor-ready' }, perk: 'gate' },
    { id: 'b', when: { phase: 'rotor-ready' }, perk: null },
    { id: 'c', when: { sector: 1, idle: true }, perk: 'hulls' },
    { id: 'd', when: { sector: 2 }, perk: 'rebuild' },
  ];
  const st = makeBuildProgramme(steps);
  assert.equal(due(st, { phase: 'printing' }), null, 'nothing before the Rotor stands');
  assert.equal(due(st, { phase: 'landed' }), null); assert.equal(due(st, {}), null, 'no phase, no phase-gated step');
  const a = due(st, { phase: 'rotor-ready' }); assert.equal(a.id, 'a');
  begin(st, a); assert.equal(due(st, { phase: 'expedition' }), null, 'one at a time');
  assert.equal(finish(st, a), 'gate'); assert.ok(hasPerk(st, 'gate')); assert.equal(finish(st, a), null, 'a step finishes once');
  assert.equal(due(st, { phase: 'tremor' }).id, 'b', 'a later phase still satisfies an earlier want');
  begin(st, due(st, { phase: 'tremor' })); assert.equal(finish(st, steps[1]), null, 'a step without a perk');
  assert.equal(due(st, { phase: 'expedition', sector: 0 }), null, 'the bays wait for sector 1');
  assert.equal(due(st, { phase: 'expedition', sector: 1, waveActive: true }), null, '...and for the wave to end');
  assert.equal(due(st, { phase: 'expedition', sector: 1 }).id, 'c');
  begin(st, steps[2]); finish(st, steps[2]);
  assert.equal(due(st, { phase: 'expedition', sector: 1 }), null, 'strictly in order: d wants sector 2');
  assert.equal(due(st, { phase: 'expedition', sector: 2, waveActive: true }).id, 'd', 'a step that does not ask for idle starts during a wave');
  begin(st, steps[3]); finish(st, steps[3]);
  assert.equal(due(st, { phase: 'expedition', sector: 9 }), null, 'the programme runs out');
  assert.deepEqual([...perks(st)].sort(), ['gate', 'hulls', 'rebuild']); perks(st).clear(); assert.ok(hasPerk(st, 'gate'), 'perks() hands out a copy');
  assert.deepEqual(snapshot(st), { active: null, done: ['a', 'b', 'c', 'd'], printed: ['a', 'b', 'c', 'd'], next: null, owed: [], bought: [], perks: ['gate', 'hulls', 'rebuild'], lost: [] });
}

// standing steps count as printed from the start, perks included, and are never printed again
{
  const st = makeBuildProgramme(BASE_PROGRAMME, { standing: (s) => ['foundry', 'gate', 'landing', 'stalheart', 'solar', 'hugin'].includes(s.id) });   // a static stage is past the foundry beat too (src/platform/story-world.js)
  assert.deepEqual([...perks(st)].sort(), ['gate', 'gunship', 'stalheart', 'station']);
  assert.equal(due(st, { phase: 'expedition', sector: 0 }), null); assert.equal(due(st, { phase: 'expedition', sector: 1 }).id, 'bays', 'a stage-6 jump prints the bays next');
  assert.deepEqual(snapshot(st).printed, [], 'nothing printed yet');
  const all = makeBuildProgramme(BASE_PROGRAMME, { standing: () => true });
  assert.equal(due(all, { phase: 'expedition', sector: 9 }), null, 'a finished base prints nothing'); assert.ok(hasPerk(all, 'rebuild') && hasPerk(all, 'uplink'));
}

// the assembly line rebuilds a lost hull once per new sector, and only once it stands
{
  const st = makeBuildProgramme([{ id: 'assembly', when: { sector: 2 }, perk: 'rebuild' }]);
  assert.equal(rebuildDue(st, 1), false, 'no line, no rebuild');
  assert.equal(rebuildDue(st, 2), false, 'sector 2 starts before the line stands');
  begin(st, st.steps[0]); finish(st, st.steps[0]);
  assert.equal(rebuildDue(st, 2), false, 'still sector 2: its start is past');
  assert.equal(rebuildDue(st, 3), true, 'sector 3 starts with a rebuild'); assert.equal(rebuildDue(st, 3), false, 'once per sector');
  assert.equal(rebuildDue(st, undefined), false, 'no sector yet');
}
// `when.back`: a step waits for the second front to have reached a named state
{ const steps = [{ id: 'a', islands: [], structures: [] }, { id: 'b', islands: [], structures: [], when: { back: 'held' } }];
  const st = makeBuildProgramme(steps);
  finish(st, due(st, {}));
  assert.equal(due(st, {}), null, 'the back step waits while the back is untouched');
  assert.equal(due(st, { back: 'open' })?.id, undefined, 'and while it is merely open');
  assert.equal(due(st, { back: 'held' })?.id, 'b', 'it comes once the breach behind it is held'); }
console.log(`Build programme: ${BASE_PROGRAMME.length} steps in order, one at a time, gated by phase, sector and idle; standing steps carry their perks; one rebuild per sector.`);

// A BUILDING SOL-82 BURNED (src/content/orbital-laser.js LASER_STRUCTURES): the step stays done — Isao does not print it back — but
// its perk goes out, and everything that consults the programme goes without what that building was paying for
{
  const st = makeBuildProgramme(BASE_PROGRAMME, { standing: () => true });
  assert.ok(hasPerk(st, 'uplink') && hasPerk(st, 'gunship') && hasPerk(st, 'rebuild') && hasPerk(st, 'hulls'), 'a finished base has every perk');
  assert.equal(lose(st, 'radar'), 'uplink', 'the radar takes the uplink with it');
  assert.equal(hasPerk(st, 'uplink'), false, '...and SOL-82 goes offline with it');
  assert.equal(lose(st, 'radar'), null, 'a building is only lost once');
  assert.equal(lose(st, 'hugin'), 'gunship', 'HUGIN takes the gunship bonus');
  assert.equal(lose(st, 'bays'), 'hulls');
  assert.equal(lose(st, 'assembly'), 'rebuild');
  assert.equal(rebuildDue(st, 1), false, 'no assembly line, no rebuilt hull');
  assert.equal(lose(st, 'foundry'), null, 'the foundry beat carries no perk to lose');
  assert.deepEqual([...lost(st)].sort(), ['assembly', 'bays', 'foundry', 'hugin', 'radar']);
  assert.deepEqual(snapshot(st).done.includes('radar'), true, 'the step stays done: a burned building is not reprinted');
  assert.equal(due(st, { phase: 'expedition', sector: 9 }), null, '...and the programme does not restart for it');
  assert.equal(lose(st, 'nothing-here'), null, 'an id no step prints');
  const fresh = makeBuildProgramme(BASE_PROGRAMME);
  assert.equal(lose(fresh, 'radar'), null, 'a building that never stood cannot be burned');
  assert.deepEqual([...lost(fresh)], [], '...and is not booked as lost');
}

// THE BRIDGES FOLLOW THEIR DOMES (owner's note, 2026-11-07): `when.stand` is the structure ids that must stand before a step is due;
// the host answers with `standing(id)`, and with no answer nothing stands, so a bridge never prints toward a dome that is not there
{
  const ctx = { phase: 'rotor-ready', sector: 1 };
  assert.equal(whenHolds({ stand: ['a', 'b'] }, { ...ctx, standing: (id) => id === 'a' }), false, 'one of two named structures standing is not enough');
  assert.equal(whenHolds({ stand: ['a', 'b'] }, { ...ctx, standing: (id) => id === 'a' || id === 'b' }), true, 'both stand: due');
  assert.equal(whenHolds({ stand: ['a', 'b'] }, ctx), false, 'no standing() from the host: nothing stands');
  assert.equal(whenHolds({ stand: [] }, ctx), true, 'an empty list names nothing to wait for');
  assert.equal(whenHolds({}, ctx), true, 'a step with no stand condition is unaffected');
  const both = { ...ctx, standing: () => true };
  assert.equal(whenHolds({ stand: ['a'], sector: 2 }, both), false, 'stand and sector: the sector still gates');
  assert.equal(whenHolds({ stand: ['a'], sector: 2 }, { ...both, sector: 2, standing: () => false }), false, 'stand and sector: the stand still gates');
  assert.equal(whenHolds({ stand: ['a'], sector: 2 }, { ...both, sector: 2 }), true, 'both hold: due');
  // through due(), which is how the host finds Isao's next step: the context's standing() must reach the step's `when`
  {
    const steps = [{ id: 'dome', when: {}, structures: ['dome-a'] }, { id: 'bridge', when: { stand: ['dome-a', 'dome-b'] }, structures: ['bridge-ab'] }];
    const next = (standing) => { const st = makeBuildProgramme(steps); finish(st, steps[0]); return due(st, standing ? { phase: 'rotor-ready', standing } : { phase: 'rotor-ready' }); };
    assert.equal(next((id) => id === 'dome-a'), null, 'due(): one dome standing, the bridge waits');
    assert.equal(next((id) => id === 'dome-a' || id === 'dome-b')?.id, 'bridge', 'due(): both domes stand, the bridge is due');
    assert.equal(next(null), null, 'due(): no standing() from the host, the bridge waits');
    const st = makeBuildProgramme([{ id: 'e', when: { stand: [] }, structures: [] }]);
    assert.equal(due(st, {})?.id, 'e', 'due(): an empty stand list comes due without standing(), as whenHolds says');
  }
  // a board step nobody bought is not `next` (2026-11-08: the first orders' steps sit before the spine's later prints)
  {
    const steps = [{ id: 'a', islands: [], structures: [], when: {} }, { id: 'b', islands: [], structures: [], board: true, when: {} }, { id: 'c', islands: [], structures: [], when: {} }];
    const st = makeBuildProgramme(steps); finish(st, steps[0]);
    assert.equal(snapshot(st).next, 'c', 'the unbought board step is passed over'); buy(st, 'b'); assert.equal(snapshot(st).next, 'b', 'bought, it is next');
  }
  console.log('build-programme: ok');
}
// THE RECON DOG'S OPENING (2026-11-12): the gate, the depot and the Stålheart lead on the dog's beats; the rest keeps its order; BASE_PROGRAMME untouched
{
  const steps = openingSteps(BASE_PROGRAMME, OPENING_PROGRAMME), ids = steps.map((s) => s.id);
  assert.deepEqual(ids.slice(0, 3), ['gate', 'depot', 'stalheart']); assert.equal(steps.length, BASE_PROGRAMME.length);
  assert.deepEqual(ids.filter((id) => !['gate', 'depot', 'stalheart'].includes(id)), BASE_PROGRAMME.map((s) => s.id).filter((id) => !['gate', 'depot', 'stalheart'].includes(id)), 'the rest in order');
  assert.deepEqual(steps.slice(0, 3).map((s) => s.when), [{ phase: 'walled' }, { phase: 'rotor-ready' }, { phase: 'quiver-piloting' }]);
  assert.deepEqual(BASE_PROGRAMME.find((s) => s.id === 'gate').when, { phase: 'foundry' }, 'the base programme as it stood');
  const st = makeBuildProgramme(steps);
  assert.equal(due(st, { phase: 'scouting' }), null, 'nothing while the dog scouts'); assert.equal(due(st, { phase: 'walled' }).id, 'gate');
  finish(st, steps[0]); assert.equal(due(st, { phase: 'printing' }), null, 'the depot waits for the Rotor'); assert.equal(due(st, { phase: 'rotor-ready' }).id, 'depot', 'and prints in the wait for its seat (flow fixes, 2026-11-13)');
  finish(st, steps[1]); assert.equal(due(st, { phase: 'orders' }), null, 'the Stålheart waits for the card to close'); assert.equal(due(st, { phase: 'quiver-piloting' }).id, 'stalheart');
  assert.deepEqual(openingSteps(BASE_PROGRAMME.filter((s) => s.id !== 'depot'), OPENING_PROGRAMME).slice(0, 2).map((s) => s.id), ['gate', 'stalheart'], 'a plan without the depot');
  console.log('build-programme: the recon dog\'s opening');
}
