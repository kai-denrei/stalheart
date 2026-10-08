// The kit's scripts/verify-feeding.mjs as of the export's commit f2a4f89 (lab-creatures, kai-denrei; derived from Jelly Baby by
// scottstts; GPL-3.0, see src/fx/nih-dairia/LICENSE), pointed at the port.
// Changes from the kit's script: imports go to src/fx/nih-dairia and the vendored three; the models load
// from assets/creatures/nih-dairia relative to this file; PREY_SHAPES and preyImprint come from
// prey-shapes.js (the logic half of the kit's prey.ts); AutoLure (src/monster/auto-lure.ts, not part of
// this port) is copied below, types stripped, as a test fixture; the kit's diagnostic console.log lines
// are folded into the one summary line at the end.
// createPrey (the mesh half of prey.ts) is Task 4's, so the shape section runs without the rendered mesh:
//   dropped: 'wrapped prey has no red emission' (material.emissiveIntensity 0) and 'wrapped prey has
//     the tissue material response' (material.metalness 0), both checks of createPrey's material;
//   changed: every rendered.mesh.visible reads feeding.visible instead (createPrey's update assigns
//     mesh.visible=feeding.visible and nothing else writes it): 'concealed prey never reappears during
//     recovery', 'colored prey is concealed when membrane forms', the absorbing-phase concealment,
//     'late render cannot flash the original prey' and 'reset restores a fresh red prey'.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../vendor/three.module.js';
import { FeedingCycle } from '../src/fx/nih-dairia/feeding.js';
import { MonsterBehavior } from '../src/fx/nih-dairia/behavior.js';
import { ARENA } from '../src/fx/nih-dairia/arena.js';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';

// The kit's src/monster/auto-lure.ts, types stripped (a test fixture here).
/** Bounded, smooth figure-eight stimulus. Manual grabbing switches it off. */
class AutoLure {
  enabled=false;
  time=0;
  destination=new Vector3();
  reset(){this.time=0;}
  step(h,target,creature){
    if(!this.enabled||h<=0)return;
    const distance=Math.hypot(target.x-creature.x,target.z-creature.z);
    this.time+=h*(distance>.22?.35:1);
    const phase=this.time*.45;
    this.destination.set(Math.sin(phase)*.34,ARENA.lureHeight,Math.sin(phase*2+.6)*.18);
    const radius=Math.hypot(this.destination.x,this.destination.z);
    if(radius>ARENA.lureRadius)this.destination.multiplyScalar(ARENA.lureRadius/radius);
    this.destination.y=ARENA.lureHeight;
    const delta=this.destination.sub(target),length=delta.length();
    const speed=distance>.22?.025:.105;
    if(length>0)target.addScaledVector(delta,Math.min(1,speed*h/length));
  }
}

const feeding=new FeedingCycle(),target=new Vector3(.02,.012,0),center=new Vector3(0,.03,0);
for(let i=0;i<120;i++)feeding.step(PHYS.step,target,center,false);
assert.equal(feeding.phase,'hunting','held prey and inactive creatures cannot start feeding');
for(let i=0;i<30;i++)feeding.step(PHYS.step,target,center,true);
assert.equal(feeding.phase,'cradling');
for(let i=0;i<400;i++)feeding.step(PHYS.step,target,center,true,false);
assert.equal(feeding.phase,'covering','the creature cannot lower itself while off-center');
assert.equal(feeding.drop,0);
center.x=target.x;
for(let i=0;i<300;i++)feeding.step(PHYS.step,target,center,true,false);
assert.equal(feeding.phase,'dropping','absorption waits for actual abdominal ground contact');
assert.equal(feeding.scale,1,'a ball is not shrunk away while the body is still descending');
feeding.reset(target);assert(!feeding.locked&&feeding.scale===1&&feeding.meals===0,'reset clears capture and restores prey');
const wobble=new FeedingCycle(),wobbleCenter=new Vector3(0,.03,0),wobbleTarget=new Vector3(0,.012,0);
for(let i=0;i<30;i++)wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true);
for(let i=0;i<340;i++)wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true);
for(let i=0;i<240&&wobble.phase==='covering';i++){
  wobbleCenter.x=i%6<4?.005:.009;
  wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true,false);
}
assert.equal(wobble.phase,'dropping','small elastic oscillations do not endlessly restart covering');

const blockedWrap=new FeedingCycle(),wrappedTarget=new Vector3(.04,.012,0),wrappedCenter=new Vector3(0,.03,0);
for(let i=0;i<600;i++)blockedWrap.step(PHYS.step,wrappedTarget,wrappedCenter,true,true,false);
assert.equal(blockedWrap.phase,'cradling','unsafe membrane contact cannot time out into covering');
for(let i=0;i<40;i++)blockedWrap.step(PHYS.step,wrappedTarget,wrappedCenter,true,true,true);
assert.equal(blockedWrap.phase,'covering','clearance dwell releases the cradle');

