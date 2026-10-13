// THE GROUND FEED (owner, 2026-10-13; src/domain/feed-schedule.js, src/content/ground-feed.js): the schedule (open, retarget, wait behind
// a seeker's feed, drop when stale, close, hidden while blocked), the timeline and its length against the old dive's, the HUD's numbers
// (grid, zoom, clock, seismic) and the feed camera's pose (straight down the normal, the target at the centre, north toward the heart).
import assert from 'node:assert/strict';
import { createFeedSchedule, feedTimeline, feedLength, feedFov, feedZoom, feedGrid, formatGrid, feedClock, seismicMagnitude, feedPose } from '../src/domain/feed-schedule.js';
import { GROUND_FEED as K } from '../src/content/ground-feed.js';
import { STORY_BREACH, STORY_BACK_DOOR } from '../src/content/story-defaults.js';
import { BREACH_DEFAULTS } from '../src/content/breach-defaults.js';

const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const run = (s, secs, busy = false, blocked = false, dt = 1 / 60) => { let f; for (let i = 0; i < Math.round(secs / dt); i++) f = s.step(dt, busy, blocked); return f; };
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

// 1. the length is the old dive's: the story's sinkhole (pre-roll + the breach + emergeHold + tail), the back door's
const sinkhole = { kind: 'breach', dir: norm([0.3, 0.8, 0.5]), preRoll: STORY_BREACH.preRoll, hold: BREACH_DEFAULTS.duration + STORY_BREACH.emergeHold, tail: STORY_BREACH.tail, size: 1 };
near(feedLength(sinkhole), 0.7 + 6.984 + 3 + 1.8, 1e-9, 'the sinkhole feed is the dive\'s 12.5 s');
near(feedLength({ preRoll: STORY_BACK_DOOR.preRoll, hold: STORY_BACK_DOOR.hold, tail: 1.8 }), 5.6, 1e-9, 'the back door\'s');

