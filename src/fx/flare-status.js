// The carried supply and each marker limit stay readable while driving.
export function flareStatus(stock, amber, violet, tune) {
 return {title:`F · FLARES ${stock}/${tune.stock}`,detail:stock===0?'EMPTY · DRIVE TO CARGO DROP-OFF FLAGS':`REFILL AT CARGO FLAGS · ${tune.seconds}s BURN · ACTIVE: AMBER ${amber}/${tune.max} · VIOLET ${violet}/${tune.max}`,empty:stock===0};
}
export function createFlareStatus(tune) {
 const el=document.createElement('div');el.className='flare-status';el.hidden=true;el.setAttribute('aria-live','polite');
 const title=document.createElement('strong'),detail=document.createElement('span');el.append(title,detail);document.body.append(el);
 let nextLayout=0;
 const place=()=>{
   const now=performance.now();if(now<nextLayout)return;nextLayout=now+250;
   const blockers=[...document.querySelectorAll('#ground-feed,#story-monitor,.throttle,#td-brief,#story-views,.hull-console,.mineral-hud,#day-dial,#td-hud,.minimap,.sensor-card,#controls-card,#gunship-briefing,#sol82-briefing,.build-board,.throttle-panel')]
     .filter(o=>!o.hidden&&getComputedStyle(o).display!=='none'&&getComputedStyle(o).visibility!=='hidden')
     .map(o=>o.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
   const r=el.getBoundingClientRect(),spot=flareHudSpot(innerWidth,innerHeight,r.width,r.height,blockers);
   el.style.visibility=spot?'visible':'hidden';if(spot){el.style.left=spot.x+'px';el.style.top=spot.y+'px';}
 };
 return {update(stock,amber,violet,visible){el.hidden=!visible;const s=flareStatus(stock,amber,violet,tune);if(title.textContent!==s.title)title.textContent=s.title;if(detail.textContent!==s.detail)detail.textContent=s.detail;el.classList.toggle('empty',s.empty);if(visible)place();},dispose(){el.remove();}};
}
// Try the periphery; a busy modal hides the supply strip until space returns.
export function flareHudSpot(width,height,w,h,blocks){
 const gap=12,right=width-w-gap;
 for(const x of [right,gap])for(let y=height-h-100;y>=70;y-=h+gap){
   if(x<gap)continue;
   if(!blocks.some(r=>x<r.right+gap&&x+w>r.left-gap&&y<r.bottom+gap&&y+h>r.top-gap))return {x,y};
 }
 return null;
}
