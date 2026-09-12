// The story's fire-control scope for a guided mount, in the Sniper
// workshop's idiom: a ring with a centre pip, four brackets that close onto
// the ring as the lock meter fills, a SEEKING readout, the TARGET LOCKED tag,
// and a TRACK panel written field by field. Pure DOM and SVG; the host
// feeds it the lock, the target and the reach every frame.
export function createStoryScope(root) {
  const layer = document.createElement('div'); layer.id = 'story-scope'; layer.style.display = 'none';
  layer.innerHTML = `<svg class="reticle" aria-hidden="true"></svg><div class="ro"><div class="r-head split"><span>Track</span><b data-f="id">—</b></div>
    <div class="field"><span class="k">Range</span><b class="v" data-f="range">—</b></div><div class="field"><span class="k">Weapon max</span><b class="v" data-f="max">—</b></div>
    <div class="field"><span class="k">Envelope</span><b class="v" data-f="env">—</b></div><div class="field"><span class="k">Bearing</span><b class="v" data-f="bearing">—</b></div>
    <div class="field"><span class="k">Lock</span><b class="v" data-f="lock">—</b></div><div class="field"><span class="k">Mag</span><b class="v" data-f="mag">—</b></div><div class="meter"><i></i></div></div>`;
  root.append(layer);
  const svg = layer.querySelector('svg'), bar = layer.querySelector('.meter i'), f = {}; for (const b of layer.querySelectorAll('[data-f]')) f[b.dataset.f] = b;
  let last = '';
  const put = (k, v, hot = false) => { if (f[k].textContent !== v) f[k].textContent = v; f[k].classList.toggle('hot', hot); };
  // box: the half-size in pixels of the lock box, the angular cone drawn at the camera's own field of view. Whatever sits inside it is
  // the target; the timer runs while it stays there. The ring and the pip sit at its centre so the eye has something to put on the body.
  function reticle(w, h, meter, on, box) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.11, col = on ? '#ffb43d' : '#5fe6d6', P = [];
    const b = Math.max(R * 1.2, Math.min(Math.min(w, h) * 0.46, box || R * 2.2)), bl = b * 0.28;   // the square IS the cone: at the mount's zoom it stays well inside the cap, so what you see is what the seeker takes
    P.push(`<rect x="${(cx - b).toFixed(1)}" y="${(cy - b).toFixed(1)}" width="${(b * 2).toFixed(1)}" height="${(b * 2).toFixed(1)}" fill="none" stroke="${col}" stroke-width="1" opacity="${on ? 0.5 : 0.28}" stroke-dasharray="${on ? '' : '6 8'}"/>`);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = cx + sx * b, y = cy + sy * b; P.push(`<path d="M ${(x - sx * bl).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y - sy * bl).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${on ? 2.4 : 1.6}" opacity="${on ? 0.95 : 0.6}"/>`); }
    if (!on && meter > 0.001) {   // the timer: the box's top edge fills left to right as it runs
      P.push(`<line x1="${(cx - b).toFixed(1)}" y1="${(cy - b).toFixed(1)}" x2="${(cx - b + 2 * b * meter).toFixed(1)}" y2="${(cy - b).toFixed(1)}" stroke="#ffb43d" stroke-width="3" opacity="0.95"/>`);
    }
    const ln = (x1, y1, x2, y2, o, sw = 1.2) => P.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${sw}" opacity="${o}"/>`);
    P.push(`<circle cx="${cx}" cy="${cy}" r="${R.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${on ? 1.6 : 1}" opacity="${on ? 0.95 : 0.6}"/>`);
    for (const sx of [-1, 1]) { ln(cx + sx * R * 0.5, cy, cx + sx * R * 0.82, cy, 0.8); ln(cx, cy + sx * R * 0.5, cx, cy + sx * R * 0.82, 0.8); }
    const tr = R * 0.09; P.push(`<path d="M ${cx - tr} ${cy - tr * 0.7} L ${cx + tr} ${cy - tr * 0.7} L ${cx} ${cy + tr} Z" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.95"/>`);
    if (!on && meter > 0.02) P.push(`<text x="${cx}" y="${(cy - b - 8).toFixed(1)}" fill="#ffb43d" font-family="ui-monospace,Menlo,monospace" font-size="11" letter-spacing="2" text-anchor="middle" opacity="0.9">LOCKING ${(meter * 100).toFixed(0)}%</text>`);
    if (on) P.push(`<rect x="${cx - 75}" y="${(cy + b + 6).toFixed(1)}" width="150" height="15" fill="#ffb43d" opacity="0.92"/><text x="${cx}" y="${(cy + b + 17).toFixed(1)}" fill="#12202a" font-family="ui-monospace,Menlo,monospace" font-size="10" font-weight="700" letter-spacing="3" text-anchor="middle">TARGET LOCKED</text>`);
    return P.join('');
  }
  return {
    // one call a frame: `on` hides everything; meter 0..1, locked, target {id, range, bearing, inRange} or null, max reach, zoom
    update({ on, w, h, meter = 0, locked = false, target = null, max = 0, zoom = 1, box = 0 }) {
      layer.style.display = on ? '' : 'none'; if (!on) return;
      const key = `${w}x${h}:${Math.round(box)}:${locked ? 'L' : (meter * 50 | 0)}`;
      if (key !== last) { last = key; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = reticle(w, h, meter, locked, box); }
      put('id', target ? `TGT-${String(target.id).padStart(2, '0')}` : '—', !!target); put('range', target ? `${Math.round(target.range)} m` : '—'); put('max', `${Math.round(max)} m`);
      put('env', target ? 'IN BOX' : 'EMPTY', !!target); put('bearing', target ? `${target.bearing.toFixed(1)}°` : '—');
      put('lock', locked ? 'LOCKED' : meter > 0.02 ? `LOCKING ${Math.round(meter * 100)}%` : target ? 'ACQUIRING' : 'NO TARGET', locked); put('mag', `${zoom.toFixed(1)}x`);
      bar.style.width = `${Math.round((locked ? 1 : meter) * 100)}%`;
    },
    dispose() { layer.remove(); },
  };
}
