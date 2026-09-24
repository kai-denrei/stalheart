// THE SHOWCASE'S HOOKS: the controller's side of the intro montage (src/fx/showcase.js runs the rail, src/content/showcase.js
// holds the beat table). The rail drives the real systems through these and nothing else, so it needs no ?acceptance=1;
// `counters` is the cheap proof the --showcase browser step reads at every cut. Moved out of the game controller, where
// it was one 9.7 KB line of gameHooks.
//
// `host` hands in the controller: its fixed objects and functions as values, the state it rebinds as getters (story,
// storyBase, deploy, playerMesh, graph, dungeon, cellSide, pilot, pilotMode, isao, rs, ramCombo, playerHP), the four lets
// the montage writes as setters (setPaused, setFollowSuspend, setRamCam, setGunshipTrack), and placeTank from the
// acceptance hooks. The hooks call each other through the returned object, as they did through gameHooks.showcase.
import * as THREE from '../../vendor/three.module.js';
import { norm3, sub3 } from '../vec3.js';
import { BLOCKED } from '../dungeon.js';
import { cellsAhead } from '../domain/showcase-shot.js';
import { fillFromKill } from '../domain/gunship-call.js';
import { onStation, startStation, selectGun } from '../domain/gunship.js';
import { makeTrack } from '../domain/gunship-track.js';
import { GUNSHIP_CALL, GUNSHIP_GUNS, GUNSHIP_ORBIT, GUNSHIP_PLATFORM } from '../content/gunship.js';
import { startDiveShot } from './dive-shot.js';

