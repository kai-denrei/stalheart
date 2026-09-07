// Point forms used by the scout and shellback enemies. Tower sculptures are retired.
function fitUnit(pts) { let m = 0; for (const p of pts) m = Math.max(m, Math.hypot(p[0], p[1], p[2])); return pts.map((p) => p.length > 3 ? [p[0] / m, p[1] / m, p[2] / m, p[3]] : [p[0] / m, p[1] / m, p[2] / m]); }

function fibDir(i, n) { const g = Math.PI * (3 - Math.sqrt(5)), y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * g; return [r * Math.cos(a), y, r * Math.sin(a)]; }

function bacteriumPts() {
  const pts = [], L = 0.68, R = 0.3;
  for (let ix = -12; ix <= 12; ix++) { const x = ix / 12 * L; for (let a = 0; a < 14; a++) { const ang = a / 14 * 2 * Math.PI; pts.push([x, R * Math.cos(ang), R * Math.sin(ang)]); } } // body
  for (const sgn of [-1, 1]) for (let i = 0; i < 60; i++) { const d = fibDir(i, 60); if (sgn * d[0] < 0) continue; pts.push([sgn * L + d[0] * R, d[1] * R, d[2] * R]); } // caps
  for (let k = 0; k < 4; k++) { const ph = k / 4 * 2 * Math.PI; for (let s = 0; s <= 26; s++) { const f = s / 26, x = -L - 0.05 - f * 0.8, amp = 0.16 * f; pts.push([x, amp * Math.sin(f * 10 + ph) + 0.12 * Math.cos(ph), amp * Math.cos(f * 10 + ph) + 0.12 * Math.sin(ph)]); } } // flagella
  return fitUnit(pts);
}

function shellPts() { const pts = [], k = 0.20, turns = 3.6, Nt = 168, Mf = 11; for (let it = 0; it < Nt; it++) { const th = it / Nt * turns * 2 * Math.PI, R = 0.05 * Math.exp(k * th), ct = Math.cos(th), st = Math.sin(th), tr = R * 0.62; for (let ip = 0; ip < Mf; ip++) { const f = ip / Mf * 2 * Math.PI; pts.push([R * ct + tr * Math.cos(f) * ct, R * st + tr * Math.cos(f) * st, tr * Math.sin(f)]); } } return fitUnit(pts); }
export const ORGANIC_FORMS = { bacterium:bacteriumPts, shell:shellPts };
