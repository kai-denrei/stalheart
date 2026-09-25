// THE ARRIVAL IN THE GAME, its clock (owner, 2026-09-25: "bring back the landing, short and sweet but showing the landing. Isao
// comes out, close up on his face; he's the narrator"). Pure, in metres around the landing island: x and z along the ground, y up,
// +z toward the pole. The rocket, its clips, plume, dust and scorch are the lab's timeline (src/domain/landing-sequence.js) under a
// short tune; the camera over it is a rail (src/core/rail.js); Isao's way out is his own: hidden in the hull until the door opens,
// straight up the well and over the rim through the rise, then an arc out to `to` (the host's point at his hover height) over the
// hold. `cut` is the end of that flight: the cut to his face (src/fx/arrival.js). Tune: src/content/story-defaults.js STORY_ARRIVAL.
import { makeLandingSequence } from './landing-sequence.js';
import { compileRail, smooth } from '../core/rail.js';

export function makeArrivalShot({ landing, rail, isao }) {
  const seq = makeLandingSequence(landing);
  const camera = compileRail(rail);
  const riseEnd = seq.isaoAt + landing.isao;
  const bez = (a, b, c, u) => a.map((v, i) => (1 - u) * (1 - u) * v + 2 * (1 - u) * u * b[i] + u * u * c[i]);
  // `to`: where he ends, in the same metres; the arc's control point lifts `arc` over the rim halfway out
  const isaoAt = (t, to) => {
    const s = seq.stateAt(t), up = [0, isao.from + (isao.rim - isao.from) * s.isaoRise, 0];
    if (t < riseEnd) return { visible: s.clips.Top_Door_Open !== null, pos: up, out: 0 };
    const u = smooth((t - riseEnd) / Math.max(1e-6, landing.isaoHold));
    return { visible: true, pos: bez([0, isao.rim, 0], [to[0] / 2, isao.rim + isao.arc, to[2] / 2], to, u), out: u };
  };
  return { seq, cut: seq.duration, riseEnd, stateAt: (t) => seq.stateAt(t), camera: (t) => camera.poseAt(t), isaoAt };
}
