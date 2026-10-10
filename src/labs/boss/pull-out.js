// pull-out.js — a creature pulling itself out of the ground (owner, 2026-10-10: "both the smaller Reeds and the larger boss emerge as if from an elevator, it looks
// unnatural. let's have them emerge by stretching their limbs, as if they were pulling themselves out from the depth"). The rule (the phases, the arms' paths, the
// grips on the hole's lip, the haul's surges) is src/domain/boss-emerge.js; this file drives one kit's arms along it. Used by the Reeds (./wave.js) and the boss
// (boss-tab.js), each in its own native units, its drawing lowered by the depth still to climb (the body itself stands on its floor all along: its solver never
// sees the ground move).
//
// THE ARMS are the kit's own limbs: a node's limb is the sector its rest position lies in round the rest centre (src/fx/nih-dairia/behavior.js, `round(angle /
// spacing)` of `gait.count`), as the gait's feet are; an arm's TIP is its nodes past TIP native metres out, its OUTER part the nodes past ROOT, weighted from 0 at
// ROOT to 1 at OUTER (the limb's root stays with the torso, the tip goes where it is pulled).
// THE DRIVE rides the kit's fixed step (each substep, at the kit's own `phys.step`, after the kit's muscles): while the creature emerges its behaviour's `step` is an
// instance property that calls the class's own method and then pulls each arm — one acceleration per arm, `kp` toward its goal and `kd` against its tips' mean
// velocity, capped at `amax`, on every node of its outer part by its weight, times the grip's `hold`. `end()` deletes the property, so the class's method is the
// kit's step again; the kit's files are untouched. The gait's feet are set to the same goals, so the kit's own muscles lead each arm the same way; on their own they
// cannot lift one far, since they remove their own net vertical force (behavior.js: "Removing net vertical force prevents the controller levitating the torso"),
// and the torso squashes instead. The drive's pull is not removed: it is the grip on the lip.
import { armReach, rimReach, gripRadius } from '../../domain/boss-emerge.js';

const ROOT = 0.05, OUTER = 0.085, TIP = 0.08;   // native metres from the rest centre: the outer part of a limb, fully pulled past OUTER; its tip past TIP

