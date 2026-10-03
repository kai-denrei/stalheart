// THE GUNSHIP FLIES ITSELF (src/content/gunship.js GUNSHIP_AUTO). The seat's own rules (src/domain/gunship.js: stepGun, fireRound,
// stepRounds, the MK-9's paint and launch) driven by a target rule instead of a gunner: the ship is mounted while nobody is in the
// seat, fires bursts at the densest pile near its track (src/domain/laser-auto.js densestTarget), alternating the rotary and the
// Bofors, lands its rounds exactly as the seat does, and once a pass drops the MK-9 on a pile the player can see. The seat taken, it
// lets go at once. `G` is the rig's pilot bag (src/fx/gunship-rig.js pilotBag), the same hands the seat has.
import { densestTarget } from '../domain/laser-auto.js';

// `friends()`: the points the MK-9 must never land near (the heart, the hull, the base's walls, structures and sentry sockets). The
// dummy nuke breaks towers and walls where it lands, so on auto it only goes down on a pile `nukeSafeCells` clear of its own blast
// from every one of them (owner, 2026-10-02: "only shoot nukes at safe distance from the base"); the rotary and the Bofors fire as before
// `units()`: the friendly units the two guns keep `gunSafeCells` beyond their blast from (the hull and Isao; owner, 2026-10-02: "neither
// gunship nor orbital laser should fire too close to friendly units"). The guns cannot hurt a wall or a sentry, so the gate's pile stays theirs
// `hull()`: the tank's unit position; the MK-9 only goes down on a pile within `nukeFacing` (a dot product) of it, so the player sees the
// strike from the hull (owner, 2026-10-03: "a tactical nuke launched, and from the tank PoV it is nowhere to be seen")
export function createGunshipAuto({ G, tune, onScreen, callout, sfx, hasCue, friends = () => [], units = () => [], hull = () => null }) {
  let gun = 'rotary', phase = 'rest', t = 0, nukePass = -1, rounds = 0, target = null;
  function landRounds() {
    for (const r of G.landed()) {
      const g = G.guns[r.gun], rc = G.cell(r.point), R = g.blastCells * G.cs;
      for (const e of G.enemies()) { const d = Math.hypot(e.pos[0] - r.point[0], e.pos[1] - r.point[1], e.pos[2] - r.point[2]); if (d < R) G.damage(e, G.splash(d, R, g.damage)); }
      if (g.key === 'bofors') { G.puff(rc, g.ringHex, 0.7, R * 1.6); if (!G.explode('gunship.bofors', r.point)) G.burst(r.point, 0xffd08a, 44, 0.5); G.sfx(g.impact, r.point, { rate: 0.7 }); }
      else { G.puff(rc, g.ringHex, 0.16, R * 0.9); G.explode('gunship.rotary', r.point); }
    }
    const lc = G.stepHeavy(); if (lc >= 0) { G.blast(lc); G.laser(-1); }
  }
  return {
    // seated: the player is in the seat (the seat runs the guns); returns whether auto flew this tick
    tick(dt, seated) {
      const st = G.state;
      if (!seated) G.optic.fade?.(dt);   // nobody's pose() is ageing the tracers
      if (seated || !G.onStation()) { phase = 'rest'; t = 0; return false; }
      if (!st.mounted) G.mount();
      t += dt;
      const live = G.enemies();
      // the MK-9, once a pass, on a pile the player is looking at: the odd dummy nuke "that just happens to be in the line of sight"
      if (nukePass !== st.passes && st.heavyPass !== st.passes) {
        const keep = (G.guns.heavy.blastCells + (tune.nukeSafeCells ?? 3)) * G.cs, near = friends(), safe = (q) => near.every((f) => Math.hypot(q[0] - f[0], q[1] - f[1], q[2] - f[2]) > keep);
        const h = hull(), hl = h ? Math.hypot(h[0], h[1], h[2]) || 1 : 1, near2 = (q) => !h || (q[0] * h[0] + q[1] * h[1] + q[2] * h[2]) / (hl * (Math.hypot(q[0], q[1], q[2]) || 1)) > (tune.nukeFacing ?? 0);
        const seen = live.filter((e) => onScreen(e.pos, tune.nukeView) && safe(e.pos) && near2(e.pos));
        if (seen.length >= tune.nukePile) {
          const p0 = densestTarget(seen, { radius: G.guns.heavy.blastCells * G.cs * 10, metres: 10 }), p = p0 && safe(p0) ? p0 : null, ci = p ? G.cell(p) : -1;
          if (ci >= 0 && G.select('heavy') !== false && G.paintHeavy(ci)) {
            const lc = G.launchHeavy();
            if (lc >= 0) {
              nukePass = st.passes;
              const from = G.optic.muzzle('heavy'), up = Math.hypot(...from) ? from.map((v) => v / Math.hypot(...from)) : [0, 1, 0];
              if (!G.drop?.release(from, G.centers[lc], up, G.vel?.() ?? [0, 0, 0])) G.optic.flight(from, G.centers[lc], G.guns.heavy.ringHex, G.guns.heavy.travel, 1.2);
              G.sfx(G.guns.heavy.sound, from);
              callout(tune.callout);
              const key = tune.nukeCalls[Math.floor(Math.random() * tune.nukeCalls.length)];
              if (!hasCue || hasCue(key)) sfx?.play?.(key);
            }
          }
          G.select(gun);
        }
      }
      // the guns: a burst, a rest, the other gun
      if (phase === 'rest') { if (t >= tune.rest) { phase = 'burst'; t = 0; gun = gun === 'rotary' ? 'bofors' : 'rotary'; G.select(gun); target = null; } landRounds(); G.step(dt, false); return true; }
      if (!target || t % 0.6 < dt) {
        const keep = (G.guns[gun].blastCells + (tune.gunSafeCells ?? 1.5)) * G.cs, near = units(), clear = (q) => near.every((f) => Math.hypot(q[0] - f[0], q[1] - f[1], q[2] - f[2]) > keep);
        const p = densestTarget(live.filter((e) => clear(e.pos)), { radius: G.guns[gun].blastCells * G.cs * 10, metres: 10 }); target = p && clear(p) ? p : null;
      }
      const n = target ? G.step(dt, true) : (G.step(dt, false), 0);
      const g = G.guns[gun];
      for (let i = 0; i < n; i++) {
        const a = (rounds++) * 2.399963, r = g.blastCells * G.cs * 0.5 * Math.sqrt((rounds % 7) / 7);
        const p = [target[0] + Math.cos(a) * r, target[1] + Math.sin(a) * r * 0.5, target[2] + Math.sin(a) * r];
        const l = Math.hypot(...p), aim = [p[0] / l * Math.hypot(...target), p[1] / l * Math.hypot(...target), p[2] / l * Math.hypot(...target)];
        G.fire(gun, aim, g.travel); G.optic.flight(G.optic.muzzle(gun), aim, g.ringHex, g.travel, gun === 'bofors' ? 0.5 : 0.25);
        if (!g.loop && i === 0) G.sfx(g.sound, G.optic.muzzle(gun), { rate: g.pitch ?? 1 });
      }
      landRounds();
      if (t >= tune.burst) { phase = 'rest'; t = 0; }
      return true;
    },
    state: () => ({ gun, phase, nukePass, rounds }),
  };
}
