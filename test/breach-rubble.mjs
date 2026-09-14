import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createBreachRubble, SETTLE_S } from '../src/breach-rubble.js';
const scene=new THREE.Scene(),caps=createBreachRubble(scene),source=new THREE.Group();
source.position.set(0,1,0);source.scale.setScalar(.04);
for(let i=0;i<12;i++)caps.add(source,1);
assert.equal(scene.children.length,1);
assert.equal(caps.state().caps,12);assert.equal(caps.state().rocks,288);assert.equal(caps.state().drawCalls,1);
const mesh=scene.children[0],matrix=new THREE.Matrix4(),p=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion();
// a new cap is still in the air and small: the rocks pile up rather than appear
assert.equal(caps.state().settling,288,'every new rock is settling');
mesh.getMatrixAt(1,matrix);matrix.decompose(p,q,s);const startHeight=p.length(),startSize=s.x;
caps.update(0);assert.equal(caps.state().settling,288,'a frozen game holds the pile');
caps.update(SETTLE_S*.5);mesh.getMatrixAt(1,matrix);matrix.decompose(p,q,s);
assert(p.length()<startHeight&&s.x>startSize,'half way: lower and bigger');
caps.update(SETTLE_S);assert.equal(caps.state().settling,0,'settled within SETTLE_S');
for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));p.setFromMatrixPosition(matrix);assert(p.length()>1&&p.length()<1.02,'each rock rests on the planet');}
assert(mesh.boundingSphere.radius>0);
caps.reset();assert.equal(caps.state().rocks,0);assert.equal(caps.state().settling,0);caps.add(source,1);assert.equal(caps.state().caps,1);
caps.dispose();assert.equal(scene.children.length,0);
console.log('Breach rubble: shared batch grows, rocks drop in and settle on the planet, resets and disposes.');
