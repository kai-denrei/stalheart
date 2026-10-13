// THE GROUND FEED'S SCHEDULE (owner, 2026-10-13: "replace most instances of the camera cutting the current action to show a
// Tremor/sinkhole [with] a temporary screen-within-the-screen ... clearly marked with HUD info and maybe static/CRT lines that it is a
// video feed"). Pure: which ground event the corner box shows, where it is in its timeline, and the numbers its HUD prints. The DOM and
// the second render are src/fx/ground-feed.js; the knobs are src/content/ground-feed.js (GROUND_FEED), passed in.
//
// An event is { kind, dir: [x, y, z] unit, preRoll, hold, tail, size }. Its length is the old camera dive's: preRoll + hold + tail
// (src/fx/dive-shot.js). Its clock `t` is the event's own age, so a feed that had to wait opens in step with the ground.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { const v = clamp01(x); return v * v * (3 - 2 * v); };
export const feedLength = (ev) => (ev.preRoll ?? 0) + (ev.hold ?? 0) + (ev.tail ?? 0);

// The box is shared: a seeker's feed or a seat's optic (`busy`) holds it, and the ground feed waits behind it; an event still young
// (its age within preRoll + hold, before its tail) opens when the box frees, an older one is dropped. A new event while one is up
// retargets the box (a static cut). `blocked` (the game paused, a modal up) hides the box without moving anything but the clock.
export function createFeedSchedule() {
  let cur = null, pending = null;   // cur: { ev, t, since }, pending: { ev, age }
  const stats = { opened: 0, retargets: 0, waited: 0, dropped: 0, closed: 0 };
  const frame = { on: false, ev: null, t: 0, since: 0, len: 0 };
  const young = (ev, age) => age <= (ev.preRoll ?? 0) + (ev.hold ?? 0);
  return {
    request(ev) { pending = { ev, age: 0 }; },
    // advance by dt; returns the frame (one kept object)
    step(dt, busy = false, blocked = false) {
      if (pending) pending.age += dt;
      if (cur) { cur.t += dt; cur.since += dt; if (cur.t >= feedLength(cur.ev)) { cur = null; stats.closed++; } }
      // the box taken from under an open feed: it waits as a pending event at its own age
      if (cur && busy) { pending = { ev: cur.ev, age: cur.t, held: true }; cur = null; stats.waited++; }
      if (pending && !young(pending.ev, pending.age)) { pending = null; stats.dropped++; }
      if (pending && busy && !pending.counted) { pending.counted = true; if (!pending.held) stats.waited++; }
      if (pending && !busy) {
        if (cur) stats.retargets++; else stats.opened++;
        cur = { ev: pending.ev, t: pending.age, since: 0 }; pending = null;
      }
      frame.on = !!cur && !blocked; frame.ev = cur?.ev ?? null; frame.t = cur?.t ?? 0; frame.since = cur?.since ?? 0; frame.len = cur ? feedLength(cur.ev) : 0;
      return frame;
    },
    up: () => !!cur,
    waiting: () => !!pending,
    stats: () => stats,
    clear() { cur = null; pending = null; },
  };
}

// The timeline at the event's clock `t`, `since` seconds after the box opened or cut to it:
//  static   0..1, the burst at the open or a retarget (k.staticOpen) and before the close (k.staticClose)
//  zoom     0..1, the regional frame to the close one over k.zoomSeconds, starting at the event's preRoll (as the dive left orbit)
//  span     cells across the frame's height, eased from regionalCells to closeCells (the kind's own in k.framing, else k's)
//  hold     0..1 through the hold and the tail (the drift and the roll)
export function feedTimeline(t, since, ev, k, out = {}) {
  const len = feedLength(ev), pre = ev.preRoll ?? 0;
  out.static = Math.max(clamp01(2 * (1 - since / k.staticOpen)), clamp01(2 * (1 - (len - t) / k.staticClose)));   // full for the first half of a burst, then clearing
  out.zoom = ease((t - pre) / k.zoomSeconds);
  const fr = k.framing?.[ev.kind] ?? k;
  out.span = fr.regionalCells + (fr.closeCells - fr.regionalCells) * out.zoom;
  out.hold = clamp01((t - pre - k.zoomSeconds) / Math.max(1e-3, len - pre - k.zoomSeconds));
  return out;
}

