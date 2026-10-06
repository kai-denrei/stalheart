// THE SQUAD ON SCREEN (src/content/sectors.js SQUADS; owner, 2026-10-05: "one unit 'representing' 5 or so, maybe elongated shape").
// One dot cloud holding `n` copies of the creature in a close clump, each member's dots in a run of its own, so a member is shed by
// drawing one run fewer (setDrawRange): still one draw call, one entity, one walk. The members are a little sparser than a single body
// (`dens`), and the clump's contact radius is `reach` times a body's: the cloud says so (`userData.reach`), and its lift is divided by
// the same so the clump floats where a body would. A body the shader animates keeps its wobble, each member on its own phase
// (`aPhase`, src/fx/dot-material.js), so the five do not pulse as one; a transform idle becomes a sway, since spinning the whole clump
// would turn it into a carousel.
// CLOSER AND STAGGERED (owner, 2026-10-06: "their clusters should be closer together and slightly staggered; otherwise how they move
// looks unnatural and unorganic"): two rows `stagger` apart, members `spacing` apart along them, each a little off its mark
import { makeDotEnemy } from '../units.js';
import { SQUADS } from '../content/sectors.js';

// where member k of n stands, in the creature's own units
export const memberAt = (k, n, tune = SQUADS) => [(k - (n - 1) / 2) * tune.spacing + ((k * 0.382) % 1 - 0.5) * 0.12, 0, (k % 2 ? 0.5 : -0.5) * tune.stagger + ((k * 0.618) % 1 - 0.5) * 0.2];
// member k's wobble phase: spread round the circle, never two alike
export const memberPhase = (k) => k * 1.9;

export function makeDotSquad(type, cols, dens = 1, n = SQUADS.size) {
  const pts = makeDotEnemy(type, cols, dens * SQUADS.dens);
  const geo = pts.geometry, P = geo.getAttribute('position'), C = geo.getAttribute('color'), per = P.count;
  const pos = new Float32Array(per * n * 3), col = new Float32Array(per * n * 3), ph = new Float32Array(per * n);
  for (let k = 0; k < n; k++) {
    const [ox, oy, oz] = memberAt(k, n);
    for (let i = 0; i < per; i++) {
      const j = (k * per + i) * 3;
      pos[j] = P.getX(i) + ox; pos[j + 1] = P.getY(i) + oy; pos[j + 2] = P.getZ(i) + oz;
      col[j] = C.getX(i); col[j + 1] = C.getY(i); col[j + 2] = C.getZ(i);
      ph[k * per + i] = memberPhase(k);
    }
  }
  geo.setAttribute('position', new P.constructor(pos, 3)); geo.setAttribute('color', new C.constructor(col, 3)); geo.setAttribute('aPhase', new P.constructor(ph, 1));
  geo.computeBoundingSphere();
  if (!pts.material.userData?.setTime) pts.userData.tick = (t) => { pts.rotation.y = Math.sin(t * 0.7) * 0.12; };
  pts.userData.squad = { per, n };
  pts.userData.reach = SQUADS.reach;
  pts.userData.lift = (pts.userData.lift ?? 0.6) / SQUADS.reach;
  return pts;
}

// a hit on a squad: the members its health no longer covers are shed (drawn no more) and returned, the last one excepted (it dies
// with the entity, through the ordinary kill). 0 for a single body
export function shedSquad(e) {
  if (!e.members) return 0;
  const left = Math.max(0, Math.ceil(e.hp / e.spec.hp - 1e-9)), lost = e.members - Math.max(1, left);
  if (lost <= 0) return 0;
  e.members -= lost;
  const s = e.obj.userData.squad; if (s) e.obj.geometry.setDrawRange(0, s.per * e.members);
  return lost;
}

// the damage `src` deals a squad: an area weapon hits every member (SQUADS.area), anything else one body's worth
export const squadDamage = (e, dmg, src) => (e.members > 1 && SQUADS.area.includes(src) ? dmg * e.members : dmg);
