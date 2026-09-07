// towerlooks.js — the tower VISUAL registry.
//
// Tower combat math lives in towers.js and must never be touched to change
// how a tower looks. This file is the seam: a look is a named builder that
// turns a tower def into an Object3D, and swapping looks rebuilds only the
// `obj` on a tower — key, def, tier, cell, cooldown and spend are game
// state and stay exactly where they were.
//
// The contract a look MUST satisfy, read off td-tab's call sites:
//   - returns a THREE.Group that raycasts (tap-to-select hits it)
//   - userData.baseScale : placement multiplies by this
//   - userData.tick(t)   : optional idle animation
//   - userData.lift      : optional, how far off the surface
// Every look shares the same MAST (base, column, collar) so they read as
// one family of machine and only the head changes.
//
// `preload` is optional and returns a Promise. It exists for looks whose
// assets arrive asynchronously — a GLB, say — so those can drop in later
// without reshaping this interface. A look with no preload is ready
// immediately; a look whose preload has not resolved falls back.
import * as THREE from '../vendor/three.module.js';
import { loadGlb, loadGlbWithClips, mergeByMaterial, fitModel, tintModel } from './glbmodels.js';
import { TOWERS } from './towers.js';
import { makeTowerMast, makeTowerUnit } from './units.js';
import { TOWER, HEADS, loadTower } from './feelstore.js';

// def.shape -> a solid primitive, so the SOLID look keeps each tower's
// silhouette identity from towers.js rather than inventing its own.
function solidHeadGeometry(shape) {
  switch (shape) {
    case 'cone':      return new THREE.ConeGeometry(0.42, 0.86, 7);
    case 'pyramid':   return new THREE.ConeGeometry(0.46, 0.8, 4);
    case 'teardrop':  return new THREE.ConeGeometry(0.36, 0.95, 10);
    case 'bipyramid': return new THREE.OctahedronGeometry(0.5);
    case 'gear':      return new THREE.TorusGeometry(0.34, 0.16, 6, 8);
    case 'spiral':    return new THREE.TorusKnotGeometry(0.3, 0.1, 48, 6, 2, 3);
    case 'dspiral':   return new THREE.TorusKnotGeometry(0.3, 0.1, 48, 6, 3, 2);
    case 'sphere':
    default:          return new THREE.IcosahedronGeometry(0.46, 0);
  }
}

// SOLID: the same mast, but a faceted tinted head with bright edges
// instead of the dot cloud. Reads as machined hardware rather than a
// hovering swarm — the clearest possible contrast at a glance, which is
// what makes it useful for judging the swap.
function makeTowerSolid(def) {
  const { g, head, edge } = makeTowerMast(def);
  const body = new THREE.MeshLambertMaterial({
    color: def.color, emissive: new THREE.Color(def.color).multiplyScalar(0.18),
  });
  const geo = solidHeadGeometry(def.shape);
  const mesh = new THREE.Mesh(geo, body);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge));
  head.add(mesh);
  // slower than the cloud and with no bob: solid mass should feel heavier
  const spin = (def.spin ?? 0.6) * 0.45;
  g.userData.tick = (t) => { head.rotation.y = t * spin; };
  return g;
}

// --- GLB looks ------------------------------------------------------------
// Models arrive asynchronously, which is the whole reason the registry has
// preload/lookReady: until the bytes land, build() falls back to braille so
// a tower is never invisible.

function makeGlbLook({ label, url, height, maxSpan, drop = [] }) {
  let proto = null;
  const look = {
    label,
    loaded: false,
    preload() {
      if (look._p) return look._p;
      look._p = loadGlb(url).then((scene) => {
        if (!scene) return false;
        // no pivots preserved: a tower that has dug in holds still, and a
        // fully merged model is ~6 draw calls instead of ~109
        proto = fitModel(mergeByMaterial(scene, [], drop), { height, maxSpan });
        look.loaded = true;
        return true;
      });
      return look._p;
    },
    build(def) {
      if (!proto) return makeTowerUnit(def); // bytes not in yet — never nothing
      const g = proto.clone(true);
      tintModel(g, def.color);
      g.userData.baseScale = 1 / 1.55;   // same envelope convention as the mast
      g.userData.lift = 0.02;
      g.userData.kind = 'mesh';
      return g;
    },
  };
  return look;
}

