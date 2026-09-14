import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createGameBreaches } from '../src/game-breaches.js';
import { CONTENT } from '../src/content/runtime.js';

// A stand-in sinkhole: the adapter only needs the group, the tune, the frames and the lifecycle calls.
function fakeSinkhole(){
 const group=new THREE.Group(),tune={look:'textured'},looks=[];
 return {group,tune,looks,inverseFrame:{value:new THREE.Matrix4()},hole:{value:0},ready:()=>true,trigger(){},
  update(){looks.push(tune.look);},state:()=>({look:tune.look}),dispose(){}};
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
console.log('Game breaches: sinkholes follow the game look through the getter, and keep the content look without one.');
