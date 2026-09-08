import assert from 'node:assert/strict';
import {rimRadius,bowlHeight,SINKHOLE_INNER,SINKHOLE_DEPTH,sinkholeGroundHeight} from '../src/core/sinkhole-shape.js';
const radii=Array.from({length:192},(_,i)=>rimRadius(i*Math.PI*2/192));
assert(Math.max(...radii)-Math.min(...radii)>.3,'Rim is visibly irregular');
for(let i=0;i<192;i++){
 const a=i*Math.PI*2/192;
 assert(Math.abs(bowlHeight(a,1))<1e-9);
 assert(Math.abs(bowlHeight(a,SINKHOLE_INNER)+SINKHOLE_DEPTH)<1e-8);
 let previous=0;
 for(let j=1;j<=24;j++){
  const r=1-j/24*(1-SINKHOLE_INNER),y=bowlHeight(a,r);
  assert(y<previous,'Bowl descends continuously');previous=y;
  if(j<24)assert(Math.abs(sinkholeGroundHeight(Math.cos(a)*rimRadius(a)*r*3.5,Math.sin(a)*rimRadius(a)*r*3.5,3.5)-y*3.5)<1e-8);
 }
}
// Approach remains under 42 degrees on the centreline; other walls are steeper.
for(let j=0;j<80;j++){
 const r=.2+j*.009,h=.0001;
 const slope=Math.abs((bowlHeight(1,r+h)-bowlHeight(1,r))/h/rimRadius(1));
 assert(slope<Math.tan(42*Math.PI/180));
}
assert.equal(sinkholeGroundHeight(0,0,0),0);
assert(sinkholeGroundHeight(0,0,3.5)<-10);
console.log('Irregular shared rim, continuous bowl and traversable visual approach pass.');
