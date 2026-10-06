// ARC Light Studies GGX fit and analytic clipped polygon integration, in WGSL.
// Heitz, Dupuy, Hill, Neubelt: Real-Time Polygonal-Light Shading with Linearly
// Transformed Cosines (SIGGRAPH 2016). See vendor/ltc/NOTICE.txt and fit.cpp.
@group(0) @binding(12) var ltcTables:texture_2d_array<f32>;
fn ltcLookup(uv:vec2f,layer:i32)->vec4f {
 let p=clamp(uv,vec2f(0),vec2f(1))*63;let a=vec2i(floor(p));let b=min(a+1,vec2i(63));let f=fract(p);
 return mix(mix(textureLoad(ltcTables,a,layer,0),textureLoad(ltcTables,vec2i(b.x,a.y),layer,0),f.x),mix(textureLoad(ltcTables,vec2i(a.x,b.y),layer,0),textureLoad(ltcTables,b,layer,0),f.x),f.y);
}
fn ltcEdge(x:vec3f,y:vec3f)->f32 {
 // Three.js MIT LTC edge fit: theta / sin(theta) / (2 PI).
 let c=clamp(dot(x,y),-1,1);let d=abs(c);
 let ratio=(.8543985+(.4965155+.0145206*d)*d)/(3.417594+(4.1616724+d)*d);
 return cross(x,y).z*select(.5*inverseSqrt(max(1-c*c,1e-7))-ratio,ratio,c>0);
}
// Each surviving edge contributes its clipped arc. The two crossings also
// define the closing horizon arc. A convex rectangle has at most one entry and
// one exit, so fixed vectors replace dynamic polygon arrays and loop indexing.
fn ltcClippedEdge(a:vec3f,b:vec3f)->vec4f {
 let ia=a.z>0;let ib=b.z>0;var x=a;var y=b;var crossing=vec3f(0);
 if(ia!=ib){crossing=mix(a,b,clamp(a.z/(a.z-b.z),0,1));if(ia){y=crossing;}else{x=crossing;}}
 var integral=0.0;if(ia||ib){integral=ltcEdge(safeNorm(x),safeNorm(y));}
 return vec4f(crossing,integral);
}
fn ltcRectangle(a:mat3x3f,p:vec3f,center:vec3f,u:vec3f,v:vec3f)->f32 {
 var p0=a*(center-u-v-p);var p1=a*(center+u-v-p);var p2=a*(center+u+v-p);var p3=a*(center-u+v-p);
 var e0=ltcClippedEdge(p0,p1);var e1=ltcClippedEdge(p1,p2);var e2=ltcClippedEdge(p2,p3);var e3=ltcClippedEdge(p3,p0);
 var entry=select(e0.xyz,vec3f(0),p0.z>0)+select(e1.xyz,vec3f(0),p1.z>0)+select(e2.xyz,vec3f(0),p2.z>0)+select(e3.xyz,vec3f(0),p3.z>0);
 var exit=select(vec3f(0),e0.xyz,p0.z>0)+select(vec3f(0),e1.xyz,p1.z>0)+select(vec3f(0),e2.xyz,p2.z>0)+select(vec3f(0),e3.xyz,p3.z>0);
 // abs already supplies the lower bound. Keep this as min: the DX12 shader
 // compiler miscompiles clamp(abs(edgeSum),0,1) for this inlined edge path.
 return min(1.0,abs(e0.w+e1.w+e2.w+e3.w+ltcEdge(safeNorm(exit),safeNorm(entry))));
}
fn ltcEmitter(basis:mat3x3f,transform:mat3x3f,p:vec3f,center:vec3f,u:vec3f,w:vec3f,emission:vec3f,diffuse:vec3f,specular:vec3f)->vec3f {
 if(dot(cross(u,w),p-center)<=0){return vec3f(0);}
 return emission*(diffuse*ltcRectangle(basis,p,center,u,w)+specular*ltcRectangle(transform,p,center,u,w));
}
fn laboratoryLights(p:vec3f,n:vec3f,v:vec3f,base:vec3f,rough:f32,metal:f32)->vec3f {
 var tangent=v-n*dot(n,v);
 if(dot(tangent,tangent)<1e-8){tangent=cross(select(vec3f(0,1,0),vec3f(1,0,0),abs(n.y)>.99),n);}
 tangent=safeNorm(tangent);let basis=transpose(mat3x3f(tangent,cross(n,tangent),n));
 let uv=vec2f(clamp(rough,.04,1),sqrt(max(0,1-clamp(dot(n,v),0,1))));
 let m=ltcLookup(uv,0);let amp=ltcLookup(uv,1).xy;
 let transform=mat3x3f(vec3f(m.x,0,m.y),vec3f(0,1,0),vec3f(m.z,0,m.w))*basis;
 let f0=mix(vec3f(.04),base,metal);let specular=f0*amp.x+(1-f0)*amp.y;
 // Same geometry as the three visible ceiling strips and five wall panels.
 let sum=ltcEmitter(basis,transform,p,vec3f(-5.000000,4.882500,0.000000),vec3f(.08,0,0),vec3f(0,0,5.85),vec3f(22,23,21),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(0.000000,4.882500,0.000000),vec3f(.08,0,0),vec3f(0,0,5.85),vec3f(22,23,21),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(5.000000,4.882500,0.000000),vec3f(.08,0,0),vec3f(0,0,5.85),vec3f(22,23,21),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(-5.800000,3.880000,-7.929000),vec3f(1.155,0,0),vec3f(0,.41,0),vec3f(3.8,5.2,5.4),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(-2.900000,3.880000,-7.929000),vec3f(1.155,0,0),vec3f(0,.41,0),vec3f(3.8,5.2,5.4),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(0.000000,3.880000,-7.929000),vec3f(1.155,0,0),vec3f(0,.41,0),vec3f(3.8,5.2,5.4),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(2.900000,3.880000,-7.929000),vec3f(1.155,0,0),vec3f(0,.41,0),vec3f(3.8,5.2,5.4),base*(1-metal)*(1-f0),specular)+
  ltcEmitter(basis,transform,p,vec3f(5.800000,3.880000,-7.929000),vec3f(1.155,0,0),vec3f(0,.41,0),vec3f(3.8,5.2,5.4),base*(1-metal)*(1-f0),specular);
 return sum*constants[header(3).z+1u].y;
}
