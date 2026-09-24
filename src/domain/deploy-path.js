// THE DEPLOY PATH: a berth's run out of its bay and the pose it is watched from. The controller's DEPLOY beat (src/td-tab.js
// deployStart, deployStep, deployFramePoseFor) and the first hull's roll-out (src/fx/hull-issue.js) read it; the controller keeps
// the deploy's state and turns the pose into a camera.
//
// Pure: a berth is { ci, exit } on the lattice or, a story bay, { ci, exit, pos, out } with the hull's own spot inside the bay
// and the point past its doors; `centers` and `normals` are the graph's. Moved out of the game controller unchanged.
import { add3, scale3, cross3, norm3, dist3, tangentDir } from '../vec3.js';

// a berth's run: from its cell centre to its exit's, or — a story bay — from the hull's spot inside the bay straight out of the doors
export const berthRun = (b, centers) => [b.pos ?? centers[b.ci], b.out ?? centers[b.exit]];
export const berthHeading = (b, centers) => { const [f, t] = berthRun(b, centers); return tangentDir(norm3(f), f, t); };

// how far through the drive-out a deploy is: an authored clip runs on its own clock, a drive on the distance covered
export function deployU(deploy, b, centers) {
  const segLen = Math.max(1e-9, dist3(...berthRun(b, centers)));
  return Math.min(1, deploy.clip ? deploy.age / deploy.clip : deploy.travelled / segLen);
}
// eased: the camera blend and the motion share one progress value so they cannot disagree
export const easeDeploy = (u) => u * u * (3 - 2 * u);

// THE POSE THE WHOLE DESIGN HANGS OFF: a low three-quarter standing where the doors face, so the hull rolls toward the lens; an
// authored roll-out (`behind`) is watched from behind the bay, over its roof, the hull leaving toward the base. The camera's
// eye, the point it looks at and its up (the berth cell's normal).
export function deployFraming(b, centers, normals, behind, wallHeight, cellSide) {
  const bc = berthRun(b, centers)[0], bn = normals[b.ci], dir = berthHeading(b, centers);
  const eye = add3(add3(bc, scale3(bn, wallHeight * 1.7 + cellSide * (behind ? 1.2 : 0.55))),
    behind ? add3(scale3(dir, -cellSide * 2.4), scale3(cross3(bn, dir), cellSide * 0.9)) : scale3(dir, Math.max(cellSide * 2.1, dist3(...berthRun(b, centers)) + cellSide * 0.8)));
  const look = add3(behind ? add3(bc, scale3(dir, cellSide * 0.9)) : bc, scale3(bn, wallHeight * 0.55));
  return { eye, look, up: bn };
}
