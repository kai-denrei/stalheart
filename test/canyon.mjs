// canyon.mjs — THE CANYON at the antipode (src/domain/canyon.js) on a small story planet: a trench of open ground with rock along both
// sides and across its deep end, its mouth on ground walked from the heart, so that once it is cut its swarm can walk to the base.
import assert from 'node:assert/strict';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planCanyon } from '../src/domain/canyon.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 6000 }, STORY_CLEARING);
const C = planet.graph.centers, adj = planet.graph.adj, tags = Uint8Array.from(planet.dungeon.tags), heart = planet.dungeon.heart;
const bfs = (t) => { const d = new Float64Array(C.length).fill(Infinity), q = [heart]; d[heart] = 0; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (t[n] !== BLOCKED && d[n] === Infinity) { d[n] = d[q[h]] + 1; q.push(n); } return d; };
let arc = 0, k = 0; for (let i = 0; i < 300; i++) for (const n of adj[i]) { arc += Math.acos(Math.max(-1, Math.min(1, C[i][0] * C[n][0] + C[i][1] * C[n][1] + C[i][2] * C[n][2]))); k++; }
const cellArc = arc / k, dist = bfs(tags), tune = { length: 14, halfWidth: 1.2, wall: 2 };
const plan = planCanyon({ centers: C, heart, dist, cellArc, tune });
assert.ok(plan, 'a canyon is found at the antipode');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
assert.ok(dot(plan.centre, C[heart]) < -0.999, 'its centre is the heart\'s antipode');
assert.ok(plan.floor.length >= tune.length && plan.rock.length > plan.floor.length, `a trench of ground in its rock (${plan.floor.length} floor, ${plan.rock.length} rock)`);
assert.ok(plan.floor.includes(plan.spawn), 'the swarm rises on its floor');
assert.ok(Number.isFinite(dist[plan.mouth]), 'its mouth is on ground walked from the heart');
assert.ok(dot(C[plan.spawn], plan.axis) < dot(C[plan.mouth], plan.axis), 'the swarm rises at the deep end, away from the mouth');
// cut it: the floor is ground, the walls rock, and the deep end walks to the heart through the mouth
for (const ci of plan.floor) tags[ci] = PATH;
for (const ci of plan.rock) tags[ci] = BLOCKED;
const after = bfs(tags);
assert.ok(Number.isFinite(after[plan.spawn]), 'once cut, the swarm can walk to the base');
assert.ok(plan.floor.every((ci) => Number.isFinite(after[ci])), 'every floor cell is reachable');
console.log(`Canyon: at the antipode, ${plan.floor.length} cells of floor in ${plan.rock.length} of rock, the deep end ${after[plan.spawn]} hops from the heart.`);
