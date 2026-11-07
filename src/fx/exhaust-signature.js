// THE EXHAUST SIGNATURE (spec 10): the 2D game's full-screen opening on its own opaque canvas over the page, the launch shader
// with the camera's Y animated and the 2D game's plate (SKIP CINEMATIC, or Esc). The FRAGMENT and VERTEX sources below are the 2D
// game's landing/launch-plume.js verbatim (https://github.com/jelaludo/Stalsfar_Landing), as is its draw contract (the uniform set,
// the 1600 x 1000 cap, a draw at most every 1/30 s). See ATTRIBUTIONS.md.
// Launch shader by Pulkit (MIT), adapted from the Onkochishin Launch lab.
// Source: https://github.com/pulkitxm/claude-directory/tree/main/shaders/launch-shader
// License: ./licenses/launch-shader-MIT.txt
// (2026-11-07: the line above is the 2D game's own header, kept verbatim; this repository carries no licenses/ folder, the MIT notice
// and the credit are in ATTRIBUTIONS.md)
// The field/ray march is retained; loop accumulators are explicitly initialized.
const FRAGMENT = `#version 300 es
precision highp float;

out vec4 fragColor;
in vec2 v_uv;

uniform vec3  iResolution;   
uniform float iTime;         
uniform int   iFrame;        
uniform vec4  iMouse;        
uniform float uSteps;
uniform vec2 uTint;
uniform vec3 uCam;
uniform float uSquash;
uniform float uOctaves;
uniform float uTurb;
uniform float uCore;
uniform float uDetail;
uniform float uStepSize;
uniform float uExposure;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2  r  = iResolution.xy;
    float t  = iTime;
    vec3  FC = vec3(fragCoord, t);
    vec4  o  = vec4(0.0);

    
    for (float i = 0., z = 0., d = 0., f = 0.; i++ < uSteps; o += vec4(uTint.x, uTint.y, d, z / f) / z) {
        vec3 v = uCam;
        vec3 p = z * normalize(FC.rgb * 2. - r.xyx) + v;
        vec3 a = p;
        a.y *= uSquash;
        for (d = 1.; d++ < uOctaves; )
            a -= uTurb * sin((a.zxy + t * v + d) * d) * p.y / d;

        z += d = min(
                max(-p.y, length(a) - uCore),
                f = .2 + abs(length(a.xz - cos(a.zx * uDetail)) + max(p.y / .1, - .6))
            ) / uStepSize;
    }
    o = tanh(o * o.a / uExposure);  

    fragColor = vec4(o.rgb, 1.0);
}

void main(){
  mainImage(fragColor, gl_FragCoord.xy);
}`;
const VERTEX = `#version 300 es
layout(location=0) in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.,1.);}`;

// the 2D game's uniform set, held as it holds them
const FIXED = { uSteps: 100, uSquash: 0.3, uOctaves: 9, uTurb: 0.1, uCore: 2, uDetail: 6, uStepSize: 8, uExposure: 1000 };
const MAX_W = 1600, MAX_H = 1000;

// the 2D game's openingCameraY (Stalsfar_Landing/landing/lander.js), its constants from the tune: 2 through `hold`, a smoothstep to -8
// over the first 55 % of the ramp (seconds - hold - 0.4), held to 70 %, then geometrically to yEnd (black). Pure, so a node test pins it
export function signatureCameraY(t, { seconds, hold, yEnd }) {
  const p = Math.max(0, Math.min(1, (t - hold) / (seconds - hold - 0.4)));
  if (p >= 1) return yEnd;
  if (p <= 0.55) { const q = p / 0.55; return 2 - 10 * q * q * (3 - 2 * q); }
  if (p <= 0.7) return -8;
  return -8 * Math.pow(Math.abs(yEnd) / 8, (p - 0.7) / 0.3);
}

// compile and link; returns the draw closure and a free(), or null if the shader will not build
function build(gl) {
  const shaders = [];
  let program = null, buffer = null, lastTime = -1;
  const free = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    for (const s of shaders) gl.deleteShader(s);
  };
  try {
    const compile = (type, source) => {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const loc = (name) => gl.getUniformLocation(program, name);
    for (const [name, value] of Object.entries(FIXED)) gl.uniform1f(loc(name), value);
    gl.uniform2f(loc('uTint'), 3, 1);
    const uRes = loc('iResolution'), uTime = loc('iTime'), uCam = loc('uCam');
    return {
      draw(time, y, width, height) {
        if (lastTime >= 0 && Math.abs(time - lastTime) < 1 / 30) return;   // the 2D game's 30 Hz cap: the march is heavy
        lastTime = time;
        const ratio = Math.min(1, MAX_W / width, MAX_H / height);
        const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
        if (gl.canvas.width !== w || gl.canvas.height !== h) { gl.canvas.width = w; gl.canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.uniform3f(uRes, w, h, 1); gl.uniform1f(uTime, time); gl.uniform3f(uCam, 0, y, 7);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      free,
    };
  } catch (error) { console.warn('Exhaust signature shader unavailable', error); free(); return null; }
}

// null when it will not play (reduced motion, no WebGL2, the shader fails to build): nothing is appended and the caller goes on without it
export function startExhaustSignature(root, { seconds, hold, yEnd, reducedMotion = false, onSkip = null } = {}) {
  if (reducedMotion) return null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });   // opaque: the frame under it must not show
  if (!gl) return null;
  const pipe = build(gl);
  if (!pipe) { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ } return null; }
  const el = document.createElement('div');
  el.id = 'exhaust-signature'; el.setAttribute('aria-hidden', 'false');
  el.innerHTML = '<div class="es-plate"><span class="es-eyebrow">SH02 / EXHAUST SIGNATURE</span>'
    + '<span class="es-subtitle">STÅLHEART · ARRIVAL CORRIDOR</span>'
    + '<a class="es-credit" href="https://github.com/pulkitxm/claude-directory/tree/main/shaders/launch-shader" target="_blank" rel="noreferrer">LAUNCH SHADER · PULKIT · MIT</a>'
    + '<button type="button" class="es-skip" data-skip-cinematic>SKIP CINEMATIC →</button></div>';
  el.prepend(canvas);
  const tune = { seconds, hold, yEnd };
  let t = 0, done = false;
  const handle = {
    tick(dt) {
      if (done) return;
      t += dt;
      pipe.draw(t, signatureCameraY(t, tune), canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
      if (t >= seconds) handle.dispose();
    },
    get done() { return done; },
    skip() {
      if (done) return;
      onSkip?.();
      handle.dispose();
    },
    dispose() {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      try { pipe.free(); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* the context may already be gone */ }
      el.remove();
    },
  };
  // capture on window: Esc skips, and no other key reaches the page under the black (the rail's any-key skip must not fire)
  function onKey(ev) {
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (ev.key === 'Escape') handle.skip();
  }
  window.addEventListener('keydown', onKey, true);
  el.querySelector('.es-skip').addEventListener('click', () => handle.skip());
  root.append(el);
  return handle;
}
