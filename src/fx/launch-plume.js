// Engine plume on a camera-facing quad. The march loop is the MIT launch
// plume from pulkitxm/claude-directory (see ATTRIBUTIONS.md); the ray setup
// is rewritten for a quad in a Three.js scene, with an intensity uniform.
import * as THREE from '../../vendor/three.module.js';

const VERT = `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float iTime, uSteps, uSquash, uOctaves, uTurb, uCore, uDetail, uStepSize, uExposure, uIntensity;
uniform vec2 uTint, uField;
uniform vec3 uCam;
void main() {
  // quad uv -> field metres: the core sits near the top of the quad, the plume runs down
  vec2 f = vec2((vUv.x - 0.5) * uField.x, mix(-uField.y, 2.5, vUv.y));
  vec3 v = uCam;
  vec3 dir = vec3(0.0, 0.0, -1.0);
  float t = iTime;
  vec4 o = vec4(0.0);
  float z = 0.0, d = 0.0, fd = 1.0;
  for (float i = 0.0; i < uSteps; i++) {
    vec3 p = vec3(f, v.z) + z * dir;
    vec3 a = p; a.y *= uSquash;
    for (d = 1.0; d < uOctaves; d++) a -= uTurb * sin((a.zxy + t * v + d) * d) * p.y / d;
    fd = 0.2 + abs(length(a.xz - cos(a.zx * uDetail)) + max(p.y / 0.1, -0.6));
    d = min(max(-p.y, length(a) - uCore), fd) / uStepSize;
    z += d;
    o += vec4(uTint.x, uTint.y, d, z / fd) / max(z, 1e-3);
  }
  o = tanh(o * o.a / uExposure);
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.12, vUv.y);
  outColor = vec4(o.rgb * uIntensity * edge, 1.0);
}`;

export function createLaunchPlume({ width = 12, height = 26, steps = 28, octaves = 6 } = {}) {
  const uniforms = {
    iTime: { value: 0 }, uSteps: { value: steps }, uOctaves: { value: octaves },
    uTint: { value: new THREE.Vector2(3.0, 1.0) }, uCam: { value: new THREE.Vector3(0, -2, 7) },
    uSquash: { value: 0.3 }, uTurb: { value: 0.1 }, uCore: { value: 2.0 }, uDetail: { value: 6.0 },
    uStepSize: { value: 8.0 }, uExposure: { value: 1000 }, uIntensity: { value: 0 },
    uField: { value: new THREE.Vector2(width * 0.9, height * 0.42) },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = 'Launch plume';
  mesh.frustumCulled = false;
  mesh.userData.setIntensity = (v) => { uniforms.uIntensity.value = v; mesh.visible = v > 0.001; };
  mesh.userData.tick = (t) => { uniforms.iTime.value = t; };
  // face the camera about the vertical axis only, so the plume stays a column
  mesh.userData.face = (camera) => {
    const p = new THREE.Vector3(); mesh.getWorldPosition(p);
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
    mesh.rotation.set(0, Math.atan2(dx, dz), 0);
  };
  mesh.userData.dispose = () => { mesh.geometry.dispose(); material.dispose(); };
  return mesh;
}
