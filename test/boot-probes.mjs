// boot-probes.mjs — the boot probes (src/platform/boot-probes.js, moved out of src/td-tab.js in refactor round 2) over a recording
// host and captured timers: no flag schedules nothing; ?stateprobe=1 logs a STATE line every 2 s reading the controller's lets at the
// moment it fires; ?keyprobe=1 clears what freezes the hull, presses S then T with real KeyboardEvents and reads the shield's rack;
// ?layout=N measures the HUD's boxes after N seconds and reports their overlaps.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { BLOCKED } from '../src/dungeon.js';

const log = [], timers = [], lines = [];
const take = () => log.splice(0);
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
const realLog = console.log;
console.log = (s) => lines.push(s);
const restore = () => { console.log = realLog; };
globalThis.innerWidth = 844; globalThis.innerHeight = 390; globalThis.devicePixelRatio = 2;
globalThis.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' });
globalThis.window = { visualViewport: null };
globalThis.KeyboardEvent = class { constructor(type, o) { Object.assign(this, { type }, o); } };
const boxes = { '#shell-bar': [0, 0, 40, 40], '#td-stats': [20, 10, 200, 40], '#td-wave': [500, 100, 600, 160], '#td-tower': [0, 0, 0.5, 9], '#td-brief': [300, 300, 400, 340] };
const hiddenSel = '#td-brief';
globalThis.document = { querySelector: (sel) => (boxes[sel] ? { sel, getBoundingClientRect: () => { const [l, t, r, b] = boxes[sel]; return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }; } } : null) };
globalThis.getComputedStyle = (el) => ({ display: el.sel === hiddenSel ? 'none' : 'block' });
const { createBootProbes } = await import('../src/platform/boot-probes.js');

const el = (name, hidden = true) => { const s = new Set(hidden ? ['hidden'] : []); return { name, classList: { contains: (c) => s.has(c), add: (c) => { log.push([`${name}.add`, c]); s.add(c); }, remove: (c) => { log.push([`${name}.remove`, c]); s.delete(c); } } }; };
function host(flags, o = {}) {
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100); camera.position.set(0, 0, 10); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const S = { paused: true, deploy: { n: 1 }, rack: 2, ...o.S };
  const shield = { rack: 0, t: 1, coolUntil: 9 };
  globalThis.dispatchEvent = (ev) => { log.push(['dispatch', ev.type, ev.key]); if (ev.type === 'keydown' && ev.key === (o.spends ?? 't')) shield.rack -= 1; };
  const h = {
    flags, simulateCoarse: () => { log.push(['simulateCoarse']); return 4; }, mobileShell: !!o.mobile, toastEl: el('toast'), diagOverlay: { html: (t) => `<i>${t}</i>` },
    camera, player: { pos: [0, 0, 0], cur: 3, next: 4 }, renderer: { domElement: { width: 1688, height: 780 } }, params: { view: 'chase', creature: 'mork' },
    keys: { laser: false }, shotId: () => null, msgEl: el('msg'), briefEl: el('brief', false), sitrepEl: null, deployProgress: () => 0.5,
    root: { querySelector: (id) => (log.push(['root.querySelector', id]), el(id, false)) }, shots: { drop: () => log.push(['shots.drop']) },
    deployShieldNow: () => { log.push(['deployShieldNow', S.deploy]); return S.deploy ? 'deploying' : 'ok'; }, shield,
    throttle: () => 0.25, stick: () => null, cellSide: () => 2, paused: () => S.paused, buildMode: () => false, deploy: () => S.deploy, playerHP: () => 3,
    tankLostDeploys: () => 0, playerDown: () => null, dungeon: () => ({ tags: [0, 0, 0, BLOCKED] }), autoMode: () => 'off', gotoCi: () => -1, playerMesh: () => ({ visible: true }),
    setPaused: (v) => { log.push(['setPaused', v]); return (S.paused = v); }, setDeploy: (v) => { log.push(['setDeploy', v]); return (S.deploy = v); },
  };
  return { S, h, shield };
}
const fire = (ms) => { const i = timers.findIndex((t) => t.ms === ms); assert.ok(i >= 0, `a timer at ${ms} ms`); timers.splice(i, 1)[0].fn(); };

