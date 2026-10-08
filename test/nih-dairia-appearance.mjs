// The Nih-Dairia presentation on r160's physical material: the skin's colours, the per-vertex transmission mask that
// replaces the kit's TSL transmissionNode, the prey's red-to-tissue blend that replaces its colorNode, and the creature's
// contract. Also the two prey-material assertions of the kit's scripts/verify-feeding.mjs at f2a4f89 (lab-creatures,
// kai-denrei; derived from Jelly Baby by scottstts; GPL-3.0, see src/fx/nih-dairia/LICENSE) that the feeding test dropped
// until createPrey existed: 'wrapped prey has no red emission' and 'wrapped prey has the tissue material response',
// checked over a real feeding cycle as the kit does, with the tissue colour at coverage 1 added for the r160 material.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Color, Vector3, ShaderLib } from '../vendor/three.module.js';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { FeedingCycle } from '../src/fx/nih-dairia/feeding.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
import { tissueColors } from '../src/fx/nih-dairia/skin.js';
import { createMonsterAppearance } from '../src/fx/nih-dairia/appearance.js';
import { createPrey, preyGeometry, PREY_SHAPES } from '../src/fx/nih-dairia/prey.js';
import { createNihDairia } from '../src/fx/nih-dairia/creature.js';
import { NIH_DAIRIA_LOOK, NIH_DAIRIA_MOTION } from '../src/content/nih-dairia.js';

const load=name=>{
  const bytes=readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`,import.meta.url));
  return parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`,import.meta.url),'utf8')));
};
const near=(a,b,eps,name)=>assert(Math.abs(a-b)<=eps,`${name}: ${a} not within ${eps} of ${b}`);
const nearColor=(a,b,name)=>{near(a.r,b.r,1e-6,name);near(a.g,b.g,1e-6,name);near(a.b,b.b,1e-6,name);};

// ---- the skin ----
const body=new SoftBody(load('nih-dairia')),feeding=new FeedingCycle();
const appearance=createMonsterAppearance(body,feeding,NIH_DAIRIA_LOOK),geometry=appearance.mesh.geometry;
const positions=body.surface.positions,colors=geometry.getAttribute('color'),mask=geometry.getAttribute('transmissionMask');
assert.equal(appearance.mesh.geometry,body.surface.geometry,'the mesh draws the body surface');
assert.equal(appearance.mesh.frustumCulled,false,'the skin is never frustum-culled');
assert.equal(colors.array.length,positions.length,'one colour per surface vertex');
assert(colors.array.every(c=>c>=0&&c<=1),'skin colours lie in [0, 1]');
assert.equal(mask.count,positions.length/3,'one transmission mask value per surface vertex');
assert(mask.array.every(m=>m===1),'the mask starts fully transmissive');
const material=appearance.mesh.material;
assert(material.isMeshPhysicalMaterial&&material.vertexColors&&material.transmission===NIH_DAIRIA_LOOK.transmission&&material.clearcoat===NIH_DAIRIA_LOOK.clearcoat,'the skin is the look on MeshPhysicalMaterial');
// the patch runs on r160's real physical shader strings, so a renamed include fails here and not first in a browser
const physical=ShaderLib.physical;
assert(physical.vertexShader.includes('#include <begin_vertex>')&&physical.fragmentShader.includes('#include <transmission_fragment>'),'r160 physical shader has the patched includes');
const shader={vertexShader:physical.vertexShader,fragmentShader:physical.fragmentShader};
material.onBeforeCompile(shader);
assert(shader.vertexShader.includes('attribute float transmissionMask;')&&shader.vertexShader.includes('vTransmissionMask = transmissionMask;'),'the vertex patch declares and passes the mask');
assert(shader.fragmentShader.includes('varying float vTransmissionMask;')&&shader.fragmentShader.includes('material.transmission = transmission * vTransmissionMask;')&&!shader.fragmentShader.includes('#include <transmission_fragment>'),'the shader patch scales transmission by the mask');
assert(!shader.fragmentShader.includes('material.transmission = transmission;'),'no unmasked transmission assignment is left');

const base=colors.array.slice(),distance=i=>Math.hypot(positions[i*3]-feeding.capturedPosition.x,positions[i*3+2]-feeding.capturedPosition.z);
feeding.phase='covering';feeding.skinCoverage=1;feeding.capturedPosition.set(.03,.012,0);
const version=mask.version;appearance.update();
let inside=0,outside=0;
for(let i=0;i<mask.count;i++){
  const d=distance(i);
  if(d<.016){inside++;near(mask.array[i],0,1e-9,'a covered vertex within 0.016 of the capture is opaque');}
  else if(d>.040){outside++;assert.equal(mask.array[i],1,'a vertex beyond 0.040 of the capture keeps full transmission');}
  else assert(mask.array[i]>=0&&mask.array[i]<=1,'the mask stays in [0, 1] across the smoothstep');
}
assert(inside>0&&outside>0,'the capture point has surface vertices on both sides of the imprint');
assert(mask.version>version,'the mask is uploaded after a change');
assert.deepEqual(colors.array,base,'feeding never touches the skin colours');
feeding.phase='recovering';feeding.drop=.5;appearance.update();
for(let i=0;i<mask.count;i++)if(distance(i)<.016)near(mask.array[i],.5,1e-9,'recovering scales the coverage by the drop');
feeding.reset(new Vector3(.11,.012,.025));
const restoring=mask.version;appearance.update();
assert(mask.array.every(m=>m===1),'back to hunting, every vertex is fully transmissive again');
assert.equal(mask.version,restoring+1,'the restore is one upload');
appearance.update();
assert.equal(mask.version,restoring+1,'a restored mask is not uploaded again');

