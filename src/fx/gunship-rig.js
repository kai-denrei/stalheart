// THE GUNSHIP RIG: the game controller's side of the gunship. The platform's rules are src/domain/gunship.js, the call meter
// src/domain/gunship-call.js, the ground track src/domain/gunship-track.js and the lane queries src/domain/gunship-lanes.js; the
// seat is src/sentry-pilot.js. The rig holds what the controller kept in loose lets beside the strike — the optic and the KORP
// body (src/fx/gunship-optic.js), the ground track, the MK-9 in the world (src/fx/gunship-drop.js), the walls the danger report
// counts, and the call meter — steps them in the frame, resets them with a new run, hands the seat its gunship bag and the
// acceptance probe its gunship. Moved out of the controller unchanged.
//
// `host` hands in the controller: its fixed objects and functions as values; everything it rebinds, or declares further down
// than the rig, as getters (story, storyViews, graph, dungeon, cellSide, pilot, pilotHost, isao, t, gunshipBriefing, enemies,
// spawnPoints, debris, player, towers, strikeTune); cellIndex as a call-through; and the two lets the seat's framing writes as
// setters (setFollowSuspend, setBuildDist).
import { sub3, scale3, norm3, len3 } from '../vec3.js';
import { BLOCKED } from '../dungeon.js';
import { makeDotBurst } from '../units.js';
import { makeGunship, stepGunship, onStation, phaseLeft, passProgress, mountGunship, dismountGunship, selectGun, stepGun, aimOnSphere, splashDamage, dangerReport, fireRound, stepRounds, paintHeavy, launchHeavy, nudgeHeavy, stepHeavy, heavyState } from '../domain/gunship.js';
import { makeGunshipCall, fillFromKill, isFull as callFull, passEnded, callProgress } from '../domain/gunship-call.js';
import { makeTrack, steerTrack, parkTrack, breachLoads } from '../domain/gunship-track.js';
import { farCell, laneCell } from '../domain/gunship-lanes.js';
import { hasPerk as programmeHas } from '../domain/build-programme.js';
import { BASE_PERKS } from '../content/base-programme.js';
import { GUNSHIP_CALL, GUNSHIP_FAR, GUNSHIP_GUNS, GUNSHIP_GUN_ORDER, GUNSHIP_NUKE, GUNSHIP_ORBIT, GUNSHIP_PLATFORM, GUNSHIP_TRACK } from '../content/gunship.js';
import { createGunshipOptic } from './gunship-optic.js';
import { createGunshipDrop } from './gunship-drop.js';

