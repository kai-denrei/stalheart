import { computeBerths, berthIndexFor } from '../src/berths.js';
import { generateSphereMesh, relax } from '../src/grid.js';
import { generateDungeon, BLOCKED } from '../src/dungeon.js';

let pass = 0;
const check = (name, cond) => {
  if (!cond) { console.log(`  FAIL ${name}`); process.exitCode = 1; }
  else { console.log(`  ok   ${name}`); pass++; }
};

console.log('berths:');

// THE ORDERING RULE (operator, 2026-09-01): the 1st tank drives out of
// Container #3, the 2nd out of #2, the last out of #1. berths[2] IS
// Container #3, so a full hull count takes the highest index and they count
// down as the run wears on. Tested because it is a rule a refactor can
// silently invert — the array is 0-based and the paint is 1-based.
check('full life picks Container #3', berthIndexFor(3) === 2);
check('two hulls picks Container #2', berthIndexFor(2) === 1);
check('last hull picks Container #1', berthIndexFor(1) === 0);
check('zero clamps to Container #1', berthIndexFor(0) === 0);
check('over-max clamps to Container #3', berthIndexFor(9) === 2);

const mesh = generateSphereMesh({ seed: 7, n: 500, k: 12 });
relax(mesh, { n_iters: 8, PULL_RATE: 0.25 });
const dungeon = generateDungeon(mesh, {
  seed: 7, rooms: 16, roomRadius: 4, extraCorridors: 8, corridorWidth: 1,
});
const graph = dungeon.graph;
const berths = computeBerths(dungeon, graph);

check('finds a three-berth chain', berths.length === 3);
check('every berth is open ground', berths.every((b) => dungeon.tags[b.ci] !== BLOCKED));
check('every berth has an exit', berths.every((b) => b.exit >= 0));
// the sealed-garage bug: a berth whose only open neighbours are its two
// siblings has nowhere to drive out to, and each of the three gets used as a
// spawn as lives run down
check('an exit is never another berth',
  berths.every((b) => !berths.some((o) => o.ci === b.exit)));
check('exits are open ground', berths.every((b) => dungeon.tags[b.exit] !== BLOCKED));
check('the chain is adjacent, in painted order',
  graph.adj[berths[0].ci].includes(berths[1].ci)
  && graph.adj[berths[1].ci].includes(berths[2].ci));
// DETERMINISM is the contract that lets the camp stay put across a reload —
// and it is what makes moving this out of the async callback safe
const again = computeBerths(dungeon, graph);
check('same board gives the same camp',
  JSON.stringify(again) === JSON.stringify(berths));

console.log(`berths: ${process.exitCode ? 'FAILURES' : 'all good'} (${pass} checks)`);

// The A6 pad spans several irregular cells. Topology alone is insufficient:
// sample every drive-out segment against the actual physical exclusion area.
for (const seed of [7, 42, 1000, 2026]) {
  const m = generateSphereMesh({ seed, n: 500, k: 12 });
  relax(m, { n_iters: 80, PULL_RATE: 0.25 });
  const d = generateDungeon(m, { seed, rooms: 16, roomRadius: 4, extraCorridors: 8, corridorWidth: 1 });
  const radius = 1.12 * 1.9 * m.defaultSide;
  const camp = computeBerths(d, d.graph, { footprintRadius: radius, cellSide: m.defaultSide });
  check(`A6 seed ${seed}: three berths`, camp.length === 3);
  for (const b of camp) {
    const a = d.graph.centers[b.ci], z = d.graph.centers[b.exit], h = d.graph.centers[d.heart];
    let safe = true;
    for (let i = 0; i <= 100; i++) {
      const p = a.map((v,k) => v + (z[k]-v)*i/100);
      const l = Math.hypot(...p);
      const distance = Math.hypot(...p.map((v,k)=>v/l-h[k]));
      if (distance < radius + m.defaultSide * .65) safe = false;
    }
    check(`A6 seed ${seed}: berth ${b.ci} drive-out clears pad`, safe);
  }
}
