// THE EXPEDITIONS IN THE GAME (owner, 2026-09-14; seen and heard, docs/superpowers/specs/2026-09-15-v1-session-design.md section 3).
// Moved out of src/td-tab.js's storyApi: a site's nest rises where the site stands; with the guards down our flag goes up there
// and the part's crate waits beside it; the tank drives in and the crate swings onto its back deck (PART SECURED); home at the
// landing it drops off the back (<TOWER> UNLOCKED) and a trophy flag goes up; a lost hull throws it off and the site's flag comes
// down and goes up again over the part. The rules are src/domain/expeditions.js; the look is src/fx/cargo.js. The controller
// hands in what it owns as hooks and never sees the cargo.
import * as THREE from '../../vendor/three.module.js';
import { reveal, guardsCleared, reach, deliver, deliverAtOnce, hullLost, nextReveals } from '../domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';
import { CARGO_LOOK } from '../content/cargo.js';
import { TOWER_BY_KEY } from '../towers.js';
import { norm3 } from '../vec3.js';
import { createCargo } from './cargo.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unitArr = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const towerName = (key) => String(TOWER_BY_KEY[key]?.label ?? key).replace(/^\d+\.\s*/, '').toUpperCase();

// tangent at `from` toward `to`, on the sphere through the origin
function toward(from, to) {
  const n = v3(from).normalize(), d = v3(to).sub(v3(from));
  d.addScaledVector(n, -d.dot(n));
  return d.lengthSq() > 1e-14 ? d.normalize() : new THREE.Vector3().crossVectors(Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), n).normalize();
}
// a point `metres` along a tangent, put back on the ground's radius
const along = (origin, dir, dist) => { const o = v3(origin), r = o.length(); return o.addScaledVector(dir, dist).setLength(r); };

