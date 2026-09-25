// THE ROTOR'S TWO VOICES. The spool follows the barrels (operator, 2026-09-12): a looped spin whose gain and pitch ride the spin
// rate, so it rolls while they turn and dies as they stop. The sight's fire (owner, 2026-09-14/15) is its own muffled loop over the
// spin, running while rounds leave the gun. A mount the frame does not step — another seat is taken, or the story's sentries wait
// for their override — must be SILENT (2026-09-25 playtest: the Rotor's spin and fire carried into the next seat): hushRotor.
//   s01: the spin rate, 0..1; att: the listener's distance attenuation; povFiring: this mount is the seat and rounds are leaving it
export function rotorVoice(sfx, tw, { s01, att, povFiring }) {
  if (s01 > 0.03) { tw.spool ??= sfx.loop('minigun_ready', { gain: 0.001, rate: 0.5 }); tw.spool?.set(s01 * att, 0.5 + 0.5 * s01); }
  else if (tw.spool) { tw.spool.stop(0.2); tw.spool = null; }
  if (povFiring) tw.povFire ??= sfx.loop('rotor_pov_fire', { gain: 0.9, lowpass: 1400 });
  else if (tw.povFire) { tw.povFire.stop(0.15); tw.povFire = null; }
}
export function hushRotor(tw) {
  tw.spool?.stop(0.3); tw.spool = null;
  tw.povFire?.stop(0.1); tw.povFire = null;
}