export function createShowcaseHooks(host) {
  const { camera, enemies, spawnPoints, spawnQueue, towers, player, params, gunship, gunshipCall, explosions, gameBreaches, storyApi,
    gunshipFar, automated, shotId, endShot, startShot, snapCamera, setView, releaseSpawns, enterPilot, leavePilot, spawnIsao } = host;
  const hooks = {
    ready: () => {
      if (!host.story() || !host.storyBase() || !automated() || host.playerMesh()?.userData.loading || host.deploy()) return false;
      // THE PRE-ROLL IS THE LOAD: the montage's first frame waits here while the planet, the models and the base arrive, the
      // breach opens and the first bodies climb out of it, so the rail never opens on an empty yard
      if (!host.story().source?.alive) { storyApi.breach(gunshipFar()); return false; }
      // AND THE HOLE MUST BE OPEN: releaseSpawns holds every queued body until a breach has finished opening, so a montage
      // that starts before then spends its first beats with a full queue and floods when it finally lets go (measured: 294
      // queued bodies arriving in one frame at 19.5 s)
      if (hooks.source() < 0 || !spawnPoints.some((x) => x.alive && gameBreaches.ready(x.obj))) return false;
      if (!host.story().showcaseSeeded) { host.story().showcaseSeeded = true; hooks.swarm(10); }
      // six is enough to ram: the world holds about seventy bodies at once and queues the rest, so a fat pre-roll starves the
      // emergence shot
      return enemies.filter((e) => e.alive && e.id > 0 && e.spec.rammable && e.emergeAge >= 1.2).length >= 6;
    },
    begin: () => { endShot(); host.setPaused(false); params.callouts = false; },
    counters: () => ({
      // WHERE THE HULL IS ON SCREEN, in ndc: the ram beat's whole point is that the MÖRK is IN FRAME, and a rams counter cannot
      // tell a drive-through from a hull photographed off the bottom edge (docs/log/entries/2026-09-24-intro-four-beats-built.json)
      ...(() => {
        const v = player.pos ? new THREE.Vector3(player.pos[0], player.pos[1], player.pos[2]).project(camera) : null;
        return v ? { hullX: +v.x.toFixed(3), hullY: +v.y.toFixed(3), hullZ: +v.z.toFixed(3) } : {};
      })(),
      rams: host.rs().rams, combo: host.ramCombo(), hp: host.playerHP(), view: params.view, shot: shotId(), tankKills: host.rs().bySrc.tank, mag: gunship.mag,
      enemies: enemies.filter((e) => e.alive).length,
      emerging: enemies.filter((e) => e.alive && !e.guard && e.emergeAge < 1.2).length,
      explosions: Object.values(explosions.state().spawned).reduce((a, b) => a + b, 0),
      queued: spawnQueue.length,
      breaches: spawnPoints.filter((x) => x.alive && gameBreaches.ready(x.obj)).length,
      alive: enemies.filter((e) => e.alive && e.id > 0 && e.spec.rammable).length,
      seat: host.pilot()?.gunship ? 'gunship' : host.pilot()?.state?.tower?.key ?? null,
    }),
    source: () => {
      if (!host.story()) return -1;
      // A BREACH THE SWARM CAN USE: releaseSpawns holds the queue until the hole has finished opening, so the montage takes a
      // breach that is already open (the sector's own) over a fresh one it would have to wait out
      const sp = spawnPoints.find((x) => x.alive && gameBreaches.ready(x.obj));
      if (sp) { host.story().source = sp; return sp.ci; }
      if (!host.story().source?.alive) storyApi.breach(gunshipFar());
      return host.story().source?.ci ?? -1;
    },
    // no stagger by default: a queued spawn waits on the spawn clock, which does not always run between waves, and a montage
    // cannot wait for it. THE MONTAGE RELEASES ITS OWN: the spawn clock only turns over inside the wave loop, so a queued swarm
    // can sit there for a shot or two — this drains what is due now, through the same release path and the same
    // breach-is-open gate
    swarm: (n = 30, type = 'amoeba', gap = 0) => {
      const ci = hooks.source();
      if (ci < 0) return 0;
      for (let i = 0; i < n; i++) storyApi.spawn(type, ci, { spread: 0.9, delay: i * gap });
      releaseSpawns(0);
      return n;
    },
    tremor: () => storyApi.tremor(hooks.source()),
    ground: (ci, height = 4, back = 4) => {
      if (ci < 0) return;
      endShot(); host.setPaused(false);
      startDiveShot({ camera, startShot, cellSide: host.cellSide() }, new THREE.Vector3(...norm3(host.graph().centers[ci])),
        { id: 'showcaseGround', hold: 600, fromCamera: true, dive: { height, back, diveSeconds: 0.35 } });
    },
    // THE RAM BEAT'S CAMERA, on: low behind the hull, nose into the frame (src/domain/showcase-shot.js). The view still has to
    // be 'third' — the DRIVE is gated on it (`driving` in the step loop), and a hull that is not driving rams nothing — but
    // the pose is the beat's, not the game's. Off at the cut out of the beat: the gunship's seat outranks it anyway, but the
    // last card's closeup is a shot and shots are checked ABOVE this.
    ram: (on = true) => {
      host.setRamCam(!!on);
      // AND THE SEALED CAPS GO: the beat opens on the lane at a breach the sector seals under it, and the cap piles up on that
      // very lane — a grey boulder mid-frame with the hull inside it (the still of 2026-09-24)
      gameBreaches.rubbleShow(!on);
      if (!on) return false;
      endShot(); host.setPaused(false); host.setFollowSuspend(false); setView('third'); snapCamera();
      return true;
    },
    // the hull's own chase camera: a cinematic shot latches the camera AND holds the drive, and the ram is the hull moving
    follow: () => { endShot(); host.setPaused(false); host.setFollowSuspend(false); setView('third'); snapCamera(); },
    // A HORDE UNDER THE BELLY, NOW: releaseSpawns holds a breach's queue until the hole is open, and a breach the sector has
    // closed never opens again — so the gunship beat drops its own bodies at the same cell through the guard path, which
    // carries its own spawn point and is released the moment it is asked for. The same bodies, the same spec: only the gate
    // is different. Dropped at the breach, or ROUND THE HULL ('tank'): a tank thrown into a horde is through it in half a
    // second, and the beat is a beat of driving through bodies, not of chasing them.
    drop: (n = 30, at = 'breach') => {
      // AHEAD ('ahead'): a wall of bodies across the lane 2-5 cells in FRONT of the hull, which is the only placement a
      // drive-through can read — dropped round the hull it is already among them on the first frame (src/domain/showcase-shot.js
      // cellsAhead)
      if (at === 'ahead') {
        const cs = player.pos ? cellsAhead({ pos: player.pos, dir: player.smoothDir, centers: host.graph().centers, cellSide: host.cellSide(), open: (c) => host.dungeon().tags[c] !== BLOCKED }) : [];
        if (!cs.length) return 0;
        for (let i = 0; i < n; i++) {
          const c = cs[i % cs.length];
          storyApi.spawn('amoeba', c, { spread: 0.7, guard: { site: 'showcase', c: host.graph().centers[c], r: host.cellSide() * 3 } });
        }
        releaseSpawns(0);
        return n;
      }
      const ci = at === 'tank' ? player.cur : hooks.source();
      if (ci < 0) return 0;
      for (let i = 0; i < n; i++) storyApi.spawn('amoeba', ci, { spread: 1.2, guard: { site: 'showcase', c: host.graph().centers[ci], r: host.cellSide() * 5 } });
      releaseSpawns(0);
      return n;
    },
    // THE HULL AT THE HOLE: the tank starts the run parked at the base, a long drive from the breach, and a five-second beat
    // cannot cover that drive — so the ram beat opens with the hull already standing on the lane the swarm is walking up
    lane: () => {
      const ci = hooks.source();
      if (ci < 0) return false;
      host.placeTank(host.graph().adj[ci].find((c) => host.dungeon().tags[c] !== BLOCKED) ?? ci);
      return true;
    },
    // A BODY THAT IS STANDING, not one still climbing: a creature mid-emergence is inside the rock with no contact to make, and
    // the hull dropped onto the hole rams nothing — measured as a ram beat that placed the tank thirty times for no ram at all
    // while seventy bodies sat in the shaft. The LAST such body, not the first: the newest is the one that just came up out of
    // the breach this beat is about, while the oldest is a guard standing over a site on the far side of the map. On ground
    // the hull can stand on, too: dropped onto rock it sits inside the rubble and the chase camera photographs a boulder
    ramNext: () => {
      const e = enemies.findLast((x) => x.alive && x.id > 0 && x.spec.rammable && x.emergeAge >= 1.2 && host.dungeon().tags[x.cur] !== BLOCKED);
      if (!e) return false;
      host.placeTank(e.cur);
      return true;
    },
    gunship: () => {
      fillFromKill(gunshipCall, 99, GUNSHIP_CALL);
      if (!onStation(gunship)) startStation(gunship, GUNSHIP_ORBIT);
      if (!host.pilotMode()) enterPilot(towers.map((tw) => tw.ci));
      endShot();
      return host.pilot()?.mountGunship?.() === 'mounted';
    },
    gun: (k) => selectGun(gunship, k, GUNSHIP_GUNS),
    // FRAME THE HORDE, NOT THE BASE: the ground track creeps toward a loaded breach over a whole pass
    // (src/domain/gunship-track.js), which the montage's six-second beat does not have — so it is placed over the breach
    // outright and steerTrack loiters it there
    track: (ci) => {
      if (ci < 0 || !host.story()) return false;
      const hc = host.graph().centers[host.dungeon().heart];
      host.setGunshipTrack(makeTrack(host.graph().centers[ci], sub3(host.graph().centers[ci], hc)));
      return true;
    },
    hold: (on = true) => { if (host.pilot()) host.pilot().state.held = !!on; },
    // THE SEAT AIMS ITSELF, not a tower: the gunner's aim is a yaw and a pitch relative to the PLATFORM, and the platform's
    // heading is laid from the base toward the breach by `track`, so yaw 0 looks along its own nose at the hole it is flying
    // to. The pitch must be a real look DOWN or the optic's ray never strikes the ground, and a gun with no impact cell fires
    // nothing however hard the trigger is held (src/sentry-pilot.js gunshipTick: `impact = G.aim(...)`) — the seat opens on
    // whatever pitch it was left with, which on a page that has taken no seat is the horizon.
    aim: (pitch = -1.2) => {
      if (!host.pilot()?.gunship) return null;
      host.pilot().state.yaw = 0;
      host.pilot().state.pitch = Math.max(GUNSHIP_PLATFORM.pitchMin, Math.min(GUNSHIP_PLATFORM.pitchMax, pitch));
      return host.pilot().state.pitch;
    },
    leave: () => { if (host.pilotMode()) leavePilot(); },
    // he is only in the world while he has an order: the last card prints him first, then takes the story's own face-on
    // closeup (storyApi.closeup)
    isao: () => {
      if (!host.isao()) spawnIsao();
      storyApi.closeup();
      return !!host.isao();
    },
  };
  return hooks;
}