// SENTRY: one GLB PER TOWER, named by the roster's own `model` field. The
// heptapod look above is one model worn by every tower on the board; this
// is the opposite, and it is what the second roster is for — eight machines
// that look like eight different machines, from the Sentry Workshop, under
// the contract the sentry lab already loads them by.
//
// The models are cached by URL rather than per look, so six Rotors on a
// board are one download and one upload, and a tower whose bytes have not
// landed still gets a braille mast rather than nothing.
// THE LAB'S LOOK, ON THE BOARD (operator: "the texture and colors look much
// better in sentry lab mode; let's aim for a similar look in game").
//
// The reason the lab looked better is that the lab does NOTHING to these
// models. It loads them and lights them, and what you see is what the
// Workshop authored: blue-grey armour, a lighter edge, copper fittings, an
// orange signal, a red identification stripe. Six materials that were
// designed to sit together.
//
// The board was running them through tintModel, which re-hues every surface
// to the TOWER's colour and keeps only lightness — a system built for the
// mkcx tank, whose four materials are all muddy olive and genuinely need
// pulling apart. Applied to a palette that was already good, it threw the
// palette away and returned a monochrome machine.
//
// So: keep the authored colours, lift them a little because the board is a
// darker room than the lab's studio, and spend the tower's identity colour
// where it costs nothing — the SIGNAL and IDENTIFICATION surfaces, which are
// the indicator panels and are meant to be read. A Rotor and a Quiver are
// still told apart at a glance, and both still look like the machines the
// workshop drew.
const SENTRY_HOT = /signal|identification/i;
const SENTRY_LIFT = 1.35;    // the board is dimmer than the lab's three lights
const SENTRY_GLOW = 0.07;    // ...and pure Lambert in near-black reads as black

function dressSentry(root, color) {
  const c = new THREE.Color(color);
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    obj.material = mats.map((m) => {
      const cl = m.clone();   // prototypes are shared between instances
      if (SENTRY_HOT.test(m.name || '')) {
        if (cl.color) cl.color.copy(c);
        if (cl.emissive) {
          cl.emissive.copy(c);
          if ('emissiveIntensity' in cl) cl.emissiveIntensity = 1.5;
        }
        return cl;
      }
      if (cl.color) cl.color.multiplyScalar(SENTRY_LIFT);
      // its OWN colour, faintly — so a dark plate is a dark plate rather
      // than a silhouette, without washing the palette toward the tint
      if (cl.emissive) {
        cl.emissive.copy(cl.color).multiplyScalar(SENTRY_GLOW);
        if ('emissiveIntensity' in cl) cl.emissiveIntensity = 1;
      }
      return cl;
    });
    if (obj.material.length === 1) obj.material = obj.material[0];
  });
}

const sentryProtos = new Map();
const sentryClips = new Map();
const sentryPending = new Map();

function sentryUrlFor(def, tier = 1) {
  return `assets/models/sentries/${def.model}_t${tier}.glb`;
}

// A WALKER KEEPS ITS SKELETON. Everything else on the board has dug in and
// holds still, so it is merged by material — six draw calls instead of a
// hundred and nine, and the named pivots are the sentry LAB's business.
// The A6 is the exception and has to be: merging flattens the hierarchy the
// Walk clip's twenty-four rotation and translation channels address by
// NAME, so a merged A6 can only ever glide. It costs what it costs, and it
// is one unit at 260 biomass rather than a board full of them.
const animated = (def) => def.attack === 'walker';

// WHICH EQUIPMENT TIER THE BOARD SHOWS. The Workshop draws each family
// three times — Base, Reinforced, Maximum — and on the board that maps onto
// the tower's own upgrade tier: a tower you have paid to upgrade twice
// visibly carries more hardware than one you have just printed. It is the
// cheapest possible answer to "make them feel more detailed", because the
// detail already exists and was being thrown away.
//
// A pin (?towertier=) overrides it, for looking at one tier everywhere.
let sentryPin = null;
export const setSentryTier = (n) => { sentryPin = (n >= 1 && n <= 3) ? n : null; };

// The tier we WANT, and the best one we actually have bytes for. A tower
// that upgrades starts the next tier's load and keeps wearing the tier it
// has until that lands — the same never-blank rule the whole registry runs
// on, one level down.
function sentryTierFor(def, tier) {
  const want = sentryPin ?? Math.max(1, Math.min(3, Math.floor(tier) + 1));
  for (let t = want; t >= 1; t--) {
    if (sentryProtos.has(sentryUrlFor(def, t))) return { have: t, want };
  }
  return { have: 0, want };
}

