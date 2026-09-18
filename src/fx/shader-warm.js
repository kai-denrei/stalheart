// Programs linked before their first frame. three links a program the first time a material is drawn, and the link
// blocks the frame that draws it: the breach dive's opening frame paid five links (100 ms at dpr 1, 148 ms at dpr 2)
// and the dive's pass over the base paid two more for the landmarks' near tiers (2026-09-18 dive profile). With
// KHR_parallel_shader_compile the driver links off the main thread, and compileAsync only asks for the program once
// COMPLETION_STATUS says it is done, so a root handed here early costs its first frame nothing.
//
// r160 keys a program on the render target's colour space as well as the scene's lights, so every root is compiled
// twice: once for the screen and once with a linear offscreen target bound, which is what the bloom chain's scene
// passes render into. Lights come from the game scene: call this only once they are in.
import * as THREE from '../../vendor/three.module.js';

export function makeShaderWarmer(renderer, scene, camera) {
  const linear = new THREE.WebGLRenderTarget(1, 1);
  return {
    // every material under root, for the screen and for the chain; resolves once the links are done, never rejects
    compile(root) {
      const previous = renderer.getRenderTarget(), jobs = [];
      try {
        jobs.push(renderer.compileAsync(root, camera, scene));
        renderer.setRenderTarget(linear);
        jobs.push(renderer.compileAsync(root, camera, scene));
      } catch (error) { jobs.push(Promise.reject(error)); }
      finally { renderer.setRenderTarget(previous); }
      return Promise.allSettled(jobs).then(() => undefined);
    },
    // a texture's upload, off the frame that would first sample it (the sinkhole's stone maps: ~40 ms of texSubImage2D)
    upload(texture) { if (texture?.image) renderer.initTexture(texture); },
    dispose() { linear.dispose(); },
  };
}
