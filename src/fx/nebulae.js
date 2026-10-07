// THE OWNER'S NEBULAE (2026-10-07: "the same method we used to represent the black hole"). Ports of his two twirling-lights pages
// (Veil Nebula: "luminous shells torn into ribbons of gas, an imagined supernova remnant"; Stellar Bloom: "spiral petals of dust
// around a bright stellar nursery"): one volume ray march of sixty-four steps through a sphere of gas, the density a scene function,
// tone-mapped in the shader as the pages are, with the settings each page was saved with (its palette, detail, density, shape, exposure,
// zoom, camera and moment). Sixty-four steps of three-dimensional noise a pixel is not a thing to run every frame under the game, so each
// is rendered ONCE (src/fx/accretion.js renderShaderStill) and hung in the game's sky as an additive plane (skyGlowPlane): black adds
// nothing, the picture fades out in a circle inside its square, and the pages' own stars are left out (the sky has its own).
import { renderShaderStill, stillTexture } from './accretion.js';

// each page's saved scene-settings, verbatim: colours, the look's knobs, the camera [yaw, pitch] and the moment (T = 20 + elapsed)
export const NEBULAE = Object.freeze({
  veil: Object.freeze({ colorA: '#15c99b', colorB: '#bcffb8', detail: 1.45, density: 0.8, morph: 2, exposure: 0.2, zoom: 1, camera: Object.freeze([-1.04845703125, 0.32603515625]), time: 67.3133, dist: 10, bound: 5.2 }),
  bloom: Object.freeze({ colorA: '#b7f5ff', colorB: '#4055e8', detail: 1.5, density: 0.3, morph: 1, exposure: 0.5, zoom: 0.5, camera: Object.freeze([0, 0.15]), time: 53.3488, dist: 11, bound: 5.5 }),
});
export const NEBULA_SIZE = 512;   // the still's side in pixels: small in the sky, a quarter of the hole's picture

