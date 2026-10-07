// THE ENEMY LOOP (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the board's enemies and gates: clearing and
// seeding them, the breach portals and their deaths, arming and spawning a wave, the staggered release from the spawn queue, every
// enemy's frame (walk, scare, shove, ram, the heart) and a creature's death. The lists (enemies, spawnPoints, spawnQueue) stay the
// controller's and come in as values; the wave clock's lets (wave, waveActive, waveAge, waveIn, waveCharge, warnBeat, interClock)
// and the ram combo's are written through setters.
import { waveGap } from '../domain/wave-spread.js';
import { emergence } from '../domain/breach-waves.js';
import { stampScare, scarePace, isScared, towardScare, awayExits } from '../domain/impact-scare.js';
import { SCARE_FREEZE_S } from '../content/explosions.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';
import { sinkholeGroundHeight } from '../core/sinkhole-shape.js';
import { CONTENT } from '../content/runtime.js';
import { record } from '../diagnostics.js';
import { guardExits } from '../domain/guard-aggro.js';
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { sub3, add3, scale3, dot3, norm3, dist3, tangentBasis } from '../vec3.js';
import { makeDebris, makeDotBurst, makeDotEnemy } from '../units.js';
import { CREATURE_TINTS, ENEMY_SPEC, INTROS, computeWavePlan, accentFor } from '../enemyspec.js';
import { waveReset as shieldWaveReset, shoveVec, shoveMag } from '../shield.js';
import { TOWER_ORDER } from '../towers.js';
import { showContact } from './contact-card.js';
import { grantStrikes } from '../strike.js';
import { makeDotSquad } from './squads.js';
import { DEATH_KEYS } from '../audiomanifest.js';