const bytes=readFileSync(new URL('../assets/creatures/nih-dairia/nih-dairia.bin',import.meta.url));
const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync(new URL('../assets/creatures/nih-dairia/nih-dairia.json',import.meta.url),'utf8'))));
const rig=new MonsterBehavior(body),rest=body.surface.positions.slice(),core=[];
for(let j=0;j<rest.length;j+=3)if(Math.hypot(rest[j],rest[j+2])<.018)core.push(j+1);
const tick=()=>{rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12,'feeding never inverts an element');};
rig.active=false;for(let i=0;i<480;i++)tick();body.updateSurface();
const standing=Math.min(...core.map(j=>body.surface.positions[j]));
rig.target.set(rig.torsoCenter.x+.014,.012,rig.torsoCenter.z);const original=rig.target.clone();rig.active=true;
const phases=new Set();let lowest=Infinity,smallest=1,imprinted=-Infinity,resolved=Infinity;
const upper=[];
for(let j=0;j<rest.length;j+=3)if(body.surface.restNormals[j+1]>.25&&Math.hypot(rest[j],rest[j+2])<.032)upper.push(j);
const prominence=()=>{
  const inside=[],outside=[],positions=body.surface.positions;
  for(const j of upper){const d=Math.hypot(positions[j]-original.x,positions[j+2]-original.z);if(d<.008)inside.push(positions[j+1]);else if(d>.018&&d<.028)outside.push(positions[j+1]);}
  assert(inside.length&&outside.length,'surface samples cover the prey and surrounding membrane');
  return inside.reduce((sum,y)=>sum+y,0)/inside.length-outside.reduce((sum,y)=>sum+y,0)/outside.length;
};
let lastPhase='hunting';
for(let i=0;i<2400;i++){
  tick();phases.add(rig.feeding.phase);
  assert(rig.feeding.scale>=0&&rig.feeding.scale<=1);
  if(lastPhase==='covering'&&rig.feeding.phase==='dropping')assert(Math.hypot(rig.torsoCenter.x-original.x,rig.torsoCenter.z-original.z)<.010,'torso gets on top before descending');
  if(['cradling','covering','dropping','absorbing','recovering'].includes(rig.feeding.phase)){
    assert(rig.target.distanceTo(original)<1e-9,'captured target remains fixed');
    assert(rig.feeding.preyPosition.distanceTo(original)<1e-9,'prey is never sucked toward or into the creature');
  }
  if(rig.feeding.phase==='covering'||rig.feeding.phase==='dropping')assert.equal(rig.feeding.scale,1,'ball retains its full shape while being covered');
  if(rig.feeding.phase==='absorbing'){
    body.updateSurface();lowest=Math.min(lowest,...core.map(j=>body.surface.positions[j]));
    if(rig.feeding.imprint>.99)imprinted=Math.max(imprinted,prominence());
    if(rig.feeding.imprint<.02)resolved=Math.min(resolved,prominence());
    assert.equal(rig.feeding.scale,0,'prey is concealed beneath the molded body');
    assert.equal(rig.feeding.drop,1,'body stays down while the imprint resolves');
  }
  lastPhase=rig.feeding.phase;smallest=Math.min(smallest,rig.feeding.scale);
  if(rig.feeding.meals===1&&rig.feeding.phase==='hunting')break;
}
assert(lowest<.002,'the center reaches the table around the prey');
assert(standing-lowest>.02,'the torso fully descends');
assert(imprinted>.004,'a visible round imprint protrudes above the surrounding skin');
assert(imprinted-resolved>.004,'the bulge resolves before standing back up');
assert.equal(smallest,0,'the prey completely disappears');
assert.equal(rig.feeding.meals,1,'one capture produces exactly one meal');
assert(['cradling','covering','dropping','absorbing','recovering','spawning','hunting'].every(phase=>phases.has(phase)));
assert(rig.target.distanceTo(original)>.2,'new prey spawns elsewhere');
assert(Math.hypot(rig.target.x,rig.target.z)<=ARENA.lureRadius,'new prey stays inside the arena');
assert(body.volumeRatio()>.8&&body.volumeRatio()<1.2);

