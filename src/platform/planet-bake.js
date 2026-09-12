// Fetches the baked story planet once per page and hands it to whoever builds
// the world. A missing or stale bake is null: the planet is then built live.
import { decodePlanetBake } from '../core/planet-bake.js';
import { STORY_RECIPE } from '../content/story-defaults.js';
export const PLANET_BAKE_URL = 'assets/story/planet.bin';
let bake = null, pending = null;
export function loadPlanetBake(url = PLANET_BAKE_URL) {
  if (!pending) pending = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => { bake = buf ? decodePlanetBake(new Uint8Array(buf), STORY_RECIPE) : null; return bake; }).catch(() => (bake = null));
  return pending;
}
export const planetBake = () => bake;