export function createPullOut(kit) {
  const b = kit.body, m = kit.motion, g = m.gait, n = g.count, N = b.mass.length, rc = m.restCenter;
  const limb = new Int8Array(N).fill(-1), weight = new Float64Array(N), tips = Array.from({ length: n }, () => []);
  for (let i = 0; i < N; i++) {
    const rx = b.rest[i * 3] - rc.x, rz = b.rest[i * 3 + 2] - rc.z, r = Math.hypot(rx, rz);
    if (r < ROOT) continue;
    const L = (Math.round(Math.atan2(rz, rx) / g.spacing) + n) % n;
    limb[i] = L; weight[i] = Math.min(1, (r - ROOT) / (OUTER - ROOT));
    if (r > TIP) tips[L].push(i);
  }
  // each arm's rest: its tips' centroid direction from the rest centre (unit [x, z]), radius and height (native)
  const arms = tips.map((ids) => {
    let x = 0, y = 0, z = 0;
    for (const i of ids) { x += b.rest[i * 3] - rc.x; y += b.rest[i * 3 + 1]; z += b.rest[i * 3 + 2] - rc.z; }
    x /= ids.length || 1; y /= ids.length || 1; z /= ids.length || 1;
    const r = Math.hypot(x, z) || 1;
    return { dir: [x / r, z / r], rest: r, height: y };
  });
  const goal = arms.map(() => [0, 0, 0]), acc = arms.map(() => [0, 0, 0]);
  let on = false, hold = 0, gain = { kp: 0, kd: 0, amax: 0 }, anchor = [0, 0], grips = arms.map((a) => a.rest), speed = 0;

  // one substep's pull on every arm (after the kit's muscles, before its solve)
  function pull(h) {
    if (!(hold > 0)) return;
    const v = b.velocity, x = b.x, M = b.mass;
    for (let L = 0; L < n; L++) {
      const ids = tips[L]; let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0, w = 0;
      for (const i of ids) { const k = M[i], j = i * 3; cx += x[j] * k; cy += x[j + 1] * k; cz += x[j + 2] * k; vx += v[j] * k; vy += v[j + 1] * k; vz += v[j + 2] * k; w += k; }
      if (!w) continue;
      const G = goal[L], a = acc[L];
      a[0] = gain.kp * (G[0] - cx / w) - gain.kd * vx / w; a[1] = gain.kp * (G[1] - cy / w) - gain.kd * vy / w; a[2] = gain.kp * (G[2] - cz / w) - gain.kd * vz / w;
      const s = Math.hypot(a[0], a[1], a[2]);
      if (s > gain.amax) { const f = gain.amax / s; a[0] *= f; a[1] *= f; a[2] *= f; }
    }
    for (let i = 0; i < N; i++) {
      const L = limb[i]; if (L < 0) continue;
      const a = acc[L], f = weight[i] * hold * h, j = i * 3;
      v[j] += a[0] * f; v[j + 1] += a[1] * f; v[j + 2] += a[2] * f;
    }
  }

  return {
    arms,
    // the grips (native radii, one an arm) for a creature centred at the local point `from` drawn `scale` local metres a native one, out of the hole at the local
    // point `hole` `radius` local metres wide: each arm's way to the rim along its own direction, `lip` past it (src/domain/boss-emerge.js `gripRadius`)
    aim(from, scale, hole, radius, E) {
      return arms.map((a) => { const rim = rimReach(from, a.dir, hole, radius); return gripRadius(rim === null ? null : rim / scale, a.rest, E); });
    },
    // the pull from now on: the arms gripping at `grips` (native radii) round the native ground point `at`, the drive's gains `drive` ({ kp, kd, amax })
    begin(at, radii, drive) {
      anchor = [at[0], at[1]]; grips = [...radii]; gain = { ...drive }; hold = 0;
      if (on) return;
      const base = Object.getPrototypeOf(m).step;
      m.step = function step(h) { base.call(this, h); pull(h); };
      on = true;
    },
    // this frame's goals from the emergence's phase `e` (src/domain/boss-emerge.js `emergence`): `depth` the native depth of the hole's floor under the surface,
    // `height` the body's rest height (an arm's arc over the lip is a share of it); the surface's native height over the body's floor now (the drawing's lowering)
    frame(e, depth, height, E) {
      const surface = (1 - e.lift) * depth;
      hold = e.hold;
      for (let L = 0; L < n; L++) {
        const a = arms[L], G = goal[L];
        let r = grips[L], y = a.height + surface;
        if (e.phase === 'reach' || e.phase === 'tremor') { const p = armReach(e.phase === 'reach' ? e.k : 0, L, n, E); r = a.rest + (grips[L] - a.rest) * p.out; y = a.height + depth * p.up + p.over * height; }
        else if (e.phase === 'release') r = a.rest + (grips[L] - a.rest) * e.hold;
        G[0] = anchor[0] + a.dir[0] * r; G[1] = y; G[2] = anchor[1] + a.dir[1] * r;
        g.feet[L].set(G[0], G[1] - a.height, G[2]);   // the kit's own muscles lead the arm the same way (behavior.js: a tip's height is its rest's plus its foot's)
      }
      return surface;
    },
    // the pull off: the kit's own step again, the feet planted at their rest round the anchor
    end() {
      if (!on) return;
      delete m.step; on = false; hold = 0;
      for (let L = 0; L < n; L++) { const a = arms[L]; g.feet[L].set(anchor[0] + a.dir[0] * a.rest, 0, anchor[1] + a.dir[1] * a.rest); }
    },
    active: () => on,
    // the body against the surface `surface` (native, over its floor): the highest tip node and the torso's centre over it, the fastest node since the last read
    // (native metres a second); all native
    read(surface) {
      let tip = -Infinity, v2 = 0;
      for (const ids of tips) for (const i of ids) tip = Math.max(tip, b.x[i * 3 + 1]);
      const v = b.velocity;
      for (let i = 0; i < v.length; i += 3) v2 = Math.max(v2, v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]);
      speed = Math.sqrt(v2);
      return { tip: tip - surface, torso: m.torsoCenter.y - surface, speed };
    },
  };
}