// the vertical field of view (degrees) that fits `span` cells from `altitudeCells` straight above
export const feedFov = (span, k) => (2 * Math.atan(span / (2 * k.altitudeCells)) * 180) / Math.PI;
// ZOOM xN against the sinkhole's regional frame (k.regionalCells), whatever the kind
export const feedZoom = (span, k) => k.regionalCells / span;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b, o) => { o[0] = a[1] * b[2] - a[2] * b[1]; o[1] = a[2] * b[0] - a[0] * b[2]; o[2] = a[0] * b[1] - a[1] * b[0]; return o; };
const normalize = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; a[0] /= l; a[1] /= l; a[2] /= l; return a; };
// north on the ground at `dir`: toward `toward` (the heart) along the surface; at the heart itself (or its antipode) the +Z
// meridian, so a frame is defined everywhere
function tangentToward(dir, toward, o) {
  const d = dot(toward, dir); o[0] = toward[0] - dir[0] * d; o[1] = toward[1] - dir[1] * d; o[2] = toward[2] - dir[2] * d;
  if (Math.hypot(o[0], o[1], o[2]) < 1e-6) { const z = dir[2]; o[0] = -dir[0] * z; o[1] = -dir[1] * z; o[2] = 1 - dir[2] * z; if (Math.hypot(o[0], o[1], o[2]) < 1e-6) { o[0] = 1; o[1] = 0; o[2] = 0; } }
  return normalize(o);
}

// GRID: the point's latitude and longitude in a frame whose origin is the heart (lat 0, lon 0) and whose north is the heart's +Z
// meridian, in degrees
const gN = [0, 0, 0], gE = [0, 0, 0];
export function feedGrid(dir, heart, out = {}) {
  tangentToward(heart, [0, 0, 1], gN); cross(gN, heart, gE);
  out.lat = (Math.asin(Math.max(-1, Math.min(1, dot(dir, gN)))) * 180) / Math.PI;
  out.lon = (Math.atan2(dot(dir, gE), dot(dir, heart)) * 180) / Math.PI;
  return out;
}
export const formatGrid = ({ lat, lon }) => `${Math.abs(lat).toFixed(1).padStart(4, '0')}${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1).padStart(5, '0')}${lon < 0 ? 'W' : 'E'}`;
// T+mm:ss
export const feedClock = (t) => { const s = Math.max(0, Math.floor(t)); return `T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
// SEISMIC: a magnitude from the event's size (cells opened or fallen) on its kind's base, with a steady tenth or two from where it is
export function seismicMagnitude(ev, k) {
  const b = k.seismic[ev.kind] ?? k.seismic.breach;
  const wobble = Math.abs(Math.sin(ev.dir[0] * 127.1 + ev.dir[1] * 311.7 + ev.dir[2] * 74.7)) * b.jitter;
  return Math.min(9.9, b.base + b.perLog * Math.log10(1 + Math.max(0, ev.size ?? 1)) + wobble);
}

// THE FEED CAMERA: straight down the point's normal from `altitudeCells` up, north (toward the heart) at the top of the frame, a slow
// roll of k.rollDeg and a drift of k.driftCells east through the hold. Writes { eye, target, up } (arrays) and fov (degrees) in `out`.
const pN = [0, 0, 0], pE = [0, 0, 0];
export function feedPose(dir, heart, tl, cellSide, k, out) {
  tangentToward(dir, heart, pN); cross(pN, dir, pE);
  const roll = (k.rollDeg * Math.PI / 180) * tl.hold, c = Math.cos(roll), s = Math.sin(roll), drift = k.driftCells * cellSide * tl.hold, alt = 1 + k.altitudeCells * cellSide;
  for (let i = 0; i < 3; i++) {
    out.target[i] = dir[i] + pE[i] * drift;
    out.eye[i] = dir[i] * alt + pE[i] * drift;
    out.up[i] = pN[i] * c + pE[i] * s;
  }
  out.fov = feedFov(tl.span, k);
  return out;
}
