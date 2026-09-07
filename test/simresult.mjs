import assert from 'node:assert/strict';
import { normaliseResult, acceptsResult } from '../src/simresult.js';
const legacy={style:'style1',seed:7,outcome:'win',wave:1,round:1,credit:170,simT:30,heart:10,score:12,curve:[{w:1,t:30,heart:10,credit:170,towers:2}]};
const r=normaliseResult(legacy);assert.equal(r.biomass,170);assert.equal(r.curve[0].biomass,170);assert.equal(r.outcome,'legacy-win');
assert.throws(()=>normaliseResult({...legacy,credit:undefined}));assert.throws(()=>normaliseResult({...legacy,schema:99}));
const modern={...r,schema:2,outcome:'sector-clear',roster:2,scope:'campaign',runId:'one'};
const source={};const event={origin:'https://game.test',source,data:{simresult:modern}},config={origin:event.origin,source,runId:'one'};
assert(acceptsResult(event,config));assert(!acceptsResult({...event,source:{}},config));assert(!acceptsResult({...event,origin:'https://other.test'},config));assert(!acceptsResult(event,{...config,runId:'stale'}));
console.log('Simulation schema migration and sender/run validation pass.');
