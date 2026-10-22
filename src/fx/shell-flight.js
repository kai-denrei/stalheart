// THE SHELLS IN FLIGHT (moved out of src/td-tab.js, refactor round 4, 2026-10-22, as the controller had it): each main-gun shell
// advanced along the sphere, nosed along its flight with a rifling spin, landed on the first body it reaches (src/fx/shell-blast.js),
// on a gate, or on the rock it breaches; spent at its reach. The arrays (projectiles, enemies, spawnPoints) are the controller's own;
// the board (cellSide, graph, dungeon, cellIndex) and the run's record (rs, wave, sectorRun) are read fresh through getters.
// host: { projectiles, enemies, spawnPoints, params, player, shellBlast, ramJolt, cellSide(), graph(), dungeon(), cellIndex(), rs(), wave(), sectorRun(),
//         groundAt, gateTakesShell, updateHud, killProjectile, checkVictory, blastWall }
import * as THREE from '../../vendor/three.module.js';
import { SHELL_SPEED, SHELL_REACH } from '../content/tank.js';
import { BLOCKED } from '../dungeon.js';
import { add3, sub3, scale3, dot3, dist3, norm3 } from '../vec3.js';

const tmpV = new THREE.Vector3(), Y_AXIS = new THREE.Vector3(0, 1, 0);

export function createShellFlight(host) {
  const { projectiles, enemies, spawnPoints, params, player, shellBlast, ramJolt, cellSide, graph, dungeon, cellIndex, rs, wave, sectorRun,
    groundAt, gateTakesShell, updateHud, killProjectile, checkVictory, blastWall } = host;
  function update(dt, tNow) {
    const side = cellSide(), run = sectorRun(), record = rs();
    const v = SHELL_SPEED * side, maxDist = SHELL_REACH * side;   // content/tank.js: the shell's pace and reach
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.pos = norm3(add3(p.pos, scale3(p.dir, v * dt)));
      const n = p.pos;
      p.dir = norm3(sub3(p.dir, scale3(n, dot3(p.dir, n))));
      p.dist += v * dt;
      const lift = 1 + params.wallHeight * 0.5;
      p.mesh.position.set(p.pos[0] * lift, p.pos[1] * lift, p.pos[2] * lift);
      // nose along flight, rifling spin about the flight axis
      tmpV.set(p.dir[0], p.dir[1], p.dir[2]);
      p.mesh.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
      p.mesh.rotateY(p.dist * 60);

      // creature contact: fodder dies to one shell, the dangerous tier
      // soaks its hp and reacts (slows / ACCELERATES) while it lasts
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist3(p.pos, groundAt(e)) < side * Math.max(0.45, (e.size ?? e.spec.size) * 0.8)) {   /* the body's drawn point, not the record's (owner, 2026-10-16: 'a direct tank shell hit goes right through') */
          // NINE shells a rack, each one precious, so each one is an EVENT (operator ruling); since 2026-10-13 the gunship's 40 mm landing
          // at the shell's blast (src/content/tank.js SHELL_BLAST, src/fx/shell-blast.js). Count what THIS shell kills: live bodies before and after
          const aliveBeforeShell = enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
          const jolt = shellBlast.land(p.pos, e, tNow, player.pos).jolt; if (jolt > 0) ramJolt.kick({ radius: jolt });   // the 40 mm's landing, hotter; a hull near it jolts (presentation only)
          if (record) {
            const killedByShell = aliveBeforeShell
              - enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
            record.shells++;
            if (killedByShell > record.bestShell.kills) record.bestShell = { kills: killedByShell, wave: wave() };
          }
          hit = true; run?.note({ type: 'shot', hit: true });
          break;
        }
      }
      // spawn points soak 3 hits; a landed shell also marks the source
      // FOUND — the minimap beacon starts pulsing
      if (!hit) {
        for (const sp of spawnPoints) {
          if (!sp.alive) continue;
          if (dist3(p.pos, graph().centers[sp.ci]) < side * 0.6) {
            hit = true; run?.note({ type: 'shot', hit: true });
            gateTakesShell(sp);
            updateHud();
            break;
          }
        }
      }
      if (hit) { killProjectile(i); checkVictory(); continue; }

      // wall impact: the shell BREACHES it — one wall per shell.
      // cellIndex is the voxel hash every other collision query on the board
      // already uses. This used to scan EVERY cell per shell per frame — with
      // three shells in the air on a 2,000-cell board that is 6,000 distance
      // checks a frame for an answer the hash gives in one lookup.
      const bestCi = cellIndex()(norm3(p.pos));
      if (bestCi !== -1 && dungeon().tags[bestCi] === BLOCKED) {
        blastWall(bestCi); run?.note({ type: 'shot', hit: false });
        killProjectile(i);
        continue;
      }
      if (p.dist > maxDist) { killProjectile(i); run?.note({ type: 'shot', hit: false }); }
    }
  }
  return { update };
}