function loadSentryModel(def, tier = 1) {
  const url = sentryUrlFor(def, tier);
  if (sentryProtos.has(url)) return Promise.resolve(true);
  if (sentryPending.has(url)) return sentryPending.get(url);
  // the walker needs its clips, so it takes the loader that keeps them —
  // separate cache, separate shape, both already in glbmodels.js
  const p = (animated(def) ? loadGlbWithClips(url) : loadGlb(url)).then((res) => {
    const scene = res && res.scene ? res.scene : res;
    if (!scene) return false;
    if (animated(def)) {
      const clips = (res && res.clips) || [];
      // MERGE EVERYTHING THE CLIP DOES NOT TOUCH. `mergeByMaterial` already
      // takes the nodes that must keep moving, and the honest source for
      // that list is the CLIP: every node a track addresses, read off the
      // animation rather than guessed from names. Unmerged the A6 was 89
      // draw calls against 4-5 for a static tower; this keeps the twenty-four
      // animated joints articulated and collapses the rest of the hull.
      const pivots = new Set();
      for (const c of clips) {
        for (const tr of c.tracks) pivots.add(String(tr.name).split('.')[0]);
      }
      // ...AND THE PARTS A GAUGE NEEDS TO ADDRESS. The A6's ammunition is
      // shown on the hull — a spent cell loses its readiness ring — which is
      // only possible if the rings still exist as nodes. Merged by material
      // they collapse into the hull and the counter has nothing to hide.
      // Six more draw calls for the only diegetic ammo counter on the board.
      scene.traverse((o) => {
        if (o.isMesh && /readiness ring/i.test(o.name || '')) pivots.add(o.name);
      });
      // fitModel wraps the result in a group and scales the WRAPPER's child —
      // never the animated nodes themselves — so the clip's own transforms
      // survive the fit untouched. That is the whole reason this can be a
      // plain clone rather than a re-export.
      sentryProtos.set(url,
        fitModel(mergeByMaterial(scene, [...pivots]), { height: 1.35, maxSpan: 2.2 }));
      sentryClips.set(url, clips);
    } else {
      // THE TURRET KEEPS ITS PIVOTS. `mergeByMaterial` takes the nodes that
      // must keep moving, and for a sentry that is the Workshop's own
      // contract — ROOT→BASE→YAW→PITCH→RECOIL. Merging them away is what
      // made these towers scenery with a gun painted on: they could not
      // track, could not elevate, and could not recoil. The MUZZLEs are
      // empties and survive the merge on their own.
      sentryProtos.set(url,
        fitModel(mergeByMaterial(scene, ['YAW', 'PITCH', 'RECOIL']),
          { height: 1.35, maxSpan: 2.2 }));
    }
    return true;
  }).catch(() => false);
  sentryPending.set(url, p);
  return p;
}

