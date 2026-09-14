// The gunship's fire-control HUD: one reticle per gun so the selected weapon
// is never in doubt, and a readout in the Sniper workshop's idiom. Pure DOM
// and SVG; the seat feeds it once a frame.
//   rotary  a ring of eight ticks with a spinner that turns while the barrels do
//   bofors  four brackets and a centre dot; a red marker while a shell is painted in the air
//   heavy   the strike's diamond over a long cross; PAINT then LAUNCH
export function createGunshipHud(root) {
  const layer = document.createElement('div'); layer.id = 'gunship-hud'; layer.style.display = 'none';
  layer.innerHTML = `<svg class="reticle" aria-hidden="true"></svg><div class="ro"><div class="r-head split"><span>KORP / GS01</span><b data-f="gun">—</b></div>
    <div class="field"><span class="k">Range</span><b class="v" data-f="range">—</b></div><div class="field"><span class="k">Impact</span><b class="v" data-f="coords">—</b></div>
    <div class="field"><span class="k">Contacts</span><b class="v" data-f="contacts">—</b></div><div class="field"><span class="k">Nearest</span><b class="v" data-f="nearest">—</b></div>
    <div class="field"><span class="k">In blast</span><b class="v" data-f="blast">—</b></div><div class="field"><span class="k">Station</span><b class="v" data-f="left">—</b></div>
    <div class="field"><span class="k">Fire</span><b class="v" data-f="state">—</b></div><div class="field"><span class="k">Mag</span><b class="v" data-f="mag">—</b></div>
    <div class="field bar"><span class="k" data-f="barLabel">HEAT</span><span class="meter"><i></i></span></div></div>`;
  root.append(layer);
  const svg = layer.querySelector('svg'), f = {}, meter = layer.querySelector('.meter'), fill = layer.querySelector('.meter i'); for (const b of layer.querySelectorAll('[data-f]')) f[b.dataset.f] = b;
  let last = '', spin = 0;
  const put = (k, v, hot = false) => { if (f[k].textContent !== v) f[k].textContent = v; f[k].classList.toggle('hot', hot); };
  const COL = { rotary: '#dfe8ee', bofors: '#ffb43d', heavy: '#ff6a4d' };
  function reticle(w, h, gun, hot, painted, spinDeg, state) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.09, col = COL[gun] ?? '#5fe6d6', P = [];
    const mono = `font-family="ui-monospace,Menlo,monospace" font-size="11" letter-spacing="2" text-anchor="middle"`;
    if (gun === 'rotary') {
      P.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${col}" stroke-width="1.4" opacity="0.85"/>`);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r1 = R * 0.82, r2 = R * (i % 2 ? 0.94 : 1.1); P.push(`<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}" stroke="${col}" stroke-width="1.4" opacity="0.9"/>`); }
      P.push(`<g transform="rotate(${spinDeg} ${cx} ${cy})">${[0, 120, 240].map((d) => `<path d="M ${cx} ${cy - R * 0.55} A ${R * 0.55} ${R * 0.55} 0 0 1 ${cx + Math.sin(Math.PI / 3) * R * 0.55} ${cy - Math.cos(Math.PI / 3) * R * 0.55}" fill="none" stroke="${col}" stroke-width="${hot ? 3 : 1.6}" opacity="${hot ? 0.95 : 0.45}" transform="rotate(${d} ${cx} ${cy})"/>`).join('')}</g>`);
      P.push(`<circle cx="${cx}" cy="${cy}" r="1.8" fill="${col}"/>`);
      P.push(`<text x="${cx}" y="${cy + R * 1.5 + 12}" fill="${col}" ${mono} opacity="0.85">25MM · ROTARY · ${state}</text>`);
    } else if (gun === 'bofors') {
      const b = R * 1.35, bl = b * 0.4;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = cx + sx * b, y = cy + sy * b; P.push(`<path d="M ${x - sx * bl} ${y} L ${x} ${y} L ${x} ${y - sy * bl}" fill="none" stroke="${col}" stroke-width="2.2" opacity="0.9"/>`); }
      P.push(`<circle cx="${cx}" cy="${cy}" r="${R * 0.5}" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.7" stroke-dasharray="4 5"/><circle cx="${cx}" cy="${cy}" r="2" fill="${col}"/>`);
      if (painted) P.push(`<circle cx="${cx}" cy="${cy}" r="${R * 0.75}" fill="none" stroke="#ff2a1a" stroke-width="2" opacity="0.9"/><text x="${cx}" y="${cy - b - 8}" fill="#ff2a1a" ${mono}>SHELL IN THE AIR</text>`);
      P.push(`<text x="${cx}" y="${cy + b + 18}" fill="${col}" ${mono} opacity="0.85">40MM · BOFORS · ${state}</text>`);
    } else {
      const d = R * 1.2, L = R * 3;
      P.push(`<path d="M ${cx} ${cy - d} L ${cx + d} ${cy} L ${cx} ${cy + d} L ${cx - d} ${cy} Z" fill="none" stroke="${col}" stroke-width="${hot ? 2.6 : 1.6}" opacity="0.95"/>`);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.push(`<line x1="${cx + dx * d * 1.15}" y1="${cy + dy * d * 1.15}" x2="${cx + dx * L}" y2="${cy + dy * L}" stroke="${col}" stroke-width="1.2" opacity="0.6"/>`);
      if (painted) P.push(`<rect x="${cx - 90}" y="${cy + L + 6}" width="180" height="15" fill="#ff2a1a" opacity="0.92"/><text x="${cx}" y="${cy + L + 17}" fill="#12202a" font-family="ui-monospace,Menlo,monospace" font-size="10" font-weight="700" letter-spacing="3" text-anchor="middle">TARGET PAINTED · FIRE TO LAUNCH</text>`);
      else P.push(`<text x="${cx}" y="${cy + L + 17}" fill="${col}" ${mono} opacity="0.85">105MM · M102 · ${state}</text>`);
    }
    return P.join('');
  }
  return {
    // one call a frame; hot: the trigger is down; painted: a shell or the strike's target is out; spinning: the rotary's barrels turn
    update({ on, w, h, gun = 'rotary', hot = false, painted = false, spinning = 0, dt = 0, range = 0, coords = '—', contacts = 0, nearest = null, blast = '—', left = 0, state = '—', zoom = 1, bar = 0, barHot = false, barLabel = 'HEAT' }) {
      layer.style.display = on ? '' : 'none'; if (!on) return;
      spin = (spin + spinning * dt * 540) % 360;
      const key = `${w}x${h}:${gun}:${hot ? 'H' : ''}:${painted ? 'P' : ''}:${spinning ? Math.round(spin / 6) : 'x'}:${state}`;
      if (key !== last) { last = key; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = reticle(w, h, gun, hot, painted, spin, state); }
      put('gun', { rotary: '25MM ROTARY', bofors: '40MM BOFORS', heavy: '105MM M102' }[gun] ?? gun.toUpperCase(), true);
      put('range', range > 0 ? `${Math.round(range)} m` : '—'); put('coords', coords); put('contacts', String(contacts), contacts > 0);
      put('nearest', nearest != null ? `${Math.round(nearest)} m from base` : '—'); put('blast', blast, blast !== 'clear'); put('left', `${Math.ceil(left)} s`); put('state', state, hot || painted); put('mag', `${zoom.toFixed(1)}x`); put('barLabel', barLabel); fill.style.width = `${Math.round(Math.max(0, Math.min(1, bar)) * 100)}%`; meter.classList.toggle('hot', barHot);
    },
    dispose() { layer.remove(); },
  };
}
// made-up planet coordinates for a unit vector, in the style of a survey grid: north from the pole, east around it
export function planetCoords(p) {
  const lat = Math.asin(Math.max(-1, Math.min(1, p[1]))) * 180 / Math.PI, lon = Math.atan2(p[0], p[2]) * 180 / Math.PI;
  return `${lat >= 0 ? 'N' : 'S'} ${Math.abs(lat).toFixed(2)}° · ${lon >= 0 ? 'E' : 'W'} ${Math.abs(lon).toFixed(2)}°`;
}