try {
  // ---- no flags: nothing armed
  {
    const { h } = host({});
    assert.deepEqual(createBootProbes(h).started, [], 'no probe armed without a flag');
    assert.equal(timers.length, 0, 'no flag schedules nothing');
    assert.deepEqual(createBootProbes(host({ stateprobe: '2', keyprobe: 'yes', layout: '0' }).h).started, [], 'only "1" arms the state and key probes, only N > 0 the layout');
    assert.equal(timers.length, 0);
  }

  // ---- ?stateprobe=1: 71 lines, 2 s apart, each reading the lets when it fires
  {
    const { S, h } = host({ stateprobe: '1' }, { mobile: true });
    assert.deepEqual(createBootProbes(h).started, ['stateprobe']);
    assert.deepEqual(timers.map((t) => t.ms), Array.from({ length: 71 }, (_, k) => k * 2000), 'every 2 s from 0 to 140 s');
    S.paused = false; S.deploy = { n: 2 };
    fire(4000);
    const line = lines.pop();
    assert.match(line, /^STATE t= 4s paused=false shot=- build=false msg=false brief=true sitrep=false deploy=#2@0\.50 hp=3 /, 'the lets as they are when the line fires');
    assert.match(line, / cur=3\(BLOCKED\) next=4 auto=off thr=0\.25 goto=-1 view=chase unit=mork camToTank=5\.0cells tankVisible=true inFrustum=true /, 'the hull\'s cell, the camera\'s distance in cells');
    assert.match(line, / tankScreen=\(0\.00,0\.00\) canvas=1688x780 inner=844x390 visual=.* dpr=2 view=chase camToTank=5\.0c thr=0\.25 stick=false laser=false$/);
    assert.deepEqual(take(), [['toast.remove', 'hidden']], 'on the mobile shell the line also goes to the caption lane');
    assert.equal(h.toastEl.innerHTML, '<i>t=4s ' + line.slice(line.indexOf('tankScreen=')) + '</i>', 'the caption is the line\'s screen half');
    S.deploy = null; fire(0);
    assert.match(lines.pop(), /^STATE t= 0s .* deploy=- /, 'no deploy reads "-"');
    timers.length = 0; take();
  }

  // ---- ?keyprobe=1: S drives, T shields
  {
    const { S, h, shield } = host({ keyprobe: '1' });
    assert.deepEqual(createBootProbes(h).started, ['keyprobe']);
    assert.deepEqual(timers.map((t) => t.ms), [6000], 'one probe, 6 s in');
    fire(6000);
    assert.deepEqual(take(), [['root.querySelector', '#td-msg'], ['#td-msg.add', 'hidden'], ['setPaused', false], ['shots.drop'], ['setDeploy', null], ['deployShieldNow', null],
      ['dispatch', 'keydown', 's'], ['dispatch', 'keyup', 's'], ['dispatch', 'keydown', 't'], ['dispatch', 'keyup', 't']], 'the message hidden, unpaused, shots dropped, the deploy cleared BEFORE the control call, then S and T pressed');
    assert.equal(S.paused, false); assert.equal(S.deploy, null);
    assert.deepEqual(lines.splice(0), ["KEYPROBE control call = ok (must be 'ok' before the keys mean anything)", 'KEYPROBE rack 2 -> S:2 -> T:1 s-spent=0 t-spent=1 direct=ok OK — S drives, T shields']);
    assert.equal(shield.rack, 1);
    // a binding that spends on S is reported WRONG
    const w = host({ keyprobe: '1' }, { spends: 's' });
    createBootProbes(w.h); fire(6000); take();
    assert.match(lines.splice(0)[1], /^KEYPROBE rack 2 -> S:1 -> T:1 s-spent=1 t-spent=0 direct=ok WRONG — S still spends a charge, or T does not$/);
  }

  // ---- ?layout=2: the coarse rules re-measured 1.2 s early, then every visible box and the overlaps
  {
    const { h } = host({ layout: '2', coarse: '1' });
    assert.deepEqual(createBootProbes(h).started, ['layout']);
    assert.deepEqual(timers.map((t) => t.ms), [800, 2000]);
    fire(800);
    assert.deepEqual(take(), [['simulateCoarse']]);
    assert.deepEqual(lines.splice(0), ['COARSE simulated at measure: 4 media blocks now apply']);
    fire(2000);
    assert.deepEqual(lines.splice(0), [
      'LAYOUT menu      x 0..40  y 0..40',
      'LAYOUT hud       x 20..200  y 10..40',
      'LAYOUT wave      x 500..600  y 100..160',
      'LAYOUT OVERLAP menu x hud — 20x30px',
      'LAYOUT viewport 844x390 coarse=true (SIMULATED) dpr=2 — 1 overlaps',
    ], 'missing, display:none and sub-pixel pieces skipped; the menu and the stats overlap');
  }
} finally { restore(); }
console.log('Boot probes: nothing armed without a flag; the state probe reads the lets when it fires; the key probe clears the deploy before pressing S and T; the layout probe reports boxes and overlaps.');
