import assert from 'node:assert/strict';
import { STORY_PHASES, isAutomated, pilotMultipliers, seatsOffered } from '../src/domain/automation.js';
import { STORY_HANDOVER, STORY_PILOT } from '../src/content/story-defaults.js';

assert.deepEqual(STORY_PHASES, ['landed', 'foundry', 'printing', 'rotor-ready', 'tremor', 'breach', 'approach', 'override', 'piloting', 'cleared', 'quiver-piloting', 'construction', 'settled', 'study-talk', 'study', 'expedition']);
assert.deepEqual(STORY_HANDOVER, { from: 'settled', defendStage: 8 });
const at = (phase, stage = 6) => isAutomated(phase, { ...STORY_HANDOVER, stage });
for (const p of ['landed', 'printing', 'piloting', 'cleared', 'quiver-piloting', 'construction']) assert.equal(at(p), false, `${p} is still the tutorial`);   // sector 0: the seats are the fight while the Stålheart prints
for (const p of ['settled', 'study-talk', 'study', 'expedition']) assert.equal(at(p), true, `${p} is past the handover`);
assert.equal(at('landed', 8), true, 'the Defend stage is automated from the start');
assert.equal(at('nonsense'), false, 'an unknown phase is not automated');
assert.deepEqual(pilotMultipliers(false, STORY_PILOT), { dmgMul: STORY_PILOT.dmgMul, rateMul: STORY_PILOT.rateMul }, 'the tutorial seats are overpowered');
assert.deepEqual(pilotMultipliers(true, STORY_PILOT), { dmgMul: 1, rateMul: 1 }, 'after the handover no multiplier');
assert.deepEqual(pilotMultipliers(false, null), { dmgMul: 1, rateMul: 1 });
assert.deepEqual(seatsOffered(false, ['rotor', 'quiver']), { towers: ['rotor', 'quiver'], tank: true, gunship: true });
assert.deepEqual(seatsOffered(true, ['rotor', 'quiver']), { towers: [], tank: true, gunship: true }, 'no tower mounts after the handover');
console.log('Automation: the handover phase, the Defend stage, pilot multipliers and seats hold.');
