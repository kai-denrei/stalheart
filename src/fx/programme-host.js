// ISAO KEEPS BUILDING (owner, 2026-09-16): the controller's side of Isao's build programme, moved out of the controller's storyApi
// unchanged; the controller merges these members back into storyApi. The rules are src/domain/build-programme.js (the steps in
// order, their perks, the assembly line's rebuild) and src/domain/repair-orders.js (the gate first, then the walls, between waves
// only); the steps and the repair tuning are src/content/base-programme.js. This is their composition with the controller's world:
//   perks() / hasPerk(name)  the programme's perks, for the orbital laser, the shield station and the gunship meter
//   build()                  once per unfrozen frame: the first hull's issue, the rebuilt hull, then at most one order for Isao
//                            (a repair, or the next step of the base)
//   repaired(repair)         a repair order done: the gate back to full, or the wall cell back to rock
//   printed(step)            a print order done: the step stands, and its perk switches on in the world
//
// `c` hands in the controller: its fixed objects and functions as values (PLAYER_MAX, orders, breachQueue, breachedCells,
// gunshipRig, showBrief, spawnIsao, updateHud, syncLifeContainers, rebuildAfterBreach, recomputePortalDist, adoptBays), what it
// rebinds as getters (story, playerHP, sectorRun, waveActive, dungeon, tdFullTags, storyBase, pilotMode, briefQ) and the lets
// the members write as setters (setPlayerHP, setBerths). `c` is also the first hull's host's host (src/fx/hull-issue.js
// createHullHost): it carries that host's values, getters and setters too (laserStation, shotId, deployStart, deployStep,
// leavePilot, camera, startShot, deployFramePoseFor, camA, setView; pilot, deploy, t, storyViews; setPlayerDown, setDeploy).
import { BLOCKED } from '../dungeon.js';
import { BASE_PERKS, BASE_REPAIR } from '../content/base-programme.js';
import { due as programmeDue, begin as programmeBegin, finish as programmeFinish, hasPerk as programmeHas, perks as programmePerks, rebuildDue } from '../domain/build-programme.js';
import { nextRepair } from '../domain/repair-orders.js';
import { createHullHost } from './hull-issue.js';

