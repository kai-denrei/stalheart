// Ported from Jelly-Baby src/cutis/swarm/config.ts (the owner's own project, commit 0a23df8, brought up to 3a985e1 for the Pearl set; GPL-3.0, see ./LICENSE), types stripped.
// Changes from the kit: loadConfig/saveConfig (localStorage) are dropped; KIT_R0 names the radius the kit's absolute lengths were tuned at;
// sanitizeConfig takes optional per-key limits so a game-sized r0 (1.5 m, 6 m) is not clamped to the lab's 0.05..1 m.
// 3a985e1 (the hard-core and Pearl lineages, owner 2026-10-13): the Core keys (membraneOpacity, coreShape, coreSize, pearlVariant, coreTint, and the
// prototype contactDamage and health, ported as data: the game fights on its own ENEMY_SPEC), CORE_SHAPES and coreContact (the kit's tiers.ts; the
// tier table itself is Stalheart's copy, src/content/pearl-enemies.js). A config without the Core keys (the boss lab's, the creature probe's) is a soft body.
export const KIT_R0=0.2;
// ROUND TWO (owner, 2026-10-13: "fps wise we maybe cannot afford them as is"): the swarm geometry's culling and levels (./geometry.js). `high` and `low`
// a body's radius in device pixels for the high hull and above the third, lowest one; `highCap` the most high-hull bodies a swarm draws in a frame;
// `hysteresis` the share past a threshold before a body changes level; `horizonRadii` how tall a body counts (in radii) when it sinks below the horizon.
export const CUTIS_LOD={high:70,low:12,highCap:24,hysteresis:.12,horizonRadii:3};
export const DEFAULT_CONFIG={"cycleDuration":4,"aggression":2,"reach":15,"capAngle":10,"seekSweep":0.85,"seekCount":3,"seekRate":1,"transferAcceleration":1,"neckThin":0.5,"delaySpread":0.25,"cubenessPeak":0.9,"wobble":0.5,"r0":0.2,"noiseAmp":0.2,"breathRate":1.5,"cubenessRest":0.25,"pulseSpeed":2,"veinWidth":0.1,"skinTint":12165524,"veinTint":3679278,"pulseTint":15497546,"separation":2,"alignment":0.35,"cohesion":0.15,membraneOpacity:1,coreShape:0,coreSize:.28,pearlVariant:0,coreTint:0xff242c,contactDamage:0,health:60};
export const CUTIS_CONTROLS=[
  {key:'cycleDuration',label:'Cycle duration',group:'Hunt',min:.5,max:10,step:.05,unit:'s'},
  {key:'aggression',label:'Hunting urgency',group:'Hunt',min:0,max:4,step:.05,unit:'×'},
  {key:'reach',label:'Reach distance',group:'Hunt',min:1.5,max:20,step:.1,unit:'× radius'},
  {key:'capAngle',label:'Reaching cap',group:'Hunt',min:10,max:85,step:1,unit:'°'},
  {key:'seekSweep',optional:true,label:'Seeking sweep',group:'Hunt',min:0,max:4,step:.05,unit:'× radius'},
  {key:'seekCount',optional:true,label:'Seeking appendages',group:'Hunt',min:1,max:3,step:1,unit:'appendages'},
  {key:'seekRate',optional:true,label:'Seeking frequency',group:'Hunt',min:.2,max:5,step:.1,unit:'cycles'},
  {key:'transferAcceleration',optional:true,label:'Transfer acceleration',group:'Transfer',min:1,max:6,step:.1,unit:'power'},
  {key:'neckThin',label:'Neck thickness',group:'Transfer',min:.05,max:1,step:.01,unit:'×'},
  {key:'delaySpread',label:'Rear-body delay',group:'Transfer',min:0,max:.98,step:.01,unit:'×'},
  {key:'cubenessPeak',label:'Fold structure',group:'Transfer',min:0,max:1,step:.01,unit:'×'},
  {key:'wobble',label:'Settling recoil',group:'Transfer',min:0,max:4,step:.05,unit:'×'},
  {key:'r0',label:'Body radius',group:'Body',min:.05,max:1,step:.01,unit:'m'},
  {key:'noiseAmp',label:'Asymmetry',group:'Body',min:0,max:.8,step:.01,unit:'×'},
  {key:'breathRate',label:'Breathing',group:'Body',min:.1,max:6,step:.05,unit:'Hz'},
  {key:'cubenessRest',label:'Latent structure',group:'Body',min:0,max:.6,step:.01,unit:'×'},
  {key:'pulseSpeed',label:'Vein pulse speed',group:'Surface',min:.5,max:30,step:.1,unit:'×'},
  {key:'veinWidth',label:'Vein width',group:'Surface',min:.005,max:.24,step:.005,unit:'×'},
  {key:'skinTint',label:'Membrane tint',group:'Surface',min:0,max:16777215,step:1,unit:'hex',kind:'color'},
  {key:'veinTint',label:'Vein tint',group:'Surface',min:0,max:16777215,step:1,unit:'hex',kind:'color'},
  {key:'pulseTint',label:'Pulse tint',group:'Surface',min:0,max:16777215,step:1,unit:'hex',kind:'color'},
  {key:'membraneOpacity',optional:true,label:'Membrane opacity',group:'Core',min:.08,max:1,step:.01,unit:'×'},
  {key:'coreShape',optional:true,label:'Core shape',group:'Core',min:0,max:3,step:1,unit:'shape'},
  {key:'pearlVariant',optional:true,label:'All-pearl lineage',group:'Core',min:0,max:1,step:1,unit:'on'},
  {key:'coreSize',optional:true,label:'Core radius',group:'Core',min:.1,max:.75,step:.01,unit:'× body'},
  {key:'coreTint',optional:true,label:'Core color',group:'Core',min:0,max:16777215,step:1,unit:'hex',kind:'color'},
  {key:'contactDamage',optional:true,label:'Hard contact damage',group:'Core',min:0,max:100,step:1,unit:'HP/s'},
  {key:'health',optional:true,label:'Health',group:'Core',min:1,max:1000,step:1,unit:'HP'},
  {key:'separation',label:'Keep distance',group:'Swarm',min:0,max:6,step:.05,unit:'×'},
  {key:'alignment',label:'Heading alignment',group:'Swarm',min:0,max:2,step:.05,unit:'×'},
  {key:'cohesion',label:'Weak cohesion',group:'Swarm',min:0,max:.5,step:.01,unit:'×'},
];
export const CUTIS_PRESETS={patient:{cycleDuration:2.5,aggression:.35,reach:4.2,delaySpread:.78,neckThin:.25},feral:{cycleDuration:.85,aggression:1.8,reach:4.7,delaySpread:.82,neckThin:.2},drifting:{cycleDuration:2.1,aggression:0,reach:2,delaySpread:.4,neckThin:.5}};
/** `limits` maps a key to [min, max] and replaces that control's own range (the game's r0 is far above the lab's 1 m). */
export function sanitizeConfig(value,limits={}){
  const result={...DEFAULT_CONFIG};
  if(value&&typeof value==='object')for(const c of CUTIS_CONTROLS){const n=value[c.key];if(typeof n==='number'&&Number.isFinite(n)){const [lo,hi]=limits[c.key]??[c.min,c.max];result[c.key]=Math.min(hi,Math.max(lo,n));}}
  result.seekCount=Math.round(result.seekCount);result.coreShape=Math.round(result.coreShape);result.pearlVariant=Math.round(result.pearlVariant);return result;
}
// ROUND FOUR of the Pearl set (owner, 2026-10-13: "the moving animations are too jerky, they should feel slower and more organic"): `shares`, the
// seconds of each stage as shares of the cycle (coil, extend, anchor, transfer, settle; summing to 1), replaces the kit's split (the coil a tenth, at
// least .12 s, the rest 45:7:23:15) for a swarm whose config carries `timing` (the Pearl set's gait: a longer transfer, so the body moves for more of
// its cycle and slower); without it the kit's timing is unchanged.
export function cycleTiming(duration,shares=null){
  if(shares){const d=Math.max(.2,duration);return {coil:d*shares.coil,extend:d*shares.extend,anchor:d*shares.anchor,transfer:d*shares.transfer,settle:d*shares.settle};}
  const coil=Math.max(.12,duration*.1),remaining=Math.max(.09,duration-coil);return {coil,extend:remaining*.5,anchor:remaining*7/90,transfer:remaining*23/90,settle:remaining/6};
}
// round four (the Pearl set's gait, ./swarm.js forkAngle): the cap axes' angles off the heading. A stalk is drawn from its cap's rings, so a two-stalk
// swarm whose fork is not the kit's 1.2 rad has its two caps at its fork (and no middle one: caps nearer than twice their .59 rad boundary would overlap)
export const capAngles=config=>{const f=config?.forkAngle??1.2;return Math.round(config?.seekCount??3)===2&&f!==1.2?[-f,f]:[-1.2,0,1.2];};
export const PHASES=[{name:'COIL',end:.1},{name:'EXTEND',end:.55},{name:'ANCHOR',end:.62},{name:'TRANSFER',end:.85},{name:'SETTLE',end:1}];
export function phaseState(phase){return PHASES.find(p=>phase<p.end)?.name??'SETTLE';}