// ---- the prey ----
const meanTissue=shape=>{
  const g=preyGeometry(shape),c=tissueColors(g.getAttribute('position').array),n=c.length/3,mean=new Color(0,0,0);
  for(let i=0;i<c.length;i+=3){mean.r+=c[i]/n;mean.g+=c[i+1]/n;mean.b+=c[i+2]/n;}
  g.dispose();return mean;
};
const rendered=createPrey(NIH_DAIRIA_LOOK),fresh=new FeedingCycle();
rendered.update(fresh);
nearColor(rendered.mesh.material.color,new Color(NIH_DAIRIA_LOOK.preyRed),'unwrapped prey is red');
assert.equal(rendered.mesh.material.emissiveIntensity,.2,'unwrapped prey glows red');
assert.equal(rendered.mesh.material.clearcoat,0,'unwrapped prey has no clearcoat');
fresh.skinCoverage=1;rendered.update(fresh);
nearColor(rendered.mesh.material.color,meanTissue('sphere'),'wrapped prey is the mean tissue colour');
fresh.skinCoverage=.5;rendered.update(fresh);
const half=new Color(NIH_DAIRIA_LOOK.preyRed).lerp(meanTissue('sphere'),.5);
nearColor(rendered.mesh.material.color,half,'half-wrapped prey is halfway to tissue');
near(rendered.mesh.material.clearcoat,.325,1e-12,'the clearcoat follows the coverage');
fresh.meals=1;fresh.skinCoverage=1;rendered.update(fresh);
assert.equal(fresh.shape,'cube');
nearColor(rendered.mesh.material.color,meanTissue('cube'),'a new shape recomputes the tissue colour');

// The kit's late-render scenario, over every shape: a feeding cycle stepped to the end of its wrap.
for(let shapeIndex=0;shapeIndex<PREY_SHAPES.length;shapeIndex++){
  const cycle=new FeedingCycle(),same=new Vector3(0,.012,0);cycle.meals=shapeIndex;
  let wrapped=0;
  for(let i=0;i<600;i++){
    cycle.step(PHYS.step,same,same,true,true);rendered.update(cycle);
    if(['dropping','absorbing','recovering'].includes(cycle.phase)){
      wrapped++;
      assert.equal(cycle.skinCoverage,1,'red appearance is gone before the body descends');
      assert.equal(rendered.mesh.material.emissiveIntensity,0,'wrapped prey has no red emission');
      assert.equal(rendered.mesh.material.metalness,0,'wrapped prey has the tissue material response');
      nearColor(rendered.mesh.material.color,meanTissue(cycle.shape),'wrapped prey has the tissue colour');
    }
  }
  assert(wrapped>0,`${PREY_SHAPES[shapeIndex]} reaches the wrapped phases`);
}
rendered.mesh.geometry.dispose();rendered.mesh.material.dispose();

// ---- the creature ----
const creature=await createNihDairia(NIH_DAIRIA_MOTION,'nih-dairia',{cage:load('nih-dairia')});
for(const key of ['mesh','body','motion','settings','appearance','setTarget','update','reset','dispose'])assert(key in creature,`the creature has ${key}`);
assert.equal(creature.mesh,creature.appearance.mesh,'the creature mesh is the appearance mesh');
assert(creature.body.phys!==PHYS&&creature.body.phys.gravity===PHYS.gravity,'the creature steps with its own copy of PHYS');
const steps=creature.update(1/60);
assert.equal(steps,4,'one 60 Hz frame is four 240 Hz steps');
const {solver,skin}=creature.timings;
assert(creature.timings.steps===4&&solver>=0&&skin>=0&&Number.isFinite(solver+skin),'the timings record the solver, the skin and the steps');
assert.equal(creature.update(0),0,'a zero frame takes no steps');
assert.equal(creature.setTarget(new Vector3(.05,.012,0)),true,'a hunting creature takes a target');
creature.motion.feeding.phase='cradling';
assert.equal(creature.setTarget(new Vector3(0,.012,0)),false,'a feeding creature keeps its locked target');
creature.reset();
assert.equal(creature.motion.feeding.phase,'hunting','reset restarts the hunt');

const falling=async gravity=>{
  const c=await createNihDairia(NIH_DAIRIA_MOTION,'nih-dairia',{cage:load('nih-dairia'),phys:{...PHYS,gravity}});
  for(let i=0;i<30;i++)c.update(1/60);
  const y=c.body.center.y;c.dispose();return y;
};
const weightless=await falling(0),heavy=await falling(PHYS.gravity*4);
assert(weightless>heavy+1e-4,`a creature's phys reaches the solver (weightless centre ${weightless} above heavy ${heavy})`);
assert.equal(PHYS.gravity,2.4,'the module constant is untouched');
creature.dispose();creature.dispose();
assert.equal(creature.update(1/60),0,'a disposed creature does not step');

console.log(`Nih-Dairia appearance: skin colours, transmission mask (${inside} vertices opaque under the capture, ${outside} untouched beyond 0.040, one-upload restore), prey red to tissue on all four shapes with no red emission once wrapped, and the creature contract (4 steps a 60 Hz frame, own phys) hold.`);
