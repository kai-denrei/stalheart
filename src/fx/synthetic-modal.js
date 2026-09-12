// ISAO's study screen: the SYNTHETIC LEARNING x58 terminal (the owner's own
// seven CRT neural-net visualisations, vendored as pure render functions)
// as a modal over the game, with his lines above the panels. Rendering runs
// only while the modal is open; CONTINUE or Escape closes it.
import { applyScanlines, staticNoise } from '../../vendor/synthetic-learningx58/crt.js';
import nbbXor from '../../vendor/synthetic-learningx58/nbb-xor.js';
import movingLight from '../../vendor/synthetic-learningx58/moving-light.js';
import fastWeights from '../../vendor/synthetic-learningx58/fast-weights.js';
import twoSeq from '../../vendor/synthetic-learningx58/two-sequence.js';
import emSeg from '../../vendor/synthetic-learningx58/em-segmentation.js';
import clockwork from '../../vendor/synthetic-learningx58/clockwork-rnn.js';
import linTfm from '../../vendor/synthetic-learningx58/linear-transformers.js';
const PANELS = [nbbXor, movingLight, fastWeights, twoSeq, emSeg, clockwork, linTfm];
export function createSyntheticModal(root) {
  const el = document.createElement('div'); el.id = 'synthetic-modal'; el.hidden = true;
  el.innerHTML = `<div class="sheet"><header><h1>&gt; SYNTHETIC LEARNING x58_</h1><p class="sub">CRT terminal // 7 neural-net visualizations // ISAO's study</p></header>
    <p class="isao"></p><div class="grid">${PANELS.map(() => '<canvas></canvas>').join('')}</div>
    <footer><span>RENDER LOOP // CANVAS 2D // ES MODULES // NO DEPS</span><button type="button" data-continue>CONTINUE</button></footer></div>`;
  root.append(el);
  const canvases = [...el.querySelectorAll('canvas')], isao = el.querySelector('.isao'), dprCap = Math.min(devicePixelRatio || 1, 2);
  let raf = 0, frame = 0, onClose = null, opened = 0;
  const size = (c) => { const r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * dprCap)), h = Math.max(1, Math.round(r.height * dprCap)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } };
  function tick(t) {
    if (el.hidden) return;
    if (frame % 15 === 0) canvases.forEach(size);
    canvases.forEach((c, i) => { const ctx = c.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); PANELS[i](ctx, t, c.width, c.height); applyScanlines(ctx, c.width, c.height, { alpha: 0.16 }); staticNoise(ctx, c.width, c.height, 0.012, frame); });
    frame++; raf = requestAnimationFrame(tick);
  }
  function close() { if (el.hidden) return; el.hidden = true; cancelAnimationFrame(raf); const cb = onClose; onClose = null; cb?.(); }
  el.querySelector('[data-continue]').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (!el.hidden && e.key === 'Escape') { e.stopImmediatePropagation(); close(); } }, true);
  return {
    open(lines, after = null) { isao.textContent = lines.join(' '); onClose = after; el.hidden = false; opened++; frame = 0; raf = requestAnimationFrame(tick); },
    close, isOpen: () => !el.hidden, opened: () => opened,
    dispose() { cancelAnimationFrame(raf); el.remove(); },
  };
}
