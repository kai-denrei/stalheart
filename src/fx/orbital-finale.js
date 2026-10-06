// THE ORBITAL CONSTELLATION (owner, 2026-10-06: "a short animation from the A6 orbital cinematic: an orbital constellation built by
// repeated satellite launches, with new Isao lines 'WE DID IT', 'We connected this planet to the Dyson Sphere', 'Ready for the next
// one? AH AH!'"). The last chapters of A6's First Light (orbital-cinematic/, SentryTowers_A6 deaf9206: timeline.js, scene.js,
// galaxy.js, mirror-head.js), ported: the small rotating planet under its atmosphere, the star field and the distant spiral galaxy,
// SOL-88 on station, the ARC-01 on its pad, and forty-eight HEL-01 heads shot up one after another and spread over three tilted rings
// while the camera pulls back to the whole constellation. Upstream seconds 50 to 100 are played in SECONDS.
//
// It is its own small world on its own canvas over the game (one more WebGL context for half a minute, disposed after), so nothing in
// the game's scene, camera or post chain changes for it. Any key or click ends it. The ARC-01's sled is not animated here: the HEL-01
// launches are the rising streaks, as upstream draws them past their first 0.85 s.
// OUR OWN PLANET (owner, 2026-10-06, twenty-seventh notes, 9: "it should show our actual planet, not the placeholder one"): given
// `planet` ({ map: the board's surface meshes, heart: the heart's unit vector }), the small world is the game's own surface, its floor,
// rock and edge lines drawn from the same geometry buffers, turned so the heart sits under the pad at the pole; without it, the
// upstream placeholder sphere.
// THE BLACK HOLE NOT FAR (owner, 2026-10-06: "the feeling that an amazing TON 618-like black hole is not far"): the accretion disk of
// src/fx/accretion.js, rendered once and hung as a billboard behind the planet on the camera's line, HOLE.across units wide at HOLE.at,
// so it fills a third of the frame as the camera pulls back; the spiral galaxy moved off to its side.
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture } from './model-fixture.js';
import { isaoSay } from './isao-voice.js';
import { renderAccretion, accretionSprite, accretionShadow, faceShadow } from './accretion.js';

export const SECONDS = 26;
const FROM = 50, TO = 100, PLANET_RADIUS = 195, MIRROR_COUNT = 48, CENTER = [0, -PLANET_RADIUS, 0];
export const HOLE = Object.freeze({ at: Object.freeze([-330, -850, -1375]), across: 1500, galaxyAt: Object.freeze([-1750, -150, -1800]) });   // a little to the pulled-back camera's right: the shadow shows beside the planet, the disk behind it
const MODELS = { launcher: 'assets/models/astro/arc01_launcher_d0_lod1.glb', sol: 'assets/models/sol88/sol88_platform_game.glb', mirror: 'assets/models/orbital/hel01_mirror_d0_lod1.glb' };
// Isao's three lines, at these seconds of the shot
const LINES = [[1.2, 'ending_did_it', 'WE DID IT!'], [9.5, 'ending_dyson', 'We connected this planet to the Dyson Sphere.'], [19.5, 'ending_next', 'Ready for the next one? AH AH!']];

