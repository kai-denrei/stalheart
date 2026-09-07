// The game's Sentry models use the same pinned GLBs and rig names as labs #sentry.
import * as THREE from '../vendor/three.module.js';
import { loadGlb, loadGlbWithClips, mergeByMaterial, fitModel } from './glbmodels.js';
import { TOWERS } from './towers.js';
// A temporary loading marker, never an alternate tower model.
function makeLoadingMarker(def) {
  const root=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.08,8),new THREE.MeshBasicMaterial({color:def.color,wireframe:true}));
  root.add(mesh);root.userData.baseScale=1/1.55;root.userData.lift=.02;root.userData.kind='loading';root.userData.loading=true;
  return root;
}
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
    // TIER 1 UP FRONT, the rest on demand. Three tiers of eight families is
    // twenty-four models and about four megabytes; a board that downloads
    // the Maximum variant of a tower nobody has upgraded is paying for
    // hardware that is not on the table.
    const first = sentryPin ?? 1;
    sentryLook._p = Promise.all(TOWERS.filter((d) => d.model).map((d) => loadSentryModel(d, first)))
      .then((all) => { sentryLook.loaded = all.length > 0 && all.every(Boolean); return sentryLook.loaded; });
    return sentryLook._p;
  },
  build(def, tier = 0) {
    if (!def.model) return makeLoadingMarker(def);
    const { have, want } = sentryTierFor(def, tier);
    // start the tier we do not have yet; wear the best one we do
    if (have !== want) loadSentryModel(def, want);
    const url = have ? sentryUrlFor(def, have) : null;
    const proto = url ? sentryProtos.get(url) : null;
    if (!proto) return makeLoadingMarker(def);   // bytes not in yet — never nothing
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
      // the shared aiming seam, so aimTower needs no new
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

export const TOWER_LOOKS = { sentry:sentryLook };

export const TOWER_LOOK_NAMES = Object.keys(TOWER_LOOKS);
export const DEFAULT_TOWER_LOOK = 'sentry';

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
