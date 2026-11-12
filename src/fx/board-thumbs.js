// THE BUILD BOARD'S THUMBNAILS (owner, 2026-11-05, round 7 note 4: "the build board gets small wireframe thumbnails like the glossary's"; the
// rules src/domain/board-thumbs.js, the frame BUILD_BOARD.thumb). Each card's picture is one frame of the real thing through the glossary's
// sprite rig (td-tab's spriteShot, src/fx/wave-card.js), drawn as the bestiary's tinted wireframe (model-fixture setWireframe): a structure
// its bestiary model (a dome its own LOD2, 2026-11-07), a sentry its own look (an upgrade one tier up), a companion its model, the hull's cards the MÖRK, the shield a drawn
// dome. A GLB lands later than the card: the <img> gets its src when it does, and a landing after the board closed (or after a newer board
// opened: the generation token) is dropped. The geometry is the clone's own, so the sprite rig's dispose never frees a model the game draws.
//   createBoardThumbs({ spriteShot(key, build), towerLook(), towers() }) -> { fill(offer, img) -> drawn or pending (false: nothing to draw), close() }
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture, setWireframe } from './model-fixture.js';
import { buildTowerLook } from '../towerlooks.js';
import { TOWER_BY_KEY } from '../towers.js';
import { UNIT_ENTRIES } from '../content/bestiary.js';
import { COMPANIONS } from '../content/companions.js';
import { BUILD_BOARD } from '../content/build-board.js';
import { DOME_STRUCTURES, domeFiles } from '../content/dome-city.js';
import { COLONY } from '../content/colony.js';
import { thumbSource, thumbKey, fitScale } from '../domain/board-thumbs.js';

const T = BUILD_BOARD.thumb;
const entry = (pred) => UNIT_ENTRIES.find((e) => pred(e) && e.model?.url)?.model ?? null;
// THE DOMES (the owner's note of 2026-11-07, the base from scratch): a dome card has no bestiary entry; it draws its own dome's one-draw LOD2 with
// its port caps on (a dome alone on the card, no bridge to open them for)
const domeOf = (step) => DOME_STRUCTURES.find((s) => s.id === step && !s.anchor && s.far) ?? null;
//   thumbModel(src) -> { url, hide? } the GLB a card's picture is drawn from, or null (the node test checks every board structure has one)
export const thumbModel = (src) => (src.draw === 'structure' ? entry((e) => (e.board ?? e.needs?.perk) === src.step) ?? (domeOf(src.step) ? { url: domeOf(src.step).far } : null)   // `board`: an entry that draws a card whose step has no perk of its own (the fourth Bio-Pearl, round 8)
  : src.draw === 'kind' && COLONY.kinds[src.kind] ? { url: domeFiles(COLONY.kinds[src.kind].module).far }   // a colony card: its kind's one-draw LOD2 (2026-11-12 night)
  : src.draw === 'hull' ? entry((e) => e.id === 'mork')
  : src.draw === 'pet' && COMPANIONS.units?.[src.index]?.model ? { url: COMPANIONS.units[src.index].model } : null);

// own geometry, wireframe, scaled to the frame and centred where the rig's camera looks; the group turns about its middle
function framed(obj, hide = []) {
  for (const n of hide) obj.getObjectByName(n)?.removeFromParent();
  obj.traverse((o) => { if (o.isMesh && o.geometry) o.geometry = o.geometry.clone(); });
  setWireframe(obj, true, { tint: true });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const k = fitScale(size, T.frame) || 1;
  obj.scale.multiplyScalar(k); obj.position.sub(mid.multiplyScalar(k)); obj.position.y += T.centre;
  const g = new THREE.Group(); g.add(obj); return g;
}
function dome() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: T.dome, wireframe: true, transparent: true, opacity: 0.85 }));
  m.position.y = T.centre - 0.2; const g = new THREE.Group(); g.add(m); return g;
}

export function createBoardThumbs(h) {
  let gen = 0;
  function resolve(offer) {
    const src = thumbSource(offer); if (!src || src.draw !== 'tower') return src;
    const t = src.ci != null ? h.towers().find((x) => x.ci === src.ci) : null, def = t ? t.def : TOWER_BY_KEY[src.key];
    return def ? { ...src, look: h.towerLook(), key: def.key, def, tier: (t ? t.tier : 0) + src.up } : null;
  }
  function fill(offer, img) {
    const src = resolve(offer); if (!src) return false;
    const key = thumbKey(src), my = gen;
    const put = (build) => { if (my === gen && img.isConnected) img.src = h.spriteShot(key, build); };
    if (src.draw === 'tower') { put(() => framed(buildTowerLook(src.look, src.def, src.tier))); return true; }
    if (src.draw === 'dome') { put(dome); return true; }
    const model = thumbModel(src); if (!model) return false;
    loadModelFixture(model.url).then((scene) => put(() => framed(cloneFixture(scene), model.hide)), () => {});
    return true;
  }
  return { fill, close: () => { gen++; } };
}