// THE CHOREOGRAPHY (upstream timeline.js, the part from 50 s on). Pure: seconds in, poses out
const clamp = (x) => Math.max(0, Math.min(1, x)), smooth = (t, a, b) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const planetAngle = (t) => Math.max(0, t - 7) * 0.018;
const orbitPosition = (a, r = 365, tilt = 0.52) => [Math.sin(a) * r, CENTER[1] + Math.cos(a) * r * Math.cos(tilt), Math.cos(a) * r * Math.sin(tilt)];
export function mirrorOrbit(i, t) { const ring = i % 3, slot = Math.floor(i / 3), angle = slot / 16 * Math.PI * 2 + (t - 52) * (0.011 + ring * 0.002), r = 310 + ring * 26, tilt = [-0.8, 0.15, 0.95][ring], x = Math.cos(angle) * r; return [x * Math.cos(tilt), CENTER[1] + Math.sin(angle) * r, x * Math.sin(tilt)]; }
// the rail's exit on the pad (upstream extensionPose(0) of the ARC-01 runtime: a 40 m arc swept 1.05 rad from 2.6 m up, 20 m back), turned with the planet
const EXIT = [2.6 + 40 * (1 - Math.cos(1.05)) + 0.43 * Math.cos(-1.05), -20 + 40 * Math.sin(1.05) + 0.43 * Math.sin(-1.05)];
function straightFlight(release, t, speed) { const a = planetAngle(release); return [Math.sin(a) * EXIT[1], EXIT[0] + Math.max(0, t - release) * speed, Math.cos(a) * EXIT[1]]; }
export function constellationState(t) {
  const sol = orbitPosition(0.34 + (Math.max(23, t) - 23) * 0.009);
  const mirrors = Array.from({ length: MIRROR_COUNT }, (_, i) => {
    const launchAt = 52.4 + i * 0.65, age = t - launchAt, deployed = age >= 5, launching = age >= 0 && age < 0.85;
    return { visible: launching || deployed, launching, deployed, position: deployed ? mirrorOrbit(i, t) : straightFlight(launchAt, t, 470), scale: deployed ? 4 * smooth(age, 5, 5.55) : 0.2 };
  });
  let camera, target;
  if (t < 53) { const k = smooth(t, 45, 53); camera = mix([230, 140, 360], [68, 42, 75], k); target = mix(mix(sol, CENTER, 0.38), [0, 16, 0], k); }
  else { const k = smooth(t, 55, 86); camera = mix([68, 42, 75], [610, 330, 820], k); target = mix([0, 16, 0], CENTER, k); if (t > 86) { const a = (t - 86) * 0.016, [x, , z] = camera; camera[0] = x * Math.cos(a) + z * Math.sin(a); camera[2] = -x * Math.sin(a) + z * Math.cos(a); } }
  return { planetAngle: planetAngle(t), sol, mirrors, deployed: mirrors.filter((m) => m.deployed).length, camera, target, guides: t >= 55 };
}

// THE HEL-01 DISTANCE HEAD (upstream mirror-head.js): a 36-triangle hexagonal head, the source head's palette and materials
function mirrorHead(source) {
  const backSource = source.getObjectByName('MIRROR_BACK'), faceSource = source.getObjectByName('OPTICAL_FACE');
  if (!backSource || !faceSource) throw Error('HEL-01 source head is missing');
  const outer = 1.55, inner = 1.492, front = 0.067, rear = -0.0525, back = [], face = [];
  const point = (r, i, z) => [Math.sin(i * Math.PI / 3) * r, Math.cos(i * Math.PI / 3) * r, z], tri = (out, a, b, c) => out.push(...a, ...b, ...c);
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6, a = point(outer, i, front), b = point(outer, j, front), c = point(inner, i, front), d = point(inner, j, front), ar = point(outer, i, rear), br = point(outer, j, rear);
    tri(face, [0, 0, front], d, c); tri(back, a, d, b); tri(back, a, c, d); tri(back, a, b, br); tri(back, a, br, ar); tri(back, [0, 0, rear], ar, br);
  }
  return [[back, backSource, false], [face, faceSource, true]].map(([v, original, optical]) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const col = original.geometry.attributes.color, colors = [];
    for (let i = 0; i < v.length / 3; i++) colors.push(col ? col.getX(0) : 1, col ? col.getY(0) : 1, col ? col.getZ(0) : 1);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const m = original.material.clone(); m.side = THREE.FrontSide; if (optical) { m.roughness = Math.max(m.roughness ?? 0, 0.32); m.metalness = Math.min(m.metalness ?? 0, 0.8); }
    return { geometry: g, material: m };
  });
}

