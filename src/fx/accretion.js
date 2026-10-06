// THE ACCRETION DISK (owner, 2026-10-06: "the feeling that an amazing TON 618-like black hole is not far"). A port of the owner's
// Accretion.html: a Schwarzschild photon ray march (Rs = 1) through a thin disk between 2.5 and 14 Rs, flow-map noise crossfaded so
// the shear never blows up, Doppler beaming and gravitational redshift on the near side, tone-mapped in the shader as the original.
// Two hundred and twenty steps a pixel is not a thing to run every frame under the finale on a phone, so it is rendered ONCE into a
// square texture (renderAccretion) and hung in the finale's sky in two layers: the glow as an ADDITIVE billboard (black adds nothing,
// so the empty sky round it cannot show as a square; a normal-blended sprite did, whatever its alpha said), and the shadow, the rays
// that fell in, as an opaque black disc sized from the rendered picture, turned to the camera (accretionShadow). No asset, no pin:
// the shader is the picture.
import * as THREE from '../../vendor/three.module.js';

// size: the texture's side in pixels; pose: [tilt, roll] of the camera about the hole (the original's Tilted preset); time: the
// disk's flow phase (any value: it is a still)
export const ACCRETION = Object.freeze({ size: 1024, pose: Object.freeze([0.32, -0.45]), time: 7.3 });

export function accretionShader() {
  return `precision highp float;
uniform vec2 R;uniform float T;uniform vec2 C;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p,float P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 float x0=mod(i.x,P),x1=mod(i.x+1.,P);
 return mix(mix(h(vec2(x0,i.y)),h(vec2(x1,i.y)),f.x),mix(h(vec2(x0,i.y+1.)),h(vec2(x1,i.y+1.)),f.x),f.y);}
float fbm(vec2 p,float P){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p,P);p*=2.;P*=2.;a*=.5;}return s;}
float layer(float th,float r,float ph,float o){return fbm(vec2(fract((th-ph)/6.2832)*20.,r*5.+o),20.);}
vec4 disk(vec3 q,float r,vec3 rd){
 float th=atan(q.z,q.x),w=2.5*pow(r,-1.5),c=T*.1,f1=fract(c),f2=fract(c+.5);
 float n=mix(layer(th,r,w*f2*10.,7.),layer(th,r,w*f1*10.,0.),1.-abs(2.*f1-1.));
 vec3 vel=vec3(-q.z,0.,q.x)/r*sqrt(.5/(r-1.));
 float g=sqrt(1.-dot(vel,vel))/(1.+dot(vel,rd))*sqrt(1.-1./r);
 float beam=mix(1.,pow(g,3.),.7);
 float env=smoothstep(2.6,3.4,r)*smoothstep(14.,6.,r);
 float d=smoothstep(.3,.85,n);
 float I=env*(.15+1.6*d*d)*pow(3./r,1.6)*beam;
 vec3 col=mix(vec3(.9,.22,.03),vec3(1.,.8,.55),clamp(I*.8,0.,1.))*I*2.;
 return vec4(col,clamp(env*(.3+.9*d),0.,1.)*.85);}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);
 float cr=cos(C.y),sr=sin(C.y);uv=mat2(cr,-sr,sr,cr)*uv;
 vec3 ro=22.*vec3(0.,sin(C.x),-cos(C.x));
 vec3 f=normalize(-ro),rt=normalize(cross(vec3(0,1,0),f)),up=cross(f,rt);
 vec3 p=ro,v=normalize(f+.85*(uv.x*rt+uv.y*up)),col=vec3(0.);float a=1.;
 vec3 L=cross(p,v);float h2=dot(L,L);
 for(int i=0;i<220;i++){
  float r=length(p);if(r<1.02){a=0.;break;}
  float dt=.07*r;
  v+=-1.5*h2*p/pow(r,5.)*dt;
  vec3 pn=p+v*dt;
  if(p.y*pn.y<0.){vec3 q=mix(p,pn,p.y/(p.y-pn.y));float rr=length(q.xz);
   if(rr>2.5&&rr<14.){vec4 d=disk(q,rr,normalize(v));col+=a*d.rgb;a*=1.-d.a;}}
  p=pn;if(r>40.)break;}
 col=pow(1.-exp(-col*1.4),vec3(.85));
 col*=1.-smoothstep(.36,.5,max(abs(uv.x),abs(uv.y)));   // the picture fades to its square's edge, so the disk's outer rim is never cut straight
 float alpha=clamp(max(max(col.r,col.g),col.b)*2.5+(1.-a),0.,1.);   // the glow, and the shadow of what fell in; clear sky elsewhere
 gl_FragColor=vec4(col,alpha);}`;
}

