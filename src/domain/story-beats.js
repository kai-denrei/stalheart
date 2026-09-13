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
//   cleared       the first wave is down: Isao's line, and the views unlock (tank, sentry, map)
//   quiver-*      Isao prints the Quiver across the lane WHILE the first wave is fought; the moment the wave is down (and the Quiver
//                 stands) a hard core rises and the player goes straight from the Rotor into the Quiver's optic (owner, 2026-09-13:
//                 almost immediate); a second hard core later; two TALON shots, then settled
//   study-talk    a close-up of Isao saying it, face neutral, skeptical, then to work (owner, 2026-09-13)
//   study         Isao's screen, retitled: Preliminary Alien Vibration Language Analysis
//   expedition    the screen closed: Isao sends the tank for material at the other rocket landing sites, the planet pulled back
//                 and the sites marked on the radar
export function makeStoryBeats({
  socket, lane = -1, fodder = -1, gate = -1, rotorDelay = 2, key = 'rotor',
  fodderType = 'phage', fodderEvery = 2.5, fodderAlive = 8, fodderTotal = 20, fodderEmerge = null,
  controlDelay = 1.5, tremorDelay = 1.5, breachDelay = 4, overrideDelay = 2.5,
  faceDelays = [0.6, 4], commsKills = 5, harvestKills = 10, quiverSocket = -1, quiver = null,
}) {
  const gated = gate >= 0 && fodder >= 0;
  let quiverOrdered = false;
  let phase = 'landed', clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set(), hardcores = 0;
  const enter = (p) => { phase = p; at = clock; };
  const spawnTick = (api) => {
    if (spawned >= fodderTotal || clock < nextSpawn) return;
    if (api.enemies() < fodderAlive) { api.spawn(fodderType, fodder, fodderEmerge && { harmless: fodderEmerge.harmless, spread: fodderEmerge.spread, delay: ((spawned * 0.618034) % 1) * fodderEmerge.stagger }); spawned++; }   // a swarm rises over a spread of moments, golden-ratio spaced
    nextSpawn = clock + fodderEvery;
  };
  return {
    tick(dt, api) {
      clock += dt;
      // Isao's two faces play over the landing, whatever else is happening: the angry one the moment he is out of the hatch
      if (faces === 0 && clock >= faceDelays[0] && api.isao()) { api.brief?.('rough_landing'); faces = 1; }
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
      else if (phase === 'override') { spawnTick(api); if (clock - at >= overrideDelay) { api.pilot?.(socket, lane); enter('piloting'); if (quiver && quiverSocket >= 0) { api.grant(api.cost(quiver.key)); quiverOrdered = !!api.order(quiver.key, quiverSocket); } } }   // Isao prints the Quiver while the wave is fought
      else if (phase === 'piloting' && fodder >= 0) {
        spawnTick(api);
        const kills = api.kills?.() ?? 0;
        if (kills >= commsKills && !said.has('alien_comms')) { api.brief?.('alien_comms'); said.add('alien_comms'); }
        if (kills >= harvestKills && !said.has('harvest_biomass')) { api.brief?.('harvest_biomass'); said.add('harvest_biomass'); }
        if (spawned >= fodderTotal && api.enemies() === 0) { api.brief?.('wave_cleared'); api.unlock?.('views'); said.add('wave_cleared'); enter('cleared'); }
      } else if (phase === 'cleared' && quiver && quiverSocket >= 0 && gated && clock - at >= quiver.delay) {
        if (!quiverOrdered) { api.brief?.('quiver_intro'); api.grant(api.cost(quiver.key)); quiverOrdered = !!api.order(quiver.key, quiverSocket); }
        if (api.built(quiverSocket)) {   // straight off the Rotor into the Quiver, the optic on the lane as the hard core rises
          if (api.sourceAlive && !api.sourceAlive()) api.breach?.(fodder);   // a strike may have filled the sinkhole: the hard cores need it open
          api.spawn(quiver.hardcore, fodder); hardcores = 1; api.brief?.('quiver_override'); api.pilot?.(quiverSocket, lane); enter('quiver-piloting'); nextSpawn = clock + quiver.secondDelay;
        }
      }
      else if (phase === 'quiver-piloting') {
        if (hardcores < 2 && clock >= nextSpawn) { api.spawn(quiver.hardcore, fodder); hardcores = 2; }
        if (hardcores >= 2 && api.enemies() === 0) { api.brief?.('quiver_cleared'); api.unlock?.('views'); said.add('quiver_cleared'); enter('settled'); }
      } else if (phase === 'settled' && quiver && clock - at >= (quiver.studyDelay ?? 3)) { api.closeup?.('isao'); api.brief?.('vibration_study'); said.add('vibration_study'); enter('study-talk'); }
      else if (phase === 'study-talk' && clock - at >= 0.5 && !api.briefing?.()) { api.screen?.('synthetic'); enter('study'); }   // the lines run out (or were seen before), then the screen
      else if (phase === 'study' && !api.screenOpen?.()) { api.brief?.('rocket_sites'); api.sites?.(); api.planetView?.(); said.add('rocket_sites'); enter('expedition'); }
    },
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt, readyAt, spawned, gated, said: [...said], hardcores }),
  };
}
