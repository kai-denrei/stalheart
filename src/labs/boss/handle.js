// handle.js — the boss lab's acceptance handle (window.__bossLab, published only with ?acceptance=1): the methods the browser suites
// drive the lab by, moved out of boss-tab.js (bait-mode spec, Task 0) so the bait and the seat have room to grow beside it. The lab's
// own state reaches it through getters (a creature reload, a size change, a re-anchor or a new fight is seen at once); the two it
// assigns, the scripted input and the pinTo hold, through setters. The methods are the lab's own, moved verbatim.
import { readout as fightReadout } from '../../domain/boss-fight.js';

export function createLabHandle({
  getCreature, getScale, getT, getFight, getGameCam, getReanchors, setScripted, setPin,
  readout, setLure, setCam, setMode, bait, seat, setFight, fireCannon, copySettings, reset, tryReanchor, placeTank, creatureNow,
  plane, drive, keys, state, cam, params, gui, arena, fear, fightTune,
}) {
  const lab = {
    readout,
    creature: () => getCreature(),
    setLure,
    // the bait mode: mode('bait') or mode('tank') switches (a new round, as the panel's select does) and returns the mode; bait() is
    // Isao now, { pos: [x, z], hp, max, heading, alt, gone, fleeing, gap, hits, said } with `gap` his metres beyond the creature's front
    // edge along the line toward him (null before his first round)
    mode: (m) => (m === undefined ? state.mode : (setMode(m), state.mode)),
    bait: () => bait.state(),
    // the gunner seat (bait mode): aim([x, z]) puts the reticle on a local ground point (until the pointer moves), gun(key) picks
    // 'rotary' | 'bofors' | 'nuke' (the MK-9; 'heavy' and 1-3 too) and returns it, fire(on) holds or lets go of the trigger (the MK-9 fires
    // once per hold; in the tank mode `fire(true)` is the cannon and `fire(false)` does nothing); seat() is { gun, reticle, look, zoom, held, shots: { rotary, bofors, nuke } }
    aim: (at) => seat.aim(at), gun: (key) => seat.gun(key), fire: (on = true) => (state.mode === 'bait' ? seat.fire(on) : (on ? fireCannon() : false)), seat: () => seat.state(),
    // a stopped tank; `near` puts it `at` native metres from the creature's centre, on the side it already stands. The
    // default 0.05 is inside the kit's 0.075 capture radius and can land under an arm: a prey inside the skin never lets the
    // cradle finish (its minimum gap stays below -0.0005), so a meal is tested from outside the reach, as the kit's prey is
    stopTank({ near = false, at = 0.05 } = {}) {
      const creature = getCreature(), scale = getScale();
      keys.clear(); setScripted(null); plane.reset();
      if (near && creature) {
        const c = creature.motion.center, cx = c.x * scale, cz = c.z * scale;
        let dx = drive.x - cx, dz = drive.z - cz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        const r = at * scale;
        plane.reset(cx + dx * r, cz + dz * r);
      }
      return { x: drive.x, z: drive.z };
    },
    driveTank(seconds = 1, turn = 0) { setScripted({ throttle: 1, turn, until: getT() + seconds }); return true; },
    // the driving camera: camera('game') or camera('lab') sets it (V and the panel do the same); the game camera's state:
    // { mode, eye, look, pose: { eye, look }, rear: { x, y, w, h }, ms }, eye and look where the camera is and pose the game's tankViewPose
    // for the smoothed state, all in the scene's metres; rear the inset's box in device pixels from the canvas's bottom left, ms its cost
    camera: (mode) => (setCam(mode), state.cam),
    cam: () => { const gameCam = getGameCam(); return { mode: state.cam, on: !!gameCam?.isOn(), fov: cam.fov, ...(gameCam ? gameCam.state() : {}) }; },
    // scripted input each frame for `seconds`: orbit the creature's centre at `radius` metres with the game's drive
    circle(seconds = 10, radius = 40) { setScripted({ circle: radius, until: getT() + seconds }); return true; },
    // the survival run's player: the circle at `near` metres, widened while a nuke's ring shows (its plan between showAt and land on the
    // lab's clock `t`, which the plans are made on) to `far` metres, or wider where the ring's point is (it lies up to tens of metres off
    // the creature's centre, so a circle of `far` about the centre can still cross it): far enough to keep the hull clear of the ring's
    // edge by 3 m. Back to `near` after the landing. Acceptance only: the rules never see it
    dodge(seconds = 60, near = 45, far = 75) {
      const radius = () => {
        const fight = getFight(), t = getT();
        let r = near;
        for (const p of fight.strikes) {
          if (p.kind !== 'nuke' || t < p.showAt || t >= p.land) continue;
          const c = creatureNow().centre;
          r = Math.max(r, far, Math.hypot(p.at[0] - c[0], p.at[1] - c[1]) + p.radius + fightTune.hull.radius + 3);
        }
        return r;
      };
      setScripted({ circle: radius, until: getT() + seconds });
      return true;
    },
    // stop beside the creature, outside the kit's reach (see stopTank), so the creature walks onto it and takes it
    park: () => lab.stopTank({ near: true, at: 0.15 }),
    setFight,
    // the arena: the live obstacles' ids, the push-out's nodes moved in the last step (`pushed`), its mean cost per step (`ms`) and the
    // local [i, x, y, z] (node index and position) of those nodes (`pushedNodes`, for the jitter) the lab's clock `clock` (seconds) and the re-anchor count (the nodes' local positions jump by the shift across one)
    arena: () => { const s = arena.stats(); return { live: arena.live(), pushed: s.pushed, ms: s.ms, pushedNodes: s.nodes, clock: getT(), reanchors: getReanchors(), at: Object.fromEntries(arena.shapes.map((sh) => [sh.id, [...sh.at]])) }; },
    // the measurement's hold: the creature's target on the shape's centre for `seconds` of lab clock with the routing off, the tank
    // parked behind it (the far side from the creature, outside the shape plus 6 m) and held still; null for an unknown id
    pinTo(id, seconds = 10) {
      const creature = getCreature(), scale = getScale();
      const sh = arena.shapes.find((s) => s.id === id);
      if (!sh || !creature) return null;
      const c = creature.motion.center, cx = c.x * scale, cz = c.z * scale;
      let dx = sh.at[0] - cx, dz = sh.at[1] - cz; const d = Math.hypot(dx, dz);
      if (d > 1e-6) { dx /= d; dz /= d; } else { dx = 1; dz = 0; }
      const out = (sh.kind === 'rock' ? sh.radius : sh.size[0] / 2) + 6;
      keys.clear();
      plane.reset(sh.at[0] + dx * out, sh.at[1] + dz * out, Math.atan2(-dx, -dz));
      setScripted({ throttle: 0, turn: 0, until: getT() + seconds });   // held: no input moves it, and a held tank is not a meal
      setPin({ id, shape: sh, until: getT() + seconds });
      placeTank();
      return { id, at: [...sh.at], tank: { x: drive.x, z: drive.z } };
    },
    // park the tank on the far side of the shape from the creature, `off` metres off the shape's face and not held (no input, no
    // throttle): the case a held tank hides, a stopped tank the creature must go round the shape to reach. Acceptance only
    parkBehind(id = 'r1', off = 8) {
      const creature = getCreature(), scale = getScale();
      const sh = arena.shapes.find((s) => s.id === id);
      if (!sh || !creature) return null;
      const c = creature.motion.center, cx = c.x * scale, cz = c.z * scale;
      let dx = sh.at[0] - cx, dz = sh.at[1] - cz; const d = Math.hypot(dx, dz);
      if (d > 1e-6) { dx /= d; dz /= d; } else { dx = 1; dz = 0; }
      const out = (sh.kind === 'rock' ? sh.radius : sh.size[0] / 2) + off;
      keys.clear(); setScripted(null); setPin(null);
      plane.reset(sh.at[0] + dx * out, sh.at[1] + dz * out, Math.atan2(-dx, -dz));
      placeTank();
      return { id, at: [...sh.at], radius: sh.kind === 'rock' ? sh.radius : null, tank: { x: drive.x, z: drive.z } };
    },
    // the state readout; `centre` and `contacts` ([[x, z], ...], the floor nodes) in local metres, as the rules see the body
    fight: () => {
      const creature = getCreature(), fight = getFight();
      const c = creature ? creatureNow() : { centre: null, contacts: [] };
      return { ...fightReadout(fight), phase: fight.phase, reason: fight.reason, strikes: fight.strikes.map((p) => p.kind), nukes: fight.strikes.filter((p) => p.kind === 'nuke').map((p) => ({ showAt: p.showAt, land: p.land, at: [...p.at], radius: p.radius })), ...fear.counts(), fearMode: fear.mode(), centre: c.centre, contacts: c.contacts };
    },
    // the panel's instinct switch: off holds the creature still (the balance's standing body)
    setInstinct(on) {
      const creature = getCreature();
      params.instinct = !!on;
      if (creature) creature.motion.active = params.instinct;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      return params.instinct;
    },
    copySettings, reset, reanchor: () => tryReanchor(0),
  };
  return lab;
}
