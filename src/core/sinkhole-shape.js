// One boundary contract for the host floor, fissure clipping and bowl mesh.
export const SINKHOLE_INNER=.18;
export const SINKHOLE_DEPTH=.55;
const waves=[[.16,3,0],[.10,5,Math.PI/2],[.035,11,.6],[.025,19,1.2]];
export const rimRadius=angle=>1+waves.reduce((sum,[amount,frequency,phase])=>sum+amount*Math.sin(angle*frequency+phase),0);
export const SINKHOLE_BOUNDARY_GLSL=`float sinkholeRim(float angle){return 1.0${waves.map(([a,f,p])=>`+${a.toFixed(6)}*sin(angle*${f.toFixed(1)}+${p.toFixed(6)})`).join('')};}`;
export function bowlHeight(angle,radius){
  const t=Math.max(0,Math.min(1,(1-radius)/(1-SINKHOLE_INNER)));
  // Broad approach toward the viewing side; other sides break more steeply.
  const delta=Math.atan2(Math.sin(angle-1),Math.cos(angle-1));
  const approach=Math.exp(-Math.pow(delta/.65,4));
  const power=.48+.77*approach;
  return -SINKHOLE_DEPTH*Math.pow(t,power)+.018*Math.sin(angle*23+t*17)*t*(1-t);
}
export function sinkholeGroundHeight(x,z,scale){
  if(scale<=0)return 0;
  const angle=Math.atan2(z,x),r=Math.hypot(x,z)/(scale*rimRadius(angle));
  if(r>=1)return 0;
  if(r<SINKHOLE_INNER)return -20*scale;
  return scale*bowlHeight(angle,r);
}
