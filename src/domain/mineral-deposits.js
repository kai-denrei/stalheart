// Finite mineral deposits, separate from corpses and their seepage. A stable
// seed ranks reachable open cells; the planet recipe/kernel are untouched.
export const surfaceArc = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0]*b[0]+a[1]*b[1]+a[2]*b[2]) / (Math.hypot(...a)*Math.hypot(...b)))));
export function pickDeposits(candidates, centers, seed, tune, metres) {
  const rank = (cell) => { let x = (cell ^ seed) | 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return (x ^ (x >>> 16)) >>> 0; };
  const chosen = [];
  for (const c of candidates.slice().sort((a, b) => rank(a) - rank(b) || a - b)) {
    if (chosen.every((p) => surfaceArc(centers[c], centers[p]) >= tune.separationM * metres)) chosen.push(c);
    if (chosen.length >= tune.count) break;
  }
  return chosen.map((cell, i) => ({ id: `mineral-${i + 1}`, cell, kg: tune.kg, initial: tune.kg }));
}
export function takeMineral(deposits, cell, kg) {
  const d = deposits.find((p) => p.cell === cell); if (!d || !(kg > 0)) return 0;
  const n = Math.min(d.kg, kg); d.kg -= n; return n;
}
