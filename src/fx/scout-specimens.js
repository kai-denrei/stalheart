// Survey specimens are scenery: the live Cutis has no enemy record, damage,
// bounty, hunt target or wave membership. It uses the game's own living skin.
import * as THREE from '../../vendor/three.module.js';
import { createAmethyst } from './crystals.js';
import { CutisSwarm } from './cutis-maku/swarm.js';
import { createSwarmGeometry } from './cutis-maku/geometry.js';
import { DEFAULT_CONFIG } from './cutis-maku/config.js';
import { PEARL_TIERS } from '../content/pearl-enemies.js';
import { MINERALS } from '../content/minerals.js';

export function createScoutSpecimens(scene, points, metres) {
  const objects = [], C = MINERALS.specimen;
  for (const p of points) {
    const root = new THREE.Group(); root.position.fromArray(p.point).normalize(); root.scale.setScalar(metres);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), root.position); scene.add(root);
    if (p.kind === 'rock') {
      const cluster = createAmethyst(p.cell); root.add(cluster.group); objects.push({ root, cluster, kind: 'amethyst' });
    } else {
      const config = { ...DEFAULT_CONFIG, ...PEARL_TIERS.find((t) => t.id === 'white').values, r0: C.radiusM, aggression: 0.2, reach: 1.8, cycleDuration: 3 };
      const swarm = new CutisSwarm(config, { capacity: 1 }); swarm.reset(1); swarm.place(0, 0, 0); swarm.scale[0] = 1;
      const geo = createSwarmGeometry(swarm); root.add(geo.group); objects.push({ root, swarm, geo, kind: 'harmless Cutis' });
    }
  }
  return {
    point(index) {
      const o = objects[index]; if (!o) return null;
      const p = o.swarm ? o.swarm.position(0) : [0, 1.2, 0];
      if (o.swarm) p[1] = C.radiusM;
      o.root.updateWorldMatrix(true, false);
      return o.root.localToWorld(new THREE.Vector3(...p)).toArray();
    },
    tick(dt, time, camera) {
      for (const o of objects) if (o.swarm) { const a = time / C.periodS * Math.PI * 2; o.swarm.setTarget(0, Math.cos(a) * C.roamM, Math.sin(a) * C.roamM); o.swarm.step(dt); o.geo.update(camera, typeof innerHeight === 'number' ? innerHeight : 900); }
    },
    state: () => objects.map((o) => ({ kind: o.kind, point: o.root.position.toArray(), alive: !!o.swarm, damage: 0 })),
    dispose() { for (const o of objects) { o.cluster?.dispose(); o.geo?.dispose(); o.root.removeFromParent(); } },
  };
}
