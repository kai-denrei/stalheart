// Programs linked, and first-used, before their first frame. three links a program the first time a material is drawn,
// and the frame that draws it waits for the link: the breach dive's opening frame paid five links (100 ms at dpr 1,
// 148 ms at dpr 2) and the dive's pass over the base two more for the landmarks' near tiers (2026-09-18 dive profile).
//
// Two things have to happen off the frame. The link itself: with KHR_parallel_shader_compile the driver links on its
// own threads and COMPLETION_STATUS says when it is done, so the programs are polled here the way compileAsync does.
// And the first use: three's WebGLProgram reads the link log and the shader logs the first time a program is bound,
// four synchronous round trips to the GPU process per program, and the opening frame still stalled 49 ms on those
// with every link long finished. So once a root's programs are ready their uniforms and attributes are pulled here.
//
// r160 keys a program on the render target's colour space as well as the scene's lights, so every root is compiled
// twice: once for the screen and once with a linear offscreen target bound, which is what the bloom chain's scene
// passes render into. Lights come from the game scene: call this only once they are in.
import * as THREE from '../../vendor/three.module.js';

export function makeShaderWarmer(renderer, scene, camera, { maxPolls = 500 } = {}) {
  const linear = new THREE.WebGLRenderTarget(1, 1);
  const programsOf = (material) => renderer.properties.get(material).programs?.values() ?? [];
  return {
    // every material under root, for the screen and for the chain; resolves once the programs are linked and first-used
    compile(root) {
      const materials = new Set(), previous = renderer.getRenderTarget();
      try {
        for (const m of renderer.compile(root, camera, scene)) materials.add(m);
        renderer.setRenderTarget(linear);
        for (const m of renderer.compile(root, camera, scene)) materials.add(m);
      } catch { /* a material that cannot compile fails the same way on its first frame; nothing to warm */ }
      finally { renderer.setRenderTarget(previous); }
      // BEST EFFORT, AND BOUNDED (2026-09-25): a lost context never reports a program ready, and this polled every 10 ms for the
      // rest of the page; it now resolves when the context is lost or after `maxPolls` (5 s), and only first-uses what linked
      return new Promise((resolve) => {
        let polls = 0;
        const poll = () => {
          const lost = !!renderer.getContext?.()?.isContextLost?.(), waiting = !lost && [...materials].some((m) => [...programsOf(m)].some((p) => !p.isReady()));
          if (waiting && ++polls < maxPolls) { setTimeout(poll, 10); return; }
          if (!lost) for (const m of materials) for (const p of programsOf(m)) if (p.isReady()) { p.getUniforms(); p.getAttributes(); }
          resolve();
        };
        poll();
      });
    },
    // a texture's upload, off the frame that would first sample it (the sinkhole's stone maps: ~40 ms of texSubImage2D)
    upload(texture) { if (texture?.image) renderer.initTexture(texture); },
    dispose() { linear.dispose(); },
  };
}
