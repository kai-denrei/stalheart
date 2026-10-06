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
import { makePadRing, glowPadRing } from './shield-array.js';

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
  // where a part waits: its site, or the cell a hull carrying it was lost on (src/domain/expeditions.js hullLost)
  const spotOf = (id) => { const at = ex()?.sites.find((x) => x.id === id)?.at; return Number.isInteger(at) ? { cell: at, clear: 10 } : cellOf(id); };
  let cargo = null, receipt = null, sign = null, signAsked = false, pad = null;
  // THE DROP-OFF POINT, SIGNED (owner, 2026-10-05: "there should be a dedicated drop-off point in the base ... re-use a minimalist version of
  // a scoreboard to write DROP-OFF POINT"): a small split-flap board at the head of the trophy row, facing out where the hulls come in,
  // with the parts HOME, waiting in the FIELD and the SITES known. Made once the first site is out; a page without a document has none
  function signStep(e) {
    if (!signAsked && typeof document !== 'undefined' && h.scene && e.sites.some((s) => s.state !== 'hidden')) {
      signAsked = true;
      import('./scoreboard.js').then(({ createScoreboard }) => {
        const p = trophyPose(-1.6);
        sign = createScoreboard(h.scene, { at: p.point.toArray(), up: p.normal.toArray(), facing: p.facing.toArray(), metres: metres * look.signScale, title: 'CARGO DROP-OFF', accent: '#ffd27a', flag: false, variant: 'splitflap_rivalry', rowLabels: { kills: 'HOME', gathered: 'FIELD', used: 'SITES' } });
      }).catch(() => {});
    }
    sign?.update({ rows: [['HOME', e.sites.filter((s) => s.state === 'delivered').length], ['FIELD', e.sites.filter((s) => s.state === 'cleared' || s.state === 'carried').length], ['SITES', e.sites.filter((s) => s.state !== 'hidden').length]], rank: 0 });
  }
  const fx = () => (cargo ??= createCargo(h.scene, { sfx: h.sfx, hasCue: h.hasCue, metres, look }));
  const homeAt = () => h.centers()[h.story.home];

  function sitePose(id) {
    const c = h.centers()[spotOf(id).cell], dir = toward(c, homeAt()), p = along(c, dir, look.siteOffset * metres);
    return { point: p, normal: p.clone().normalize(), facing: dir };
  }
  // THE CARGO DROP-OFF PAD (CARGO_LOOK.drop): out in front of the middle of the trophy row, where a part is home; `pad` once a site is
  // out, its ring idling, and pulsing while a part rides the hull. The point on the unit sphere and the reach in its units
  function dropPose() {
    const m = trophyPose((STORY_EXPEDITIONS.sites.length - 1) / 2), p = along(m.point.toArray(), m.facing, (look.drop?.ahead ?? 7) * metres);
    return { point: p, normal: p.clone().normalize(), facing: m.facing };
  }
  // on the lattice: the open cell nearest the ideal spot, so a hull parked on it is on the pad (kept once the landing has a frame)
  let padPoint = null;
  const dropAt = () => {
    if (padPoint) return padPoint;
    const want = dropPose().normal.toArray(), C = h.centers(); let best = -1, bd = Infinity;
    for (let i = 0; i < C.length; i++) { if (i === h.story.home || !(h.open?.(i) ?? true)) continue; const d = chord(C[i], want); if (d < bd) { bd = d; best = i; } }
    const at = best >= 0 && bd < dropReach() * 2.5 ? C[best].slice() : want;
    if (h.landing?.()) padPoint = at;
    return at;
  };
  const dropReach = () => (look.drop?.radius ?? 8) * metres;
  function padStep(e) {
    if (!pad && h.scene && e.sites.some((s) => s.state !== 'hidden')) {
      const at = dropAt(), ring = makePadRing(at, dropReach(), 1 + 0.3 * metres, { color: look.drop?.color ?? 0xffb43c, rings: [1, 0.62, 0.24], size: 3.5 });
      h.scene.add(ring); pad = { at, ring };
    }
    if (!pad) return;
    glowPadRing(pad.ring, e.carrying ? 'charging' : 'idle', typeof performance === 'object' ? performance.now() / 1000 : 0);
    if (!e.carrying) pad.ring.material.opacity *= 0.7;   // waiting for a part: there, but quiet
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

  // AS CLOSE AS THE POCKET LETS A HULL COME (owner, 2026-10-06, twenty-seventh notes, 3: "the second-closest cargo: STILL a problem going
  // through narrow tiles with the MÖRK"): a lander stands in a pocket of rock, its own solid footprint across the corridor cells beside
  // it, and the floor a hull can stand on may all lie beyond the pickup radius; the hull then wedged against the footprint a cell short
  // of the part. The reach is at least the chord to the nearest floor a hull may stand on (open to the grid and clear of the buildings
  // solid to it, `h.open` / `h.solid`), plus most of a cell, and at most two cells past the pickup radius; measured once per site
  // the pickup radius past the clearing, in cells (1 until 2026-10-06; 1.3 secures the part where the hull arrives at rocket-b: a cell
  // short of the clearing's far side, where --corridor-probe still wedges it against the lander's corridor with nothing reported ahead)
  const PICKUP_CELLS = 1.3;
  const stands = new Map();
  const standReach = (id, at) => {
    if (!stands.has(id)) {
      const centers = h.centers(); let best = Infinity;
      if (h.open) for (let i = 0; i < centers.length; i++) { if (i === at.cell || !h.open(i) || h.solid?.(centers[i])) continue; const d = chord(centers[i], centers[at.cell]); if (d < best) best = d; }
      stands.set(id, Math.min(h.cellSide * (at.clear / 10 + 3), Number.isFinite(best) ? best + h.cellSide * 0.8 : 0));
    }
    return stands.get(id);
  };
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
        const at = spotOf(s.id);
        if (s.state === 'cleared' && !e.carrying && chord(pos, centers[at.cell]) < Math.max(h.cellSide * (at.clear / 10 + PICKUP_CELLS), standReach(s.id, at)) && reach(e, s.id)) {
          fx().pickUp(s.id, h.hull);
          h.callout(`PART SECURED · ${String(STORY_EXPEDITIONS.sites.find((x) => x.id === s.id)?.part ?? 'part').toUpperCase()} · TO THE CARGO DROP-OFF`);
        }
      }
      const carried = e.carrying;
      if (carried && chord(pos, dropAt()) < dropReach() * 1.15) {   // home is the pad, by the trophy flags
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
      signStep(e); padStep(e);
      h.story.hud.sites(e.sites.filter((s) => (s.state === 'guarded' || s.state === 'cleared' || s.state === 'carried') && (s.state === 'carried' || !!cellOf(s.id)))
        .map((s) => ({ dir: s.state === 'carried' ? unitArr(dropAt()) : unitArr(centers[spotOf(s.id).cell]), state: s.state })));
    },
    // the hull is gone: the part waits where it fell (the rule), the crate tumbles off and its flag comes down (the look); the next step
    // raises the flag again over the part, at the wreck
    hullLost() {
      const e = ex(), id = e?.carrying, pos = h.tankPos(), centers = h.centers();
      let cell = -1, best = -Infinity;   // the cell the hull died on: its part waits there
      if (pos) { const l = Math.hypot(...pos) || 1; for (let i = 0; i < centers.length; i++) { const c = centers[i], d = (c[0] * pos[0] + c[1] * pos[1] + c[2] * pos[2]) / l; if (d > best) { best = d; cell = i; } } }
      if (!e || !hullLost(e, cell)) return false;
      if (cargo) { cargo.throwOff(); cargo.lowerFlag(id); }
      return true;
    },
    // an open cell to stand the tank on for a close look: within reach of the site (or of home), never the structure's own cell
    // `open(ci)` is the controller's word for floor the tank may stand on: a rock or wall cell renders raised, and a camera on it is inside the rock
    standCell(kind, id = null, open = () => true) {
      const centers = h.centers(), site = kind === 'site' ? cellOf(id) : null;
      if (kind === 'site' && !site) return -1;
      const p = site ? sitePose(id) : dropPose();
      const target = site ? along(p.point.toArray(), p.facing, 8 * metres) : v3(dropAt()), avoid = site ? site.cell : h.story.home;   // home: the drop-off pad's middle
      const reachAt = site ? centers[site.cell] : dropAt(), reachR = site ? h.cellSide * (site.clear / 10 + 1) : dropReach() * 1.6;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < centers.length; i++) {
        if (i === avoid || !open(i)) continue;
        const d = chord(centers[i], [target.x, target.y, target.z]);
        if (d < bestD && chord(centers[i], reachAt) < reachR * 0.9) { best = i; bestD = d; }
      }
      // home on a sparse board: the open cell nearest the pad's middle
      if (best < 0 && !site) for (let i = 0; i < centers.length; i++) { const d = chord(centers[i], [target.x, target.y, target.z]); if (i !== avoid && open(i) && d < bestD) { best = i; bestD = d; } }
      // a lander stands in a pocket of rock: when no open floor is in reach, the nearest cell still serves the acceptance route
      return best < 0 && open.length ? glue.standCell(kind, id) : best;
    },
    // the pickup reach of a site in cells (the radius, or the nearest standable floor), for the harness
    reachOf(id) { const at = spotOf(id); return at ? Math.max(h.cellSide * (at.clear / 10 + PICKUP_CELLS), standReach(id, at)) / h.cellSide : -1; },
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
      cargo?.tick(dt); sign?.tick(dt);
      /* the crate he was coming for is gone (holdMax, or pushed off the landing by newer crates): the part is in all the same */
      if (receipt?.held && !cargo?.state().crates.some((p) => p === 'fall' || p === 'settle' || p === 'rest')) endReceipt(receipt);
    },
    view: (kind, id) => cargo?.view(kind, id) ?? null,
    state: () => ({ ...(cargo ? cargo.state() : { carrying: null, attached: false, flags: [], trophies: 0, crates: [], errors: [] }), receiving: !!receipt?.held, sign: !!sign, pad: pad ? { at: pad.at.map((v) => +v.toFixed(5)), reach: +dropReach().toFixed(5), visible: pad.ring.visible } : null }),
    dispose() { cargo?.dispose(); cargo = null; sign?.dispose?.(); sign = null; if (pad) { h.scene?.remove(pad.ring); pad.ring.geometry.dispose(); pad.ring.material.dispose(); pad = null; } },
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
      open: (ci) => c.open?.(ci) ?? true, solid: (p) => !!c.storyBase()?.solidAt?.(p),   // open floor: the cargo drop-off pad sits on it; a building solid to the hull
      receive: (r) => { orders.push({ kind: 'receive', ci: c.cellIndex()(norm3(r.point)), cost: 0, seconds: r.seconds, bed: r.bed, done: r.done }); spawnIsao(); updateHud(); return true; },
    })),
    expeditionsBegin: () => { if (c.story()?.expeditions) storyApi.expeditions().begin(); },
    expeditionStep: () => { if (c.story()?.expeditions) storyApi.expeditions().step(); },
  };
}