// Automatic chasing must complete repeated capture/respawn cycles, not stall.
rig.reset();const auto=new AutoLure();auto.enabled=true;
for(let i=0;i<7200&&rig.feeding.meals<2;i++){
  if(!rig.feeding.locked){auto.step(PHYS.step,rig.target,rig.center);rig.stimulus=1;}
  tick();
}
assert(rig.feeding.meals>=2,'automatic prey resumes movement and can be consumed again');
const coveringTimes=[];
for(const [index,angle] of [0,Math.PI/3,Math.PI,4.2].entries()){
  rig.reset();rig.active=true;
  if(index===3)Object.assign(rig.settings,{speed:3,stepHeight:.05,stepDuration:.08,stepSpacing:.015,stride:.05,erratic:3});
  rig.target.set(Math.cos(angle)*.12,.012,Math.sin(angle)*.12);rig.stimulus=1;
  let coveredAt=-1,droppedAt=-1;
  for(let i=0;i<2880;i++){
    tick();
    if(rig.feeding.phase==='covering'&&coveredAt<0)coveredAt=i;
    if(rig.feeding.phase==='dropping'){droppedAt=i;break;}
  }
  assert(coveredAt>=0&&droppedAt>=0,`approach ${index} progresses into feeding`);
  const duration=(droppedAt-coveredAt)*PHYS.step;coveringTimes.push(duration);
  assert(duration<3,'covering converges promptly even after an aggressive chase');
  assert(rig.gait.planted.every(Boolean),'covering plants the feet instead of continuing to walk');
}
rig.reset();assert(!rig.feeding.locked&&rig.feeding.visible&&rig.feeding.meals===0,'reset restarts the complete lifecycle');

// Every rendered shape has its own membrane profile and completes ingestion.
const { PREY_SHAPES, preyImprint }=await import('../src/fx/nih-dairia/prey-shapes.js');
const seen=[];
Object.assign(rig.settings,{speed:1.8,stepHeight:.032,stepDuration:.12,stepSpacing:.035,stride:.022,erratic:2});
for(let shapeIndex=0;shapeIndex<PREY_SHAPES.length;shapeIndex++){
  rig.reset();rig.feeding.meals=shapeIndex;
  rig.active=false;for(let i=0;i<240;i++)tick();
  rig.target.set(rig.torsoCenter.x,.012,rig.torsoCenter.z);rig.active=true;
  const shape=rig.feeding.shape;seen.push(shape);let absorbed=false,hidden=false,previousCoverage=0;
  for(let i=0;i<2200;i++){
    tick();
    if(rig.feeding.phase!=='spawning'){
      assert(rig.feeding.skinCoverage>=previousCoverage,'skin wrapping cannot reverse during the meal');
      previousCoverage=rig.feeding.skinCoverage;
      if(hidden)assert(!rig.feeding.visible,'concealed prey never reappears during recovery');
      hidden ||= !rig.feeding.visible;
      if(['dropping','absorbing','recovering'].includes(rig.feeding.phase)){
        assert.equal(rig.feeding.skinCoverage,1,'red appearance is gone before the body descends');
      }
    }
    if(rig.feeding.phase==='dropping'&&rig.feeding.drop>.55)assert(!rig.feeding.visible,'colored prey is concealed when membrane forms');
    if(rig.feeding.phase==='absorbing'){absorbed=true;assert.equal(rig.feeding.shape,shape);assert(!rig.feeding.visible);}
    if(rig.feeding.phase==='spawning')break;
  }
  assert(absorbed,`${shape} completes the drop and absorption`);
  assert.equal(rig.feeding.phase,'spawning',`${shape} resolves and respawns`);
  assert.equal(rig.feeding.shape,PREY_SHAPES[(shapeIndex+1)%4]);
  assert.equal(rig.feeding.skinCoverage,0,'only new prey restores the original surface');
  assert(preyImprint(shape,0,0)>.5);assert.equal(preyImprint(shape,.1,.1),0);
}
assert.deepEqual(seen,[...PREY_SHAPES]);
assert(preyImprint('cube',.012,.012)>preyImprint('sphere',.012,.012),'cube retains its broad flat top');
assert.notEqual(preyImprint('prism',.012,.009),preyImprint('cube',.012,.009),'prism outline differs from cube');

// Render-rate independence: skip the entire wrapping/concealment transition.
const skipped=new FeedingCycle(),same=new Vector3(0,.012,0);
for(let i=0;i<600;i++)skipped.step(PHYS.step,same,same,true,true);
assert.equal(skipped.skinCoverage,1);
assert(!skipped.visible,'late render cannot flash the original prey');
skipped.reset(same);
assert(skipped.visible&&skipped.skinCoverage===0,'reset restores a fresh red prey');

const f=v=>+v.toFixed(4);
console.log(`Nih-Dairia feeding: the cycle's gates, one meal (standing ${f(standing)} m, down ${f(lowest)} m, imprint ${f(imprinted)} m resolving to ${f(resolved)} m), auto-lure repeat meals, covering in ${coveringTimes.map(v=>v.toFixed(2)).join(' / ')} s, ${seen.join(', ')} each eaten, no late flash, as the kit verifies them.`);
