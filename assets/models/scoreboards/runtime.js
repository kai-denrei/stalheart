// Add one GPU-instanced live score display to an LOD0/LOD1 scoreboard GLB.
// The GLB itself retains a visible 12,345,678 snapshot until this adapter runs.
const SEGMENTS={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd'};
const POS={a:[0,.285],b:[.235,.145],c:[.235,-.145],d:[0,-.285],e:[-.235,-.145],f:[-.235,.145],g:[0,0]};
const FONT={
 '0':['11111','10001','10011','10101','11001','10001','11111'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['11111','00001','00001','11111','10000','10000','11111'],
 '3':['11111','00001','00001','01111','00001','00001','11111'],
 '4':['10001','10001','10001','11111','00001','00001','00001'],
 '5':['11111','10000','10000','11111','00001','00001','11111'],
 '6':['11111','10000','10000','11111','10001','10001','11111'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['11111','10001','10001','11111','10001','10001','11111'],
 '9':['11111','10001','10001','11111','00001','00001','11111']
};
const COLORS={beacon:0x82ffe4,flipdot:0xf5e56b,splitflap:0x203038};
export const MAX_SCORE=99999999;
export function normalizeScore(value){const n=Number(value);if(!Number.isFinite(n))throw new TypeError('Score must be finite');return Math.min(MAX_SCORE,Math.max(0,Math.trunc(n)));}
export function attachScoreDisplay(THREE,root,entry,initial=entry.display.default_score,options={}){
 if(entry.display.rows===3)return attachRivalryDisplay(THREE,root,entry,initial,options);
 if(entry.lod===2)throw new Error('LOD2 is a static score snapshot; use LOD1 for a live score');
 const anchor=root.getObjectByName(entry.display.runtime_node),snapshot=root.getObjectByName(entry.display.static_node);if(!anchor||!snapshot)throw new Error('Scoreboard display nodes are missing');snapshot.visible=false;
 const style=entry.variant,pixel=style==='flipdot',bitmap=pixel||style==='splitflap';const geometry=pixel?new THREE.CircleGeometry(.035,8):new THREE.BoxGeometry(1,1,1);const material=pixel?new THREE.MeshStandardMaterial({color:COLORS[style],roughness:.93,metalness:0,side:THREE.DoubleSide}):new THREE.MeshBasicMaterial({color:COLORS[style]});const display=new THREE.InstancedMesh(geometry,material,bitmap?280:56);display.name='SCORE_LIVE_INSTANCES';display.frustumCulled=false;anchor.add(display);
 const dummy=new THREE.Object3D();let score=0;
 function place(x,y,w,h,z){dummy.position.set(x,y,z);dummy.scale.set(w,h,pixel?1:bitmap?.014:.025);dummy.rotation.set(0,0,0);dummy.updateMatrix();display.setMatrixAt(display.count,dummy.matrix);display.count++;}
 function setScore(value,{blankLeading=false}={}){score=normalizeScore(value);display.count=0;const digits=String(score).padStart(8,blankLeading?' ':'0');for(let i=0;i<8;i++){const x=(i-3.5)*entry.display.pitch_m,d=digits[i];if(d===' ')continue;if(bitmap){const pattern=FONT[d];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(pattern[row][col]==='1')place(x+(col-2)*.09,(3-row)*.09,pixel?1:.073,pixel?1:.073,.066);}else for(const segment of SEGMENTS[d]){const [dx,dy]=POS[segment],horizontal='adg'.includes(segment);place(x+dx,dy,horizontal?.40:.065,horizontal?.068:.235,.066);}}display.instanceMatrix.needsUpdate=true;return score;}
 setScore(initial);
 return{get score(){return score;},setScore,setColor(color){material.color.set(color);},display,dispose(){anchor.remove(display);geometry.dispose();material.dispose();snapshot.visible=true;}};
}

const LETTERS={
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],'?':['11110','00001','00001','00110','00100','00000','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']
};
const GLYPHS={...FONT,...LETTERS};
const RIVALRY_ROWS=['KILLS','GATHERED','USED'];
export const MAX_ROW_SCORE=999999;
export function normalizeRowScore(value){const n=Number(value);if(!Number.isFinite(n))throw new TypeError('Row score must be finite');return Math.min(MAX_ROW_SCORE,Math.max(0,Math.trunc(n)));}
export function normalizeLabel(value,max=18){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().slice(0,max).replace(/[^A-Z0-9 ?-]/g,'?');}

export function attachRivalryDisplay(THREE,scene,entry,initial={},options={}){
 if(entry.display.rows!==3)throw new Error('This scoreboard has no three-row face');
 if(entry.lod===2)throw new Error('LOD2 has a blank static face; use LOD1 for a live score');
 const root=scene.getObjectByName('SCOREBOARD_ROOT');if(!root)throw new Error('SCOREBOARD_ROOT is missing');
 const style=entry.variant.replace('_rivalry',''),pixel=style==='flipdot',bitmap=style!=='beacon',maxInstances=bitmap?3*6*35:3*6*7;
 for(const name of ['LABEL_ORIGIN',...RIVALRY_ROWS.flatMap(r=>[`ROW_${r}_LABEL_ORIGIN`,`ROW_${r}_DISPLAY_ORIGIN`]),'SOCKET_FX'])if(!root.getObjectByName(name))throw new Error('Missing '+name);
 const digitGeometry=pixel?new THREE.CircleGeometry(.019,8):new THREE.BoxGeometry(1,1,1),labelGeometry=new THREE.BoxGeometry(1,1,1);
 const color=new THREE.Color(options.color??({beacon:0x82ffe4,flipdot:0xf5e56b,splitflap:0x203038})[style]);
 const digitMaterial=pixel?new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0,side:THREE.DoubleSide}):new THREE.MeshBasicMaterial({color:bitmap?color:0xffffff,vertexColors:false});
 const labelMaterial=new THREE.MeshBasicMaterial({color});
 const digitMesh=new THREE.InstancedMesh(digitGeometry,digitMaterial,maxInstances),labelMesh=new THREE.InstancedMesh(labelGeometry,labelMaterial,1500);digitMesh.name='RIVALRY_LIVE_DIGITS';labelMesh.name='RIVALRY_LIVE_LABELS';digitMesh.frustumCulled=false;labelMesh.frustumCulled=false;root.add(digitMesh,labelMesh);
 const dummy=new THREE.Object3D(),rowAnchors=RIVALRY_ROWS.map(r=>root.getObjectByName(`ROW_${r}_DISPLAY_ORIGIN`)),ownerAnchor=root.getObjectByName('LABEL_ORIGIN'),rowLabelAnchors=RIVALRY_ROWS.map(r=>root.getObjectByName(`ROW_${r}_LABEL_ORIGIN`));
 let scores=RIVALRY_ROWS.map((r,i)=>normalizeRowScore(initial?.[r.toLowerCase()]??(Array.isArray(initial)?initial[i]:0))),from=scores.slice(),target=scores.slice(),elapsed=0,duration=0,celebration=0,owner=normalizeLabel(options.label??'ISAO'),labels=RIVALRY_ROWS.map(r=>normalizeLabel(options.rowLabels?.[r.toLowerCase()]??r,8));
 const blankLeading=options.blankLeading??true;
 function matrix(targetMesh,x,y,z,w,h,depth){dummy.position.set(x,y,z);dummy.scale.set(w,h,depth);dummy.rotation.set(0,0,0);dummy.updateMatrix();targetMesh.setMatrixAt(targetMesh.count++,dummy.matrix);}
 function digitStrings(values){return values.map(n=>String(n).padStart(6,blankLeading?' ':'0'));}
 function transitionStrings(){const a=digitStrings(from),b=digitStrings(target);if(duration<=0||elapsed>=duration)return b;const t=Math.min(1,elapsed/duration);if(style==='splitflap')return b.map((str,row)=>str.split('').map((ch,i)=>{const old=a[row][i];if(ch===old)return ch;const delay=(5-i)*.10,local=Math.max(0,Math.min(1,(t-delay)/(1-delay)));if(local>=1)return ch;const start=old===' '?0:+old,end=ch===' '?0:+ch,steps=10+(end-start+10)%10;return String((start+Math.floor(local*steps))%10);}).join(''));return t>=1?b:a;}
 function drawDigits(){digitMesh.count=0;const shown=celebration>0?RIVALRY_ROWS.map(()=>'888888'):transitionStrings(),t=duration>0?Math.min(1,elapsed/duration):1;
  for(let row=0;row<3;row++){const anchor=rowAnchors[row];for(let i=0;i<6;i++){const x=anchor.position.x+(i-2.5)*.5,y=anchor.position.y,z=anchor.position.z+.055,ch=shown[row][i];if(style==='beacon'){for(const segment of 'abcdefg'){const [dx,dy]=POS[segment],on=ch!==' '&&SEGMENTS[ch]?.includes(segment),start=from[row],end=target[row];const old=String(start).padStart(6,blankLeading?' ':'0')[i],next=String(end).padStart(6,blankLeading?' ':'0')[i];if(old===' '&&next===' '&&celebration<=0)continue;const oldOn=old!==' '&&SEGMENTS[old]?.includes(segment),newOn=next!==' '&&SEGMENTS[next]?.includes(segment);const intensity=celebration>0?1:duration>0?((oldOn?1:.08)*(1-t)+(newOn?1:.08)*t):(on?1:.08);const horizontal='adg'.includes(segment);matrix(digitMesh,x+dx*.65,y+dy*.7,z,horizontal?.255:.042,horizontal?.043:.16,.016);digitMesh.setColorAt(digitMesh.count-1,new THREE.Color(color).multiplyScalar(intensity));}}else{const pattern=ch===' '?null:GLYPHS[ch];if(!pattern&&style!=='flipdot')continue;for(let r=0;r<7;r++)for(let c=0;c<5;c++){let active=!!pattern&&pattern[r][c]==='1';if(style==='flipdot'&&duration>0&&elapsed<duration&&celebration<=0){const old=String(from[row]).padStart(6,blankLeading?' ':'0')[i],prev=old===' '?null:GLYPHS[old],threshold=(i*5+c)/(6*5-1),progress=Math.max(0,Math.min(1,elapsed/duration));active=progress>=threshold?active:!!prev&&prev[r][c]==='1';}if(active)matrix(digitMesh,x+(c-2)*.064,y+(3-r)*.064,z,pixel?1:.048,pixel?1:.048,pixel?1:.012);}}}}
  digitMesh.instanceMatrix.needsUpdate=true;if(digitMesh.instanceColor)digitMesh.instanceColor.needsUpdate=true;}
 function drawLabels(){labelMesh.count=0;const all=[{text:owner,anchor:ownerAnchor,cell:.038,max:18},...labels.map((text,i)=>({text,anchor:rowLabelAnchors[i],cell:.026,max:8}))];for(const {text,anchor,cell} of all){const advance=cell*6,width=text.length*advance;for(let i=0;i<text.length;i++){const pattern=GLYPHS[text[i]]||GLYPHS['?'];for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(pattern[r][c]==='1')matrix(labelMesh,anchor.position.x-width/2+i*advance+c*cell+cell/2,anchor.position.y+(3-r)*cell,anchor.position.z+.05,cell*.72,cell*.72,.012);}}labelMesh.instanceMatrix.needsUpdate=true;}
 function setScores(next,{duration:seconds=.25}={}){const values=RIVALRY_ROWS.map((r,i)=>normalizeRowScore(next?.[r.toLowerCase()]??(Array.isArray(next)?next[i]:scores[i])));from=scores.slice();target=values;scores=values;duration=Math.max(0,Number(seconds)||0);elapsed=duration?0:duration;drawDigits();return{kills:scores[0],gathered:scores[1],used:scores[2]};}
 function setScore(value,opts={}){return setScores({kills:value},opts).kills;}
 function setLabel(value){owner=normalizeLabel(value,18);drawLabels();return owner;}
 function setRowLabels(value){labels=RIVALRY_ROWS.map((r,i)=>normalizeLabel(value?.[r.toLowerCase()]??(Array.isArray(value)?value[i]:labels[i]),8));drawLabels();return labels.slice();}
 function setColor(value){color.set(value);if(style==='beacon')drawDigits();else digitMaterial.color.copy(color);labelMaterial.color.copy(color);return color.getHexString();}
 function celebrate(seconds=2){celebration=Math.max(0,Number(seconds)||0);drawDigits();return celebration;}
 function update(deltaSeconds){const dt=Math.max(0,Number(deltaSeconds)||0);if(duration>0&&elapsed<duration)elapsed=Math.min(duration,elapsed+dt);if(celebration>0)celebration=Math.max(0,celebration-dt);drawDigits();return{transitioning:elapsed<duration,celebrating:celebration>0};}
 drawLabels();drawDigits();
 return{get scores(){return{kills:scores[0],gathered:scores[1],used:scores[2]};},get label(){return owner;},get rowLabels(){return labels.slice();},setScore,setScores,setLabel,setRowLabels,setColor,celebrate,update,digitMesh,labelMesh,dispose(){root.remove(digitMesh,labelMesh);digitGeometry.dispose();labelGeometry.dispose();digitMaterial.dispose();labelMaterial.dispose();}};
}
