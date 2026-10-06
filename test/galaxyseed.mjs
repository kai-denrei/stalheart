// galaxyseed.mjs — the sky is a function of the seed, and only the seed.
import { SKY_HOLE, GALAXY_PALETTES, HOME_GALAXY, buildFieldStars, buildGalaxyDust, buildGalaxyStars, galaxyLayout, galaxyParams } from '../src/galaxyseed.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const finite = (a) => a.every(Number.isFinite);

console.log('galaxyseed:');
const A = buildGalaxyStars(4414, 5000), B = buildGalaxyStars(4414, 5000), C = buildGalaxyStars(4415, 5000);
check('same seed, same stars', same(A.d0, B.d0) && same(A.d1, B.d1) && same(A.pp, B.pp));
check('next seed, different stars', !same(A.d0, C.d0));
check('arrays are sized 4/4/1 per star', A.d0.length === 20000 && A.d1.length === 20000 && A.pp.length === 5000 && A.n === 5000);
check('no NaN anywhere', finite(A.d0) && finite(A.d1));
const bulge = A.pp.reduce((n, v) => n + v, 0) / A.n;
check(`about 17% bulge (${(bulge * 100).toFixed(1)}%)`, bulge > 0.14 && bulge < 0.20);
let aOk = true;
for (let i = 0; i < A.n; i++) { const a = A.d0[i * 4]; if (!(a >= 0 && a <= 1)) aOk = false; }
check('orbit radius fraction stays in [0, 1]', aOk);
const D = buildGalaxyDust(4414, 1000);
check('dust: deterministic, sized, finite', same(D.d0, buildGalaxyDust(4414, 1000).d0) && D.d0.length === 4000 && finite(D.d0) && finite(D.d1));
const F = buildFieldStars(4414, 500);
let shell = true;
for (let i = 0; i < F.n; i++) { const r = Math.hypot(F.p0[i * 4], F.p0[i * 4 + 1], F.p0[i * 4 + 2]); if (r < 149 || r > 261) shell = false; }
check('field stars sit on the 150..260 shell', shell && F.p1.length === 1000);
const P = galaxyParams(4414);
check('params inside the demo\'s clamps', [0, 2, 3, 4, 5].includes(P.arms) && P.twist >= 2.2 && P.twist <= 10.5
  && P.core >= 0.08 && P.core <= 0.16 && P.bar >= 0 && P.bar <= 0.8 && P.temp >= 0 && P.temp <= 1
  && P.pal >= 0 && P.pal < GALAXY_PALETTES.length);
check('params deterministic', JSON.stringify(galaxyParams(7)) === JSON.stringify(galaxyParams(7)));
check('cores are small for every seed', [...Array(200).keys()].every((s) => galaxyParams(s).core <= 0.16));
const arms = new Set([...Array(40).keys()].map((s) => galaxyParams(s).arms));
check(`seeds reach more than one arm count (${[...arms].join(',')})`, arms.size >= 3);

console.log('layout:');
const one = galaxyLayout(4414, 1), eight = galaxyLayout(4414, 8);
check('one galaxy is the home galaxy at the tuned placement', one.length === 1 && one[0].seed === 4414
  && Math.abs(one[0].dist - Math.hypot(...HOME_GALAXY.dir)) < 1e-9 && one[0].tilt === HOME_GALAXY.tilt);
check('eight galaxies, the first still home', eight.length === 8 && eight[0].seed === 4414);
check('every extra galaxy has its own seed', new Set(eight.map((g) => g.seed)).size === 8);
let apart = true;
for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
  const a = eight[i].dir, b = eight[j].dir;
  if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= Math.cos(0.6)) apart = false;
}
check('no two galaxies within ~35° of each other', apart);
check('directions are unit vectors, distances beyond the home disc', eight.every((g) => Math.abs(Math.hypot(...g.dir) - 1) < 1e-9)
  && eight.slice(1).every((g) => g.dist >= 24 && g.dist <= 54));
check('layout is deterministic', JSON.stringify(galaxyLayout(9, 5)) === JSON.stringify(galaxyLayout(9, 5)));

if (failures) { console.error(`galaxyseed: ${failures} FAILED`); process.exit(1); }
console.log('galaxyseed: all green');

// THE BLACK HOLE NOT FAR (2026-10-06): above the base's horizon, on the far side of the sky from the home galaxy, about 47 degrees across
{
  const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); }, h = n(SKY_HOLE.dir), g = n(HOME_GALAXY.dir);
  check('the black hole well above the horizon at the pole', h[1] > 0.3);
  check('on the far side of the sky from the home galaxy', h[0] * g[0] + h[1] * g[1] + h[2] * g[2] < 0);
  const deg = 2 * Math.atan(SKY_HOLE.across / 2 / SKY_HOLE.dist) * 180 / Math.PI;
  check(`big in the sky, not the whole sky (${deg.toFixed(0)} degrees)`, deg > 35 && deg < 60);
  if (failures) { console.error(`galaxyseed: ${failures} failed`); process.exit(1); }
}
