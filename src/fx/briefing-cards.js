// The campaign board's opening briefing and glossaries: the cards and the how-to text, moved out of src/td-tab.js whole
// (2026-09-16) so the controller keeps its line budget. The controller still owns the sprites and when the cards show.
import * as THREE from '../../vendor/three.module.js';
import { makeShellSolid } from '../units.js';

// mini bullet triad, briefing-icon edition
export function makeTriadIcon() {
  const g = new THREE.Group();
  for (let k = -1; k <= 1; k++) {
    const b = makeShellSolid({ body: 0xffb000, hi: 0xffffff });
    b.scale.setScalar(0.19);
    b.position.set(k * 0.52, 0, 0);
    g.add(b);
  }
  g.userData.kind = 'triad';
  return g;
}

// one element = one little card: real sprite · name · what it does
export const glossCard = (color, iconUrl, name, desc) =>
  `<div class="gcard"><img class="gicon" src="${iconUrl}" alt="">` +
  `<div class="gname" style="color:${color}">${name}</div>` +
  `<div class="gdesc">${desc}</div></div>`;

// the how-to, in ONE place: shown at the beginning and while paused —
// never on the live HUD
export const GAMEPLAY_TIPS =
  `<div class="tips-head">gameplay</div>` +
  `<div class="tips">` +
  `drive: drag the throttle · flick up for full · below zero reverses<br>` +
  `steer: the side zones · fire: &#9673; shell · &#8767; laser (overheats)<br>` +
  `B = build/tank · M = map view · in BUILD tap HIGH GROUND to place towers<br>` +
  `ESC pause · RAM the small ones · shells breach walls</div>`;
