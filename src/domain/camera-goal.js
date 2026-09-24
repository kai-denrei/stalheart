// THE GAMEPLAY CAMERA'S POSES, per view: the strike's fall, riding Isao, the bastion and the tank's third person and POV. The
// controller's updateCameraGoal keeps the order the views outrank each other in (a seat, SOL-82, the deploy, a shot, the ram
// beat, then these) and turns each pose into its camera goal; the quaternion step stays there, with its scratch camera.
//
// Pure arithmetic, like src/domain/story-shots.js: every function returns an eye, a look point and an up. Moved out of the game
// controller unchanged.
import { add3, sub3, scale3, dot3, len3, dist3, norm3, cross3 } from '../vec3.js';

// riding the munition down: straight along the target cell's normal,
// altitude easing on a smoothstep — slow at first, fast near impact,
// which is what falling feels like. Shake is two incommensurate sines
// (deterministic; render-only) escalating hard past 85%.
// `c` and `nrm` are the target cell's centre and normal, `pr` the fall's progress (0..1), `st` the clock in seconds.
export function strikeFallPose(c, nrm, pr, wallHeight, cellSide, st) {
  const ez = pr * pr * (3 - 2 * pr);
  const alt = 2.6 - (2.6 - wallHeight * 3 - cellSide * 0.8) * ez;
  const shakeAmt = (0.004 + 0.012 * pr + (pr > 0.85 ? (pr - 0.85) * 0.25 : 0)) * cellSide * 8;
  const ref = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm3(cross3(nrm, ref));
  const t2 = cross3(nrm, t1);
  const sx = Math.sin(st * 47.0) * shakeAmt;
  const sy = Math.sin(st * 31.7) * shakeAmt;
  const eye = add3(scale3(nrm, 1 + alt), add3(scale3(t1, sx), scale3(t2, sy)));
  return { eye, look: c, up: t1 };
}

// RIDING ISAO. Purely a camera for now — he still flies his own
// orders, you are just on board. The point is diegetic: a free look
// over the whole shell is a strange power for a tank commander to
// have, and an obvious one for the survey drone that is already up
// there. The board answers "how are you seeing this" without a menu.
//
// Framed from behind and slightly above his rotor plane, looking
// where HE is looking: the site on the way out, the print while he
// works, his drift while he waits. That means the shot is composed by
// the job rather than by the camera, which is the whole reason to
// hang a view on a working machine instead of on a free gimbal.
// `bp` is his body's position, `up` his ground normal (isao.dir), `heading` the way he is pointed (or null), `order` his order
// ({ ci }, or null) over the lattice `centers`, `loiter` his drift point.
export function droneRidePose({ bp, up, heading, order, centers, loiter, cellSide, wallHeight }) {
  // FORWARD IS WHERE THE PILOT IS POINTING — one notion of forward,
  // shared by the stick and the lens.
  //
  // This used to be derived from the JOB (the order's cell, or
  // isao.loiter), which was right when the comment above was written and
  // this view really was only a camera riding along. Piloting arrived
  // later and the camera was never told. Two consequences, both reported
  // by the operator and both measured: steering swung
  // his heading and the view never followed (camera-swing 0.0deg, so
  // sideways felt dead), and after a turn W flew him off the BACK of the
  // screen (W-after-turn -0.92, so forward was back). With no order,
  // isao.loiter is his own position, so `sub3(aimC, up)` was literally
  // the zero vector and the frame fell through to an arbitrary tangent.
  //
  // The frame still comes from the SPHERE, not from the mesh's facing:
  // hanging it off his quaternion put the lens inside him whenever he
  // was hovering nose-down over a print, and the tangent is stable
  // through every state he has.
  let fwd;
  if (heading) fwd = heading.slice();
  else {
    const aimC = order ? norm3(centers[order.ci]) : loiter;
    fwd = sub3(aimC, up);
  }
  fwd = sub3(fwd, scale3(up, dot3(fwd, up)));   // onto the tangent plane
  const fl = len3(fwd);
  fwd = fl > 1e-6 ? scale3(fwd, 1 / fl) : norm3(cross3(up, [0, 1, 0]));
  const back = cellSide * 4.2, lift = cellSide * 1.6;
  const eye = [
    bp[0] - fwd[0] * back + up[0] * lift,
    bp[1] - fwd[1] * back + up[1] * lift,
    bp[2] - fwd[2] * back + up[2] * lift,
  ];
  // Aim BETWEEN him and the job, not at either. Aimed at the machine
  // you get a machine and no context; aimed at the site he drops out of
  // frame entirely, which is what the first cut did while he was
  // hovering directly over it. Just past him keeps both.
  const aimCi = order ? order.ci : -1;
  let look;
  if (aimCi >= 0) {
    const c = centers[aimCi];
    const top = 1 + wallHeight;
    const k = 0.45;
    look = [
      bp[0] + (c[0] * top - bp[0]) * k,
      bp[1] + (c[1] * top - bp[1]) * k,
      bp[2] + (c[2] * top - bp[2]) * k,
    ];
  } else {
    // waiting: past him along the drift, tipped down at the shell —
    // the loiter shot
    look = [
      bp[0] + fwd[0] * cellSide * 2.2 - up[0] * cellSide * 1.3,
      bp[1] + fwd[1] * cellSide * 2.2 - up[1] * cellSide * 1.3,
      bp[2] + fwd[2] * cellSide * 2.2 - up[2] * cellSide * 1.3,
    ];
  }
  return { eye, look, up };
}

