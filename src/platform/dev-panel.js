// THE DEV PANEL (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the lil-gui bindings of the game page: the
// looks, the camera, the world's knobs, the tank's feel, the orbital strike, the plasma plume, the bloom and its weights, the sound.
// The controller creates the GUI (the vendor import stays there) and hands it in; this returns the three controls it refreshes
// (viewCtrl, directiveCtrl, seedCtrl).
// `host` hands in the controller's fixed objects and functions as values (params, DIRECTIVES, HEART_LOOKS, PLASMA, TYPE, strikeTune,
// postfx, sfx, root, applyCreature, applyLook, applyTowerLook, regenerate, setView, syncCalloutMode, syncDirectiveChip) and the
// plasma plume it rebinds as a getter (plasma).
import { UNIT_NAMES } from '../units.js';
import { LOOK_NAMES } from '../looks.js';
import { FONT_NAMES, applyFontPack } from '../fonts.js';
import { TANK_FEEL_KNOBS } from '../tankfeel.js';
import { FEEL, loadFeel, saveFeel } from '../feelstore.js';
import { STRIKE_KNOBS } from '../strike.js';
import { BLOOM_GROUPS } from '../bloomweights.js';
import { TOWER_LOOK_NAMES } from '../towerlooks.js';

export function createDevPanel(gui, host) {
  // hero + portal styling swap IN PLACE — cosmetics never reset a run
  gui.add(host.params, 'creature', UNIT_NAMES).onChange(() => {
    host.applyCreature();
  });
  gui.add(host.params, 'look', LOOK_NAMES).onChange(host.applyLook);
  gui.add(host.params, 'wallTops', ['auto', 'bright', 'dim', 'black'])
    .name('wall tops').onChange(host.applyLook);
  const viewCtrl = gui.add(host.params, 'view', ['pov', 'third', 'orbit', 'drone'])
    .name('camera (V)').onChange((v) => host.setView(v));
  gui.add(host.params, 'speed', 0.2, 4, 0.1).name('wander speed');
  const directiveCtrl = gui.add(host.params, 'directive', host.DIRECTIVES).name('auto directive').onChange(host.syncDirectiveChip);
  gui.add(host.params, 'recoil', 0, 8, 0.1).name('shell recoil');
  gui.add(host.params, 'callouts').name('callout messages').onChange(host.syncCalloutMode);
  // Changing the physical footprint needs a new camp and spawn layout.
  gui.add(host.params, 'heartLook', Object.keys(host.HEART_LOOKS)).name('stalheart (new run)')
    .onFinishChange(host.regenerate);
  gui.add(host.params, 'waveSize', 1, 6, 1).name('wave size').onFinishChange(host.regenerate);
  gui.add(host.params, 'wavesPerSector', 5, 40, 1).name('waves per sector');
  gui.add(host.params, 'waveGap', 3, 20, 1).name('wave gap (s)');
  gui.add(host.params, 'waveCap', 15, 60, 1).name('wave cap (s)');
  gui.add(host.params, 'obstacles', 0.05, 0.4, 0.05).onFinishChange(host.regenerate);
  gui.add(host.params, 'rewards', 0, 12, 1).onFinishChange(host.regenerate);
  gui.add(host.params, 'orbs', 0, 40, 1).name('missile triads').onFinishChange(host.regenerate);
  gui.add(host.params, 'orbRespawn', 0, 30, 1).name('triad respawn (s)');
  const seedCtrl = gui.add(host.params, 'seed', 0, 99999, 1).onFinishChange(host.regenerate);
  gui.add(host.params, 'points', 150, 8000, 50).name('sample points').onFinishChange(host.regenerate);
  gui.add(host.params, 'rooms', 2, 24, 1).onFinishChange(host.regenerate);
  gui.add(host.params, 'roomRadius', 1, 8, 1).name('room radius').onFinishChange(host.regenerate);
  gui.add(host.params, 'corridorWidth', 1, 4, 1).name('corridor width').onFinishChange(host.regenerate);
  gui.add(host.params, 'extraCorridors', 0, 5, 1).name('extra corridors').onFinishChange(host.regenerate);
  gui.add(host.params, 'wallHeight', 0.02, 0.15, 0.005).name('wall height').onFinishChange(host.regenerate);
  gui.add(host.params, 'relaxIters', 0, 200, 10).name('relax iters').onFinishChange(host.regenerate);
  gui.add(host.params, 'randomize').name('↻ random seed');
  gui.add(host.params, 'regenerate').name('↻ regenerate');
  gui.add(host.params, 'previewDestruction').name('✳ destroy tank (preview)');

  gui.add(host.params, 'towerLook', TOWER_LOOK_NAMES)
    .name('tower look').onChange(host.applyTowerLook);
  gui.add(host.params, 'font', FONT_NAMES).name('message font').onChange((n) => {
    applyFontPack(n, document.documentElement, host.TYPE);
    try { localStorage.setItem('ssg-font', n); } catch (e) { /* private mode */ }
  });
  // The type KNOBS live on the units tab's fonts bench, not here. Two GUIs over two copies of the same values is the drift this
  // repo has already paid for once (the hover params vs the viewer's defaults), and the operator's actual complaint was that
  // tuning type mid-game is impossible — a shout lives 1.2 seconds. This tab keeps the face switch, which is a glance, and hands
  // the sliders to the bench.
  // Guessed wrong twice by eye, so they are dialled by hand — but the folder is GENERATED from the shared schema and writes to
  // the shared object. The unit viewer's tuning modal is built from the same list over the same values, so a setting found on the
  // bench is already in force here.
  loadFeel();   // whatever was dialled in the viewer is already in force
  const feelFolders = new Map();
  for (const k of TANK_FEEL_KNOBS) {
    if (!feelFolders.has(k.group)) {
      const f = gui.addFolder(k.group);
      f.close();
      feelFolders.set(k.group, f);
    }
    feelFolders.get(k.group).add(FEEL, k.key, k.min, k.max, k.step)
      .name(k.label).onFinishChange(saveFeel);
  }

  // strike knobs share the schema machinery with the feel folders
  const strikeF = gui.addFolder('orbital strike');
  for (const k of STRIKE_KNOBS) {
    if (k.bool) strikeF.add(host.strikeTune, k.key).name(k.label);
    else strikeF.add(host.strikeTune, k.key, k.min, k.max, k.step).name(k.label);
  }
  strikeF.close();

  // THE PLUME, by eye. Colour and reach are the rank's and are not touchable
  // here; the SHAPE of the flame is taste, and taste is judged with the
  // controls in hand rather than reasoned from a number.
  const plasmaF = gui.addFolder('plasma');
  plasmaF.add(host.PLASMA, 'coreFrac', 0, 1, 0.01).name('hot root length');
  plasmaF.add(host.PLASMA, 'dots').name('dots on');
  plasmaF.add(host.PLASMA, 'plumeLen', 0, 1, 0.01).name('dots length (x beam)');
  plasmaF.add(host.PLASMA, 'plumeWidth', 0, 5, 0.05).name('dots width (x beam)');
  plasmaF.add(host.PLASMA, 'coreRoot', 0.05, 1, 0.01).name('width at muzzle');
  plasmaF.add(host.PLASMA, 'squash', 0, 1.5, 0.05).name('vertical squash');
  plasmaF.add(host.PLASMA, 'flow', 0, 6, 0.05).name('flow speed');
  plasmaF.add(host.PLASMA, 'bias', 0.5, 3, 0.05).name('root density');
  plasmaF.add(host.PLASMA, 'twist', 0, 24, 0.5).name('corkscrew');
  plasmaF.add(host.PLASMA, 'size', 1, 8, 0.1).name('dot size').onChange((v) => {
    if (host.plasma()) for (const pl of host.plasma()) pl.pts.material.size = v;
  });
  plasmaF.close();
  gui.add(host.params, 'autoUpgrade').name('drones auto-upgrade');

  const bloomF = gui.addFolder('bloom');
  bloomF.add(host.postfx.params, 'enabled').name('enabled').onChange((v) => host.postfx.setEnabled(v));
  bloomF.add(host.postfx.params, 'strength', 0, 3, 0.05).onChange((v) => host.postfx.setParams({ strength: v }));
  bloomF.add(host.postfx.params, 'radius', 0, 1, 0.01).onChange((v) => host.postfx.setParams({ radius: v }));
  bloomF.add(host.postfx.params, 'threshold', 0, 1, 0.01).onChange((v) => host.postfx.setParams({ threshold: v }));

  // per-group glow. These are AMOUNTS, not brightness: the map can stay a
  // bright cyan wireframe while barely blooming at all.
  const weightsF = bloomF.addFolder('weights');
  for (const g of BLOOM_GROUPS) {
    weightsF.add(host.postfx.weights, g, 0, 3, 0.05).name(g);
  }
  // a tuning session must survive a reload
  const BW_KEY = 'ssg.td.bloomWeights';
  try {
    const savedW = JSON.parse(localStorage.getItem(BW_KEY) || 'null');
    if (savedW && typeof savedW === 'object') {
      for (const g of BLOOM_GROUPS) {
        if (typeof savedW[g] === 'number') host.postfx.weights[g] = savedW[g];
      }
      weightsF.controllers.forEach((c) => c.updateDisplay());
    }
  } catch { /* private mode or corrupt value — defaults are fine */ }
  weightsF.onChange(() => {
    try { localStorage.setItem(BW_KEY, JSON.stringify(host.postfx.weights)); } catch { /* ignore */ }
  });

  // sound. The encode is peak-normalized and the manifest carries each
  // sound's trim gain, so these are the coarse balance -- and the tuning
  // surface, since the levels shipped were derived from durations and
  // fire rates rather than heard.
  const soundF = gui.addFolder('sound');
  const soundState = { ...host.sfx.levels, mute: host.sfx.muted };
  soundF.add(soundState, 'master', 0, 1, 0.01).onChange((v) => host.sfx.setMaster(v));
  soundF.add(soundState, 'towers', 0, 1, 0.01).onChange((v) => host.sfx.setBus('towers', v));
  soundF.add(soundState, 'tank', 0, 1, 0.01).onChange((v) => host.sfx.setBus('tank', v));
  soundF.add(soundState, 'enemies', 0, 1, 0.01).onChange((v) => host.sfx.setBus('enemies', v));
  soundF.add(soundState, 'ui', 0, 1, 0.01).onChange((v) => host.sfx.setBus('ui', v));
  const muteCtrl = soundF.add(soundState, 'mute').onChange((v) => { host.sfx.setMute(v); syncSoundChip(); });

  // the pad button and the panel toggle are one state, two surfaces
  const soundBtn = host.root.querySelector('#td-pad-sound');
  function syncSoundChip() {
    if (soundBtn) {
      soundBtn.textContent = host.sfx.muted ? '\u2298' : '\u266A';   // off / on, monochrome
      soundBtn.classList.toggle('on', !host.sfx.muted);
    }
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      host.sfx.setMute(!host.sfx.muted);
      soundState.mute = host.sfx.muted;
      muteCtrl.updateDisplay();
      syncSoundChip();
    });
  }
  syncSoundChip();

  // phones: start with the panel folded so the maze isn't buried
  if (matchMedia('(pointer: coarse), (max-width: 700px)').matches) gui.close();
  return { viewCtrl, directiveCtrl, seedCtrl };
}
