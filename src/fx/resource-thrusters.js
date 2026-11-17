// SAI exhaust sockets use the rocket's plume and wash builders at aircraft scale.
// The wash stays in a fixed planetary frame, so smoke cannot follow the aircraft.
import * as THREE from '../../vendor/three.module.js';
import { SAI_THRUST as T } from '../content/minerals.js';
import { createLaunchPlume } from './launch-plume.js';
import { createLandingWash } from './landing-wash.js';

export function createResourceThrusters({ model, holder, scene, metres }) {
  holder.updateMatrixWorld(true);
  const up = holder.position.clone().normalize(), origin = up.clone();
  const frame = new THREE.Matrix4().compose(origin, holder.quaternion, new THREE.Vector3(1, 1, 1));
  const inverse = frame.clone().invert(), feet = new THREE.Vector3(), cameraAt = new THREE.Vector3();
  const wash = createLandingWash({ parent: scene, frame, metres, planetRadius: 1, tune: T.wash });
  const sockets = [];
  model.traverse(o => { if (/^SOCKET_EXHAUST_(FL|FR|RL|RR)$/.test(o.name)) sockets.push(o); });
  const plumes = sockets.map(socket => {
    const plume = createLaunchPlume({ steps: T.steps, octaves: T.octaves });
    // Scale the mesh, preserving the rocket shader's sampling field.
    plume.geometry.scale(T.width / plume.geometry.parameters.width, T.height / plume.geometry.parameters.height, 1);
    plume.name = 'SAI-93 thruster'; plume.position.y = -T.height / 2;
    plume.userData.setIntensity(0); socket.add(plume);
    plume.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(cameraAt); socket.worldToLocal(cameraAt);
      plume.rotation.y = Math.atan2(cameraAt.x, cameraAt.z);
      plume.updateMatrixWorld();
    };
    return plume;
  });
  let intensity = 0;
  return {
    tick(dt, now, height, powered = true) {
      intensity = powered && height > .03 ? T.intensity * Math.min(1, height / .3) : 0;
      for (const p of plumes) { p.userData.tick(now); p.userData.setIntensity(intensity); }
      holder.getWorldPosition(feet); feet.applyMatrix4(inverse).divideScalar(metres);
      wash.tick(dt, { feet: feet.toArray(), plume: intensity / T.intensity, reach: T.washReach });
    },
    state: () => ({ sockets: plumes.length, intensity, wash: wash.state() }),
    dispose() { for (const p of plumes) { p.removeFromParent(); p.userData.dispose(); } wash.dispose(); },
  };
}
