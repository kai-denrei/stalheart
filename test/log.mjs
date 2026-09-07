import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendEntry, readEntries } from '../scripts/log.mjs';
const dir=mkdtempSync(join(tmpdir(),'stalheart-log-'));
const e={schema:1,id:'first',date:'2026-09-07T00:00:00Z',type:'decision',status:'accepted',title:'Choice',context:'A concrete problem',outcome:'An authorized solution',alternatives:[],evidence:['npm test'],supersedes:[]};
try{
 appendEntry(e,dir);assert.throws(()=>appendEntry({...e,title:'overwrite'},dir));
 assert.throws(()=>appendEntry({...e,id:'bad',supersedes:['missing']},dir));
 appendEntry({...e,id:'second',supersedes:['first']},dir);
 assert.equal(readEntries(dir).length,2);assert.equal(readEntries(dir)[0].title,'Choice');
 assert.throws(()=>appendEntry({...e,id:'../escape'},dir));
}finally{rmSync(dir,{recursive:true});}
console.log('Immutable log entries, supersession and validation pass.');