// hooks: { story, scene, sfx, hasCue(key), cellSide, centers(), tankPos(), hull(), guardsLeft(id), spawn(type, cell, o), revealSite(id),
//          landing() -> Object3D | null (the landing island's frame), brief(id), callout(text), toast(towerKey), look?,
//          receive?({ point, normal, seconds, bed, done }) -> boolean (an order for Isao to fly to the crate and beam it; done() when he has) }
export function createExpeditionGlue(h) {
  const look = h.look ?? CARGO_LOOK, metres = h.cellSide / 10;
  const ex = () => h.story.expeditions, cellOf = (id) => h.story.siteCells[id];
  let cargo = null, receipt = null;
  const fx = () => (cargo ??= createCargo(h.scene, { sfx: h.sfx, hasCue: h.hasCue, metres, look }));
  const homeAt = () => h.centers()[h.story.home];

  function sitePose(id) {
    const c = h.centers()[cellOf(id).cell], dir = toward(c, homeAt()), p = along(c, dir, look.siteOffset * metres);
    return { point: p, normal: p.clone().normalize(), facing: dir };
  }
  // the trophy row: along the landing island's edge in its own frame when the base has one, else beside home
  function trophyPose(i) {
    const holder = h.landing?.(), home = homeAt(), n = v3(home).normalize();
    let origin = v3(home), fwd = toward(home, [0, 0, 0].map((_, k) => home[k] + (Math.abs(n.y) < 0.9 ? [0, 1, 0] : [1, 0, 0])[k])), right;
    if (holder) {
      holder.updateWorldMatrix(true, false);
      const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
      holder.matrixWorld.extractBasis(x, y, z);
      origin = new THREE.Vector3().setFromMatrixPosition(holder.matrixWorld);
      fwd = z.normalize(); right = x.normalize();
    }
    right ??= new THREE.Vector3().crossVectors(n, fwd).normalize();
    const slot = (i - (STORY_EXPEDITIONS.sites.length - 1) / 2) * look.trophyGap;
    const p = origin.clone().addScaledVector(fwd, look.trophyEdge * metres).addScaledVector(right, slot * metres).setLength(origin.length());
    return { point: p, normal: p.clone().normalize(), facing: fwd };
  }

  // ISAO RECEIVES THE PART (a V1 known gap: the crate landed and the unlock was called with nobody there). The crate waits on the
  // ground while the host sends him over; his print beam wanders over it (the bed is the crate's top, base-print's `over:` shape)
  // for look.receive.seconds, and only then the unlock is called, the cue plays and the trophy goes up. No host receive hook, or
  // a crate that sank before he came (holdMax, or pushed out by newer crates): the unlock is called at once, as before.
  function beginReceipt(r, at, up) {
    const p = v3(at), n = v3(up).normalize(), rc = look.receive ?? { seconds: 0, metres: 2, spread: 1 };
    const t1 = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(n, t1);
    const bed = (ox, oy) => p.clone().addScaledVector(n, rc.metres * metres).addScaledVector(t1, ox * rc.spread * metres).addScaledVector(t2, oy * rc.spread * metres).toArray();
    r.held = true;
    const sent = h.receive?.({ point: at, normal: up, seconds: rc.seconds, bed, done: () => endReceipt(r) });
    if (!sent) endReceipt(r);
  }
  function endReceipt(r) {
    if (r.done) return;
    r.done = true; r.held = false;
    h.callout(`${towerName(r.tower)} UNLOCKED`); h.toast?.(r.tower); h.sfx?.play('tower_upgrade');
    const t = trophyPose(r.index); fx().trophy(r.index, t.point, t.normal, t.facing);
  }

  const glue = {
    openSite(id) {
      const cfg = STORY_EXPEDITIONS.sites.find((s) => s.id === id), c = cellOf(id);
      if (!cfg || !c || !reveal(ex(), id)) return;
      h.revealSite(id);
      for (const g of cfg.guards) for (let k = 0; k < g.count; k++) h.spawn(g.type, c.cell, { spread: 1.2, delay: k * 0.3, guard: { site: id, c: h.centers()[c.cell], r: h.cellSide * (c.clear / 10 + 2) } });
    },
    begin() { for (const s of STORY_EXPEDITIONS.sites) if (!s.reveal) glue.openSite(s.id); },
    // THE SKIP TUTORIAL ENTRY (owner, 2026-09-16): these parts came home before the player arrived. The rule says
    // delivered, the lander stands revealed, our flag is up over the emptied site with no crate waiting beside it, and a
    // trophy stands in the row at home — so the world reads as a run that has already been somewhere. Returns the towers.
    preDeliver(ids) {
      const e = ex(), towers = [];
      for (const id of ids) {
        const tower = deliverAtOnce(e, id);
        if (!tower) continue;
        towers.push(tower);
        h.revealSite(id);
        if (cellOf(id)) { const p = sitePose(id); fx().raiseFlag(id, p.point, p.normal, p.facing, { crate: false, standing: true }); }
        const index = e.sites.filter((s) => s.state === 'delivered').length - 1, t = trophyPose(index);
        fx().trophy(index, t.point, t.normal, t.facing);
      }
      return towers;
    },
    step() {
      const e = ex(), centers = h.centers(), pos = h.tankPos();
      for (const s of e.sites) {
        const c = cellOf(s.id); if (!c) continue;
        if (s.state === 'guarded' && !h.guardsLeft(s.id)) { guardsCleared(e, s.id); h.brief('site_cleared'); }
        if (s.state === 'cleared' && !fx().hasFlag(s.id)) { const p = sitePose(s.id); fx().raiseFlag(s.id, p.point, p.normal, p.facing); }
        if (s.state === 'cleared' && !e.carrying && chord(pos, centers[c.cell]) < h.cellSide * (c.clear / 10 + 1) && reach(e, s.id)) {
          fx().pickUp(s.id, h.hull);
          h.callout(`PART SECURED · ${String(STORY_EXPEDITIONS.sites.find((x) => x.id === s.id)?.part ?? 'part').toUpperCase()}`);
        }
      }
      const carried = e.carrying;
      if (carried && chord(pos, homeAt()) < h.cellSide * STORY_EXPEDITIONS.deliverCells) {
        const tower = deliver(e);
        if (tower) {
          h.brief('part_home');
          const index = e.sites.filter((s) => s.state === 'delivered').length - 1, ground = v3(pos);
          fx().lowerFlag(carried);
          const r = receipt = { tower, index, held: false, done: false };
          fx().drop(ground, ground.clone().normalize(), (at, up) => beginReceipt(r, at, up), () => r.held);
          const more = nextReveals(e);
          for (const id of more) glue.openSite(id);
          if (more.length) h.brief('sites_revealed');
        }
      }
      h.story.hud.sites(e.sites.filter((s) => (s.state === 'guarded' || s.state === 'cleared' || s.state === 'carried') && (s.state === 'carried' || !!cellOf(s.id)))
        .map((s) => ({ dir: unitArr(centers[s.state === 'carried' ? h.story.home : cellOf(s.id).cell]), state: s.state })));
    },
    // the hull is gone: the part goes back to its site (the rule), the crate tumbles off and the site's flag comes down (the look);
    // the next step raises the flag again over the part once it is down
    hullLost() {
      const e = ex(), id = e?.carrying;
      if (!e || !hullLost(e)) return false;
      if (cargo) { cargo.throwOff(); cargo.lowerFlag(id); }
      return true;
    },
    // an open cell to stand the tank on for a close look: within reach of the site (or of home), never the structure's own cell
    // `open(ci)` is the controller's word for floor the tank may stand on: a rock or wall cell renders raised, and a camera on it is inside the rock
    standCell(kind, id = null, open = () => true) {
      const centers = h.centers(), site = kind === 'site' ? cellOf(id) : null;
      if (kind === 'site' && !site) return -1;
      const p = site ? sitePose(id) : trophyPose((STORY_EXPEDITIONS.sites.length - 1) / 2);
      const target = along(p.point, p.facing, (site ? 8 : 6) * metres), avoid = site ? site.cell : h.story.home;
      const reachAt = site ? centers[site.cell] : homeAt(), reachR = h.cellSide * (site ? site.clear / 10 + 1 : STORY_EXPEDITIONS.deliverCells);
      let best = -1, bestD = Infinity;
      for (let i = 0; i < centers.length; i++) {
        if (i === avoid || !open(i)) continue;
        const d = chord(centers[i], [target.x, target.y, target.z]);
        if (d < bestD && chord(centers[i], reachAt) < reachR * 0.9) { best = i; bestD = d; }
      }
      // a lander stands in a pocket of rock: when no open floor is in reach, the nearest cell still serves the acceptance route
      return best < 0 && open.length ? glue.standCell(kind, id) : best;
    },
    // what stands between two world points, nearest first, for the acceptance stills: [name, metres from `from`, visible]
    sight(scene, from, to) {
      const a = v3(from), dir = v3(to).sub(a), len = dir.length(), ray = new THREE.Raycaster(a, dir.normalize(), 0, len * 1.2);
      ray.params.Points.threshold = metres * 0.05; ray.params.Line.threshold = metres * 0.05;
      const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      let hits = [];
      try { hits = ray.intersectObjects(scene.children, true); } catch (e) { return [[`raycast failed: ${e}`, 0, false]]; }
      return hits.slice(0, 6).map((x) => [`${x.object.parent?.name || '-'}/${x.object.name || x.object.type}/${[x.object.material].flat()[0]?.name || '-'}`, +(x.distance / metres).toFixed(1), shown(x.object)]).concat([['target', +(len / metres).toFixed(1), true]]);
    },
    tick(dt) {
      cargo?.tick(dt);
      /* the crate he was coming for is gone (holdMax, or pushed off the landing by newer crates): the part is in all the same */
      if (receipt?.held && !cargo?.state().crates.some((p) => p === 'fall' || p === 'settle' || p === 'rest')) endReceipt(receipt);
    },
    view: (kind, id) => cargo?.view(kind, id) ?? null,
    state: () => ({ ...(cargo ? cargo.state() : { carrying: null, attached: false, flags: [], trophies: 0, crates: [], errors: [] }), receiving: !!receipt?.held }),
    dispose() { cargo?.dispose(); cargo = null; },
  };
  return glue;
}

