// THE ROVER'S ARRIVAL CARD (owner, 2026-11-13: "we should announced its arrival with a card showing the 3d model rotating and a brief explanation
// of what it does"). At the rover's first run out of home (src/domain/rover-card.js cardDue: once, never over a live wave, passed by on acceptance and
// skipped pages unless ?rovercard=1) the game pauses under a card: the rover's LOD1 (ROVER.model) turning on a small stage of its own (one WebGL
// renderer on the card's canvas, the bestiary's tinted wireframe on cloned geometry, so nothing the game draws is freed), YUSHI ROVER and its lines
// (src/content/rover.js ROVER_CARD). Any key, click or tap closes it: the loop stops, the renderer, the geometry and the materials are disposed and
// the game unpauses. The loop draws only while the card is open and the page is visible.
//   createRoverCard({ root, pause(v), search (the page's query), sectorRun() }) -> { tick(leftHome), state(), close() }
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture, setWireframe } from './model-fixture.js';
import { ROVER, ROVER_CARD } from '../content/rover.js';
import { cardDue, cardWanted } from '../domain/rover-card.js';
import { fightOf } from '../domain/closeup-gate.js';

const CSS = `.rover-card{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(4,7,6,.55);padding:16px;box-sizing:border-box}
.rover-card .rc-box{width:min(380px,100%);background:rgba(8,12,10,.94);border:1px solid #cfe6a0;color:#e8f0dc;font:13px/1.45 ui-monospace,Menlo,monospace;padding:14px 16px 12px;box-sizing:border-box}
.rover-card canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#050806;border:1px solid rgba(207,230,160,.25)}
.rover-card h3{margin:10px 0 0;font-size:18px;letter-spacing:.12em}.rover-card .rc-tag{opacity:.7;font-size:11px;letter-spacing:.1em}
.rover-card ul{margin:8px 0 6px;padding-left:16px}.rover-card li{margin:3px 0}.rover-card .rc-go{opacity:.6;font-size:11px;text-align:right}`;

export function createRoverCard({ root, pause, search = '', sectorRun = () => null }) {
  const wanted = cardWanted(search), fight = () => fightOf(sectorRun());
  let shown = false, open = false, el = null, renderer = null, scn = null, cam = null, turn = null, raf = 0, frames = 0, calls = 0, disposed = false, error = null, last = 0;
  const owned = [];
  function draw(now) {
    raf = 0; if (!open) return;
    raf = requestAnimationFrame(draw);
    if (document.hidden || !renderer || !turn) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    turn.rotation.y += ROVER_CARD.spin * dt;
    renderer.render(scn, cam); frames++; calls = renderer.info.render.calls;
  }
  function stage(canvas) {
    const [w, hgt] = ROVER_CARD.size;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true }); } catch (e) { error = String(e); return; }
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1)); renderer.setSize(w, hgt, false); renderer.setClearColor(0x050806, 1);
    scn = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, w / hgt, 0.1, 100); cam.position.set(0, 3.2, 11); cam.lookAt(0, 0.2, 0);
    turn = new THREE.Group(); turn.rotation.y = -0.6; scn.add(turn);
    loadModelFixture(ROVER.model).then((src) => {
      if (!open) return;
      const obj = cloneFixture(src);
      obj.traverse((o) => { if (o.isMesh && o.geometry) { o.geometry = o.geometry.clone(); owned.push(o.geometry); } });
      setWireframe(obj, true, { tint: true });
      obj.traverse((o) => { if (o.isMesh && o.material) owned.push(o.material); });
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
      const k = 6 / Math.max(size.x, size.y, size.z, 1e-6);
      obj.scale.multiplyScalar(k); obj.position.sub(mid.multiplyScalar(k)); turn.add(obj);
    }, (e) => { error = String(e); });
    raf = requestAnimationFrame(draw);
  }
  function show() {
    shown = true; open = true; pause(true);
    if (!document.getElementById('rover-card-css')) { const s = document.createElement('style'); s.id = 'rover-card-css'; s.textContent = CSS; document.head.append(s); }
    el = document.createElement('div'); el.id = 'rover-card'; el.className = 'rover-card';
    el.innerHTML = `<div class="rc-box"><canvas width="${ROVER_CARD.size[0]}" height="${ROVER_CARD.size[1]}"></canvas><h3></h3><div class="rc-tag"></div><ul></ul><div class="rc-go"></div></div>`;
    el.querySelector('h3').textContent = ROVER_CARD.name; el.querySelector('h3').style.color = ROVER_CARD.colour;
    el.querySelector('.rc-tag').textContent = ROVER_CARD.tag; el.querySelector('.rc-go').textContent = ROVER_CARD.dismiss;
    for (const l of ROVER_CARD.lines) { const li = document.createElement('li'); li.textContent = l; el.querySelector('ul').append(li); }
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); close(); });
    addEventListener('keydown', onKey, true);
    (root ?? document.body).append(el);
    stage(el.querySelector('canvas'));
  }
  function onKey(e) { e.stopPropagation(); e.preventDefault(); close(); }
  function close() {
    if (!open) return;
    open = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    removeEventListener('keydown', onKey, true);
    for (const o of owned) o.dispose?.(); owned.length = 0;
    if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); }
    renderer = scn = cam = turn = null; disposed = true;
    el?.remove(); el = null; pause(false);
  }
  return {
    // leftHome: the rover has left its pad on a run (its first is the arrival)
    tick(leftHome) { if (!shown && cardDue({ shown, wanted, leftHome, ...fight() })) show(); },
    state: () => ({ wanted, shown, open, frames, calls, disposed, error }),
    close,
  };
}