export function createProgrammeHost(c) {
  const { PLAYER_MAX, orders, breachQueue, breachedCells, gunshipRig, showBrief, spawnIsao, updateHud, syncLifeContainers, rebuildAfterBreach, recomputePortalDist, adoptBays } = c;
  return {
    // ISAO KEEPS BUILDING (src/content/base-programme.js, src/domain/build-programme.js): perks() and hasPerk(name) are what the
    // orbital laser, the shield station and the gunship meter consult
    perks: () => (c.story()?.programme ? programmePerks(c.story().programme) : new Set()),
    hasPerk: (name) => !!c.story()?.programme && programmeHas(c.story().programme, name),
    build: () => {
      const pg = c.story().programme, sector = c.story().sectorN ?? 0;
      // THE FIRST MÖRK ROLLS OUT OF THE STÅLHEART (src/fx/hull-issue.js): the camera runs to the door's framing with the hull
      // standing under the gantry, then it drives out as any deploy does; under a gunner it is set down outside the door
      c.story().hull?.tick(c.story().hullHost ??= createHullHost(c));
      // the assembly line rebuilds a lost hull at a sector's start
      if (rebuildDue(pg, sector) && c.playerHP() < PLAYER_MAX) { c.setPlayerHP(Math.min(PLAYER_MAX, c.playerHP() + BASE_PERKS.rebuildHulls)); syncLifeContainers(); updateHud(); }
      if (orders.some((o) => !o.worker)) return;
      // THE BACK GATE IS NEVER PRE-BUILT (owner, 2026-09-18): a static base prints nothing, except this one door, which only exists
      // once the player has held the surprise
      const backAt = c.story().backOpen ? (c.sectorRun()?.backOpenBreaches() ? 'open' : 'held') : null, ctx = { phase: c.story().beats.phase(), sector, waveActive: c.waveActive(), back: backAt };
      if (!c.story().grow && programmeDue(pg, ctx)?.gate !== 'back') return;   // the player's orders and the beats' come first
      // A WALL THAT WAS NEVER PRINTED IS NOT A HOLE (owner, 2026-09-16: "he builds ROCKS instead of WALLS ... before building the
      // gate"): story.wallCells are the PENDING wall cells, open floor until the gate step stands, so a grown base read all of them
      // as breaches at the landing and sent Isao out to "repair" them one by one — each trip tagged its cell BLOCKED and the lattice
      // drew ROCK there, before the gate. The rim is only repairable once it stands, exactly as a static stage-4 base has it from the
      // first frame
      const stood = programmeHas(pg, 'gate'), broke = stood ? (c.story().wallCells ?? []).filter((wc) => c.dungeon().tags[wc] !== BLOCKED) : [], repair = stood ? nextRepair({ gates: c.sectorRun()?.gates() ?? [], walls: broke, quiet: !c.waveActive() && (c.sectorRun()?.doorsQuiet?.() ?? true) }, BASE_REPAIR) : null;
      // ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16): between waves the door and the holes come before the next new building
      if (repair) {
        const rci = repair.kind === 'gate' ? (repair.id ? (c.story().gateCellOf?.(repair.id) ?? -1) : c.story().gateCell ?? -1) : repair.ci;
        if (rci >= 0) {
          // HIS REPAIR IS ANIMATED: the print beam rasters the door's own footprint, and the gate climbs under it
          orders.push({ kind: 'repair', repair, ci: rci, cost: 0, seconds: BASE_REPAIR[repair.kind].seconds, bed: c.story().print.repairBed(repair, BASE_REPAIR[repair.kind]) });
          spawnIsao();
          if (!c.pilotMode() && !c.briefQ()) showBrief(BASE_REPAIR.brief);
          updateHud();
          return;
        }
      }
      const step = programmeDue(pg, ctx), ci = step ? c.story().print.cellOf(step) : -1;
      if (ci < 0) return;
      programmeBegin(pg, step);
      orders.push({ kind: 'structure', ci, cost: 0, seconds: step.seconds, head: c.story().chapter?.head[step.id] ?? 0, step, bed: c.story().print.bed(step) });   // head: a tutorial chapter's start finds this print under way
      spawnIsao();
      if (!c.pilotMode() && !c.briefQ()) showBrief(step.brief);   // his line as he starts, never over a manned seat or another line
      updateHud();
    },
    // the gate back to full, or the wall cell back to rock for the swarm, the tank and the full world alike
    repaired: (repair) => {
      if (repair.kind === 'gate') c.sectorRun()?.repairGate(repair.id ?? 'gate');
      else { const rci = repair.ci; c.dungeon().tags[rci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[rci] = BLOCKED; breachedCells.delete(rci); breachQueue.push(rci); c.storyBase()?.restoreWall(rci); rebuildAfterBreach(); recomputePortalDist(); }
      updateHud();
    },
    printed: (step) => {
      c.story().print.finish(step);
      programmeFinish(c.story().programme, step);
      // THE BACK GATE STANDS: it seals its mouth through story.sealed, and its mounts beside the back lane become sockets a sentry
      // can be ordered on
      if (step.gate === 'back') { for (const sk of c.story().backSockets ?? []) c.story().socketToward[sk.cell] = sk.toward; recomputePortalDist(); }
      c.sectorRun()?.note({ type: 'print', id: step.id });   // the sector books Isao's base prints too, not only tower orders
      // the walls are rock to the swarm and the tank once they stand, in the full world too: applySector rewrites the tags from it
      if (step.walls) { for (const ci of c.story().wallCells) { c.dungeon().tags[ci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[ci] = BLOCKED; breachQueue.push(ci); } gunshipRig.forgetWalls(); rebuildAfterBreach(); recomputePortalDist(); }
      if (step.perk === 'station' && c.story().arrayPad) c.story().arrayPad.standing = true;   // the solar array's pad charges once the complex stands
      if (step.perk === 'hulls' && c.story().bayBerths) { c.setBerths(c.story().berths = c.story().bayBerths); adoptBays(c.storyBase()); }   // the bays become the berths
    },
  };
}
