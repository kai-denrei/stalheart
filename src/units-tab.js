import { DEFAULT_TANK } from './content/tank.js';
import { makeOrdnanceShell } from './shell.js';
import { createWeaponVoice } from './weapon-voice.js';
import { firingFor } from './content/firing-defaults.js';
import { makeBeamShot } from './shotfx.js';
import { storage as localStorage } from './storage.js';
// units-tab.js — a carousel for looking at one unit at a time, up close,
// and turning it over.
//
// This exists because judging a model inside the game does not work: the
// units are small, the board is busy, and the spawn portal's dot cloud sits
// exactly where the player starts. Every scale, tint and geometry problem in
// the imported models was found here, not in gameplay.
//
// ONE renderer, one unit on screen. A grid of live viewports would need a
// WebGL context each and browsers cap those in the teens; a carousel costs
// one context no matter how long the roster grows.
import * as THREE from '../vendor/three.module.js';
import { CONTENT } from './content/runtime.js';
import { MISSILE_LAUNCH_ELEVATION } from './content/missile-defaults.js';
import { createMissilePool, launchDart, advanceDart } from './missiles.js';
import { shotOf } from './sentryfx.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFExporter } from '../vendor/GLTFExporter.js';
import { ENEMY_SPEC } from './enemyspec.js';
import { buildUnit, preloadMkcx, preloadMork, preloadMorkTier, preloadMorkProxy, makeDebris, makeDotBurst, makeBulletCloud,
  makeDotEnemy, makeRewardSolid, makeShellSolid, makePortalCloud,
  preloadServer, makeServerFixture, preloadContainer, makeContainerFixture,
  preloadFabricator, makeFabricatorDrone, makeIsaoDrone } from './units.js';
import { TANK_FEEL, TANK_FEEL_KNOBS, formatFeelCode, makeTankFeel, stepTankFeel,
  landTankFeel, fireTankFeel, applyTankFeel, applyTankHealth } from './tankfeel.js';
import { FEEL, loadFeel, saveFeel, resetFeel } from './feelstore.js';
import { CREATURE_TINTS, accentFor } from './enemyspec.js';
import { buildTowerLook, TOWER_LOOK_NAMES, DEFAULT_TOWER_LOOK, preloadLook } from './towerlooks.js';
import { TOWER_BY_KEY, TOWERS, effectiveStats } from './towers.js';
import { LOOKS } from './looks.js';
import { makeBloom } from './postfx.js';
import { makeAudio } from './audio.js';
import { GROUPS, GROUP_LABELS, GROUP_EMPTY, entriesIn } from './unitcatalog.js';
import { FONT_NAMES, TYPE_KNOBS, TYPE_FEEL, makeTypeParams, loadTypeFeel, saveTypeFeel,
  formatTypeCode, applyFontPack, currentFontPack, currentShoutPack } from './fonts.js';
import { LORE, LORE_WORLD, loreText, loreAll } from './lore.js';

let roundTex = null;
function roundDotTex() {
  if (roundTex) return roundTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  roundTex = new THREE.CanvasTexture(c);
  return roundTex;
}

