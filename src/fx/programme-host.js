// ISAO KEEPS BUILDING (owner, 2026-09-16): the controller's side of Isao's build programme, moved out of the controller's storyApi
// unchanged; the controller merges these members back into storyApi. The rules are src/domain/build-programme.js (the steps in
// order, their perks, the assembly line's rebuild) and src/domain/repair-orders.js (the gate first, then the walls, between waves
// only); the steps and the repair tuning are src/content/base-programme.js. This is their composition with the controller's world:
//   perks() / hasPerk(name)  the programme's perks, for the orbital laser, the shield station and the gunship meter
//   tankReady()              the first hull handed over on the lane before the Stålheart stands
//   build(f)                 the last part of the story's tick: at most one order for Isao (a repair, or the next step of the base);
//                            f is the frame the colony's tick opened (its programme, sector and SOL's manned count)
//   repaired(repair)         a repair order done: the gate back to full, or the wall cell closed by a kit wall (not rock)
//   printed(step)            a print order done: the step stands, and its perk switches on in the world
// THE REST OF THE STORY'S TICK has its own owners since the refactor run (2026-10-07): the sky (src/fx/sky-rig.js), Isao's moments
// (src/fx/isao-moments.js), the colony's props (src/fx/colony-tick.js), the fire support (src/fx/auto-support.js), the canyon and
// the side breach (src/fx/canyon-run.js) and the ending (src/fx/ending-host.js); the controller's storyApi.build runs them in order.
//
// `c` hands in the controller: its fixed objects and functions as values (orders, breachQueue, breachedCells, gunshipRig, showBrief,
// spawnIsao, updateHud, rebuildAfterBreach, recomputePortalDist, adoptBays, laserStation, startShot, sfx), call-throughs to its
// neighbours (danger, from Isao's moments; hullHost, the first hull's host, src/fx/hull-issue.js createHullHost, one per story),
// what it rebinds as getters (story, sectorRun, waveActive, dungeon, tdFullTags, storyBase, pilotMode, briefQ, graph, cellSide,
// enemies, t, storyViews) and the lets the members write as setters (setBerths).
import { BLOCKED } from '../dungeon.js';
import { BASE_REPAIR } from '../content/base-programme.js';
import { due as programmeDue, begin as programmeBegin, finish as programmeFinish, hasPerk as programmeHas, perks as programmePerks } from '../domain/build-programme.js';
import { createArcLaunch } from './arc-launch.js';
const LAUNCH_SHOT = 22;   // seconds of the first launch's cinematic: the charge, the release, the petals unfolding
import { isaoSpeak } from './isao-voice.js';
import * as THREE from '../../vendor/three.module.js';
import { nextRepair, shotHoles, rimHoles } from '../domain/repair-orders.js';

