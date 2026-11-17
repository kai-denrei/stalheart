import assert from 'node:assert/strict';
import { flareStatus, flareHudSpot } from '../src/fx/flare-status.js';
import { FLARE } from '../src/content/rover.js';
const empty=flareStatus(0,1,2,FLARE),full=flareStatus(8,0,0,FLARE);
assert.equal(empty.empty,true);assert.match(empty.title,/0\/8/);assert.match(empty.detail,/CARGO DROP-OFF FLAGS/);
assert.equal(full.empty,false);assert.match(full.detail,/90s BURN.*AMBER 0\/3.*VIOLET 0\/3/);
console.log('Flare status: carried stock, separate marker limits, empty supply and refill locations.');

for(const [w,h] of [[1440,900],[390,844]]){const blocks=[{left:w-310,right:w,top:h-250,bottom:h}];const p=flareHudSpot(w,h,290,65,blocks);assert.ok(p);assert.ok(p.y+65<=h-262||p.x+290<=w-322);}
assert.equal(flareHudSpot(390,844,290,65,[{left:0,right:390,top:0,bottom:844}]),null);
