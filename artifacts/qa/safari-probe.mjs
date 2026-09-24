// safari-probe.mjs — drive real Safari through safaridriver and read the
// rendering surface's numbers. A Safari-only bug cannot be reproduced in the
// headless Chrome suite, so this is the measuring instrument for one.
//
//   node scripts/serve.mjs --port 18170 &
//   /System/Cryptexes/App/usr/bin/safaridriver -p 18171 &
//   node artifacts/qa/safari-probe.mjs [--port 18170] [--driver 18171]
//
// Prints one `PROBE <name> <json>` line per probe point. `safaridriver
// --enable` must have been run once (it asks for the operator's password).
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg('--port', '18170'), DRV = arg('--driver', '18171');
const BASE = `http://localhost:${DRV}`;
const call = async (m, p, body) => {
  const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${p}: ${j.value.error}: ${j.value.message}`);
  return j.value;
};
const s = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
const sid = s.sessionId;
const done = async () => { try { await call('DELETE', `/session/${sid}`); } catch { /* the window may already be gone */ } };
const evaluate = async (src) => call('POST', `/session/${sid}/execute/sync`, { script: src, args: [] });
const go = async (u) => call('POST', `/session/${sid}/url`, { url: `http://localhost:${PORT}/${u}` });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (expr, ms = 60000) => {
  const t = Date.now();
  for (;;) {
    try { if (await evaluate(`return !!(${expr})`)) return true; } catch { /* the page may still be loading */ }
    if (Date.now() - t > ms) throw new Error(`timeout: ${expr}`);
    await delay(400);
  }
};

// THE SURFACE: every number that has to agree for a projected point to land
// where it is drawn — dpr, the canvas's backing store, its CSS box, the GL
// viewport, the container the canvas is sized from, and the window metrics
// the HUD overlays are sized from.
const SURFACE = `
  const cv = document.querySelector('#td-app canvas'), c = document.querySelector('#td-app');
  const r = cv.getBoundingClientRect(), cr = c.getBoundingClientRect(), t = document.querySelector('#tab-td').getBoundingClientRect();
  const gl = cv.getContext('webgl2') || cv.getContext('webgl');
  const vv = window.visualViewport;
  return { dpr: devicePixelRatio, attr: [cv.width, cv.height], css: [+r.width.toFixed(2), +r.height.toFixed(2)],
    cssOrigin: [+r.left.toFixed(2), +r.top.toFixed(2)], styleWH: [cv.style.width, cv.style.height],
    client: [cv.clientWidth, cv.clientHeight],
    drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
    glViewport: gl ? Array.from(gl.getParameter(gl.VIEWPORT)) : null,
    container: [c.clientWidth, c.clientHeight], containerRect: [+cr.left.toFixed(2), +cr.top.toFixed(2), +cr.width.toFixed(2), +cr.height.toFixed(2)],
    tab: [+t.left.toFixed(2), +t.top.toFixed(2), +t.width.toFixed(2), +t.height.toFixed(2)],
    inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
    docEl: [document.documentElement.clientWidth, document.documentElement.clientHeight],
    visual: vv ? [+vv.width.toFixed(2), +vv.height.toFixed(2), +vv.offsetLeft.toFixed(2), +vv.offsetTop.toFixed(2), +vv.scale.toFixed(3)] : null,
    effectiveRatio: +(cv.width / r.width).toFixed(4) };
`;

const P = (name, o) => console.log(`PROBE ${name} ${JSON.stringify(o)}`);
try {
  await go('index.html');
  console.log(`UA ${await evaluate('return navigator.userAgent')}`);
  const url = 'index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&phase=expedition&laser=online&gunship=station#td';
  await go(url);
  await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")', 180000);
  await delay(3000);
  P('third-surface', await evaluate(SURFACE));
  P('third-seat', await evaluate('return window.__stalheartTest.seatState()'));
  // the tank's own place on the glass, in CSS px, next to the canvas's centre
  P('third-tank-css', await evaluate(`
    const s = window.__stalheartTest.seatState(), r = document.querySelector('#td-app canvas').getBoundingClientRect();
    return { ndcX: s.tank[0], ndcY: s.tank[1],
      cssX: +(r.left + (s.tank[0] + 1) / 2 * r.width).toFixed(2), cssY: +(r.top + (1 - s.tank[1]) / 2 * r.height).toFixed(2),
      canvasCentre: [+(r.left + r.width / 2).toFixed(2), +(r.top + r.height / 2).toFixed(2)] };`));
  // THE GUNSHIP: the reticle is an SVG overlay; the aim is projected through
  // the same camera that draws the frame. If those disagree, the HUD lies.
  await evaluate('window.__stalheartTest.mountGunship(); return 1');
  await delay(1200);
  await evaluate(`document.querySelector('#gunship-briefing [data-skip]')?.click(); return 1`);
  await until('window.__stalheartTest.state().gunship.seat', 30000);
  await delay(1500);
  P('gunship-surface', await evaluate(SURFACE));
  P('gunship-seat', await evaluate('return window.__stalheartTest.seatState()'));
  P('gunship-reticle', await evaluate(`
    const s = window.__stalheartTest.seatState(), cv = document.querySelector('#td-app canvas'), r = cv.getBoundingClientRect();
    const hud = document.querySelector('#gunship-hud'), svg = hud && hud.querySelector('svg'), ret = hud && hud.querySelector('.reticle');
    const hr = hud ? hud.getBoundingClientRect() : null, rr = ret ? ret.getBoundingClientRect() : null;
    const aim = s.aim ? { ndc: s.aim, cssX: +(r.left + (s.aim[0] + 1) / 2 * r.width).toFixed(2), cssY: +(r.top + (1 - s.aim[1]) / 2 * r.height).toFixed(2) } : null;
    return { hudRect: hr ? [+hr.left.toFixed(2), +hr.top.toFixed(2), +hr.width.toFixed(2), +hr.height.toFixed(2)] : null,
      svgViewBox: svg ? svg.getAttribute('viewBox') : null, svgAttr: svg ? [svg.getAttribute('width'), svg.getAttribute('height')] : null,
      reticleCentre: rr ? [+(rr.left + rr.width / 2).toFixed(2), +(rr.top + rr.height / 2).toFixed(2)] : null,
      aim, canvasCentre: [+(r.left + r.width / 2).toFixed(2), +(r.top + r.height / 2).toFixed(2)],
      dx: rr && aim ? +(rr.left + rr.width / 2 - aim.cssX).toFixed(2) : null,
      dy: rr && aim ? +(rr.top + rr.height / 2 - aim.cssY).toFixed(2) : null };`));
} finally { await done(); }
