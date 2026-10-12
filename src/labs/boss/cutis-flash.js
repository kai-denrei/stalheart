// cutis-flash.js — the Cutis-Maku's "absorbed" flash (owner, 2026-10-12: no damage while the body pours through the cup, "with a small 'absorbed' flash";
// docs/superpowers/specs/2026-10-12-cutis-maku-boss-design.md). A round its TRANSFER swallows lights a soft white disc over the creature for LIFE seconds.
// A small pool of additive sprites in the planet-centred group (metres), each on the sphere point over the creature's local centre, lifted by its radius; the
// kit's shaders are not touched (an instance's spare life channel does not reach the fragment). The texture is computed, not drawn on a canvas, so the node
// test builds it too.
import * as THREE from '../../../vendor/three.module.js';

const POOL = 24, LIFE = 0.15, SIZE = 3, TEX = 32;

function discTexture() {
  const data = new Uint8Array(TEX * TEX * 4);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const r = Math.hypot(x + 0.5 - TEX / 2, y + 0.5 - TEX / 2) / (TEX / 2), a = Math.max(0, 1 - r) ** 2, k = (y * TEX + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = Math.round(a * 255);
  }
  const tex = new THREE.DataTexture(data, TEX, TEX); tex.needsUpdate = true;
  return tex;
}

// `group` the planet-centred group the sprites live in, `ground(x, z)` the sphere point (metres) under a local point
export function createCutisFlash(group, { ground }) {
  const map = discTexture(), sprites = [];
  for (let i = 0; i < POOL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xfff2dc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.visible = false; s.renderOrder = 5; s.name = 'Cutis-Maku flash'; s.userData.left = 0; group.add(s); sprites.push(s);
  }
  let next = 0, fired = 0;
  return {
    // a flash over the local point [x, z] for a creature of radius `r` metres
    at(x, z, r) {
      const s = sprites[next]; next = (next + 1) % POOL; fired++;
      const w = ground(x, z), l = Math.hypot(w[0], w[1], w[2]) || 1;
      s.position.set(w[0] + w[0] / l * r, w[1] + w[1] / l * r, w[2] + w[2] / l * r);
      s.scale.setScalar(SIZE * r); s.userData.left = LIFE; s.material.opacity = 1; s.visible = true;
    },
    step(dt) {
      for (const s of sprites) {
        if (!s.visible) continue;
        s.userData.left -= dt;
        if (s.userData.left <= 0) { s.visible = false; continue; }
        s.material.opacity = s.userData.left / LIFE;
      }
    },
    clear() { for (const s of sprites) { s.visible = false; s.userData.left = 0; } },
    // the flashes fired so far and those showing now
    stats: () => ({ fired, live: sprites.filter((s) => s.visible).length }),
    dispose() { for (const s of sprites) { group.remove(s); s.material.dispose(); } map.dispose(); },
  };
}
