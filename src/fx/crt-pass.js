// THE CRT PASS (owner, 2026-10-14, the terminal and the bestiary: "as if was accessed from a Terminal as a screen-within-a-screen, with HUD
// elements and a border and CRT like display effects"; spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md, section 1): the
// look SAT-3's ground feed had in its own shader (src/fx/ground-feed.js, owner 2026-10-13), moved out unchanged so the terminal can share it.
// A render target's linear light, sampled by one full-screen quad into a rectangle of the canvas: the light encoded, a little contrast, the
// grain, one dark line in three, the vignette, the static mixed over all of it, then the phosphor's tint. `mono` takes the luminance first
// (the feed: green phosphor); colour keeps the picture's chroma (the terminal: a tier's colour inside a body is the point).
//
// createCrtPass({ mono, tint, floor, gain }) -> { render(renderer, source, rect), step(dt, static), static(), uniforms, fragment, dispose() }
//   render: `source` a WebGLRenderTarget, `rect` { x, y, w, h } in CSS px of the canvas, y from the bottom (null: the whole canvas); the
//           pass draws over that rectangle only (viewport and scissor) and leaves the renderer's viewport, scissor and autoClear as it found them
//   step:   the grain's clock and the static (0 a clean picture, 1 all snow)
// The fragment is built from the settings; the feed's (MONO_FEED) is the feed's shader to the character (test/crt-pass.mjs holds the text).
import * as THREE from '../../vendor/three.module.js';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// the feed's settings: the phosphor's green, the floor of light under it, the gain before the curve (src/content/ground-feed.js GROUND_FEED.gain)
export const MONO_FEED = Object.freeze({ mono: true, tint: Object.freeze([0.42, 1.0, 0.45]), floor: Object.freeze([0.015, 0.04, 0.02]), gain: 1.1 });

// a GLSL float: always with its point (1 -> 1.0), otherwise as written
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const vec3 = (a) => `vec3(${a.map(f).join(', ')})`;

// the fragment for these settings. Mono is the feed's shader exactly; colour runs the same steps per channel
export function crtFragment({ mono = true, tint = MONO_FEED.tint, floor = MONO_FEED.floor } = {}) {
  const head = `
uniform sampler2D map; uniform vec2 res; uniform float time, stat, gain;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 px = floor(vUv * res);
  vec2 uv = vUv + vec2((hash(vec2(px.y, floor(time * 30.0))) - 0.5) * 0.03 * stat, 0.0);
  vec3 c = texture2D(map, uv).rgb;`;
  if (mono) return `${head}
  float l = pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) * gain, 0.0, 1.0), 1.0 / 2.2);
  l = clamp((l - 0.04) * 1.35, 0.0, 1.0);
  l += (hash(px + floor(time * 24.0) * vec2(91.7, 37.3)) - 0.5) * 0.09;
  l *= 0.7 + 0.3 * step(1.0, mod(px.y, 3.0));
  vec2 d = (vUv - 0.5) * vec2(1.2, 1.0); l *= 1.0 - smoothstep(0.38, 0.78, length(d));
  float sn = hash(floor(px / 2.0) + floor(time * 30.0) * vec2(17.1, 3.7));
  l = mix(l, sn * 0.85, stat);
  gl_FragColor = vec4(${vec3(tint)} * l + ${vec3(floor)}, 1.0);
}`;
  return `${head}
  vec3 l = pow(clamp(c * gain, 0.0, 1.0), vec3(1.0 / 2.2));
  l = clamp((l - 0.04) * 1.35, 0.0, 1.0);
  l += (hash(px + floor(time * 24.0) * vec2(91.7, 37.3)) - 0.5) * 0.09;
  l *= 0.7 + 0.3 * step(1.0, mod(px.y, 3.0));
  vec2 d = (vUv - 0.5) * vec2(1.2, 1.0); l *= 1.0 - smoothstep(0.38, 0.78, length(d));
  float sn = hash(floor(px / 2.0) + floor(time * 30.0) * vec2(17.1, 3.7));
  l = mix(l, vec3(sn * 0.85), stat);
  gl_FragColor = vec4(${vec3(tint)} * l + ${vec3(floor)}, 1.0);
}`;
}

export function createCrtPass({ mono = MONO_FEED.mono, tint = MONO_FEED.tint, floor = MONO_FEED.floor, gain = MONO_FEED.gain } = {}) {
  const fragment = crtFragment({ mono, tint, floor });
  const uniforms = { map: { value: null }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, stat: { value: 0 }, gain: { value: gain } };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: fragment, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false; const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2();
  return {
    uniforms, fragment,
    step(dt, stat = uniforms.stat.value) { uniforms.time.value += dt; uniforms.stat.value = stat; },
    static: () => uniforms.stat.value,
    render(renderer, source, rect = null) {
      uniforms.map.value = source.texture; uniforms.res.value.set(source.width, source.height);
      renderer.setRenderTarget(null);
      if (!rect) { renderer.render(scene, cam); return; }
      // CSS px for the viewport and the scissor (three multiplies them by its pixel ratio)
      renderer.autoClear = false; renderer.setScissorTest(true); renderer.setViewport(rect.x, rect.y, rect.w, rect.h); renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
      renderer.render(scene, cam);
      renderer.setScissorTest(false); renderer.getSize(size); renderer.setViewport(0, 0, size.x, size.y); renderer.autoClear = true;
    },
    dispose() { quad.geometry.dispose(); quad.material.dispose(); },
  };
}
