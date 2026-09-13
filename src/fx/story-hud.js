// Story overlays on the game's own instruments. The radar gets a tremor
// contact: a pulsing red ring at the bearing of the source, clamped to the
// rim when it is beyond range, with the words the operator asked for.
import { radarBasis, radarProject } from '../radar.js';

export function createStoryHud() {
  let tremor = null;   // unit direction of the source, or null
  let sites = [];      // unit directions of the rocket landing sites to fetch material from
  return {
    tremor(dir) { tremor = dir ? dir.slice() : null; },
    sites(dirs) { sites = (dirs ?? []).map((d) => d.slice()); },
    state: () => ({ tremor: !!tremor, sites: sites.length }),
    // ctx is the radar's 2d context after the game has painted it; frame gives the radar's basis
    paint(ctx, { m, cpos, up, range, t, mapMode }) {
      if ((!tremor && !sites.length) || !cpos || !up || mapMode === 'heart') return;
      const basis = radarBasis(cpos, up);
      // THE LANDING SITES: an amber triangle at each bearing, held at the rim while out of range (owner, 2026-09-13)
      const c0 = m / 2, R0 = m / 2 - 3;
      for (const d of sites) {
        const q = radarProject(d, cpos, basis, range); let sx = q.x * R0, sy = q.y * R0; const l = Math.hypot(sx, sy) || 1;
        if (l > R0 * 0.9) { sx = sx / l * R0 * 0.9; sy = sy / l * R0 * 0.9; }
        ctx.save(); ctx.translate(c0 + sx, c0 + sy); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5.5, 4.5); ctx.lineTo(-5.5, 4.5); ctx.closePath();
        ctx.fillStyle = 'rgba(255, 190, 90, 0.85)'; ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (!tremor) return;
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
