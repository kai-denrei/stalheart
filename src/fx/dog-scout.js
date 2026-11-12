// THE RECON DOG'S SEAT (owner, 2026-11-10: "the player can control the dog to go explore in 3rd person"; spec
// docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 2.A, 2.B). The beats (src/domain/story-beats.js `scout`) ask, in order:
// print() Isao's print of RECKON K9 (src/fx/pet-print.js forced, its close-up and its line; on an acceptance page that did not ask for the dog,
// ?dog=1, the K9 is born at once), born(), begin() the seat, state() (the surveys, the dog home, the pack's cell), release() the seat let go (the
// K9 a base companion from then). The seat reads the keys the tank's free drive reads (W A S D or the arrows, Shift the sprint, the double tap's
// cruise; the phone's stick writes the same keys), steps the pure rules (src/domain/dog-scout.js), moves the K9's body (src/fx/companions.js
// driven) over the lattice's open floor (the rock and the standing structures stop it at its radius), and holds the camera on a chase rig behind it
// (a camera shot of its own, 'dogScout', live: the world runs under it). The survey points (DOG_SCOUT.points.count) ring the clearing (src/fx/site-ring.js) with a HUD
// marker each (its kind and distance); standing in a ring `survey.seconds` surveys it (a toast, the pay, Isao's line on the first two); a body that
// touches the dog knocks it down. An acceptance page that did not ask for the dog surveys at once and never takes the seat (a headless page would
// stand at the first point for ever), as THE FIRST ORDERS pass by such a page.
//   host: scene, camera, metres(), cellSide(), graph(), dungeon(), story(), solidAt(p, padUnits), companions(), petPrint(), startShot, endShot,
//         shotActive(), shotId(), enemies() (the live records), eco(), showToast, showBrief, held() ({ fwd, back, left, right, sprint }), unheld() (the cruise
//         let go as the seat ends), auto (true: survey at once, no seat)
//   createDogScout(host) -> { tick(dt), print(), born(), begin(), state(), release(), test, dispose() }
import * as THREE from '../../vendor/three.module.js';
import { DOG_SCOUT } from '../content/dog-scout.js';
import { COMPANIONS } from '../content/companions.js';
import { createScout, drive, steer, surveyStep, allSurveyed, knock, stepKnock, release, pickPoints, contactCell } from '../domain/dog-scout.js';
import { BLOCKED, bfsDist, bfsPath } from '../dungeon.js';
import { makeSiteRing, disposeSiteRing } from './site-ring.js';

