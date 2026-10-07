import assert from 'node:assert/strict';
const print = console.log.bind(console);
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const THREE = await import(R + 'vendor/three.module.js');
const V = await import(R + 'src/vec3.js');
const { createWarnRing } = await import(R + 'src/fx/warn-ring.js');
function run(make) {
  const scene = new THREE.Scene(), centers = [[1, 0, 0], [0, 1, 0], [0.6, 0.8, 0]];
  const w = make(scene, { graph: () => ({ centers, normals: centers }), cellSide: () => 0.05 });
  const log = [];
  const pts = scene.children[0];
  w.ring(0, 0xff0000, 0.55, 0.1); w.ring(1, 0x00ff00, 1.2, 0.2, [0.7, 0.7, 0.1]);
  for (let i = 0; i < 50; i++) { if (i === 10) w.ring(2, 0x3366ff, 0.4, 0.08); w.tick(1 / 30); const g = pts.geometry; log.push([g.drawRange.count, Array.from(g.attributes.position.array.slice(0, g.drawRange.count * 3)).map((v) => +v.toFixed(6)).join(','), Array.from(g.attributes.color.array.slice(0, 30)).map((v) => +v.toFixed(5)).join(',')]); }
  return log;
}
const newLog = run((scene, host) => createWarnRing(scene, host));
// THE ORIGINAL BLOCK's buffers on these rings (src/td-tab.js before the refactor run's Task 13, through new Function beside the module)
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '3169c7556f465693', 'the rings draw as the controller block drew them');
print('Warn ring: three rings started, aged and drawn into the pooled cloud over 50 frames, as the controller block did.');
