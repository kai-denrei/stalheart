// Portable authoring contract. No renderer, browser, storage or executable data.
import { SENTRY_FX as WEAPONS } from './weapon-defaults.js';
import { SOUNDS } from './audio-defaults.js';
import { IMPACT_KNOBS, IMPACT_FAMILIES, IMPACT_RECIPES } from './impact-schema.js';
export const PRESET_BASE = 'stalheart-fx-2';
export const AUDIO_KNOBS = Object.freeze([
  { key:'gain', min:0, max:2, step:.01 },
  { key:'maxVoices', min:1, max:32, step:1 },
  { key:'minInterval', min:0, max:60, step:.01 },
  { key:'rateJitter', min:0, max:.5, step:.01 },
]);
export const clone = value => JSON.parse(JSON.stringify(value));
export function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error(`${path}: expected an object`);
}
function keys(value, allowed, path, required=allowed) {
  object(value,path);
  for (const k of Object.keys(value)) if (!allowed.includes(k)) throw Error(`${path}.${k}: unknown field`);
  for (const k of required) if (!Object.hasOwn(value,k)) throw Error(`${path}.${k}: missing field`);
}
function number(v,min,max,path,integer=false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max || (integer && !Number.isInteger(v)))
    throw Error(`${path}: expected ${integer?'integer':'number'} in ${min}..${max}`);
}
function effect(fx,path) {
  keys(fx,['recipe','size','colors','tune'],path);
  if (typeof fx.recipe==='string') {
    if (!Object.hasOwn(IMPACT_RECIPES,fx.recipe)) throw Error(`${path}.recipe: unknown recipe`);
  } else if (!Array.isArray(fx.recipe) || fx.recipe.some(x=>!IMPACT_FAMILIES.includes(x))
      || new Set(fx.recipe).size!==fx.recipe.length) throw Error(`${path}.recipe: invalid families`);
  number(fx.size,0,16,`${path}.size`);
  keys(fx.colors,IMPACT_FAMILIES,`${path}.colors`,[]);
  for (const [k,v] of Object.entries(fx.colors)) number(v,0,0xffffff,`${path}.colors.${k}`,true);
  keys(fx.tune,IMPACT_KNOBS.map(k=>k.key),`${path}.tune`,[]);
  for (const k of IMPACT_KNOBS) if (Object.hasOwn(fx.tune,k.key)) number(fx.tune[k.key],k.min,k.max,`${path}.tune.${k.key}`,k.step===1);
}
export function validatePreset(p) {
  keys(p,['schema','application','base','id','weapons','audio'],'preset');
  if (p.schema!==1 || p.application!=='stalheart' || p.base!==PRESET_BASE) throw Error('Unsupported preset schema or base');
  if (typeof p.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id)) throw Error('Preset id must be a short lowercase slug');
  keys(p.weapons,Object.keys(WEAPONS),'weapons');
  for (const [key,w] of Object.entries(p.weapons)) {
    const path=`weapons.${key}`,base=WEAPONS[key].shot;
    keys(w,['shot','muzzle','impact'],path);
    keys(w.shot,['kind','projPx','trail','projSpeed','plasma','beamColor'],`${path}.shot`,Object.keys(base));
    // Flight speed and weapon behavior are rules, not artistic tuning.
    for (const field of ['kind','projSpeed','plasma']) if (w.shot[field]!==base[field]) throw Error(`${path}.shot.${field}: gameplay field is locked`);
    number(w.shot.projPx,0,64,`${path}.shot.projPx`);
    number(w.shot.trail,0,64,`${path}.shot.trail`,true);
    if (Object.hasOwn(w.shot,'beamColor')) number(w.shot.beamColor,0,0xffffff,`${path}.shot.beamColor`,true);
    effect(w.muzzle,`${path}.muzzle`);effect(w.impact,`${path}.impact`);
  }
  keys(p.audio,Object.keys(SOUNDS),'audio');
  for (const [key,s] of Object.entries(p.audio)) {
    keys(s,AUDIO_KNOBS.map(k=>k.key),`audio.${key}`);
    for (const k of AUDIO_KNOBS) number(s[k.key],k.min,k.max,`audio.${key}.${k.key}`,k.step===1);
  }
  return p;
}
export function baselinePreset(id='baseline') {
  const audio=Object.fromEntries(Object.entries(SOUNDS).map(([key,s])=>[key,Object.fromEntries(AUDIO_KNOBS.map(k=>[k.key,s[k.key]]))]));
  return validatePreset({schema:1,application:'stalheart',base:PRESET_BASE,id,weapons:clone(WEAPONS),audio});
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v==='object') return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
  return v;
}
export const serializePreset = p => JSON.stringify(canonical(validatePreset(p)),null,2)+'\n';
export function parsePreset(text) {
  if (typeof text!=='string' || text.length>250000) throw Error('Preset exceeds 250 KB');
  return validatePreset(JSON.parse(text));
}
export function resolveSounds(p) {
  validatePreset(p);
  return Object.fromEntries(Object.entries(SOUNDS).map(([key,s])=>[key,{...s,...p.audio[key]}]));
}
