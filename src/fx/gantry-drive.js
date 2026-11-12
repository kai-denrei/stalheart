// THE MOBILE STÅLHEART PRINTS THE DOMES (2026-11-12 night, the colony on the grid; design docs/superpowers/specs/2026-11-12-colony-layout-design.md
// 3.6). A dome step bought on the board (src/content/base-programme.js `gantry`) is the KIDOU's job, not Isao's: it turns on its plaza, drives the
// grid's lines to the cell (the road and its timing are src/domain/gantry-route.js, the numbers src/content/dome-city.js COLONY_GANTRY), straddles
// it with the cell's centre under its tool, lowers the arm and prints: the island, then the dome rising under the nozzle, the tip held `nozzle` m
// over the layer, up to the tool's reach. The rest of the dome (the mast over the reach) is handed to Isao's print beam as an order begun where
// the gantry stopped (the host's `hand`), and the gantry drives home the same way, its tool raised over the dome's foot. One job at a time; the
// programme's `when.home` keeps the next dome (and every bridge) waiting until it is parked again.
//   createGantryDrive({ base, cells, tune, split, id }) -> { home(), start(step, { progress, hand }), tick(dt), state() }
//   base: the story base (src/fx/story-base.js move, rig); split(step): the share of a step's print its islands take (src/fx/base-print.js);
//   progress(step, k): the print's hand (src/fx/base-print.js progress); hand(step, k): the gantry's share is done at k (the host prints the rest
//   or, at k 1, finishes the step)
import { gantryStop, timeline, poseAt, yawOf, headingOf, toolShare } from '../domain/gantry-route.js';

export function createGantryDrive({ base, cells, tune, split = () => 0.3, id = 'stalheart' }) {
  const homeYaw = yawOf(tune.heading);
  let job = null, at = { x: tune.home[0], z: tune.home[1], yaw: homeYaw }, roll = 0, turned = 0, trips = 0;
  const show = (p, extra = {}) => { at = { x: p.x, z: p.z, yaw: p.yaw }; base.move(id, p.x, p.z, headingOf(p.yaw)); base.rig(id, { mode: p.mode, distance: roll + p.distance, turnAngle: turned + p.turnAngle, speed: p.speed, omega: p.omega, tip: null, ...extra }); };
  const begin = (legs, phase) => { job.legs = legs; job.phase = phase; job.t = 0; };
  return {
    home: () => !job,
    start(step, { progress, hand }) {
      if (job) return false;
      const stop = gantryStop(cells, tune, step.cell); if (!stop) return false;
      const s = split(step), share = toolShare(s, tune);
      job = { step, stop, progress, hand, split: s, share, k: 0 };
      begin(timeline(stop.points, at.yaw, null, tune), 'out');
      return true;
    },
    tick(dt) {
      if (!job || !(dt > 0)) return;
      job.t += dt;
      if (job.phase === 'out' || job.phase === 'back') {
        const p = poseAt(job.legs, job.t);
        show(p);
        if (!p.done) return;
        roll += p.distance; turned += p.turnAngle;
        if (job.phase === 'back') { show({ ...p, distance: 0, turnAngle: 0, mode: 'park' }); job = null; trips++; return; }
        job.phase = 'print'; job.t = 0;
      }
      if (job.phase === 'print') {
        const dur = Math.max(0.1, job.step.seconds * job.share), k = Math.min(job.share, (job.t / dur) * job.share);
        job.k = k; job.progress(job.step, k);
        // the tip over the layer: the structure's share of k is its height's share of the dome's top
        const layer = Math.max(0, (k - job.split) / (1 - job.split)) * tune.top;
        base.rig(id, { mode: 'fabricate', distance: roll, turnAngle: turned, speed: 0, omega: 0, tip: Math.min(tune.reach, Math.max(3.6, layer + tune.nozzle)) });
        if (job.t < dur) return;
        job.hand(job.step, job.share);
        begin(timeline(job.stop.points.slice().reverse(), at.yaw, homeYaw, tune), 'back');
      }
    },
    state: () => ({ home: !job, phase: job?.phase ?? 'home', step: job?.step.id ?? null, cell: job?.step.cell ?? null, k: job ? +job.k.toFixed(3) : null, share: job ? +job.share.toFixed(3) : null,
      x: +at.x.toFixed(2), z: +at.z.toFixed(2), heading: headingOf(at.yaw).map((v) => +v.toFixed(3)), trips }),
  };
}
