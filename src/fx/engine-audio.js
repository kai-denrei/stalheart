// THE ENGINE AUDIO (moved out of src/td-tab.js, refactor round 2, 2026-10-13): the spool-up, the thruster bed and the spool-down,
// driven by the hull's actual per-frame movement, as the controller had them. updateEngine also steps the hull's feel and its bank
// (it always did: the feel is stepped where the engine's running state is known). The controller's lets are read through getters.
import { TANK_DRIVE, TANK_STEER } from '../content/tank.js';
import { steerBank } from '../domain/steer-ease.js';
import { dist3 } from '../vec3.js';
import { stepTankFeel, landTankFeel } from '../tankfeel.js';
import { FEEL } from '../feelstore.js';

export function createEngineAudio(host) {
  const { sfx, feel, player, params, steerEase, playerMesh, cellSide, paused, kick } = host;
  // --- engine: hydraulics up, thruster bed, hydraulics down ---------------
  // Three sounds, not one. A single looping sample gave starting and
  // stopping no weight at all; the hydraulics do that work and the thruster
  // just carries the middle.
  //
  // Speed comes from the ACTUAL per-frame position delta rather than from
  // the drive inputs. One site then covers manual driving, auto navigation,
  // and the handoff eased through virtualStart -- and it follows the house
  // rule of deriving render-coupled values from the render state instead of
  // re-deriving them with a second set of conventions.
  let engineHandle = null;
  let enginePrev = null;    // last frame's position
  let engineLevel = 0;      // smoothed 0..1
  let engineIdle = 0;       // s since the tank last moved
  let engineRunning = false; // has the spool-up played and not been undone?
  // short: the hydraulics-down cue should answer the STOP, not trail it
  const ENGINE_STOP = 0.10;  // s of stillness before the bed fades out


  function stopEngine(fade = ENGINE_STOP, quiet = false) {
    if (engineHandle) engineHandle.stop(fade);
    engineHandle = null;
    engineLevel = 0;
    // the rock belongs to SETTING DOWN, not to leaving the tab
    if (engineRunning && !quiet) { sfx.play('tank_spool_down'); landTankFeel(feel); }
    engineRunning = false;
  }

  function updateEngine(dt) {
    if (!playerMesh() || dt <= 0) return;
    const p = player.pos;
    if (!enginePrev) { enginePrev = p.slice(); return; }

    // cells/s, normalized against the fastest the tank can legally go
    const moved = dist3(p, enginePrev);
    enginePrev = p.slice();
    const cellsPerSec = moved / dt / cellSide();
    const top = Math.max(0.001, params.speed * 1.6 * 1.45 * TANK_DRIVE.top); // cruise+boost at a full run-up
    const target = Math.min(1, cellsPerSec / top);

    // asymmetric smoothing: spin up fast, spool down slow, like an engine
    const k = target > engineLevel ? 6 : 2.5;
    engineLevel += (target - engineLevel) * Math.min(1, k * dt);

    const moving = engineLevel > 0.03 && !paused() && !player.won;
    engineIdle = moving ? 0 : engineIdle + dt;

    // slow both ways: an engine SPOOLS. Rising a touch slower than it falls
    // reads as taking up load, then setting the weight back down.
    stepTankFeel(feel, dt, engineRunning, FEEL); feel.bank = steerBank(steerEase, TANK_STEER) + kick().roll;   /* the hull rolls into its turn (src/domain/steer-ease.js) */

    if (moving && !engineRunning) {
      sfx.play('tank_spool_up'); // hydraulics lift it off the deck
      engineRunning = true;
    }
    // RETRY every frame while moving: sfx.loop returns null until the buffer
    // has decoded, and latching a failed handle is what silenced this bed
    // for whole sessions.
    if (moving && !engineHandle) {
      engineHandle = sfx.loop('tank_thruster', { gain: 0.001, rate: 0.92 });
    }
    if (!moving && engineIdle >= ENGINE_STOP) {
      stopEngine();
    } else if (engineHandle) {
      // gain is nearly linear in level; pitch spans 0.92..1.14 so the bed is
      // felt as effort rather than heard as a repeating clip
      // floor raised from 0.18: the bed was inaudible at a crawl, so it only
      // registered at full speed — which read as "the thruster isn't there"
      engineHandle.set(0.34 + 0.66 * engineLevel, 0.92 + 0.22 * engineLevel);
    }
  }

  return { stop: stopEngine, update: updateEngine };
}
