// The override's glare: the 2D game's full-screen launch shader on its own canvas
// over the page. The FRAGMENT and VERTEX sources below are the 2D game's
// landing/launch-plume.js verbatim (https://github.com/jelaludo/Stalsfar_Landing);
// the surface under them is this game's: an exposure ramp (the shader divides by it), a capped resolution and
// a plain CSS fade on reduced motion or when there is no WebGL2. See ATTRIBUTIONS.md.
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

// the 2D game's uniform set, with uExposure driven per frame (the 2D game holds it at 1000; see LANDING_GAME.override.glare)
const FIXED = { uSteps: 100, uSquash: 0.3, uOctaves: 9, uTurb: 0.1, uCore: 2, uDetail: 6, uStepSize: 8 };
const MAX_W = 1600, MAX_H = 1000;

// the exposure at progress u (0..1): from `dim` down to `peak` over the first 40 % (log space: the shader divides by it, so the eye
// reads ratios), held to 70 %, then back up to `dim` by the end. Smaller is brighter. Pure, so a node test can pin it.
export function glareExposure(u, { dim = 1000, peak = 8 } = {}) {
  const [a, b] = [Math.log(dim), Math.log(peak)];
  const k = u < 0.4 ? u / 0.4 : u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
  return Math.exp(a + (b - a) * Math.max(0, Math.min(1, k)));
}

// compile and link; returns the draw closure and a free(), or null if the shader will not build
function build(gl) {
  const shaders = [];
  let program = null, buffer = null;
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
    gl.uniform3f(loc('uCam'), 0, 2, 7);
    const uRes = loc('iResolution'), uTime = loc('iTime'), uExp = loc('uExposure');
    return {
      draw(time, expo, width, height) {
        const ratio = Math.min(1, MAX_W / width, MAX_H / height);
        const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
        if (gl.canvas.width !== w || gl.canvas.height !== h) { gl.canvas.width = w; gl.canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.uniform3f(uRes, w, h, 1); gl.uniform1f(uTime, time); gl.uniform1f(uExp, expo);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      free,
    };
  } catch (error) { console.warn('Landing glare shader unavailable', error); free(); return null; }
}

export function startLandingGlare(root, { seconds = 2.4, dim = 1000, peak = 8, reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'landing-glare'; canvas.setAttribute('aria-hidden', 'true'); root.append(canvas);
  const gl = reducedMotion ? null : canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  const pipe = gl ? build(gl) : null;
  let t = 0, done = false;
  if (!pipe) canvas.classList.add('fade');
  return {
    tick(dt) {
      if (done) return;
      t += dt;
      const u = Math.min(1, t / seconds);
      if (pipe) {
        pipe.draw(t, glareExposure(u, { dim, peak }), canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
        canvas.style.opacity = String(u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3);   // the end is a clear whatever the shader does
      } else canvas.style.opacity = String(u < 0.5 ? u * 2 : 2 - u * 2);
      if (u >= 1) this.dispose();
    },
    get done() { return done; },
    dispose() {
      done = true;
      try { pipe?.free(); gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* the context may already be gone */ }
      canvas.remove();
    },
  };
}