// THE DISTANT GALAXY (upstream galaxy.js): 11,000 point sprites in four arms and a soft core, fixed far behind the planet
function galaxy() {
  const g = new THREE.Group(); g.position.set(...HOLE.galaxyAt); g.rotation.set(0.22, -0.12, -0.32);
  const n = 11000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  let seed = 8817; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    const r = Math.pow(rnd(), 0.72), angle = (i % 4) * Math.PI / 2 + r * 8.5 + (rnd() - 0.5) * (0.18 + r * 0.52), R = r * 720;
    pos.set([Math.cos(angle) * R + (rnd() - 0.5) * 35, Math.sin(angle) * R * 0.36 + (rnd() - 0.5) * 13, (rnd() - 0.5) * 25 * (1 - r)], i * 3);
    const c = new THREE.Color(0xffe2b3).lerp(new THREE.Color(i % 7 === 0 ? 0xc59af1 : 0x759fd8), Math.min(1, r * 1.4)); c.multiplyScalar(0.5 + rnd() * 0.5); col.set(c.toArray(), i * 3); size[i] = 1 + rnd() * 2.5;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('pointSize', new THREE.BufferAttribute(size, 1));
  g.add(new THREE.Points(geo, new THREE.ShaderMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float pointSize;varying vec3 tint;void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize;}',
    fragmentShader: 'varying vec3 tint;void main(){vec2 p=gl_PointCoord-.5;float a=exp(-dot(p,p)*18.0)*.52;gl_FragColor=vec4(tint,a);}' })));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1000, 390), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 uv0;void main(){vec2 p=(uv0-.5)*2.0;float r=dot(p,p);float core=exp(-r*24.0);float halo=exp(-r*4.5);vec3 c=mix(vec3(.3,.42,.7),vec3(1.,.86,.63),core);gl_FragColor=vec4(c,core*.48+halo*.045);}' }));
  glow.position.z = -2; g.add(glow);
  return g;
}

// the turn that stands the heart at the pole (+Y), so the base sits under the pad; identity for a heart already there
export function heartToPole(heart) {
  const h = new THREE.Vector3(...(heart ?? [0, 1, 0])); if (h.lengthSq() < 1e-12) h.set(0, 1, 0);
  return new THREE.Quaternion().setFromUnitVectors(h.normalize(), new THREE.Vector3(0, 1, 0));
}

// the game's own surface as the small world's planet: the board's floor and rock meshes and its edge lines on the same buffers, lit by
// this scene's lights (Lambert, as the board draws them), the whole unit sphere scaled to the planet's radius and turned heart-up
export function ownPlanet(planet, radius = PLANET_RADIUS) {
  const g = new THREE.Group(), world = new THREE.Group();
  for (const src of planet?.map ?? []) {
    if (!src?.geometry) continue;
    const m = src.isLine ? new THREE.LineSegments(src.geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false })) : new THREE.Mesh(src.geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.frustumCulled = false; world.add(m);
  }
  world.quaternion.copy(heartToPole(planet?.heart)); world.scale.setScalar(radius); g.add(world);
  g.userData.meshes = world.children.length;
  return g;
}

