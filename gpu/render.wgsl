struct Object { model:mat4x4f, normal:mat4x4f, color:vec4f, params:vec4f, flags:vec4f };
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> bodies:array<Body>;
@group(0) @binding(2) var<storage,read> constants:array<vec4f>;
@group(0) @binding(3) var<storage,read> objects:array<Object>;
@group(0) @binding(4) var<storage,read> pigment:array<u32>;
@group(0) @binding(5) var<storage,read> particles:array<Particle>;
@group(0) @binding(6) var<storage,read> work:array<u32>;
@group(0) @binding(7) var maps:texture_2d_array<f32>;
@group(0) @binding(8) var linearSampler:sampler;
@group(0) @binding(9) var shadow:texture_depth_2d;
@group(0) @binding(10) var shadowSampler:sampler_comparison;
@group(0) @binding(11) var<storage,read> wet:array<u32>;
fn header(i:u32)->vec4u {return bitcast<vec4u>(constants[i]);}
fn record(i:u32)->Record {let b=header(1).z+i*7u;return Record(constants[b],constants[b+1u],constants[b+2u],constants[b+3u],constants[b+4u],bitcast<vec4u>(constants[b+5u]),constants[b+6u]);}
struct Input {@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f};
struct Output {
 @builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,
 @location(2) uv:vec2f,@location(3) local:vec3f,@location(4) localNormal:vec3f,
 @location(5) @interpolate(flat) index:u32,
};
fn transformed(v:Input,index:u32)->Output {
 let object=objects[index];var p=(object.model*vec4f(v.p,1)).xyz;var n=(object.normal*vec4f(v.n,0)).xyz;let local=p;let localNormal=n;
 if(object.flags.w>=3){if(frame.local.w<.5){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}let b=bodies[u32(frame.goal.w)];let point=b.p.xyz+rotate(b.q,frame.local.xyz);if(object.flags.w==3){p+=point;}else{let start=frame.camera.xyz+vec3f(.1,-.12,-.06);let delta=point-start;let direction=safeNorm(delta);let orientation=normalize(vec4f(cross(vec3f(0,1,0),direction),1+direction.y));p.y*=length(delta);p=rotate(orientation,p)+(point+start)*.5;n=rotate(orientation,n);}}
 else if(object.params.x>=0){let id=u32(object.params.x);if(id>=u32(frame.settings.x)){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}let b=bodies[id];
  if(object.flags.w==1){let second=bodies[u32(object.flags.z)];let k=header(1).y+u32(object.params.y)*4u;let pa=constants[k+1u].xyz;let pb=constants[k+2u].xyz;p=rotate(b.q,p)+(b.p.xyz+rotate(b.q,pa)+second.p.xyz+rotate(second.q,pb))*.5;n=rotate(b.q,n);}
  else if(object.flags.w==2){let second=bodies[u32(object.flags.z)];let q=normalize(b.q+select(second.q,-second.q,dot(b.q,second.q)<0));p=rotate(q,p)+(b.p.xyz+second.p.xyz)*.5;n=rotate(q,n);}
  else{p=rotate(b.q,p)+b.p.xyz;n=rotate(b.q,n);}
 }
 return Output(frame.vp*vec4f(p,1),p,safeNorm(n),v.uv,local,safeNorm(localNormal),index);
}
@vertex fn vertex(v:Input,@builtin(instance_index) index:u32)->Output {return transformed(v,index);}
@vertex fn shadowVertex(v:Input,@builtin(instance_index) index:u32)->@builtin(position) vec4f {
 if(objects[index].flags.y<.5||(objects[index].params.x>=0&&objects[index].params.x>=frame.settings.x)){return vec4f(0,0,2,1);}let out=transformed(v,index);return frame.lightVP*vec4f(out.world,1);
}
fn paintAt(id:u32,p:vec2f)->vec4f {
 let r=record(id);let pos=clamp(p*r.size.zw-vec2f(.5),vec2f(0),r.size.zw-1);let a=vec2u(floor(pos));let b=min(a+1u,vec2u(r.size.zw)-1u);let weight=fract(pos);let width=u32(r.size.z);
 let c0=unpack(pigment[r.address.x+a.x+a.y*width]);let c1=unpack(pigment[r.address.x+b.x+a.y*width]);let c2=unpack(pigment[r.address.x+a.x+b.y*width]);let c3=unpack(pigment[r.address.x+b.x+b.y*width]);return mix(mix(c0,c1,weight.x),mix(c2,c3,weight.x),weight.y);
}
fn skinUV(p:vec3f,n:vec3f,half:vec3f)->vec2f {
 let a=abs(n);var face:u32;var c:vec2f;var h:vec2f;
 if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=p.zy;h=half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=p.xz;h=half.xz;}else{face=select(5u,4u,n.z>0);c=p.xy;h=half.xy;}
 return (clamp(c/h*.5+.5,vec2f(.003),vec2f(.997))+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);
}
fn visibility(p:vec3f)->f32 {
 let clip=frame.lightVP*vec4f(p,1);let projected=clip.xyz/clip.w;let uv=projected.xy*vec2f(.5,-.5)+.5;if(any(uv<vec2f(0))||any(uv>vec2f(1))||projected.z>1){return 1;}var value=0.0;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){value+=textureSampleCompareLevel(shadow,shadowSampler,uv+vec2f(f32(x),f32(y))/2048.0,projected.z-.0005);}}return value/9;
}
fn fresnel(f0:vec3f,cosine:f32)->vec3f {return f0+(1-f0)*pow(1-clamp(cosine,0,1),5);}
fn light(albedo:vec3f,n:vec3f,v:vec3f,l:vec3f,rough:f32,metal:f32,radiance:vec3f)->vec3f {
 let nl=max(dot(n,l),0);let nv=max(dot(n,v),.001);let h=safeNorm(v+l);let nh=max(dot(n,h),0);let vh=max(dot(v,h),0);let a=max(.025,rough*rough);let a2=a*a;let denominator=nh*nh*(a2-1)+1;let d=a2/(3.14159265*denominator*denominator);let k=(rough+1)*(rough+1)/8;let g=nl/(nl*(1-k)+k)*nv/(nv*(1-k)+k);let f=fresnel(mix(vec3f(.04),albedo,metal),vh);return ((1-f)*(1-metal)*albedo/3.14159265+d*g*f/max(4*nl*nv,.001))*radiance*nl;
}
fn shade(world:vec3f,n:vec3f,albedo:vec3f,rough:f32,metal:f32,basic:bool)->vec4f {
 var color=albedo;if(!basic){let view=safeNorm(frame.camera.xyz-world);let sun=safeNorm(vec3f(-5,9,5));let reflected=reflect(-view,n);let sky=mix(vec3f(.14,.15,.16),vec3f(.48,.52,.57),clamp(reflected.y*.5+.5,0,1));let hemi=mix(vec3f(.42,.38,.31),vec3f(.68,.74,.83),n.y*.5+.5);
  color=albedo*hemi*.32+light(albedo,n,view,sun,rough,metal,vec3f(4.0,3.65,3.1))*visibility(world+n*.025)+light(albedo,n,view,safeNorm(vec3f(4,5,-5)),rough,metal,vec3f(1.1,1.3,1.5));
  color+=sky*fresnel(mix(vec3f(.04),albedo,metal),max(dot(n,view),0))*(1-rough*.5)*.8;
 }
 color*=.92;color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),vec3f(0),vec3f(1));return vec4f(pow(color,vec3f(1.0/2.2)),1);
}
@fragment fn fragment(v:Output)->@location(0) vec4f {
 let object=objects[v.index];var color=object.color.rgb;var alpha=object.color.a;var rough=object.params.w;let metal=object.flags.x;let basic=object.flags.z<0;
 if(object.params.z>=0){let tex=textureSampleLevel(maps,linearSampler,vec2f(v.uv.x,1-v.uv.y),i32(object.params.z),0);color*=pow(tex.rgb,vec3f(2.2));alpha*=tex.a;}
 if(alpha<.02){discard;}
 var stain=vec4f(0);var fresh=0.0;
 if(object.params.x>=0&&object.flags.w==0){let id=u32(object.params.x);let b=bodies[id];stain=paintAt(header(0).z+id,skinUV(v.local,v.localNormal,b.half.xyz));fresh=min(b.coat.x,1);}
 else if(object.params.x<0&&object.params.y>=0){let r=record(u32(object.params.y));stain=paintAt(u32(object.params.y),vec2f(v.uv.x,1-v.uv.y));let cell=vec2u(clamp(vec2f(v.uv.x,1-v.uv.y)*56,vec2f(0),vec2f(55)));fresh=1-exp(-f32(wet[u32(r.extra.y)+cell.x+cell.y*56u])/65536.0*3.5);}
 color=mix(color,pow(stain.rgb,vec3f(2.2))*mix(vec3f(.66,.65,.58),vec3f(1.05,1,1),fresh),stain.a);rough=mix(rough,mix(.85,.21,fresh),smoothstep(.07,.86,stain.a));let out=shade(v.world,normalize(v.normal),color,rough,metal,basic);return vec4f(out.rgb,alpha);
}
@vertex fn particleVertex(v:Input,@builtin(instance_index) i:u32)->Output {
 let p=particles[i];if(work[64u+i]==0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,0u);}let up=safeNorm(p.v.xyz);let x=safeNorm(cross(up,select(vec3f(0,1,0),vec3f(1,0,0),abs(up.y)>.95)));let z=cross(x,up);let scale=vec3f(p.p.w,p.p.w*clamp(1+length(p.v.xyz)*.21,1,2.7),p.p.w);let local=v.p*scale;let world=p.p.xyz+x*local.x+up*local.y+z*local.z;let n=safeNorm(x*v.n.x+up*v.n.y+z*v.n.z);return Output(frame.vp*vec4f(world,1),world,n,v.uv,v.p,v.n,0u);
}
@fragment fn particleFragment(v:Output)->@location(0) vec4f {return shade(v.world,v.normal,vec3f(.14,.002,.007),.28,0,false);}