// THE CONTROLLER'S SIDE, moved out of the controller's storyApi unchanged; the controller merges it back into storyApi.
// expeditions() builds the glue once per story (story.glue) with the controller's hooks above; expeditionsBegin and
// expeditionStep drive it, through storyApi.expeditions as before, when the story has expeditions.
// `c` hands in the controller: its fixed objects and functions as values (storyApi, scene, sfx, the three sound tables SOUNDS,
// BREACH_SOUNDS and STORY_SOUNDS, player, enemies, spawnQueue, orders, showBrief, showCallout, showTowerToast, spawnIsao,
// updateHud) and what it rebinds as getters (story, graph, cellSide, playerMesh, storyBase, cellIndex).
export function createExpeditionsHost(c) {
  const { storyApi, scene, sfx, SOUNDS, BREACH_SOUNDS, STORY_SOUNDS, player, enemies, spawnQueue, orders, showBrief, showCallout, showTowerToast, spawnIsao, updateHud } = c;
  return {
    // THE EXPEDITIONS (owner, 2026-09-14), seen and heard: the nests, our flags, the crate on the back deck and the trophies live in
    // src/fx/expedition-glue.js; the controller hands it what it owns
    expeditions: () => (c.story().glue ??= createExpeditionGlue({
      story: c.story(), scene, sfx, hasCue: (k) => !!(SOUNDS[k] || BREACH_SOUNDS[k] || STORY_SOUNDS[k]), cellSide: c.cellSide(),
      centers: () => c.graph().centers, tankPos: () => player.pos, hull: () => c.playerMesh(),
      guardsLeft: (id) => enemies.some((e) => e.alive && e.guard?.site === id) || spawnQueue.some((q) => q.guard?.site === id),
      spawn: (...a) => storyApi.spawn(...a), revealSite: (id) => c.storyBase()?.reveal(id), landing: () => c.storyBase()?.structure('foundry')?.holder ?? null,
      brief: showBrief, callout: (text) => showCallout(text, 'co-cargo'), toast: showTowerToast,
      // ISAO RECEIVES THE PART: an order that yields to every other (stepWorker)
      receive: (r) => { orders.push({ kind: 'receive', ci: c.cellIndex()(norm3(r.point)), cost: 0, seconds: r.seconds, bed: r.bed, done: r.done }); spawnIsao(); updateHud(); return true; },
    })),
    expeditionsBegin: () => { if (c.story()?.expeditions) storyApi.expeditions().begin(); },
    expeditionStep: () => { if (c.story()?.expeditions) storyApi.expeditions().step(); },
  };
}
