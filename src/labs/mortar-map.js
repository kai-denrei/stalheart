import * as THREE from '../../vendor/three.module.js';
// One overhead render target composited over the scope; no extra renderer/context.
export function createMortarMap(container,renderer,scene,onAim){
 const panel=document.createElement('div');panel.id='sniper-mortar-map';panel.style.cssText='position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:min(80vw,840px);height:min(68vh,540px);border:1px solid #a8babc;pointer-events:auto;display:none;touch-action:none;z-index:3';
 panel.innerHTML=`<div style="position:absolute;inset:0;pointer-events:none;color:#eee;font:11px/1.6 ui-monospace,monospace;letter-spacing:.08em;background:repeating-linear-gradient(0deg,transparent 0px,transparent 3px,#0002 4px)">
 <div style="position:absolute;top:12px;left:14px">MORTAR / OBSERVATION FEED<br>DRONE 01 · WHITE HOT<br><span data-feed></span></div>
 <div data-telemetry style="position:absolute;right:14px;top:12px;text-align:right;white-space:pre"></div>
 <div data-impact style="position:absolute;left:14px;bottom:36px;white-space:pre"></div>
 <div style="position:absolute;bottom:12px;left:14px">DRAG DESIGNATOR · FIRE TO LAUNCH · R RESET</div>
 <div data-status style="position:absolute;bottom:12px;right:14px"></div></div><svg width="100%" height="100%" style="position:absolute;pointer-events:none"></svg>`;container.appendChild(panel);
 const camera=new THREE.OrthographicCamera(-30,30,30,-30,.1,2000),target=new THREE.WebGLRenderTarget(640,480);
 const overlay=new THREE.Scene(),ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,2),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{feed:{value:target.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D feed;varying vec2 vUv;void main(){vec3 c=texture2D(feed,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));l=pow(max(l,0.0),.45);l=clamp((l-.5)*1.3+.5,0.0,1.0)*1.12;gl_FragColor=vec4(vec3(l),1.0);}',transparent:true,depthTest:false,depthWrite:false}));ortho.position.z=1;overlay.add(quad);
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();let enabled=false,aim=[0,0,20],marks=[],half=30,center=20,drag=false,targetPoints=[],telemetry={},lastHud=-Infinity;
 const abort=new AbortController();
 function pick(event){const r=panel.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),camera);if(ray.ray.intersectPlane(plane,hit))onAim([hit.x,0,hit.z]);event.stopPropagation();event.preventDefault();}
 panel.addEventListener('pointerdown',e=>{drag=true;panel.setPointerCapture(e.pointerId);pick(e);},{signal:abort.signal});panel.addEventListener('pointermove',e=>{if(drag)pick(e);},{signal:abort.signal});panel.addEventListener('pointerup',e=>{drag=false;e.stopPropagation();},{signal:abort.signal});
 const viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
 return {set(on,point,range,targets=[],values={}){telemetry=values;targetPoints=targets;enabled=on;panel.style.display=on?'':'none';aim=point;center=range*.48;half=range*.6;},
  mark(point,radius,shotAim=aim){marks.push({point:[...point],radius,aim:[...shotAim],at:telemetry.time||0});if(marks.length>8)marks.shift();},reset(){marks=[];lastHud=-Infinity;},
  render(){if(!enabled)return;const r=panel.getBoundingClientRect(),canvas=renderer.domElement.getBoundingClientRect(),aspect=r.width/r.height;
   camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.position.set(0,600,center);camera.up.set(0,0,-1);camera.lookAt(0,0,center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   const old=renderer.getRenderTarget(),clear=renderer.autoClear;renderer.getViewport(viewport);renderer.getScissor(scissor);const scissorOn=renderer.getScissorTest();
   renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.autoClear=true;renderer.render(scene,camera);
   renderer.setRenderTarget(old);renderer.autoClear=false;renderer.setViewport(r.left-canvas.left,canvas.bottom-r.bottom,r.width,r.height);renderer.render(overlay,ortho);
   renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorOn);renderer.autoClear=clear;
   const project=p=>{const v=new THREE.Vector3(...p).project(camera);return[(v.x+1)*r.width/2,(1-v.y)*r.height/2];},[x,y]=project(aim);
   const range=Math.hypot(aim[0],aim[2]),bearing=(Math.atan2(aim[0],aim[2])*180/Math.PI+360)%360;
   if((telemetry.time||0)-lastHud>.1){lastHud=telemetry.time||0;
    panel.querySelector('[data-feed]').textContent=`LIVE ${lastHud.toFixed(1).padStart(6,'0')} / ${targetPoints.length} CONTACTS`;
    panel.querySelector('[data-telemetry]').textContent=`SLANT ${Math.hypot(600,aim[0],aim[2]-center).toFixed(0)} M\nGROUND ${range.toFixed(1)} M\nAZ ${bearing.toFixed(1).padStart(5,'0')}°\nSPLASH ${(telemetry.splash||0).toFixed(1)} M\nWIND ${Number(telemetry.wind||0).toFixed(1)} M/S`;
    panel.querySelector('[data-status]').textContent=telemetry.cool>0?`RELOAD ${telemetry.cool.toFixed(1)} S`:`READY / ${telemetry.rounds||0} IN FLIGHT`;
    const last=marks.at(-1);panel.querySelector('[data-impact]').textContent=last?`IMPACT ${marks.length} / ${Math.hypot(last.point[0]-last.aim[0],last.point[2]-last.aim[2]).toFixed(1)} M ERROR\nX ${(last.point[0]-last.aim[0]).toFixed(1)} / Z ${(last.point[2]-last.aim[2]).toFixed(1)} M`:'NO IMPACT / OBSERVE & CORRECT';
   }
   const parts=[];
   for(let i=1;i<6;i++){const gx=i*r.width/6,gy=i*r.height/6;parts.push(`<path d="M ${gx} 0 V ${r.height} M 0 ${gy} H ${r.width}" stroke="white" opacity=".07"/>`);}
   const [ox,oy]=project([0,0,0]);parts.push(`<path d="M ${ox} ${oy} L ${x} ${y}" stroke="white" opacity=".3" stroke-dasharray="3 6"/>`);
   parts.push(...marks.map((m,i)=>{const [a,b]=project(m.point);return `<circle cx="${a}" cy="${b}" r="${m.radius/(half*2)*r.height}" fill="white" fill-opacity=".06" stroke="#d8e7e9" stroke-opacity="${.25+.65*(i+1)/marks.length}" stroke-dasharray="4 3"/><text x="${a+4}" y="${b-4}" fill="white" font-size="11">${i+1}</text>`;}));
   for(const [i,point] of targetPoints.entries()){const [tx,ty]=project(point);parts.push(`<rect x="${tx-5}" y="${ty-5}" width="10" height="10" fill="none" stroke="white"/><text x="${tx+9}" y="${ty-7}" fill="white" font-size="10">${String(i+1).padStart(2,'0')} / ${Math.hypot(point[0],point[2]).toFixed(0)}M</text>`);}
   const scaleM=10,scalePx=scaleM/(half*2)*r.height;
   parts.push(`<path d="M ${r.width-24-scalePx} ${r.height-50} v 5 h ${scalePx} v -5" stroke="white" fill="none"/><text x="${r.width-24}" y="${r.height-58}" fill="white" font-size="10" text-anchor="end">${scaleM} M</text>`);
   parts.push(`<circle cx="${x}" cy="${y}" r="${(telemetry.splash||0)/(half*2)*r.height}" stroke="white" stroke-opacity=".25" stroke-dasharray="2 5" fill="none"/>`);
   parts.push(`<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="white"/><path d="M ${x-17} ${y} h 34 M ${x} ${y-17} v 34" stroke="white"/>`);panel.querySelector('svg').innerHTML=parts.join('');
  },state:()=>({active:enabled,monochrome:true,range:Math.hypot(aim[0],aim[2]),contacts:targetPoints.length,aim:[...aim],impacts:marks.map(m=>({...m}))}),
  dispose(){abort.abort();panel.remove();target.dispose();quad.geometry.dispose();quad.material.dispose();},
 };
}
