// Fetches the baked story planet once per page and hands it to whoever builds
// the world. A missing or stale bake is null: the planet is then built live.
// The fallback is recorded (2026-09-25): it costs the page seconds of live generation, and it used to happen without a trace.
import { decodePlanetBake } from '../core/planet-bake.js';
import { STORY_RECIPE } from '../content/story-defaults.js';
import { record } from '../diagnostics.js';
export const PLANET_BAKE_URL = 'assets/story/planet.bin';
let bake = null, pending = null;
export function loadPlanetBake(url = PLANET_BAKE_URL) {
  if (!pending) pending = fetch(url).then((r) => { if (!r.ok) record('planet.bake.fallback', { reason: `http ${r.status}` }); return r.ok ? r.arrayBuffer() : null; }).then((buf) => {
    bake = buf ? decodePlanetBake(new Uint8Array(buf), STORY_RECIPE) : null;
    if (buf && !bake) record('planet.bake.fallback', { reason: 'stale or unreadable bake' });
    return bake;
  }).catch((err) => { record('planet.bake.fallback', { reason: String(err?.message ?? err) }); return (bake = null); });
  return pending;
}
export const planetBake = () => bake;
