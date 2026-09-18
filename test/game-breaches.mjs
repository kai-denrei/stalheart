import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createGameBreaches } from '../src/game-breaches.js';
import { CONTENT } from '../src/content/runtime.js';

// A stand-in sinkhole: the adapter only needs the group, the tune, the frames and the lifecycle calls.
function fakeSinkhole(){
 const group=new THREE.Group(),tune={look:'textured'},looks=[],fx={disposed:false,warmedWith:null,loaded:false};
 return Object.assign(fx,{group,tune,looks,inverseFrame:{value:new THREE.Matrix4()},hole:{value:0},ready:()=>fx.loaded,trigger(){},
  update(){looks.push(tune.look);},state:()=>({look:tune.look}),dispose(){fx.disposed=true;},
  warm(w){fx.warmedWith=w;return w.compile(group);},textures:()=>['map','normal','roughness','ao']});
}
const made=[],make=()=>{const fx=fakeSinkhole();made.push(fx);return fx;};

// Without a getter the game's sinkholes keep the content's look.
{
 const breaches=createGameBreaches(new THREE.Scene(),new THREE.PerspectiveCamera(),null,{makeSinkhole:make});
 breaches.create([0,1,0],[0,0,1],.08);
 assert.equal(made.at(-1).tune.look,CONTENT.breach.look,'no getter: the content look');
 breaches.dispose();
}
// With a getter they follow the game's look, on create and on every update.
{
 let look='battlezone';
 const breaches=createGameBreaches(new THREE.Scene(),new THREE.PerspectiveCamera(),null,{look:()=>look,makeSinkhole:make});
 breaches.create([0,1,0],[0,0,1],.08);const fx=made.at(-1);
 assert.equal(fx.tune.look,'battlezone','create takes the game look over CONTENT.breach');
 breaches.update(.1,()=>{});assert.equal(fx.looks.at(-1),'battlezone');
 look='tronColors';breaches.update(.1,()=>{});
 assert.equal(fx.looks.at(-1),'tronColors','a look changed mid-game reaches the open sinkhole before it draws');
 assert.equal(breaches.state()[0].look,'tronColors');
 breaches.dispose();
}
// THE WARM-UP: one hidden template sinkhole, dressed in the game look and updated once so its wraps are in, handed to the
// warmer; its stone maps go up one per update once they have all arrived; a second warm builds nothing; dispose frees it.
{
 const compiled=[],uploaded=[],warmer={compile:(root)=>{compiled.push(root);return Promise.resolve();},upload:(t)=>uploaded.push(t)};
 const breaches=createGameBreaches(new THREE.Scene(),new THREE.PerspectiveCamera(),null,{look:()=>'battlezone',makeSinkhole:make});
 const before=made.length;breaches.warm(warmer);breaches.warm(warmer);
 assert.equal(made.length,before+1,'one template, however often warm is called');
 const t=made.at(-1);
 assert.equal(t.warmedWith,warmer);assert.deepEqual(compiled,[t.group],'the template group goes to the warmer');
 assert.equal(t.tune.look,'battlezone','the template wears the game look, so its programs are the ones the game will draw');
 assert.equal(t.looks.length,1,'updated once, visible, so the wraps and look are applied before compiling');
 assert.equal(t.group.visible,false,'and hidden again');
 assert.equal(breaches.state().length,0,'the template is not a breach');
 breaches.update(.1,()=>{});assert.deepEqual(uploaded,[],'no upload before the maps have arrived');
 t.loaded=true;breaches.update(.1,()=>{});breaches.update(.1,()=>{});
 assert.deepEqual(uploaded,['map','normal'],'one map per update once ready');
 breaches.update(.1,()=>{});breaches.update(.1,()=>{});breaches.update(.1,()=>{});
 assert.deepEqual(uploaded,['map','normal','roughness','ao'],'all four, then nothing more');
 breaches.dispose();assert.equal(t.disposed,true,'dispose frees the template');
}
console.log('Game breaches: sinkholes follow the game look through the getter, and keep the content look without one; the warm-up template compiles once and uploads its maps one per frame.');
