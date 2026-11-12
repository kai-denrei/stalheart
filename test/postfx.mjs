// postfx.mjs — the bloom's target size must be expressed in DEVICE pixels.
//
// Regression guard for a real bug: EffectComposer.setSize() multiplies by
// the renderer's pixelRatio and sizes every pass in device pixels, and
// postfx.js then RE-APPLIED the bloom size to restore the phone half-res
// path -- but re-applied it in CSS pixels. On a dpr-2 display that ran the
// bloom mip chain at a quarter of the frame's linear resolution (measured:
// composer target 1600x914, bloom mip0 400x229), and upsampling that blur
// over thin bright lines produced blocky square beads along every edge.

import { bloomTargetSize } from '../src/postfx.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const eq = (a, b) => a.w === b.w && a.h === b.h;

console.log('device-pixel scaling:');
check('dpr 1, full scale = css size',
  eq(bloomTargetSize(800, 600, 1, 1), { w: 800, h: 600 }));
check('dpr 2, full scale DOUBLES the target (the bug: it did not)',
  eq(bloomTargetSize(800, 600, 2, 1), { w: 1600, h: 1200 }),
  JSON.stringify(bloomTargetSize(800, 600, 2, 1)));
check('dpr 3 scales by 3',
  eq(bloomTargetSize(400, 300, 3, 1), { w: 1200, h: 900 }));

console.log('the phone half-res path still works, now relative to device px:');
check('dpr 2, scale 0.5 = css size (half of device)',
  eq(bloomTargetSize(800, 600, 2, 0.5), { w: 800, h: 600 }));
check('dpr 1, scale 0.5 = half css',
  eq(bloomTargetSize(800, 600, 1, 0.5), { w: 400, h: 300 }));

console.log('degenerate input never produces a zero-size target:');
check('zero width clamps to 1', bloomTargetSize(0, 0, 2, 1).w >= 1);
check('tiny scale clamps to 1', bloomTargetSize(2, 2, 1, 0.01).w >= 1);
check('always integral', Number.isInteger(bloomTargetSize(801, 457, 2, 0.5).w));

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\npostfx sizing invariants hold');

// THE ONE-PASS TAIL (2026-11-06): scene + bloom summed and converted for the display in one fragment. The shader is built from the
// vendored OutputShader by string replacement, so a vendor change that moves either anchor must fail here, not silently in the browser.
{
  const { addOutputFragment } = await import('../src/postfx.js');
  const f = addOutputFragment();
  console.log('the one-pass tail:');
  check('samples the bloom texture', f.includes('uniform sampler2D tBloom;'));
  check('sums scene and bloom before the transfer', f.includes('texture2D( tDiffuse, vUv ) + texture2D( tBloom, vUv )'));
  check('keeps the display transfer', f.includes('colorspace_pars_fragment') && f.includes('sRGBTransferOETF'));
  check('keeps the tone mapping switch', f.includes('ACES_FILMIC_TONE_MAPPING'));
  // THE PARITY: the composer swaps its two buffers after every pass that asks, and the final pass is the only one left in the
  // chain; a swap there alternates the scene pass between the multisampled target with the depth buffer and the depthless one,
  // so every other frame the scene draws with no depth test (the floor lattice through the rock, 2026-11-06's 'sheet').
  // THE HAND-OVER (2026-11-12, the owner: the gunship's thermal "feels different than before"): a pass after the tail (the FLIR) reads
  // the composer's read buffer, so the tail must swap to hand it the display picture; the parity is put back after the frame instead
  // (settleSceneTarget). The vendored EffectComposer's own render loop, with stub passes recording what each read and wrote.
  const { AddOutputPass, settleSceneTarget } = await import('../src/postfx.js');
  const { EffectComposer } = await import('../vendor/EffectComposer.js');
  const { Vector2 } = await import('../vendor/three.module.js');
  const renderer = { getSize: (v = new Vector2()) => v.set(8, 8), getPixelRatio: () => 1, getRenderTarget: () => null, setRenderTarget() {} };
  const composer = new EffectComposer(renderer), log = [];
  const stub = (name, needsSwap, enabled = true) => ({ name, needsSwap, enabled, setSize() {}, render(r, write, read) { log.push({ name, write, read, screen: this.renderToScreen }); } });
  const tail = stub('tail', new AddOutputPass().needsSwap), flir = stub('flir', false, false);
  for (const p of [stub('scene', false), tail, flir]) composer.addPass(p);
  for (const flirOn of [false, true, true, false, true]) {
    flir.enabled = flirOn; log.length = 0;
    composer.render(0); settleSceneTarget(composer);
    const scene = log.find((e) => e.name === 'scene'), t = log.find((e) => e.name === 'tail'), f = log.find((e) => e.name === 'flir');
    check(`the scene pass draws into renderTarget2 every frame (FLIR ${flirOn ? 'on' : 'off'})`, scene.read === composer.renderTarget2);
    if (flirOn) check('the FLIR reads the tail\'s picture, not the raw scene', f.read === t.write && f.read !== scene.read && f.screen && !t.screen);
    else check('without a final pass the tail draws to the screen', t.screen);
  }
  if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
}