export function createEnemyStep(host) {
  // --- enemies: easy AI, they only wander ----------------------------------
  function clearEnemies() {
    for (const e of host.enemies) {
      host.scene.remove(e.obj);
      // traverse, not e.obj.geometry: a non-rammable enemy carries a solid
      // core as a CHILD, and disposing only the root leaks it every wipe
      host.disposeObj(e.obj);
    }
    host.enemies.length = 0;
  }

  function spawnEnemies() {
    // battle reset — clear all enemies and gates, then seed the starting
    // neutral portals; the wave plan decides what pours out of them
    clearEnemies();
    host.gameBreaches.reset();
    host.spawnQueue.length = 0; host.setSpawnClock(0);
    for (const sp of host.spawnPoints) {
      host.scene.remove(sp.obj);
      host.disposeObj(sp.obj);
      if (sp.mapMarker) { host.scene.remove(sp.mapMarker); host.disposeObj(sp.mapMarker); }
    }
    host.spawnPoints.length = 0;
    host.setWave(0);
    host.setWaveActive(false); host.setWaveAge(0); host.setInterClock(host.params.waveGap * 0.5);
    host.setPortalDist(null);
    clearTimeout(host.waveTimer());
    host.waveEl.classList.add('hidden');
    host.seenTypes.clear();
    seedPortals(2);
    // a new game means a new magazine: leftovers do not survive regenerate
    host.strike.reserved = 0; host.strike.ready = 0; host.strike.gauge = 0;
    host.strike.armed = false; host.strike.target = -1; host.strike.falling = -1;
    grantStrikes(host.strike, host.spawnPoints.filter((sp2) => sp2.alive).length, host.strikeTune);
  }

  // cheap hop estimate for spreading spawn points (chord distance in cells)
  function hopEstimate(a, b) {
    return dist3(host.graph().centers[a], host.graph().centers[b]) / host.cellSide();
  }

  // a sector's gates are spatial sources, not type-bound — place one far
  // from the heart, spread from existing gates; 3 hits to destroy
  function addSpawnPoint() {
    let maxD = 0;
    for (let i = 0; i < host.dungeon().tags.length; i++) {
      if (host.dungeon().tags[i] !== BLOCKED) maxD = Math.max(maxD, host.dungeon().distToHeart[i]);
    }
    let best = -1, bs = -1;
    for (let ci = 0; ci < host.dungeon().tags.length; ci++) {
      if (host.dungeon().tags[ci] === BLOCKED || host.dungeon().distToHeart[ci] < maxD * 0.55) continue;
      if (host.spawnPoints.some((s) => s.ci === ci)) continue;
      let s = host.dungeon().distToHeart[ci];
      for (const other of host.spawnPoints) s += Math.min(20, hopEstimate(ci, other.ci));
      if (s > bs) { bs = s; best = ci; }
    }
    if (best === -1) best = host.dungeon().spawn;
    // the source is a PORTAL, standing upright like a gate (local +Y =
    // surface normal); neutral tint — the wave plan decides what pours out
    const obj = host.buildPortalObj(best, host.whim()() * 6.283);
    host.scene.add(obj);
    // minimap beacon — neutral blue, dark until the player FINDS the source
    const mapMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x9fdcff }));
    const mm = scale3(host.graph().centers[best], 1 + host.params.wallHeight * 1.6);
    mapMarker.position.set(mm[0], mm[1], mm[2]);
    mapMarker.visible = false;
    mapMarker.layers.set(host.MAP_LAYER);   // map only
    host.scene.add(mapMarker);
    host.spawnPoints.push({ ci: best, hp: 3, obj, alive: true, found: false, mapMarker });
    host.recomputePortalDist();
  }

  // a sector's gates are spatial sources, not type-bound — seed a small
  // fixed set; the wave plan decides what pours out of them
  function seedPortals(n) { if (host.storyMode()) return; for (let i = 0; i < n; i++) addSpawnPoint(); }

  // a ground breach closes only to a strike or exhaustion; a shell on it marks it on the scope. A sector's breach takes three
  function gateTakesShell(sp) {
    sp.found = true; if (host.sectorRun()?.owns(sp) && --sp.hp <= 0) killPortal(sp, 'shells');
    return false;
  }

  function killPortal(sp,reason='impact') {
    if(!sp.alive)return;
    if(sp.obj.userData.breach&&!['strike','gunship','shells','laser','exhausted'].includes(reason))return;
    sp.alive = false; host.sectorRun()?.closed(sp, reason);   // a story sector books who closed its breach
    // THE GATE GOES LIKE THE TANK GOES (operator): its own wreckage, a big burst in its own colour, and the heavy sound — the
    // same three parts as destroyPlayer, because that is the vocabulary the board already has for "something substantial just
    // ended".
    const nrm = norm3(host.graph().centers[sp.ci]);
    host.sfx.play('tank_destroyed');
    if (sp.obj) {
      if(!sp.obj.userData.breach){const fx = makeDebris(sp.obj, nrm);host.scene.add(fx);host.debris.push(fx);}
      const burst = makeDotBurst(0x8fe8ff, nrm, 90);
      burst.scale.setScalar(host.cellSide() * 1.6);
      const bp = scale3(nrm, 1 + host.cellSide() * 0.6);
      burst.position.set(bp[0], bp[1], bp[2]);
      host.scene.add(burst); host.debris.push(burst);
    }
    if(sp.obj.userData.breach){host.gameBreaches.seal(sp.obj);host.sealedBreachCells.add(sp.ci);}
    else {host.scene.remove(sp.obj);host.disposeObj(sp.obj);}
    if (sp.mapMarker) { host.scene.remove(sp.mapMarker); host.disposeObj(sp.mapMarker); }
    sp.mapMarker = null;
    host.recomputePortalDist();
  }

  // Arm the next wave: one entry point, so nothing can spawn unannounced. Idempotent — a stalled field re-asks every frame and
  // must not re-fire the cue or reset the countdown it is already running. First dangerous contact of the wave: klaxon + a
  // CRT-red warning. Once per wave BY DESIGN — a constant siren is the alarm you learn to ignore.
  const dangerEl = host.root.querySelector('#td-danger');
  let dangerTimer = null;
  function dangerFlash() {
    host.sfx.play('danger_alert');
    if (!dangerEl) return;
    dangerEl.classList.remove('hidden');
    clearTimeout(dangerTimer);
    dangerTimer = setTimeout(() => dangerEl.classList.add('hidden'), 1900);
  }

  function armWave() { if (host.storyMode() && !host.automated()) return;   // the story world has no wave clock until the handover
    if (host.waveIn() >= 0) return;
    // THE SECTOR HAS A FIXED PROGRAMME. Once it is spent no more waves are sent, whatever the clock thinks — the remaining gates
    // are a mop-up, not a siege, and a sector that kept sending waves forever would make the wave count meaningless again.
    if (host.sectorRun() ? !host.sectorRun().canRelease() : host.programmeDone()) return;   // the story's sectors own their breaches and their programmes (src/fx/sector-run.js)
    host.hideSitrep(); // the telegraph outranks the recap
    if (!host.storyMode()) host.showBrief('motive');   // why they come, as the first one is dialled (the story's sector brief says it)
    host.setWaveIn(host.WAVE_WARN);
    host.setWarnBeat(0);
    host.setWaveCharge(0);
  }

  function spawnWave() {
    host.setWaveIn(-1);
    host.resetWaveStats();
    // the release — a wide, brief ring from every gate that is opening
    for (const sp of host.spawnPoints) {
      if (sp.alive) host.warnRing(sp.ci, CREATURE_TINTS[sp.type] ?? 0xffffff, 0.75, host.cellSide() * 5.5);
      if (sp.alive) {
        sp.obj.scale.setScalar(sp.obj.userData.sizeScale ?? 1);
        if (sp.obj.userData.setDim) sp.obj.userData.setDim(1);
      }
    }
    host.setWaveCharge(0);
    host.setWarnBeat(0);
    host.setWave(host.wave() + 1);
    record('wave.start', { wave: host.wave(), sector: host.round(), biomass: host.eco().biomass });
    shieldWaveReset(host.shield, host.shieldTune);   // the heart pad refills each wave
    host.setWaveActive(true); host.setWaveAge(0);
    host.tfMilestone(host.wave());   // the Terraformer keeps time in waves
    const plan = computeWavePlan(host.wave(), host.round(), host.params.waveSize, (host.lab.on ? host.lab.waveMult : 1) * host.threatMult());
    // NEW THREAT reveal the first time a headline type appears
    if (!host.storyMode() && !host.seenTypes.has(plan.headline)) {   // the story's sectors brief their own threats
      host.seenTypes.add(plan.headline);
      const intro = INTROS.find((iv) => iv.type === plan.headline);
      if (intro) host.announceWave(intro);
    }
    // one new tower unlocks per wave through wave 8
    if (!host.storyMode() && host.wave() >= 1 && host.wave() <= TOWER_ORDER.length) host.showTowerToast(TOWER_ORDER[host.wave() - 1]);   // the story unlocks towers by expedition
    const live = host.spawnPoints.filter((s) => s.alive);
    if (host.sectorRun()) { for (const q of host.sectorRun().release()) host.spawnQueue.push({ ...q, at: host.spawnClock() + q.at }); host.spawnQueue.sort((a, b) => a.at - b.at); releaseSpawns(0); }   // the story's sectors: every live breach sends its own programme wave, and queued guards stay queued
    else if (live.length) {
      const gap = waveGap(plan.entries, host.SPAWN_SPREAD, host.SPAWN_GAP_MAX);
      host.spawnQueue.length = 0;
      host.setSpawnClock(0);
      let pi = 0, n = 0;
      for (const { type, count } of plan.entries) {
        for (let k = 0; k < count; k++) {
          host.spawnQueue.push({ type, sp: live[pi % live.length], at: n * gap });
          pi++; n++;
        }
      }
      // the FIRST one is already through, so a wave never opens on an empty
      // field while the clock counts
      releaseSpawns(0);
    }
    host.updateHud();
  }

  function releaseSpawns(dtSeconds) {
    host.setSpawnClock(host.spawnClock() + (dtSeconds)); host.crowdGate.frame(host.enemies, dtSeconds > 0);
    while (host.spawnQueue.length && host.spawnQueue[0].at <= host.spawnClock()) {
      const entry = host.spawnQueue.shift(), { type, sp } = entry;   // a story swarm entry also carries delay, spread and harmless
      if (!sp.alive) continue;   // its gate died while it was queued
      if(!host.gameBreaches.ready(sp.obj)||host.crowdGate.full(entry)){host.spawnQueue.unshift({...entry,at:host.spawnClock()});break;}
      const spec = ENEMY_SPEC[type]; if (host.storyMode() && !entry.guard && !host.seenTypes.has(type)) { host.seenTypes.add(type); showContact(host.root, type); }   // first contact: src/fx/contact-card.js
      const obj = (entry.squad ? makeDotSquad : makeDotEnemy)(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) }, entry.dens, entry.squad);
      const size = spec.size * 0.7;
      const scale0 = host.cellSide() * size;
      obj.scale.setScalar(scale0); obj.userData.s0 = scale0;
      host.scene.add(obj);
      const exits = host.openNeighbors(sp.ci);
      host.enemies.push({
        id: (host.setNextEnemyId(host.nextEnemyId() + 1) - 1),
        type, spec, scale0, size: size * (obj.userData.reach ?? 1),breachSource:sp.obj.userData.breach?sp.obj:null,emergeAge:-(entry.delay??0),harmless:!!entry.harmless,emergeOff:entry.spread?(()=>{const [u,v]=tangentBasis(norm3(host.graph().centers[sp.ci])),a=host.whim()()*6.283,r=Math.sqrt(host.whim()())*entry.spread*host.cellSide();return add3(scale3(u,Math.cos(a)*r),scale3(v,Math.sin(a)*r));})():null,   // THE SWARM (owner, 2026-09-13): the whole crater boils, not one point
        cur: sp.ci, prev: -1,
        next: exits.length ? exits[Math.floor(host.whim()() * exits.length)] : sp.ci,
        prog: sp.obj.userData.breach?0:host.whim()() * 0.4, pos: host.graph().centers[sp.ci].slice(), dir: [0, 1, 0],
        obj, alive: true, phase: host.whim()() * 6.283,
        // a deterministic pace of its own: identical speeds are what let a
        // clump that chose the same exit stay one silhouette all the way in
        paceJitter: (0.9 + host.whim()() * 0.22) * (entry.pace ?? 1),   /* a spawn may set its own march: the story swarm surges up the lane */
        hp: spec.hp * (entry.squad || 1), members: entry.squad || 0, behMult: 1, behUntil: -1, touchCd: -1,
        slowFactor: 1, slowUntil: -1, guard: entry.guard ?? null,
      });
    }
  }


  const ENEMY_SPEED = 1.0; // cells/s toward the Heart — FASTER still
  function updateEnemies(dt, tNow) {
    releaseSpawns(dt);
    for (const e of host.enemies) {
      if (!e.alive) continue;
      const spec = e.spec;
      if(e.breachSource&&e.emergeAge<1.2){
        e.emergeAge+=dt;const f=emergence(Math.max(0,e.emergeAge),1.2),entry=e.breachSource.userData.breach;
        const height=-CONTENT.breach.craterRadius*.55*host.cellSide()+e.scale0*(e.obj.userData.lift??.85)*f.rise-e.scale0*(1-f.rise);
        const n=norm3(e.emergeOff?add3(host.graph().centers[e.cur],e.emergeOff):host.graph().centers[e.cur]);e.pos=n;e.obj.position.fromArray(scale3(n,1+height));e.obj.scale.setScalar(e.scale0*f.scale);e.obj.material.opacity=.95*f.opacity;
        e.obj.quaternion.copy(e.breachSource.quaternion);e.obj.userData.tick?.(tNow+e.phase);continue;
      }
      // HK healOOC: regenerators knit themselves back together while
      // nothing has hit them for 1.2 s — burst them down or ram them
      if (spec.regen && e.hp < spec.hp && tNow - (e.lastHitT ?? -9) > 1.2) {
        e.hp = Math.min(spec.hp, e.hp + spec.regen * dt);
        const sv = e.scale0 * (0.7 + 0.3 * e.hp / spec.hp);
        e.obj.scale.setScalar(sv);
        e.obj.userData.s0 = sv;
      }
      let pace = ENEMY_SPEED * spec.speed * (e.paceJitter ?? 1);
      if (tNow < e.behUntil) pace *= e.behMult; stampScare(e, tNow); pace *= scarePace(e, tNow, SCARE_FREEZE_S); // on-hit reaction window; an impact's scare stops it, then hurries it away (src/domain/impact-scare.js)
      if (tNow < e.slowUntil) pace *= e.slowFactor; // slow-tower debuff
      // the slow READS for its full duration: the whole cloud tints ice —
      // and so does the solid core, or a slowed drifter would show a frozen
      // cloud around a body still in its own colour
      const slowed = tNow < e.slowUntil;
      // white clears the tint on the CLOUD (vertexColors multiply), but a
      // solid has to be restored to the colour it was built with
      // A MESH-BODIED ENEMY MAY NOT HAVE A `.color`. Every hostile was a dot
      // cloud or a lambert solid when this was written, so it reached straight
      // through the material — and the jelly's ShaderMaterial has no such
      // property, so the first boss to arrive threw once per frame. Units that
      // know how to be tinted say so; the rest keep the old path, guarded.
      if (e.obj.userData.setTint) e.obj.userData.setTint(slowed ? 0x8fd4ff : null);
      else if (e.obj.material && e.obj.material.color) {
        e.obj.material.color.setHex(slowed ? 0x8fd4ff : 0xffffff);
      }
      const solid = e.obj.userData.solid;
      if (solid && solid.material) {
        solid.material.color.setHex(slowed ? 0x8fd4ff : (solid.userData.baseColor ?? 0xffffff));
      }
      // erratic (phage): HokorobiTawaa velocity bursts, 0.7×–1.3×
      if (spec.erratic) pace *= 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(tNow * 3.1 + e.phase * 7));
      // jink (saucer): a second, faster weave stacked on the bursts —
      // 0.55×–1.45× at 6.3 rad/s reads as a dogfight, not a walk
      if (spec.jink) pace *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(tNow * 6.3 + e.phase * 11));
      // tactician (shellback): holds at the EDGE of tower coverage until enough minions arrive to soak fire, then bursts through
      // with them. Re-evaluated at 2 Hz, staggered by phase — towers are few, and a per-frame sweep would be spent on a decision
      // that changes slowly.
      if (spec.tactician) {
        if (tNow >= (e.tacUntil ?? 0)) {
          e.tacUntil = tNow + 0.5 + e.phase * 0.1;
          let covered = false;
          for (const tw of host.towers()) {
            const r = host.effectiveStats(tw.def, tw.tier).range * host.cellSide();
            if (host.chord()(host.graph().centers[tw.ci], e.pos) < r + host.cellSide() * 1.2) { covered = true; break; }
          }
          if (!covered) e.tacMult = 1;
          else {
            let cover = 0;
            for (const e2 of host.enemies) {
              if (e2.alive && e2 !== e && dist3(e2.pos, e.pos) < host.cellSide() * 2.4) cover++;
            }
            e.tacMult = cover >= 3 ? 1.9 : 0.3; // burst with the pack, or wait
          }
        }
        pace *= e.tacMult ?? 1;
      }
      // STAGGERED: it stands where it was thrown. Zeroing `pace` and not
      // `e.prog` is deliberate — the path is untouched, so when it recovers it
      // carries on from exactly where it was rather than restarting a cell.
      if (tNow < (e.stagUntil ?? -1)) pace = 0;
      // cloaked (phantom): optical camo. A haze most of the time — the
      // cloud sits near-invisible — with a brief shimmer of presence every
      // ~6s. The radar shares the same decloak window: no window, no blip.
      if (spec.cloaked) {
        const vis = ((tNow * 0.16 + e.phase) % 1) < 0.12;
        const op = vis ? 0.55 : 0.14 + 0.05 * Math.sin(tNow * 2.7 + e.phase * 9);
        if (e.obj.material) e.obj.material.opacity = op;
        const core = e.obj.userData.solid;
        if (core && core.material) {
          core.material.transparent = true;
          core.material.opacity = Math.min(1, op * 1.6); // the glint lags the fade
        }
        e.decloaked = vis;
      }
      if (isScared(e, tNow) && e.prog < 1 && towardScare(host.graph().centers[e.cur], host.graph().centers[e.next], e.scareFrom)) { const back = e.cur; e.cur = e.next; e.next = back; e.prog = 1 - e.prog; } e.prog += pace * dt;
      while (e.prog >= 1) {
        e.prog -= 1;
        e.prev = e.cur;
        e.cur = e.next;
        // heart-seeking: drawn HARD toward the heart — only a sliver of
        // wobble left so the streams braid but visibly converge
        const exits = host.openNeighbors(e.cur).filter((c) => !host.story()?.sealed(c));   // a closed story gate is a wall to them
        let pool = null; if (isScared(e, tNow)) { const away = awayExits(exits, host.graph().centers, e.cur, e.scareFrom); if (away.length) pool = away; }
        if (!pool) { const down = exits.filter((c) => host.dungeon().distToHeart[c] < host.dungeon().distToHeart[e.cur]); pool = (down.length && host.whim()() > 0.05) ? down : exits; }
        // THE STORY'S HARD CORES HOLD OFF THE WALL: once inside the holding ring they only wander within it (operator, while the lock is tuned)
        if (e.guard) pool = guardExits({ exits, centers: host.graph().centers, guard: e.guard, cur: e.cur, hull: host.playerHP() > 0 && !host.playerDown() ? host.player.pos : null, aggro: STORY_EXPEDITIONS.aggro }); else if (host.story()?.ring.size && e.type === host.story().hardcore && host.story().ring.has(e.cur)) { const stay = exits.filter((c) => host.story().ring.has(c)); pool = stay.length ? stay : [e.cur]; }
        e.next = pool.length ? pool[Math.floor(host.whim()() * pool.length)] : e.cur;
      }
      const a = host.graph().centers[e.cur];
      const b = host.graph().centers[e.next];
      const f = Math.min(e.prog, 1);
      e.pos = norm3([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
      // THE SHOVE IS AN OFFSET, NOT A MOVE. e.pos is rebuilt from the cell path every frame, so writing a displaced position
      // lasts exactly one tick. Applied HERE, after the interpolation and re-normalised onto the sphere, it decays and the body
      // slides back into its own lane.
      if (e.shove) {
        e.shove.t -= dt;
        if (e.shove.t <= 0) e.shove = null;
        else {
          const off = shoveMag(e.shove, host.shieldTune) * host.cellSide();
          e.pos = norm3(add3(e.pos, scale3(e.shove.dir, off)));
        }
      }
      const n = e.pos;
      const raw = sub3(b, e.pos);
      const flat = sub3(raw, scale3(n, dot3(raw, n)));
      const l = Math.hypot(flat[0], flat[1], flat[2]);
      if (l > 1e-9) e.dir = scale3(flat, 1 / l);
      const s = host.cellSide() * (e.size ?? spec.size);
      let lift = s * (e.obj.userData.lift ?? 0.85);
      if(e.breachSource){const entry=e.breachSource.userData.breach;if(entry){const local=new THREE.Vector3(...e.pos).applyMatrix4(entry.fx.inverseFrame.value),r=entry.fx.tune.planetRadius;local.y+=r;const a=Math.atan2(Math.hypot(local.x,local.z),local.y)*r,angle=Math.atan2(local.z,local.x);lift+=sinkholeGroundHeight(Math.cos(angle)*a,Math.sin(angle)*a,entry.fx.hole.value)*host.cellSide();}}

      e.obj.position.set(e.pos[0] + n[0] * lift, e.pos[1] + n[1] * lift, e.pos[2] + n[2] * lift);
      host.tmpObj.position.copy(e.obj.position);
      host.tmpObj.up.set(n[0], n[1], n[2]);
      host.tmpObj.lookAt(e.obj.position.x + e.dir[0], e.obj.position.y + e.dir[1], e.obj.position.z + e.dir[2]);
      e.obj.quaternion.copy(host.tmpObj.quaternion);
      if (e.obj.userData.tick) e.obj.userData.tick(tNow + e.phase);

      // the Heart: contact costs heartDmg and consumes the creature
      if (dist3(e.pos, host.graph().centers[host.dungeon().heart]) < host.cellSide() * 0.75) {
        killCreature(e);
        if (!e.harmless) host.heartHit(spec.heartDmg);   /* harmless fodder cannot hurt the heart */
        continue;
      }
      // the player's tank is strong: fodder dies under the treads for
      // free; the dangerous tier hurts to touch and shrugs the ram off
      // (per-enemy cooldown so overlap isn't a blender)
      const touchR = host.cellSide() * Math.max(0.4, (e.size ?? spec.size) * 0.8);
      // a unit that HURTS to touch is closing in: warn, once per wave
      if (!host.playerDown() && !spec.rammable && host.dangerWarnedWave() !== host.wave()
          && dist3(e.pos, host.player.pos) < host.cellSide() * 3.5) {
        host.setDangerWarnedWave(host.wave());
        dangerFlash();
      }
      // A WALKER IS IN THE FIGHT, so the fight can reach it. Only the dangerous tier does anything — the fodder the A6 refuses to
      // shoot at cannot hurt it either, which is the same asymmetry the tank lives under and the reason the A6's own targeting
      // rule is not a free pass.
      if (!spec.rammable) {
        for (const tw of host.towers()) {
          if (!tw.a6 || tw.hp <= 0) continue;
          if (dist3(e.pos, tw.a6.pos) > touchR + host.cellSide() * 0.3) continue;
          if (tNow <= (e.a6Cd ?? -1)) continue;
          e.a6Cd = tNow + 1.2;
          tw.hp -= 1;
          const bn = norm3(tw.a6.pos);
          const spark = makeDotBurst(0xff7744, bn, 14);
          spark.scale.setScalar(host.cellSide() * 0.5);
          spark.position.set(tw.a6.pos[0], tw.a6.pos[1], tw.a6.pos[2]);
          host.scene.add(spark); host.debris.push(spark);
          if (tw.hp <= 0) host.killWalker(tw);
        }
      }
      if (!host.playerDown() && dist3(e.pos, host.player.pos) < touchR) {
        if (spec.rammable) {
          // run over: tinted splat under the treads + the weight bump
          const burst = makeDotBurst(CREATURE_TINTS[e.type], n);
          burst.scale.setScalar(host.cellSide() * 0.8);
          const bp = add3(e.pos, scale3(n, host.cellSide() * 0.12));
          burst.position.set(bp[0], bp[1], bp[2]);
          host.scene.add(burst);
          host.debris.push(burst);
          host.setBumpLeft(host.BUMP_LEN);
          for (let m = e.members || 1; m > 0; m--) {   // a squad rams as its members
          const kg = host.gunshipRig.feed(host.eco().award(spec.bounty, { ram: true })); // the ram premium
          host.scoreKill(spec.bounty, { src: 'tank', ram: true,
            alive: host.enemies.filter((x) => x.alive).length });
          host.setRamCombo(host.ramCombo() + 1); host.setRamComboT(host.RAM_COMBO_GAP); host.ramFloat.show(host.player.pos, kg, host.ramCombo());   // +N kg ×M over the hull (src/fx/ram-readout.js)
          host.noteWaveKill(e.type, 'tank'); host.sectorRun()?.kill(e, 'ram', host.ramCombo());
          if (host.ws()) host.ws().rams++;
          if (host.rs()) { host.rs().rams++; host.rs().maxCombo = Math.max(host.rs().maxCombo, host.ramCombo()); }
          host.syncCombo();
          if (host.ramCombo() >= 10 && host.ramCombo() % 10 === 0) {
            host.showCallout(`RAM ×${host.ramCombo()}`, 'co-milestone');
          }
          host.noteStreak();
          host.harvestTankKill(spec);
          }
          killCreature(e, true);
          host.checkVictory();
          continue;
        }
        if (host.shieldUp()) {
          // PUSHED ASIDE, NOT DESTROYED. No damage either way and no shield time spent: the bubble is mobility, never a weapon. A
          // shielded tank that killed the hard tier would make `rammable` stop being the read the whole board is built on, and
          // that read is worth more than the damage would be.
          if (tNow > e.touchCd) {
            e.touchCd = tNow + 0.4;
            e.shove = { dir: shoveVec(e.pos, host.player.pos, host.player.heading), t: host.shieldTune.shoveLife };
            e.stagUntil = tNow + host.shieldTune.shoveStun;
            host.playerHit(e.type, e.pos);   // the ripple and the hull bump, no HP
          }
          continue;   // NOT a ram: pays nothing, scores nothing, combo untouched
        }
        if (tNow > e.touchCd && !e.harmless) { e.touchCd = tNow + 1.2; host.playerHit(e.type, e.pos); }   // the story's first wave cannot hurt the tank
      }
    }   let live = 0; for (const e of host.enemies) if (e.alive) host.enemies[live++] = e; host.enemies.length = live;   /* THE DEAD ARE LET GO (2026-09-25): killCreature only marks a record, and every per-frame walk over this array paid for every body ever spawned (~28 KB each, ~100 MB by sector 3). Compacted in place once a frame, after the walk: nothing keeps an index into it across frames */
  }

  function killCreature(e, fx = false) {
    e.alive = false;
    // gated on fx: killCreature is ALSO called with fx=false to tear the
    // board down (tutorial clear, wave reset, regenerate). Ungated, a
    // regenerate would fire a death-sound storm.
    if (fx) {
      host.sfx.play(DEATH_KEYS[Math.floor(host.deathPick()() * DEATH_KEYS.length) % DEATH_KEYS.length],
        { dist: host.camDist(e.pos) });
    }
    // mesh enemies blow apart; dot-clouds burst into tinted dots
    if (fx && e.obj.userData.kind === 'mesh') {
      const d = makeDebris(e.obj, norm3(e.pos));
      host.scene.add(d);
      host.debris.push(d);
    } else if (fx) {
      const d = makeDotBurst(CREATURE_TINTS[e.type] ?? 0xffffff, norm3(e.pos), 24);
      d.scale.setScalar(host.cellSide() * 0.6);
      const dp = add3(e.pos, scale3(norm3(e.pos), host.cellSide() * 0.15));
      d.position.set(dp[0], dp[1], dp[2]);
      host.scene.add(d);
      host.debris.push(d);
    }
    host.scene.remove(e.obj);
    host.disposeObj(e.obj);
    host.updateHud();
  }
  return { clearEnemies, spawnEnemies, hopEstimate, addSpawnPoint, seedPortals, gateTakesShell, killPortal, armWave, spawnWave, releaseSpawns, updateEnemies, killCreature };
}
