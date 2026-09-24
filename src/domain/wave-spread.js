// A WAVE'S SPREAD: how far apart its bodies leave the queue. A whole wave takes `spread` seconds to come through, but never
// slower than `max` seconds a body. The board's spawner (src/td-tab.js spawnWave) and the story's sectors (src/fx/sector-run.js
// queueOf) both spread their waves with it; the numbers are the controller's SPAWN_SPREAD and SPAWN_GAP_MAX.
//
// Pure: entries are a wave plan's [{ type, count }].
export const waveCount = (entries) => entries.reduce((n, e) => n + e.count, 0);
export const waveGap = (entries, spread, max) => Math.min(max, spread / Math.max(1, waveCount(entries)));
