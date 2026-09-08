// Shared lab boundary: isolated working copy -> validated artifact -> explicit preview.
import { clone, serializePreset, parsePreset } from '../content/preset.js';
import { createPresetRepository } from '../platform/preset-repository.js';
import { downloadJSON } from '../diagnostics.js';
import { mountLocalAuthoring } from './local-authoring.js';
export function mountPresetPanel(root,{read,write,preview='game',subject}) {
  const box=document.createElement('section');box.className='preset-panel';
  box.innerHTML='<strong>FX package</strong><label>Name <input data-preset-id maxlength="80"></label><button data-preset-export>Export JSON</button><label class="preset-import">Import JSON<input data-preset-import type="file" accept=".json,application/json"></label><button data-preset-save>Save draft</button><button data-preset-load>Load draft</button><button data-preset-preview>Preview in game</button><output aria-live="polite"></output>';
  root.append(box);
  const copy=document.createElement('button');copy.type='button';copy.dataset.presetCopy='';copy.textContent='Copy for Codex';
  copy.title='Copy this complete preset, then paste it into your Codex conversation.';
  box.querySelector('[data-preset-export]').before(copy);
  const manual=document.createElement('textarea');manual.hidden=true;manual.readOnly=true;
  manual.dataset.presetCopyText='';manual.setAttribute('aria-label','Preset to copy into Codex');
  manual.style.cssText='flex-basis:100%;width:100%;height:90px';box.append(manual);
  if(preview==='sniper') box.querySelector('[data-preset-preview]').textContent='Preview in Sniper lab';
  if(preview==='sentry') box.querySelector('[data-preset-preview]').textContent='Preview in Sentry lab';
  const name=box.querySelector('[data-preset-id]'),status=box.querySelector('output');
  name.value=read().id==='baseline'?'fx-draft':read().id;
  const repository=createPresetRepository();
  const take=()=>{const p=clone(read());p.id=name.value;return parsePreset(serializePreset(p));};
  const apply=p=>{write(clone(p));name.value=p.id;};
  const local=subject ? mountLocalAuthoring(box,{read:take,write:apply,subject,report:text=>{status.textContent=text;}}) : null;
  if (local) { copy.textContent='Copy changes for Codex'; copy.title='Copy a short review of changes for the selected subject.'; }
  const act=fn=>{try{fn();}catch(e){status.textContent=e.message;}};
  copy.onclick=async()=>{
    manual.hidden=true;
    let text;
    try{text=local ? local.summary() : serializePreset(take());}catch(e){status.textContent=e.message;return;}
    try{
      await navigator.clipboard.writeText(text);
      status.textContent=local ? 'Copied changed values. Paste them into your Codex conversation.' : 'Copied current preset. Paste it into your Codex conversation.';
    }catch{
      manual.value=text;manual.hidden=false;manual.focus();manual.select();
      status.textContent='Clipboard unavailable. Copy the selected text, then paste it into Codex.';
    }
  };
  box.querySelector('[data-preset-export]').onclick=()=>act(()=>{const p=take();downloadJSON(p,`${p.id}.stalheart-fx.json`);status.textContent='Exported complete visual and sound package.';});
  box.querySelector('[data-preset-save]').onclick=async()=>{
    let browserSaved=false,browserError;
    try{
      const p=take();
      try{repository.write(p);browserSaved=true;}catch(e){browserError=e;}
      const saved=await local?.save(p);
      if(!saved && browserError)throw browserError;
      status.textContent=saved ? 'Working copy saved in the project; available to Codex. Defaults unchanged.' : 'Draft saved in this browser. Defaults unchanged.';
    }catch(e){status.textContent=`Save failed: ${e.message}${browserSaved ? '. Browser draft retained.' : ''}`;}
  };
  box.querySelector('[data-preset-load]').onclick=async()=>{
    try{const saved=await local?.load();const p=saved?.preset || repository.read();if(!p)throw Error('No saved draft.');apply(p);status.textContent=saved ? 'Project working copy loaded.' : 'Browser draft loaded into this lab.';}
    catch(e){status.textContent=e.message;}
  };
  box.querySelector('[data-preset-preview]').onclick=()=>act(()=>{
    repository.write(take());
    const url=new URL(['sentry','sniper'].includes(preview)?'./labs.html':'./index.html',location.href);url.search=location.search;url.searchParams.set('preset','draft');if(preview==='sniper'&&subject)url.searchParams.set('weapon',subject().key);url.hash=['sentry','sniper'].includes(preview)?preview:'td';
    location.assign(url);
  });
  box.querySelector('[data-preset-import]').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>250000)throw Error('Preset exceeds 250 KB');const p=parsePreset(await file.text());apply(p);status.textContent='Imported into this lab. Save draft or export when ready.';}
    catch(err){status.textContent=err.message;}finally{e.target.value='';}
  };
  // Daily authoring actions stay visible; whole-package files are backup tools.
  const backup=document.createElement('details');backup.className='preset-backup';
  const heading=document.createElement('summary');heading.textContent='Backup / transfer';backup.append(heading);
  backup.append(name.closest('label'),box.querySelector('[data-preset-export]'),box.querySelector('.preset-import'));
  status.before(backup);
  box.querySelector('[data-preset-save]').textContent='Save working copy';
  box.querySelector('[data-preset-load]').textContent='Load working copy';
  return {dispose(){local?.dispose();box.remove();}};
}
