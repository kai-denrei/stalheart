import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createBreachRubble } from '../src/breach-rubble.js';
const scene=new THREE.Scene(),caps=createBreachRubble(scene),source=new THREE.Group();
source.position.set(0,1,0);source.scale.setScalar(.04);
for(let i=0;i<12;i++)caps.add(source,1);
assert.equal(scene.children.length,1);
assert.equal(caps.state().caps,12);assert.equal(caps.state().rocks,288);assert.equal(caps.state().drawCalls,1);
const mesh=scene.children[0],matrix=new THREE.Matrix4(),p=new THREE.Vector3();
for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));p.setFromMatrixPosition(matrix);assert(p.length()>1&&p.length()<1.02);}
assert(mesh.boundingSphere.radius>0);
caps.reset();assert.equal(caps.state().rocks,0);caps.add(source,1);assert.equal(caps.state().caps,1);
caps.dispose();assert.equal(scene.children.length,0);
console.log('Breach rubble: shared batch grows, conforms to planet, resets and disposes.');
