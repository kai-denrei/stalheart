import assert from 'node:assert/strict';
import { baselinePreset, clone, validatePreset, parsePreset, serializePreset, resolveSounds } from '../src/content/preset.js';
import { CONTENT, selectContent, SENTRY_FX, SOUNDS } from '../src/content/runtime.js';
import { createPresetRepository } from '../src/platform/preset-repository.js';
const previousContent=CONTENT;
const p=baselinePreset('test-export');
p.weapons.lancer.impact.size=.93;p.audio.tower_single.gain=.42;
assert.deepEqual(parsePreset(serializePreset(p)),p);
assert.equal(serializePreset({...p,audio:clone(p.audio)}),serializePreset(p));
for(const mutate of [
 p=>p.schema=2,p=>p.base='unknown',p=>p.id='../escape',p=>p.audio.tower_single.file='https://elsewhere/',
 p=>p.weapons.lancer.shot.projSpeed=999,p=>p.weapons.lancer.shot.kind='field',
 p=>p.weapons.lancer.impact.size=Infinity,p=>p.weapons.lancer.impact.colors.flash=-1,
 p=>p.weapons.lancer.impact.tune.sparkCount=1.5,p=>p.weapons.lancer.impact.recipe=['unknown'],
 p=>delete p.audio.tank_engine,p=>p.damage=200,
]){const bad=clone(p);mutate(bad);assert.throws(()=>validatePreset(bad));}
assert.throws(()=>parsePreset(' '.repeat(250001)));
const values=new Map(),backing={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const repo=createPresetRepository(()=>backing);assert.equal(repo.read(),null);repo.write(p);const old=[...values.entries()];
assert.throws(()=>repo.write({...p,id:'INVALID'}));assert.deepEqual([...values.entries()],old);
const blocked=createPresetRepository(()=>({setItem(){throw Error('quota');}}));assert.throws(()=>blocked.write(p),/quota/);
assert.equal(CONTENT,previousContent); // writing a draft never selects runtime content
selectContent(repo.read());assert.equal(CONTENT.id,'test-export');
assert.equal(SENTRY_FX.lancer.impact.size,.93);assert.equal(SOUNDS.tower_single.gain,.42);
assert.equal(SOUNDS.tower_single.file,'assets/audio/tower_single.mp3');
assert.equal(resolveSounds(p).tower_single.bus,'towers');
assert.throws(()=>SENTRY_FX.lancer.impact.size=2);p.weapons.lancer.impact.size=2;assert.equal(SENTRY_FX.lancer.impact.size,.93);
assert.throws(()=>selectContent(p),/already selected/);
repo.clear();assert.equal(repo.read(),null);
console.log('Preset round-trip, strict validation, draft isolation, immutable selection and fixed sound references pass.');
