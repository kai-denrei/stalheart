// drive.js — the game's tank drive on a flat plane (the boss lab, 2026-10-08). The lab drives in local metres on a surface
// frame's plane; this composes the game's own pure rules there, as src/fx/hull-drive.js composes them on the sphere: the steering
// ease (src/domain/steer-ease.js), the run-up (src/domain/drive-ramp.js) and the pace, with the content's TANK_DRIVE / TANK_STEER.
//
// The yaw is the lab's: yaw 0 drives +z, and +1 turn is left (the game's rotate(+θ)), so the heading is (sin yaw, cos yaw).
// The drive values are hull-drive.js's manual branch: forward 1, reverse -0.55, forward on cruise 1.45, and an engaged cruise
// rolls at 1 with no key. A cruise tap toggles it and the brake (reverse) kills it, as the game's input does (platform/tank-input.js).
//
// THE BLOCKER is the lab's test, `(x, z) -> null | { nx, nz, depth }`: a push-out direction and depth in metres. A hull that hits
// it is pushed out, stops dead and loses its run-up (a head-on scrub). Only a hull that moved is tested: a parked hull is not shoved.
import { makeDriveRamp, stepDriveRamp, scrubDriveRamp } from '../../domain/drive-ramp.js';
import { makeSteerEase, stepSteerEase, steerBank } from '../../domain/steer-ease.js';
import { TANK_DRIVE, TANK_STEER } from '../../content/tank.js';

const FORWARD = 1, REVERSE = -0.55, CRUISE_BOOST = 1.45, CRUISE_ROLL = 1;   // hull-drive.js's manual drive values
// the game's pace at ten metres a cell: params.speed (1.1 cells a second) x cellSide x 1.6
const PACE = 1.1 * 1.6 * 10;

export function createPlaneDrive({ feel, tune = { drive: TANK_DRIVE, steer: TANK_STEER, pace: PACE } } = {}) {
  const state = { x: 0, z: 0, yaw: 0, speed: 0, cruise: false };
  let ramp = makeDriveRamp(), steer = makeSteerEase();

  function step(dt, { throttle = 0, turn = 0, cruiseTap = false } = {}, blocker = null) {
    if (cruiseTap) state.cruise = !state.cruise;
    if (throttle < 0) state.cruise = false;
    const rate = stepSteerEase(steer, dt, turn, tune.steer);
    state.yaw += rate * dt;
    const dr = throttle < 0 ? REVERSE
      : throttle > 0 ? (state.cruise ? CRUISE_BOOST : FORWARD)
      : (state.cruise ? CRUISE_ROLL : 0);
    const mul = stepDriveRamp(ramp, dt, dr, turn !== 0, tune.drive);
    let v = tune.pace * dr * mul;
    state.x += Math.sin(state.yaw) * v * dt;
    state.z += Math.cos(state.yaw) * v * dt;
    const b = v !== 0 && blocker ? blocker(state.x, state.z) : null;
    if (b) {
      state.x += b.nx * b.depth; state.z += b.nz * b.depth;
      v = 0; scrubDriveRamp(ramp, 1, tune.drive);
    }
    state.speed = v;
    if (feel) feel.bank = steerBank(steer, tune.steer);
    return { moving: Math.abs(v) > 0.2 || dr !== 0, blocked: !!b };
  }

  function reset(x = state.x, z = state.z, yaw = state.yaw) {
    state.x = x; state.z = z; state.yaw = yaw; state.speed = 0; state.cruise = false;
    ramp = makeDriveRamp(); steer = makeSteerEase();
    if (feel) feel.bank = 0;
  }

  return { state, step, heading: () => [Math.sin(state.yaw), Math.cos(state.yaw)], reset };
}
