// Stylized, launcher-independent animation paths; positions are local to a muzzle.
export const ignitionStart=.32;
export const phases=[['Eject',0],['Coast',.10],['Fall',.20],['Ignite',ignitionStart],['Climb',.42],['Crest',.74],['Hook',.84],['Dive',.90]];
export const profiles={swift:{name:'Swift / rapid sentry',duration:1.35,height:.58,range:.72},hook:{name:'Hook / standard',duration:2.7,height:1,range:1},heavy:{name:'Deliberate / special round',duration:4,height:1.28,range:1.2}};
// The opening is an unpowered parabola. Ignition occurs while descending;
// a short catch then reverses the fall before the powered climb.
const knots=[[0,0,0,0],[.10,0,1.8,1],[.20,0,2.4,2],[.28,0,2.016,2.8],[.32,0,1.536,3.2],[.355,0,1.28,3.8],[.42,0,3.8,6],[.58,0,10.5,11],[.74,0,13.2,15],[.84,0,12.8,18],[.90,.12,10.5,20],[.95,-.07,6.5,22],[1,0,0,24]];
function tangent(i,c){
 const u=knots[i][0];
 if(u<=ignitionStart)return c===1?0:c===2?24-120*u:10;
 if(u===.355&&c===2)return 0;
 const a=knots[Math.max(0,i-1)],b=knots[Math.min(knots.length-1,i+1)];return (b[c]-a[c])/(b[0]-a[0]);
}
function rawPosition(u,profile='hook'){
 const p=profiles[profile];u=Math.max(0,Math.min(1,u));let i=knots.findIndex((k,j)=>j<knots.length-1&&u<=knots[j+1][0]);if(i<0)i=knots.length-2;
 const a=knots[i],b=knots[i+1],d=b[0]-a[0],v=(u-a[0])/d;
 return [1,2,3].map(c=>((2*v**3-3*v*v+1)*a[c]+(v**3-2*v*v+v)*d*tangent(i,c)+(-2*v**3+3*v*v)*b[c]+(v**3-v*v)*d*tangent(i+1,c))*(c===2?p.height:c===3?p.range:1));
}
// Re-time the powered curve by distance, independently of its bends. Speed
// increases through the crest instead of inheriting slowdowns from control points.
const catchEnd=.355, tables=new Map();
function table(profile){
 if(tables.has(profile))return tables.get(profile);
 const points=[{u:catchEnd,distance:0}];let previous=rawPosition(catchEnd,profile),length=0;
 for(let i=1;i<=1600;i++){const u=catchEnd+(1-catchEnd)*i/1600,p=rawPosition(u,profile);length+=Math.hypot(...p.map((v,j)=>v-previous[j]));points.push({u,distance:length});previous=p;}
 const a=rawPosition(catchEnd-.00001,profile),b=rawPosition(catchEnd+.00001,profile);
 const initial=Math.hypot(...b.map((v,j)=>v-a[j]))/.00002;
 const result={points,length,startRate:Math.min(.8,initial*(1-catchEnd)/length)};tables.set(profile,result);return result;
}
function course(u,profile){
 if(u<=catchEnd)return u;
 const {points,length,startRate}=table(profile),t=(u-catchEnd)/(1-catchEnd),distance=length*(startRate*t+(1-startRate)*t**3);
 let lo=0,hi=points.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(points[m].distance<distance)lo=m;else hi=m;}
 const a=points[lo],b=points[hi];return a.u+(b.u-a.u)*(distance-a.distance)/(b.distance-a.distance);
}
export function position(u,profile='hook'){return rawPosition(course(Math.max(0,Math.min(1,u)),profile),profile);}
function velocityDirection(u,profile){const a=position(Math.max(0,u-.0002),profile),b=position(Math.min(1,u+.0002),profile),v=b.map((n,i)=>n-a[i]),length=Math.hypot(...v);return v.map(n=>n/length);}
export function sample(u,profile='hook'){
 u=Math.max(0,Math.min(1,u));
 // Attitude is separate from travel: retain the nose-up launch pose through
 // the apex and gravity-driven fall, then blend into the powered course.
 const held=[0,Math.sin(Math.PI*.31),Math.cos(Math.PI*.31)];
 const heading=velocityDirection(Math.max(.39,u-.006),profile);
 const t=Math.max(0,Math.min(1,(u-catchEnd)/.12)),blend=t*t*(3-2*t);
 const direction=held.map((v,i)=>v*(1-blend)+heading[i]*blend),norm=Math.hypot(...direction);
 const phaseU=course(u,profile);
 return {position:position(u,profile),direction:direction.map(v=>v/norm),ignition:u>=ignitionStart&&u<1,phase:[...phases].reverse().find(([,start])=>phaseU>=start)[0]};
}
