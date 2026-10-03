// The tour of the landers after the landing (2026-10-03): starts and ends over the base, passes low over every site, never snaps.
import assert from 'node:assert/strict';
import { tourFrame } from '../src/domain/story-shots.js';
const home = [0, 1, 0], sites = [[0.6, 0.8, 0], [0, 0.6, 0.8], [-0.7, 0.7, 0]].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
const len = (v) => Math.hypot(...v), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const f0 = tourFrame(0, home, sites), f1 = tourFrame(1, home, sites);
assert.ok(dot(f0.eye, home) / len(f0.eye) > 0.999 && dot(f1.eye, home) / len(f1.eye) > 0.999, 'over the base at both ends');
sites.forEach((s, k) => { const f = tourFrame((k + 1) / (sites.length + 1), home, sites); assert.ok(dot(f.eye, s) / len(f.eye) > 0.999 && len(f.eye) < 1.4, `low over site ${k}`); });
let prev = null, eyeStep = 0, upStep = 0;
for (let i = 0; i <= 400; i++) { const f = tourFrame(i / 400, home, sites); if (prev) { eyeStep = Math.max(eyeStep, Math.hypot(f.eye[0] - prev.eye[0], f.eye[1] - prev.eye[1], f.eye[2] - prev.eye[2])); upStep = Math.max(upStep, Math.acos(Math.min(1, dot(f.up, prev.up)))); } prev = f; }
assert.ok(eyeStep < 0.05, `the eye glides (${eyeStep})`); assert.ok(upStep < 0.06, `the frame never rolls in a jump (${upStep} rad)`);
console.log('sites-tour: over the base, low over every lander, back over the base, no snaps.');
