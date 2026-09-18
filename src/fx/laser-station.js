// SOL-82 FOR THE GAME CONTROLLER: the arsenal (the pass and the beam, src/fx/laser-arsenal.js) and the seat (the scope
// and the hands, src/fx/laser-seat.js) composed behind one small surface, so src/td-tab.js wires the orbital laser in a
// handful of lines: tick, the camera pose while seated, the scope's render, the storyApi switch and the test hooks.
//
// The views strip's SOL-82 button is caught here, before the strip's own handler: it opens the seat while a pass is
// overhead (the first time behind SOL-82's briefing, the game paused under it, as the gunship's seat does), and any
// other strip button leaves the seat first and then does what it says.
import { createLaserArsenal } from './laser-arsenal.js';
import { createLaserSeat } from './laser-seat.js';
import { createSol82Briefing } from './sol82-briefing.js';
import { LASER_GAME } from '../content/orbital-laser.js';

// host: everything createLaserArsenal takes, plus views() (the story strip or null), canvas() (the game canvas),
// mobile, paused(value?) (sets the game's pause when given, returns what it was), enter() and leave() (the game's
// camera and tank on the way in and out), fov() (the game camera's lens, for the harness)
export function createLaserStation(root, scene, host) {
  let seat = null, briefing = null;
  const arsenal = createLaserArsenal(scene, { ...host, passEnded: () => leave() });
  const overhead = () => arsenal.online() && arsenal.state().overhead;

  function sit() {
    if (seat || !overhead()) { if (!seat) host.views()?.active('tank'); return !!seat; }
    const canvas = host.canvas();
    seat = createLaserSeat(root, { arsenal, canvas, container: canvas.parentElement ?? root, mobile: host.mobile, leave: () => leave(), pause: () => host.paused(!host.paused()) });
    arsenal.seat(true);
    host.enter?.(LASER_GAME.groundFov);
    host.views()?.active('laser');
    return true;
  }

  function enter() {
    if (seat) return true;
    if (!overhead()) { host.views()?.active('tank'); return false; }
    briefing ??= createSol82Briefing(root);
    if (briefing.seen()) return sit();
    const was = host.paused(true);
    briefing.open(() => { host.paused(was); sit(); });
    return true;
  }

  function leave() {
    if (!seat) return;
    seat.dispose();
    seat = null;
    arsenal.seat(false);
    host.leave?.();
    host.views()?.active('tank');
  }

  const abort = new AbortController();
  root.addEventListener('click', (e) => {
    const b = e.target.closest?.('#story-views button');
    if (!b) return;
    if (b.dataset.view === 'laser') { e.preventDefault(); e.stopImmediatePropagation(); enter(); return; }
    leave();
  }, { capture: true, signal: abort.signal });

  // a harness aim: 'breach' (the first live one), 'body' (the live body nearest the beam), 'rock' (the nearest breakable
  // rock cell), a cell index or a scene point
  const target = (p) => {
    if (p === 'breach') { const sp = host.breaches()[0]; return sp ? host.centers()[sp.ci] : null; }
    if (p === 'body' || p === 'ahead') {
      const a = arsenal.anchor(), d2 = (e) => (e.pos[0] - a[0]) ** 2 + (e.pos[1] - a[1]) ** 2 + (e.pos[2] - a[2]) ** 2;
      const e = host.enemies().filter((x) => x.alive).sort((x, y) => d2(x) - d2(y))[0];
      if (!e || p === 'body') return e?.pos ?? null;
      /* 'ahead': 30 m from that body toward the base, where a 10 m/s beam meets a swarm that walks faster than it */
      const h = host.heart(), d = [h[0] - e.pos[0], h[1] - e.pos[1], h[2] - e.pos[2]], l = Math.hypot(...d) || 1, k = Math.min(l, 30 / arsenal.metres()) / l;
      return [e.pos[0] + d[0] * k, e.pos[1] + d[1] * k, e.pos[2] + d[2] * k];
    }
    if (p === 'rock') { const ci = arsenal.nearestRock(); return ci >= 0 ? host.centers()[ci] : null; }
    if (p === 'wall') {
      const a = arsenal.anchor(), d2 = (w) => (w.pos[0] - a[0]) ** 2 + (w.pos[1] - a[1]) ** 2 + (w.pos[2] - a[2]) ** 2;
      return host.walls().sort((x, y) => d2(x) - d2(y))[0]?.pos ?? null;
    }
    /* 'structure:<id>': a building of ours, for the harness that proves the beam can burn one and that it costs us its perk */
    if (typeof p === 'string' && p.startsWith('structure:')) return host.structures().find((b) => b.id === p.slice(10))?.pos ?? null;
    if (Number.isInteger(p)) return host.centers()[p] ?? null;
    return Array.isArray(p) ? p : null;
  };

  return {
    tick(dt) {
      arsenal.tick(dt, seat?.input(dt) ?? null);
      host.views()?.sol82?.(arsenal.strip());
    },
    pose: (goal) => !!seat && seat.pose(goal),
    render: (renderer, scene) => seat?.render(renderer, scene),
    seated: () => !!seat,
    setOnline: (on) => arsenal.setOnline(on),
    reset() { leave(); arsenal.reset(); },   // a new run: the seat goes, the scorch and the books with it

    stats: () => arsenal.stats(),
    state: () => ({ ...arsenal.state(), seated: !!seat, briefing: !!briefing?.isOpen(), fov: host.fov?.() ?? null }),
    // folded into window.__stalheartTest: laserSteer takes a scene point, a cell index or 'breach'
    hooks: {
      laserOnline: (on = true) => arsenal.setOnline(on),
      laserPassNow: () => arsenal.passNow(),
      laserSeat: (on = true) => (on ? enter() : (leave(), false)),
      laserSteer: (p) => arsenal.steer(target(p)),
      laserHold: (on = true) => arsenal.hold(on),
    },
    dispose() { leave(); abort.abort(); briefing?.dispose(); arsenal.dispose(); },
  };
}
