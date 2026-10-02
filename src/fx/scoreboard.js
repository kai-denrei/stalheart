// THE SCOREBOARD ISAO PRINTS (owner, 2026-10-02: "A trophy counter of how many enemies have been killed. Diegetic panel in the base
// ... Isao printing a literal scoreboard in the base, like Gimli and Legolas joking about who has the more kills"; and "A flag showing
// the Rank"). A plaque on a post at the board's island, its face a canvas: YOU (the hands-on kills the rank ladder counts), ISAO (the
// sentries he printed), SKY (the gunship, the strike and SOL), each as a number and as its quarter-circle base-16 glyph
// (src/domain/score-glyphs.js), and the pilot's rank badge (src/ranks.js) on a flag beside it in the tier's colour. Redrawn only when
// a number changes. The host places it from the step's print bed and feeds it the run's books.
import * as THREE from '../../vendor/three.module.js';
import { glyphArcs } from '../domain/score-glyphs.js';
import { badgeSVG, rankLabel, rankToTierLevel } from '../ranks.js';

const TIER = ['#b08d57', '#c9ccd1', '#e8c04c'];
const W = 512, H = 352;

export function createScoreboard(scene, { at, up, facing, metres = 1 }) {
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
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6, 8), postMat); pole.position.set(3.0, 3, 0); group.add(pole);
  const flagCanvas = document.createElement('canvas'); flagCanvas.width = 256; flagCanvas.height = 160;
  const flagTex = new THREE.CanvasTexture(flagCanvas); flagTex.colorSpace = THREE.SRGBColorSpace;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.5, 12, 6), rest = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: flagTex, emissiveIntensity: 0.25 }));
  cloth.position.set(3.0 + 1.2, 5.2, 0); group.add(cloth);
  let shown = { you: -1, isao: -1, sky: -1, rank: -1, hands: -1 }, time = 0, badgeImg = null, badgeRank = -1;

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
    ctx.strokeStyle = '#2b6b96'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = '#9fdcff'; ctx.font = '700 26px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '4px';
    ctx.fillText('KILLS · THIS RUN', 28, 40);
    ctx.fillStyle = '#5d7a84'; ctx.font = '600 16px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right'; ctx.fillText('ISAO IS KEEPING COUNT', W - 28, 40); ctx.textAlign = 'left';
    const rows = [['YOU', s.you, '#ffd27a'], ['ISAO', s.isao, '#bfe6ea'], ['SKY', s.sky, '#9fb4ff']];
    const lead = s.you >= s.isao;
    rows.forEach(([label, n, col], i) => {
      const y = 100 + i * 78;
      ctx.fillStyle = col; ctx.font = '700 30px ui-monospace, Menlo, monospace'; ctx.fillText(label, 28, y);
      ctx.font = '700 44px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillText(String(n), 300, y); ctx.textAlign = 'left';
      arcsAt(ctx, n, 392, y, 30);
      if ((i === 0 && lead) || (i === 1 && !lead)) { ctx.fillStyle = col; ctx.font = '600 14px ui-monospace, Menlo, monospace'; ctx.fillText(i === 0 ? '◆ AHEAD' : '◆ AHEAD', 440, y); }
    });
    ctx.fillStyle = '#5d7a84'; ctx.font = '600 14px ui-monospace, Menlo, monospace'; ctx.fillText(`RANK ${rankLabel(s.rank)} · ${s.hands} HANDS-ON`, 28, H - 30);
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
  draw({ you: 0, isao: 0, sky: 0, rank: 0, hands: 0 }); drawFlag({ rank: 0 });
  return {
    group,
    // the run's books: you (hands-on), isao (the sentries), sky (gunship, strike, SOL), rank, hands
    update(s) { if (['you', 'isao', 'sky', 'rank', 'hands'].every((k) => s[k] === shown[k])) return; const rankMoved = s.rank !== shown.rank; shown = { ...s }; draw(shown); if (rankMoved) { drawFlag(shown); badge(shown.rank); } },
    tick(dt) {
      time += dt;
      const p = clothGeo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { const x = rest[i], y = rest[i + 1]; const k = (x + 1.2) / 2.4; p[i] = x; p[i + 1] = y; p[i + 2] = Math.sin(time * 2.2 + x * 2.5) * 0.12 * k + Math.sin(time * 3.1 + y * 3) * 0.05 * k; }
      clothGeo.attributes.position.needsUpdate = true;
    },
    state: () => ({ ...shown }),
    dispose() { scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); },
  };
}
