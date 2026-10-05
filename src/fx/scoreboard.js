// THE RIVALRY BOARDS ISAO PRINTS (owner, 2026-10-02: "like Gimli and Legolas joking about who has the more kills ... a friendly
// scoreboard of one for Isao and one for the player ... kills/biomass accumulated and biomass used"). The A6 rivalry scoreboards
// (docs/scoreboard-assets.lock.json, built from docs/A6-ASSET-FEEDBACK.md Part 3): an owner label and three rows, KILLS, GATHERED, USED,
// with blank leading zeros, animated transitions and celebrate(), driven through the asset's own runtime. The player stands on the
// seven-segment beacon, Isao on the split-flap (his 0 -> 1 clatters). The player's board carries the pilot's rank badge (src/ranks.js) on
// a flag beside it in the tier's colour; a celebration also throws bursts of dots from the board's SOCKET_FX.
import * as THREE from '../../vendor/three.module.js';
import { badgeSVG, rankLabel, rankToTierLevel } from '../ranks.js';
import { makeDotBurst } from '../units.js';
import { loadModelFixture, cloneFixture } from './model-fixture.js';
import { attachRivalryDisplay } from '../../assets/models/scoreboards/runtime.js';

const TIER = ['#b08d57', '#c9ccd1', '#e8c04c'];
const DIR = 'assets/models/scoreboards/';
let manifest = null;
const loadManifest = () => (manifest ??= fetch(DIR + 'manifest.json').then((r) => r.json()));

// variant: 'beacon_rivalry' | 'splitflap_rivalry' | 'flipdot_rivalry' (the LOD1 game tier is the one pinned)
// rowLabels: { kills, gathered, used } to rename the three rows (the drop-off sign, src/fx/expedition-glue.js)
export function createScoreboard(scene, { at, up, facing, metres = 1, title = 'YOU', accent = '#ffd27a', flag = true, variant = 'beacon_rivalry', rowLabels = null }) {
  const group = new THREE.Group(); group.name = `Scoreboard ${title}`;
  const u = new THREE.Vector3().fromArray(up).normalize(), f = new THREE.Vector3().fromArray(facing); f.addScaledVector(u, -f.dot(u)).normalize();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(u, f), u, f);   // right-handed: +Z (the face) along `facing`
  group.position.fromArray(at); group.quaternion.setFromRotationMatrix(basis); group.scale.setScalar(metres);
  scene.add(group);
  let live = null, board = null, pending = null, shown = { rows: null, rank: -1 }, key = '', time = 0, party = 0, partyT = 0, badgeImg = null, badgeRank = -1;
  const bursts = [], fx = new THREE.Vector3(0, 4.25, 0);
  Promise.all([loadModelFixture(DIR + `${variant}_d0_lod1.glb`), loadManifest()]).then(([model, man]) => {
    if (!group.parent) return;
    const entry = man.assets.find((x) => x.id === `${variant}_d0_lod1`);
    board = cloneFixture(model); group.add(board);
    const socket = board.getObjectByName('SOCKET_FX'); if (socket) socket.getWorldPosition(fx) && group.worldToLocal(fx);
    live = attachRivalryDisplay(THREE, board, entry, {}, { label: title, color: accent, ...(rowLabels ? { rowLabels } : {}) });
    if (pending) { live.setScores(pending, { duration: 0 }); pending = null; }
  }).catch((e) => console.warn('SCOREBOARD failed', e));
  // the rank flag: a pole beside the board, a cloth in the tier's colour with the badge, a slow wave in the cloth's vertices
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.7, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6, 8), postMat); pole.position.set(-4.6, 3, 0); pole.visible = flag; group.add(pole);
  const flagCanvas = document.createElement('canvas'); flagCanvas.width = 256; flagCanvas.height = 160;
  const flagTex = new THREE.CanvasTexture(flagCanvas); flagTex.colorSpace = THREE.SRGBColorSpace;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.5, 12, 6), rest = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: flagTex, emissiveIntensity: 0.25 }));
  cloth.position.set(-4.6 - 1.2, 5.2, 0); cloth.visible = flag; group.add(cloth);
  function drawFlag(s) {
    const ctx = flagCanvas.getContext('2d'), tier = s.rank > 0 ? rankToTierLevel(s.rank).tier : -1;
    ctx.fillStyle = tier >= 0 ? TIER[tier] : '#30404c'; ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = 'rgba(6,16,24,.55)'; ctx.fillRect(12, 12, 232, 136);
    ctx.fillStyle = '#e8f2f4'; ctx.font = '700 18px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText(rankLabel(s.rank), 128, 142);
    if (badgeImg && badgeRank === s.rank) ctx.drawImage(badgeImg, 68, 8, 120, 120);
    flagTex.needsUpdate = true;
  }
  function badge(rank) {
    if (rank < 1 || badgeRank === rank) return;
    const svg = badgeSVG(rank, 120); if (!svg) return;
    const img = new Image(); img.onload = () => { badgeImg = img; badgeRank = rank; drawFlag(shown); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  }
  drawFlag({ rank: 0 });
  return {
    group,
    // rows: [[label, n], ...] in KILLS, GATHERED, USED order; rank: the pilot's (the flag); duration: the board's transition
    update(s, { duration = 0.25 } = {}) {
      const k = JSON.stringify([s.rows, s.rank]); if (k === key) return; key = k;
      const rankMoved = s.rank !== shown.rank; shown = { ...s };
      const v = { kills: s.rows?.[0]?.[1] ?? 0, gathered: s.rows?.[1]?.[1] ?? 0, used: s.rows?.[2]?.[1] ?? 0 };
      if (live) live.setScores(v, { duration }); else pending = v;
      if (flag && rankMoved) { drawFlag(shown); badge(shown.rank); }
    },
    // ISAO'S 0 -> 1: the face celebrates (the runtime) and bursts of dots leave its SOCKET_FX for `seconds`
    celebrate(seconds = 5) { party = seconds; partyT = 0; live?.celebrate(Math.min(seconds, 2.5)); },
    tick(dt) {
      time += dt;
      live?.update(dt);
      if (flag) {
        const p = clothGeo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) { const x = rest[i], y = rest[i + 1]; const k = (1.2 - x) / 2.4; p[i] = x; p[i + 1] = y; p[i + 2] = Math.sin(time * 2.2 + x * 2.5) * 0.12 * k + Math.sin(time * 3.1 + y * 3) * 0.05 * k; }
        clothGeo.attributes.position.needsUpdate = true;
      }
      if (party > 0) {
        party -= dt; partyT -= dt;
        if (partyT <= 0) { partyT = 0.3; const b = makeDotBurst([0xffd27a, 0x7dffb0, 0x6fe6ff, 0xff6fb0][Math.floor(Math.random() * 4)], [0, 1, 0], 36); b.position.copy(fx).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, 0.2)); b.scale.setScalar(1.6); group.add(b); bursts.push(b); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) { if (bursts[i].userData.tick?.(dt) === false) { group.remove(bursts[i]); bursts.splice(i, 1); } }
    },
    celebrating: () => party > 0,
    state: () => ({ ...shown, ready: !!live, scores: live ? live.scores : null, label: live?.label ?? null }),
    dispose() { live?.dispose(); scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); }); },
  };
}
