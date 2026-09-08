import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { SENTRIES } from '../src/content/sentries.js';
import { TOWERS, TOWER_ORDER, useRoster } from '../src/towers.js';
import { SENTRY_FAMILIES, familyById, sentryUrl } from '../src/sentry.js';
import { SENTRY_FX } from '../src/sentryfx.js';
import { SOUNDS } from '../src/content/audio-defaults.js';
import { UNIT_CATALOG } from '../src/unitcatalog.js';
const names=['Rotor','Plasma','Quiver','Relay','Mortar','Lancer','Needle','Heptapod'];
const labels=names.map((name,i)=>`${i+1}. ${name}`);
assert.deepEqual(SENTRIES.map(s=>s.label),labels);
assert.deepEqual(TOWERS.map(s=>s.label),labels);
assert.deepEqual(SENTRY_FAMILIES.map(s=>s.label),labels);
assert.deepEqual(UNIT_CATALOG.friendly.slice(0,8).map(s=>s.label),labels);
assert.deepEqual(TOWER_ORDER,names.map(n=>n.toLowerCase()));
assert.deepEqual(Object.keys(SENTRY_FX).sort(),[...TOWER_ORDER].sort());
assert.equal(useRoster(1).id,2);
const expected=[];
for(const s of SENTRIES){
 assert(SOUNDS[s.fire]);
 assert.equal(TOWERS.find(t=>t.key===s.key).sound,s.fire);
 assert.equal(familyById(String(s.number)).id,s.model);
 for(const tier of [1,2,3])expected.push(`${s.model}_t${tier}.glb`);
}
assert.deepEqual(readdirSync('assets/models/sentries').filter(n=>n.endsWith('.glb')).sort(),expected.sort());
assert.equal(existsSync('assets/models/heptapod.glb'),false);
assert.equal(sentryUrl('needle',1),'assets/models/sentries/needle_t1.glb');
console.log('Shared numbered catalog, sound wiring and retained model inventory pass.');