export function createGunshipRig(host) {
  const { scene, sfx, explode, automated, gunship, strike, sealedBreachCells, camDist, cellAtScreen, centerBuildOnHeart, damageEnemy, executeStrike, warnRing, showRangeRing, hideRangeRing } = host;
  let optic = null, track = null, walls = null, drop = null;
  // THE CALL METER RUNS after the handover, or once sector 0's free pass has come (src/domain/story-beats.js construction). A
  // kill's biomass feeds it, times the base programme's gunship perk once that is built.
  const onCall = () => automated() || !!host.story()?.gunshipIn;
  const call = makeGunshipCall(GUNSHIP_CALL);
  const feed = (n) => { if (onCall()) fillFromKill(call, n * (host.story()?.programme && programmeHas(host.story().programme, 'gunship') ? BASE_PERKS.gunshipMeter : 1), GUNSHIP_CALL); return n; };
  // a breach a minute's walk out, and where the bodies come from (src/domain/gunship-lanes.js)
  const far = () => farCell(host.graph(), host.dungeon(), sealedBreachCells, host.cellSide(), GUNSHIP_FAR);
  const lane = () => laneCell(host.story(), host.dungeon());

  // THE FRAME'S GUNSHIP, where the controller's frame steps it: inside `!player.won && !frozen`, after the debris and before the
  // wave clock and the strike's ration. The orbital window fills in game time, like everything else there.
  const tick = (dt) => {
    const held = (onCall() || !!host.story()?.grow) && !onStation(gunship), ev = held ? null : stepGunship(gunship, dt, GUNSHIP_ORBIT);
    if (onCall() && ev === 'depart') passEnded(call, GUNSHIP_CALL);
    // A GROWING PAGE'S GUNSHIP IS IN ORBIT from the start and comes on station when sector 0 calls it (storyApi.gunshipArrive);
    // after that free pass the meter runs as after the handover
    if (held) host.storyViews()?.meter(callProgress(call), callFull(call)); else host.storyViews()?.station(onStation(gunship), phaseLeft(gunship));
    // THE SHIP CREEPS TOWARD THE BREACHES (src/domain/gunship-track.js): the live spawn points, each with the enemies near it;
    // none, over the base
    if (host.story()) {
      const hc = host.graph().centers[host.dungeon().heart];
      track ??= makeTrack(hc, sub3(host.graph().centers[lane()], hc));
      if (onStation(gunship)) steerTrack(track, breachLoads(host.spawnPoints().filter((sp) => sp.alive).map((sp) => host.graph().centers[sp.ci]), host.enemies(), GUNSHIP_TRACK.nearCells * host.cellSide()), hc, dt, GUNSHIP_TRACK, host.cellSide());
      else parkTrack(track);
      (optic ??= createGunshipOptic(scene, { cellSide: host.cellSide(), metresPerCell: GUNSHIP_PLATFORM.metresPerCell })).ride(track.pos, track.heading, onStation(gunship), len3(hc));
    }
    if (ev === 'depart') walls = null;
    // THE MK-9 IS A BODY IN THE WORLD (src/fx/gunship-drop.js): it drops from the belly, and the motor lighting is heard and seen
    (drop ??= createGunshipDrop(scene, {
      cellSide: host.cellSide(),
      metresPerCell: GUNSHIP_PLATFORM.metresPerCell,
      onRelease: (p) => sfx.play(GUNSHIP_NUKE.releaseSound, { dist: camDist(p) }),
      onIgnite: (p) => {
        sfx.play(GUNSHIP_NUKE.igniteSound, { dist: camDist(p) });
        if (!explode('gunship.ignite', p)) {
          const b = makeDotBurst(0xffd27f, norm3(p), 40);
          b.scale.setScalar(host.cellSide() * 0.7);
          b.position.set(p[0], p[1], p[2]);
          scene.add(b);
          host.debris().push(b);
        }
      },
    })).tick(dt);
    host.pilot()?.gunshipTick?.(dt);
  };

  // A NEW RUN LEAVES NOTHING BEHIND (2026-09-25): the gunship, its meter, its track and an MK-9 still falling go with the old
  // world (the optic is kept, as it always was).
  const reset = () => {
    Object.assign(gunship, makeGunship(GUNSHIP_ORBIT, { station: new URLSearchParams(location.search).get('gunship') === 'station' }));
    Object.assign(call, makeGunshipCall(GUNSHIP_CALL));
    drop?.dispose();
    drop = null;
    track = null;
    walls = null;
  };

  // THE SEAT'S GUNSHIP (src/sentry-pilot.js reads it as pilotHost.gunship): a fresh bag for each seat the controller builds, as
  // its literal made one, so `tune`, `centers` and `normals` are the ones of that moment.
  const pilotBag = () => ({
    state: gunship,
    strike,
    tune: host.strikeTune(),
    guns: GUNSHIP_GUNS,
    order: GUNSHIP_GUN_ORDER,
    platform: GUNSHIP_PLATFORM,
    centers: host.graph().centers,
    normals: host.graph().normals,
    heart: () => host.dungeon().heart,
    lane,
    cell: (p) => host.cellIndex(norm3(p)),
    cellAt: (x, y) => cellAtScreen(x, y),
    frame: (n, d) => { centerBuildOnHeart(n); host.setFollowSuspend(true); if (d) host.setBuildDist(Math.min(4, Math.max(1.4, d))); },
    enemies: () => host.enemies().filter((e) => e.alive && e.id > 0),
    damage: (e, d) => damageEnemy(e, host.t(), d, true, 'strike', gunship.gun),
    onStation: () => onStation(gunship),
    left: () => phaseLeft(gunship),
    progress: () => passProgress(gunship, GUNSHIP_ORBIT),
    mount: () => mountGunship(gunship),
    dismount: () => dismountGunship(gunship),
    select: (k) => selectGun(gunship, k, GUNSHIP_GUNS),
    step: (dt, held) => stepGun(gunship, dt, held, GUNSHIP_GUNS),
    fire: (g, p, travel) => fireRound(gunship, g, p, travel),
    landed: () => stepRounds(gunship),
    aim: aimOnSphere,
    splash: splashDamage,
    // the danger report's bodies: walls cached per pass, the rest live
    bodies: () => [
      ...(walls ??= Array.from(host.dungeon().tags, (tg, ci) => tg === BLOCKED && (!host.story() || host.story().inside(ci)) ? { kind: 'wall', pos: host.graph().centers[ci] } : null).filter(Boolean)),
      ...host.towers().map((tw) => ({ kind: 'tower', pos: host.graph().centers[tw.ci] })),
      { kind: 'tank', pos: host.player().pos },
      ...(host.isao() ? [{ kind: 'isao', pos: host.isao().obj.position.toArray() }] : []),
    ],
    danger: (p, r) => dangerReport(p, r, host.pilotHost().gunship.bodies()),
    blast: (ci) => { if (ci >= 0) executeStrike(ci, host.t(), 'gunship.nuke', GUNSHIP_GUNS.heavy.blastCells); },
    drop: { release: (from, to, up, vel) => !!drop?.release(from, to, up, vel), steer: (to) => drop?.steer(to) },
    vel: () => track ? scale3(track.heading, track.speed * host.cellSide()) : [0, 0, 0],
    explode: (use, p) => explode(use, p),
    puff: (ci, hex, life, r) => { if (ci >= 0) warnRing(ci, hex, life, r); },
    sfx: (name, pos, o) => { if (name) sfx.play(name, { dist: camDist(pos), ...o }); },
    burst: (p, hex, n, scale) => { const b = makeDotBurst(hex, norm3(p), n); b.scale.setScalar(host.cellSide() * scale); b.position.set(p[0], p[1], p[2]); scene.add(b); host.debris().push(b); },
    laser: (ci) => { if (ci >= 0) showRangeRing(ci, host.strikeTune().blastCells, 0xff2a1a); else hideRangeRing(); },
    loop: (name, o) => sfx.loop(name, o),
    paintHeavy: (ci) => paintHeavy(gunship, ci, GUNSHIP_GUNS),
    launchHeavy: () => launchHeavy(gunship, GUNSHIP_GUNS),
    nudgeHeavy: (ci) => nudgeHeavy(gunship, ci),
    stepHeavy: () => stepHeavy(gunship),
    heavyState: () => heavyState(gunship, GUNSHIP_GUNS),
    get optic() { return optic ??= createGunshipOptic(scene, { cellSide: host.cellSide(), metresPerCell: GUNSHIP_PLATFORM.metresPerCell }); },
  });

  // THE ACCEPTANCE PROBE'S GUNSHIP (state().gunship): the platform's clock and guns, the seat, the MK-9, the lane and the track
  const probe = () => ({
    phase: gunship.phase,
    left: +gunship.left.toFixed(2),
    mounted: gunship.mounted,
    gun: gunship.gun,
    passes: gunship.passes,
    optic: !!optic?.active(),
    station: onStation(gunship),
    seat: !!host.pilot()?.gunship,
    heavy: heavyState(gunship, GUNSHIP_GUNS),
    nuke: drop ? { ready: drop.ready(), flying: !!drop.mesh(), ignited: drop.ignited() } : null,
    heat: +gunship.heat.toFixed(2),
    overheated: gunship.overheated,
    mag: gunship.mag,
    briefing: !!host.gunshipBriefing()?.isOpen(),
    lane: host.pilotHost()?.gunship?.lane() ?? -1,
    aim: host.pilot()?.gunshipOptic?.()?.pos ?? null,
    aimCell: host.pilot()?.gunshipOptic?.()?.pos ? host.cellIndex(norm3(host.pilot().gunshipOptic().pos)) : -1,
    track: track && { pos: track.pos, heading: track.heading, speed: track.speed, target: track.pick?.pos ?? null, home: !!track.pick?.home, enemies: track.pick?.enemies ?? 0, cellSide: host.cellSide() },
  });

  return {
    call, onCall, feed, far, lane, tick, reset, pilotBag, probe,
    // the MK-9 in flight, for the story monitor's feed
    get drop() { return drop; },
    // the base's walls went up: the danger report counts them afresh
    forgetWalls: () => { walls = null; },
    // the showcase lays the track over the breach it is flying to
    setTrack: (v) => { track = v; },
  };
}
