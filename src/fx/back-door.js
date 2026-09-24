// THE SECOND FRONT (owner, 2026-09-16: "protect the other side of the base"): the swarm cracks the sealed mouth behind the
// bays. The mouth and the breach cells past it are src/domain/back-door.js, the omens (the rumble and the crack in sector 1,
// the back sockets ringing when Isao asks for turrets) src/fx/back-omen.js, and the sectors drive both through these storyApi
// members (src/fx/sector-run.js: backOmen, backScramble, backTick, openBackDoor, backBreachCandidates). This is the
// controller's side of it, moved out of the controller's storyApi unchanged; the controller merges it back into storyApi.
//
// `host` hands in the controller: its fixed objects and functions as values (storyApi itself, whose backFx the omen members
// call through as they did, sfx, explode, showBrief, camDist, showCallout, warnRing, breachWallCell, rebuildAfterBreach,
// recomputePortalDist, shotActive, camera, startShot) and what it rebinds as getters (story, graph, dungeon, cellSide,
// paused, deploy, pilotMode, pilot).
import * as THREE from '../../vendor/three.module.js';
import { backBreachCells } from '../domain/back-door.js';
import { createBackOmen } from './back-omen.js';
import { startDiveShot } from './dive-shot.js';

export function createBackDoor(host) {
  const { storyApi, sfx, explode, showBrief, camDist, showCallout, warnRing, breachWallCell, rebuildAfterBreach, recomputePortalDist, shotActive, camera, startShot } = host;
  return {
    // THE BACK DOOR FORESHADOWED, THEN THE SCRAMBLE: the omen presentation, built once per story on first use
    backFx: () => host.story()?.backMouth ? (host.story().omen ??= createBackOmen({
      mouth: host.story().backMouth,
      hud: host.story().hud,
      sfx,
      explode,
      brief: showBrief,
      camDist,
      centers: host.graph().centers,
      callout: (text) => showCallout(text, 'co-victory-sub'),
      ring: (ci) => warnRing(ci, 0x6fe6ff, 0.9, host.cellSide() * 1.6),
      sockets: () => host.story().backSockets ?? [],
    })) : null,
    backOmen: (o) => storyApi.backFx()?.play(o) ?? false,
    backScramble: (k) => storyApi.backFx()?.scramble(k),
    backTick: (dt) => host.story()?.omen?.tick(dt),
    // One call, idempotent: the mouth and its flanking rock come down with one rebuild. Returns the cells that fell.
    openBackDoor: () => {
      const m = host.story()?.backMouth;
      if (!m || host.story().backOpen) return 0;
      host.story().backOpen = true;
      // the back mounts face their lane from the moment it opens: the scramble wants turrets there before any gate stands
      for (const sk of host.story().backSockets ?? []) host.story().socketToward[sk.cell] = sk.toward;
      const down = [...m.cells, ...m.flank].filter((ci) => breachWallCell(ci));
      // nothing fell, nothing to rebuild: with an empty queue rebuildAfterBreach rebuilds the whole planet's surface
      if (down.length) { rebuildAfterBreach(); recomputePortalDist(); }
      for (const ci of down) explode('tank.shell', host.graph().centers[ci]);
      sfx.play('sinkhole_quake', { dist: camDist(m.dir) });
      showBrief('back_door');
      host.story().hud.tremor(null);
      host.story().hud.back(m.dir);
      // the dive shot only when nothing else owns the camera
      if (!host.paused() && !host.deploy() && !shotActive() && !host.pilotMode() && !host.pilot()?.gunship) startDiveShot({ camera, startShot, cellSide: host.cellSide() }, new THREE.Vector3(...m.dir), { id: 'backdoor', preRoll: host.story().backDoor.preRoll, hold: host.story().backDoor.hold, tail: host.story().breachShot.tail ?? 1.8, dive: host.story().backDoor.dive, fromCamera: true });
      return down.length;
    },
    backDoorOpen: () => !!host.story()?.backOpen,
    // the sector's back breaches: hops, the route once the back is open; route, the live field now
    backBreachCandidates: () => (host.story()?.backMouth ? backBreachCells(host.story().backPlanet, host.dungeon().tags, host.dungeon().heart, host.story().backMouth, host.story().backDoor).map(({ cell, hops }) => ({ cell, side: 'back', hops, route: host.dungeon().distToHeart[cell], pos: host.graph().centers[cell].slice() })) : []),
  };
}
