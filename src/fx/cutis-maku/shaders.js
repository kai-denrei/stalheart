// Ported from Jelly-Baby src/cutis/creature/shaders/membrane.{vert,frag}.glsl (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), the GLSL as strings.
// Changes from the kit: every absolute length is times SC = uRadius / 0.2 (the kit's tuning radius); iLife = [lift, deflate, opacity, spare] per instance (lift lowers the origin side only, deflate flattens to a puddle,
// opacity fades); uPlanetR bends every deformed point exactly onto a sphere (0 = flat); uHeat (the material's emissive Color) pushes the colour toward white for the FLIR; the contact shadow's shaders are here too.
// 3a985e1 (the hard cores, owner 2026-10-13): uOpacity (the membrane's own opacity, the Pearl set's .65 soft / .32 cored) and uHardRadius (a rigid core of
// that radius in body radii: the rest shape held clear of it, one transfer clock for the whole body, the shell padded to twice the core's radius round the
// synchronized centre, src/fx/cutis-maku/swarm.js getCoreContact the same centre in JS); the kit dropped the per-palette multicolour, this port keeps it.
// bendPoint is PLANET_BEND in JS (the hard cores are placed with it, so the core lands where its shell does).

/** Bend a local point (y up, the origin on the sphere's surface) onto a sphere of radius R: arc d/R, height R+y. y is written as y cos t - 2R sin^2(t/2), the same number without R-sized cancellation in float32. */
export const PLANET_BEND=`
vec3 bendToPlanet(vec3 p,float R){
  if(R<=0.)return p;
  float d=length(p.xz),t=d/R,rr=R+p.y,s=sin(t),h=sin(t*.5);
  vec2 dir=p.xz/max(d,1e-6);
  return vec3(dir.x*rr*s,p.y*cos(t)-2.*R*h*h,dir.y*rr*s);
}
`;
/** Round two (the Pearl set's projection hubs, src/fx/creature-bodies.js): a body drawn in another hub's plane is bent there and then turned about
 * the planet's centre (0, -R, 0) by its hub's quaternion q (uHubs[hub]; identity for the hub the group sits on), so one group draws bodies anywhere on
 * the sphere. The hub index rides in an existing attribute (the membrane's iState.w, the shadow's iFade's twin), not a vec4 of its own: the kit's
 * instanced attributes plus three's declared ones would pass WebGL's sixteen ("Too many attributes"). */
export const HUB_TURN=`
uniform vec4 uHubs[12];
vec3 hubTurn(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
vec3 hubPlace(vec4 q,vec3 p,float R){if(R<=0.)return p;vec3 c=vec3(0.,-R,0.);return hubTurn(q,p-c)+c;}
vec4 hubOf(float h){return uHubs[int(clamp(h,0.,11.)+.5)];}
`;
/** HUB_TURN's hubPlace in JS: the bent point (x, y, z) turned about (0, -R, 0) by q = [x, y, z, w] at q[k..k+3]; writes `out`. */
export function hubPoint(x,y,z,R,q,k=0,out=[0,0,0]) {
  if(!(R>0)){out[0]=x;out[1]=y;out[2]=z;return out;}
  const qx=q[k],qy=q[k+1],qz=q[k+2],qw=q[k+3],vx=x,vy=y+R,vz=z;
  const cx=qy*vz-qz*vy+qw*vx,cy=qz*vx-qx*vz+qw*vy,cz=qx*vy-qy*vx+qw*vz;
  out[0]=vx+2*(qy*cz-qz*cy);out[1]=vy+2*(qz*cx-qx*cz)-R;out[2]=vz+2*(qx*cy-qy*cx);return out;
}
/** PLANET_BEND in JS, the same mapping term for term: (x, y, z) local plane metres (y up) -> the point on the sphere of radius R; R <= 0 leaves it. Writes `out` (or a new array). */
export function bendPoint(x,y,z,R,out=[0,0,0]) {
  if(!(R>0)){out[0]=x;out[1]=y;out[2]=z;return out;}
  const d=Math.hypot(x,z),t=d/R,rr=R+y,s=Math.sin(t),h=Math.sin(t*.5),m=Math.max(d,1e-6);
  out[0]=x/m*rr*s;out[1]=y*Math.cos(t)-2*R*h*h;out[2]=z/m*rr*s;return out;
}