// 2. open, run its length, close
{
  const s = createFeedSchedule();
  let f = s.step(0.016); assert.equal(f.on, false, 'nothing until an event');
  s.request(sinkhole); f = s.step(1 / 60); assert.equal(f.on, true); assert.equal(f.ev, sinkhole); assert.equal(s.stats().opened, 1);
  f = run(s, 5); assert.equal(f.on, true); near(f.t, 5 + 1 / 60, 1e-6, 'its clock is the event\'s');
  f = run(s, 7.6); assert.equal(f.on, false, 'closed after its length'); assert.equal(s.stats().closed, 1); assert.equal(s.up(), false);
}
// 3. a new group while one is up retargets it: a static cut, the new event's clock from zero
{
  const s = createFeedSchedule(); s.request(sinkhole); run(s, 4);
  const other = { ...sinkhole, dir: norm([-0.5, 0.7, 0.2]) }; s.request(other); const f = s.step(1 / 60);
  assert.equal(f.ev, other); assert.ok(f.t < 0.02 && f.since === 0, 'retargeted from its own start'); assert.equal(s.stats().retargets, 1); assert.equal(s.stats().opened, 1);
  const tl = feedTimeline(f.t, f.since, other, K); assert.equal(tl.static, 1, 'the cut is a burst of static');
}
// 4. waits behind a seeker's feed and opens after it, in step with the ground; dropped when stale
{
  const s = createFeedSchedule(); s.request(sinkhole);
  let f = run(s, 3, true); assert.equal(f.on, false, 'the seeker holds the box'); assert.equal(s.waiting(), true); assert.equal(s.stats().waited, 1);
  f = s.step(1 / 60, false); assert.equal(f.on, true, 'opens when the box frees'); near(f.t, 3 + 1 / 60, 1e-6, 'at the event\'s age'); assert.equal(f.since, 0);
  const s2 = createFeedSchedule(); s2.request(sinkhole); run(s2, sinkhole.preRoll + sinkhole.hold + 0.1, true);
  f = s2.step(1 / 60, false); assert.equal(f.on, false, 'past its hold it is dropped'); assert.equal(s2.stats().dropped, 1); assert.equal(s2.stats().opened, 0);
  // the box taken from under an open feed: it waits at its age and comes back
  const s3 = createFeedSchedule(); s3.request(sinkhole); run(s3, 2); f = run(s3, 1, true); assert.equal(f.on, false);
  f = s3.step(1 / 60, false); assert.equal(f.on, true); near(f.t, 3 + 1 / 60, 1e-6, 'resumed at its age');
}
// 5. blocked (paused, a modal): hidden, the clock still the step's
{
  const s = createFeedSchedule(); s.request(sinkhole); s.step(0.1);
  let f = s.step(0.1, false, true); assert.equal(f.on, false, 'hidden while blocked'); assert.equal(s.up(), true);
  f = s.step(0, false, false); assert.equal(f.on, true, 'back when unblocked'); near(f.t, 0.2, 1e-9);
  s.clear(); assert.equal(s.step(0.1).on, false);
}
// 6. the timeline: static at the open and the close, the zoom from the event's pre-roll over zoomSeconds, the hold's progress
{
  const len = feedLength(sinkhole);
  let tl = feedTimeline(0, 0, sinkhole, K); assert.equal(tl.static, 1); assert.equal(tl.zoom, 0); assert.equal(tl.span, K.regionalCells);
  tl = feedTimeline(K.staticOpen, K.staticOpen, sinkhole, K); assert.equal(tl.static, 0, 'the burst is over');
  tl = feedTimeline(sinkhole.preRoll + K.zoomSeconds / 2, 1, sinkhole, K); near(tl.zoom, 0.5, 1e-9, 'half way'); assert.ok(tl.span < K.regionalCells && tl.span > K.closeCells);
  tl = feedTimeline(sinkhole.preRoll + K.zoomSeconds, 2, sinkhole, K); assert.equal(tl.zoom, 1); assert.equal(tl.span, K.closeCells); assert.equal(tl.hold, 0);
  tl = feedTimeline(len - 0.1, 9, sinkhole, K); assert.ok(tl.static > 0.5, 'static before the close'); assert.ok(tl.hold > 0.95);
  // the rockfall's own framing: wider at both ends
  const rock = { ...sinkhole, kind: 'backdoor' }, fr = K.framing.backdoor;
  assert.equal(feedTimeline(0, 0, rock, K).span, fr.regionalCells); assert.equal(feedTimeline(rock.preRoll + K.zoomSeconds, 2, rock, K).span, fr.closeCells); assert.ok(fr.closeCells > K.closeCells);
}
// 7. the HUD's numbers: zoom, fov, grid, clock, seismic
{
  near(feedZoom(K.regionalCells, K), 1); near(feedZoom(K.closeCells, K), K.regionalCells / K.closeCells);
  near(feedFov(K.regionalCells, K), 2 * Math.atan(K.regionalCells / 2 / K.altitudeCells) * 180 / Math.PI);
  assert.ok(feedFov(K.closeCells, K) < feedFov(K.regionalCells, K) / 4, 'the close frame is a long lens');
  const heart = norm([0, 1, 0.2]);
  const g0 = feedGrid(heart, heart); near(g0.lat, 0, 1e-9, 'the heart is the origin'); near(g0.lon, 0, 1e-9);
  // ten degrees along the heart's +Z meridian is 10 N; ninety degrees round the other tangent is 90 E or W
  const north = norm([0, -0.2, 1]), ang = (10 * Math.PI) / 180, p = heart.map((h, i) => h * Math.cos(ang) + north[i] * Math.sin(ang));
  const g1 = feedGrid(p, heart); near(g1.lat, 10, 1e-6, 'lat'); near(g1.lon, 0, 1e-6, 'lon');
  const east = [heart[1] * north[2] - heart[2] * north[1], heart[2] * north[0] - heart[0] * north[2], heart[0] * north[1] - heart[1] * north[0]];
  const g2 = feedGrid(east, heart); near(Math.abs(g2.lon), 90, 1e-6, 'a quarter turn east or west'); near(g2.lat, 0, 1e-6);
  assert.equal(formatGrid({ lat: 10.04, lon: -3.25 }), '10.0N 003.3W'); assert.equal(formatGrid({ lat: -2, lon: 120.58 }), '02.0S 120.6E');
  assert.equal(feedClock(0), 'T+00:00'); assert.equal(feedClock(7.9), 'T+00:07'); assert.equal(feedClock(75), 'T+01:15');
  const m1 = seismicMagnitude(sinkhole, K), m2 = seismicMagnitude({ ...sinkhole, size: 3 }, K);
  assert.ok(m1 >= K.seismic.breach.base && m1 < 6, `a sinkhole's magnitude ${m1}`); assert.ok(m2 > m1, 'a bigger group shakes harder');
  assert.equal(seismicMagnitude(sinkhole, K), m1, 'steady for one place');
  assert.ok(seismicMagnitude({ ...sinkhole, kind: 'backdoor', size: 6 }, K) < 5, 'the rockfall is a smaller event');
}
// 8. the feed camera: straight down the normal from altitudeCells up, the target at the centre before the hold, north toward the heart,
// the drift parallel (still straight down) through the hold
{
  const cellSide = 0.0133, heart = norm([0, 1, 0]), dir = sinkhole.dir, out = { eye: [0, 0, 0], target: [0, 0, 0], up: [0, 0, 0], fov: 0 };
  feedPose(dir, heart, feedTimeline(0.5, 0.5, sinkhole, K), cellSide, K, out);
  out.target.forEach((v, i) => near(v, dir[i], 1e-12, 'target at the point'));
  const look = norm(out.target.map((v, i) => v - out.eye[i])); look.forEach((v, i) => near(v, -dir[i], 1e-9, 'looks down the normal'));
  near(Math.hypot(...out.eye) - 1, K.altitudeCells * cellSide, 1e-9, 'altitude');
  near(out.up.reduce((a, v, i) => a + v * dir[i], 0), 0, 1e-9, 'up is level'); assert.ok(out.up.reduce((a, v, i) => a + v * heart[i], 0) > 0, 'north toward the heart');
  near(out.fov, feedFov(K.regionalCells, K), 1e-9, 'the regional lens before the zoom');
  const tl = feedTimeline(feedLength(sinkhole) - 0.01, 9, sinkhole, K); feedPose(dir, heart, tl, cellSide, K, out);
  const look2 = norm(out.target.map((v, i) => v - out.eye[i])); look2.forEach((v, i) => near(v, -dir[i], 1e-9, 'the drift keeps it straight down'));
  const off = Math.hypot(...out.target.map((v, i) => v - dir[i])); assert.ok(off > 0 && off <= K.driftCells * cellSide + 1e-12, `drifted ${off}`);
  near(out.fov, feedFov(K.closeCells, K), 1e-9, 'the close lens');
  // at the heart itself the frame is still defined
  feedPose(heart, heart, tl, cellSide, K, out); assert.ok(out.up.every(Number.isFinite) && Math.hypot(...out.up) > 0.99);
}
console.log(`Ground feed: the sinkhole feed ${feedLength(sinkhole).toFixed(2)} s, zoom x${feedZoom(K.closeCells, K).toFixed(1)}, lenses ${feedFov(K.regionalCells, K).toFixed(1)} -> ${feedFov(K.closeCells, K).toFixed(1)} deg, SEISMIC ${seismicMagnitude(sinkhole, K).toFixed(1)}.`);
