// THE FEIDS-26 DROP AS A RULE (owner, 2026-10-23: "we will reproduce the cinematic with the same scene"; spec
// docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md). The owner's cinematic (SentryTowers_A6 feids26/timeline.js) is pure
// functions of time already; this is its port, with the numbers handed in (`tl`, src/content/reinforcements.js REINFORCEMENTS.timeline), in
// the cinematic's own metres round the drop's centre (x, z on the ground, y up) and seconds from the drop's start:
//   touchdowns(tl)                    -> the four touchdown times (13.00, 13.43, 14.00, 19.23 s with the owner's numbers)
//   capsuleState(t, index, tl)        -> { age, x, y, pitch, opening, heat, flash, split, gone }  (opening: Shell_Separate's clock)
//   cargoState(t, capsule, slot, tl)  -> { age, hit, held, landed, height, x, z, yaw, pitch, jet, heat, fold, clip }
//                                        (clip: the MX-06's Airdrop_Land clock: tucked in the fall, its braking burn over the brake, 2.6 s at the touchdown)
//   dropCues(tl, sounds)              -> [{ t, kind: 'entry'|'woosh'|'impact', key, index }] in time order; cuesIn(cues, t0, t1): those in (t0, t1]
//   dropCamera(t, tl)                 -> { eye, look, fov, shake }  the cinematic's camera: wide on the falling group, the ground camera on the laggard
//   dropPhase(t, tl)                  -> 'idle' | 'dropping' | 'landed'
//   dropReady(cond)                   -> whether the drop starts now (decision 2: the first lull after `due`, or THE ARENA's start, or forced)
//   dropCentre({ adj, dist, from, hops, open }) -> the cell `hops` steps down the heart's field from the arena's cell (off the crater, toward the base)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

const releaseOf = (capsule, slot, tl) => tl.release + capsule * tl.capsuleGap + slot * tl.slotGap;
export const touchdowns = (tl) => tl.fallTimes.map((fall, i) => releaseOf(Math.floor(i / 2), i % 2, tl) + fall + tl.brake);

export function capsuleState(t, index, tl) {
  const a = Math.max(0, t - index * tl.capsuleGap), split = a - tl.release;
  return {
    age: a, x: index === 0 ? -tl.capsuleX : tl.capsuleX,
    y: split < 0 ? tl.entry - (tl.entry - tl.split) * (a / tl.release) ** 2 : tl.split - tl.splitSink * split,
    pitch: Math.PI / 2, opening: Math.max(0, split), split, gone: split >= tl.shellGone,
    heat: smooth(a / 0.6) * (1 - smooth(split / 0.22)),
    flash: split >= 0 && split < 0.3 ? Math.exp(-split * 17) : 0,
  };
}

export function cargoState(t, capsule, slot, tl) {
  const index = capsule * 2 + slot, delay = slot * tl.slotGap, age = t - capsule * tl.capsuleGap - tl.release - delay, fall = tl.fallTimes[index];
  const hit = age - fall - tl.brake, initial = tl.split - tl.splitSink * delay + (slot === 0 ? 2.2 : -2.2), landing = tl.landings[index];
  let height = initial;
  if (age >= 0 && age < fall) height = initial - (initial - tl.fallTo) * (age / fall) ** 2;
  else if (age >= fall && age < fall + tl.brake) { const u = (age - fall) / tl.brake; height = tl.fallTo * (1 - u) ** 3 + 1.6 * u * (1 - u); }
  else if (age >= fall + tl.brake) height = 0;
  const burst = age - fall, spread = smooth(age / (fall * 0.85)), cx = capsule === 0 ? -tl.capsuleX : tl.capsuleX;
  // the clip's clock: 0.3 s (legs tucked under the sling) held while it falls, the braking burn's 1.6 -> 2.6 s over the brake, then on to its 7 s end
  const clip = age < fall ? 0.3 : hit < 0 ? 1.6 + (age - fall) / tl.brake : Math.min(7, 2.6 + hit);
  return {
    age, hit, held: age < 0, landed: hit >= 0, height, clip,
    x: cx * (1 - spread) + landing[0] * spread, z: 2.05 * (1 - spread) + landing[1] * spread,
    yaw: (slot === 0 ? -0.22 : 0.22) * spread, pitch: Math.PI / 2 * (1 - smooth(age / 1.5)),
    jet: burst >= 0 && burst < tl.brake ? 0.25 + 0.75 * Math.max(0, Math.sin(burst / tl.brake * Math.PI * 5)) : 0,
    heat: smooth(age / 0.8) * (1 - smooth((age - fall + 0.6) / 0.65)), fold: 1 - smooth(age / 2),
  };
}