const D = DOG_SCOUT, K9 = COMPANIONS.units.findIndex((u) => u.id === D.unit), TUNE = { ...D, top: D.drive.sprint ?? COMPANIONS.units[K9]?.top ?? 5.5 };
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createDogScout(h) {
  let s = createScout([]), begun = false, active = false, homeNow = false, contact = -1, points = [], rings = [], hud = null, birthChecked = false, lens = null;
  let path = null, pathAt = -9, pathFor = null, clock = 0, said = 0, solid = new Map(), solidAt = -99;
  const pos = new THREE.Vector3(), heading = new THREE.Vector3(), camFwd = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3(), x = new THREE.Vector3();
  const tmpCam = new THREE.PerspectiveCamera(); let cell = -1;
  const c = () => h.companions?.() ?? null, G = () => h.graph(), dg = () => h.dungeon(), m = () => h.metres();
  const centre = (ci) => G().centers[ci];
  function nearestFrom(start, p) {
    let k = start, d = Infinity; const g = G();
    for (let moved = true; moved;) { moved = false; for (const nb of [k, ...g.adj[k]]) { const q = g.centers[nb], dd = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2; if (dd < d - 1e-15) { d = dd; k = nb; moved = true; } } }
    return k;
  }
  const solidCell = (ci) => { if (clock - solidAt > 5) { solid.clear(); solidAt = clock; } if (!solid.has(ci)) solid.set(ci, !!h.solidAt?.(centre(ci), m() * 2)); return solid.get(ci); };
  const blockedCell = (ci) => dg().tags[ci] === BLOCKED;

  // THE POINTS, once a planet: the band of open floor on the clearing round the heart, the last on the gate's bearing; the pack's cell off the
  // clearing, contact.hops beyond the gate toward the sinkhole (src/domain/dog-scout.js pickPoints, contactCell)
  function choose() {
    const st = h.story(), g = G(), d = dg(); if (!st) return;
    const hops = bfsDist(g.adj, [d.heart], (ci) => d.tags[ci] !== BLOCKED), inside = (ci) => !!st.inside?.(ci);
    const cands = [], out = [];
    for (let ci = 0; ci < g.centers.length; ci++) { if (hops[ci] < 0 || d.tags[ci] === BLOCKED) continue; (inside(ci) ? cands : out).push({ ci, hops: hops[ci] }); }
    const gate = st.gateCell ?? -1, toward = gate >= 0 ? g.centers[gate] : null;
    const ring = pickPoints({ centers: g.centers, heart: d.heart, cands: cands.filter((p) => !solidCell(p.ci)), toward }, TUNE);
    points = ring.map((ci, i) => ({ ci, kind: D.points.kinds[i % D.points.kinds.length] }));
    contact = gate >= 0 ? contactCell({ centers: g.centers, cands: out, gateHops: hops[gate], toward: d.spawn >= 0 ? g.centers[d.spawn] : null }, TUNE) : -1;
    s = createScout(points.map((p) => ({ ci: p.ci, kind: p.kind.id })));
  }

  // the chase rig behind the dog (a shot's pose: src/fx/camera-shot.js); the rig's heading follows the dog's over camera.ease seconds
  function chase(out) {
    const M = m(), C = D.camera; up.copy(pos).normalize();
    const p = v.copy(up).multiplyScalar(1 + 0.2 * M);
    out.pos.copy(p).addScaledVector(up, C.up * M).addScaledVector(camFwd, -C.back * M);
    tmpCam.position.copy(out.pos); tmpCam.up.copy(up); tmpCam.lookAt(w.copy(p).addScaledVector(up, C.lookUp * M).addScaledVector(camFwd, C.ahead * M));
    out.quat.copy(tmpCam.quaternion);
  }
  function takeShot() {
    h.startShot({ id: 'dogScout', dur: 1e6, skippable: false, poseAt: (u, out) => chase(out), from: { pos: h.camera.position, quat: h.camera.quaternion }, easeIn: D.camera.easeIn });   // out of the print's last frame, no cut (2026-11-12 evening)
    if (!lens) { lens = { near: h.camera.near }; h.camera.near = D.camera.near; h.camera.updateProjectionMatrix(); }
  }
  function dropLens() { if (!lens) return; h.camera.near = lens.near; h.camera.updateProjectionMatrix(); lens = null; }

  // the rings and the HUD's markers (their kind and distance), the seat's line under them
  function showRings() {
    const g = G(), M = m(), side = D.survey.ringM * M / 0.42;
    rings = points.map((p) => makeSiteRing(h.scene, g.centers[p.ci], g.normals[p.ci], side, 0.3 * M, p.kind.colour));
  }
  function dimRing(i) { const r = rings[i]; if (r) r.material.opacity = 0.25; }
  function makeHud() {
    if (hud || typeof document === 'undefined') return;
    const el = document.createElement('div'); el.className = 'dog-scout-hud';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;font:600 12px/1.2 ui-monospace,monospace;letter-spacing:0.08em;color:#e8f0f4;text-shadow:0 1px 2px #000';
    const marks = [...points.map(() => 0), 0].map(() => { const k = document.createElement('div'); k.style.cssText = 'position:absolute;transform:translate(-50%,-100%);white-space:nowrap;padding:2px 6px;border:1px solid rgba(232,240,244,0.5);background:rgba(8,12,14,0.55)'; el.appendChild(k); return k; });
    const line = document.createElement('div'); line.style.cssText = 'position:absolute;left:50%;bottom:72px;transform:translateX(-50%);padding:4px 10px;background:rgba(8,12,14,0.6);border:1px solid rgba(232,240,244,0.35)'; el.appendChild(line);
    document.body.appendChild(el); hud = { el, marks, line };
  }
  function dropHud() { hud?.el.remove(); hud = null; }
  function markAt(k, p, text) {
    v.fromArray(p).normalize().multiplyScalar(1 + 2 * m()).project(h.camera);
    const W = innerWidth, H = innerHeight; let nx = v.x, ny = v.y;
    if (v.z > 1) { nx = -nx; ny = -ny; }   // behind the eye: mirrored onto the edge
    const edge = v.z > 1 || Math.abs(nx) > 0.92 || Math.abs(ny) > 0.88, kk = Math.max(Math.abs(nx) / 0.92, Math.abs(ny) / 0.88, 1);
    if (edge) { nx /= kk; ny /= kk; }
    k.style.left = `${((nx + 1) / 2) * W}px`; k.style.top = `${((1 - ny) / 2) * H}px`; k.textContent = text; k.style.display = '';
  }
  function paintHud() {
    if (!hud) return;
    const metresTo = (p) => Math.round(chord(pos.toArray(), v.fromArray(p).normalize().toArray()) / m());
    const done = allSurveyed(s);
    points.forEach((p, i) => { const k = hud.marks[i]; if (done || s.surveyed.includes(i)) { k.style.display = 'none'; return; } markAt(k, centre(p.ci), `${p.kind.label} · ${metresTo(centre(p.ci))} M${s.ring === i ? ` · ${Math.min(99, Math.round(100 * s.ringT / D.survey.seconds))}%` : ''}`); });
    const hm = hud.marks[points.length];
    if (done) markAt(hm, centre(dg().heart), `${D.words.homeMark} · ${metresTo(centre(dg().heart))} M`); else hm.style.display = 'none';
    hud.line.textContent = `${D.words.hint} · ${done ? D.words.home : D.words.surveyed(s.surveyed.length, points.length)}`;
  }

  // a step to `p` (a unit vector) is free: its cell and the cell at the body's leading edge are open floor, and no standing structure is there
  function free(p, dir) {
    const M = m(), c1 = nearestFrom(cell, p); if (blockedCell(c1)) return -1;
    w.copy(p).addScaledVector(dir, D.drive.radiusM * M * Math.sign(s.speed || 1)).normalize();
    const c2 = nearestFrom(c1, w); if (blockedCell(c2)) return -1;
    if (h.solidAt?.(p.toArray(), D.drive.radiusM * M)) return -1;
    return c1;
  }
  function moveBy(dir, metres) {
    v.copy(pos).addScaledVector(dir, metres * m()).normalize();
    const ci = free(v, dir); if (ci < 0) return false;
    pos.copy(v); cell = ci; return true;
  }
  const tangent = (out, from, to) => { out.copy(to).sub(from); up.copy(from).normalize(); out.addScaledVector(up, -out.dot(up)); return out.lengthSq() > 1e-18 ? out.normalize() : null; };

  // the next target: the nearest unsurveyed point, or the heart once all are; a waypoint three cells along the walk to it (open floor, off the
  // standing structures), read by the harness's driver (state().steer)
  function target() {
    if (allSurveyed(s)) return { i: 'home', ci: dg().heart };
    let best = null, bd = Infinity;
    points.forEach((p, i) => { if (s.surveyed.includes(i)) return; const d = chord(pos.toArray(), centre(p.ci)); if (d < bd) { bd = d; best = { i, ci: p.ci }; } });
    return best;
  }
  function waypoint(tg) {
    if (!tg) return null;
    if (pathFor !== tg.ci || clock - pathAt > 0.5 || !path) { pathFor = tg.ci; pathAt = clock; path = bfsPath(G().adj, cell, (ci) => ci === tg.ci, { has: (ci) => blockedCell(ci) || solidCell(ci) }); }
    if (!path) return tg.ci;
    const k = path.indexOf(cell);
    return path[Math.min(path.length - 1, (k < 0 ? 0 : k) + 3)];
  }
  const bearingTo = (ci) => { const t = tangent(x, pos, v.fromArray(centre(ci)).normalize()); if (!t) return 0; up.copy(pos).normalize(); return Math.atan2(w.crossVectors(heading, t).dot(up), heading.dot(t)); };

  function grant(i) {
    const p = points[i]; h.eco()?.addBiomass(D.survey.pay, { category: 'grant' });
    if (!h.auto) { h.showToast?.(`<div class="wave-num">${D.words.toast(p.kind.label, D.survey.pay)}</div>`, 1600); dimRing(i); }
    if (!h.auto && said < D.words.lines.length && s.surveyed.length < points.length) h.showBrief?.(D.words.lines[said++]);
  }
  const pose = (oneShot = null) => ({ pos: pos.toArray(), heading: heading.toArray(), speed: s.speed, oneShot });

  function tick(dt) {
    clock += dt;
    const cs = c();
    // THE DOG STANDS AS A COMPANION wherever the opening is not its own (a chapter, SKIP TUTORIAL, a static stage, a jump): born at once
    if (!birthChecked && cs && h.story()?.beats) { birthChecked = true; const st = h.story().beats.state(); if (st.scout == null && st.settle == null && cs.life(K9) === 'unborn') cs.birth(K9); }
    if (!active || !cs) return;
    if (!h.shotActive()) takeShot();   // another shot took the camera and ended (or ended ours): the chase again
    const input = h.held();
    if (stepKnock(s, dt, TUNE) === 'up') cs.driven(K9, pose());
    const st = steer(s, input, dt, TUNE);
    up.copy(pos).normalize();
    if (st.turn) heading.applyAxisAngle(up, st.turn);
    heading.addScaledVector(up, -heading.dot(up)).normalize();
    if (Math.abs(st.speed) > 1e-3 && !moveBy(heading, st.speed * dt)) s.speed = 0;
    // the rig's heading after the dog's
    up.copy(pos).normalize(); camFwd.addScaledVector(up, -camFwd.dot(up)); if (camFwd.lengthSq() < 1e-12) camFwd.copy(heading);
    camFwd.lerp(heading, 1 - Math.exp(-dt / D.camera.ease)).addScaledVector(up, -camFwd.dot(up)).normalize();
    // the survey
    let ring = -1; const R = D.survey.ringM * m();
    points.forEach((p, i) => { if (ring < 0 && chord(pos.toArray(), centre(p.ci)) <= R) ring = i; });
    const got = surveyStep(s, dt, ring, TUNE); if (got >= 0) grant(got);
    // a body touching the dog knocks it down and away
    if (s.mode === 'driving' && s.graceLeft <= 0) for (const e of h.enemies?.() ?? []) {
      if (!e.alive || e.guard || !e.pos || chord(e.pos, pos.toArray()) > D.knock.touchM * m()) continue;
      if (knock(s, TUNE)) { const away = tangent(x, v.fromArray(e.pos).normalize(), pos.clone()); if (away) for (let k = 0; k < 8 && moveBy(away, D.knock.pushM / 8); k++); }
      break;
    }
    homeNow = chord(pos.toArray(), centre(dg().heart)) <= D.home.cells * h.cellSide();
    cs.driven(K9, pose(s.mode === 'knocked' ? D.knock.clip : null));
    paintHud();
  }

  return {
    tick,
    print() {
      const cs = c(); if (!cs || K9 < 0) return true;
      if (cs.life(K9) !== 'unborn') return true;
      if (h.auto) return cs.birth(K9);
      return !!h.petPrint?.()?.force(K9, { easeIn: D.camera.printEase, hand: D.camera.hand });   // one move: out of the landing's hold, into the chase
    },
    born: () => { const cs = c(); return !cs || K9 < 0 || cs.life(K9) === 'born'; },
    begin() {
      if (begun) return true;
      begun = true; choose();
      const cs = c(), at = cs?.point(K9);
      if (!points.length || !cs || !at || h.auto) {   // no seat: the surveys counted done, the dog home
        for (let i = 0; i < points.length; i++) { s.surveyed.push(i); grant(i); }
        if (!points.length) s.points = [];
        homeNow = true; return true;
      }
      pos.fromArray(at.pos).normalize(); heading.fromArray(at.heading); cell = at.cell; camFwd.copy(heading);
      drive(s); active = true; homeNow = true;
      cs.driven(K9, pose()); showRings(); makeHud(); takeShot(); paintHud();
      return true;
    },
    state: () => ({ begun, active, auto: !!h.auto, mode: s.mode, surveyed: s.surveyed.length, total: points.length, done: begun && (allSurveyed(s) || !points.length), home: homeNow, contact, knocks: s.knocks }),
    release() {
      const cs = c();
      if (active) { active = false; release(s); cs?.driven(K9, null); if (h.shotActive() && h.shotId?.() === 'dogScout') h.endShot(); dropLens(); h.unheld?.(); }
      for (const r of rings) disposeSiteRing(h.scene, r); rings = []; dropHud();
      return true;
    },
    test: {
      state: () => {
        const tg = active ? target() : null, wp = tg ? waypoint(tg) : null;
        return { begun, active, auto: !!h.auto, mode: s.mode, speed: +s.speed.toFixed(2), knocks: s.knocks, surveyed: s.surveyed.slice(), total: points.length, home: homeNow, contact, cell,
          points: points.map((p, i) => ({ ci: p.ci, kind: p.kind.id, m: active ? Math.round(chord(pos.toArray(), centre(p.ci)) / m()) : null, surveyed: s.surveyed.includes(i) })),
          target: tg?.i ?? null, steer: wp != null ? +bearingTo(wp).toFixed(3) : null, ring: s.ring, ringT: +s.ringT.toFixed(2),
          homeM: active ? Math.round(chord(pos.toArray(), centre(dg().heart)) / m()) : null, life: c()?.life(K9) ?? null, shot: h.shotActive() ? 'on' : 'off' };
      },
      // the harness's hands: the dog set on a point's centre (or 'home'), the rest of the drive the player's
      goto: (i) => { if (!active) return false; const ci = i === 'home' ? dg().heart : points[i]?.ci; if (ci == null) return false; pos.fromArray(centre(ci)).normalize(); cell = ci; return true; },
    },
    dispose() { this.release(); },
  };
}