export const MEMBRANE_VERT=`
attribute vec3 iOffset;
attribute vec3 iHeading;
attribute vec3 iAnchor;
attribute vec4 iState;
#define iPhase iState.x
#define iSeed iState.y
#define iScale iState.z
attribute vec4 iParams;
attribute vec3 iProbe0,iProbe1,iProbe2;
attribute vec4 iLife;
// iState.w = hub x 16 + probe count x 4 + chosen probe (round two: the hub packed in)
#define iProbeCount floor(mod(iState.w,16.)/4.)
#define iChosenProbe mod(iState.w,4.)
#define iHub hubOf(floor(iState.w/16.))
#define SC (uRadius/.2)
uniform float uHardRadius;
uniform float uTime,uRadius,uNoise,uBreath,uRestCube,uCap,uNeck,uDelay,uCore,uForceCube,uSeekSweep,uSeekRate,uAcceleration,uPlanetR;
// round four (the Pearl set's gait): the transfer eased in and out, 0 the kit's (./config.js transferProgress, easeShare)
uniform float uEase;
varying vec3 vWorld,vRest,vHeading,vNormal;
varying float vStretch,vPhase,vSeed,vLead;
varying vec3 vLife;
${PLANET_BEND}
${HUB_TURN}
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(a),hash(a+vec3(1,0,0)),f.x),mix(hash(a+vec3(0,1,0)),hash(a+vec3(1,1,0)),f.x),f.y),mix(mix(hash(a+vec3(0,0,1)),hash(a+vec3(1,0,1)),f.x),mix(hash(a+vec3(0,1,1)),hash(a+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;}
vec3 extent4(float theta){
  vec3 extent=vec3(0.);float c=cos(theta),s=sin(theta);
  for(int i=0;i<4;i++){float x=mod(float(i),2.)*2.-1.,w=floor(float(i)/2.)*2.-1.;float xx=x*c-w*s,ww=x*s+w*c;extent=max(extent,vec3(abs(xx),1.,1.)/(2.5-ww));}
  return extent/max(max(extent.x,extent.y),extent.z);
}
vec3 orient(vec3 p){return vec3(iHeading.z*p.x+iHeading.x*p.z,p.y,-iHeading.x*p.x+iHeading.z*p.z);}
vec3 turn(vec3 p,float angle){float c=cos(angle),s=sin(angle);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec4 probeFor(vec3 n){
  vec4 probe=vec4(iProbe0,0.);float best=turn(n,-iProbe0.x).z;
  if(iProbeCount>1.5){float d=turn(n,-iProbe1.x).z;if(d>best){best=d;probe=vec4(iProbe1,1.);}}
  if(iProbeCount>2.5){float d=turn(n,-iProbe2.x).z;if(d>best)probe=vec4(iProbe2,2.);}
  return probe;
}
vec4 deform(vec3 bodyN){
  // round three: the instance's .y slots carry the room (iOffset.y), its axis (iAnchor.y) and the sweep's damping (iHeading.y); the positions are flat
  vec3 off=vec3(iOffset.x,0.,iOffset.z),head=vec3(iHeading.x,0.,iHeading.z);
  vec4 probe=probeFor(bodyN);
  vec3 n=turn(bodyN,-probe.x);

  float phase=iPhase,r=uRadius*iScale,core=mix(1.,.45,uCore);
  float transfer=clamp((phase-.62)/.23,0.,1.);
  float accelerated=pow(transfer,uAcceleration);
  if(uEase>0.)accelerated=mix(accelerated,transfer*transfer*transfer*(transfer*(transfer*6.-15.)+10.),uEase);
  float fold=sin(accelerated*3.14159265);
  vec3 extent=extent4(iSeed*.2+transfer*2.1);
  float rounded=1./pow(pow(abs(bodyN.x)/max(.4,extent.x),6.)+pow(abs(bodyN.y)/max(.4,extent.y),6.)+pow(abs(bodyN.z)/max(.4,extent.z),6.),1./6.);
  float lump=noise3(bodyN*2.6+vec3(iSeed,uTime*uBreath*.26,0.));
  float breathe=sin(uTime*uBreath*6.283+bodyN.x*2.+iSeed)*.026;
  float radius=max(.28,1.+lump*uNoise*1.7+breathe);
  // Rest attractor is deliberately subdued; only a transfer exposes the folded structure.
  float cube=max(uForceCube,uRestCube*.12+iParams.y*fold*fold);
  vec3 rest=n*max(mix(radius,rounded,cube),uHardRadius*3.6)*r;
  // Nested cross-sections share their longitudinal coordinates and centerline.
  rest.xy*=core;
  rest.y=rest.y*.82+r*.78;rest.y=max(.012*SC,rest.y);

  vec3 oldRest=rest;
  float cap=iProbeCount>1.5?min(uCap,32.):uCap;
  float lead=smoothstep(cos(radians(cap)),1.,n.z);lead*=lead;
  float seeking=clamp((phase-.10)/.45,0.,1.);
  // Advance, test sideways and briefly retract; the search fully damps before contact.
  float envelope=sin(seeking*3.14159265)*(1.-smoothstep(.78,1.,seeking));
  float wave=seeking*uSeekRate*6.283185+iSeed+probe.z;
  float extension=clamp(seeking+.12*sin(wave)*envelope,0.,1.);
  bool winner=abs(probe.w-iChosenProbe)<.5;
  if(!winner)extension*=1.-smoothstep(.55,.72,phase);
  // A deflating body draws its stalks back in (round two: iLife.y below zero is an impact's rebound, taller; the stalks are already snapped back).
  extension*=1.-clamp(iLife.y,0.,1.);
  if(phase<.1){rest.xz*=1.-.14*sin(phase/.1*3.14159265);rest.y*=1.+.06*sin(phase/.1*3.14159265);}
  vec3 extended=oldRest;
  float neck=mix(1.,uNeck,lead*extension);
  float axial=smoothstep(0.,.78,lead);
  float reach=axial*extension;
  float centerY=mix(r*.78,.045*SC,reach);
  extended.x=oldRest.x*neck;
  extended.y=centerY+(oldRest.y-r*.78)*neck;
  extended.z+=(probe.y-oldRest.z)*reach;
  // A bowed stalk survives even after searching stops; traveling bends feel
  // their way sideways, then resolve into the locked contact destination.
  float bow=sin(axial*3.14159265)*extension;
  float feel=axial*envelope;
  extended.x+=r*(1.-iHeading.y)*(.85*bow*sin(iSeed+1.2)+uSeekSweep*feel*
    (sin(wave+(1.-axial)*2.4)+.3*sin(wave*1.73+iSeed+(1.-axial)*4.)));
  extended.y+=r*(.8*bow+.35*feel*(.5+.5*sin(wave*.7+iSeed)));
  // The last cap rings flare into a rounded, shallow cup rather than a blade.
  float cup=smoothstep(.70,.78,lead);
  float cupT=clamp((lead-.78)/.22,0.,1.);
  float disk=sin(cupT*3.14159265);
  float azimuth=atan(n.y,n.x);
  float padRadius=r*.58*disk*extension;
  extended.x+=cos(azimuth)*padRadius*core;
  extended.z+=sin(azimuth)*padRadius*core;
  // Upper and lower cup surfaces have distinct heights, with a fleshy rim.
  float cupY=.018*SC+r*(.16+.12*cos(cupT*3.14159265)*core+.06*disk);
  extended.y=mix(extended.y,cupY+(oldRest.y-r*.78)*.045*core,cup*extension);
  rest=turn(rest,probe.x);extended=turn(extended,probe.x);
  vec3 p=off+orient(phase<.1?rest:extended);
  // Lift: iLife.x is the depth of the origin. The origin side is lowered by all of it, the cup by none; the stalk's reach weight interpolates.
  // The lowering is kept apart and added after the ground clamp, so the clamp cannot undo it.
  float drop=iLife.x*(phase<.1?1.:1.-reach);
  // round three: how much of the room's squeeze this point takes: the body, not its reaching stalk (whose sweep is damped instead), until it pours in
  float squeezeW=phase<.62?1.-reach:1.;
  if(phase>=.62&&phase<.85){
    vec3 chosen=iChosenProbe<.5?iProbe0:iChosenProbe<1.5?iProbe1:iProbe2;
    float delay=clamp((1.-turn(bodyN,-chosen.x).z)*.5,0.,1.)*uDelay;
    // A rigid core and its surrounding body share one transfer clock.
    // Vertex-specific delay could otherwise pull the shell away from the core.
    if(uHardRadius>0.)delay=uDelay*.5;
    float u=clamp((accelerated-delay)/max(.02,1.-uDelay),0.,1.);
    if(uEase>0.)u=mix(u,u*u*(3.-2.*u),uEase);
    vec3 end=iAnchor+orient(rest);end.y=rest.y;
    vec3 anchor=iAnchor;anchor.y=.014*SC;
    // Incoming tissue still funnels through the foothold, but its settled rim
    // must not be pulled into that point along with the traveling body.
    vec3 control=anchor;
    if(winner){
      vec3 rim=p-anchor;
      // Retain the full cup cross-section, then inflate it as mass arrives.
      // The final rest surface takes over only after the reservoir has filled.
      float deposited=u*u;
      vec3 reservoir=anchor+vec3(rim.x*(1.+2.*u),rim.y*(1.+4.*deposited),rim.z*(1.+2.*u));
      control=mix(anchor,reservoir,cup);
    }
    p=(1.-u)*(1.-u)*p+2.*(1.-u)*u*control+u*u*end;
    squeezeW=1.-reach*(1.-u);
    // Only the start of the curve is lowered; the anchor end is on the ground, so the body pours up through the cup.
    drop*=(1.-u)*(1.-u);
  }else if(phase>=.85){
    float settle=(phase-.85)/.15;
    float wobble=exp(-6.*settle)*sin(settle*22.);
    rest+=bodyN*r*.045*wobble*iParams.w;
    p=iAnchor+orient(rest);p.y=rest.y;
    p+=head*r*.12*wobble*iParams.w;
    drop=0.;
  }
  if(uHardRadius>0.){
    float bodyU=clamp((accelerated-uDelay*.5)/max(.02,1.-uDelay),0.,1.);
    if(uEase>0.)bodyU=mix(bodyU,bodyU*bodyU*(3.-2.*bodyU),uEase);
    vec3 center=mix(off,iAnchor,2.*bodyU-bodyU*bodyU);
    center.y=r*.78*((1.-bodyU)*(1.-bodyU)+bodyU*bodyU)+2.*(1.-bodyU)*bodyU*.014*SC;
    if(phase>=.85){float settle=(phase-.85)/.15;center=iAnchor+head*r*.12*exp(-6.*settle)*sin(settle*22.)*iParams.w;center.y=r*.78;}
    float lift=max(0.,r*uHardRadius*1.3+.018*SC-center.y);center.y+=lift;p.y+=lift;
    // Protect a padded volume around the synchronized core, including the
    // triangles spanning neighboring vertices as withdrawn stalks fold inward.
    vec3 delta=p-center;float distance=length(delta),shell=r*uHardRadius*2.;
    if(distance<shell)p=center+normalize(delta+vec3(0.,.000001*SC,0.))*shell;
  }
  p.y=max(.009*SC,p.y);
  // Deflate: a puddle. Heights shrink toward the ground, the footprint spreads about the body's centre. Round two (the ram's stagger and the touch's
  // recoil, src/fx/creature-pearl.js): the same squash, signed: an impact flattens the body, then its rebound (below zero) stands it taller and narrower.
  float squash=iLife.y;
  if(squash!=0.){
    vec2 centre=mix(iOffset.xz,iAnchor.xz,phase<.62?0.:phase<.85?accelerated:1.);
    // round three: a puddle (or a squash) spreads only as far as the body's room lets it (iOffset.y over its footprint; 0 unmeasured)
    float spread=1.+.6*squash;if(iOffset.y>0.&&squash>0.)spread=min(spread,max(1.,iOffset.y));
    p.xz=centre+(p.xz-centre)*spread;
    p.y=.009*SC+(p.y-.009*SC)*(1.-.92*squash);
  }
  // Round three (owner, 2026-10-13: "there is still some clipping of the Cutis-Pearl through the walls"): a body with less open ground round it than its
  // footprint (iOffset.y, the room over BODY_RADII r; 0 unmeasured) is squeezed across the nearest wall (iAnchor.y, the axis's angle) about its centre,
  // so a body wider than its corridor stays off the rock (its stalks are not squeezed:
  // squeezed along an axis that is not square to them, a long stalk's tip would swing sideways).
  if(iOffset.y>0.){
    // and square to it by iParams.z, the room that way (a bend or a corner closing in on a body squeezed in its corridor; 0 unmeasured)
    float k=min(1.,iOffset.y),k2=iParams.z>0.?min(1.,iParams.z):1.;
    if(k<1.){vec2 ax=vec2(cos(iAnchor.y),sin(iAnchor.y)),pe=vec2(-ax.y,ax.x),c=mix(iOffset.xz,iAnchor.xz,phase<.62?0.:phase<.85?accelerated:1.),d=p.xz-c;p.xz-=(ax*dot(d,ax)*(1.-k)+pe*dot(d,pe)*(1.-k2))*squeezeW;}
  }
  p.y+=drop;
  float stretch=1.+lead*extension*probe.y/max(.01*SC,r)*(1.-smoothstep(.66,.85,phase))+fold*2.;
  return vec4(bendToPlanet(p,uPlanetR),stretch);
}
void main(){
  vec3 n=normalize(position),axis=abs(n.y)<.95?vec3(0,1,0):vec3(1,0,0);
  vec3 tangent=normalize(cross(axis,n)),bitangent=cross(n,tangent);
  vec4 p=deform(n);
  vec3 a=deform(normalize(n+tangent*.012)).xyz-p.xyz,b=deform(normalize(n+bitangent*.012)).xyz-p.xyz;
  vec3 normal=hubTurn(iHub,cross(a,b));vNormal=dot(normal,normal)>1e-14*SC*SC*SC*SC?normalize(mat3(modelMatrix)*normal):vec3(0,1,0);
  p.xyz=hubPlace(iHub,p.xyz,uPlanetR);
  vWorld=(modelMatrix*vec4(p.xyz,1.)).xyz;
  vRest=n;vHeading=iHeading;vLead=pow(smoothstep(cos(radians(iProbeCount>1.5?min(uCap,32.):uCap)),1.,turn(n,-probeFor(n).x).z),2.);vSeed=iSeed;vPhase=iPhase;vStretch=p.w;vLife=iLife.yzw;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p.xyz,1.);
}
`;

