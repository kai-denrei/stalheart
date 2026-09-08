import * as THREE from '../../vendor/three.module.js';
export const RANGE_SURFACES = {
  wall: { color: 0x54504a, roughness: 0.95, metalness: 0, spark: 0xffb066, debris: 0x6b655c, scorch: 0x14100c },
  armour: { color: 0x6e777e, roughness: 0.45, metalness: 0.85, spark: 0xffd08a, debris: 0x8a8f94, scorch: 0x0e0b09 },
  hull: { color: 0x3f4a52, roughness: 0.35, metalness: 0.95, spark: 0xcfe8ff, debris: 0x5b6a75, scorch: 0x0a0d10 },
};
// Origin is the aim/contact point on the front face, +Z goes into the fixture.
export function makeRangeSurface(kind, size, angle) {
  const surface = RANGE_SURFACES[kind], root = new THREE.Group();
  const { color, roughness, metalness } = surface;
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const depth = kind === 'wall' ? 0.5 : kind === 'armour' ? 0.15 : size * 0.55;
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.65, depth), material);
  body.position.z = depth / 2; root.add(body);
  if (kind === 'hull') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(size * 0.65, size * 0.18, depth * 0.7), material);
    deck.position.set(0, size * 0.415, depth * 0.5); root.add(deck);
  }
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x9aa6ad }));
  body.add(edges);
  root.rotation.y = angle * Math.PI / 180;
  root.userData.surface = kind;
  return root;
}

export function surfaceNormal(object, from) {
  const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
  if (normal.dot(new THREE.Vector3().fromArray(from).sub(object.position)) < 0) normal.negate();
  return normal.toArray();
}