export function createProgrammeHost(c) {
  const { orders, breachQueue, breachedCells, gunshipRig, showBrief, spawnIsao, updateHud, rebuildAfterBreach, recomputePortalDist, adoptBays } = c;
  // a point (the placer's world) stands on lattice cell ci: ci is its nearest of ci and ci's neighbours, within one cell (patchLine's owns)
  const ownCell = (ci, p) => { const g = c.graph(), u = p.clone().normalize(), d = (k) => u.distanceTo(new THREE.Vector3(...g.centers[k])); return d(ci) < c.cellSide() && g.adj[ci].every((nb) => d(nb) >= d(ci)); };
  return {
    // ISAO KEEPS BUILDING (src/content/base-programme.js, src/domain/build-programme.js): perks() and hasPerk(name) are what the
    // orbital laser, the shield station and the gunship meter consult
    perks: () => (c.story()?.programme ? programmePerks(c.story().programme) : new Set()),
    hasPerk: (name) => !!c.story()?.programme && programmeHas(c.story().programme, name),
    // THE NUKE'S TANK (src/domain/story-beats.js tankAfterNuke): the MK-9 blasts so far, and the hull handed over on the lane before
    // the Stålheart stands (src/fx/hull-issue.js early)
    tankReady: () => { const s = c.story(); return !!s?.hull?.early(s.hullHost ??= c.hullHost(), s.nukeBerth?.(s.nukes.at(-1) ?? -1)); },
    build: (f) => {
      const s = c.story(), { pg, sector, manned } = f;
      if (orders.some((o) => !o.worker)) return;
      // THE BACK GATE IS NEVER PRE-BUILT (owner, 2026-09-18): a static base prints nothing, except this one door, which only exists
      // once the player has held the surprise
      const backAt = c.story().backOpen ? (c.sectorRun()?.backOpenBreaches() ? 'open' : 'held') : null, ctx = { phase: c.story().beats.phase(), sector, waveActive: c.waveActive(), back: backAt, manned };
      // A WALL THAT WAS NEVER PRINTED IS NOT A HOLE (owner, 2026-09-16: "he builds ROCKS instead of WALLS ... before building the
      // gate"): story.wallCells are every wall cell (open floor on a grown base until the gate step stands), so a grown base read all of them
      // as breaches at the landing and sent Isao out to "repair" them one by one — each trip tagged its cell BLOCKED and the lattice
      // drew ROCK there, before the gate. The rim is only repairable once it stands, exactly as a static stage-4 base has it from the
      // first frame
      // and the holes a shell blew through the base's rock (src/domain/repair-orders.js shotHoles), the back door's mouth excepted
      const holesShot = () => { const st = c.story(), m = st.backMouth; return st.shot?.size ? shotHoles({ shot: st.shot, keep: m ? new Set([...(m.cells ?? []), ...(m.flank ?? [])]) : null, open: (ci) => c.dungeon().tags[ci] !== BLOCKED, centers: c.graph().centers, heart: c.dungeon().heart, rim: st.wallCells ?? [], margin: BASE_REPAIR.shotMargin * c.cellSide() }) : []; };
      // and the rock blown open beside a rim wall (src/domain/repair-orders.js rimHoles): the doors, the back mouth and the canyon's cut kept
      const holesBeside = () => { const st = c.story(), m = st.backMouth, keep = new Set([st.gateCell, st.gateCellOf?.('back'), ...(m?.cells ?? []), ...(m?.flank ?? []), ...(st.carved ?? [])].filter((x) => Number.isInteger(x) && x >= 0)); return rimHoles({ walls: st.wallCells ?? [], adj: c.graph().adj, open: (ci) => c.dungeon().tags[ci] !== BLOCKED, wasRock: (ci) => breachedCells.has(ci), keep }); };
      const lanes = new Set(c.sectorRun()?.lanes?.() ?? []);   // an open side breach's lane stays open until its waves are out (src/fx/sector-run.js lanes)
      const stood = programmeHas(pg, 'gate'), broke = stood ? [...new Set([...(c.story().wallCells ?? []), ...(c.story().backHoles ?? [])].filter((wc) => c.dungeon().tags[wc] !== BLOCKED).concat(c.storyBase()?.droppedCells?.() ?? [], holesShot(), holesBeside()))].filter((ci) => !lanes.has(ci)) : [],   // a burned segment on standing rock is a hole too (owner, 2026-10-02: "after a breach, isao only builds a gate, he should also build walls")
       near = (ci) => { const p = c.graph().centers[ci], r = BASE_REPAIR.clearCells * c.cellSide(); return c.enemies().some((e) => e.alive && Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1], e.pos[2] - p[2]) < r); };
      // HIS CHECK (BASE_REPAIR.check): after a wall he hovers over it, then says whether the breach is sealed; nothing new starts meanwhile
      if (s.checking) { if (c.t() < s.checking.until) return; s.checking = null; c.callout?.(broke.length ? BASE_REPAIR.open : BASE_REPAIR.sealed, broke.length ? 'co-victory-sub' : 'co-victory'); }
      const repair = stood ? nextRepair({ gates: c.sectorRun()?.gates() ?? [], walls: broke, quiet: !c.waveActive() && (c.sectorRun()?.doorsQuiet?.() ?? true), clear: (ci) => !near(ci) }, BASE_REPAIR) : null;
      // ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16): between waves the door and the holes come before the next new building
      if (repair) {
        const rci = repair.kind === 'gate' ? (repair.id ? (c.story().gateCellOf?.(repair.id) ?? -1) : c.story().gateCell ?? -1) : repair.ci;
        if (rci >= 0) {
          // HIS REPAIR IS ANIMATED: the print beam rasters the door's own footprint, and the gate climbs under it
          orders.push({ kind: 'repair', repair, ci: rci, cost: 0, seconds: BASE_REPAIR[repair.kind].seconds, bed: c.story().print.repairBed(repair, BASE_REPAIR[repair.kind]) });
          spawnIsao(); isaoSpeak('repair_underway');   // ADAPT. IMPROVISE. OVERCOME (owner, 2026-10-07, lab 138: 'when ISAO is fixing breaches'), resting between orders
          if (!c.pilotMode() && !c.briefQ()) showBrief(BASE_REPAIR.brief);
          updateHud();
          return;
        }
      }
      // a static base holds nothing pending but the back door and the colony's steps (2026-10-01), so what is due is what prints
      const step = programmeDue(pg, ctx), ci = step ? c.story().print.cellOf(step) : -1;
      if (ci < 0) return;
      programmeBegin(pg, step);
      orders.push({ kind: 'structure', ci, cost: 0, seconds: step.seconds, head: c.story().chapter?.head[step.id] ?? 0, step, bed: c.story().print.bed(step) });   // head: a tutorial chapter's start finds this print under way
      spawnIsao();
      if (!c.pilotMode() && !c.briefQ()) showBrief(step.brief);   // his line as he starts, never over a manned seat or another line
      updateHud();
    },
    // THE SIDE BREACH (src/domain/side-breach.js, sector 5): where it can come up outside the gate's wall, and the wall it breaks
    // the gate back to full, or the wall cell closed for the swarm, the tank and the full world alike: drawn as floor with its kit
    // segments standing again (dungeon.mended, src/fx/board-surface.js), so what he printed reads as a wall and not a rock
    repaired: (repair) => {
      if (repair.kind === 'gate') { c.sectorRun()?.repairGate(repair.id ?? 'gate'); if (!repair.id) c.storyBase()?.restoreWall(-1); }   // and the segments on the door's own cell
      // a hole with kit walls of its own is drawn as floor under them; a shell's or the rim's hole gets a run of segments on the rim's
      // line through it, a back shoulder the door's line of segments, where the line crosses it (story-base patchWall, patchLine), else
      // it is rock again
      else { const rci = repair.ci, printed = (c.story().backHoles ?? []).includes(rci) ? !!c.storyBase()?.patchLine?.(rci, 'back', (p) => ownCell(rci, p)) : !(c.story().wallCells ?? []).includes(rci) && !!c.storyBase()?.patchWall?.(rci, c.graph().centers[rci], (p) => ownCell(rci, p)), walled = printed || (c.story().wallCells ?? []).includes(rci); /* a hole that was rock comes back as a wall (story-base patchWall) */ if (walled && c.dungeon().tags[rci] !== BLOCKED) (c.dungeon().mended ??= new Set()).add(rci); c.dungeon().tags[rci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[rci] = BLOCKED; breachedCells.delete(rci); c.story().shot?.delete(rci); breachQueue.push(rci); c.storyBase()?.restoreWall(rci); rebuildAfterBreach(); recomputePortalDist(); c.story().checking = { ci: rci, until: c.t() + BASE_REPAIR.check }; }
      updateHud();
    },
    printed: (step) => {
      c.story().print.finish(step);
      c.story().lapse?.shoot(String(step.label ?? step.id).toUpperCase());
      programmeFinish(c.story().programme, step);
      // THE BACK GATE STANDS: it seals its mouth through story.sealed, and its mounts beside the back lane become sockets a sentry
      // can be ordered on
      // AND THEN HE CHECKS THE MOUTH (owner, 2026-10-03: "he only fixes one gate, with openings left and right; he needs to do a check. Is it
      // fully secure again? If not: build walls"): every cell the back collapse opened that the door does not cover goes on his repair book
      // THE DOOR STANDS ON THE MOUTH ONLY (owner, 2026-10-06: "a gate only, no walls at its sides closing the area flush with the natural
      // rock"): the plan's door cells are the whole collapse, so they seal the flank to the swarm, but nothing stood there and the book
      // above came out empty. The flank is his: a kit wall on each shoulder, out to the rock
      if (step.gate === 'back') { for (const sk of c.story().backSockets ?? []) c.story().socketToward[sk.cell] = sk.toward; const m = c.story().backMouth; if (m) c.story().backHoles = m.flank.filter((ci) => !m.cells.includes(ci)); recomputePortalDist(); }
      c.sectorRun()?.note({ type: 'print', id: step.id });   // the sector books Isao's base prints too, not only tower orders
      // the walls are rock to the swarm and the tank once they stand, in the full world too: applySector rewrites the tags from it
      if (step.walls) { for (const ci of c.story().wallCells) { c.dungeon().tags[ci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[ci] = BLOCKED; breachQueue.push(ci); } gunshipRig.forgetWalls(); rebuildAfterBreach(); recomputePortalDist(); }
      if (step.perk === 'station' && c.story().arrayPad) c.story().arrayPad.standing = true;   // the solar array's pad charges once the complex stands
      if (step.perk === 'hulls' && c.story().bayBerths) { c.setBerths(c.story().berths = c.story().bayBerths); adoptBays(c.storyBase()); }   // the bays become the berths
      // THE ARC-01 STANDS: SOL-88 goes up on its sled (src/fx/arc-launch.js), and when the insertion stage is lit SOL fires on its own
      if (step.perk === 'launcher') {
        const root = c.storyBase()?.structure?.(step.structures[0])?.root ?? null;
        // THE FIRST LAUNCH IS A CINEMATIC (owner, 2026-10-02: "launching the automated SOL is a key moment, let's have a small cinematic of
        // the first satellite launch, with Isao explaining"): a camera beside the rail follows the sled and the payload up for LAUNCH_SHOT
        // seconds while Isao narrates the phases; skippable, and never over a manned seat
        const say = { charging: 'sol88_charge' };   // the release is Isao's TO INFINITY! and BEYOND! (owner, 2026-10-07, lab 120: 'when we launch the first satellite')
        c.story().launch = createArcLaunch({ launcher: root, now: () => c.t(), sfx: c.sfx, onPhase: (ph) => { if (ph === 'released') isaoSpeak('sol88_liftoff', { force: true }); if (say[ph]) showBrief(say[ph]); }, onComplete: () => { c.laserStation?.setAuto?.(true); c.story().sol88 = true; c.story().launch = null; c.sectorRun()?.note({ type: 'launch', id: 'sol88' }); if (!c.pilotMode() && !c.briefQ()) showBrief('sol88_online'); updateHud(); } });
        if (root && c.startShot && !c.pilotMode() && !c.laserStation?.seated?.() && !c.danger()) {   // never over the hull in a crowd (STORY_CALM)
          const L = root.getWorldPosition(new THREE.Vector3()), n = L.clone().normalize(), m = c.cellSide() / 10;
          const side = new THREE.Vector3().setFromMatrixColumn(root.matrixWorld, 0).normalize(), fwd = new THREE.Vector3().setFromMatrixColumn(root.matrixWorld, 2).normalize();
          // behind the breech on the base side, a little off the rail and above it, looking down the rail the way the payload flies
          const eye = L.clone().addScaledVector(fwd, -34 * m).addScaledVector(side, 9 * m).addScaledVector(n, 8 * m), look = new THREE.Vector3(), cam = new THREE.PerspectiveCamera();   // a camera: Object3D.lookAt aims +Z, a camera aims -Z
          c.storyViews?.()?.active?.('tank');
          c.startShot({ id: 'sol88Launch', dur: LAUNCH_SHOT, poseAt: (u, out) => {
            c.story().launch?.focus(look);
            const lift = Math.min(1, Math.max(0, (u - 0.4) / 0.6));   // as the payload climbs the camera rises and pulls back with it
            out.pos.copy(eye).addScaledVector(n, lift * 30 * m).addScaledVector(fwd, -lift * 24 * m).addScaledVector(side, lift * 16 * m);
            cam.position.copy(out.pos); cam.up.copy(n); cam.lookAt(look); out.quat.copy(cam.quaternion);
          } });
        }
      }
    },
  };
}
