// perftier.mjs — the render budget is a table; these are the table's rules.
import { TIERS, pickTier } from '../src/perftier.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

console.log('the phone pays less on every axis, and it is written down:');
{
  const d = TIERS.desktop, p = TIERS.phone;
  check('pixel ratio cap lower', p.dprCap < d.dprCap);
  check('no MSAA on the phone', p.antialias === false && d.antialias === true);
  check('bloom at half res', p.bloomScale === 0.5 && d.bloomScale === 1);
}

console.log('the pick:');
{
  check('coarse + phone-class short side -> phone', pickTier({ coarse: true, shortSide: 390 }) === TIERS.phone);
  check('coarse tablet (short side 900+) -> desktop', pickTier({ coarse: true, shortSide: 1024 }) === TIERS.desktop);
  check('fine pointer, any size -> desktop', pickTier({ coarse: false, shortSide: 390 }) === TIERS.desktop);
  check('forced by name wins', pickTier({ coarse: false, shortSide: 2000, forced: 'phone' }) === TIERS.phone);
  check('an unknown name is ignored, not a crash', pickTier({ coarse: true, shortSide: 390, forced: 'toaster' }) === TIERS.phone);
  check('no facts at all -> desktop', pickTier() === TIERS.desktop);
}

if (failures) { console.error(`perftier: ${failures} FAILED`); process.exit(1); }
console.log('perftier: all good');
