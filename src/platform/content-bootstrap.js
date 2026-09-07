import { CONTENT, selectContent } from '../content/runtime.js';
import { createPresetRepository } from './preset-repository.js';
import { record } from '../diagnostics.js';
export function bootstrapContent(search=location.search) {
  const preview = new URLSearchParams(search).get('preset') === 'draft';
  let chosen=CONTENT;
  if (preview) {
    // An explicit preview must not silently show shipped content on failure.
    chosen=createPresetRepository().read();
    if (!chosen) throw Error('No saved FX draft. Export or save one from a lab first.');
  }
  const content=selectContent(chosen);
  record('content.selected',{id:content.id,base:content.base,preview});
  return content;
}
