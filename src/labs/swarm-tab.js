// swarm-tab.js — the enemy study: what a crowd LOOKS like, and what it COSTS.
//
// The units tab answers "is this model right", one unit at a time, up close,
// and says so in its own header. This answers a different question — how a
// hundred of them read together, and what the frame pays — so it is a sibling
// rather than a mode bolted onto that carousel.
//
// Two panels, because the two questions are asked at once: a crowd you can
// re-shape by eye, and a readout that does not flatter it.
//
// ON MEASURING. requestAnimationFrame deltas measure VSYNC, not work: a first
// pass at this reported a flat 16.6 ms for every variant at every count, which
// is the display, not the renderer. The cost column here renders in a tight
// loop and blocks on gl.finish(), so it reports what the frame actually costs
// and can read far UNDER 16.6 ms. Both numbers are shown: `frame` is what a
// player would feel, `cost` is what the work is worth.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { makeDotEnemy } from '../units.js';
import { makeJelly } from '../jelly.js';
import { ENEMY_SPEC, CREATURE_TINTS, accentFor } from '../enemyspec.js';

const TYPES = Object.keys(CREATURE_TINTS);
const LAYOUTS = { grid: 'grid', lane: 'lane', cloud: 'scatter' };

// Deterministic: a study you cannot reproduce is an anecdote. No Math.random.
const h = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export function initSwarmTab(root) {
  root.innerHTML = `<div id="swarm">
    <div class="sw-side">
      <h2>enemy study</h2>
      <label>body <select data-k="type">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
      <label>form <select data-k="form"><option value="dots">dot cloud</option><option value="jelly">jelly body</option></select></label>
      <label>count <b data-v="count">100</b><input type="range" data-k="count" min="1" max="3000" step="1" value="100"></label>
      <label>density <b data-v="dens">1.0</b>&times;<input type="range" data-k="dens" min="0.2" max="4" step="0.1" value="1"></label>
      <label>spread <b data-v="spread">1.0</b>&times;<input type="range" data-k="spread" min="0.3" max="3" step="0.1" value="1"></label>
      <label>layout <select data-k="layout">${Object.keys(LAYOUTS).map((l) => `<option>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-k="spin" checked> turntable</label>
      <p class="sw-note">Bodies animate as the game animates them: the authored
      creatures and the swimmers deform in the vertex shader, the rest keep a
      transform idle. Belt colour is the roster's, not a swatch.</p>
    </div>
    <div class="sw-stage"><div class="sw-read" data-read>&nbsp;</div></div>
  </div>`;

  const stage = root.querySelector('.sw-stage');
  const read = root.querySelector('[data-read]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06090c);
  const cam = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
  cam.position.set(0, 20, 46);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(6, 12, 8); scene.add(key);

  const state = { type: TYPES[0], form: 'dots', count: 100, dens: 1, spread: 1, layout: 'grid', spin: true };
  let crowd = [], ticks = [], rebuildWanted = true, disposed = false, raf = 0;

  function clearCrowd() {
    for (const o of crowd) {
      scene.remove(o);
      o.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
      o.geometry?.dispose?.(); o.material?.dispose?.();
    }
    crowd = []; ticks = [];
  }

  function place(o, i, n) {
    const s = Math.sqrt(n) * 1.7 * state.spread;
    if (state.layout === 'grid') {
      const w = Math.ceil(Math.sqrt(n)), gap = 2.2 * state.spread;
      o.position.set((i % w - w / 2) * gap, 0, (Math.floor(i / w) - w / 2) * gap);
    } else if (state.layout === 'lane') {
      o.position.set((h(i, 5) - 0.5) * 9 * state.spread, 0, (i / n - 0.5) * s * 3);
    } else {
      o.position.set((h(i, 1) - 0.5) * s * 2, (h(i, 3) - 0.5) * 3, (h(i, 2) - 0.5) * s * 2);
    }
  }

  function build() {
    clearCrowd();
    const tint = CREATURE_TINTS[state.type] ?? 0xffffff;
    const cols = { walker: tint, walkerHi: accentFor(state.type) ?? 0xffffff };
    for (let i = 0; i < state.count; i++) {
      let o;
      try {
        o = state.form === 'jelly'
          ? makeJelly(cols)
          : makeDotEnemy(state.type, cols, state.dens);
      } catch { break; }          // an unbuildable body must not kill the loop
      o.scale.setScalar(state.form === 'jelly' ? 1.1 : (o.userData.baseScale ?? 1) * 1.6);
      place(o, i, state.count);
      scene.add(o); crowd.push(o);
      if (typeof o.userData.tick === 'function') ticks.push(o.userData.tick);
      else if (typeof o.tick === 'function') ticks.push((t) => o.tick(t, 1 / 60));
    }
    rebuildWanted = false;
  }

  // The honest cost: render in a tight loop and block until the GPU is done.
  const gl = renderer.getContext();
  function costMs(samples = 8) {
    const s = [];
    for (let i = 0; i < samples; i++) {
      const a = performance.now();
      renderer.render(scene, cam); gl.finish();
      s.push(performance.now() - a);
    }
    s.sort((x, y) => x - y);
    return s[s.length >> 1];
  }

  let last = performance.now(), frameMs = 16.7, acc = 0, cost = 0, t = 0;
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    frameMs = frameMs * 0.9 + (now - last + dt * 1000) * 0.1;
    t += dt;
    if (rebuildWanted) build();
    const w = stage.clientWidth || 1, hgt = stage.clientHeight || 1;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) {
      renderer.setSize(w, hgt, false); cam.aspect = w / hgt; cam.updateProjectionMatrix();
    }
    for (const fn of ticks) fn(t);
    if (state.spin) { const r = 34 * state.spread; cam.position.x = Math.sin(t * 0.12) * r; cam.position.z = Math.cos(t * 0.12) * r; cam.lookAt(0, 0, 0); }
    controls.update();
    renderer.render(scene, cam);
    acc += dt;
    if (acc > 0.5) {
      acc = 0; cost = costMs();
      const inf = renderer.info.render;
      const n = Math.max(1, crowd.length);
      read.innerHTML = `<b>${n}</b> bodies &middot; cost <b>${cost.toFixed(2)} ms</b>`
        + ` (${(cost * 1000 / n).toFixed(1)} &micro;s each) &middot; ${(cost / 16.67 * 100).toFixed(0)}% of a 60fps frame`
        + `<br>calls <b>${inf.calls}</b> &middot; points ${inf.points.toLocaleString()} &middot; tris ${inf.triangles.toLocaleString()}`
        + ` &middot; motion ${crowd[0]?.material?.userData?.motion ?? (state.form === 'jelly' ? 'shader' : '—')}`;
    }
  }

  for (const el of root.querySelectorAll('[data-k]')) {
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      state[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
      const out = root.querySelector(`[data-v="${k}"]`);
      if (out) out.textContent = el.type === 'range' && k !== 'count' ? Number(el.value).toFixed(1) : el.value;
      if (k !== 'spin') rebuildWanted = true;
    });
  }

  // The acceptance surface, in the units tab's idiom: the harness drives the
  // same controls a hand would, so a test cannot pass through a path the UI
  // does not have. `built` is the crowd actually in the scene, which is not
  // always `count` — an unbuildable body breaks the loop rather than throwing.
  const api = {
    set(k, v) {
      const el = root.querySelector(`[data-k="${k}"]`);
      if (!el) return false;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    state: () => ({
      ...state,
      built: crowd.length,
      motion: crowd[0]?.material?.userData?.motion ?? null,
      calls: renderer.info.render.calls,
      points: renderer.info.render.points,
      triangles: renderer.info.render.triangles,
      costMs: cost,
    }),
    types: TYPES.slice(),
  };
  window.__stalheartSwarm = api;

  loop();
  return {
    setActive: () => {},
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      clearCrowd(); controls.dispose(); renderer.dispose();
      renderer.domElement.remove();
      if (window.__stalheartSwarm === api) delete window.__stalheartSwarm;
    },
  };
}
