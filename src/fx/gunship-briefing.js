// The gunship's briefing: a skippable, once-per-browser military brief the
// first time the seat is offered. The KORP turns slowly as a wireframe in
// its own small renderer while the brief steps through the airframe, the
// orbit and the fuel state, the three guns and the gunner's role. Pure
// presentation: the host pauses the game, opens it, and takes the seat when
// it closes.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { GUNSHIP_GUNS, GUNSHIP_ORBIT } from '../content/gunship.js';

const KORP_URL = 'assets/models/korp/korp_d0_lod1.glb';
const SEEN_KEY = 'stalheart:v1:gunship-briefing';
const PAGES = [
  { head: 'KORP / GS01 · HEAVY GUNSHIP', body: ['MÖRK manufacturer family. Forward attack, ground support.', '30 × 32 m airframe. Four tilt engines: cruise to hover.', 'Crew aboard: none. Guns slaved to the ground station.'] },
  { head: 'ORBIT · FUEL STATE', body: [`Low on fuel. No manoeuvre, no landing.`, `Fixed pass over the base: ${GUNSHIP_ORBIT.pass} s out, ${GUNSHIP_ORBIT.station} s overhead.`, 'While it is overhead the guns are yours. Then you watch it come around.'] },
  { head: `${GUNSHIP_GUNS.rotary.label} · ROTARY × 2`, body: ['Six-barrel, 1800 rounds a minute.', 'Sustained fire. Walks a horde off the wall.', 'Tight blast. Free while on station.'] },
  { head: `${GUNSHIP_GUNS.bofors.label} · BOFORS`, body: ['Explosive, mid-tier, slow cadence.', 'Breaks a bunched mass apart.', 'Wider blast. Free while on station.'] },
  { head: `${GUNSHIP_GUNS.heavy.label} · M102 · ORBITAL STRIKE`, body: ['One shell, slow reload. This is the orbital strike.', 'Rationed: arm, paint, launch. Conserve it for breaches.', 'Widest blast. It opens your own walls too.'] },
  { head: 'GUNNER', body: ['You take the optic and choose the gun. You never fly it.', 'Every gun fires where it is pointed. The rings say what of yours is inside.', 'No lockout. No safety on the light guns. Aim.'] },
];

export function createGunshipBriefing(root) {
  const el = document.createElement('div'); el.id = 'gunship-briefing'; el.hidden = true;
  el.innerHTML = `<div class="sheet"><header><h1>&gt; ORBITAL ASSET BRIEFING_</h1><p class="sub">KORP / GS01 // wireframe survey // ground station uplink</p></header>
    <div class="body"><canvas></canvas><div class="text"><h2></h2><ul></ul><div class="dots">${PAGES.map(() => '<i></i>').join('')}</div></div></div>
    <footer><span>SPACE OR CLICK · NEXT</span><span><button type="button" data-skip>SKIP</button> <button type="button" data-next>NEXT</button></span></footer></div>`;
  root.append(el);
  const canvas = el.querySelector('canvas'), h2 = el.querySelector('h2'), ul = el.querySelector('ul'), dots = [...el.querySelectorAll('.dots i')], next = el.querySelector('[data-next]');
  let renderer = null, scene = null, cam = null, model = null, raf = 0, page = 0, onClose = null, t0 = 0, opened = 0;
  const seen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
  const remember = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* no store: the brief simply shows again */ } };
  function setup() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(32, 3 / 2, 0.1, 500);
    const grid = new THREE.GridHelper(120, 30, 0x2f5a62, 0x1d3a41); grid.position.y = -0.02; scene.add(grid);
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(KORP_URL, (g) => {
      model = g.scene;
      model.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0xbfe6ea, wireframe: true, transparent: true, opacity: 0.85 }); });
      for (const n of ['L', 'R']) { const p = model.getObjectByName(`GUN_${n}_PITCH`); if (p) p.rotation.x = Math.PI / 4; }
      const hv = model.getObjectByName('GUN_HEAVY_PITCH'); if (hv) hv.rotation.x = Math.PI / 5;
      scene.add(model);
    });
  }
  function show(i) {
    page = Math.max(0, Math.min(PAGES.length - 1, i)); const p = PAGES[page];
    h2.textContent = p.head; ul.innerHTML = p.body.map((l) => `<li>${l}</li>`).join('');
    dots.forEach((d, k) => d.classList.toggle('on', k === page)); next.textContent = page === PAGES.length - 1 ? 'TAKE THE GUNS' : 'NEXT';
  }
  function tick(t) {
    if (el.hidden) return;
    const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
    const a = (t - t0) * 0.00035, rad = 46;   // one slow turn around the airframe
    cam.position.set(Math.sin(a) * rad, 16 + Math.sin(a * 0.7) * 6, Math.cos(a) * rad); cam.lookAt(0, 4, 0);
    for (const n of ['FL', 'FR', 'RL', 'RR']) { const e = model?.getObjectByName(`ENGINE_${n}_PITCH`); if (e) e.rotation.x = -Math.PI / 2 * (0.5 + 0.5 * Math.sin(a * 1.3)); }
    renderer.render(scene, cam); raf = requestAnimationFrame(tick);
  }
  function close() { if (el.hidden) return; el.hidden = true; cancelAnimationFrame(raf); remember(); const cb = onClose; onClose = null; cb?.(); }
  function advance() { if (page >= PAGES.length - 1) close(); else show(page + 1); }
  next.addEventListener('click', advance); el.querySelector('[data-skip]').addEventListener('click', close);
  canvas.addEventListener('click', advance);
  addEventListener('keydown', (e) => { if (el.hidden) return; e.stopImmediatePropagation(); if (e.key === 'Escape') close(); else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); } }, true);
  return {
    seen,
    isOpen: () => !el.hidden,
    opened: () => opened,
    open(cb) { setup(); onClose = cb; el.hidden = false; opened++; t0 = performance.now(); show(0); raf = requestAnimationFrame(tick); },
    dispose() { cancelAnimationFrame(raf); renderer?.dispose(); el.remove(); },
  };
}
