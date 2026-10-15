import {SINKHOLE_THROAT,smooth} from './mission.js';

export const SMOKE_COUNT=3200,SMOKE_SOURCE_Y=SINKHOLE_THROAT-12;
export const SMOKE_FIRST_EMISSION=.12,SMOKE_RELEASE_WINDOW=.32,SMOKE_BURST_SPEED=1400;
export const SMOKE_SURFACE_DELAY=SMOKE_FIRST_EMISSION-SMOKE_SOURCE_Y/110;
// out: x/y/z, diameter, opacity. Every puff is born below the throat;
// the conduit constrains its width until it has passed through the bowl.
const hash=x=>{const n=Math.sin(x*9283.17+1.7)*43758.5453;return n-Math.floor(n);};
export function smokeParticle(seed,age,out){
  const jet=seed>=.65,birth=SMOKE_FIRST_EMISSION+(jet?(seed-.65)/.35*.85:seed*SMOKE_RELEASE_WINDOW);
  const elapsed=Math.max(0,age-birth),t=jet?elapsed%.85:elapsed,mouth=Math.max(0,t+SMOKE_SOURCE_Y/110);
  // Pressure launches the burst violently, then lift collapses and the cloud
  // rolls outward as a dense ground surge instead of climbing into a tower.
  const rise=jet?12*(1-Math.exp(-35*mouth))*Math.exp(-2*mouth)+3*(1-Math.exp(-mouth*4)):(SMOKE_BURST_SPEED+seed*900)/85*(1-Math.exp(-85*mouth))*Math.exp(-.9*mouth)+3*(1-Math.exp(-mouth*2));
  const y=SMOKE_SOURCE_Y+110*Math.min(t,-SMOKE_SOURCE_Y/110)+rise+(jet?0:hash(seed+19)*4*smooth(.3,2,mouth));
  const opened=jet?smooth(-1,8,y):smooth(0,.06,mouth),spread=jet?1+t*(8+seed*4)*opened:1.3+((22+seed*60)*(1-Math.exp(-9*mouth))+mouth*(9+seed*6))*Math.sqrt(hash(seed+7))*opened;
  const angle=hash(seed+11)*Math.PI*2;
  out[0]=Math.sin(angle)*spread+Math.sin(t*1.4+seed*31)*mouth*1.8*opened;
  out[1]=y;
  out[2]=Math.cos(angle)*spread+Math.cos(t*1.2+seed*43)*mouth*1.8*opened;
  out[3]=jet?2.4+opened*(4+t*12):2.4+opened*((1-Math.exp(-18*mouth))*(12+seed*18)+Math.min(6,mouth));
  out[4]=(age>=birth?1:0)*smooth(0,.025,t)*(1-smooth(jet?7:10,jet?12:17,jet?age:elapsed))*.32;
  return out;
}
