// The radar scope's painting: the PPI sweep on the minimap canvas, drawn every frame (paused too: the sweep keeps turning, a
// dead scope reads as a crash) and before the story's overlays (src/fx/story-hud.js) paint over it on the same canvas. The
// maths (basis, projection, phosphor, proximity sectors) is pure in src/radar.js; this is the canvas half, moved out of the
// game controller. `host` hands in the controller's live state: fixed objects as values, rebound ones as getters.
//
// Player mode is heading-up around the tank; heart mode (M) is pole-down over the whole planet. Contacts carry the phosphor:
// full the instant the beam passes, decaying behind it, never dark.
import * as THREE from '../../vendor/three.module.js';
import { norm3 } from '../vec3.js';
import { radarBasis, radarProject, radarBearing, sweepAngle, radarPhosphor, proximitySectors, SENSOR_LEVELS, sensorColor } from '../radar.js';

export function createRadarScope(host) {
  const { ctx, player, camera, towers, enemies, spawnPoints, strike, poleFrame } = host;
  // sensorDemo: relative positions a test injects (test/radar-scope.mjs) so the proximity arcs can be checked without a live
  // solid contact on the board; empty in play
  const sensorDemo = [];
  function draw(t) {
    const graph = host.graph();
    if (!graph || !player.pos) return;
    const m = host.size(), mapMode = host.mapMode(), pilot = host.pilot(), cellSide = host.cellSide();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = m / 2, cy = m / 2, R = m / 2 - 3;
    // basis + range: heart mode must hold the whole planet (max chord 2.0)
    let cpos, up;
    if (mapMode === 'heart') {
      const { t1 } = poleFrame();
      cpos = graph.centers[host.dungeon().heart]; up = t1;
    } else if (pilot?.state.tower) {
      cpos = graph.centers[pilot.state.tower.ci];
      up = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).toArray();
    } else {
      cpos = player.pos;
      up = player.smoothDir;
    }
    const basis = radarBasis(cpos, up);
    const range = mapMode === 'heart' ? 2.02 : host.pilotMode() ? cellSide * 12 : 1.15;
    const sweep = sweepAngle(t);

    // ground: near-black green, three range rings, crosshair, rim
    ctx.fillStyle = '#031007';
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 255, 140, 0.18)';
    ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3, 1]) {
      ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // the beam: a conic trail BUILDING toward the beam line, so the glow
    // sits behind the rotation, then the hot edge itself
    const phi = sweep - Math.PI / 2;   // canvas angles: 0 = +x, clockwise
    const grad = ctx.createConicGradient(phi, cx, cy);
    grad.addColorStop(0, 'rgba(90, 255, 140, 0)');
    grad.addColorStop(0.72, 'rgba(90, 255, 140, 0)');
    grad.addColorStop(1, 'rgba(90, 255, 140, 0.30)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(140, 255, 180, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.sin(sweep), cy - R * Math.cos(sweep));
    ctx.stroke();

    const blip = (pos, style, size, always = false) => {
      const q = radarProject(pos, cpos, basis, range);
      const bri = always ? 1 : radarPhosphor(radarBearing(q.x, q.y), sweep);
      const bx = cx + q.x * R, by = cy + q.y * R;
      ctx.globalAlpha = q.clamped ? bri * 0.5 : bri;
      ctx.fillStyle = style;
      ctx.fillRect(bx - size / 2, by - size / 2, size, size);
      ctx.globalAlpha = 1;
    };

    // towers: dim cyan fixtures — infrastructure, not contacts
    for (const tw of towers) blip(graph.centers[tw.ci], '#4bd7e0', 2.5);
    // enemies: THE contacts, phosphor green, heavies fatter
    for (const e of enemies) {
      if (!e.alive) continue;
      // optical camo: a phantom is a contact only in its decloak window
      if (e.spec.cloaked && !e.decloaked) continue;
      blip(e.pos, '#5aff8c', e.spec.rammable ? 2.5 : 4);
    }
    // THE PROXIMITY SENSOR (operator): car-style arcs inside the rim, one
    // sector each for ahead / starboard / astern / port, one to three arcs by
    // how close the nearest SOLID contact in that sector is. Visual only —
    // no sound by request. Only in the heading frame: from the heart's frame
    // "ahead" means nothing.
    if (mapMode !== 'heart') {
      // demo contacts are RELATIVE (fwd/right in cells): world-fixed ones
      // drifted in bearing and distance as the tank drove, and the
      // screenshot showed the wrong colours in the wrong sectors
      const hard = sensorDemo.map((d) => norm3([cpos[0] + basis.fwd[0] * d.fwd * cellSide + basis.right[0] * d.right * cellSide,
        cpos[1] + basis.fwd[1] * d.fwd * cellSide + basis.right[1] * d.right * cellSide,
        cpos[2] + basis.fwd[2] * d.fwd * cellSide + basis.right[2] * d.right * cellSide]));
      for (const e of enemies) {
        if (!e.alive || e.spec.rammable) continue;
        if (e.spec.cloaked && !e.decloaked) continue;
        hard.push(e.pos);
      }
      // the CELL rule: blue at 4, orange at 3, red at 2 (radar.js SENSOR_RINGS)
      const secs = proximitySectors(hard, cpos, basis, range, cellSide);
      const pulse = 0.72 + 0.28 * Math.sin(t * 9);
      for (let i = 0; i < secs.length; i++) {
        const lv = secs[i].level;
        if (!lv) continue;
        // sector i is centred at bearing i*90°; canvas angles run from +x
        // clockwise and bearing 0 is screen-up, so subtract a quarter turn
        const mid = i * Math.PI / 2 - Math.PI / 2;
        const half = Math.PI / 4 - 0.14;   // a gap between sectors
        for (let k = 0; k < lv; k++) {
          const rr = R - 3 - k * 4.5;
          ctx.strokeStyle = sensorColor(lv) || '#3fa9ff';
          ctx.globalAlpha = (lv >= 3 ? pulse : 0.85) * (k === SENSOR_LEVELS - 1 ? 1 : 0.8);
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(cx, cy, rr, mid - half, mid + half); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // gates: amber, pulsing harder as a wave charges. Known ones only —
    // discovery still matters.
    const waveCharge = host.waveCharge();
    for (const sp of spawnPoints) {
      if (!sp.alive || !sp.found) continue;
      const q = radarProject(graph.centers[sp.ci], cpos, basis, range);
      const r2 = 3 + 1.4 * Math.sin(t * 4 + sp.ci) + waveCharge * 3.5;
      ctx.globalAlpha = 0.55 + 0.45 * radarPhosphor(radarBearing(q.x, q.y), sweep);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + q.x * R, cy + q.y * R, Math.max(1.5, r2), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the heart: what all of this is FOR — red, steady
    blip(graph.centers[host.dungeon().heart], '#ff4d6a', 5, true);
    // the strike's painted cell, while one is armed
    if (strike.armed && strike.target >= 0) {
      const q = radarProject(graph.centers[strike.target], cpos, basis, range);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 1.5;
      const bx = cx + q.x * R, by = cy + q.y * R;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by); ctx.lineTo(bx + 6, by);
      ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by + 6);
      ctx.stroke();
    }
    // YOU: a heading wedge at centre (player mode) or a white dot out on the
    // board (heart mode)
    ctx.fillStyle = '#f2f8ff';
    if (mapMode === 'player') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx - 4, cy + 5);
      ctx.lineTo(cx + 4, cy + 5);
      ctx.closePath();
      ctx.fill();
    } else {
      blip(player.pos, '#f2f8ff', 4, true);
    }
  }
  return { draw, sensorDemo };
}
