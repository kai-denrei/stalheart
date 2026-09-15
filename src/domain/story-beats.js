// The opening's scripted beats in the story world. Pure: the host supplies
// a small API and calls tick with the sim delta; the beats decide what
// happens next.
//   landed        Isao out: "rough landing", then "so much to build"
//   foundry       (with a foundry tune) Isao deploys the AFR-01; the arm cuts the SH02; the first barrel is the Rotor's feedstock
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
import { makeFoundry, deployFoundry, stepFoundry, foundryState } from './foundry.js';
export function makeStoryBeats({
  socket, foundry = null, lane = -1, fodder = -1, gate = -1, rotorDelay = 2, key = 'rotor',
  fodderType = 'amoeba', fodderEvery = 2.5, fodderAlive = 8, fodderTotal = 20, fodderEmerge = null,
  controlDelay = 1.5, tremorDelay = 1.5, breachDelay = 4, overrideDelay = 2.5,
  faceDelays = [0.6, 4], commsKills = 5, harvestKills = 10, quiverSocket = -1, quiver = null, startPhase = 'landed',
  gateReady = () => true,   // a growing base: the tremor waits for Isao to print the gate (src/content/base-programme.js)
}) {
  const gated = gate >= 0 && fodder >= 0;
  // THE FOUNDRY PAYS (owner, 2026-09-14): with a foundry tune the grants are barrels of feedstock cut from the rocket, not conjured
  const fd = foundry ? makeFoundry(foundry) : null;
  let quiverOrdered = false;
  let phase = startPhase, clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set(), hardcores = 0, gateAt = null;
  // A LATE START (a jump past the handover): the landing faces are already said, and the views strip is offered on the first tick
  const late = startPhase !== 'landed';
  let offered = false;
  if (late) faces = 2;
  const enter = (p) => { phase = p; at = clock; };
  const spawnTick = (api) => {
    if (spawned >= fodderTotal || clock < nextSpawn) return;
    if (api.enemies() < fodderAlive) { api.spawn(fodderType, fodder, fodderEmerge && { harmless: fodderEmerge.harmless, spread: fodderEmerge.spread, delay: ((spawned * 0.618034) % 1) * fodderEmerge.stagger }); spawned++; }   // a swarm rises over a spread of moments, golden-ratio spaced
    nextSpawn = clock + fodderEvery;
  };
  return {
    tick(dt, api) {
      clock += dt;
      if (late && !offered) { api.unlock?.('views'); if (phase === 'expedition') api.expeditionsBegin?.(); offered = true; }   // a jump straight into the expedition phase never crossed the study beat, so its sites open here
      // Isao's two faces play over the landing, whatever else is happening: the angry one the moment he is out of the hatch
      if (faces === 0 && clock >= faceDelays[0] && api.isao()) { api.brief?.('rough_landing'); faces = 1; }
      else if (faces === 1 && clock >= faceDelays[1]) { api.brief?.('so_much_to_build'); faces = 2; }
      if (fd) for (const e of stepFoundry(fd, dt, foundry)) { api.foundry?.(typeof e === 'string' ? e : e.ev, typeof e === 'string' ? null : e); if (e === 'barrel') api.grant(foundry.feedstockPerBarrel); }
      if (phase === 'landed' && fd && faces === 2 && clock >= rotorDelay) { api.foundry?.(deployFoundry(fd), null); enter('foundry'); }
      else if (phase === 'foundry' && fd.barrels >= 1) { if (api.order(key, socket)) { enter('printing'); orderedAt = clock; } }
      else if (phase === 'landed' && !fd && clock >= rotorDelay) {
        api.grant(api.cost(key));
        if (api.order(key, socket)) { enter('printing'); orderedAt = clock; }
      } else if (phase === 'printing' && api.built(socket)) { enter('rotor-ready'); readyAt = clock; }
      else if (phase === 'rotor-ready' && gated && gateAt === null) { if (gateReady()) gateAt = clock; }   // THE TREMOR WAITS FOR THE GATE: no fodder before it stands
      else if (phase === 'rotor-ready' && clock - Math.max(at, gateAt ?? at) >= (gated ? tremorDelay : controlDelay)) {
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
        if (!quiverOrdered) { api.brief?.('quiver_intro'); if (!fd) api.grant(api.cost(quiver.key)); quiverOrdered = !!api.order(quiver.key, quiverSocket); }
        if (api.built(quiverSocket)) {   // straight off the Rotor into the Quiver, the optic on the lane as the hard core rises
          if (api.sourceAlive && !api.sourceAlive()) api.breach?.(fodder);   // a strike may have filled the sinkhole: the hard cores need it open
          api.spawn(quiver.hardcore, fodder); hardcores = 1; api.brief?.('quiver_override'); api.pilot?.(quiverSocket, lane); enter('quiver-piloting'); nextSpawn = clock + quiver.secondDelay;
        }
      }
      else if (phase === 'quiver-piloting') {
        if (hardcores < 2 && clock >= nextSpawn) { api.spawn(quiver.hardcore, fodder); hardcores = 2; }
        if (hardcores >= 2 && api.enemies() === 0) { api.brief?.('quiver_cleared'); said.add('quiver_cleared'); enter('settled'); api.unlock?.('views'); }
      } else if (phase === 'settled' && quiver && clock - at >= (quiver.studyDelay ?? 3)) { api.closeup?.('isao'); api.brief?.('vibration_study'); said.add('vibration_study'); enter('study-talk'); }
      else if (phase === 'study-talk' && clock - at >= 0.5 && !api.briefing?.()) { api.screen?.('synthetic'); enter('study'); }   // the lines run out (or were seen before), then the screen
      else if (phase === 'study' && !api.screenOpen?.()) { api.brief?.('rocket_sites'); api.sites?.(); api.expeditionsBegin?.(); api.planetView?.(); said.add('rocket_sites'); enter('expedition'); }
    },
    phase: () => phase,
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt, readyAt, gateAt, spawned, gated, said: [...said], hardcores, foundry: fd ? foundryState(fd) : null }),
  };
}
