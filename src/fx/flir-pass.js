// THE FLIR IRONBOW IN WEBGL (owner, 2026-10-04: "the gunship's main view should be thermal, it switched to normal with one of the
// updates"). The seat's thermal was a CSS filter: url(#flir) over the game's canvas (index.html's SVG ironbow). Chrome draws it; Safari
// does not apply an SVG url() filter to a WebGL canvas, so in Safari the seat showed the ordinary view. This is the same filter as a
// pass after postfx's OutputPass, in display space as the SVG ran (color-interpolation-filters sRGB): Rec. 709 luminance, then each
// channel through the SVG's 11-step table, linearly between steps. When the board runs without its composer (bloom off on a tier),
// the composer is turned on while thermal is and handed back after.
import { WebGLRenderTarget, Vector4 } from '../../vendor/three.module.js';
import { ShaderPass } from '../../vendor/ShaderPass.js';

// index.html #flir feComponentTransfer tables, 0 -> 1 in ten equal steps
export const IRONBOW = Object.freeze({
  r: Object.freeze([0.020, 0.114, 0.290, 0.541, 0.761, 0.910, 0.973, 0.988, 0.992, 1.000, 1.000]),
  g: Object.freeze([0.008, 0.039, 0.043, 0.059, 0.114, 0.251, 0.439, 0.639, 0.827, 0.953, 1.000]),
  b: Object.freeze([0.102, 0.369, 0.541, 0.604, 0.494, 0.290, 0.118, 0.063, 0.227, 0.604, 1.000]),
});

// the SVG's table transfer for one value, as the shader computes it (the reference the test holds the GLSL's tables to)
export function ironbow(l) {
  const x = Math.max(0, Math.min(1, l)) * 10, i = Math.min(9, Math.floor(x)), f = x - i;
  return ['r', 'g', 'b'].map((c) => IRONBOW[c][i] + (IRONBOW[c][i + 1] - IRONBOW[c][i]) * f);
}

const arr = (a) => `float[11](${a.map((v) => v.toFixed(3)).join(', ')})`;
export const FlirShader = {
  name: 'FlirShader',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    const float R[11] = ${arr(IRONBOW.r)}; const float G[11] = ${arr(IRONBOW.g)}; const float B[11] = ${arr(IRONBOW.b)};
    float at(float t[11], float x) { int i = clamp(int(floor(x)), 0, 9); float f = clamp(x - float(i), 0.0, 1.0); return mix(t[i], t[i + 1], f); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      if (isnan(l) || isinf(l)) l = 0.0;   // a pixel with no number shows black on screen; it must read cold here too, not a random step of the ramp
      float x = clamp(l, 0.0, 1.0) * 10.0;
      gl_FragColor = vec4(at(R, x), at(G, x), at(B, x), c.a);
    }`,
};

// whether a FLIR pass is drawing right now, for the acceptance run (scripts/browser-test.mjs --gunship)
export const flirLive = { on: false };

// postfx: src/postfx.js makeBloom's handle; returns set(on) and the live state
export function createFlir(postfx) {
  if (!postfx?.addFinalPass) return { set() {}, get on() { return false; } };
  const pass = new ShaderPass(FlirShader);
  pass.enabled = false;
  postfx.addFinalPass(pass);
  // LINKED NOW, NOT IN THE SEAT: its program would otherwise compile on the frame the gunship is first taken (the seat's hitch guard,
  // scripts/browser-test.mjs --gunship). One pixel drawn to the screen as the seat draws it, before the board's first frame paints over it
  const r = postfx.renderer;
  if (r?.getViewport) {
    const src = new WebGLRenderTarget(1, 1), view = r.getViewport(new Vector4()), screen = pass.renderToScreen;
    try { pass.renderToScreen = true; r.setViewport(0, 0, 1, 1); pass.render(r, null, src); } catch { /* a context that cannot draw yet links it in the seat */ }
    finally { pass.renderToScreen = screen; r.setViewport(view); src.dispose(); }
  }
  let lent = false;
  return {
    set(on) {
      pass.enabled = !!on; flirLive.on = pass.enabled;
      if (on && !postfx.enabled) { postfx.setEnabled(true); lent = true; }
      else if (!on && lent) { postfx.setEnabled(false); lent = false; }
    },
    get on() { return pass.enabled; },
  };
}