// the hole rendered once, as the owner's page renders it: its own small WebGL context (gone again once read), the picture read back as
// pixels and handed to three.js as a DataTexture (read as linear: the output's sRGB encode brightens the disk; no mipmaps). null where WebGL is refused.
// THE SHADOW'S EXTENT is read off the picture: the run of alpha-255 black pixels (rays that fell in) across the middle row and column,
// a centre and radius in texture units (0..1 of the side, y up); the probe (corner, sky, shadow) is what the harness reads
export function renderAccretion({ size = ACCRETION.size, pose = ACCRETION.pose, time = ACCRETION.time } = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, accretionShader())); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, size, size); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(gl.getUniformLocation(pr, 'R'), size, size); gl.uniform1f(gl.getUniformLocation(pr, 'T'), time); gl.uniform2f(gl.getUniformLocation(pr, 'C'), pose[0], pose[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const at = (x, y) => (y * size + x) * 4, dark = (k) => px[k + 3] >= 250 && px[k] < 8;
  const run = (step, k0) => { let a = -1, b = -1; for (let i = 0; i < size; i++) { const k = k0 + i * step; if (dark(k)) { if (a < 0) a = i; b = i; } } return a < 0 ? null : [a, b]; };
  const rx = run(4, at(0, size >> 1)), ry = run(size * 4, at(size >> 1, 0));
  const shadow = rx && ry ? { cx: (rx[0] + rx[1] + 1) / 2 / size, cy: (ry[0] + ry[1] + 1) / 2 / size, r: Math.max(rx[1] - rx[0], ry[1] - ry[0]) / 2 / size } : { cx: 0.5, cy: 0.5, r: 0.07 };
  const texture = new THREE.DataTexture(px, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true;   // read as linear, so the output's own sRGB encode lifts the shader's tone-mapped disk toward white: the brighter look of the first pass
  texture.userData.probe = { corner: [...px.subarray(at(2, 2), at(2, 2) + 4)], sky: [...px.subarray(at(size >> 3, (size * 7) >> 3), at(size >> 3, (size * 7) >> 3) + 4)], shadow };
  return { texture, shadow };
}

// the glow: a billboard `across` scene units wide, facing the camera wherever it goes, added to the sky; the texture is the shader's
// own, never tone-mapped twice
export function accretionSprite(texture, across) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));   // depth-tested: the planet and the heads stand before it
  s.scale.set(across, across, 1);
  return s;
}

// the shadow: an opaque black disc where the picture's rays fell in, in the sprite's own units (its centre offset from the sprite's,
// its radius), to be set at the sprite's place and turned to the camera every frame (faceShadow)
export function accretionShadow(shadow, across) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(shadow.r * across, 64), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  m.userData.offset = new THREE.Vector3((shadow.cx - 0.5) * across, (shadow.cy - 0.5) * across, 0);
  return m;
}
export function faceShadow(disc, at, camera) {
  disc.quaternion.copy(camera.quaternion);
  disc.position.copy(at).add(disc.userData.offset.clone().applyQuaternion(camera.quaternion)).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), 1);   // a hair toward the camera: in front of the glow
}
