// THE HULL'S FLARES (owner, 2026-11-05, round 8 note 7: "the tank drops temporary flares like Isao, which dispatches the Yushi Rover to come collect
// the biomass"). F drops one under the hull: the cave's look (below/src/flares.js: a core, a halo) at the game's scale, amber like the cargo pad
// (src/content/rover.js FLARE), standing on the ground where it lands, with the site ring (src/fx/site-ring.js) drawn at the rover's reach so
// the player sees which piles the order covers. It burns FLARE.seconds; at most FLARE.max stand (a fourth replaces the oldest).
// NO REAL LIGHT: a PointLight added in play changes the program of every lit material in the scene (a hitch, and the suites count programs);
// the glow is drawn instead, an additive halo that faces the camera and a disc on the ground.
// Unit-sphere host coordinates (the game draws the planet's floor at radius 1).
//   createHullFlares(scene, { metres, cellSide, tune, reach }) -> { drop(point, cell, now) -> flare, tick(now, camera), live(), byId(id), alive(id), dispose() }
//     flare: { id, cell, point, at, until }
import * as THREE from '../../vendor/three.module.js';
import { makeSiteRing, disposeSiteRing } from './site-ring.js';

const glowTexture = (() => {
  let tex = null;
  return () => {
    if (tex || typeof document === 'undefined') return tex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); tex = new THREE.CanvasTexture(c); return tex;
  };
})();

export function createHullFlares(scene, { metres, cellSide, tune, reach }) {
  const flares = [], owned = [];
  let next = 1;
  const own = (x) => { owned.push(x); return x; };
  const coreGeo = own(new THREE.CylinderGeometry(0.06, 0.06, tune.stickMetres, 8)), coreMat = own(new THREE.MeshBasicMaterial({ color: tune.colour, fog: false }));
  const haloMat = own(new THREE.SpriteMaterial({ map: glowTexture(), color: tune.colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const discGeo = own(new THREE.CircleGeometry(1, 32)), discMat = own(new THREE.MeshBasicMaterial({ map: glowTexture(), color: tune.colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 }));
  function remove(f) {
    scene.remove(f.group); if (f.ring) disposeSiteRing(scene, f.ring);
    const i = flares.indexOf(f); if (i >= 0) flares.splice(i, 1);
  }
  return {
    drop(point, cell, now) {
      while (flares.length >= tune.max) remove(flares[0]);   // the oldest makes way
      const up = new THREE.Vector3(...point).normalize(), at = up.clone();   // on the floor, radius 1
      const group = new THREE.Group(); group.position.copy(at); group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      const core = new THREE.Mesh(coreGeo, coreMat); core.scale.setScalar(metres); core.position.y = tune.stickMetres * 0.45 * metres; core.rotation.z = 0.35; group.add(core);
      const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(tune.haloMetres * metres); halo.position.y = tune.stickMetres * metres; group.add(halo);
      const disc = new THREE.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(tune.haloMetres * 0.9 * metres); disc.position.y = 0.05 * metres; group.add(disc);
      scene.add(group);
      const ring = makeSiteRing(scene, at.toArray(), at.toArray(), reach * cellSide / 0.42, 0.3 * metres, tune.colour);
      const f = { id: `flare-${next++}`, cell, point: at.toArray(), at: now, until: now + tune.seconds, group, halo, disc, ring };
      flares.push(f);
      return { id: f.id, cell, point: f.point, at: f.at, until: f.until };
    },
    tick(now) {
      for (const f of flares.slice()) {
        if (now >= f.until) { remove(f); continue; }
        const left = f.until - now, fade = Math.min(1, left / 4), flicker = 0.85 + 0.1 * Math.sin(now * 17 + f.at) + 0.05 * Math.sin(now * tune.pulse);
        f.halo.material.opacity = 1; f.halo.scale.setScalar(tune.haloMetres * metres * flicker * (0.4 + 0.6 * fade));
        f.disc.scale.setScalar(tune.haloMetres * 0.9 * metres * (0.5 + 0.5 * fade));
        if (f.ring) f.ring.material.opacity = 0.4 + 0.5 * fade * (0.6 + 0.4 * Math.sin(now * tune.pulse));
      }
    },
    live: () => flares.map((f) => ({ id: f.id, cell: f.cell, point: f.point, at: f.at, until: f.until })),
    alive: (id) => flares.some((f) => f.id === id),
    dispose() { for (const f of flares.slice()) remove(f); for (const o of owned) o.dispose?.(); },
  };
}
