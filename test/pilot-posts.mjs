// pilot-posts.mjs — the six practice wall posts, as the rule td-tab used
// inline. The test follows the extracted code exactly; it is a regression
// guard for the move, not a redesign.
import { choosePilotPosts } from '../src/domain/pilot-posts.js';
let failures = 0;
const check = (what, ok) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const centers = []; for (let i = 0; i < 20; i++) centers.push([i, 0, 0]);   // a line of cells, one unit apart
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
{
  const posts = choosePilotPosts({ walls: [2, 5, 6, 9, 12, 15, 18], lanes: [0], centers, cellSide: 1, chord, losClear: () => true, count: 6 });
  check('closest first', posts[0] === 5);
  check('the wall inside four cells is skipped', !posts.includes(2));
  check('the first pass keeps a cell and a half between posts', posts.slice(0, 5).every((a, i) => posts.slice(0, 5).every((b, j) => i === j || chord(centers[a], centers[b]) >= 1.5)));
  check('the spacing rule drops 6, the fallback puts it back to reach six', posts.length === 6 && posts.includes(6));
}
{
  const posts = choosePilotPosts({ walls: [2, 5, 9], lanes: [0], centers, cellSide: 1, chord, losClear: () => true, count: 6 });
  check('the fallback still skips walls inside four cells', !posts.includes(2) && posts.length === 2);
}
{
  const posts = choosePilotPosts({ walls: [5, 9], lanes: [0], centers, cellSide: 1, chord, losClear: () => false, count: 6 });
  check('no sightline: the far walls are still filled in as fallback', posts.length === 2);
  check('never empty', choosePilotPosts({ walls: [3], lanes: [0], centers, cellSide: 1, chord, losClear: () => false }).length === 1);
}
if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('pilot-posts ok');