const COMMON = `precision highp float;
uniform vec2 R;uniform float T;uniform vec2 C;uniform float Exposure;uniform float Zoom;uniform vec3 ColorA;uniform vec3 ColorB;uniform float Detail;uniform float Density;uniform float Morph;
float h1(float n){return fract(sin(n)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n3(vec3 x){vec3 p=floor(x),f=fract(x);f=f*f*(3.-2.*f);float n=p.x+p.y*57.+p.z*113.;
 return mix(mix(mix(h1(n),h1(n+1.),f.x),mix(h1(n+57.),h1(n+58.),f.x),f.y),
            mix(mix(h1(n+113.),h1(n+114.),f.x),mix(h1(n+170.),h1(n+171.),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
vec2 lens(){return (gl_FragCoord.xy-.5*R)/min(R.x,R.y);}
void camera(float D,out vec3 ro,out vec3 rd){
 vec2 uv=lens();
 ro=D*vec3(sin(C.x)*cos(C.y),sin(C.y),-cos(C.x)*cos(C.y));
 vec3 f=normalize(-ro),r=normalize(cross(vec3(0,1,0),f)),u=cross(f,r);
 rd=normalize(f+.9/Zoom*(uv.x*r+uv.y*u));}
float glow(vec3 ro,vec3 rd,vec3 c,float k){vec3 o=c-ro;float t=max(dot(o,rd),0.);float d=length(o-rd*t);return k/(d*d+k*.05);}
vec3 tm(vec3 c){return pow(1.-exp(-c*1.3*Exposure),vec3(.85));}
`;
const SCENES = {
  veil: `vec4 scene(vec3 p){
 p.xy*=rot(.25);p.xz*=rot(T*.008);
 float r=length(p),th=atan(p.y,p.x);
 float n=fbm(p*Detail+vec3(0.,0.,T*.025));
 float radius=2.7+.35*sin(th*(2.+Morph)+p.z*1.1)+.5*(n-.5);
 float shell=exp(-pow((r-radius)/(.09+.14*n),2.));
 float torn=smoothstep(.28,.7,n)*(.25+.75*pow(abs(sin(th*3.+p.z)),.6));
 float band=exp(-p.z*p.z/(.7+Morph*.5));
 float d=shell*torn*(.3+band)*Density;
 vec3 color=mix(ColorA,ColorB,clamp(n*1.5+.2*sin(th*2.),0.,1.));
 return vec4(color*d*3.5,d*.6);
}
vec3 bg(vec3 ro,vec3 rd){return ColorB*glow(ro,rd,vec3(0.),.0002);}
`,
  bloom: `vec4 scene(vec3 p){
 p.xy*=rot(T*.012);float r=length(p.xy),th=atan(p.y,p.x);
 float n=fbm(p*Detail+vec3(T*.02,0.,0.));
 float arms=.5+.5*cos(th*(2.+Morph)-r*2.2+p.z*.7+n*2.5);
 float disk=exp(-p.z*p.z/(.18+.14*r))*exp(-r*r/13.);
 float cavity=smoothstep(.3,1.1,r);
 float d=pow(arms,3.)*disk*cavity*(.15+n*n*2.)*Density;
 vec3 color=mix(ColorA,ColorB,smoothstep(.7,3.5,r)+.12*n);
 vec3 core=ColorA*exp(-dot(p,p)*4.)*2.;
 return vec4(color*d*2.8+core,d*.65);
}
vec3 bg(vec3 ro,vec3 rd){return ColorA*glow(ro,rd,vec3(0.),.002);}
`,
};
// the volume pass: the page's, with the picture faded out in a circle inside its square and an alpha for the clear sky round the gas
const VOL = (dist, bound) => `#define DIST ${dist.toFixed(1)}
#define RB ${bound.toFixed(1)}
#define STEPS 64
void main(){vec3 ro,rd;camera(DIST,ro,rd);vec3 col=vec3(0.);float tr=1.;
 float b=dot(ro,rd),c=dot(ro,ro)-RB*RB,q=b*b-c;
 if(q>0.){q=sqrt(q);float t0=max(-b-q,0.),t1=-b+q,dt=(t1-t0)/float(STEPS),t=t0+dt*h2(gl_FragCoord.xy);
  for(int i=0;i<STEPS;i++){vec4 s=scene(ro+rd*t);col+=tr*s.rgb*dt;tr*=exp(-s.a*dt);if(tr<.02)break;t+=dt;}}
 col+=tr*bg(ro,rd);
 col=tm(col)*(1.-smoothstep(.4,.5,length(lens())));
 gl_FragColor=vec4(col,clamp(max(max(col.r,col.g),col.b)*2.5,0.,1.));}`;

export function nebulaShader(kind) {
  const n = NEBULAE[kind]; if (!n) throw Error(`no nebula ${kind}`);
  return COMMON + SCENES[kind] + VOL(n.dist, n.bound);
}

const hex = (v) => { const n = parseInt(v.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
// the nebula rendered once with its page's settings, as a DataTexture; null where WebGL is refused
export function renderNebula(kind, size = NEBULA_SIZE) {
  const n = NEBULAE[kind];
  const px = renderShaderStill(nebulaShader(kind), size, (gl, loc) => {
    gl.uniform1f(loc('T'), n.time); gl.uniform2f(loc('C'), n.camera[0], n.camera[1]);
    gl.uniform1f(loc('Exposure'), n.exposure); gl.uniform1f(loc('Zoom'), n.zoom);
    gl.uniform3fv(loc('ColorA'), hex(n.colorA)); gl.uniform3fv(loc('ColorB'), hex(n.colorB));
    gl.uniform1f(loc('Detail'), n.detail); gl.uniform1f(loc('Density'), n.density); gl.uniform1f(loc('Morph'), n.morph);
  });
  if (!px) return null;
  const texture = stillTexture(px, size), at = (x, y) => (y * size + x) * 4;
  texture.userData.probe = { corner: [...px.subarray(at(2, 2), at(2, 2) + 4)], centre: [...px.subarray(at(size >> 1, size >> 1), at(size >> 1, size >> 1) + 4)] };
  return texture;
}
