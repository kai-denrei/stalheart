// A broad eye-origin scan volume plus a sweeping light sheet. The survey's
// timings/rewards remain in the scout rules; this owns only light and HUD.
import * as THREE from '../../vendor/three.module.js';
import { DOG_SCOUT } from '../content/dog-scout.js';
export function createScoutScan(scene, metres, tune = DOG_SCOUT.scan) {
  const N=32, geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*9),3));
  const material=new THREE.MeshBasicMaterial({color:tune.colour,transparent:true,opacity:.065,side:THREE.DoubleSide,depthWrite:false});
  const beam=new THREE.Mesh(geometry,material);beam.name='K9 scanning laser';beam.visible=false;beam.frustumCulled=false;scene.add(beam);
  const rimGeo=new THREE.BufferGeometry();rimGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*6+8*6),3));
  const rim=new THREE.LineSegments(rimGeo,new THREE.LineBasicMaterial({color:tune.colour,transparent:true,opacity:.52,depthWrite:false}));rim.frustumCulled=false;rim.visible=false;scene.add(rim);
  const sweepGeo=new THREE.BufferGeometry();sweepGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));
  const sweep=new THREE.Mesh(sweepGeo,new THREE.MeshBasicMaterial({color:tune.colour,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));sweep.name='K9 scanning sweep';sweep.frustumCulled=false;sweep.visible=false;scene.add(sweep);
  const panel=typeof document==='undefined'?null:document.createElement('div');let title,subject,progressEl,results;
  if(panel){panel.className='scout-scan-hud';panel.hidden=true;
    const add=(cls)=>{const n=document.createElement('div');n.className=cls;panel.append(n);return n;};
    add('scan-visor').setAttribute('aria-hidden','true');title=add('scan-title');subject=add('scan-subject');progressEl=add('scan-progress');results=add('scan-results');results.setAttribute('aria-live','polite');document.body.append(panel);}
  const target=new THREE.Vector3(),eye=new THREE.Vector3(),axis=new THREE.Vector3(),up=new THREE.Vector3(),side=new THREE.Vector3();
  let result=null,until=0,active=false,radius=0,lastText='';
  const words=kind=>tune.results[kind]??[];
  const write=(kind,scanning,progress)=>{if(!panel)return;panel.hidden=false;const key=`${kind}:${scanning}:${Math.round(progress*100)}`;if(key===lastText)return;lastText=key;panel.dataset.phase=scanning?'scanning':'complete';
    title.textContent=`RECKON K9 / ${scanning?'SPECTRAL ANALYSIS':'SCAN COMPLETE'}`;subject.textContent=words(kind)[0]??'SAMPLE';
    progressEl.textContent=scanning?`${Math.min(99,Math.round(progress*100)).toString().padStart(2,'0')}%`:'100%';
    results.replaceChildren();for(const text of (scanning?['ACQUIRING MATERIAL SIGNATURE','VOLUMETRIC SWEEP IN PROGRESS']:words(kind).slice(1))){const n=document.createElement('div');n.textContent=text;results.append(n);}
    panel.style.setProperty('--scan-progress',`${scanning?progress*100:100}%`);};
  return {
    tick({origin,point,kind,progress=0,time,scanning=false}){
      active=!!(scanning&&origin&&point);beam.visible=rim.visible=sweep.visible=active;
      if(active){eye.fromArray(origin);target.fromArray(point);axis.copy(target).sub(eye).normalize();up.copy(target).normalize().addScaledVector(axis,-target.clone().normalize().dot(axis));
        if(up.lengthSq()<1e-10)up.set(0,1,0).addScaledVector(axis,-axis.y);up.normalize();side.crossVectors(axis,up).normalize();
        radius=(kind==='rock'?tune.crystalRadiusM:tune.biomassRadiusM)*metres;
        const ring=Array.from({length:N+1},(_,i)=>target.clone().addScaledVector(side,Math.cos(i/N*Math.PI*2)*radius).addScaledVector(up,Math.sin(i/N*Math.PI*2)*radius));
        const p=geometry.attributes.position,l=rimGeo.attributes.position;
        for(let i=0;i<N;i++){p.setXYZ(i*3,...origin);p.setXYZ(i*3+1,...ring[i].toArray());p.setXYZ(i*3+2,...ring[i+1].toArray());l.setXYZ(i*2,...ring[i].toArray());l.setXYZ(i*2+1,...ring[i+1].toArray());}
        for(let i=0;i<8;i++){l.setXYZ(N*2+i*2,...origin);l.setXYZ(N*2+i*2+1,...ring[i*4].toArray());}
        const y=Math.sin(time*tune.sweepHz*Math.PI*2)*.95,width=Math.sqrt(1-y*y),a=target.clone().addScaledVector(up,y*radius).addScaledVector(side,width*radius),b=target.clone().addScaledVector(up,y*radius).addScaledVector(side,-width*radius);
        const sheet=sweepGeo.attributes.position;sheet.setXYZ(0,...origin);sheet.setXYZ(1,...a.toArray());sheet.setXYZ(2,...b.toArray());p.needsUpdate=l.needsUpdate=sheet.needsUpdate=true;
        write(kind,true,progress);
      }else if(result&&time<until)write(result,false,1);else if(panel)panel.hidden=true;
    },
    dismiss(){until=0;if(panel)panel.hidden=true;},
    complete(kind,time){result=kind;until=time+tune.resultSeconds;},
    state:()=>({active,result,until,beam:beam.visible,radiusM:radius/metres,coneSegments:N,sweeping:sweep.visible}),
    dispose(){panel?.remove();for(const o of [beam,rim,sweep]){o.removeFromParent();o.geometry.dispose();o.material.dispose();}},
  };
}
