// THE EXHAUST SIGNATURE (spec 13): the camera ramp is the 2D game's openingCameraY, pure, apart from the WebGL path
import assert from 'node:assert/strict';
import { signatureCameraY } from '../src/fx/exhaust-signature.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
const S = LANDING_GAME.signature, y = (t) => signatureCameraY(t, S);
assert.equal(y(0), 2); assert.equal(y(S.hold), 2, 'held at 2 through the hold (the boosters close up)');
const run = S.seconds - S.hold - 0.4;   // the 2D game's ramp length: the last 0.4 s sit at the end value
assert.ok(Math.abs(y(S.hold + run * 0.55) - -8) < 1e-9, 'at 55 % of the ramp the camera is at -8');
assert.ok(Math.abs(y(S.hold + run * 0.7) - -8) < 1e-9, 'held at -8 to 70 %');
assert.equal(y(S.hold + run), S.yEnd, 'the end value at the ramp\'s end'); assert.equal(y(S.seconds), S.yEnd); assert.equal(y(99), S.yEnd);
assert.ok(Math.abs(y(S.hold + run * 0.275) - (2 - 10 * 0.5 * 0.5 * (3 - 2 * 0.5))) < 1e-9, 'a smoothstep from 2 to -8 over the first 55 %');
for (let t = S.hold; t < S.hold + run; t += 0.05) assert.ok(y(t + 0.05) <= y(t) + 1e-9, `never climbs (${t})`);
assert.ok(y(S.hold + run * 0.85) < -8 && y(S.hold + run * 0.85) > S.yEnd, 'geometric descent after 70 %');
assert.ok(Math.abs(y(S.hold + run * 0.85) - -8 * Math.sqrt(Math.abs(S.yEnd) / 8)) < 1e-6, 'the geometric midpoint');
console.log('exhaust-signature: ok');