// THE SMALL WORLD (upstream scene.js): the planet's vertex colours, its atmosphere, the stars, the pad, SOL-88, the heads, guides and trails
function buildWorld({ launcher, sol, mirror, planet: own = null, renderer = null }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020610);
  let hole = null, shade = null;
  if (renderer && globalThis.location?.search?.includes('hole=0') !== true) {   // no hole on a context that refuses the shader; ?hole=0 leaves it out (the harness)
    try { const { texture, shadow } = renderAccretion() ?? {}; if (texture) { hole = accretionSprite(texture, HOLE.across); hole.position.set(...HOLE.at); scene.add(hole); shade = accretionShadow(shadow, HOLE.across); scene.add(shade); } } catch { hole = shade = null; }
  }
  const center = new THREE.Vector3(...CENTER), site = new THREE.Group(); scene.add(site);
  let planet;
  if (own?.map?.length) { planet = ownPlanet(own); planet.position.copy(center); scene.add(planet); }
  else {
    const sphere = new THREE.SphereGeometry(PLANET_RADIUS, 96, 64), p = sphere.attributes.position, colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(p, i).normalize(), v = Math.sin(n.x * 6 + Math.sin(n.z * 5)) * Math.cos(n.y * 8 - n.z * 3) + Math.sin(n.y * 15 + n.x * 4) * 0.5;
      const c = new THREE.Color(Math.abs(n.y) > 0.88 ? 0xcbd9d8 : v > 0.22 ? (v > 0.8 ? 0x697354 : 0x366651) : 0x123d59); c.multiplyScalar(0.9 + Math.sin(n.x * 31 + n.z * 47) * 0.035); colors.set(c.toArray(), i * 3);
    }
    sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planet = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.12 })); planet.position.copy(center); scene.add(planet);
  }
  const air = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS * 1.025, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(.16,.58,.85,a*.32);}' }));
  air.position.copy(center); scene.add(air);
  if (launcher) site.add(launcher);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(35, 37, 1.6, 64), new THREE.MeshStandardMaterial({ color: 0x26363e, roughness: 0.85, metalness: 0.25 })); pad.position.y = -0.81; site.add(pad);
  const stars = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) { const y = 1 - 2 * (i + 0.5) / 1800, a = i * 2.399963, r = Math.sqrt(1 - y * y); stars.set([Math.cos(a) * r * 1600, y * 1600 - 140, Math.sin(a) * r * 1600], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbad9ed, size: 1.25, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
  scene.add(galaxy());
  const solRig = new THREE.Group(); if (sol) solRig.add(sol); solRig.scale.setScalar(0.8); scene.add(solRig);
  const heads = mirror ? mirrorHead(mirror).map(({ geometry, material }) => { const m = new THREE.InstancedMesh(geometry, material, MIRROR_COUNT); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m; }) : [];
  const guides = new THREE.Group();
  for (let ring = 0; ring < 3; ring++) {
    const pts = Array.from({ length: 129 }, (_, i) => { const a = i / 128 * Math.PI * 2, r = 310 + ring * 26, tilt = [-0.8, 0.15, 0.95][ring]; return new THREE.Vector3(Math.cos(a) * r * Math.cos(tilt), CENTER[1] + Math.sin(a) * r, Math.cos(a) * r * Math.sin(tilt)); });
    guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x507b94, transparent: true, opacity: 0.15, depthWrite: false })));
  }
  scene.add(guides);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MIRROR_COUNT * 6), 3));
  const trails = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x94ecff, transparent: true, opacity: 0.65 })); trails.frustumCulled = false; scene.add(trails);
  const sun = new THREE.DirectionalLight(0xffe7c0, 3.3); sun.position.set(300, 260, 400); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xa6d9ff, 0x111727, 1.6));
  const rim = new THREE.DirectionalLight(0x66a9ff, 0.75); rim.position.set(-300, 30, -200); scene.add(rim);
  const dummy = new THREE.Object3D(), face = new THREE.Vector3(1, 0.55, 1).normalize(), down = new THREE.Vector3(0, -1, 0);
  function pose(t) {
    const s = constellationState(t), before = constellationState(Math.max(FROM, t - 0.14)), arr = tg.attributes.position.array;
    planet.rotation.y = site.rotation.y = s.planetAngle;
    solRig.position.fromArray(s.sol); solRig.quaternion.setFromUnitVectors(down, center.clone().sub(solRig.position).normalize());
    s.mirrors.forEach((m, i) => {
      dummy.position.fromArray(m.position); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face); dummy.rotateZ(i * 0.41 + t * 0.025); dummy.scale.setScalar(m.visible ? m.scale : 0); dummy.updateMatrix();
      for (const h of heads) h.setMatrixAt(i, dummy.matrix);
      arr.set(m.launching ? before.mirrors[i].position : m.position, i * 6); arr.set(m.position, i * 6 + 3);
    });
    for (const h of heads) h.instanceMatrix.needsUpdate = true;
    tg.attributes.position.needsUpdate = true; guides.visible = s.guides;
    return s;
  }
  const faceCamera = (camera) => { if (shade) faceShadow(shade, hole.position, camera); };   // the shadow turned to the camera, every frame
  return { scene, pose, faceCamera, hole: !!hole, holeProbe: hole?.material.map?.userData.probe ?? null, dispose: () => { hole?.material.map?.dispose(); hole?.material.dispose(); shade?.geometry.dispose(); shade?.material.dispose(); } };
}