export function initUnitsTab(root) {
  let active = false;
  const container = root.querySelector('#units-app');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.005, 200);
  // same light rig as the game, or a unit would not look here as it looks there
  scene.add(new THREE.HemisphereLight(0xc8cfe0, 0x555060, 1.5));
  const sun = new THREE.DirectionalLight(0xffe8c8, 1.1);
  sun.position.set(3, 5, 2); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8a96c8, 0.8);
  fill.position.set(-3, 1, -2); scene.add(fill);
  // gentler than the game's: this is an inspection view, and the roster's
  // white-tinted units blow out to a featureless blob at play strength
  const postfx = makeBloom(renderer, scene, camera, { strength: 0.5, threshold: 0.9 });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false; // the unit stays centred; orbit and zoom only

  const state = { group: 'friendly', index: 0, towerLook: DEFAULT_TOWER_LOOK, spin: true, sweep: true };
  // the test bench: the SAME feel driver the game runs, so what you tune here
  // is what ships. `running` is the engine's own notion of running.
  const feel = makeTankFeel();
  let running = false;
  let health = 1;
  const benchEl = root.querySelector('#units-bench');
  const engineBtn = root.querySelector('#units-engine');
  const destroyBtn = root.querySelector('#units-destroy');
  const healthEl = root.querySelector('#units-health');
  let wreckT = 0;   // >0 while the wreck is playing
  let current = null;
  let currentEntry = null;
  let sweepBtn = null;
  // assigned by the tuner IIFE further down. Declared HERE because show()
  // runs during init and would hit the temporal dead zone of a `const`
  // declared below it — a trap this file has fallen into before.
  let tunerApi = null;
  let clock = 0;
  const wreckFx = [];   // debris/burst objects, ticked and reaped

  // --- firing pattern preview -----------------------------------------------
  // ONE pooled Points cloud for every preview particle, rewritten in place
  // each frame. Not an object per projectile: a frame's cost in this engine
  // is dominated by draw calls, not by vertices — measured at ~1020 calls and
  // 50k points on a live wave-4 board — so a hundred particles in one buffer
  // is one call, and a hundred objects is a hundred. Same reason the effects
  // layer should be built this way when it lands.
  const FX_MAX = 900;
  const fxPos = new Float32Array(FX_MAX * 3);
  const fxCol = new Float32Array(FX_MAX * 3);
  const fxGeo = new THREE.BufferGeometry();
  fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3));
  fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 3));
  fxGeo.setDrawRange(0, 0);
  const fxObj = new THREE.Points(fxGeo, new THREE.PointsMaterial({
    size: 3.4, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95,
  }));
  fxObj.frustumCulled = false;   // the buffer is rewritten; its bounds lie
  scene.add(fxObj);
  const fx = [];              // live particles
  let rangeRing = null;       // the reach, drawn while previewing
  let missilePool=null,missilesDisposed=false,missileIndex=0;
  const missiles=[];
  createMissilePool().then(pool=>{if(missilesDisposed)pool.dispose();else missilePool=pool;})
    .catch(error=>{root.querySelector('#units-note').textContent=`Missile kit failed to load: ${error.message}`;});
  let fireLeft = 0;           // seconds of preview remaining
  const heldBeams=[];
  let fireGap = 0;            // seconds until the next shot in the burst
  // One board cell IS the tower's footprint, so a range in cells converts by
  // the mast's own base width. Without this the pattern would be pretty and
  // tell you nothing about reach.
  const CELL = 0.8;
  // A shot is three things — the kick, the shell, and the barrel going
  // red-hot — and the bench had only the kick. Judging "does firing feel
  // right" without the other two is judging a third of it.
  const HEAT_COOL = 3.0;                         // matches td-tab's cannon
  const sleeveCool = new THREE.Color(0x232833);
  const sleeveHot = new THREE.Color(0xff2a10);
  let heat = 0;
  const shells = [];

  const nameEl = root.querySelector('#units-name');
  const noteEl = root.querySelector('#units-note');
  const countEl = root.querySelector('#units-count');
  const groupRow = root.querySelector('#units-groups');
  const lookSel = root.querySelector('#units-look');
  const soundRow = root.querySelector('#units-sounds');

  // The viewer plays units as well as showing them — the same panel serves
  // tuning and player lore. Its own mixer instance, so nothing here can
  // disturb the game tab's levels or its voice budget.
  const sfx = makeAudio({ seed: 1 });
  const weaponVoice=createWeaponVoice(sfx);
  sfx.arm();
  let bed = null;          // the one looping sound a unit may have
  let bedBtn = null;

  function stopBed() {
    if (bed) bed.stop(0.15);
    bed = null;
    if (bedBtn) bedBtn.classList.remove('on');
    bedBtn = null;
  }

  function buildSoundRow(entry) {
    stopBed();
    soundRow.textContent = '';
    const list = entry && entry.sounds ? entry.sounds : [];
    soundRow.classList.toggle('hidden', list.length === 0);
    for (const snd of list) {
      const b = document.createElement('button');
      b.textContent = snd.label;
      b.addEventListener('click', () => {
        // the shot is a gesture, not just a sample: kick the turret too
        if (snd.key === 'tank_main') fireShell();
        // a tower's 'fire' button shows the PATTERN, not just the sound
        if (snd.label === 'fire') firePattern();
        if (!snd.loop) { sfx.play(snd.key); return; }
        if (bedBtn === b) { stopBed(); return; }  // toggle off
        stopBed();
        // loop() returns null until the buffer decodes, so only latch a
        // real handle — the same trap that silenced the game's engine bed
        const h = sfx.loop(snd.key, { gain: 1 });
        if (h) { bed = h; bedBtn = b; b.classList.add('on'); }
      });
      soundRow.appendChild(b);
    }
  }

  for (const name of TOWER_LOOK_NAMES) {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    lookSel.appendChild(o);
  }
  lookSel.value = state.towerLook;

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    postfx.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const cols = { walker: LOOKS.tronColors.walker, walkerHi: LOOKS.tronColors.walkerHi };

  function clear() {
    if (!current) return;
    scene.remove(current);
    current.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    current = null;
    for (const sh of shells) scene.remove(sh);
    shells.length = 0;
    heat = 0;
    // a pattern belongs to the tower that fired it
    for(const m of missiles)missilePool?.release(m.mesh);
    missiles.length=0;missileIndex=0;
    for(const f of fx)if(f.shell){scene.remove(f.shell);f.shell.geometry.dispose();f.shell.material.dispose();}
    fx.length = 0;
    fireLeft = 0;weaponVoice.dispose();
    for(const e of heldBeams){scene.remove(e.obj);e.obj.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}heldBeams.length=0;
    fxGeo.setDrawRange(0, 0);
    if (rangeRing) rangeRing.visible = false;
  }

  // Frame whatever was built. Units differ in size by more than 10x, so the
  // camera distance is derived from the object's own bounds rather than
  // fixed — otherwise half the roster is a speck and the rest overflows.
  // ?zoom=N scales the fit (1 = the catalogue's framing, 1.6 = "in big")
  const zoomParam = parseFloat(new URLSearchParams(location.search).get('zoom') || '1') || 1;
  function frame(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3(); box.getSize(size);
    const centre = new THREE.Vector3(); box.getCenter(centre);
    // Fit what the camera will actually SEE. The old fit put the longest
    // axis against the screen's height with a 1.9x margin, so a tank 10.8
    // long and 2.9 tall filled a fifth of the frame (operator: "so I can
    // see it in big"); a bounding-sphere fit then over-filled for compact
    // units and ran the procedural tank into the toolbar. So: project the
    // box's eight corners along the view direction below and solve the
    // distance at which the widest one sits at the horizontal limit and
    // the tallest at the vertical one. The vertical limit is 0.5 of the
    // half-height, because the bottom 28% of the viewport is the toolbar.
    const dir = new THREE.Vector3(0.55, 0.42, 0.72).normalize();     // centre -> eye
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    const vfov = (camera.fov * Math.PI) / 360;
    const tanV = Math.tan(vfov), tanH = tanV * (camera.aspect || 1);
    const LIM_H = 0.90, LIM_V = 0.50;
    let dist = 0.5;
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(centre);
      const dz = c.dot(dir);                   // toward the eye: nearer corners need more room
      dist = Math.max(dist,
        Math.abs(c.dot(right)) / (tanH * LIM_H) + dz,
        Math.abs(c.dot(up)) / (tanV * LIM_V) + dz);
    }
    dist /= zoomParam;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.near = Math.max(0.001, dist * 0.02);
    camera.far = dist * 40;
    camera.updateProjectionMatrix();
    controls.update();
  }

  // Build a catalogue entry the SAME way the game does. Hostiles in
  // particular must come from makeDotEnemy: buildUnit still has an older
  // mesh form for every creature, and showing that would be describing a
  // unit the player never meets — without the rammable/not tell, which
  // exists only on the cloud.
  function buildEntry(e) {
    if (e.kind === 'tower') return buildTowerLook(state.towerLook, TOWER_BY_KEY[e.id]);
    if (e.kind === 'portal') {
      const p = makePortalCloud({ body: 0xcfd8ff, hi: 0xffffff });
      p.userData.baseScale = 1;
      return p;
    }
    if (e.kind === 'fixture') {
      // fixtures preload async; by the time anyone pages to them the
      // bytes have almost always landed — the placeholder covers the gap
      const FIXTURES = {
        server: [makeServerFixture, preloadServer, undefined],
        bobby: [makeFabricatorDrone, preloadFabricator, 0xffc24a],
        isao: [makeIsaoDrone, preloadFabricator, 0xbfe6ff],
      };
      const [make, pre, tint] = FIXTURES[e.id]
        || [makeContainerFixture, preloadContainer, undefined];
      const g = make(tint);
      if (g) {
        g.userData.baseScale = 1;
        // the rotors are the whole read on a drone: a still quadcopter looks
        // like a dead one. Hung on the viewer's own animation toggle, so
        // `animation` off still gives a clean screenshot.
        if (g.userData.spinRotors) {
          g.userData.tick = (t2) => {
            g.userData.spinRotors(1 / 60, 0.4);
            if (g.userData.setWork) g.userData.setWork(0.5 + 0.5 * Math.sin(t2 * 0.9));
            // Isao cycles his whole repertoire on the bench — the faces are
            // the thing being looked at, and they are presets rather than
            // an animation, so showing them means showing them in turn
            if (g.userData.setFace) {
              const f = g.userData.faces;
              // ?face=<id> parks him on one expression instead of cycling —
              // the colour rule needs a still of each phosphor, and a
              // cycling face cannot be photographed under virtual time
              g.userData.setFace(faceQ && f.includes(faceQ) ? faceQ
                : f[Math.floor(t2 / 1.8) % f.length]);
              // and the animated ones need their own clock advanced, or
              // blink and scan sit on frame zero forever
              g.userData.tickFace(1 / 60);
            }
          };
        }
        return g;
      }
      // AND COME BACK WHEN IT LANDS. This used to fire and forget, on the
      // reasoning that the bytes would have arrived by the time anyone paged
      // to a fixture — true on a warm cache, and a permanent grey box on a
      // cold one. Which made verifying Isao's face a coin flip: the model
      // rendered on some runs and not others, and nothing said why.
      pre().then((ok) => {
        if (ok && currentEntry === e) show();
      });
      const ph = new THREE.Group();
      ph.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x2a3442 })));
      ph.userData.kind = 'mesh';
      ph.userData.baseScale = 1;
      return ph;
    }
    if (e.kind === 'enemy') {
      const hex = CREATURE_TINTS[e.id];
      // A MESH-BODIED HOSTILE. Every enemy was a dot cloud when this was
      // written, so it called makeDotEnemy unconditionally — and a type whose
      // spec names `mesh` came out as the cloud FALLBACK, a red ball with an
      // octahedron in it. buildCreature knows the difference; this is the
      // codex, and a codex entry that does not match the board is worse than
      // no entry at all.
      const meshId = ENEMY_SPEC[e.id] && ENEMY_SPEC[e.id].mesh;
      if (meshId) {
        return buildUnit(meshId, { walker: hex ?? cols.walker, walkerHi: accentFor(e.id) });
      }
      // ONE unit on screen: build it at 6x the game's dot density —
      // the catalogue can afford the generosity the battlefield cannot
      // the viewer shows the accent too: a codex entry that does not match
      // the thing on the board is worse than no codex entry
      return makeDotEnemy(e.id, { walker: hex ?? cols.walker, walkerHi: accentFor(e.id) }, 6);
    }
    if (e.kind === 'pickup') {
      const p = e.pickup;
      // shells arrive as a rack of three, exactly as they sit on the ground
      if (!p.shape) {
        const g = new THREE.Group();
        for (let k = -1; k <= 1; k++) {
          const b = makeShellSolid({ body: LOOKS.tronColors.orb.color, hi: 0xffffff });
          b.position.set(k * 1.7, 0, 0);
          g.add(b);
        }
        g.userData.baseScale = 1;
        return g;
      }
      return makeRewardSolid(p.shape, { body: p.body, hi: 0xffffff }, 1.7);
    }
    return buildUnit(e.id, cols);
  }

  // A LINK TO THIS EXACT UNIT. ?unit=<id> already deep-links; nothing
  // surfaced it, so the only way to send someone a specific creature was to
  // tell them which arrow to press how many times. The button writes the
  // whole URL — origin, path, query, hash — so it survives being pasted
  // anywhere, and it falls back to selecting the text when the clipboard is
  // denied (it is, over plain http on anything but localhost).
  const linkBtn = root.querySelector('#units-link');
  function unitUrl(e) {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('unit', e.id);
    u.hash = '#units';
    return u.toString();
  }
  if (linkBtn) {
    const lab = linkBtn.querySelector('.label');
    let revert = 0;
    linkBtn.addEventListener('click', async () => {
      if (!currentEntry) return;
      clearTimeout(revert);
      const url = unitUrl(currentEntry);
      try {
        await navigator.clipboard.writeText(url);
        linkBtn.classList.add('ok'); lab.textContent = 'copied';
      } catch {
        // no clipboard: put it somewhere it can be copied by hand rather
        // than failing silently
        linkBtn.classList.add('fail'); lab.textContent = 'see console';
        console.log(url);
      }
      revert = setTimeout(() => {
        linkBtn.classList.remove('ok', 'fail'); lab.textContent = 'link';
      }, 1500);
    });
  }

  // ?uvlayout=1 — rectangles for the viewer chrome, because a phone layout
  // CANNOT be checked by screenshot here: headless clamps the window to
  // ~500px and then crops the image to the size you asked for, so a row
  // that fits reads as overflowing and vice versa. Same lesson the TD tab
  // wrote down; this tab needed its own probe to apply it.
  const uvl = new URLSearchParams(location.search).get('uvlayout');
  if (uvl) {
    // ?uvlayout=390 FORCES the chrome to a phone width first. Headless will
    // not give a viewport under ~500px, so the only way to answer "does this
    // fit a phone" is to hand the rows a 390px box and measure them in it.
    const forced = parseInt(uvl, 10);
    if (forced > 100) {
      const c = root.querySelector('#units-chrome');
      c.style.width = `${forced}px`;
      c.style.left = '50%';
      c.style.right = 'auto';
      c.style.transform = 'translateX(-50%)';
    }
    setTimeout(() => {
      const box = forced > 100 ? forced : innerWidth;
      const orig = root.querySelector('#units-chrome').getBoundingClientRect();
      const want = { chrome: '#units-chrome', stage: '#units-stage',
        groups: '#units-groups', id: '#units-id', note: '#units-note',
        opts: '#units-opts', prev: '#units-prev', next: '#units-next',
        link: '#units-link', sounds: '#units-sounds' };
      let over = 0;
      for (const [k, sel] of Object.entries(want)) {
        const el = root.querySelector(sel);
        if (!el || getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1) continue;
        const bad = r.left < orig.left - 1 || r.right > orig.right + 1;
        if (bad) over++;
        console.log(`UVLAYOUT ${k.padEnd(7)} x ${Math.round(r.left)}..${Math.round(r.right)}`
          + `  y ${Math.round(r.top)}..${Math.round(r.bottom)}${bad ? '  ** OFFSCREEN **' : ''}`);
      }
      console.log(`UVLAYOUT box=${box}px (real viewport ${innerWidth}) — ${over} overflowing`);
    }, 1200);
  }

  // ?yaw=<degrees> turns the model and stops the turntable. Any unit has a
  // side that is the point of it — Isao's whole face is on his nose — and
  // under a virtual-time budget the turntable barely moves, so without this
  // the only reachable angle is whichever one the camera starts at.
  const yawQ = parseFloat(new URLSearchParams(location.search).get('yaw') || 'NaN');
  const faceQ = new URLSearchParams(location.search).get('face');

  function show() {
    clear();
    const list = entriesIn(state.group);
    if (!list.length) {
      nameEl.textContent = '—';
      noteEl.textContent = GROUP_EMPTY[state.group];
      countEl.textContent = '0 / 0';
      buildSoundRow(null);
      return;
    }
    state.index = ((state.index % list.length) + list.length) % list.length;
    const e = list[state.index];
    currentEntry = e;
    if (tunerApi) tunerApi.setSubject(e.kind === 'tower' ? 'tower' : 'tank');
    current = buildEntry(e);
    root.dataset.sentry = e.kind === 'tower' ? e.id : '';
    root.dataset.modelReady = String(!!current && !current.userData.loading);
    // REVIEW TIERS LOAD WHEN CHOSEN, not when the tab opens: 680 KB nobody has
    // asked to judge yet. The placeholder hull stands in until the tier lands,
    // then the view refreshes — but only if it is still the one on screen, so a
    // fast flick past it does not yank the viewer back. Declared here rather
    // than beside the eager preloads at the bottom, because show() first runs
    // before that block and a const down there would not exist yet.
    const late = { 'mork-low': () => preloadMorkTier('low'), 'mork-proxy': () => preloadMorkProxy() }[e.id];
    if (late && current.userData.loading) {
      late().then((ok) => { if (ok && active && currentEntry?.id === e.id) show(); });
    }
    if (Number.isFinite(yawQ) && current) {
      current.rotation.y = (yawQ * Math.PI) / 180;
    }
    // ENEMIES default to their own game ANIMATION with the turntable OFF —
    // a swimmer under an added spin reads as neither (operator ruling).
    // The toggle still works; the default just re-lands per unit shown.
    // AN EXPLICIT ?yaw= HOLDS THE UNIT STILL, and it has to win over this default.
    // The override used to set spin off just above and then this line ran second
    // and switched it straight back on for every non-enemy unit — so the yaw deep
    // link never actually froze a tank. Found when a size read on a "frozen" hull
    // still drifted by two thirds of a metre in a second and a half.
    const wantSpin = e.kind !== 'enemy' && !Number.isFinite(yawQ);
    if (state.spin !== wantSpin) {
      state.spin = wantSpin;
      spinBtn.classList.toggle('on', wantSpin);
    }
    // the frame() fit blows a unit up to fullscreen while its dots stay
    // battlefield-sized 2px specks — sparse fog (operator report). The
    // catalogue fattens every dot to match its magnification.
    current.traverse((o) => {
      if (o.isPoints && o.material && o.material.sizeAttenuation === false
        && !o.userData.dotFat) {
        o.userData.dotFat = true;
        o.material.size *= 2.2;
        // a Points vertex is a SQUARE unless given a map, and at 4.6px the
        // corners read — the same lesson the mortar shell taught the game
        o.material.map = roundDotTex();
        o.material.alphaTest = 0.3;
        o.material.transparent = true;
        o.material.needsUpdate = true;
      }
    });
    // units carry their own normalization; undo it so everything arrives at
    // a comparable size and the framing maths does the rest
    current.scale.setScalar(1 / (current.userData.baseScale || 1));
    // AFTER the normalization — setScalar writes all three axes, and the
    // first cut of this squash was silently wiped by it. The catalogue
    // shows the berth AS FIELDED: 0.55 depth, the box the player meets.
    if (e.id === 'container') current.scale.z *= 0.55;
    // deep-linked (?unit=): report the box the viewer actually RENDERS —
    // a probe that measures before the transforms settle proves nothing
    if (new URLSearchParams(location.search).get('unit')) {
      const bb = new THREE.Box3().setFromObject(current);
      const sz = new THREE.Vector3(); bb.getSize(sz);
      console.log(`UNITSIZE ${e.id} x=${sz.x.toFixed(2)} y=${sz.y.toFixed(2)} z=${sz.z.toFixed(2)}`);
    }
    scene.add(current);
    // a full ammo rack reads better than an empty one when you are judging shape
    (current.userData.ammoDots || []).forEach((d) => d.material.color.setHex(0xffffff));
    frame(current);
    nameEl.textContent = e.label;
    noteEl.textContent = e.note || '';
    if (current.userData.modelStats) {
      const s = current.userData.modelStats;
      noteEl.textContent += ` · ${s.triangles.toLocaleString()} triangles · ${s.batches} batches`;
    }
    buildSoundRow(e);
    // the bench only means anything for a unit with a hover split
    const bench = !!(current && current.userData.hoverBody);
    benchEl.classList.toggle('hidden', !bench);
    if (!bench) setEngine(false);
    applyTankHealth(current, health);
    buildCallouts();   // labels belong to THIS unit's markers, not the last one's
    countEl.textContent = `${state.index + 1} / ${list.length}`;
    lookSel.parentElement.classList.add('hidden');
  }

  // Rebuild the shown object without touching the camera. Head shape, dot
  // count and highlight spacing are baked at build time, so those knobs need
  // a new object — but re-framing mid-drag would throw away the very view
  // you are judging it in.
  function rebuildCurrent() {
    if (!currentEntry || !current) return;
    scene.remove(current);
    current.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.dispose();
      }
    });
    current = buildEntry(currentEntry);
    current.scale.setScalar(1 / (current.userData.baseScale || 1));
    scene.add(current);
    (current.userData.ammoDots || []).forEach((d) => d.material.color.setHex(0xffffff));
    applyTankHealth(current, health);
    buildCallouts();
  }

  function step(d) { state.index += d; show(); }

  function setGroup(g) {
    state.group = g;
    state.index = 0;
    for (const b of groupRow.children) b.classList.toggle('on', b.dataset.group === g);
    show();
  }

  for (const g of GROUPS) {
    const b = document.createElement('button');
    b.dataset.group = g;
    b.textContent = GROUP_LABELS[g];
    b.addEventListener('click', () => setGroup(g));
    groupRow.appendChild(b);
  }

  function setEngine(on) {
    if (on === running) return;
    running = on;
    engineBtn.classList.toggle('on', running);
    engineBtn.textContent = running ? 'engine on' : 'engine off';
    if (running) {
      sfx.play('tank_spool_up');
      if (!bed) {
        const h = sfx.loop('tank_thruster', { gain: 1 });
        if (h) { bed = h; }
      }
    } else {
      sfx.play('tank_spool_down');
      landTankFeel(feel);
      if (bed) { bed.stop(0.12); bed = null; }
    }
  }

  // the wreck, previewable as often as you like — this is a bench, not a run
  function previewWreck() {
    if (!current || wreckT > 0) return;
    setEngine(false);
    feel.hoverT = 0;
    landTankFeel(feel);
    sfx.play('tank_destroyed');
    const up = new THREE.Vector3(0, 1, 0);
    const fx = makeDebris(current, [up.x, up.y, up.z]);
    scene.add(fx); wreckFx.push(fx);
    const burst = makeDotBurst(0xffffff, [0, 1, 0], 54);
    const box = new THREE.Box3().setFromObject(current);
    const c = new THREE.Vector3(); box.getCenter(c);
    burst.scale.setScalar(Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 0.45);
    burst.position.copy(c);
    scene.add(burst); wreckFx.push(burst);
    current.visible = false;
    wreckT = 1.25;
  }

  engineBtn.addEventListener('click', () => setEngine(!running));
  destroyBtn.addEventListener('click', previewWreck);
  healthEl.addEventListener('input', () => {
    health = parseFloat(healthEl.value);
    applyTankHealth(current, health);
  });

  root.querySelector('#units-prev').addEventListener('click', () => step(-1));
  root.querySelector('#units-next').addEventListener('click', () => step(1));
  // --- THE CODEX: lore panel, one ⧉ per entry + one for the whole book ---
  const lorePanel = document.getElementById('units-lorepanel');
  const loreBody = document.getElementById('lore-body');
  const copyBtn = (text, title = 'copy this entry') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'log-copy';
    b.textContent = '⧉';
    b.title = title;
    b.addEventListener('click', () => {
      if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
      navigator.clipboard.writeText(text).then(() => {
        b.textContent = '✓';
        setTimeout(() => { b.textContent = '⧉'; }, 900);
      }, () => {});
    });
    return b;
  };
  function renderLore() {
    if (loreBody.childElementCount) return; // built once
    const section = (title) => {
      const h = document.createElement('div');
      h.className = 'lp-section';
      h.textContent = title;
      loreBody.appendChild(h);
    };
    const entry = (e) => {
      const d = document.createElement('div');
      d.className = 'lp-entry';
      const h = document.createElement('div');
      h.className = 'lp-name';
      h.textContent = `${e.name} — ${e.tag} `;
      h.appendChild(copyBtn(loreText(e)));
      const b = document.createElement('p');
      b.textContent = e.body;
      const v = document.createElement('p');
      v.className = 'lp-visual';
      v.textContent = e.visual;
      d.append(h, b, v);
      loreBody.appendChild(d);
    };
    section('THE WORLD');
    for (const e of LORE_WORLD) entry(e);
    for (const g of GROUPS) {
      section(GROUP_LABELS[g].toUpperCase());
      for (const c of entriesIn(g)) if (LORE[c.id]) entry(LORE[c.id]);
    }
  }
  // REVERSE EXPORT (operator, 2026-09-03): the unit AS THE GAME DRESSES IT —
  // the cast model plus the shell rack, the heat sleeves, the tint and the
  // edge outlines — as one .glb, to hand back to blueprint-to-life. The
  // authored model went one way through its export script; this is the
  // other direction, so what the game shows can be looked at on the bench.
  // Lines export as glTF LINES primitives; a basic material as unlit-ish
  // PBR; the emissive tint travels as emissive. Nothing is re-derived.
  const exportToken = (document.querySelector('meta[name="cb"]') || {}).content || 'dev';
  function exportCurrent(onDone) {
    if (!current || !currentEntry) return;
    // the bench addresses everything by name; an unnamed root is the one
    // node it cannot
    if (!current.name) current.name = `${currentEntry.id}_Game_Root`;
    current.updateMatrixWorld(true);
    new GLTFExporter().parse(current, (buf) => onDone(buf, `${currentEntry.id}_game_${exportToken}.glb`),
      (err) => console.error('[export] failed', err), { binary: true, onlyVisible: true });
  }
  const exportBtn = root.querySelector('#units-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportCurrent((buf, name) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      exportBtn.textContent = '✓ ' + name;
      setTimeout(() => { exportBtn.textContent = 'export'; }, 1600);
    }));
  }
  // ?export=1 — run the exporter headless and report what it produced;
  // ?dump=1 adds the bytes as base64 in numbered console chunks (Chrome
  // truncates a very long console line), so a shell can reassemble the
  // .glb without a download dialog.
  if (new URLSearchParams(location.search).get('export') === '1') {
    setTimeout(() => exportCurrent((buf, name) => {
      let nodes = 0, meshes = 0, lines = 0;
      current.traverse((o) => { nodes++; if (o.isMesh) meshes++; if (o.isLineSegments || o.isLine) lines++; });
      console.log(`EXPORT ${name} bytes=${buf.byteLength} nodes=${nodes} meshes=${meshes} lines=${lines}`);
      if (new URLSearchParams(location.search).get('dump') === '1') {
        const bytes = new Uint8Array(buf);
        let b64 = '';
        for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        b64 = btoa(b64);
        const CH = 40000, n = Math.ceil(b64.length / CH);
        for (let i = 0; i < n; i++) console.log(`GLBCHUNK ${i + 1}/${n} ${b64.slice(i * CH, (i + 1) * CH)}`);
      }
    }), 6000);
  }
  const loreBtn = root.querySelector('#units-lore');
  if (loreBtn && lorePanel) {
    loreBtn.addEventListener('click', () => {
      renderLore();
      lorePanel.classList.toggle('hidden');
    });
    document.getElementById('lore-close').addEventListener('click',
      () => lorePanel.classList.add('hidden'));
    const allBtn = document.getElementById('lore-copyall');
    allBtn.addEventListener('click', () => {
      const ids = GROUPS.flatMap((g) => entriesIn(g).map((c) => c.id));
      if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
      navigator.clipboard.writeText(loreAll(ids)).then(() => {
        allBtn.textContent = '✓ copied';
        setTimeout(() => { allBtn.textContent = '⧉ copy all'; }, 1100);
      }, () => {});
    });
  }

  preloadServer();
  preloadContainer();
  preloadFabricator();   // Bobby is in the roster now; start his bytes with the rest

  // ?lore=1 — open the codex on load (screenshot / deep-link hook)
  if (new URLSearchParams(location.search).get('lore') === '1' && lorePanel) {
    renderLore();
    lorePanel.classList.remove('hidden');
  }

  const spinBtn = root.querySelector('#units-spin');
  spinBtn.addEventListener('click', (ev) => {
    state.spin = !state.spin;
    ev.currentTarget.classList.toggle('on', state.spin);
  });
  lookSel.addEventListener('change', () => {
    state.towerLook = lookSel.value;
    preloadLook(state.towerLook).then(() => { if (active) show(); });
    show();
  });
  addEventListener('keydown', (ev) => {
    if (!active) return;
    if (ev.key === 'ArrowLeft') step(-1);
    else if (ev.key === 'ArrowRight') step(1);
  });
  addEventListener('resize', () => { if (active) resize(); });

  let last = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    if (!active) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    // Drive the unit's own idle animation, so a turret sweeps here as in game.
    // Switchable off: a sweeping turret cannot be judged against the hull
    // axis, and every "the beam looks tilted" report so far has been the
    // sweep rather than the model. Frozen, it returns to its rest pose.
    if (current && current.userData.tick && state.sweep) current.userData.tick(clock);
    if (current && state.spin) current.rotation.y += dt * 0.35;
    stepFire(dt);
    // barrel heat: the same cool->hot lerp the game runs, on the same sleeve
    if (heat > 0) heat = Math.max(0, heat - dt);
    const sleeve = current && current.userData.heatSleeve;
    if (sleeve) sleeve.material.color.lerpColors(sleeveCool, sleeveHot, heat / HEAT_COOL);
    for (let i = shells.length - 1; i >= 0; i--) {
      const sh = shells[i];
      sh.position.addScaledVector(sh.userData.vel, dt);
      sh.userData.life -= dt;
      if (sh.userData.life <= 0) { scene.remove(sh); shells.splice(i, 1); }
    }
    // the bench runs the shipping feel driver over the shipping VALUES —
    // FEEL is the same object the TD tab's folder writes to
    stepTankFeel(feel, dt, running, FEEL);
    applyTankFeel(current, feel, FEEL);
    for (let i = wreckFx.length - 1; i >= 0; i--) {
      const alive = wreckFx[i].userData.tick && wreckFx[i].userData.tick(dt);
      if (alive === false) { scene.remove(wreckFx[i]); wreckFx.splice(i, 1); }
    }
    if (wreckT > 0) {
      wreckT -= dt;
      if (wreckT <= 0 && current) { current.visible = true; feel.hoverT = 0; landTankFeel(feel); }
    }
    controls.update();
    postfx.render();
    drawCallouts();   // after render, so it tracks the frame just drawn
  }

  // Where a tower's shots leave from: the head, read off the render transform
  // rather than recomputed from the mast constants.
  function towerMuzzle(unit) {
    const head = unit && unit.userData.head;
    const v = new THREE.Vector3();
    if (head) head.getWorldPosition(v);
    return v;
  }

  function addFx(p, vel, life, col, grav = 0) {
    if (fx.length >= FX_MAX) return;
    fx.push({ p: p.clone(), v: vel.clone(), t: 0, life, col, grav });
  }

  // Missiles use the shared flight owner and actual sockets. Other weapon
  // kinds retain the catalogue schematic preview.
  function towerShot(def, origin) {
    const config=CONTENT.missiles[def.key];
    if(config){
      if(!missilePool?.available || current?.userData.loading)return;
      const muzzle=current.userData.muzzles?.[missileIndex++ % current.userData.muzzles.length];
      if(!muzzle)return;
      if(current.userData.pitchNode)current.userData.pitchNode.rotation.x=-MISSILE_LAUNCH_ELEVATION*Math.PI/180;
      current.updateMatrixWorld(true);
      const from=muzzle.getWorldPosition(new THREE.Vector3());
      const direction=new THREE.Vector3(0,0,1).applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion()));
      const scale=muzzle.getWorldScale(new THREE.Vector3()).x;
      const target=current.localToWorld(new THREE.Vector3(0,0,(def.range || 3)*CELL));
      const m=launchDart(missilePool,{config,from:from.toArray(),target:target.toArray(),direction:direction.toArray(),scale});
      scene.add(m.mesh);missiles.push(m);return;
    }
    const reach = (def.range || 3) * CELL;
    const speed = (shotOf(def).projSpeed || 12) * CELL;
    const col = new THREE.Color(def.color || 0xffffff);
    const dir = new THREE.Vector3(0, 0, 1);
    const life = Math.max(0.25, reach / Math.max(0.001, speed));
    switch (shotOf(def).kind) {
      case 'lob': {
        // a lob: up and out, gravity brings it down, and it BURSTS
        const t = life * 1.9;
        const count=fx.length;
        addFx(origin, new THREE.Vector3(0, reach * 0.9 / t, reach / t), t, col, -2 * (reach * 0.9) / (t * t));
        if(fx.length===count)break;
        fx[fx.length - 1].burst = { n: 40, col, r: reach * 0.32 };
        const shell=makeOrdnanceShell(CELL*.28);scene.add(shell);fx[fx.length-1].shell=shell;
        break;
      }
      case 'throw':
      case 'lance': {
        let entry=heldBeams.find(e=>e.key===def.key);
        const end=origin.clone().addScaledVector(dir,reach);
        if(!entry){const obj=makeBeamShot(origin,end,shotOf(def).beamColor||def.color,shotOf(def).kind,{glowWidth:CELL*.6});scene.add(obj);entry={obj,key:def.key,left:0};heldBeams.push(entry);}
        entry.obj.userData.setEndpoints(origin,end);entry.left=firingFor(def.key).beamHold;
        break;
      }
      case 'field': {
        // a pulse expanding to the edge of its reach
        const N = 64;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          addFx(origin, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(reach / 0.9), 0.9, col);
        }
        break;
      }
      default:
        addFx(origin, dir.clone().multiplyScalar(speed), life, col);
    }
  }

  function firePattern() {
    if (!currentEntry || currentEntry.kind !== 'tower') return;
    const def = TOWER_BY_KEY[currentEntry.id];
    if (!def || !current) return;
    fireLeft = firingFor(def.key).duration||4;
                           // watch the cadence, not one shot
    fireGap = 0;
    if (!rangeRing) {
      const g = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(Math.cos(a), 0, Math.sin(a));
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      rangeRing = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
        color: 0x6fe6ff, transparent: true, opacity: 0.35,
      }));
      scene.add(rangeRing);
    }
    const o = towerMuzzle(current);
    rangeRing.position.set(o.x, 0, o.z);
    rangeRing.scale.setScalar((def.range || 3) * CELL);
    rangeRing.visible = true;
  }

  function stepFire(dt) {
    for(let i=heldBeams.length-1;i>=0;i--){const e=heldBeams[i];e.left-=dt;e.obj.userData.update(performance.now()/1000);
      if(e.left<=0){scene.remove(e.obj);e.obj.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});heldBeams.splice(i,1);}}

    for(let i=missiles.length-1;i>=0;i--){
      if(advanceDart(missilePool,missiles[i],dt)){missilePool.release(missiles[i].mesh);missiles.splice(i,1);}
    }
    if (fireLeft > 0) {
      fireLeft -= dt;
      fireGap -= dt;
      const def = currentEntry && TOWER_BY_KEY[currentEntry.id];
      if (def && fireGap <= 0) {
        fireGap = Math.max(def.key==='lancer'?firingFor(def.key).duration:0,1 / effectiveStats(def,0).rate);
        weaponVoice.shot(def.key);
        towerShot(def, towerMuzzle(current));
      }
      if (fireLeft <= 0){if(rangeRing)rangeRing.visible=false;}
    }
    const activeDef=currentEntry&&TOWER_BY_KEY[currentEntry.id];
    weaponVoice.update(activeDef?.key||'',!!activeDef&&(fireLeft>0||heldBeams.length>0));
    let k = 0;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      if (f.grav) f.v.y += f.grav * dt;
      f.p.addScaledVector(f.v, dt);
      if(f.shell){f.shell.position.copy(f.p);f.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),f.v.clone().normalize());}
      if (f.t >= f.life) {
        if(f.shell){scene.remove(f.shell);f.shell.geometry.dispose();f.shell.material.dispose();}
        if (f.burst) {
          const { n: bn, col, r } = f.burst;
          for (let b = 0; b < bn; b++) {
            const a = (b / bn) * Math.PI * 2, e = 0.3 + 0.7 * ((b * 7) % 5) / 5;
            addFx(f.p, new THREE.Vector3(Math.cos(a) * e, 0.5 * e, Math.sin(a) * e)
              .multiplyScalar(r / 0.5), 0.5, col, -2.2);
          }
        }
        fx.splice(i, 1);
        continue;
      }
    }
    for (const f of fx) {
      if (k >= FX_MAX) break;
      fxPos[k * 3] = f.p.x; fxPos[k * 3 + 1] = f.p.y; fxPos[k * 3 + 2] = f.p.z;
      const fade = 1 - f.t / f.life;
      fxCol[k * 3] = f.col.r * fade; fxCol[k * 3 + 1] = f.col.g * fade; fxCol[k * 3 + 2] = f.col.b * fade;
      k++;
    }
    fxGeo.setDrawRange(0, k);
    fxGeo.attributes.position.needsUpdate = true;
    fxGeo.attributes.color.needsUpdate = true;
  }

  // Fire everything a shot does. The shell leaves the muzzle ANCHOR and flies
  // along the barrel's own world +Z — derived from the render transform, per
  // the house rule, so it stays right when the turret has swept.
  function fireShell() {
    fireTankFeel(feel, FEEL);
    if (!current) return;
    heat = HEAT_COOL;
    const muzzle = current.userData.muzzle;
    if (!muzzle) return;
    const shell = makeOrdnanceShell(2,'y');
    const span = new THREE.Box3().setFromObject(current).getSize(new THREE.Vector3());
    shell.scale.setScalar(Math.max(span.x, span.y, span.z) * 0.03);
    muzzle.getWorldPosition(shell.position);
    const q = new THREE.Quaternion();
    muzzle.getWorldQuaternion(q);
    shell.userData.vel = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
      .multiplyScalar(Math.max(span.x, span.y, span.z) * 2.2);
    shell.userData.life = 1.1;
    scene.add(shell);
    shells.push(shell);
  }

  // --- blueprint callouts ---------------------------------------------------
  // Labels projected onto the model, naming parts by the model's OWN node
  // names. This exists because "the bit at the back that looks tilted" cost a
  // fortnight: the tilt was a 6 deg slew on Turret_Pivot, and neither of us
  // could name the piece we were each looking at.
  const callLayer = root.querySelector('#units-callouts');
  let callTags = [];
  let callOn = false;
  const callProj = new THREE.Vector3();

  function buildCallouts() {
    if (!callLayer) return;
    callLayer.textContent = '';
    callTags = [];
    const marks = (current && current.userData.callouts) || [];
    for (const m of marks) {
      const tag = document.createElement('div');
      tag.className = 'callout';
      const lead = document.createElement('s');   // the leader back to the part
      const name = document.createElement('b');
      name.textContent = m.userData.callout.label;
      const node = document.createElement('i');
      node.textContent = m.userData.callout.node;
      tag.append(lead, name, node);
      const dot = document.createElement('u');    // sits exactly on the part
      dot.className = 'cdot';
      callLayer.append(tag, dot);
      callTags.push({ m, tag, lead, dot });
    }
    callLayer.classList.toggle('hidden', !callOn || !callTags.length);
  }

  const ROW = 24;    // px of vertical room a label needs to stay readable
  const OUT = 74;    // px the label column clears the model's silhouette by
  const FOOT = 200;  // px of chrome at the bottom labels must not fall behind

  function drawCallouts() {
    if (!callOn || !callTags.length) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    // 1. project every anchor, and measure the model's own screen extent as
    //    we go. Splitting on the CANVAS centre was wrong: the tank is rarely
    //    centred in frame, so nearly every part landed on one side and the
    //    labels piled into a single column far from their parts.
    const sides = { l: [], r: [] };
    let minX = Infinity, maxX = -Infinity, midX = 0, seen = 0;
    for (const t of callTags) {
      t.m.getWorldPosition(callProj).project(camera);
      // a point behind the camera projects to a MIRRORED point in front of it
      if (callProj.z > 1) { t.tag.style.opacity = '0'; t.dot.style.opacity = '0'; t.off = true; continue; }
      t.off = false;
      t.tag.style.opacity = '';
      t.dot.style.opacity = '';
      t.ax = (callProj.x * 0.5 + 0.5) * w;
      t.ay = (-callProj.y * 0.5 + 0.5) * h;
      minX = Math.min(minX, t.ax); maxX = Math.max(maxX, t.ax);
      midX += t.ax; seen++;
    }
    if (!seen) return;
    midX /= seen;
    for (const t of callTags) if (!t.off) sides[t.ax < midX ? 'l' : 'r'].push(t);

    // 2. the two columns sit OUTSIDE the model's silhouette, clamped into the
    //    frame. Labels over the tank hide the thing they are naming.
    const colX = {
      l: Math.max(90, minX - OUT),
      r: Math.min(w - 12, maxX + OUT),
    };

    // 3. declutter each column: sort by height, then walk down enforcing a
    //    minimum gap. Greedy and one-pass — with ~20 labels the cost of
    //    anything cleverer is not repaid, and the leader lines carry the
    //    association anyway once a label has been nudged off its part.
    for (const key of ['l', 'r']) {
      const col = sides[key];
      col.sort((a, b) => a.ay - b.ay);
      let y = -Infinity;
      for (const t of col) {
        t.ly = Math.max(t.ay, y + ROW);
        y = t.ly;
      }
      // The usable band stops above the control row: a label pushed behind
      // the buttons is a label you cannot read, which defeats the point.
      const over = y - (h - FOOT);
      if (over > 0) for (const t of col) t.ly = Math.max(ROW * 0.5, t.ly - over);
      for (const t of col) {
        t.lx = colX[key];
        t.tag.classList.toggle('left', key === 'l');
        // left-hand labels are pulled back by their OWN width, which only a
        // transform percentage knows — a percentage margin would resolve
        // against the layer instead and fling them off screen
        t.tag.style.transform = `translate(${t.lx}px, ${t.ly}px)`
          + (key === 'l' ? ' translateX(-100%)' : '');
        t.dot.style.transform = `translate(${t.ax}px, ${t.ay}px)`;
        // the leader starts at the tag's inner edge and runs back to the part
        const dx = t.ax - t.lx;
        const dy = t.ay - t.ly;
        t.lead.style.width = `${Math.hypot(dx, dy)}px`;
        t.lead.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
    }
  }

  sweepBtn = root.querySelector('#units-sweep');
  if (sweepBtn) {
    sweepBtn.addEventListener('click', () => {
      state.sweep = !state.sweep;
      sweepBtn.classList.toggle('on', state.sweep);
      // freezing snaps the turret back to rest, which is the point of it
      if (!state.sweep && current && current.userData.tick) current.userData.tick(0);
    });
    if (new URLSearchParams(location.search).get('sweep') === '0') sweepBtn.click();
  }

  const labelsBtn = root.querySelector('#units-labels');
  if (labelsBtn) {
    labelsBtn.addEventListener('click', () => {
      callOn = !callOn;
      labelsBtn.classList.toggle('on', callOn);
      if (callLayer) callLayer.classList.toggle('hidden', !callOn || !callTags.length);
      drawCallouts();
    });
    // ?labels=1 — headless has no pointer, same reason as ?tune=1
    if (new URLSearchParams(location.search).get('labels')) labelsBtn.click();
  }
  // ?fire=N fires a shell N seconds into the run, so the shell in flight and
  // the red-hot barrel can be caught in a still frame.
  {
    const at = parseFloat(new URLSearchParams(location.search).get('fire'));
    if (Number.isFinite(at)) {
      setTimeout(() => {
        // whichever the selection is: a tank fires a shell, a tower shows
        // its pattern. One hook, because it is one question — what happens
        // when this thing shoots.
        if (currentEntry && currentEntry.kind === 'tower') firePattern();
        else { setEngine(true); fireShell(); }
      }, at * 1000);
    }
  }

  // --- the tuning panel ----------------------------------------------------
  // One panel, two subjects. Controls are generated from a knob table and
  // write straight into the object the GAME reads, so there is no apply step
  // and nothing to sync — what is in front of you is what ships, mid-drag.
  //
  // Which table it shows follows the selection: a tank gets TANK_FEEL_KNOBS,
  // Tank and type each provide their own pure knob schema;
  // wiring to keep in step for no gain.
  tunerApi = (function wireTuner() {
    const panel = root.querySelector('#units-tuner');
    const list = root.querySelector('#units-tuner-knobs');
    const titleEl = root.querySelector('#units-tuner-title');
    const open = root.querySelector('#units-tune');
    if (!panel || !list || !open) return { setSubject() {}, isOpen: () => false };
    loadFeel();
    // the type values live in the same localStorage the game reads, so a
    // setting found on this bench is already in force next time you play —
    // restored through the schema's own clamp, because our own storage is
    // untrusted input after a schema change
    const TYPE = loadTypeFeel();
    const applyType = () => {
      applyFontPack(currentFontPack(), document.documentElement, TYPE, currentShoutPack());
    };
    const saveType = () => saveTypeFeel(TYPE);
    const resetType = () => { Object.assign(TYPE, makeTypeParams(TYPE_FEEL)); saveType(); };
    applyType();
    const SUBJECTS = {
      tank: {
        title: 'tank feel', knobs: TANK_FEEL_KNOBS, values: FEEL,
        save: saveFeel, reset: resetFeel, format: () => formatFeelCode(FEEL),
        onChange: null,   // the driver reads FEEL every frame; nothing to rebuild
      },
    };
    // THE TYPE BENCH is a third subject, not a second tuner. Everything the
    // panel already does — build rows from a knob table, restore from
    // storage through the schema's clamp, copy as source — is exactly what
    // the type knobs need, and a second implementation would drift.
    SUBJECTS.type = {
      title: 'message type', knobs: TYPE_KNOBS, values: TYPE,
      save: saveType, reset: resetType, format: () => formatTypeCode(TYPE),
      onChange: applyType,
    };
    let subject = SUBJECTS.tank;
    let rows = [];

    function build() {
      list.textContent = '';
      rows = [];
      titleEl.textContent = subject.title;
      let group = null;
      for (const k of subject.knobs) {
        if (k.group !== group) {
          group = k.group;
          const h = document.createElement('div');
          h.className = 'tuner-group';
          h.textContent = group;
          list.appendChild(h);
        }
        const row = document.createElement('label');
        row.className = 'tuner-row' + (k.choices ? ' choice' : '');
        const name = document.createElement('span');
        name.className = 'tuner-name';
        name.textContent = k.label;
        row.appendChild(name);

        let read;
        if (k.choices) {
          // a choice is a list, not a range — a slider over shape names would
          // be unreadable and would interpolate between things that do not
          const sel = document.createElement('select');
          for (const c of k.choices) {
            const o = document.createElement('option');
            o.value = c; o.textContent = c;
            sel.appendChild(o);
          }
          sel.addEventListener('change', () => {
            subject.values[k.key] = sel.value;
            subject.save();
            if (subject.onChange) subject.onChange();
          });
          row.appendChild(sel);
          read = () => { sel.value = subject.values[k.key]; };
        } else {
          const dp = Math.max(0, Math.ceil(-Math.log10(k.step)));
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = k.min; slider.max = k.max; slider.step = k.step;
          const out = document.createElement('output');
          slider.addEventListener('input', () => {
            subject.values[k.key] = Number(slider.value);
            out.textContent = Number(subject.values[k.key]).toFixed(dp);
            if (subject.onChange) subject.onChange();
          });
          slider.addEventListener('change', subject.save);
          row.append(slider, out);
          read = () => {
            slider.value = subject.values[k.key];
            out.textContent = Number(subject.values[k.key]).toFixed(dp);
          };
        }
        read();
        rows.push(read);
        list.appendChild(row);
      }
    }

    const refresh = () => { for (const r of rows) r(); };
    const setOpen = (on) => {
      panel.classList.toggle('tuner-hidden', !on);
      open.classList.toggle('on', on);
      if (on) refresh();
    };

    build();

    // --- the fonts bench --------------------------------------------------
    // The panel of specimens is one element; the sliders are the tuner in
    // its `type` subject. Opening either opens both, because a slider with
    // nothing to look at is the problem this was built to solve.
    const fontsPanel = root.querySelector('#units-fonts');
    const fontsOpen = root.querySelector('#units-fonts-open');
    if (fontsPanel && fontsOpen) {
      // TWO faces, because the layer has two jobs. The shout tier is the
      // game's voice raised; the banner tier is the game talking, and text
      // you have to read wants a different face from text that hits you.
      const packSel = root.querySelector('#units-font-pack');
      const shoutSel = root.querySelector('#units-font-shout');
      for (const sel of [packSel, shoutSel]) {
        for (const n of FONT_NAMES) {
          const o = document.createElement('option');
          o.value = n; o.textContent = n;
          sel.appendChild(o);
        }
      }
      packSel.value = currentFontPack();
      shoutSel.value = currentShoutPack();
      const setPacks = () => {
        applyFontPack(packSel.value, document.documentElement, TYPE, shoutSel.value);
        try {
          localStorage.setItem('ssg-font', packSel.value);
          localStorage.setItem('ssg-font-shout', shoutSel.value);
        } catch (e) { /* private mode */ }
      };
      packSel.addEventListener('change', setPacks);
      shoutSel.addEventListener('change', setPacks);
      const setFonts = (on) => {
        fontsPanel.classList.toggle('fonts-hidden', !on);
        fontsOpen.classList.toggle('on', on);
        if (on) {
          packSel.value = currentFontPack();
          shoutSel.value = currentShoutPack();
          subject = SUBJECTS.type;
          titleEl.textContent = subject.title;
          build();
          setOpen(true);
        }
      };
      fontsOpen.addEventListener('click', () =>
        setFonts(fontsPanel.classList.contains('fonts-hidden')));
      root.querySelector('#units-fonts-close').addEventListener('click', () => {
        setFonts(false);
        setOpen(false);
      });
      root.querySelector('#units-fonts-reset').addEventListener('click', () => {
        resetType(); refresh(); applyType();
      });
      const fcopy = root.querySelector('#units-fonts-copy');
      const flabel = fcopy.querySelector('.label');
      let frevert = 0;
      fcopy.addEventListener('click', async () => {
        clearTimeout(frevert);
        try {
          await navigator.clipboard.writeText(formatTypeCode(TYPE));
          fcopy.classList.add('ok'); flabel.textContent = 'copied';
        } catch {
          fcopy.classList.add('fail'); flabel.textContent = 'copy failed';
        }
        frevert = setTimeout(() => {
          fcopy.classList.remove('ok', 'fail'); flabel.textContent = 'copy code';
        }, 1400);
      });
      // ?fonts=1 opens the bench on load — headless has no pointer, and this
      // is now the surface the type decision is actually made on
      if (new URLSearchParams(location.search).get('fonts')) setFonts(true);
    }

    open.addEventListener('click', () => setOpen(panel.classList.contains('tuner-hidden')));
    // ?tune=1 opens it on load — headless has no pointer, so without this the
    // panel could only ever be verified by hand.
    if (new URLSearchParams(location.search).get('tune')) setOpen(true);
    root.querySelector('#units-tune-close').addEventListener('click', () => setOpen(false));
    root.querySelector('#units-tune-reset').addEventListener('click', () => {
      subject.reset(); refresh();
      if (subject.onChange) subject.onChange();
    });

    // Copy as SOURCE, not JSON: the destination is tankfeel.js or
    // the schema, and a blob you have to hand-translate is a blob nobody
    // transcribes.
    const copy = root.querySelector('#units-tune-copy');
    const label = copy.querySelector('.label');
    let revert = 0;
    copy.addEventListener('click', async () => {
      clearTimeout(revert);
      try {
        await navigator.clipboard.writeText(subject.format());
        copy.classList.add('ok'); label.textContent = 'copied';
      } catch {
        copy.classList.add('fail'); label.textContent = 'copy failed';
      }
      revert = setTimeout(() => {
        copy.classList.remove('ok', 'fail'); label.textContent = 'copy code';
      }, 1600);
    });

    return {
      setSubject(which) {
        // paging through the roster must not yank the panel off the type
        // bench: the bench is a deliberate mode, and losing your sliders
        // because you pressed → is the kind of thing that makes a tool
        // unusable
        const fp = root.querySelector('#units-fonts');
        if (fp && !fp.classList.contains('fonts-hidden')) return;
        open.hidden = which === 'tower';
        if (which === 'tower') { setOpen(false); return; }
        const next = SUBJECTS[which] || SUBJECTS.tank;
        // rebuild even when the subject is unchanged: stepping from one tower
        // to the next keeps the subject 'tower' but the head row belongs to a
        // different tower now, and a stale row would assign to the wrong one
        subject = next;
        build();
      },
      isOpen: () => !panel.classList.contains('tuner-hidden'),
    };
  })();

  resize();
  animate();

  // deep-link, so a specific unit can be linked to or screenshot headlessly:
  //   #units?group=hostile&unit=knot   ·   ?unitgroup=…&unit=… on the query
  const q = new URLSearchParams(location.search);
  const wantGroup = q.get('unitgroup');
  const wantUnit = q.get('unit') || (!wantGroup || wantGroup === 'friendly' ? DEFAULT_TANK : null);
  setGroup(GROUPS.includes(wantGroup) ? wantGroup : 'friendly');
  if (wantUnit) {
    for (const g of GROUPS) {
      const i = entriesIn(g).findIndex((e) => e.id === wantUnit);
      if (i !== -1) { setGroup(g); state.index = i; show(); break; }
    }
  }
  preloadLook(DEFAULT_TOWER_LOOK).then(() => { if (active) show(); });
  // async models arrive late; refresh once they land so the first look is real
  for (const id of ['mkcx', 'mkcx2']) preloadMkcx(id).then(() => { if (active) show(); });
  preloadMork().then(ok => { if (ok && active && currentEntry?.id === 'mork') show(); });

  if (q.get('acceptance') === '1') window.__stalheartUnits = {
    state: () => ({ asset: current?.userData.asset, stats: current?.userData.modelStats,
      // the BUILT unit's box, measured at the moment of asking. Only a SIZE when
      // the pose is frozen (?yaw=0&sweep=0): the turntable and the turret sweep
      // move the hull every frame, and an axis-aligned box around a rotating
      // object grows and shrinks with the angle it is caught at. Preferred over
      // the UNITSIZE console line, which can still be in flight just after
      // modelReady turns true and report the placeholder instead.
      proxy: !!current?.userData.proxy,
      size: current ? new THREE.Box3().setFromObject(current).getSize(new THREE.Vector3()).toArray() : null,
      hover: current?.getObjectByName('HOVER_RIG')?.position.y,
      recoil: current?.getObjectByName('GUN_RECOIL')?.position.z,
      muzzle: current?.userData.muzzle?.getWorldPosition(new THREE.Vector3()).toArray(),
      guns: current?.userData.laserGuns?.length, running,
      heat,cannonColor:current?.userData.heatSleeve?.material.color.getHex(),
      missileReady:!!missilePool,modelReady:!current?.userData.loading,
      missiles:missiles.map(m=>({config:m.config,t:m.t,name:m.mesh.name,position:m.mesh.position.toArray(),ignition:m.mesh.getObjectByName('EXHAUST_FX').visible})) }),
    fire: () => currentEntry?.kind==='tower'?firePattern():fireShell(),
  };

  return {
    dispose(){active=false;missilesDisposed=true;clear();missilePool?.dispose();},
    setActive(on) {
      active = on;
      if (on) { resize(); show(); }
      else { stopBed(); setEngine(false); } // nothing runs on a tab you left
    },
  };
}
