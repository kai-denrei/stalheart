// THE RAM BEAT'S OWN FRAMING (owner, 2026-09-24; docs/log/entries/2026-09-24-intro-four-beats-built.json, "still not
// read": the hull is not in frame during beat C). The montage's third beat is "one scene of a tank ramming 50 enemies"
// and the MÖRK is its hero, so the beat cannot borrow the GAME's chase camera: that one sits high behind the hull
// (cellSide*1.1 + wallHeight*2.6 up, cellSide*1.8 back) and looks a cell and a half AHEAD, which puts the hull at
// screen y -0.43 — the bottom fifth of the frame on desktop, and off the bottom edge once the hull has grown. The shot
// the beat wants is the opposite trade: LOW and further BACK, looking at a point only a little above the ground two
// cells ahead, so the hull rides the lower third with its nose into the frame and the bodies it is about to hit fill
// the middle.
//
// Pure arithmetic on purpose: no THREE, no camera, no world. td-tab hands it the hull's position and heading and gets
// an eye, a look point and an up back; the frame loop's own lerp toward camGoal (0.14 a frame) IS the short smoothing,
// and every placement of the hull re-snaps it, so nothing here keeps state.
import { add3, sub3, scale3, dot3, norm3, len3, cross3 } from '../vec3.js';

// the heading, flattened onto the sphere's tangent plane at the hull and normalised; any tangent will do if the hull
// has no heading yet (the first frame of a placement)
function laneDir(up, dir) {
  const flat = dir ? sub3(dir, scale3(up, dot3(dir, up))) : [0, 0, 0];
  const l = len3(flat);
  return l > 1e-9 ? scale3(flat, 1 / l) : norm3(cross3(up, [0, 1, 0]));
}

// Numbers (in cells, and in hull radii where the hull's own size has to be cleared):
//   eye   2.6 cells behind, wallHeight*1.4 + unitScale*1.1 above  -> a 22.5 deg look down onto the hull
//   look  2.2 cells ahead, wallHeight*0.8 above the ground        -> a 9.2 deg axis, hull at ndc y ~= -0.35
// which is the lower third at the 68 deg vertical field the game renders with, and leaves the band 2-5 cells ahead —
// where the beat drops its bodies — straddling the middle of the frame.
export const RAM_SHOT = { back: 2.6, lift: 1.4, hull: 1.1, ahead: 2.2, at: 0.8 };

export function ramShotPose({ pos, dir, cellSide, wallHeight, unitScale = 0 }) {
  const up = norm3(pos);
  const h = laneDir(up, dir);
  const eye = add3(add3(pos, scale3(up, wallHeight * RAM_SHOT.lift + unitScale * RAM_SHOT.hull)),
    scale3(h, -cellSide * RAM_SHOT.back));
  const look = add3(add3(pos, scale3(up, wallHeight * RAM_SHOT.at)), scale3(h, cellSide * RAM_SHOT.ahead));
  return { eye, look, up };
}

// THE BODIES GO AHEAD OF THE HULL, NOT ROUND IT. Dropped round it (what the first cut did) the hull is already among
// them on the first frame and the drive-through never reads: there is nothing in front to drive INTO. This returns the
// cells in a band `near`..`far` cells along the heading and within `width` cells of the lane, nearest first, so a drop
// lays a wall of bodies across the road the hull is on.
export function cellsAhead({ pos, dir, centers, cellSide, open = () => true },
  { near = 2, far = 5, width = 1.6 } = {}) {
  const up = norm3(pos);
  const h = laneDir(up, dir);
  const out = [];
  for (let ci = 0; ci < centers.length; ci++) {
    if (!open(ci)) continue;
    const v = sub3(centers[ci], pos);
    const along = dot3(v, h);
    if (along < near * cellSide || along > far * cellSide) continue;
    const side = sub3(sub3(v, scale3(h, along)), scale3(up, dot3(v, up)));
    if (len3(side) > width * cellSide) continue;
    out.push({ ci, along });
  }
  out.sort((a, b) => a.along - b.along);
  return out.map((x) => x.ci);
}
