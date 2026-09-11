// Which planet the game plays on. The default recipe is the pinned lane
// world; the story world is the larger polar-clearing planet with its heart
// at the pole. The controller consumes mesh, dungeon and wall height only.
import { generateSphereMesh, relax } from '../grid.js';
import { generateDungeon, bfsDist, BLOCKED } from '../dungeon.js';
import { buildStoryPlanet } from './story-planet.js';

export function buildWorld({ world = 'default', params, story = null }) {
  if (world === 'story' && story) {
    const planet = buildStoryPlanet(story.recipe, story.clearing);
    const { mesh, dungeon, graph } = planet;
    let heart = 0;
    for (let i = 1; i < graph.centers.length; i++) if (graph.centers[i][1] > graph.centers[heart][1]) heart = i;
    const open = (i) => dungeon.tags[i] !== BLOCKED;
    dungeon.heart = heart;
    dungeon.distToHeart = bfsDist(graph.adj, [heart], open);
    let spawn = heart;
    for (let i = 0; i < dungeon.distToHeart.length; i++) if (dungeon.distToHeart[i] > dungeon.distToHeart[spawn]) spawn = i;
    dungeon.spawn = spawn;
    return { world: 'story', mesh, dungeon, planet, wallHeight: story.recipe.wallMetres / planet.radius };
  }
  const mesh = generateSphereMesh({ seed: params.seed >>> 0, n: params.points, k: 12 });
  relax(mesh, { n_iters: params.relaxIters, PULL_RATE: 0.25 });
  const dungeon = generateDungeon(mesh, {
    seed: params.seed >>> 0, rooms: params.rooms, roomRadius: params.roomRadius,
    extraCorridors: params.extraCorridors, corridorWidth: params.corridorWidth,
  });
  return { world: 'default', mesh, dungeon, planet: null, wallHeight: null };
}
