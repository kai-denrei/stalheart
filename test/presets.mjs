import { RETIRED_HOWITZER } from '../src/content/retired-howitzer.js';
import assert from 'node:assert/strict';
import { baselinePreset, clone, validatePreset, parsePreset, serializePreset, resolveSounds } from '../src/content/preset.js';
import { CONTENT, selectContent, SENTRY_FX, SOUNDS } from '../src/content/runtime.js';
import { createPresetRepository } from '../src/platform/preset-repository.js';
const oldPreset=id=>{const p=baselinePreset(id);delete p.breach;p.weapons.howitzer=clone(RETIRED_HOWITZER);delete p.weapons.needle;p.audio.sentry_howitzer=clone(p.audio.sentry_needle);delete p.audio.sentry_needle;return p;};
const legacy=oldPreset('legacy');delete legacy.missiles;legacy.base='stalheart-fx-2';
const migrated=parsePreset(JSON.stringify(legacy));
assert.equal(migrated.base,'stalheart-fx-7');assert.equal(migrated.missiles.quiver.duration,1.35);
assert.deepEqual(migrated.weapons.quiver,legacy.weapons.quiver);assert(!migrated.weapons.howitzer);assert.deepEqual(migrated.weapons.needle,baselinePreset().weapons.needle);
const version3=oldPreset('version-three');version3.base='stalheart-fx-3';
for(const m of Object.values(version3.missiles)){for(const key of ['minRange','maxRange','lockGate','lockTime','lockBreak','aimTolerance'])delete m[key];}
version3.missiles.quiver.length=.7;version3.missiles.heptapod.duration=3.5;
const upgraded=parsePreset(JSON.stringify(version3));
assert.equal(upgraded.base,'stalheart-fx-7');
assert.equal(upgraded.missiles.quiver.length,.7);assert.equal(upgraded.missiles.heptapod.duration,3.5);
assert.equal(upgraded.missiles.quiver.minRange,3);assert.equal(upgraded.missiles.heptapod.maxRange,30);
assert.deepEqual(upgraded.weapons.quiver,version3.weapons.quiver);assert.deepEqual(upgraded.audio.sentry_quiver,version3.audio.sentry_quiver);
const badLegacy=clone(version3);badLegacy.missiles.quiver.unknown=5;
assert.throws(()=>parsePreset(JSON.stringify(badLegacy)),/unknown/);
const version4=oldPreset('version-four');version4.base='stalheart-fx-4';
for(const m of Object.values(version4.missiles))for(const key of ['lockGate','lockTime','lockBreak','aimTolerance'])delete m[key];
version4.missiles.quiver.minRange=9;version4.missiles.quiver.maxRange=40;
const v4Before=JSON.stringify(version4),v5=parsePreset(v4Before);
assert.equal(v5.missiles.quiver.lockTime,1.1);assert.equal(v5.missiles.quiver.minRange,9);
assert.equal(v5.missiles.quiver.maxRange,40);assert.equal(JSON.stringify(version4),v4Before);
version4.missiles.quiver.lockTime=.5;assert.throws(()=>parsePreset(JSON.stringify(version4)),/unknown/);
const previousContent=CONTENT;
const p=baselinePreset('test-export');
p.missiles.quiver.minRange=7;p.missiles.quiver.maxRange=21;
p.weapons.lancer.impact.size=.93;p.audio.kinetic_fire.gain=.42;
assert.deepEqual(parsePreset(serializePreset(p)),p);
assert.equal(serializePreset({...p,audio:clone(p.audio)}),serializePreset(p));
for(const mutate of [
 p=>p.schema=2,p=>p.base='unknown',p=>p.id='../escape',p=>p.audio.kinetic_fire.file='https://elsewhere/',
 p=>p.weapons.lancer.shot.projSpeed=999,p=>p.weapons.lancer.shot.kind='field',
 p=>p.weapons.lancer.impact.size=Infinity,p=>p.weapons.lancer.impact.colors.flash=-1,
 p=>p.weapons.lancer.impact.tune.sparkCount=1.5,p=>p.weapons.lancer.impact.recipe=['unknown'],
 p=>delete p.audio.tank_engine,p=>p.damage=200,
 p=>p.missiles.quiver.length=0,p=>p.missiles.heptapod.duration=Infinity,
 p=>p.missiles.quiver.mesh='remote',p=>p.missiles.quiver.profile='unknown',
 p=>p.missiles.quiver.exhaust=1,
 p=>p.missiles.quiver.minRange=-1,p=>p.missiles.quiver.maxRange=101,
 p=>p.missiles.quiver.minRange=22,p=>p.missiles.heptapod.maxRange=NaN,
 p=>delete p.missiles.quiver.maxRange,p=>p.missiles.quiver.lockTime=0,
 p=>p.missiles.quiver.lockBreak=2,p=>p.missiles.quiver.aimTolerance=NaN,
 p=>delete p.missiles.heptapod.lockGate,
]){const bad=clone(p);mutate(bad);assert.throws(()=>validatePreset(bad));}
assert.throws(()=>parsePreset(' '.repeat(250001)));
const values=new Map(),backing={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const repo=createPresetRepository(()=>backing);assert.equal(repo.read(),null);repo.write(p);const old=[...values.entries()];
assert.throws(()=>repo.write({...p,id:'INVALID'}));assert.deepEqual([...values.entries()],old);
const blocked=createPresetRepository(()=>({setItem(){throw Error('quota');}}));assert.throws(()=>blocked.write(p),/quota/);
assert.equal(CONTENT,previousContent); // writing a draft never selects runtime content
selectContent(repo.read());assert.equal(CONTENT.id,'test-export');
assert.equal(SENTRY_FX.lancer.impact.size,.93);assert.equal(SOUNDS.kinetic_fire.gain,.42);
assert.equal(SOUNDS.kinetic_fire.file,'assets/audio/kinetic_fire.mp3');
assert.equal(resolveSounds(p).kinetic_fire.bus,'towers');
assert.throws(()=>SENTRY_FX.lancer.impact.size=2);p.weapons.lancer.impact.size=2;assert.equal(SENTRY_FX.lancer.impact.size,.93);
assert.throws(()=>selectContent(p),/already selected/);
repo.clear();assert.equal(repo.read(),null);
console.log('Preset round-trip, strict validation, draft isolation, immutable selection and fixed sound references pass.');

const v6=baselinePreset('before-breaches');delete v6.breach;v6.base='stalheart-fx-6';v6.missiles.quiver.length=.67;
const v7=parsePreset(JSON.stringify(v6));assert.equal(v7.base,'stalheart-fx-7');assert.equal(v7.missiles.quiver.length,.67);assert.equal(v7.breach.craterRadius,1);assert.equal(v7.breach.fissureWidth,1.15);
for(const change of [{duration:NaN},{look:'unknown'},{fissureArms:3.5},{extra:1}]){const p=baselinePreset();Object.assign(p.breach,change);assert.throws(()=>validatePreset(p));}
