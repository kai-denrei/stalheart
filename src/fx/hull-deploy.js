// THE HULL'S DEPLOY (moved out of src/td-tab.js, refactor round 2, 2026-10-13): the berth's drive-out, its camera pose and progress,
// and the hung-deploy watch, as the controller had them; `deploy` is this module's state now. The controller keeps deployStart,
// deployFramePoseFor and deployProgress as hoisted one-liners (host literals above this point hold them) and reads the rest through
// the surface. Its lets are read through getters and written through setters; stopEngine is a lazy call (the engine is made later).
import { berthRun, berthHeading, deployFraming, deployU, easeDeploy } from '../domain/deploy-path.js';
import { dist3, norm3 } from '../vec3.js';

export function createHullDeploy(host) {
  const {
    player, params, shots, poseCamera, arriveAt, paintThrottle, stopEngine,
    berths, graph, lifeContainers, story, playerMesh, speedBonus, cellSide, cellIndex, deployCount,
    setDeployCount, setThrottle, setCruise, setAutoMode, setPlayerDown,
  } = host;
  // Respawn beside the HEART, facing outward: the gate is enemy ground by the time you die. DEPLOY is the one way a tank enters the
  // world: the hull starts at rest in its berth and drives out in manual. "Entirely out" is measured in CELLS (its centre on the exit
  // cell's), so it holds with no container model loaded. DEPLOY is not auto and not cruise: it ends with the lever at zero.
  let deploy = null;   // { n, from[3], to[3], segLen, travelled }
  const deployActive = () => deploy !== null;

  // a berth's run and heading, over the current graph (src/domain/deploy-path.js)
  const berthSeg = (b) => berthRun(b, graph().centers), berthDir = (b) => berthHeading(b, graph().centers);
  function deployStart(n) {
    const b = berths()[n];
    if (!b || !graph()) return false;
    setDeployCount(deployCount() + 1);
    player.freeMode = false; player.virtualStart = null;
    player.cur = b.ci; player.prev = -1; player.pos = berthSeg(b)[0].slice();
    player.prog = 0; player.next = b.exit;
    player.heading = berthDir(b);
    player.travelDir = player.heading.slice(); player.smoothDir = player.travelDir.slice();
    player.segLen = Math.max(1e-9, dist3(...berthSeg(b)));
    setThrottle(0); setCruise(false); setAutoMode(false);
    paintThrottle();
    stopEngine(0.1, true);
    // only what is NOT derivable: which berth, and how far out we are. from,
    // to and segLen were all functions of `n` and drifted-by-construction.
    // THE FIRST HULL OUT OF A BAY WITH AN AUTHORED ROLL-OUT PLAYS THE CLIP: the parked hull rolls, ours stays hidden until the clip ends where the run ends
    const cc = lifeContainers()[n]; deploy = { n, travelled: 0, age: 0, clip: cc?.rollout && !cc.rolled ? cc.rollout : 0, bay: cc }; if (story()?.hull?.held()) { deploy = null; setPlayerDown(true); return true; }   /* NO HULL YET (src/fx/hull-issue.js): a growing page parks it unseen at its berth, not driven, not hit, until the Stålheart rolls it out */ if (deploy.clip) { cc.rolled = cc.rolling = true; cc.roll(0); playerMesh().visible = false; } return true;
  }

  // THE POSE THE WHOLE DESIGN HANGS OFF. Every prelude's last frame is this,
  // so "the cinematic's last frame is the first frame of the reset state" is
  // a property of the code rather than something tuned until it looks right.
  // A low three-quarter standing where the doors face, so the hull rolls
  // toward the lens.
  function deployFramePoseFor(n, out) {
    const b = berths()[n];
    if (!b) return;
    // AN AUTHORED ROLL-OUT IS WATCHED FROM BEHIND THE BAY, over its roof, the hull leaving toward the base: the gameplay pose is behind the hull too, so the 8 s blend never swings through it
    poseCamera(deployFraming(b, graph().centers, graph().normals, !!(lifeContainers()[n]?.rollout && (deploy?.clip || !lifeContainers()[n].rolled)), params.wallHeight, cellSide()), out);
  }

  // how far through the drive-out we are, eased — the camera blend and the
  // motion share one progress value so they cannot disagree
  function deployProgress() { const b = deploy && berths()[deploy.n]; return b ? deployU(deploy, b, graph().centers) : 1; }
  function deployEase() { return easeDeploy(deployProgress()); }

  // ...and the same liveness check on DEPLOY, which owns the camera between
  // the cinematic's last frame and the player's first. Its length is known:
  // the berth's own segment at the drive speed. A deploy that has been
  // running several times that is not deploying — and a stalled one leaves
  // the hull in its berth with the camera on the berth framing, which is the
  // other pose that is neither third nor orbit.
  const DEPLOY_GRACE = 6.0;
  function deployStep(dt) {
    if (!deploy) return;
    const b = berths()[deploy.n];
    if (!b) { deploy = null; return; }
    const v = params.speed * speedBonus() * cellSide() * 1.6;
    deploy.age = (deploy.age || 0) + dt;
    const segLen = Math.max(1e-9, dist3(...berthSeg(b)));
    // A DEPLOY WITH NO SPEED IS HUNG BY DEFINITION, so its expected duration is ZERO, not Infinity. The first cut wrote Infinity
    // here — mathematically honest, and it made the one case this check exists for (`params.speed` at 0, the hull never leaving
    // the berth) the one case it could never catch.
    const expect = deploy.clip || (v > 1e-9 ? segLen / v : 0);
    if (deploy.age > expect * 2 + DEPLOY_GRACE) {
      console.warn(`SHOTWATCH deploy hung: ${deploy.age.toFixed(1)}s for a ${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`
        + ` run (speed=${params.speed} bonus=${speedBonus()}) — handed over`);
      shots.hung(`deploy ${deploy.age.toFixed(1)}s/${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`);
      deploy.travelled = segLen;   // finish it where it was going, then hand over
    }
    deploy.travelled += v * dt; if (deploy.clip) { deploy.bay.roll(deploy.age); playerMesh().visible = false; }   // the clip's clock is the deploy's; a hull rebuilt meanwhile stays hidden
    const u = deployProgress();
    const [from, to] = berthSeg(b);
    const p = [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * u);
    player.pos = norm3(p);
    player.heading = berthDir(b);
    player.travelDir = player.heading.slice();
    player.smoothDir = player.travelDir.slice();
    const ci = cellIndex()(player.pos);
    if (ci !== -1 && ci !== player.cur) arriveAt(ci);
    if (u >= 1) {
      // hands over: manual, lever at zero, auto off. Because `keys` is HELD
      // state, a player already leaning on W drives on without a beat — and
      // forward is the direction the hull is already going, so the handover
      // is continuous rather than a stop.
      if (deploy.clip) { deploy.bay.rolling = false; playerMesh().visible = true; }   // hand over: the authored hull hides, ours stands where it stopped
      deploy = null; setThrottle(0); setCruise(false); setAutoMode(false); paintThrottle();
    }
  }

  return {
    active: deployActive, clip: () => deploy?.clip, state: () => deploy, set: (v) => (deploy = v), cancel: () => (deploy = null),
    start: deployStart, step: deployStep, framePoseFor: deployFramePoseFor, progress: deployProgress, ease: deployEase,
  };
}
