// The auto gunship's MK-9 never lands near the base (owner, 2026-10-02: "should not launch a nuke too close to the player and destroy
// friendly units in auto-mode"): a pile next to a friendly point is passed over, the same pile far out is struck.
import assert from 'node:assert/strict';
import { createGunshipAuto } from '../src/fx/gunship-auto.js';
import { GUNSHIP_AUTO } from '../src/content/gunship.js';

const unit = (lat, lon) => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
function rig(pileAt) {
  const launched = [], cs = 0.0133;
  const enemies = Array.from({ length: 40 }, (_, i) => ({ alive: true, pos: unit(pileAt[0] + (i % 5) * 0.001, pileAt[1] + Math.floor(i / 5) * 0.001) }));
  const G = {
    state: { passes: 1, heavyPass: 0, mounted: true }, cs, centers: [[0, 1, 0]],
    guns: { heavy: { blastCells: 5.5, ringHex: 0, travel: 1, sound: 'x' }, rotary: { blastCells: 0.45, travel: 1 }, bofors: { blastCells: 1.1, travel: 1 } },
    onStation: () => true, mount() {}, enemies: () => enemies, cell: () => 0, select: () => true, paintHeavy: () => true,
    launchHeavy: () => { launched.push(1); return 0; }, optic: { muzzle: () => [0, 2, 0], flight() {} }, drop: { release: () => true },
    sfx() {}, step: () => 0, landed: () => [], stepHeavy: () => -1,
  };
  const auto = createGunshipAuto({ G, tune: GUNSHIP_AUTO, onScreen: () => true, callout() {}, friends: () => [unit(0, 0)] });
  auto.tick(0.016, false);
  return launched.length;
}
assert.equal(rig([0.01, 0.01]), 0, 'a pile beside the base is not nuked');
assert.equal(rig([0.6, 0.6]), 1, 'the same pile far out is');
console.log('gunship-auto-safe: the auto MK-9 only lands clear of the base and the hull.');