export function dropCues(tl, sounds) {
  const out = [0, 1].map((i) => ({ t: i * tl.capsuleGap, kind: 'entry', key: sounds.entry, index: i }));
  touchdowns(tl).forEach((td, i) => { out.push({ t: td - sounds.wooshLead, kind: 'woosh', key: sounds.woosh, index: i }, { t: td, kind: 'impact', key: sounds.impact, index: i }); });
  return out.sort((a, b) => a.t - b.t || a.index - b.index);
}
export const cuesIn = (cues, t0, t1) => cues.filter((c) => c.t > t0 && c.t <= t1);

// the cinematic's camera (feids26/viewer.js, cinema on), in the drop's metres: wide on the capsules, then on the falling cargo (a held mech is
// where its capsule is), closing on the first three, the grounded trio held, then down to the fixed ground camera before the laggard lands
export function dropCamera(t, tl) {
  const c0 = capsuleState(t, 0, tl), c1 = capsuleState(t, 1, tl), mid = (c0.y + c1.y) / 2, ys = [];
  for (let i = 0; i < 4; i++) { const s = cargoState(t, i >> 1, i & 1, tl); ys.push(s.held ? (i < 2 ? c0.y : c1.y) : s.height); }
  const allFall = (ys[0] + ys[1] + ys[2] + ys[3]) / 4, firstFall = (ys[0] + ys[1] + ys[2]) / 3, focus = smooth((t - 10.5) / 1.8);
  const fall = lerp(allFall, firstFall, focus), blend = smooth((t - 5.8) / 0.8), alt = lerp(mid + 3, fall + 1, blend), near = smooth((t - 11) / 3);
  const wide = [-30 + near * 4, alt + 15 - near * 9, 46 - near * 11], target = [0, alt, 0];
  const [g0, g1] = tl.groundCamera, ant = smooth((t - g0) / (g1 - g0)), lag = cargoState(t, 1, 1, tl);
  const ground = tl.ground, menace = [7.6, Math.max(0.55, lag.height + 0.65), 5.5];
  const eye = wide.map((v, k) => lerp(v, ground[k], ant)), look = target.map((v, k) => lerp(v, menace[k], ant));
  let shake = 0.035 * c0.heat;
  for (let i = 0; i < 2; i++) { shake += capsuleState(t, i, tl).flash * 0.16; for (let j = 0; j < 2; j++) { const age = cargoState(t, i, j, tl).hit; if (age >= 0) shake += (i === 1 && j === 1 ? 0.1 : 0.22) * Math.exp(-age * 5); } }
  eye[0] += Math.cos(t * 73) * shake; eye[1] += Math.sin(t * 81) * shake * (1 - ant * 0.6);
  return { eye, look, fov: 48 + ant * 19, shake };
}

export const dropPhase = (t, tl) => (t < 0 ? 'idle' : t <= tl.duration ? 'dropping' : 'landed');

// THE TRIGGER (decision 2): forced (?reinforce=1) goes at once, a running shot excepted; otherwise the call must have been made (`due` a day
// number), the hull alive and no win; THE ARENA reached first drops them at once, due or not ("if THE ARENA is reached first, drop at once as the
// sector begins, before the beacon's drive: the owner wants them before the boss fight"; a seat, a card or Isao's line does not hold it there, the
// cut is simply not taken over a seat); elsewhere the due day reached, no seat, card or line of Isao's, and a lull (a breath between waves, or a
// secured sector)
export function dropReady(c) {
  if (c.disabled || c.shot) return false;
  if (c.forced) return true;
  if (c.due === null || c.due === undefined || !c.alive || c.won) return false;
  if (c.arena) return true;
  if (!(c.day >= c.due) || c.seated || c.card || c.isaoBusy) return false;
  return !!(c.secure || (c.fighting && c.breathing));
}

// the group's centre: from the arena's cell, `hops` steps each to an open neighbour with a smaller heart distance (the smallest; the lowest index among equals)
export function dropCentre({ adj, dist, from, hops, open = () => true }) {
  if (!(from >= 0) || from >= adj.length) return -1;
  let c = from;
  for (let k = 0; k < hops; k++) {
    let next = -1;
    for (const nb of adj[c]) if (open(nb) && dist[nb] < dist[c] && (next < 0 || dist[nb] < dist[next] || (dist[nb] === dist[next] && nb < next))) next = nb;
    if (next < 0) break;
    c = next;
  }
  return c;
}
