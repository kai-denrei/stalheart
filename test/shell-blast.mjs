// THE TANK SHELL'S BLAST (owner, 2026-10-13: "the tank shell should feel and be more powerful. a) give it a stronger AoE and dmg"; then "make the
// Tank Shell impact/explosion the same as the 40mm from the Gunship, more intensity, it must feel powerful"). The numbers against the 40 mm and the
// Mortar at its top tier, the falloff, the effect selection (the 40 mm's module at the shell's radius, hotter and slower, a flash pop at the core),
// and the landing as src/fx/shell-blast.js draws it.
import assert from 'node:assert/strict';
import { SHELL_BLAST } from '../src/content/tank.js';
import { EXPLOSION_USES, EXPLOSION_SCARE } from '../src/content/explosions.js';
import { GUNSHIP_GUNS } from '../src/content/gunship.js';
import { STORY_SENTRIES } from '../src/content/sentries.js';
import { METRES_PER_CELL } from '../src/core/stage-units.js';
import { TOWER_BY_KEY, MAX_TIER, effectiveStats } from '../src/towers.js';
import { shellHits } from '../src/domain/shell-blast.js';
import { createShellBlast } from '../src/fx/shell-blast.js';
import { createExplosions } from '../src/fx/explosions.js';
import { dist3 } from '../src/vec3.js';
import * as boforsBurst from '../src/fx/explosions/bofors-burst.js';
import * as rotaryPop from '../src/fx/explosions/rotary-pop.js';

const bofors = GUNSHIP_GUNS.bofors, mortarMax = effectiveStats(TOWER_BY_KEY.mortar, MAX_TIER);
const burstMetres = (use) => EXPLOSION_USES[use].scale * { 'bofors-burst': boforsBurst.meta.radiusM, 'rotary-pop': rotaryPop.meta.radiusM }[EXPLOSION_USES[use].module];

// THE AREA: up to the 40 mm's own burst, and the burst drawn at the shell's radius (the visual is the damage)
assert.ok(SHELL_BLAST.radius > bofors.blastCells, `wider than the 40 mm's damage (${SHELL_BLAST.radius} vs ${bofors.blastCells} cells)`);
assert.ok(SHELL_BLAST.radius * METRES_PER_CELL <= burstMetres('gunship.bofors') * 1.02, `no wider than the 40 mm's visible burst (${burstMetres('gunship.bofors')} m)`);
assert.ok(Math.abs(burstMetres('tank.blast') / (SHELL_BLAST.radius * METRES_PER_CELL) - 1) < 0.05, `the shell's burst is drawn at its radius (${burstMetres('tank.blast')} m)`);
assert.ok(SHELL_BLAST.radius >= mortarMax.splash * 0.95, 'and about the Mortar at its top tier');
// THE DAMAGE: the 40 mm's falloff from a higher peak (the tank's strongest single hit), short of the Thorus's 5 hp on a direct hit
assert.ok(SHELL_BLAST.peak > bofors.damage && SHELL_BLAST.peak < 5, `peak ${SHELL_BLAST.peak}`);
assert.ok(SHELL_BLAST.peak > mortarMax.dmg * STORY_SENTRIES.dmgMul * 4, 'far over a Mortar max shell');
const areaDamage = (peak, r) => peak * Math.PI * r * r / 2;   // peak (1 - u^2) over the disc
assert.ok(areaDamage(SHELL_BLAST.peak, SHELL_BLAST.radius) < areaDamage(bofors.damage, bofors.blastCells) * bofors.magazine * 0.5, 'a shell is under half a 40 mm magazine');
// stronger than it was everywhere it reached: was 4 struck, 2 within 1 cell, 1 within 2 cells
const at = (d) => shellHits([{ alive: true, pos: [d, 0, 0] }], [0, 0, 0], null, SHELL_BLAST, 1, dist3)[0]?.dmg ?? 0;
assert.ok(at(0.99) > 2 && at(1.99) > 1 && at(2.5) > 0 && at(SHELL_BLAST.radius) === 0, `stronger at the old rings (${at(0.99).toFixed(2)}, ${at(1.99).toFixed(2)}, ${at(2.5).toFixed(2)})`);

// the domain rule: the struck body the peak, the rest the falloff, the dead and the far untouched, the radius in cells
{
  const bodies = [[0.2, 0, 0], [1.5, 0, 0], [2.9, 0, 0], [3.2, 0, 0]].map((pos) => ({ alive: true, pos }));
  bodies.push({ alive: false, pos: [0.1, 0, 0] });
  const hits = shellHits(bodies, [0, 0, 0], bodies[0], { radius: 3, peak: 4.5 }, 1, dist3);
  assert.deepEqual(hits.map((h) => bodies.indexOf(h.e)), [0, 1, 2]);
  assert.equal(hits[0].dmg, 4.5);
  assert.ok(Math.abs(hits[1].dmg - 4.5 * (1 - 0.25)) < 1e-9);
  const scaled = shellHits([{ alive: true, pos: [0.15, 0, 0] }], [0, 0, 0], null, { radius: 3, peak: 4.5 }, 0.1, dist3);
  assert.ok(Math.abs(scaled[0].dmg - 4.5 * 0.75) < 1e-9);
  // the body's drawn point (2026-10-16): a record far off whose body stands in the blast is hit; a record in the blast whose body has hopped away is not
  const drawn = [{ alive: true, pos: [9, 0, 0], obj: { userData: { point: () => [1.5, 0, 0] } } }, { alive: true, pos: [1.5, 0, 0], obj: { userData: { point: () => [9, 0, 0] } } }];
  const byBody = shellHits(drawn, [0, 0, 0], null, { radius: 3, peak: 4.5 }, 1, dist3, (e) => e.obj?.userData?.point?.() ?? e.pos);
  assert.deepEqual(byBody.map((h) => drawn.indexOf(h.e)), [0], 'measured where the body is drawn');
}

