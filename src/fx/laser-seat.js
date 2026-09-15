// SOL-82'S SEAT: the player's hands on the orbital laser in the game. The lab's owner-approved layout (labs.html#laser,
// 2026-09-15-orbital-laser-lab-landed): the ground view large, the camera standing back along the player's forward and
// up from the contact, so the column, the smoke and the line it burns share one frame; the satellite's round scope in
// the bottom-left corner, where the pointer steers. Presentation and input only: the arsenal (src/fx/laser-arsenal.js)
// owns the pass and the beam, and the host owns the game's camera and what leaving means.
//
// Input, as in the lab: the pointer hovering or dragging in the scope aims (a touch drag aims without burning); the
// mouse button held in the scope, Space or the HOLD button burns; W/A/S/D or the arrows glide the aim while the beam is
// off and drag it with the beam's inertia while it burns; Esc or TANK leaves.
import * as THREE from '../../vendor/three.module.js';
import { LASER_BEAM, LASER_GAME, LASER_TELEMETRY, LASER_VIEW } from '../content/orbital-laser.js';
import { createLaserScope, scopeRect } from './laser-scope.js';
import { createInsetHud } from './laser-inset-hud.js';

const PAD_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const AMBER = '#ffb020';

// host: { arsenal, container (the element the game canvas fills), canvas, mobile, leave(), pause() }
export function createLaserSeat(root, host) {
  const { arsenal, canvas, container } = host;
  const scope = createLaserScope({ near: 0.0005, far: 50 });
  const hud = createInsetHud(container);
  const sphere = new THREE.Sphere(new THREE.Vector3(), 1), origin = new THREE.Vector3();
  const v = new THREE.Vector3(), p = new THREE.Vector3(), fw = new THREE.Vector3(), up = new THREE.Vector3(), eye = new THREE.Vector3(), m = new THREE.Matrix4();
  const look = new THREE.Vector3(), right = new THREE.Vector3(), camUp = new THREE.Vector3(), aimAt = new THREE.Vector3();
  root.classList.add('laser-seat');

  const panel = document.createElement('section');
  panel.id = 'laser-seat';
  panel.innerHTML = '<header>SOL-82 <small>ORBITAL LASER · SATELLITE SCOPE</small></header>'
    + '<div class="laser-seat-line"><b data-pass>AWAY</b><span class="laser-seat-bar"><i data-energy></i></span><span data-energy-label>ENERGY</span></div>'
    + '<div class="laser-seat-warn" data-warn hidden></div>'
    + `<footer>${host.mobile ? 'Drag in the scope to aim · HOLD burns · TANK leaves' : 'Aim in the scope · hold the mouse or Space to burn · WASD glides the aim · Esc leaves'}</footer>`;
  const keysEl = document.createElement('div');
  keysEl.id = 'laser-seat-keys';
  keysEl.innerHTML = '<button type="button" data-hold>HOLD</button><button type="button" data-tank>TANK</button>';
  root.append(panel, keysEl);
  const elPass = panel.querySelector('[data-pass]'), elEnergy = panel.querySelector('[data-energy]'), elLabel = panel.querySelector('[data-energy-label]'), elWarn = panel.querySelector('[data-warn]');
  const holdBtn = keysEl.querySelector('[data-hold]');

  let mouseHeld = false, spaceHeld = false, buttonHeld = false, steering = false, touchSteer = false, last = performance.now();
  let steerN = [0.5, 0.5];
  const keys = new Set(), padIntent = { x: 0, z: 0 }, padVel = { x: 0, z: 0 };
  const held = () => mouseHeld || spaceHeld || buttonHeld;
  const abort = new AbortController(), listen = (el, type, fn, o = {}) => el.addEventListener(type, fn, { ...o, signal: abort.signal });

  /* the lab's lens, kept clear of the views strip below it (bottom centre) and the seat's panel above it (top left) */
  const rect = () => scopeRect(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, { share: LASER_VIEW.inset, left: 16, bottom: 116, top: 150 });
  // the pointer in canvas pixels, and whether it is on the round lens
  function onLens(e) {
    const r = rect(), box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    return { inside: Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2)) <= r.w / 2, nx: (x - r.x) / r.w, ny: (y - r.y) / r.h };
  }
  const steerTo = (at) => { steerN = [Math.max(0, Math.min(1, at.nx)), Math.max(0, Math.min(1, at.ny))]; };

  const editable = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  listen(window, 'keydown', (e) => {
    if (editable(e) || e.metaKey || e.ctrlKey) return;
    e.stopImmediatePropagation();
    if (e.code === 'Space') { e.preventDefault(); spaceHeld = true; return; }
    if (e.repeat) return;
    if (e.code === 'Escape') { e.preventDefault(); host.leave(); return; }
    if (e.code === 'KeyP') { host.pause?.(); return; }
    if (PAD_KEYS[e.code]) { e.preventDefault(); keys.add(e.code); steering = false; }
  }, { capture: true });
  listen(window, 'keyup', (e) => {
    if (editable(e)) return;
    e.stopImmediatePropagation();
    if (e.code === 'Space') { e.preventDefault(); spaceHeld = false; }
    keys.delete(e.code);
  }, { capture: true });
  listen(window, 'blur', () => { keys.clear(); mouseHeld = spaceHeld = buttonHeld = false; steering = touchSteer = false; });

  listen(root, 'pointerdown', (e) => {
    if (e.target.closest('button,a,input,select,.lil-gui,#shell-bar,#shell-nav,#story-views,#sol82-briefing,#laser-seat-keys')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const at = onLens(e);
    if (!at.inside) return;
    steerTo(at);
    steering = !keys.size;
    if (e.pointerType === 'mouse') { if (e.button === 0) mouseHeld = true; } else touchSteer = true;
    e.target.setPointerCapture?.(e.pointerId);
  }, { capture: true });
  listen(window, 'pointermove', (e) => {
    const at = onLens(e);
    /* the mouse aims while it hovers on the lens; a touch aims while the finger that started on the lens stays down */
    if (touchSteer || at.inside) { steerTo(at); steering = !keys.size; e.stopImmediatePropagation(); }
    else if (e.pointerType === 'mouse' && !mouseHeld) steering = false;
  }, { capture: true });
  const release = () => { mouseHeld = false; touchSteer = false; steering = false; };
  listen(window, 'pointerup', release, { capture: true });
  listen(window, 'pointercancel', release, { capture: true });
  listen(holdBtn, 'pointerdown', (e) => { e.preventDefault(); e.stopImmediatePropagation(); buttonHeld = true; holdBtn.classList.add('on'); });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) listen(holdBtn, type, () => { buttonHeld = false; holdBtn.classList.remove('on'); });
  listen(holdBtn, 'click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); });
  listen(keysEl.querySelector('[data-tank]'), 'click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); host.leave(); });
  listen(root, 'contextmenu', (e) => e.preventDefault());

  // THE KEYS GLIDE (the lab's padFromKeys): the held direction at LASER_GAME.glide m/s smoothed twice, into an intent and
  // then the velocity, so the aim eases in, drifts to rest and curves through a turn
  function pad(dt) {
    let dx = 0, dz = 0;
    for (const code of keys) { dx += PAD_KEYS[code][0]; dz += PAD_KEYS[code][1]; }
    const len = Math.hypot(dx, dz), dir = len ? { x: dx / len, z: dz / len } : null;
    if (held() || (steering && !keys.size)) { padIntent.x = padIntent.z = padVel.x = padVel.z = 0; return { dir, pad: null }; }
    const k = 1 - Math.exp(-dt / (Math.max(0.02, LASER_GAME.glideEase) * (len ? 1 : 1.4)));
    padIntent.x += ((dir ? dir.x * LASER_GAME.glide : 0) - padIntent.x) * k;
    padIntent.z += ((dir ? dir.z * LASER_GAME.glide : 0) - padIntent.z) * k;
    padVel.x += (padIntent.x - padVel.x) * k;
    padVel.z += (padIntent.z - padVel.z) * k;
    if (!len && Math.hypot(padVel.x, padVel.z) < 0.05) { padIntent.x = padIntent.z = padVel.x = padVel.z = 0; return { dir, pad: null }; }
    return { dir, pad: { x: padVel.x, z: padVel.z } };
  }

  // THE GROUND VIEW (the lab's frameGround): groundBack metres back along the player's forward and groundUp metres up
  // from the contact. The lens covers the left of a landscape view (the top of a portrait one), so the camera looks a
  // little off the contact and the contact lands in the middle of what the lens leaves open instead of against its rim.
  function pose(goal) {
    const a = arsenal.anchor(), k = 1 / arsenal.metres();
    p.fromArray(a);
    up.copy(p).normalize();
    arsenal.forwardAt(a, fw);
    eye.copy(p).addScaledVector(fw, -LASER_VIEW.groundBack * k).addScaledVector(up, LASER_VIEW.groundUp * k);
    const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight, r = rect(), portrait = H > W;
    const ndcX = portrait ? 0 : (r.x + r.w + W) / W - 1, ndcY = portrait ? 1 - (r.y + r.h + H) / H : 0;
    const tanV = Math.tan((LASER_GAME.groundFov * Math.PI) / 360), tanH = tanV * (W / H), D = eye.distanceTo(p);
    look.subVectors(p, eye).normalize();
    right.crossVectors(look, up).normalize();
    camUp.crossVectors(right, look);
    aimAt.copy(p).addScaledVector(right, -ndcX * tanH * D).addScaledVector(camUp, -ndcY * tanV * D);
    goal.pos.copy(eye);
    goal.quat.setFromRotationMatrix(m.lookAt(eye, aimAt, up));
    return true;
  }

  function paintPanel(f) {
    const line = f.phase === 'overhead' ? `OVERHEAD · ${String(Math.ceil(f.left)).padStart(2, '0')} S` : `AWAY · ${Math.ceil(f.left)} S`;
    if (elPass.textContent !== line) elPass.textContent = line;
    elEnergy.style.width = `${Math.round(f.energy01 * 100)}%`;
    const low = f.energy01 < LASER_GAME.lowEnergy;
    elEnergy.classList.toggle('low', low);
    const label = f.energy <= 0 ? 'DRAINED' : `ENERGY ${f.energy.toFixed(1)} S`;
    if (elLabel.textContent !== label) elLabel.textContent = label;
    const warn = f.friendly.length ? `OURS UNDER THE BEAM · ${f.friendly.map((kind) => `${f.under[kind]} ${kind.toUpperCase()}`).join(' · ')}` : '';
    elWarn.hidden = !warn;
    if (elWarn.textContent !== warn) elWarn.textContent = warn;
  }

  // ONE FRAME FOR THE SCOPE'S HUD (the lab's hudFrame), in the container's pixels
  function hudFrame(f, r, box) {
    const R = arsenal.metres(), k = 1 / R, ox = box.x, oy = box.y;
    const px = (vec) => { const q = scope.project(vec, r); return { x: q.x + ox, y: q.y + oy }; };
    const anchorV = v.fromArray(f.anchor).clone(), aiming = steering || held();
    const aim = steering ? { x: r.x + steerN[0] * r.w + ox, y: r.y + steerN[1] * r.h + oy } : px(anchorV);
    let contact = null, footprintPx = 0, lagM = 0;
    if (f.contact) {
      const cV = new THREE.Vector3().fromArray(f.contact);
      contact = px(cV);
      const across = new THREE.Vector3().crossVectors(cV.clone().normalize(), arsenal.forwardAt(f.contact)).normalize();
      const edge = px(cV.clone().addScaledVector(across, LASER_BEAM.radius * k));
      footprintPx = Math.hypot(edge.x - contact.x, edge.y - contact.y);
      const hit = steering ? scope.pick(steerN[0], steerN[1], sphere) : null;
      if (hit) lagM = hit.distanceTo(cV) * R;
    }
    const dir = anchorV.clone().normalize(), rangeM = LASER_VIEW.altitude * R, half = Math.tan((LASER_VIEW.fov * Math.PI) / 360);
    const north = new THREE.Vector3(0, 0, -1).addScaledVector(dir, dir.z).normalize();
    const pc = px(anchorV), pn = px(anchorV.clone().addScaledVector(north, 50 * k));
    const hud = f.friendly.length ? { status: `OURS UNDER THE BEAM · ${f.friendly.map((kind) => kind.toUpperCase()).join(' · ')}`, statusColour: AMBER } : null;
    return {
      rect: { x: r.x + ox, y: r.y + oy, w: r.w, h: r.h }, aim, contact, footprintPx, lagM, aiming, limitM: LASER_GAME.range, aimArcM: f.aimArc,
      contactArcM: f.contactArc, lensGroundM: half * rangeM, phase: f.phase, infinite: false, left: f.left, pass01: f.pass01,
      energy: f.energy, energy01: f.energy01, burning: f.burning, speed: f.speed, slew: LASER_BEAM.slew, radiusM: LASER_BEAM.radius,
      altitudeM: rangeM, rangeM, fovDeg: LASER_VIEW.fov, gsd: (2 * half * rangeM) / Math.max(1, r.h),
      lat: (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI, lon: (Math.atan2(dir.x, dir.z) * 180) / Math.PI,
      deliveredMJ: (LASER_BEAM.energy - f.energy) * LASER_TELEMETRY.powerMW, capMJ: LASER_BEAM.energy * LASER_TELEMETRY.powerMW,
      counts: { bodies: f.burned.bodies, walls: f.burned.walls, rocks: f.burned.rocks, towers: f.burned.towers, alive: f.alive },
      sealed: f.breaches === 0, heart: f.burned.heart ? 'LOST' : 'INTACT', under: { ...f.under, tower: f.under.tower + f.under.tank }, northAngle: Math.atan2(pn.x - pc.x, -(pn.y - pc.y)),
      ...(hud ? { hud } : {}),
    };
  }

  return {
    pose,

    // the seat's hands for this tick: whether the trigger is held, the aim (a scene point), the keys' direction while
    // the beam burns and the glide velocity while it does not
    input(dt) {
      const { dir, pad: glide } = pad(dt);
      const target = steering ? scope.pick(steerN[0], steerN[1], sphere)?.toArray() ?? null : null;
      return { held: held(), target, keys: held() ? dir : null, pad: glide };
    },

    // the scope over the frame the game just drew, then its HUD
    render(renderer, scene) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const f = arsenal.view(), r = rect(), cb = canvas.getBoundingClientRect(), hb = container.getBoundingClientRect();
      scope.frame(v.fromArray(f.anchor), origin, 1, LASER_VIEW.altitude, arsenal.forwardAt(f.anchor, fw), LASER_VIEW.fov);
      scope.render(renderer, scene, r);
      hud.draw(hudFrame(f, r, { x: cb.left - hb.left, y: cb.top - hb.top }), dt);
      paintPanel(f);
      holdBtn.classList.toggle('on', held());
    },

    dispose() {
      abort.abort();
      scope.dispose();
      hud.dispose();
      panel.remove();
      keysEl.remove();
      root.classList.remove('laser-seat');
    },
  };
}
