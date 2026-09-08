// Exponential map: x/z are ground arc metres, y is radial height.
export function breachPoint([x,y,z],radius){
 if(radius<=0)return [x,y,z];
 const d=Math.hypot(x,z),angle=d/radius,s=d>1e-9?Math.sin(angle)/d:1/radius;
 return [x*s*(radius+y),Math.cos(angle)*(radius+y)-radius,z*s*(radius+y)];
}
export function breachNormal([x,,z],radius){
 if(radius<=0)return [0,1,0];
 const d=Math.hypot(x,z),s=d>1e-9?Math.sin(d/radius)/d:1/radius;
 return [x*s,Math.cos(d/radius),z*s];
}
export const BREACH_SURFACE_GLSL=`
uniform float uBreachRadius;
vec3 breachWrap(vec3 p){
 if(uBreachRadius<=0.0)return p;
 float d=length(p.xz),angle=d/uBreachRadius;
 float s=d>0.000001?sin(angle)/d:1.0/uBreachRadius;
 return vec3(p.x*s*(uBreachRadius+p.y),cos(angle)*(uBreachRadius+p.y)-uBreachRadius,p.z*s*(uBreachRadius+p.y));
}
vec3 breachRotate(vec3 v,vec3 p){
 float d=length(p.xz);if(uBreachRadius<=0.0||d<0.000001)return v;
 vec3 axis=vec3(p.z,0.0,-p.x)/d;float a=d/uBreachRadius;
 return v*cos(a)+cross(axis,v)*sin(a)+axis*dot(axis,v)*(1.0-cos(a));
}
vec3 breachUnwrap(vec3 p){
 if(uBreachRadius<=0.0)return p;
 vec3 v=p+vec3(0.0,uBreachRadius,0.0);float len=length(v);
 float d=length(v.xz),arc=atan(d,v.y)*uBreachRadius;
 return vec3(d>0.000001?v.x*arc/d:(v.y<0.0?3.141592654*uBreachRadius:0.0),len-uBreachRadius,d>0.000001?v.z*arc/d:0.0);
}`;
