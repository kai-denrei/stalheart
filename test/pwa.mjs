import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const events={},deleted=[],stores=new Map();
for(const key of ['stalberg-old','unrelated-app','stalheart:/other/:old','stalheart:/game/:old'])stores.set(key,new Map());
const caches={keys:async()=>[...stores.keys()],delete:async k=>{deleted.push(k);stores.delete(k);},open:async k=>{
 if(!stores.has(k))stores.set(k,new Map());const m=stores.get(k);return {match:async r=>m.get(r.url||r)?.clone(),put:async(r,v)=>m.set(r.url||r,v)};
}};
const self={registration:{scope:'https://host.test/game/'},location:{origin:'https://host.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{throw Error('unexpected update');}};
vm.runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,caches,URL,Response,fetch:async()=>new Response('fresh')});
let wait;events.activate({waitUntil:p=>wait=p});await wait;assert.deepEqual(deleted,['stalheart:/game/:old']);
for(const url of ['https://host.test/other/a','https://another.test/game/a']){
 let intercepted=false;events.fetch({request:{url,method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
}
let response,pending;events.fetch({request:{url:'https://host.test/game/a.js?v=00000000',method:'GET'},respondWith:p=>response=p,waitUntil:p=>pending=p});assert.equal(await (await response).text(),'fresh');await pending;
console.log('Service worker isolates cache ownership and scope; caches current responses.');