// behind the anchor, facing the incoming lane (outward from the
// Heart through a watched tower; toward the nearest live portal
// when watching the Heart itself)
// `anchorCi` is the watched tower's cell or the Heart's; `portals` the spawn points ({ ci, alive }); `spawnCi` the dungeon's spawn,
// faced when no portal is alive.
export function bastionPose({ centers, normals, anchorCi, heart, spawnCi, portals, wallHeight, cellSide }) {
  const ac = centers[anchorCi];
  const an = normals[anchorCi];
  const tangentAt = (pnt, toward) => {
    const nn = norm3(pnt);
    const raw = sub3(toward, pnt);
    const flat = sub3(raw, scale3(nn, dot3(raw, nn)));
    const l = len3(flat);
    return l > 1e-9 ? scale3(flat, 1 / l) : [1, 0, 0];
  };
  let lookDir;
  if (anchorCi === heart) {
    let bp = null, bd = Infinity;
    for (const sp of portals) {
      if (!sp.alive) continue;
      const dd = dist3(ac, centers[sp.ci]);
      if (dd < bd) { bd = dd; bp = centers[sp.ci]; }
    }
    lookDir = bp ? tangentAt(ac, bp) : tangentAt(ac, centers[spawnCi]);
  } else {
    lookDir = scale3(tangentAt(ac, centers[heart]), -1); // outward
  }
  const eye = add3(add3(ac, scale3(an, wallHeight * 4 + cellSide * 2.0)),
    scale3(lookDir, -cellSide * 2.8));
  const look = add3(add3(ac, scale3(an, wallHeight)), scale3(lookDir, cellSide * 3));
  return { eye, look, up: an };
}

// THE TANK'S VIEWS: third person (`third`) or the POV. `c` is the hull's position, `h` its smoothed heading, `mobile` the phone
// shell; `dip` and `kick` the ram bump's and the recoil's eye offsets.
// suspension dip while a ram bump is live: sink the eye, ease out.
// Recoil pulls the eye straight back along the heading instead.
export function tankViewPose({ c, h, third, mobile, dip, kick, wallHeight, cellSide, unitScale }) {
  const n = norm3(c);
  let eye, look;
  if (third) {
    // behind and above; pulls back as the creature grows so it stays framed
    // the shell rides a little LOWER behind (operator: "3rd person,
    // somewhat low behind"); the desktop pose is untouched
    const lift = mobile ? 0.78 : 1;
    eye = add3(add3(c, scale3(n, (wallHeight * 2.6 + cellSide * 1.1 + unitScale * 1.8) * lift)),
      scale3(h, -(cellSide * 1.8 + unitScale * 1.6)));
    // THE LOOK POINT decides where the tank sits in the frame, not the
    // eye's height. Looking 1.4 cells AHEAD from a low eye put the tank
    // at screen-y -0.43 — the bottom fifth of a phone's short viewport,
    // under the stick and the fire pad (operator, builds 1974eb11 and
    // 2d6b2444: "I still do not see the tank — too high or too forward").
    // The shell looks nearer the tank so it rides a third up the frame;
    // the desktop keeps its look-ahead.
    const ahead = mobile ? cellSide * 0.45 : cellSide * 1.4;
    look = add3(add3(c, scale3(n, wallHeight * 0.4 + unitScale * 0.5)),
      scale3(h, ahead));
  } else {
    // pov: down IN the corridor slot, below the wall tops, along its throat
    eye = add3(add3(c, scale3(n, wallHeight * 0.62)), scale3(h, -cellSide * 0.5));
    look = add3(add3(c, scale3(n, wallHeight * 0.28)), scale3(h, cellSide * 2.4));
  }
  if (dip > 0) eye = add3(eye, scale3(n, -dip));
  if (kick > 0) eye = add3(eye, scale3(h, -kick));
  return { eye, look, up: n };
}
