// boss-settings-copy.mjs — the boss lab's copy of the values the owner tunes (owner, 2026-10-09; src/labs/boss/settings-copy.js): one line a
// group, key=value pairs, numbers trimmed; the fight folder's knobs only where they moved, the fear's all.
import assert from 'node:assert/strict';
import { settingsBlock, folderGroups } from '../src/labs/boss/settings-copy.js';

const tune = { health: 180, warn: 1.5, nuke: { damage: 60 }, fear: { reach: 8, weight: { sol: 2 } } }, on = { fight: true, rotary: true };
const ctl = (object, property, now) => ({ object, property, initialValue: object[property], getValue: () => now ?? object[property] });
const paths = new Map([[tune, ''], [tune.nuke, 'nuke.'], [tune.fear, 'fear.'], [tune.fear.weight, 'fear.weight.'], [on, '']]);
const seed = ctl({ seed: 3 }, 'seed', 4);
const controllers = [ctl(tune, 'health'), ctl(tune, 'warn', 2.25), ctl(tune.nuke, 'damage', 1 / 3), ctl(tune.fear, 'reach'), ctl(tune.fear.weight, 'sol'),
  ctl(on, 'fight'), ctl(on, 'rotary', false), ctl({ other: 1 }, 'other', 2), seed];
const { fight, fear } = folderGroups(controllers, paths, new Set([seed]));
assert.deepEqual(fight, { warn: 2.25, 'nuke.damage': 1 / 3, rotary: false }, 'only the moved knobs and switches, keyed by their path');
assert.deepEqual(fear, { reach: 8, 'weight.sol': 2 }, 'every fear value, the prefix dropped');

const block = settingsBlock({
  head: { mode: 'bait', variant: 'nih-dairia', size: 40 },
  motion: { speed: 3, reachTime: 5, stepHeight: 0.032, grip: 3.0000001 },
  phys: { gravity: 2.4, iterations: 3, feeding: true },
  bait: { altitude: 4, erratic: 1, health: 180, reload: 6, hopChance: 0.03 },
  fight, fear,
});
assert.equal(block, [
  'mode=bait variant=nih-dairia size=40',
  'motion: speed=3 reachTime=5 stepHeight=0.032 grip=3',
  'phys: gravity=2.4 iterations=3 feeding=true',
  'bait: altitude=4 erratic=1 health=180 reload=6 hopChance=0.03',
  'fight: warn=2.25 nuke.damage=0.3333 rotary=false',
  'fear: reach=8 weight.sol=2',
].join('\n'), 'the block: one line a group, numbers trimmed to four decimals');
const tank = settingsBlock({ head: { mode: 'tank' }, motion: { speed: 0.1 }, phys: { gravity: 2.4 }, bait: null, fight: {}, fear: { reach: 8 } });
assert.equal(tank, 'mode=tank\nmotion: speed=0.1\nphys: gravity=2.4\nfight: defaults\nfear: reach=8', 'no bait line outside the bait mode; an untouched fight folder reads "defaults"');
// wave B: the bait mode's further groups (the fear per gun, the temperament), a line each after the fear's, in their order
const more = settingsBlock({ head: { mode: 'bait' }, motion: { speed: 1.2 }, phys: { gravity: 2.4 }, bait: { altitude: 4 }, fight: {}, fear: { reach: 8 },
  more: { 'gun fear': { '25mm.amount': 0.06, '40mm.flee': 35, 'mk9.stun': 0 }, temperament: { speed: 1.2, lunges: true, lungeSpeed: 3, reach: 1.5 } } });
assert.equal(more, 'mode=bait\nmotion: speed=1.2\nphys: gravity=2.4\nbait: altitude=4\nfight: defaults\nfear: reach=8\ngun fear: 25mm.amount=0.06 40mm.flee=35 mk9.stun=0\ntemperament: speed=1.2 lunges=true lungeSpeed=3 reach=1.5',
  'the further groups follow the fear\'s line, one line each');
console.log(`Boss settings copy: ${block.split('\n').length} lines a paste (head, motion, phys, bait, fight's moved knobs, fear), numbers to four decimals, "defaults" for an untouched fight folder; the bait mode's gun fear and temperament after (${more.split('\n').length} lines).`);
