// probe.js — the in-page half of the Safari probe. Injected into index.html by
// artifacts/qa/safari-probe-server.mjs when the URL carries `probe=1`; never
// loaded by the game itself. It reads the rendering surface and the seat state
// through the acceptance hook and POSTs each reading back to the server.
const post = (name, data) => fetch('/__probe', { method: 'POST', body: JSON.stringify({ name, data }) }).catch(() => {});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms) => { const t = Date.now(); for (;;) { try { if (fn()) return true; } catch { /* still booting */ } if (Date.now() - t > ms) throw new Error('timeout'); await delay(400); } };

// THE SURFACE: every number that has to agree for a projected point to land
// where it is drawn — dpr, the canvas's backing store, its CSS box, the GL
// viewport, the container the canvas is sized from, and the window metrics the
// HUD overlays are sized from.
function surface() {
  const cv = document.querySelector('#td-app canvas'), c = document.querySelector('#td-app');
  const r = cv.getBoundingClientRect(), cr = c.getBoundingClientRect(), t = document.querySelector('#tab-td').getBoundingClientRect();
  const gl = cv.getContext('webgl2') || cv.getContext('webgl');
  const vv = window.visualViewport;
  return {
    dpr: devicePixelRatio, attr: [cv.width, cv.height], css: [+r.width.toFixed(2), +r.height.toFixed(2)],
    cssOrigin: [+r.left.toFixed(2), +r.top.toFixed(2)], styleWH: [cv.style.width, cv.style.height],
    client: [cv.clientWidth, cv.clientHeight],
    drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
    glViewport: gl ? Array.from(gl.getParameter(gl.VIEWPORT)) : null,
    container: [c.clientWidth, c.clientHeight],
    containerRect: [+cr.left.toFixed(2), +cr.top.toFixed(2), +cr.width.toFixed(2), +cr.height.toFixed(2)],
    tab: [+t.left.toFixed(2), +t.top.toFixed(2), +t.width.toFixed(2), +t.height.toFixed(2)],
    inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
    docEl: [document.documentElement.clientWidth, document.documentElement.clientHeight],
    visual: vv ? [+vv.width.toFixed(2), +vv.height.toFixed(2), +vv.offsetLeft.toFixed(2), +vv.offsetTop.toFixed(2), +vv.scale.toFixed(3)] : null,
    effectiveRatio: +(cv.width / r.width).toFixed(4),
  };
}

function tankCss() {
  const s = window.__stalheartTest.seatState(), r = document.querySelector('#td-app canvas').getBoundingClientRect();
  return {
    ndcX: s.tank[0], ndcY: s.tank[1],
    cssX: +(r.left + (s.tank[0] + 1) / 2 * r.width).toFixed(2), cssY: +(r.top + (1 - s.tank[1]) / 2 * r.height).toFixed(2),
    canvasCentre: [+(r.left + r.width / 2).toFixed(2), +(r.top + r.height / 2).toFixed(2)],
  };
}

// the reticle is an SVG overlay; the aim is projected through the same camera
// that draws the frame. If those disagree in CSS px, the HUD lies about where
// the rounds go.
function reticle() {
  const s = window.__stalheartTest.seatState(), cv = document.querySelector('#td-app canvas'), r = cv.getBoundingClientRect();
  const hud = document.querySelector('#gunship-hud'), svg = hud && hud.querySelector('svg'), ret = hud && hud.querySelector('.reticle');
  const hr = hud ? hud.getBoundingClientRect() : null, rr = ret ? ret.getBoundingClientRect() : null;
  const aim = s.aim ? { ndc: s.aim, cssX: +(r.left + (s.aim[0] + 1) / 2 * r.width).toFixed(2), cssY: +(r.top + (1 - s.aim[1]) / 2 * r.height).toFixed(2) } : null;
  return {
    hudRect: hr ? [+hr.left.toFixed(2), +hr.top.toFixed(2), +hr.width.toFixed(2), +hr.height.toFixed(2)] : null,
    svgViewBox: svg ? svg.getAttribute('viewBox') : null, svgAttr: svg ? [svg.getAttribute('width'), svg.getAttribute('height')] : null,
    reticleCentre: rr ? [+(rr.left + rr.width / 2).toFixed(2), +(rr.top + rr.height / 2).toFixed(2)] : null,
    aim, canvasCentre: [+(r.left + r.width / 2).toFixed(2), +(r.top + r.height / 2).toFixed(2)],
    dx: rr && aim ? +(rr.left + rr.width / 2 - aim.cssX).toFixed(2) : null,
    dy: rr && aim ? +(rr.top + rr.height / 2 - aim.cssY).toFixed(2) : null,
  };
}

(async () => {
  try {
    await post('ua', { ua: navigator.userAgent, dpr: devicePixelRatio });
    await until(() => window.__stalheartTest && (window.__stalheartTest.state().storyLod || []).some((l) => l.id === 'stalheart'), 180000);
    await delay(3000);
    await post('third-surface', surface());
    await post('third-seat', window.__stalheartTest.seatState());
    await post('third-tank-css', tankCss());
    window.__stalheartTest.mountGunship();
    await delay(1200);
    document.querySelector('#gunship-briefing [data-skip]')?.click();
    await until(() => window.__stalheartTest.state().gunship.seat, 30000);
    await delay(1500);
    await post('gunship-surface', surface());
    await post('gunship-seat', window.__stalheartTest.seatState());
    await post('gunship-reticle', reticle());
  } catch (e) {
    await post('error', { message: String(e && e.message || e) });
  }
  await post('done', {});
})();