export const CUTIS_PALETTES={
  original:{name:'Original membrane',skinTint:0xb9a194,veinTint:0x38242e,pulseTint:0xec794a},
  green:{name:'Green · moss',skinTint:0x809e63,veinTint:0x182e24,pulseTint:0xd0ed7c},
  yellow:{name:'Yellow · amber',skinTint:0xd6b456,veinTint:0x59371d,pulseTint:0xffeaa0},
  blue:{name:'Blue · glacial',skinTint:0x739caf,veinTint:0x162845,pulseTint:0xa5f5ff},
  purple:{name:'Purple · dusk',skinTint:0x9b78b5,veinTint:0x352048,pulseTint:0xf3abe9},
  white:{name:'White · porcelain',skinTint:0xe6e8df,veinTint:0x747b88,pulseTint:0xcaf6ff},
  black:{name:'Black · white veins',skinTint:0x090c12,veinTint:0xffffff,pulseTint:0xddeeff},
};
export function applyPalette(config,key){const {skinTint,veinTint,pulseTint}=CUTIS_PALETTES[key];Object.assign(config,{skinTint,veinTint,pulseTint});}
export function selectedPalette(config){return Object.entries(CUTIS_PALETTES).find(([,p])=>p.skinTint===config.skinTint&&p.veinTint===config.veinTint&&p.pulseTint===config.pulseTint)?.[0]??'custom';}
// round four: `ease` (the config's transferEase, 0..1) blends the kit's accelerating transfer (t^acceleration: it ends at its fastest, then the settle
// stops it dead) toward smootherstep (it starts and ends at rest: no velocity step at either end of the hop); the shader's uEase, term for term
export function transferProgress(t,acceleration,ease=0){const x=Math.max(0,Math.min(1,t)),p=Math.pow(x,acceleration);return ease>0?p+(x*x*x*(x*(x*6-15)+10)-p)*ease:p;}
/** Round four: a body point's (or the core's) share of the transfer `u` (0..1), eased the same way (smoothstep), so a point that arrives early does not stop dead. */
export function easeShare(u,ease=0){const x=Math.max(0,Math.min(1,u));return ease>0?x+(x*x*(3-2*x)-x)*ease:x;}

// The kit's tiers.ts: the core shapes, and what a body's core means to its host (soft bodies are rammable, solids are not; both on radar, solids larger
// with a proximity warning). `collisionRadius` is the core's radius at scale 1 (x the instance's scale), 0 for a soft body.
export const CORE_SHAPES=['Soft interior','Dodecahedron','Inverted pyramids','Pearl'];
export function coreContact(config){const hard=(config.coreShape??0)>=1;return {rammable:!hard,radarVisible:true,radarBlipSize:hard?4:2.5,proximityWarning:hard,contactDamagePerSecond:hard?config.contactDamage??0:0,health:config.health,coreShape:CORE_SHAPES[Math.round(config.coreShape??0)],collisionRadius:hard?config.r0*(config.coreSize??.28):0};}