export const MEMBRANE_FRAG=`
uniform float uTime,uPulse,uVeinWidth,uCore,uDebug,uLow;
uniform vec3 uSkin,uVein,uGlow;
uniform vec3 uHeat;
uniform float uOpacity;
uniform float uMulticolored;
uniform vec3 uPaletteSkin[7],uPaletteVein[7],uPaletteGlow[7];
varying vec3 vWorld,vRest,vHeading,vNormal;
varying float vStretch,vPhase,vSeed,vLead;
varying vec3 vLife;
vec3 hash3(vec3 p){return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453);}
float veinField(vec3 p){
  vec3 cell=floor(p),f=fract(p);float first=10.,second=10.;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 g=vec3(float(x),float(y),float(z));vec3 q=g+hash3(cell+g)-f;float d=dot(q,q);
    if(d<first){second=first;first=d;}else if(d<second)second=d;
  }
  return sqrt(second)-sqrt(first);
}
void main(){
  // Stable per-creature seed keeps the palette unchanged across hops and LODs.
  int palette=int(mod(floor(vSeed*17.),7.));
  vec3 skin=uMulticolored>.5?uPaletteSkin[palette]:uSkin;
  vec3 veinTint=uMulticolored>.5?uPaletteVein[palette]:uVein;
  vec3 glow=uMulticolored>.5?uPaletteGlow[palette]:uGlow;
  vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
  vec3 V=normalize(cameraPosition-vWorld),L=normalize(vec3(-.5,1.,.7));
  float rim=pow(1.-abs(dot(N,V)),3.);
  float thick=1./vStretch;
  vec3 warped=vRest*7.2+sin(vRest.yzx*7.+sin(vRest.zxy*11.)*.5+vSeed)*.48+vSeed;
  float field=uCore>.5?1.:veinField(warped);
  float vein=1.-smoothstep(uVeinWidth/sqrt(vStretch),uVeinWidth/sqrt(vStretch)+.023,field);
  float fine=uLow>.5||uCore>.5?0.:(1.-smoothstep(.025,.065,veinField(warped*2.1)))*.32;
  vein=max(vein,fine);
  float pulse=pow(.5+.5*sin(vRest.z*9.-uTime*uPulse*(vPhase>=.62?-1.:1.)),7.);
  float gate=vPhase<.1?1.:vPhase<.55?.12:vPhase<.62?1.:vPhase<.85?.6:.08;
  pulse=max(pulse,step(.55,vPhase)*(1.-step(.62,vPhase))*vLead);
  vec3 veinColor=mix(skin*.78,veinTint,thick);
  vec3 color=mix(skin,veinColor,vein*mix(.5,.94,thick));
  if(uLow<.5)N=normalize(N+vec3(dFdx(field),dFdy(field),0.)*.14);
  float diffuse=max(0.,(dot(N,L)+.45)/1.45);
  float back=pow(max(0.,dot(V,-L)),3.)*(1.-thick);
  float spec=pow(max(0.,dot(N,normalize(L+V))),100.);
  color*=.12+diffuse*.45;color+=skin*back*.32+vec3(1.,.91,.8)*spec*.95+rim*.17;
  vec3 reflected=reflect(-V,N);
  float window=pow(max(0.,dot(reflected,normalize(vec3(-.4,1.,.7)))),32.);
  color+=vec3(.85,.93,1.)*window*.9+glow*pulse*gate*vein*.7;
  float alpha=(mix(.25,.85,thick)+rim*.19)*(gl_FrontFacing?.75:.4);
  // A puddle is a thin skin: let the dark core show through.
  if(uCore<.5)alpha*=mix(1.,.7,max(0.,vLife.x));
  if(uCore<.5)alpha*=uOpacity;
  if(uCore>.5){vec3 coreTint=min(veinTint,skin*.45);color=mix(coreTint*.28,coreTint*.9,diffuse)+glow*pulse*.06;alpha=1.;}
  if(uDebug>.5&&uDebug<1.5){color=vPhase<.1?vec3(.9,.65,.2):vPhase<.55?vec3(.3,.7,.8):vPhase<.62?vec3(.95,.3,.2):vPhase<.85?vec3(.7,.35,.9):vec3(.45,.8,.4);alpha=.9;}
  if(uDebug>1.5){color=mix(vec3(.1,.3,.8),vec3(1.,.2,.05),clamp((vStretch-1.)/5.,0.,1.));alpha=.95;}
  // Round two (the fable review: the slow tower's ice was lost on these bodies): iLife.w, the body's tint toward ice (0x8fd4ff) at its own brightness,
  // as the dot cloud turns ice for the slow's duration.
  color=mix(color,vec3(.56,.83,1.)*(.3+.7*max(max(color.r,color.g),color.b)),clamp(vLife.z,0.,1.)*.8);
  // Thermal: the FLIR lerps the material's emissive toward white; the colour follows, the skin thickens a little.
  float heat=clamp(uHeat.r,0.,1.);
  color=mix(color,vec3(1.),heat);alpha=min(1.,alpha+heat*.25);
  gl_FragColor=vec4(color,clamp(alpha,0.,1.)*vLife.y);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The contact shadow: one flat plane per instance (matrix = place and size), bent onto the planet like the body, faded by iFade.
export const SHADOW_VERT=`
attribute float iFade;
attribute float iHubIndex;
uniform float uPlanetR;
varying vec2 vUv;
varying float vFade;
${PLANET_BEND}
${HUB_TURN}
void main(){
  vUv=uv;vFade=iFade;
  vec3 local=(instanceMatrix*vec4(position,1.)).xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(hubPlace(hubOf(iHubIndex),bendToPlanet(local,uPlanetR),uPlanetR),1.);
}
`;

export const SHADOW_FRAG=`
varying vec2 vUv;
varying float vFade;
void main(){
  float r=length(vUv-.5)*2.;
  gl_FragColor=vec4(.015,.019,.014,(1.-smoothstep(.1,1.,r))*.42*vFade);
}
`;
