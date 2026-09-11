// Story overlays on the game's own instruments. The radar gets a tremor
// contact: a pulsing red ring at the bearing of the source, clamped to the
// rim when it is beyond range, with the words the operator asked for.
import { radarBasis, radarProject } from '../radar.js';

export function createStoryHud() {
  let tremor = null;   // unit direction of the source, or null
  return {
    tremor(dir) { tremor = dir ? dir.slice() : null; },
    state: () => ({ tremor: !!tremor }),
    // ctx is the radar's 2d context after the game has painted it; frame gives the radar's basis
    paint(ctx, { m, cpos, up, range, t, mapMode }) {
      if (!tremor || !cpos || !up || mapMode === 'heart') return;
      const basis = radarBasis(cpos, up);
      const p = radarProject(tremor, cpos, basis, range);
      const cx = m / 2, cy = m / 2, R = m / 2 - 3;
      let x = p.x * R, y = p.y * R;
      const len = Math.hypot(x, y) || 1;
      if (len > R * 0.92) { x = x / len * R * 0.92; y = y / len * R * 0.92; }
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 96, 96, ${0.45 + 0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx + x, cy + y, 5 + 5 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + x, cy + y, 2, 0, Math.PI * 2); ctx.fillStyle = '#ff6060'; ctx.fill();
      ctx.font = '600 10px ui-monospace, Menlo, monospace';
      ctx.fillStyle = `rgba(255, 120, 120, ${0.7 + 0.3 * pulse})`;
      ctx.textAlign = 'center';
      ctx.fillText('TREMOR DETECTED', cx, cy - R + 12);
      ctx.restore();
    },
  };
}
