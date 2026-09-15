import assert from 'node:assert/strict';
import { BASE_PROGRAMME, BASE_PERKS } from '../src/content/base-programme.js';
import { makeBuildProgramme, due, begin, finish, perks, hasPerk, rebuildDue, snapshot } from '../src/domain/build-programme.js';
import { STORY_PHASES } from '../src/domain/automation.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';

// the content: unique ids, real phases and briefs, and every piece a grown stage-1 base leaves pending is printed by exactly one step
{
  assert.equal(new Set(BASE_PROGRAMME.map((s) => s.id)).size, BASE_PROGRAMME.length, 'unique step ids');
  for (const s of BASE_PROGRAMME) {
    assert.ok(s.seconds > 0 && s.metres > 0 && s.label, `${s.id}: seconds, metres and a label`);
    if (s.when.phase) assert.ok(STORY_PHASES.includes(s.when.phase), `${s.id}: ${s.when.phase} is a story phase`);
    assert.ok(BRIEFS[s.brief] && BRIEFS[s.brief].lines.length <= 2, `${s.id}: Isao's brief ${s.brief} exists, two lines at most`);
  }
  assert.deepEqual(BASE_PROGRAMME.map((s) => s.perk).filter(Boolean).sort(), ['gate', 'gunship', 'hulls', 'rebuild', 'stalheart', 'station', 'uplink'], 'the perks the other systems consult');
  assert.ok(BASE_PERKS.gunshipMeter > 1 && BASE_PERKS.rebuildHulls >= 1);
  const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
  const plan = planBase(planet, { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES }, 1, { reach: STAGES.length - 1 });
  const count = (id, key) => BASE_PROGRAMME.filter((s) => s[key].includes(id)).length;
  for (const i of plan.islands.filter((x) => x.pending)) assert.equal(count(i.id, 'islands'), 1, `island ${i.id} is printed once`);
  for (const s of plan.structures.filter((x) => x.pending && x.id !== 'rotor')) assert.equal(count(s.id, 'structures'), 1, `structure ${s.id} is printed once`);   // the Rotor is the beats' own print
  assert.equal(BASE_PROGRAMME.filter((s) => s.gate).length, 1, 'one gate step'); assert.ok(BASE_PROGRAMME.find((s) => s.gate).walls, 'the walls come with the gate');
  assert.equal(BASE_PROGRAMME[0].id, 'gate', 'the gate prints first: the tremor waits for it');
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
  assert.deepEqual(snapshot(st), { active: null, done: ['a', 'b', 'c', 'd'], printed: ['a', 'b', 'c', 'd'], next: null, perks: ['gate', 'hulls', 'rebuild'] });
}

// standing steps count as printed from the start, perks included, and are never printed again
{
  const st = makeBuildProgramme(BASE_PROGRAMME, { standing: (s) => ['gate', 'landing', 'stalheart', 'solar', 'hugin'].includes(s.id) });
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
console.log(`Build programme: ${BASE_PROGRAMME.length} steps in order, one at a time, gated by phase, sector and idle; standing steps carry their perks; one rebuild per sector.`);
