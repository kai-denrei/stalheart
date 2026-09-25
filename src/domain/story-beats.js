// The opening's scripted beats in the story world. Pure: the host supplies
// a small API and calls tick with the sim delta; the beats decide what
// happens next.
//   landed        Isao out: "rough landing", then "so much to build". With `arrival` (src/fx/arrival.js plays the landing in the game,
//                 and the lines are its own) nothing is said or deployed here: the arrival calls deploy(api) on its cut to his face
//   foundry       (with a foundry tune) Isao deploys the AFR-01; the arm cuts the SH02; the first barrel is the Rotor's feedstock
//   printing      Isao prints the Rotor on the wall beside the tunnel mouth
//   rotor-ready   the sentry stands
//   tremor        a contact on the radar, far out (gated worlds only)
//   breach        the ground opens from orbit; fodder starts to emerge
//   approach      fodder walks up the lane until one reaches the closed gate
//   override      Isao: not ready for auto-targeting, manual override
//   piloting      the player has the Rotor; fodder keeps coming, capped
//   cleared       the first wave is down: Isao's line, and the views unlock (tank, sentry, map)
//   quiver-*      Isao prints the Quiver across the lane the moment the gate stands (2026-09-24: ahead of the Stålheart's long print
//                 in his queue), so it stands while the first wave is fought; the moment the wave is down a hard core rises and the
//                 player goes straight from the Rotor into the Quiver's optic (owner, 2026-09-13: almost immediate); a second hard
//                 core later; two TALON shots, then construction (or settled when the Stålheart already stands)
//   construction  SECTOR 0 (owner, 2026-09-24): the Stålheart is still printing, so its construction is defended. The gunship
//                 arrives from orbit once; a wave rises from the sinkhole every `construction.every` seconds, cycling through the
//                 table (held back while `alive` stand); once the host's stalheartStands() (its first hull out) and the field is down
//                 to `mopUp`, settled. Only a growing base passes a table
//   study-talk    a close-up of Isao saying it, face neutral, skeptical, then to work (owner, 2026-09-13)
//   study         Isao's screen, retitled: Preliminary Alien Vibration Language Analysis
//   expedition    the screen closed: Isao sends the tank for material at the other rocket landing sites, the planet pulled back
//                 and the sites marked on the radar
import { makeFoundry, deployFoundry, stepFoundry, foundryState, skipFoundry } from './foundry.js';
import { STORY_PHASES } from './automation.js';
export function makeStoryBeats({
  socket, foundry = null, lane = -1, fodder = -1, gate = -1, rotorDelay = 2, key = 'rotor',
  fodderType = 'amoeba', fodderEvery = 2.5, fodderAlive = 8, fodderTotal = 20, fodderEmerge = null,
  controlDelay = 1.5, tremorDelay = 1.5, breachDelay = 4, overrideDelay = 2.5, spawnDelay = 1, overrideCells = 2.2,
  faceDelays = [0.6, 4], commsKills = 5, harvestKills = 10, quiverSocket = -1, quiver = null, startPhase = 'landed',
  gateReady = () => true,   // a growing base: the tremor waits for Isao to print the gate (src/content/base-programme.js)
  construction = null,      // a growing base: the waves that come while the Stålheart prints (src/content/story-defaults.js STORY_CONSTRUCTION)
  arrival = false,          // the landing plays in the game (src/fx/arrival.js): `landed` waits for its deploy(api)
  foundryCut = null,        // a tutorial chapter's start: the rocket sections the AFR-01 has already cut (src/content/story-defaults.js STORY_CHAPTERS)
}) {
  const gated = gate >= 0 && fodder >= 0;
  // THE FOUNDRY PAYS (owner, 2026-09-14): with a foundry tune the grants are barrels of feedstock cut from the rocket, not conjured
  const fd = foundry ? makeFoundry(foundry) : null;
  let quiverOrdered = false, cWaves = 0, cSent = 0, studyDelay = quiver?.studyDelay ?? 3, upAt = null;
  // the beats pay for the Quiver and put it on Isao's book, once; a refused order is tried again at the override and at the clear
  const orderQuiver = (api) => { if (quiverOrdered || !quiver || quiverSocket < 0) return; api.grant(api.cost(quiver.key)); quiverOrdered = !!api.order(quiver.key, quiverSocket); };
  // a construction wave: the next row of the table, from the sinkhole (reopened if a strike filled it), risen over `stagger` seconds
  const constructionWave = (api) => {
    const row = construction.waves[cWaves % construction.waves.length]; cWaves++;
    if (api.sourceAlive && !api.sourceAlive()) api.breach?.(fodder);
    let k = 0;
    for (const e of row) for (let i = 0; i < e.count; i++, k++) api.spawn(e.type, fodder, { harmless: construction.harmless, spread: construction.spread, pace: construction.pace, delay: ((k * 0.618034) % 1) * construction.stagger });
    cSent += k;
  };
  let phase = startPhase, clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set(), hardcores = 0, gateAt = null;
  // A LATE START (a jump past the handover): the landing faces are already said, and the views strip is offered on the first tick
  const late = startPhase !== 'landed';
  let offered = false, released = !arrival;   // an arrival holds `landed` until its cut
  if (late || arrival) faces = 2;
  const enter = (p) => { phase = p; at = clock; };
  const spawnTick = (api) => {
    if (spawned >= fodderTotal || clock < nextSpawn) return;
    if (api.enemies() < fodderAlive) { api.spawn(fodderType, fodder, fodderEmerge && { harmless: fodderEmerge.harmless, spread: fodderEmerge.spread, pace: fodderEmerge.pace, delay: ((spawned * 0.618034) % 1) * fodderEmerge.stagger }); spawned++; }   // a swarm rises over a spread of moments, golden-ratio spaced
    nextSpawn = clock + fodderEvery;
  };
  return {
    tick(dt, api) {
      clock += dt;
      // A LATE START (a tutorial chapter, a jump past the handover) does once what the beats did on the way in: the AFR-01 deployed
      // off camera with `foundryCut` sections cut; the views strip, which comes with the first wave's clear; sector 0's gunship, the
      // Quiver's seat and the delay its first wave has after the Quiver; the new hull's moment before the study; and the expedition's
      // sites, since a jump straight into it never crossed the study beat
      if (late && !offered) {
        if (fd && foundryCut != null) skipFoundry(fd, foundryCut);
        if (STORY_PHASES.indexOf(phase) >= STORY_PHASES.indexOf('cleared')) api.unlock?.('views');
        if (phase === 'construction' && construction) { api.gunshipArrive?.(); if (quiverSocket >= 0) api.pilot?.(quiverSocket, lane); nextSpawn = clock + (construction.first ?? construction.every); }   // the player is still in the Quiver's optic there
        if (phase === 'settled') studyDelay = construction?.studyDelay ?? studyDelay;
        if (phase === 'expedition') api.expeditionsBegin?.();
        offered = true;
      }
      // Isao's two faces play over the landing, whatever else is happening: the angry one the moment he is out of the hatch
      if (faces === 0 && clock >= faceDelays[0] && api.isao()) { api.brief?.('rough_landing'); faces = 1; }
      else if (faces === 1 && clock >= faceDelays[1]) { api.brief?.('so_much_to_build'); faces = 2; }
      if (fd) for (const e of stepFoundry(fd, dt, foundry)) { api.foundry?.(typeof e === 'string' ? e : e.ev, typeof e === 'string' ? null : e); if (e === 'barrel') api.grant(foundry.feedstockPerBarrel); }
      if (phase === 'landed' && fd && released && faces === 2 && clock >= rotorDelay) { api.foundry?.(deployFoundry(fd), null); api.brief?.('foundry_deploy'); enter('foundry'); }
      else if (phase === 'foundry' && fd.barrels >= 1) { if (api.order(key, socket)) { enter('printing'); orderedAt = clock; } }
      else if (phase === 'landed' && !fd && released && clock >= rotorDelay) {
        api.grant(api.cost(key));
        if (api.order(key, socket)) { enter('printing'); orderedAt = clock; }
      } else if (phase === 'printing' && api.built(socket)) { enter('rotor-ready'); readyAt = clock; }
      else if (phase === 'rotor-ready' && gated && gateAt === null) { if (gateReady()) { gateAt = clock; orderQuiver(api); } }   // THE TREMOR WAITS FOR THE GATE: no fodder before it stands; the Quiver goes on the book with it
      else if (phase === 'rotor-ready' && clock - Math.max(at, gateAt ?? at) >= (gated ? tremorDelay : controlDelay)) {
        if (gated) { api.tremor?.(fodder); api.brief?.('tremor'); enter('tremor'); }
        else { api.pilot?.(socket, lane); enter('piloting'); nextSpawn = clock + fodderEvery; }
      } else if (phase === 'tremor' && clock - at >= breachDelay) { api.breach?.(fodder); api.tremor?.(-1); enter('breach'); nextSpawn = clock + spawnDelay; }
      else if (phase === 'breach') { spawnTick(api); if (spawned > 0) enter('approach'); }
      else if (phase === 'approach') { spawnTick(api); if (api.near?.(gate, overrideCells)) { api.brief?.('manual_override'); enter('override'); } }
      else if (phase === 'override') { spawnTick(api); if (clock - at >= overrideDelay) { api.pilot?.(socket, lane); enter('piloting'); orderQuiver(api); } }   // Isao prints the Quiver while the wave is fought (normally ordered with the gate already)
      else if (phase === 'piloting' && fodder >= 0) {
        spawnTick(api);
        const kills = api.kills?.() ?? 0;
        if (kills >= commsKills && !said.has('alien_comms')) { api.brief?.('alien_comms'); said.add('alien_comms'); }
        if (kills >= harvestKills && !said.has('harvest_biomass')) { api.brief?.('harvest_biomass'); said.add('harvest_biomass'); }
        if (spawned >= fodderTotal && api.enemies() === 0) { api.brief?.('wave_cleared'); api.unlock?.('views'); said.add('wave_cleared'); enter('cleared'); }
      } else if (phase === 'cleared' && quiver && quiverSocket >= 0 && gated && clock - at >= quiver.delay) {
        if (!quiverOrdered && !api.built(quiverSocket)) { api.brief?.('quiver_intro'); if (!fd) api.grant(api.cost(quiver.key)); quiverOrdered = !!api.order(quiver.key, quiverSocket); }
        if (api.built(quiverSocket)) {   // straight off the Rotor into the Quiver, the optic on the lane as the hard core rises
          if (api.sourceAlive && !api.sourceAlive()) api.breach?.(fodder);   // a strike may have filled the sinkhole: the hard cores need it open
          api.spawn(quiver.hardcore, fodder); hardcores = 1; api.brief?.('quiver_override'); api.pilot?.(quiverSocket, lane); enter('quiver-piloting'); nextSpawn = clock + quiver.secondDelay;
        }
      }
      else if (phase === 'quiver-piloting') {
        if (hardcores < 2 && clock >= nextSpawn) { api.spawn(quiver.hardcore, fodder); hardcores = 2; }
        if (hardcores >= 2 && api.enemies() === 0) {
          api.brief?.('quiver_cleared'); said.add('quiver_cleared');
          if (construction && api.stalheartStands && !api.stalheartStands()) { enter('construction'); api.gunshipArrive?.(); nextSpawn = clock + (construction.first ?? construction.every); }
          else { enter('settled'); api.unlock?.('views'); }
        }
      } else if (phase === 'construction') {
        // THE STÅLHEART STANDS, ITS FIRST HULL IS OUT AND SECTOR 0 IS DOWN: the handover. Its last bodies are the new MÖRK's first
        // work (and the seats'): the automatic towers fire without the seat's multipliers and would take minutes over what a
        // player clears in seconds, and a live body holds every wave clock and idle print after it. No new wave once it stands.
        const up = !api.stalheartStands || api.stalheartStands();
        if (up && upAt === null) upAt = clock;
        // ...or once the hull has had `mopUpSeconds` at them: a player who drives off instead never stalls the story (unmanned towers
        // do not fire before the handover), and the harmless leftovers roll on into sector 1 as bodies to ram
        if (up && (api.enemies() <= (construction?.mopUp ?? 0) || clock - upAt >= (construction?.mopUpSeconds ?? Infinity))) { studyDelay = construction?.studyDelay ?? studyDelay; enter('settled'); api.unlock?.('views'); }   // and the hull is the player's for a moment before the study
        else if (!up && construction && clock >= nextSpawn && api.enemies() < (construction.alive ?? Infinity)) { constructionWave(api); nextSpawn = clock + construction.every; }   // a wave waits while the field is full
      } else if (phase === 'settled' && quiver && clock - at >= studyDelay) { api.closeup?.('isao'); api.brief?.('vibration_study'); said.add('vibration_study'); enter('study-talk'); }
      else if (phase === 'study-talk' && clock - at >= 0.5 && !api.briefing?.()) { api.screen?.('synthetic'); enter('study'); }   // the lines run out (or were seen before), then the screen
      else if (phase === 'study' && !api.screenOpen?.()) { api.brief?.('rocket_sites'); api.sites?.(); api.expeditionsBegin?.(); api.planetView?.(); said.add('rocket_sites'); enter('expedition'); }
    },
    // THE ARRIVAL'S CUE (src/fx/arrival.js): the landing has played and Isao has said its lines, so the AFR-01 deploys now, in this
    // call, on the cut to his face, and says nothing of its own. Once, from `landed` only; true when it released the beats
    deploy(api) {
      if (released || phase !== 'landed') return false;
      released = true;
      if (fd) { api.foundry?.(deployFoundry(fd), null); enter('foundry'); }
      return true;
    },
    phase: () => phase,
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt, readyAt, gateAt, spawned, gated, said: [...said], hardcores, foundry: fd ? foundryState(fd) : null, construction: { waves: cWaves, sent: cSent } }),
  };
}
