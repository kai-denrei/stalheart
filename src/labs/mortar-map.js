import * as THREE from '../../vendor/three.module.js';
// One overhead render target composited over the scope; no extra renderer/context.
export function createMortarMap(container,renderer,scene,onAim){
 const panel=document.createElement('div');panel.id='sniper-mortar-map';panel.style.cssText='position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:min(64vw,620px);height:min(57vh,440px);border:1px solid #a8babc;pointer-events:auto;display:none;touch-action:none;z-index:3';
 panel.innerHTML='<div style="position:absolute;top:8px;left:10px;color:#d8e7e9;font:12px monospace;pointer-events:none">MORTAR · DRONE VIEW<br>Click or drag to aim · FIRE to launch</div><svg width="100%" height="100%" style="position:absolute;pointer-events:none"></svg>';container.appendChild(panel);
 const camera=new THREE.OrthographicCamera(-30,30,30,-30,.1,2000),target=new THREE.WebGLRenderTarget(640,480);
 const overlay=new THREE.Scene(),ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,2),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:target.texture,transparent:true,opacity:.82,depthTest:false,depthWrite:false}));ortho.position.z=1;overlay.add(quad);
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();let enabled=false,aim=[0,0,20],marks=[],half=30,center=20,drag=false,targetPoints=[];
 const abort=new AbortController();
 function pick(event){const r=panel.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),camera);if(ray.ray.intersectPlane(plane,hit))onAim([hit.x,0,hit.z]);event.stopPropagation();event.preventDefault();}
 panel.addEventListener('pointerdown',e=>{drag=true;panel.setPointerCapture(e.pointerId);pick(e);},{signal:abort.signal});panel.addEventListener('pointermove',e=>{if(drag)pick(e);},{signal:abort.signal});panel.addEventListener('pointerup',e=>{drag=false;e.stopPropagation();},{signal:abort.signal});
 const viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
 return {set(on,point,range,targets=[]){targetPoints=targets;enabled=on;panel.style.display=on?'':'none';aim=point;center=range*.48;half=range*.6;},
  mark(point,radius){marks.push({point:[...point],radius});if(marks.length>8)marks.shift();},reset(){marks=[];},
  render(){if(!enabled)return;const r=panel.getBoundingClientRect(),canvas=renderer.domElement.getBoundingClientRect(),aspect=r.width/r.height;
   camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.position.set(0,600,center);camera.up.set(0,0,-1);camera.lookAt(0,0,center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   const old=renderer.getRenderTarget(),clear=renderer.autoClear;renderer.getViewport(viewport);renderer.getScissor(scissor);const scissorOn=renderer.getScissorTest();
   renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.autoClear=true;renderer.render(scene,camera);
   renderer.setRenderTarget(old);renderer.autoClear=false;renderer.setViewport(r.left-canvas.left,canvas.bottom-r.bottom,r.width,r.height);renderer.render(overlay,ortho);
   renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorOn);renderer.autoClear=clear;
   const project=p=>{const v=new THREE.Vector3(...p).project(camera);return[(v.x+1)*r.width/2,(1-v.y)*r.height/2];},[x,y]=project(aim);
   const parts=marks.map((m,i)=>{const [a,b]=project(m.point);return `<circle cx="${a}" cy="${b}" r="${m.radius/(half*2)*r.height}" fill="white" fill-opacity=".06" stroke="#d8e7e9" stroke-opacity="${.25+.65*(i+1)/marks.length}" stroke-dasharray="4 3"/><text x="${a+4}" y="${b-4}" fill="white" font-size="11">${i+1}</text>`;});
   for(const point of targetPoints){const [tx,ty]=project(point);parts.push(`<rect x="${tx-4}" y="${ty-4}" width="8" height="8" fill="none" stroke="white"/>`);}
   parts.push(`<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="white"/><path d="M ${x-17} ${y} h 34 M ${x} ${y-17} v 34" stroke="white"/>`);panel.querySelector('svg').innerHTML=parts.join('');
  },state:()=>({active:enabled,aim:[...aim],impacts:marks.map(m=>({...m}))}),
  dispose(){abort.abort();panel.remove();target.dispose();quad.geometry.dispose();quad.material.dispose();},
 };
}
