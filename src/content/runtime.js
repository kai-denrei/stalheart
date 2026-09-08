// Composition selects one immutable content snapshot before game/lab startup.
import shipped from './shipped.js';
import { baselinePreset, parsePreset, validatePreset, clone, deepFreeze, resolveSounds } from './preset.js';
export const SHIPPED = deepFreeze(parsePreset(JSON.stringify(shipped || baselinePreset())));
export let CONTENT = SHIPPED;
export let SENTRY_FX = CONTENT.weapons;
export let SOUNDS = deepFreeze(resolveSounds(CONTENT));
let selected = false;
export function selectContent(p) {
  if (selected) throw Error('Content already selected for this application lifetime');
  const next=deepFreeze(clone(validatePreset(p)));
  CONTENT=next; SENTRY_FX=next.weapons; SOUNDS=deepFreeze(resolveSounds(next)); selected=true;
  return CONTENT;
}
