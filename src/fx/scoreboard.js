// THE SCOREBOARDS ISAO PRINTS (owner, 2026-10-02: "like Gimli and Legolas joking about who has the more kills ... a friendly scoreboard
// of one for Isao and one for the player ... kills/biomass accumulated and biomass used. Isao would be zero kills and high usage, player
// would be high kills and zero construction"). One plaque per board on two posts, its face a canvas: a title and three rows (KILLS,
// GATHERED, USED), each a number and its quarter-circle base-16 glyph (src/domain/score-glyphs.js). The player's board carries the
// pilot's rank badge (src/ranks.js) on a flag in the tier's colour. celebrate() is Isao's 0 -> 1: the face flashes and bursts of dots
// leave the top. Redrawn only when a number changes. The host places both from the step's print bed and feeds them the run's books.
// A stand-in for the A6 planet scoreboards (docs/A6-ASSET-FEEDBACK.md Part 3).
import * as THREE from '../../vendor/three.module.js';
import { glyphArcs } from '../domain/score-glyphs.js';
import { badgeSVG, rankLabel, rankToTierLevel } from '../ranks.js';
import { makeDotBurst } from '../units.js';

const TIER = ['#b08d57', '#c9ccd1', '#e8c04c'];
const W = 512, H = 352;

export function createScoreboard(scene, { at, up, facing, metres = 1, title = 'YOU', accent = '#ffd27a', flag = true }) {
  const group = new THREE.Group(); group.name = 'Scoreboard';
  const u = new THREE.Vector3().fromArray(up).normalize(), f = new THREE.Vector3().fromArray(facing); f.addScaledVector(u, -f.dot(u)).normalize();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(u, f).negate(), u, f);
  group.position.fromArray(at); group.quaternion.setFromRotationMatrix(basis); group.scale.setScalar(metres);
  scene.add(group);
  // the plaque: a 4 x 2.75 m face on two 2 m posts
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.75), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.1 }));
  face.position.set(0, 3.4, 0); group.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.95, 0.12), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.8, metalness: 0.3 })); back.position.set(0, 3.4, -0.08); group.add(back);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.7, metalness: 0.5 });
  for (const x of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.1, 10), postMat); p.position.set(x, 1.05, -0.05); group.add(p); }
  // the rank flag: a pole beside the plaque, a cloth in the tier's colour with the badge, a slow wave in the cloth's vertices
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6, 8), postMat); pole.position.set(3.0, 3, 0); pole.visible = flag; group.add(pole);
  const flagCanvas = document.createElement('canvas'); flagCanvas.width = 256; flagCanvas.height = 160;
  const flagTex = new THREE.CanvasTexture(flagCanvas); flagTex.colorSpace = THREE.SRGBColorSpace;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.5, 12, 6), rest = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: flagTex, emissiveIntensity: 0.25 }));
  cloth.position.set(3.0 + 1.2, 5.2, 0); cloth.visible = flag; group.add(cloth);
  let shown = { rows: null, rank: -1 }, key = '', time = 0, badgeImg = null, badgeRank = -1, party = 0, partyT = 0;
  const bursts = [];

  function arcsAt(ctx, n, cx, cy, R) {
    const g = glyphArcs(n, { radius: R, step: 0.22 });
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(111,230,255,.22)'; ctx.lineWidth = 2;
    for (let i = 0; i < g.rings; i++) { ctx.beginPath(); ctx.arc(cx, cy, R - i * 0.22 * R, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#6fe6ff'; ctx.lineWidth = Math.max(3, R * 0.17);
    for (const a of g.arcs) { ctx.beginPath(); ctx.arc(cx, cy, a.r, -a.to, -a.from); ctx.stroke(); }   // y up in the rule, down on the canvas
    if (g.dot) { ctx.fillStyle = '#6fe6ff'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, R * 0.09), 0, Math.PI * 2); ctx.fill(); }
  }
  function draw(s) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1016'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.textBaseline = 'middle'; ctx.letterSpacing = '4px';
    ctx.fillStyle = accent; ctx.font = '700 34px ui-monospace, Menlo, monospace'; ctx.fillText(title, 28, 44);
    if (s.note) { ctx.fillStyle = '#5d7a84'; ctx.font = '600 15px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillText(s.note, W - 28, 44); ctx.textAlign = 'left'; }
    (s.rows ?? []).forEach(([label, n], i) => {
      const y = 112 + i * 76;
      ctx.fillStyle = '#9fb4c0'; ctx.font = '700 24px ui-monospace, Menlo, monospace'; ctx.fillText(label, 28, y);
      ctx.fillStyle = '#e8f2f4'; ctx.font = '700 44px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillText(String(n), 368, y); ctx.textAlign = 'left';
      arcsAt(ctx, n, 440, y, 30);
    });
    tex.needsUpdate = true;
  }
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
  draw({ rows: [['KILLS', 0], ['GATHERED', 0], ['USED', 0]] }); drawFlag({ rank: 0 });
  return {
    group,
    // rows: [[label, n], ...]; rank: the pilot's (the flag), note: a line beside the title
    update(s) {
      const k = JSON.stringify([s.rows, s.rank, s.note]); if (k === key) return; key = k;
      const rankMoved = s.rank !== shown.rank; shown = { ...s }; draw(shown);
      if (flag && rankMoved) { drawFlag(shown); badge(shown.rank); }
    },
    // ISAO'S 0 -> 1: the face pulses and bursts of dots leave the top for `seconds`
    celebrate(seconds = 5) { party = seconds; partyT = 0; },
    tick(dt) {
      time += dt;
      if (flag) {
        const p = clothGeo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) { const x = rest[i], y = rest[i + 1]; const k = (x + 1.2) / 2.4; p[i] = x; p[i + 1] = y; p[i + 2] = Math.sin(time * 2.2 + x * 2.5) * 0.12 * k + Math.sin(time * 3.1 + y * 3) * 0.05 * k; }
        clothGeo.attributes.position.needsUpdate = true;
      }
      if (party > 0) {
        party -= dt; partyT -= dt;
        face.material.emissiveIntensity = 0.55 + 0.9 * Math.abs(Math.sin(time * 9));
        if (partyT <= 0) { partyT = 0.35; const b = makeDotBurst([0xffd27a, 0x7dffb0, 0x6fe6ff, 0xff6fb0][Math.floor(Math.random() * 4)], [0, 1, 0], 36); b.position.set((Math.random() - 0.5) * 3.6, 4.9, 0.2); b.scale.setScalar(1.6); group.add(b); bursts.push(b); }
        if (party <= 0) face.material.emissiveIntensity = 0.55;
      }
      for (let i = bursts.length - 1; i >= 0; i--) { if (bursts[i].userData.tick?.(dt) === false) { group.remove(bursts[i]); bursts.splice(i, 1); } }
    },
    celebrating: () => party > 0,
    state: () => ({ ...shown }),
    dispose() { scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); },
  };
}