// root: the DOM parent to cover; sfx: the sound engine for Isao; done(): runs once when it ends or is skipped; planet: the game's own
// surface for the small world (ownPlanet above), or null for the placeholder. Returns { stop, state }
export function playOrbitalFinale(root, { sfx = null, done = null, planet = null } = {}) {
  const el = document.createElement('div'); el.id = 'orbital-finale';
  el.innerHTML = '<canvas></canvas><p class="of-line" aria-live="polite"></p><p class="of-count"></p><p class="of-skip">ANY KEY · SKIP</p>';
  (root ?? document.body).append(el);
  const canvas = el.querySelector('canvas'), line = el.querySelector('.of-line'), count = el.querySelector('.of-count');
  el.dataset.own = planet?.map?.length ? '1' : '0';   // what the harness reads: the game's own planet, or the placeholder
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  let world = null, raf = 0, start = 0, ended = false, said = 0;
  const size = () => { const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!world) return;
    start ||= now;
    const sec = (now - start) / 1000;
    if (sec >= SECONDS) { stop(); return; }
    const s = world.pose(FROM + (sec / SECONDS) * (TO - FROM));
    camera.position.fromArray(s.camera); camera.lookAt(...s.target); world.faceCamera(camera);
    size(); renderer.render(world.scene, camera);
    while (said < LINES.length && sec >= LINES[said][0]) { const [, id, text] = LINES[said++]; isaoSay(sfx, id, { force: true }); line.textContent = text; line.classList.remove('on'); void line.offsetWidth; line.classList.add('on'); }
    const n = `${String(s.deployed).padStart(2, '0')} / ${MIRROR_COUNT} HEL-01 IN ORBIT`; if (count.textContent !== n) count.textContent = n;
    el.style.opacity = String(Math.min(1, sec / 0.8, (SECONDS - sec) / 1.2));
  }
  function stop() {
    if (ended) return; ended = true;
    cancelAnimationFrame(raf); removeEventListener('keydown', skip, true); el.removeEventListener('pointerdown', skip, true);
    world?.dispose?.(); renderer.dispose(); renderer.forceContextLoss?.(); el.remove(); done?.();
  }
  const skip = (e) => { e.preventDefault?.(); e.stopImmediatePropagation?.(); stop(); };
  addEventListener('keydown', skip, true); el.addEventListener('pointerdown', skip, true);
  Promise.all(Object.values(MODELS).map((u) => loadModelFixture(u).then((m) => cloneFixture(m)).catch(() => null))).then(([launcher, sol, mirror]) => {
    if (ended) return;
    try { world = buildWorld({ launcher, sol, mirror, planet, renderer }); el.dataset.loaded = '1'; el.dataset.hole = world.hole ? '1' : '0'; el.dataset.holeProbe = JSON.stringify(world.holeProbe); } catch { stop(); }
  });
  raf = requestAnimationFrame(frame);
  return { stop, state: () => ({ on: !ended, loaded: !!world, own: !!planet?.map?.length, hole: !!world?.hole, said, line: line.textContent, count: count.textContent }) };
}