// THE EFFECT: the 40 mm's module, hotter and longer; its scare; a flash pop at the core
assert.equal(EXPLOSION_USES['tank.blast'].module, EXPLOSION_USES['gunship.bofors'].module);
assert.ok(EXPLOSION_USES['tank.blast'].glow > 1 && EXPLOSION_USES['tank.blast'].pace < 1, 'brighter and slower than the 40 mm');
assert.deepEqual(EXPLOSION_SCARE['tank.blast'], EXPLOSION_SCARE['gunship.bofors']);
assert.equal(EXPLOSION_USES['tank.flash'].module, 'rotary-pop');
assert.equal(EXPLOSION_SCARE['tank.flash'], undefined, 'the flash scares nothing twice');
// the rings: the 40 mm's pair (x1.6 orange, x0.7 white), held longer than its 0.7 s and 0.35 s
assert.deepEqual(SHELL_BLAST.rings.map(([hex, , k]) => [hex, k]), [[bofors.ringHex, 1.6], [0xffffff, 0.7]]);
assert.ok(SHELL_BLAST.rings[0][1] > 0.7 && SHELL_BLAST.rings[1][1] > 0.35);
assert.ok(SHELL_BLAST.rate < 0.7, 'the report under the 40 mm\'s 0.7');

// the adapter: `glow` reaches the module's fire colours over 1, the smoke untouched; `pace` slows its clock
{
  const seen = [];
  const fake = { meta: { size: 'medium' }, createExplosion: (o) => { seen.push(o.palette); let t = 0; return { object: { position: { set() {} }, quaternion: { setFromUnitVectors() {} } }, tick: (dt) => { t += dt; seen.push(t); }, alive: () => t < 1, dispose() {} }; } };
  const fx = createExplosions({ add() {} }, { modules: { 'bofors-burst': fake, 'rotary-pop': { ...fake, meta: { size: 'small' } } } });
  assert.ok(fx.spawn('tank.blast', [1, 0, 0], [1, 0, 0], 0.02));
  const pal = seen[0];
  assert.ok(pal.white.r > 1 && typeof pal.smoke === 'string', 'the flash glows over white, the smoke keeps its hex');
  fx.tick(0.1); assert.ok(Math.abs(seen.at(-1) - 0.1 * EXPLOSION_USES['tank.blast'].pace) < 1e-9, 'its clock runs at its pace');
  assert.ok(fx.spawn('gunship.bofors', [1, 0, 0], [1, 0, 0], 0.02)); assert.equal(typeof seen.at(-1).white, 'string', 'the 40 mm itself is unchanged');
}

// the landing: damage, the 40 mm's rings at the shell's radius, the two bursts, the report, the hull's jolt fading with distance
{
  const cellSide = 0.02, calls = { explode: [], ring: [], sfx: [], damage: [] };
  const enemies = [[1, 0, 0], [Math.cos(0.04), Math.sin(0.04), 0], [Math.cos(0.08), Math.sin(0.08), 0]].map((pos, i) => ({ id: i, alive: true, pos }));
  const blast = createShellBlast({
    enemies, debris: [], scene: { add() {} },
    explode: (use) => { calls.explode.push(use); return true; },
    warnRing: (ci, hex, life, r) => calls.ring.push([hex, life, +(r / cellSide).toFixed(3)]),
    sfx: { play: (name, o) => calls.sfx.push([name, o.rate]) }, camDist: () => 1,
    damageEnemy: (e, t, dmg, react, src) => calls.damage.push([e.id, dmg, react, src]),
    cellIndex: () => () => 7, cellSide: () => cellSide,
  });
  const near = blast.land([1, 0, 0], enemies[0], 0, [1, 0, 0]);
  assert.deepEqual(calls.explode, ['tank.blast', 'tank.flash']);
  assert.deepEqual(calls.ring, SHELL_BLAST.rings.map(([hex, life, k]) => [hex, life, +(SHELL_BLAST.radius * k).toFixed(3)]));
  assert.deepEqual(calls.sfx, [['blast_fire', SHELL_BLAST.rate]]);
  assert.deepEqual(calls.damage.map(([id, , react, src]) => [id, react, src]), [[0, true, 'tank'], [1, false, 'tank']]);   // 2 cells off: hurt; 4 cells off: not
  assert.equal(calls.damage[0][1], SHELL_BLAST.peak);
  assert.equal(near.jolt, SHELL_BLAST.kick.metres, 'a landing on the hull jolts it fully');
  assert.equal(blast.land([Math.cos(0.2), Math.sin(0.2), 0], null, 0, [1, 0, 0]).jolt, 0, 'ten cells off it does not');
  assert.equal(blast.last().hurt, 0);
}
console.log(`Shell blast: ${SHELL_BLAST.peak} over ${SHELL_BLAST.radius} cells (the 40 mm ${bofors.damage} over ${bofors.blastCells}, its burst ${burstMetres('gunship.bofors').toFixed(1)} m); the 40 mm's landing at the shell's radius, glow ${EXPLOSION_USES['tank.blast'].glow}, pace ${EXPLOSION_USES['tank.blast'].pace}.`);
