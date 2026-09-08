import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { baselinePreset, clone } from '../src/content/preset.js';
import { mergeSubject, subjectChanges, changeSummary } from '../src/content/authoring.js';
import { createAuthoringService } from '../scripts/authoring-service.mjs';
import { encodeShipped, readShipped, decodeShipped } from '../scripts/preset-store.mjs';

const subject = { kind:'sentry', key:'quiver' }, base = baselinePreset(), candidate = clone(base);
candidate.missiles.quiver.length = .5; candidate.audio.sentry_quiver.gain = .72;
candidate.weapons.lancer.impact.size = 3;
const current = clone(base); current.missiles.quiver.maxRange = 45;
const merged = mergeSubject(base, candidate, current, subject);
assert.equal(merged.missiles.quiver.length,.5); assert.equal(merged.missiles.quiver.maxRange,45);
assert.equal(merged.weapons.lancer.impact.size,base.weapons.lancer.impact.size);
assert.equal(subjectChanges(base,candidate,subject).length,2);
assert(changeSummary(base,candidate,subject).length < 250);
current.missiles.quiver.length = .7;
assert.throws(()=>mergeSubject(base,candidate,current,subject),/changed elsewhere/);
assert.throws(()=>mergeSubject(base,candidate,base,{kind:'sentry',key:'__proto__'}));
assert.throws(()=>decodeShipped('export default process.exit();'));

const root = await mkdtemp(join(tmpdir(),'stalheart-authoring-test-'));
await mkdir(join(root,'src/content'),{recursive:true});
const source = '// Generated baseline\nexport default null;\n';
await writeFile(join(root,'src/content/shipped.js'),source);
let validations = 0, failValidation = false;
const service = createAuthoringService(root,{validate:async()=>{validations++; if(failValidation) throw Error('test validation failure');}});
const server = createServer((req,res)=>void service(req,res,req.url.slice(1)));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin = `http://127.0.0.1:${server.address().port}`;
const state = async()=> (await fetch(origin+'/__authoring/state')).json();
const token = (await state()).token;
async function post(operation, data, extra={}) {
  const response = await fetch(origin+'/__authoring/'+operation,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Stalheart-Authoring':token,...extra},body:JSON.stringify(data)});
  return {status:response.status,...await response.json()};
}
try {
  assert.equal((await post('save',{subject,base,candidate},{Origin:'https://example.com'})).status,403);
  assert.equal((await post('save',{subject,base,candidate},{'X-Stalheart-Authoring':'wrong'})).status,403);
  assert.equal((await post('save',{subject:{kind:'sentry',key:'../escape'},base,candidate})).status,409);
  const invalid=clone(candidate); invalid.missiles.quiver.minRange=99;
  assert.equal((await post('review',{subject,base,candidate:invalid})).status,409);
  assert.equal((await readShipped(root)).source,source);
  const review=await post('review',{subject,base,candidate}); assert.equal(review.status,200);
  assert.equal(review.changes.length,2);
  assert.equal((await post('load',{subject})).preset.missiles.quiver.length,.5);
  assert.equal((await readShipped(root)).source,source,'Review never promotes');
  const applied=await post('apply',{id:review.id}); assert.equal(applied.status,200);
  assert.equal(applied.preset.missiles.quiver.length,.5);
  assert.equal(applied.preset.weapons.lancer.impact.size,base.weapons.lancer.impact.size);
  assert.equal(validations,1);
  assert.equal((await post('apply',{id:review.id})).status,409,'Consumed review cannot apply twice');
  const undoReview=await post('review-undo',{}); assert.equal(undoReview.changes.length,2);
  const undone=await post('undo',{id:undoReview.id,revision:undoReview.state.revision}); assert.equal(undone.status,200);
  assert.equal((await readShipped(root)).source,source,'Undo restores exact null baseline source');

  const stale=await post('review',{subject,base,candidate});
  const external=clone(base); external.audio.tank_engine.gain=.33;
  await writeFile(join(root,'src/content/shipped.js'),encodeShipped(external));
  assert.equal((await post('apply',{id:stale.id})).status,409);
  const fresh=await post('review',{subject,base,candidate});
  assert.equal((await post('apply',{id:fresh.id})).preset.audio.tank_engine.gain,.33);
  const before=await readShipped(root), changed=clone(before.preset); changed.missiles.quiver.duration=2;
  const rejected=await post('review',{subject,base:before.preset,candidate:changed});
  failValidation=true;
  const failure=await post('apply',{id:rejected.id});assert.equal(failure.status,409);assert.match(failure.error,/previous defaults restored/);
  assert.equal((await readShipped(root)).source,before.source);
  failValidation=false;
  const conflict=clone(base);conflict.missiles.quiver.length=.8;
  assert.equal((await post('review',{subject,base,candidate:conflict})).status,409);
  // Saved draft hashes expose interrupted/mixed writes instead of accepting them.
  await writeFile(join(root,review.path),'{}');
  assert.equal((await post('load',{subject})).status,409);
  assert((await readFile(join(root,'src/content/shipped.js'),'utf8')).includes('export default'));
  console.log('Authoring: scoped three-way merges, local security, persisted drafts, stale review rejection, apply/undo and validation rollback pass.');
} finally { await new Promise(r=>server.close(r)); await rm(root,{recursive:true,force:true}); }
