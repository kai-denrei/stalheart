// THE CRT PASS (owner, 2026-10-14, the terminal and the bestiary; src/fx/crt-pass.js, spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md
// section 7): the pass builds; the feed's mono settings reproduce SAT-3's ground feed shader of 2026-10-13 to the character (its text is held
// below, as it stood in src/fx/ground-feed.js before the move) and the feed's numbers (the phosphor's green, its floor, the gain); colour mode
// runs the same steps per channel and leaves the chroma (no luminance dot, a vec3 light).
import assert from 'node:assert/strict';
import { createCrtPass, crtFragment, MONO_FEED } from '../src/fx/crt-pass.js';
import { GROUND_FEED } from '../src/content/ground-feed.js';

// src/fx/ground-feed.js FRAG at 70ab8f86, verbatim
const FEED_FRAG = `
uniform sampler2D map; uniform vec2 res; uniform float time, stat, gain;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 px = floor(vUv * res);
  vec2 uv = vUv + vec2((hash(vec2(px.y, floor(time * 30.0))) - 0.5) * 0.03 * stat, 0.0);
  vec3 c = texture2D(map, uv).rgb;
  float l = pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) * gain, 0.0, 1.0), 1.0 / 2.2);
  l = clamp((l - 0.04) * 1.35, 0.0, 1.0);
  l += (hash(px + floor(time * 24.0) * vec2(91.7, 37.3)) - 0.5) * 0.09;
  l *= 0.7 + 0.3 * step(1.0, mod(px.y, 3.0));
  vec2 d = (vUv - 0.5) * vec2(1.2, 1.0); l *= 1.0 - smoothstep(0.38, 0.78, length(d));
  float sn = hash(floor(px / 2.0) + floor(time * 30.0) * vec2(17.1, 3.7));
  l = mix(l, sn * 0.85, stat);
  gl_FragColor = vec4(vec3(0.42, 1.0, 0.45) * l + vec3(0.015, 0.04, 0.02), 1.0);
}`;

// 1. the feed's pass is the feed's shader and numbers
assert.equal(crtFragment(MONO_FEED), FEED_FRAG, 'the mono pass is the feed\'s fragment to the character');
assert.deepEqual([...MONO_FEED.tint], [0.42, 1.0, 0.45], 'the phosphor\'s green');
assert.deepEqual([...MONO_FEED.floor], [0.015, 0.04, 0.02], 'the floor of light under it');
assert.equal(MONO_FEED.gain, 1.1); assert.equal(GROUND_FEED.gain, 1.1, 'the feed\'s gain in its content, the pass\'s default');
{
  const p = createCrtPass({ ...MONO_FEED, gain: GROUND_FEED.gain });
  assert.equal(p.fragment, FEED_FRAG); assert.equal(p.uniforms.gain.value, 1.1);
  p.step(0.5, 0.35); assert.equal(p.static(), 0.35); assert.equal(p.uniforms.time.value, 0.5, 'the grain\'s clock');
  p.step(0.25); assert.equal(p.static(), 0.35, 'the static holds when not given'); assert.equal(p.uniforms.time.value, 0.75);
  p.dispose();
}
// 2. colour mode keeps the chroma: no luminance, the light a vec3 through every step, the static mixed per channel, the tint as given
{
  const frag = crtFragment({ mono: false, tint: [1, 0.9, 0.8], floor: [0.01, 0.02, 0.03] });
  assert(!frag.includes('dot(c, vec3(0.2126'), 'colour mode takes no luminance');
  assert(frag.includes('vec3 l = pow(clamp(c * gain'), 'the light is the picture\'s colour');
  assert(frag.includes('mix(l, vec3(sn * 0.85), stat)'), 'the static over each channel');
  assert(frag.includes('vec4(vec3(1.0, 0.9, 0.8) * l + vec3(0.01, 0.02, 0.03), 1.0)'), 'the tint and the floor as given');
  for (const step of ['(l - 0.04) * 1.35', '* 0.09', 'mod(px.y, 3.0)', 'smoothstep(0.38, 0.78, length(d))']) assert(frag.includes(step), `the feed's step ${step} kept`);
}
console.log('crt pass: the feed\'s shader to the character, its numbers, colour mode keeps the chroma');
