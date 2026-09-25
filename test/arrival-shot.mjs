// THE ARRIVAL'S CLOCK (src/domain/arrival-shot.js) under the shipped tune: a landing that reads as one, in about eight seconds
// with the close-up (owner, 2026-09-25). The picture is src/fx/arrival.js; --grow photographs it in the game.
import assert from 'node:assert/strict';
import { STORY_ARRIVAL, SH02_WELL, STORY_SCALE } from '../src/content/story-defaults.js';
import { makeArrivalShot } from '../src/domain/arrival-shot.js';
import { BRIEFS, lineDwell } from '../src/isaobriefs.js';

const A = makeArrivalShot(STORY_ARRIVAL), L = STORY_ARRIVAL.landing, I = STORY_ARRIVAL.isao, seq = A.seq;
const to = [1.5, 18.6, 34.9];   // the host's point at his hover height, in metres around the island
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the rocket comes down from its start altitude to the ground, falling all the way, the plume lit until touchdown
assert.equal(A.stateAt(0).altitude, L.startAltitude);
assert.equal(A.stateAt(seq.touchdown).altitude, 0);
let prev = Infinity;
for (let t = 0; t <= seq.touchdown; t += 0.02) { const a = A.stateAt(t).altitude; assert.ok(a <= prev + 1e-9, `falling at ${t}`); prev = a; }
assert.ok(A.stateAt(0).plume > 0.4, 'burning from the first frame');
assert.ok(A.stateAt(seq.touchdown - 0.1).plume > 0.9 && A.stateAt(seq.touchdown + 0.01).plume === 0, 'the plume cuts at touchdown');
// the legs are out before it lands, and the door opens while the shock still plays; both clips play to their authored lengths
assert.equal(A.stateAt(seq.touchdown).clips.Legs_Deploy, L.legsDeploy, 'the legs are out on touchdown');
assert.equal(A.stateAt(seq.touchdown - 0.01).clips.Landing_Shock, null);
assert.ok(seq.doorAt > seq.touchdown && seq.doorAt < seq.touchdown + L.shockClip, 'the door opens inside the shock');
const end = A.stateAt(A.cut);
assert.equal(end.clips.Landing_Shock, L.shockClip, 'the shock plays out');
assert.equal(end.clips.Top_Door_Open, L.doorClip, 'the door is all the way open');
assert.equal(end.altitude, 0);
assert.equal(end.dust, false, 'the dust has settled by the cut');
// ISAO: in the hull until the door opens, straight up the well and over the rim, then out to the host's point without a jump
assert.equal(A.isaoAt(seq.doorAt - 0.01, to).visible, false, 'he waits in the hull');
assert.equal(A.isaoAt(seq.doorAt + 0.01, to).visible, true);
assert.equal(A.isaoAt(seq.isaoAt, to).pos[1], I.from, 'he starts at the bottom of his climb');
assert.ok(I.from < SH02_WELL.rim * STORY_SCALE.rocket - 6, 'deep inside the hull');
assert.ok(I.rim > SH02_WELL.rim * STORY_SCALE.rocket, 'and ends his climb over the door rim');
for (let t = seq.isaoAt; t < A.riseEnd; t += 0.05) { const p = A.isaoAt(t, to).pos; assert.ok(p[0] === 0 && p[2] === 0, 'straight up the well'); }
assert.ok(A.isaoAt(A.riseEnd - 1e-6, to).pos[1] > I.rim - 0.01, 'over the rim at the end of the rise');
assert.ok(dist(A.isaoAt(A.riseEnd - 1e-4, to).pos, A.isaoAt(A.riseEnd + 1e-4, to).pos) < 0.05, 'the flight out starts where the climb ended');
let top = 0;
for (let t = A.riseEnd; t <= A.cut; t += 0.02) top = Math.max(top, A.isaoAt(t, to).pos[1]);
assert.ok(top > I.rim && top < I.rim + I.arc, `an arc over the nose on the way out (${top.toFixed(1)} m)`);
assert.ok(dist(A.isaoAt(A.cut, to).pos, to) < 1e-9, 'he is where the host asked on the cut: the close-up frames him there');
assert.equal(A.isaoAt(A.cut, to).out, 1);
// the camera moves until the cut
assert.ok(Math.abs(STORY_ARRIVAL.rail[STORY_ARRIVAL.rail.length - 1].t - A.cut) < 1e-6, 'the rail ends on the cut');
assert.deepEqual(A.camera(0).pos, STORY_ARRIVAL.rail[0].pos);
// ABOUT EIGHT SECONDS (owner): the landing, then the close-up over his first two lines and the start of the third
const b = BRIEFS[STORY_ARRIVAL.talk.brief], talk = lineDwell(b, 0) + lineDwell(b, 1) + STORY_ARRIVAL.talk.into;
assert.ok(A.cut + talk > 7 && A.cut + talk < 9.5, `about eight seconds (${(A.cut + talk).toFixed(1)})`);
assert.ok(STORY_ARRIVAL.talk.into < lineDwell(b, 2), 'the camera goes back to the base before the third line ends');
console.log(`Arrival shot: ${A.cut.toFixed(1)} s landing (touchdown ${seq.touchdown}, door ${seq.doorAt.toFixed(1)}, Isao ${seq.isaoAt.toFixed(1)}-${A.riseEnd.toFixed(1)}), then ${talk.toFixed(1)} s on his face: ${(A.cut + talk).toFixed(1)} s.`);
