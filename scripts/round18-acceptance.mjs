import assert from 'node:assert/strict';
import { writeFileSync,readFileSync } from 'node:fs';
export async function round18({go,until,evaluate,send,delay,finish}) {
 const T='window.__stalheartTest',R=`${T}.rover.state()`;
 const shot=async name=>{const p=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`artifacts/browser/${name}.png`,Buffer.from(p.data,'base64'));};
 await go('round18-scan','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1&dog=1&first=1#td');
 await until(`${T}?.state().arrival?.signature`,120000);await evaluate(`${T}.landing('skip')`);
 await until(`${T}.state().arrival.landing?.phase==='manual'`,30000);await evaluate(`${T}.landing('skip')`);
 await until(`(()=>{document.querySelector('#gunship-briefing:not([hidden]) [data-skip]')?.click();return ${T}?.dog.state().active;})()`,180000);await delay(3000);
 for(const [index,kind] of [[0,'rock'],[1,'biomass']]){
   await evaluate(`${T}.dog.goto(${index},8)`);await delay(2000);await evaluate(`${T}.dog.goto(${index},4)`);
   await until(`${T}.dog.state().scan.beam`,10000);
   const s=await evaluate(`${T}.dog.state().scan`);assert.ok(s.sweeping&&s.coneSegments>=24&&s.radiusM>=1.2);
   await shot(`round18-cone-${kind}`);
   await until(`${T}.dog.state().scan.result==='${kind}'`,10000);await delay(400);
   const hud=await evaluate(`(()=>{const h=document.querySelector('.scout-scan-hud'),r=h.getBoundingClientRect();return {width:r.width,height:r.height,bg:getComputedStyle(h).backgroundColor,subject:parseFloat(getComputedStyle(h.querySelector('.scan-subject')).fontSize),results:parseFloat(getComputedStyle(h.querySelector('.scan-results')).fontSize),text:h.textContent};})()`);
   assert.equal(hud.width,1440);assert.equal(hud.height,900);assert.equal(hud.bg,'rgba(0, 0, 0, 0)');assert.ok(hud.subject>=36&&hud.results>=22);assert.match(hud.text,/SCAN COMPLETE/);
   await shot(`round18-result-${kind}`);
 }
 await finish();
 await go('round18-hauler','index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&pets=born#td');
 await until(`${R}.ready`,120000);await evaluate(`${T}.sectorQuiet(true);${T}.sectorCull(999);${T}.rover.spend(Math.min(8000,${R}.bank));document.querySelector('#controls-card [data-close]')?.click()`);
 const initial=await evaluate(R);assert.match(initial.scene.url,/sai93/);assert.equal(initial.resource,'biomass');assert.equal(initial.capacity,6000);
 // An accessible outdoor pile, away from the landing pad and mineral marker.
 const pile=await evaluate(`(()=>{const r=${R},ci=${T}.rover.openNear(r.deposits[0].cell);${T}.rover.lay(ci,1200);return ${T}.rover.piles().find(p=>p.kg>=1000)?.cell;})()`);assert.ok(Number.isInteger(pile));
 await evaluate(`${T}.rover.flareAt(${pile})`);
 await until(`${R}.cargo>100`,120000);assert.equal(await evaluate(`${R}.resource`),'biomass');
 const target=initial.deposits[1]??initial.deposits[0];assert.ok(await evaluate(`${T}.rover.mine(${JSON.stringify(target.id)})`));
 await until(`${R}.resource==='mineral'`,120000);
 let s=await evaluate(R);assert.ok(s.deliveredBy.biomass>1000,'biomass unloaded before resource switch');assert.equal(s.capacity,600);
 await until(`${R}.deliveredBy.mineral>100`,120000);s=await evaluate(R);assert.ok(s.deliveredBy.biomass>1000&&s.deliveredBy.mineral>100);
 // Runtime contact list includes the real dog/cat/heavies and uses their actual poses.
 const collision=await evaluate(`(()=>{const f=${T}.traffic,m=${T}.rover.metres(),bs=f.contacts();return bs.filter(b=>b.id.startsWith('companion:')).map(b=>{const p=b.pos.map(x=>x/Math.hypot(...b.pos)),d=b.dir;const a=p.map((x,i)=>x-d[i]*8*m),z=p.map((x,i)=>x+d[i]*8*m);return {id:b.id,blocks:f.blocked(a,z,.7*m,'test-dog')};});})()`);
 assert.ok(collision.some(b=>b.id==='companion:k9'));assert.ok(collision.every(b=>b.blocks));
 const footprint=await evaluate(`${T}.showcase.footprint('stalheart',5)`);assert.ok(footprint.solid>0,'gantry feet block on their actual footprint');
 const ceiling=await evaluate(`${T}.traffic.ceiling(${JSON.stringify(footprint.at)},${JSON.stringify(footprint.at)},${T}.rover.metres()*3,'isao')`);assert.ok(ceiling>10*(await evaluate(`${T}.rover.metres()`)),'Isao detects gantry height');
 await finish();
 const requests=JSON.parse(readFileSync('artifacts/browser/round18-hauler-requests.json','utf8'));assert.ok(!requests.some(r=>/yushi045_rover|yushi.*rover.*glb/i.test(r.url)),'retired Yushi vehicle is not loaded');
 console.log('  wide scan cones + helmet results; one SAI-93 unloads both resources; friendly contacts and gantry clearance passed',s.deliveredBy);
}
