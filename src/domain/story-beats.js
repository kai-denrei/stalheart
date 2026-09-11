// The opening's scripted beats in the story world. Pure: the host supplies
// a small API and calls tick with the sim delta; the beats decide what
// happens next.
//   landed        Isao out: "rough landing", then "so much to build"
//   printing      Isao prints the Rotor on the wall beside the tunnel mouth
//   rotor-ready   the sentry stands
//   tremor        a contact on the radar, far out (gated worlds only)
//   breach        the ground opens from orbit; fodder starts to emerge
//   approach      fodder walks up the lane until one reaches the closed gate
//   override      Isao: not ready for auto-targeting, manual override
//   piloting      the player has the Rotor; fodder keeps coming, capped
export function makeStoryBeats({
  socket, lane = -1, fodder = -1, gate = -1, rotorDelay = 2, key = 'rotor',
  fodderType = 'phage', fodderEvery = 2.5, fodderAlive = 8, fodderTotal = 20,
  controlDelay = 1.5, tremorDelay = 1.5, breachDelay = 4, overrideDelay = 2.5,
  faceDelays = [0.6, 4], commsKills = 5, harvestKills = 10,
}) {
  const gated = gate >= 0 && fodder >= 0;
  let phase = 'landed', clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set();
  const enter = (p) => { phase = p; at = clock; };
  const spawnTick = (api) => {
    if (spawned >= fodderTotal || clock < nextSpawn) return;
    if (api.enemies() < fodderAlive) { api.spawn(fodderType, fodder); spawned++; }
    nextSpawn = clock + fodderEvery;
  };
  return {
    tick(dt, api) {
      clock += dt;
      // Isao's two faces play over the landing, whatever else is happening
      if (faces === 0 && clock >= faceDelays[0]) { api.brief?.('rough_landing'); faces = 1; }
      else if (faces === 1 && clock >= faceDelays[1]) { api.brief?.('so_much_to_build'); faces = 2; }
      if (phase === 'landed' && clock >= rotorDelay) {
        api.grant(api.cost(key));
        if (api.order(key, socket)) { enter('printing'); orderedAt = clock; }
      } else if (phase === 'printing' && api.built(socket)) { enter('rotor-ready'); readyAt = clock; }
      else if (phase === 'rotor-ready' && clock - at >= (gated ? tremorDelay : controlDelay)) {
        if (gated) { api.tremor?.(fodder); api.brief?.('tremor'); enter('tremor'); }
        else { api.pilot?.(socket, lane); enter('piloting'); nextSpawn = clock + fodderEvery; }
      } else if (phase === 'tremor' && clock - at >= breachDelay) { api.breach?.(fodder); api.tremor?.(-1); enter('breach'); nextSpawn = clock + 1; }
      else if (phase === 'breach') { spawnTick(api); if (spawned > 0) enter('approach'); }
      else if (phase === 'approach') { spawnTick(api); if (api.near?.(gate)) { api.brief?.('manual_override'); enter('override'); } }
      else if (phase === 'override') { spawnTick(api); if (clock - at >= overrideDelay) { api.pilot?.(socket, lane); enter('piloting'); } }
      else if (phase === 'piloting' && fodder >= 0) {
        spawnTick(api);
        const kills = api.kills?.() ?? 0;
        if (kills >= commsKills && !said.has('alien_comms')) { api.brief?.('alien_comms'); said.add('alien_comms'); }
        if (kills >= harvestKills && !said.has('harvest_biomass')) { api.brief?.('harvest_biomass'); said.add('harvest_biomass'); }
      }
    },
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt, readyAt, spawned, gated, said: [...said] }),
  };
}
