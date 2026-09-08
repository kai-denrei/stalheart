import { BREACH_DEFAULTS, BREACH_KNOBS } from './breach-defaults.js';
import { RETIRED_HOWITZER } from './retired-howitzer.js';
import { MISSILE_DEFAULTS } from './missile-defaults.js';
// Portable authoring contract. No renderer, browser, storage or executable data.
import { SENTRY_FX as WEAPONS } from './weapon-defaults.js';
import { SOUNDS } from './audio-defaults.js';
import { IMPACT_KNOBS, IMPACT_FAMILIES, IMPACT_RECIPES } from './impact-schema.js';
export const PRESET_BASE = 'stalheart-fx-7';
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
function validatePackage(p,baseId,weaponDefs,audioDefs) {
  keys(p,['schema','application','base','id','weapons','audio','missiles',...(baseId===PRESET_BASE?['breach']:[])],'preset');
  if(baseId===PRESET_BASE){keys(p.breach,Object.keys(BREACH_DEFAULTS),'breach');for(const [key,[min,max]] of Object.entries(BREACH_KNOBS))number(p.breach[key],min,max,'breach.'+key,['fissureArms','shrapnelCount'].includes(key));if(!['tronColors','battlezone','textured'].includes(p.breach.look))throw Error('breach.look: unknown palette');}
  if (p.schema!==1 || p.application!=='stalheart' || p.base!==baseId) throw Error('Unsupported preset schema or base');
  if (typeof p.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id)) throw Error('Preset id must be a short lowercase slug');
  keys(p.weapons,Object.keys(weaponDefs),'weapons');
  for (const [key,w] of Object.entries(p.weapons)) {
    const path=`weapons.${key}`,base=weaponDefs[key].shot;
    keys(w,['shot','muzzle','impact'],path);
    keys(w.shot,['kind','projPx','trail','projSpeed','plasma','beamColor'],`${path}.shot`,Object.keys(base));
    // Flight speed and weapon behavior are rules, not artistic tuning.
    for (const field of ['kind','projSpeed','plasma']) if (w.shot[field]!==base[field]) throw Error(`${path}.shot.${field}: gameplay field is locked`);
    number(w.shot.projPx,0,64,`${path}.shot.projPx`);
    number(w.shot.trail,0,64,`${path}.shot.trail`,true);
    if (Object.hasOwn(w.shot,'beamColor')) number(w.shot.beamColor,0,0xffffff,`${path}.shot.beamColor`,true);
    effect(w.muzzle,`${path}.muzzle`);effect(w.impact,`${path}.impact`);
  }
  keys(p.audio,Object.keys(audioDefs),'audio');
  for (const [key,s] of Object.entries(p.audio)) {
    keys(s,AUDIO_KNOBS.map(k=>k.key),`audio.${key}`);
    for (const k of AUDIO_KNOBS) number(s[k.key],k.min,k.max,`audio.${key}.${k.key}`,k.step===1);
  }
  keys(p.missiles,Object.keys(MISSILE_DEFAULTS),'missiles');
  for (const [key,m] of Object.entries(p.missiles)) {
    keys(m,['mesh','profile','duration','length','exhaust','minRange','maxRange','lockGate','lockTime','lockBreak','aimTolerance'],`missiles.${key}`);
    number(m.lockGate,.5,30,`missiles.${key}.lockGate`);
    number(m.lockTime,.1,6,`missiles.${key}.lockTime`);
    number(m.lockBreak,1,90,`missiles.${key}.lockBreak`);
    number(m.aimTolerance,.2,15,`missiles.${key}.aimTolerance`);
    if(m.lockBreak<m.lockGate)throw Error(`missiles.${key}: lock break is below lock gate`);
    number(m.minRange,0,100,`missiles.${key}.minRange`);
    number(m.maxRange,0,100,`missiles.${key}.maxRange`);
    if(m.minRange>m.maxRange)throw Error(`missiles.${key}: minimum range exceeds maximum range`);
    if(m.mesh!=='dart' || !['swift','hook','heavy'].includes(m.profile)) throw Error(`missiles.${key}: unknown asset/profile`);
    number(m.duration,.5,6,`missiles.${key}.duration`);
    number(m.length,.1,2,`missiles.${key}.length`);
    if(typeof m.exhaust!=='boolean') throw Error(`missiles.${key}.exhaust: expected boolean`);
  }
  return p;
}
export const validatePreset=p=>validatePackage(p,PRESET_BASE,WEAPONS,SOUNDS);
export function baselinePreset(id='baseline') {
  const audio=Object.fromEntries(Object.entries(SOUNDS).map(([key,s])=>[key,Object.fromEntries(AUDIO_KNOBS.map(k=>[k.key,s[k.key]]))]));
  return validatePreset({schema:1,application:'stalheart',base:PRESET_BASE,id,weapons:clone(WEAPONS),audio,missiles:clone(MISSILE_DEFAULTS),breach:clone(BREACH_DEFAULTS)});
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v==='object') return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
  return v;
}
export const serializePreset = p => JSON.stringify(canonical(validatePreset(p)),null,2)+'\n';
export function parsePreset(text) {
  if (typeof text!=='string' || text.length>250000) throw Error('Preset exceeds 250 KB');
  let p=JSON.parse(text);
  const legacy=p && /^stalheart-fx-[2-5]$/.test(p.base);
  // Explicit additive migration: old visual/audio edits survive; the new lab
  // presentation fields start at the accepted baseline. Never mutate the input.
  if(p && p.base==='stalheart-fx-2' && !Object.hasOwn(p,'missiles')) {
    p={...p,base:'stalheart-fx-5',missiles:clone(MISSILE_DEFAULTS)};
  }
  if(p && ['stalheart-fx-3','stalheart-fx-4'].includes(p.base)) {
    keys(p.missiles,Object.keys(MISSILE_DEFAULTS),'missiles');
    const missiles=Object.fromEntries(Object.entries(p.missiles).map(([key,m])=>{
      keys(m,['mesh','profile','duration','length','exhaust',...(p.base==='stalheart-fx-4'?['minRange','maxRange']:[])],`missiles.${key}`);
      return [key,{...MISSILE_DEFAULTS[key],...m}];
    }));
    p={...p,base:'stalheart-fx-5',missiles};
  }
  if(legacy){
    const {needle,...oldWeapons}=WEAPONS,{sentry_needle,...oldSounds}=SOUNDS;
    validatePackage(p,'stalheart-fx-5',{...oldWeapons,howitzer:RETIRED_HOWITZER},{...oldSounds,sentry_howitzer:SOUNDS.tank_main});
    const {howitzer,...weapons}=p.weapons,{sentry_howitzer,...audio}=p.audio;
    p={...p,base:'stalheart-fx-6',weapons:{...weapons,needle:clone(needle)},audio:{...audio,sentry_needle:clone(baselinePreset().audio.sentry_needle)}};
  }
  if(p?.base==='stalheart-fx-6'){validatePackage(p,'stalheart-fx-6',WEAPONS,SOUNDS);p={...p,base:PRESET_BASE,breach:clone(BREACH_DEFAULTS)};}
  return validatePreset(p);
}
export function resolveSounds(p) {
  validatePreset(p);
  return Object.fromEntries(Object.entries(SOUNDS).map(([key,s])=>[key,{...s,...p.audio[key]}]));
}
