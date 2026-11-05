// Engine adapter: pass the game's own Three.js instance and a loaded GLB root.
// Capacity and flow are inputs from the game, never baked into an animation clip.
export function fillHeight(fraction){
 const f=Math.max(0,Math.min(1,fraction));if(f===0||f===1)return f;
 let low=0,high=1;for(let i=0;i<28;i++){const t=(low+high)/2;if(3*t*t-2*t*t*t<f)low=t;else high=t;}return(low+high)/2;
}
export function createYushiController(T,root,{fill=.5,state='ready',glass=true}={}){
 if(!root.getObjectByName('YUSHI_BODY')?.geometry?.getAttribute('_yushi'))throw new Error('Yūshi045 capacity attribute _YUSHI is missing; preserve it when packing the GLB.');
 const uniforms={yushiFill:{value:fill},yushiHeight:{value:fillHeight(fill)},yushiTime:{value:0},yushiFlow:{value:0},yushiCyan:{value:new T.Color(0x6cddd2)},yushiDim:{value:new T.Color(0x0b292d)},yushiOlive:{value:new T.Color(0x71863c)},yushiDark:{value:new T.Color(0x071f22)}};
 const owned=new Set(),materialMap=new Map(),glassNodes=[];
 root.traverse(object=>{
  if(object.name==='YUSHI_GLASS'&&object.isMesh){glassNodes.push(object);object.visible=glass;return;}
  if(!object.isMesh||!object.geometry.getAttribute('_yushi'))return;
  object.material=[].concat(object.material).map(original=>{
   if(materialMap.has(original))return materialMap.get(original);
   const material=original.clone();owned.add(material);materialMap.set(original,material);
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='attribute vec3 _yushi; varying vec3 vYushi;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvYushi = _yushi;');
    shader.fragmentShader=`varying vec3 vYushi;
uniform float yushiFill,yushiHeight,yushiTime,yushiFlow;
uniform vec3 yushiCyan,yushiDim,yushiOlive,yushiDark;
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float yushiLit = 0.0;
if (vYushi.x > 0.5 && vYushi.x < 1.5) {
  yushiLit = step(vYushi.y, yushiFill) * step(0.00001, yushiFill);
  diffuseColor.rgb = mix(yushiDim,yushiCyan,yushiLit);
} else if (vYushi.x > 1.5) {
  float wave = sin(vYushi.z*7.0+yushiTime*1.2)*0.004*yushiFlow;
  float level = clamp(yushiHeight+wave,0.0,1.0);
  float liquid = 1.0-step(level,vYushi.y);
  float swirl = sin(vYushi.z*12.0+vYushi.y*25.0-yushiTime*0.65)*0.035*yushiFlow;
  diffuseColor.rgb = mix(yushiDark,yushiOlive*(1.0+swirl),liquid);
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float pulse = 1.0 + yushiFlow * 0.22 * sin(yushiTime*2.4-vYushi.y*12.0);
totalEmissiveRadiance += yushiCyan * yushiLit * 0.6 * pulse;`);
   };
   material.customProgramCacheKey=()=> 'yushi045_capacity_v1';return material;
  });
  if(object.material.length===1)object.material=object.material[0];
 });
 const valve=root.getObjectByName('DISPENSE_VALVE');let currentState='ready';
 const controller={
  setFill(value){if(!Number.isFinite(value))throw new Error('Yūshi045 fill must be finite');uniforms.yushiFill.value=T.MathUtils.clamp(value,0,1);uniforms.yushiHeight.value=fillHeight(uniforms.yushiFill.value);},
  setState(value){if(!['empty','filling','ready','dispensing'].includes(value))throw new Error('Unknown Yūshi045 state');currentState=value;uniforms.yushiFlow.value=['filling','dispensing'].includes(value)?1:0;if(valve&&!valve.userData.static_lookup_only&&!root.getObjectByName('VALVE_HANDLE')?.userData.static_lookup_only)valve.rotation.z=value==='dispensing'?Math.PI/2:0;},
  setGlass(value){glassNodes.forEach(node=>node.visible=Boolean(value));},
  update(time){uniforms.yushiTime.value=time;},
  get fill(){return uniforms.yushiFill.value;},get height(){return uniforms.yushiHeight.value;},get state(){return currentState;},
  dispose(){owned.forEach(material=>material.dispose());}
 };
 controller.setFill(fill);controller.setState(state);return controller;
}
