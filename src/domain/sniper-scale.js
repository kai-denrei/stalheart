// Manual-training stage only; never mutates shared Sentry combat profiles.
export function sniperScale(value){return Math.max(1,Math.min(5,Number(value)||1));}
export function scaleSniperWeapon(weapon,value){const scale=sniperScale(value);return {...weapon,range:weapon.range*scale,minRange:weapon.minRange*scale,muzzleVel:weapon.muzzleVel*Math.sqrt(scale)};}