const sentryLook = {
  label: 'sentry',
  loaded: false,
  preload() {
    if (sentryLook._p) return sentryLook._p;
    // every model the LIVE roster names — a roster with no models (the
    // campaign board) resolves immediately and falls back to braille
    // TIER 1 UP FRONT, the rest on demand. Three tiers of eight families is
    // twenty-four models and about four megabytes; a board that downloads
    // the Maximum variant of a tower nobody has upgraded is paying for
    // hardware that is not on the table.
    const first = sentryPin ?? 1;
    sentryLook._p = Promise.all(TOWERS.filter((d) => d.model).map((d) => loadSentryModel(d, first)))
      .then((all) => { sentryLook.loaded = all.length > 0 && all.some(Boolean); return sentryLook.loaded; });
    return sentryLook._p;
  },
  build(def, tier = 0) {
    if (!def.model) return makeTowerUnit(def);
    const { have, want } = sentryTierFor(def, tier);
    // start the tier we do not have yet; wear the best one we do
    if (have !== want) loadSentryModel(def, want);
    const url = have ? sentryUrlFor(def, have) : null;
    const proto = url ? sentryProtos.get(url) : null;
    if (!proto) return makeTowerUnit(def);   // bytes not in yet — never nothing
    const g = proto.clone(true);
    dressSentry(g, def.color);
    g.userData.baseScale = 1 / 1.55;
    g.userData.lift = 0.02;
    g.userData.kind = 'mesh';

    // THE GAIT. The clip is driven from the look's own `tick`, which the
    // board already calls once per tower per frame with an absolute time —
    // so the mixer is given the DIFFERENCE, and the first call is thrown
    // away rather than advancing the animation by however long the page has
    // been open. `setGait` is the seam the walker's state machine pulls: the
    // legs move when it is going somewhere and stop when it is not, which is
    // the difference between a machine and a screensaver.
    // THE RIG, under the names the Sentry Workshop guarantees. The board
    // drives exactly what the sentry LAB drives — yaw, elevation, recoil,
    // and the muzzles a flash leaves from — so a tower on a wall and a
    // turret on the range are the same machine aimed by different code.
    const yaw = g.getObjectByName('YAW');
    const pitch = g.getObjectByName('PITCH');
    const recoil = g.getObjectByName('RECOIL');
    const muzzles = [];
    g.traverse((o) => { if (/^MUZZLE_\d+$/.test(o.name || '')) muzzles.push(o); });
    muzzles.sort((a, b) => a.name.localeCompare(b.name));
    if (yaw) {
      // the same seam the braille look offers, so aimTower needs no new
      // code path: a head to turn and the facing it is turned relative to
      g.userData.head = yaw;
      g.userData.headFacing = 0;
    }
    g.userData.pitchNode = pitch || null;
    g.userData.recoilNode = recoil || null;
    g.userData.muzzles = muzzles;

    const clips = url ? (sentryClips.get(url) || []) : [];
    const walk = clips.find((c) => c.name === 'Walk');
    if (walk) {
      const mixer = new THREE.AnimationMixer(g);
      const action = mixer.clipAction(walk);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      let last = null, going = true, rate = 1;
      g.userData.mixer = mixer;
      g.userData.setGait = (on) => {
        if (on === going) return;
        going = on;
        action.paused = false;
        action.setEffectiveTimeScale(on ? rate : 0);
      };
      // THE LEGS KEEP UP WITH THE BODY. A clip running at a fixed rate under
      // a hull whose speed changes is what reads as skating — and the A6's
      // speed genuinely changes, because it walks out and RUNS home. Clamped
      // at both ends: below the floor the cycle stutters, above the ceiling
      // it blurs, and neither looks like walking.
      g.userData.setGaitRate = (r) => {
        rate = Math.max(0.35, Math.min(2.2, r || 0));
        if (going) action.setEffectiveTimeScale(rate);
      };
      g.userData.tick = (t) => {
        if (last === null) { last = t; return; }
        const dt = Math.min(0.1, Math.max(0, t - last));
        last = t;
        mixer.update(dt);
      };
    }
    return g;
  },
};

export const TOWER_LOOKS = {
  // built against the LIVE tuning object, so what the viewer's tower panel
  // shows is what the board raises — no apply step, nothing to sync
  braille: { label: 'braille', build: (def) => makeTowerUnit(def, loadTower(), HEADS) },
  solid:   { label: 'solid',   build: makeTowerSolid },
  heptapod: makeGlbLook({
    label: 'heptapod',
    url: 'assets/models/heptapod.glb',
    height: 1.35,  // mast units — the braille mast is 1.55 tall
    maxSpan: 2.2,  // but never sprawl wider than this over its neighbours
    // a 12-triangle physics proxy the exporter left visible — drawing it
    // lays two big triangles over the model with corners poking out
    drop: ['Hull_Collision'],
  }),
  sentry: sentryLook,
};

export const TOWER_LOOK_NAMES = Object.keys(TOWER_LOOKS);
export const DEFAULT_TOWER_LOOK = 'braille';

// Never throws and never returns null: an unknown name (a stale URL hook,
// a saved preference for a look that has since been removed) falls back to
// the default rather than leaving a tower invisible on the board.
export function buildTowerLook(name, def, tier = 0) {
  const look = TOWER_LOOKS[name] || TOWER_LOOKS[DEFAULT_TOWER_LOOK];
  return look.build(def, tier);
}

// Kick off a look's async load if it has one. Resolves to true when the
// look is ready to build for real. Safe to call repeatedly — the promise
// is cached — and safe to call for looks with no assets.
export function preloadLook(name) {
  const look = TOWER_LOOKS[name];
  if (!look || !look.preload) return Promise.resolve(true);
  return look.preload();
}

// A look is usable now if it declares no async assets, or its preload has
// resolved. Callers use this to fall back rather than render nothing.
export function lookReady(name) {
  const look = TOWER_LOOKS[name];
  if (!look) return false;
  return !look.preload || look.loaded === true;
}
