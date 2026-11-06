export const vertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vEye;
varying vec3 vWorld;
void main(){
  vPosition=position; vNormal=normal;
  mat3 m=mat3(modelMatrix);
  vec3 delta=cameraPosition-modelMatrix[3].xyz;
  vEye=vec3(dot(delta,m[0])/dot(m[0],m[0]),dot(delta,m[1])/dot(m[1],m[1]),dot(delta,m[2])/dot(m[2],m[2]));
  vWorld=(modelMatrix*vec4(position,1.)).xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

export const fragmentShader = `
precision highp float;
varying vec3 vPosition; varying vec3 vNormal; varying vec3 vEye; varying vec3 vWorld;
uniform vec4 uPlanes[40]; uniform int uPlaneCount;
uniform sampler2D uEnvironment;
uniform vec3 uColor; uniform float uIor; uniform float uDispersion; uniform float uRoughness; uniform float uAbsorption; uniform float uTime; uniform float uEnergy; uniform int uMode; uniform int uBounces;
uniform mat3 uWorldRotation;
vec3 env(vec3 d){
 d=normalize(uWorldRotation*d);
 vec2 uv=vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
 vec3 col=texture2D(uEnvironment,uv).rgb;
 float r=uRoughness*.075;
 col+=texture2D(uEnvironment,uv+vec2(r,r)).rgb+texture2D(uEnvironment,uv-vec2(r,r)).rgb;
 return col/3.;
}
float fresnel(float cosTheta,float ior){float f=(ior-1.)/(ior+1.);return f*f+(1.-f*f)*pow(1.-clamp(cosTheta,0.,1.),5.);}
float traceChannel(vec3 incident,vec3 normal,float ior,int channel){
 float entry=fresnel(dot(-incident,normal),ior);
 float result=env(reflect(incident,normal))[channel]*entry;
 vec3 direction=refract(incident,normal,1./ior);
 vec3 origin=vPosition+direction*.001;
 float throughput=1.-entry;
 for(int bounce=0;bounce<8;bounce++){
  if(bounce>=uBounces)break;
  float distance=1e6; vec3 hitNormal=vec3(0.,1.,0.);
  for(int i=0;i<40;i++){
   if(i>=uPlaneCount)break;
   vec3 n=uPlanes[i].xyz;float denominator=dot(n,direction);
   if(denominator>.00001){float t=-(dot(n,origin)+uPlanes[i].w)/denominator;if(t>.00001&&t<distance){distance=t;hitNormal=n;}}
  }
  if(distance>1e5)break;
  throughput*=exp(-distance*uAbsorption*(1.-uColor[channel])*.85);
  vec3 outgoing=refract(direction,-hitNormal,ior);
  float f=fresnel(dot(direction,hitNormal),ior);
  if(dot(outgoing,outgoing)>.001){result+=throughput*(1.-f)*env(outgoing)[channel];throughput*=f;}
  origin+=direction*distance;direction=reflect(direction,hitNormal);origin+=direction*.001;
  if(throughput<.005)break;
 }
 return result;
}
void main(){
 vec3 n=normalize(vNormal), incident=normalize(vPosition-vEye);vec3 color;
 if(uMode==0){
  color=vec3(traceChannel(incident,n,uIor-uDispersion*.035,0),traceChannel(incident,n,uIor,1),traceChannel(incident,n,uIor+uDispersion*.035,2));
 }else{
  float rim=pow(1.-abs(dot(-incident,n)),2.5);
  float band=pow(.5+.5*sin(vPosition.y*17.+vPosition.x*8.+sin(vPosition.z*11.)*2.-uTime*1.4),24.);
  float pulse=.75+.25*sin(uTime*1.7+vPosition.y*2.);
  vec3 reflection=env(reflect(incident,n));
  color=uColor*(.13+rim*2.5*uEnergy+band*.85*uEnergy)*pulse+reflection*.24;
 }
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
