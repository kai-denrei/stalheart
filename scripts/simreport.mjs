import { readFileSync } from 'node:fs';
import { normaliseResult } from '../src/simresult.js';
const path=process.argv[2];if(!path){console.error('Usage: node scripts/simreport.mjs runs.jsonl');process.exit(1);}
const med=xs=>{const a=xs.slice().sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
try {
 const runs=readFileSync(path,'utf8').split('\n').filter(x=>x.trim()).map((l,i)=>{try{return normaliseResult(JSON.parse(l));}catch(e){throw Error(`Line ${i+1}: ${e.message}`);}});
 const groups=new Map();
 for(const r of runs){const key=`${r.build||'legacy'} / ${r.balance||'legacy'} / FX ${r.content||'legacy'} / roster ${r.roster??'unknown'} / ${r.mission||'unknown'} / ${r.scope||'unknown'} / ${r.style}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 for(const [key,rs] of groups){
  const outcomes={};for(const r of rs)outcomes[r.outcome]=(outcomes[r.outcome]||0)+1;
  console.log(`${key}: ${rs.length} runs`,JSON.stringify(outcomes));
  console.log('wave | cleared samples | heart | biomass | towers | clear time');
  const waves=[...new Set(rs.flatMap(r=>r.curve.map(p=>p.w)))].sort((a,b)=>a-b);
  for(const w of waves){const pts=rs.flatMap(r=>r.curve.filter(p=>p.w===w));console.log([w,pts.length,...['heart','biomass','towers','t'].map(k=>med(pts.map(p=>p[k])))].join(' | '));}
  console.log('Curves include cleared waves only; inspect losses/timeouts separately. Legacy wins are not campaign wins.');
 }
}catch(e){console.error(e.message);process.exit(1);}
