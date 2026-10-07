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
@group(0) @binding(11) var<storage,read> wet:array<u32>;
fn header(i:u32)->vec4u {return bitcast<vec4u>(constants[i]);}
fn record(i:u32)->Record {let b=header(1).z+i*7u;return Record(constants[b],constants[b+1u],constants[b+2u],constants[b+3u],constants[b+4u],bitcast<vec4u>(constants[b+5u]),constants[b+6u]);}
struct Input {@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f,@location(3) rig:vec4f,@location(4) weights:vec4f};
struct Output {
 @builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,
 @location(2) uv:vec2f,@location(3) local:vec3f,@location(4) localNormal:vec3f,
 @location(5) @interpolate(flat) index:u32,
};
fn transformed(v:Input,index:u32)->Output {
 let object=objects[index];if((object.flags.w==9||object.flags.w==12||object.flags.w==13||object.flags.w==14)&&(work[19]&(1u<<u32(object.params.y)))!=0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,vec3f(0),v.n,index);}var p=(object.model*vec4f(v.p,1)).xyz;var n=(object.normal*vec4f(v.n,0)).xyz;var local=p;var localNormal=n;
 if(object.flags.w==9||object.flags.w==12||object.flags.w==13||object.flags.w==14){let id=u32(object.params.y);let s=propData(id);local=p-constants[s+4u].xyz;
  if(object.flags.w==12){let fill=f32(work[utilityProp(id)])/16777216.0;if(fill<.001){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}local.y-=.50*(1-min(1.0,fill));}
  if(object.flags.w==13){let angle=select(0.0,frame.camera.w*24,work[utilityProp(id)+1u]!=0u);let spin=vec4f(0,0,sin(angle*.5),cos(angle*.5));local=rotate(spin,local-vec3f(0,.14,.09))+vec3f(0,.14,.09);n=rotate(spin,n);}
  if(object.flags.w==14&&work[utilityProp(id)+1u]!=0u){local.x=fract((local.x+1.02+frame.camera.w*1.6)/2.04)*2.04-1.02;}
  p=constants[s].xyz+rotate(constants[s+1u],local);n=rotate(constants[s+1u],n);}
 else if(object.flags.w==11){if(work[1006]!=u32(object.params.y)+2u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}let angle=bitcast<f32>(work[1012]);let q=vec4f(0,sin(angle*.5),0,cos(angle*.5));p=rotate(q,p)+vec3f(bitcast<f32>(work[1009]),bitcast<f32>(work[1010]),bitcast<f32>(work[1011]));n=rotate(q,n);}
 else if(object.flags.w==10){
  if(work[1006]==0u||work[1006]>2u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}
  let angle=bitcast<f32>(work[1012]);let q=vec4f(0,sin(angle*.5),0,cos(angle*.5));
  p=rotate(q,v.p)+vec3f(bitcast<f32>(work[1009]),bitcast<f32>(work[1010]),bitcast<f32>(work[1011]));n=rotate(q,v.n);
 }
 else if(object.flags.w==5||object.flags.w==6){
  let base=u32(object.params.x);if(base>=u32(frame.settings.x)){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}
  if(v.rig.z>0&&work[fractureState(base+u32(v.rig.z)-1u)]!=0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}
  p=vec3f(0);n=vec3f(0);
  for(var k=0u;k<4u;k++){if(v.weights[k]<=0){continue;}let id=base+u32(v.rig[k]);let bind=header(3).w+id*2u;let rest=constants[bind];let q=constants[bind+1u];let inverse=vec4f(-q.xyz,q.w);let lp=rotate(inverse,v.p-rest.xyz);let ln=rotate(inverse,v.n);let body=bodies[id];p+=(rotate(body.q,lp)+body.p.xyz)*v.weights[k];n+=rotate(body.q,ln)*v.weights[k];}
  let bind=header(3).w+(base+u32(v.rig.x))*2u;let q=constants[bind+1u];local=rotate(vec4f(-q.xyz,q.w),v.p-constants[bind].xyz);localNormal=rotate(vec4f(-q.xyz,q.w),v.n);
 }
 else if(object.flags.w==3||object.flags.w==4){if(frame.local.w<.5){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}var point=vec3f(0);if(frame.goal.w>=180){let s=propData(u32(frame.goal.w)-180u);point=constants[s].xyz+rotate(constants[s+1u],frame.local.xyz);}else{let b=bodies[u32(frame.goal.w)];point=b.p.xyz+rotate(b.q,frame.local.xyz);}if(object.flags.w==3){p+=point;}else{let start=frame.camera.xyz+vec3f(.1,-.12,-.06);let delta=point-start;let direction=safeNorm(delta);let orientation=normalize(vec4f(cross(vec3f(0,1,0),direction),1+direction.y));p.y*=length(delta);p=rotate(orientation,p)+(point+start)*.5;n=rotate(orientation,n);}}
 else if(object.params.x>=0){if(object.flags.w==8&&work[fractureState(u32(object.params.y))]==0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}let id=u32(object.params.x);if(id>=u32(frame.settings.x)){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,local,localNormal,index);}let b=bodies[id];
  if(object.flags.w==1){let second=bodies[u32(object.flags.z)];let k=header(1).y+u32(object.params.y)*4u;let pa=constants[k+1u].xyz;let pb=constants[k+2u].xyz;p=rotate(b.q,p)+(b.p.xyz+rotate(b.q,pa)+second.p.xyz+rotate(second.q,pb))*.5;n=rotate(b.q,n);}
  else if(object.flags.w==2){let second=bodies[u32(object.flags.z)];let q=normalize(b.q+select(second.q,-second.q,dot(b.q,second.q)<0));p=rotate(q,p)+(b.p.xyz+second.p.xyz)*.5;n=rotate(q,n);}
  else{p=rotate(b.q,p)+b.p.xyz;n=rotate(b.q,n);}
 }
 if(object.flags.w==6){p+=safeNorm(p-frame.camera.xyz)*.004;}
 var clip=frame.vp*vec4f(p,1);if(object.flags.w==7){clip.z*=.01;}
 return Output(clip,p,safeNorm(n),v.uv,local,safeNorm(localNormal),index);
}
@vertex fn vertex(v:Input,@builtin(instance_index) index:u32)->Output {return transformed(v,index);}
fn paintAt(id:u32,p:vec2f)->vec4f {
 let r=record(id);let pos=clamp(p*r.size.zw-vec2f(.5),vec2f(0),r.size.zw-1);let a=vec2u(floor(pos));let b=min(a+1u,vec2u(r.size.zw)-1u);let weight=fract(pos);let width=u32(r.size.z);
 let c0=unpack(pigment[r.address.x+a.x+a.y*width]);let c1=unpack(pigment[r.address.x+b.x+a.y*width]);let c2=unpack(pigment[r.address.x+a.x+b.y*width]);let c3=unpack(pigment[r.address.x+b.x+b.y*width]);return mix(mix(c0,c1,weight.x),mix(c2,c3,weight.x),weight.y);
}
// Mobile thickness and the residue left as it dries, sampled across floor seams.
fn filmPixel(rec:u32,cell:vec2i)->vec2f {
 var r=record(rec);var c=cell;
 if(rec<16u&&(any(c<vec2i(0))||any(c>=vec2i(vec2f(r.u.w,r.v.w))))){
  let world=r.center.xyz+r.u.xyz*((f32(c.x)+.5)/r.u.w-.5)*r.size.x+r.v.xyz*((f32(c.y)+.5)/r.v.w-.5)*r.size.y;
  let id=u32(clamp(floor((world.z+8)/4),0,3))*4u+u32(clamp(floor((world.x+8)/4),0,3));r=record(id);let relative=world-r.center.xyz;c=vec2i(floor((vec2f(dot(relative,r.u.xyz),dot(relative,r.v.xyz))/r.size.xy+.5)*vec2f(r.u.w,r.v.w)));
 }
 c=clamp(c,vec2i(0),vec2i(vec2f(r.u.w,r.v.w))-1);let offset=header(0).z*3136u+u32(r.extra.z)+u32(c.x)+u32(c.y)*u32(r.u.w);
 return vec2f(f32(wet[offset]),f32(wet[offset+header(3).x*2u]))/65536;
}
fn filmAt(rec:u32,uv:vec2f)->vec4f {
 let r=record(rec);let pos=uv*vec2f(r.u.w,r.v.w)-.5;let a=vec2i(floor(pos));let f=fract(pos);
 let s0=filmPixel(rec,a);let s1=filmPixel(rec,a+vec2i(1,0));let s2=filmPixel(rec,a+vec2i(0,1));let s3=filmPixel(rec,a+vec2i(1,1));
 let value=mix(mix(s0,s1,f.x),mix(s2,s3,f.x),f.y);
 let gradient=vec2f(mix(s1.x-s0.x,s3.x-s2.x,f.y),mix(s2.x-s0.x,s3.x-s1.x,f.x))*vec2f(r.u.w,r.v.w)/r.size.xy;
 return vec4f(value,gradient);
}
fn skinUV(p:vec3f,n:vec3f,half:vec3f)->vec2f {
 let a=abs(n);var face:u32;var c:vec2f;var h:vec2f;
 if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=p.zy;h=half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=p.xz;h=half.xz;}else{face=select(5u,4u,n.z>0);c=p.xy;h=half.xy;}
 return (clamp(c/h*.5+.5,vec2f(.003),vec2f(.997))+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);
}
fn fresnel(f0:vec3f,cosine:f32)->vec3f {return f0+(1-f0)*pow(1-clamp(cosine,0,1),5);}
fn shade(world:vec3f,n:vec3f,albedo:vec3f,rough:f32,metal:f32,basic:bool,viewTool:bool,wetCoat:f32)->vec4f {
 var color=albedo;if(!basic){let view=safeNorm(frame.camera.xyz-world);
  let ambient=mix(vec3f(.14,.17,.18),vec3f(.28,.32,.33),n.y*.5+.5);
  color=albedo*ambient*(1-metal*.8)+laboratoryLights(world,n,view,albedo,rough,metal);
 }
 color*=.92;color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),vec3f(0),vec3f(1));return vec4f(pow(color,vec3f(1.0/2.2)),1);
}
@fragment fn fragment(v:Output,@builtin(front_facing) front:bool)->@location(0) vec4f {
 let worldDx=dpdx(v.world);let worldDy=dpdy(v.world);
 let localAA=max(max(length(dpdx(v.local)),length(dpdy(v.local)))*.45,.00006);
 let object=objects[v.index];var color=object.color.rgb;var alpha=object.color.a;var rough=object.params.w;var metal=object.flags.x;let basic=object.flags.z<0;
 if(object.flags.w==10||object.flags.w==11){let c=select(vec3f(.94,.28,.19),vec3f(.39,.91,.68),work[1008]==1u);let band=select(.65,1.0,fract(v.world.y*16)>.2);return vec4f(c*band,.63);}
 if(object.flags.w==6){if(front||dot(v.normal,frame.camera.xyz-v.world)>0){discard;}return vec4f(.065,.095,.09,1);}
 if(object.flags.w==5){
  color=vec3f(.60,.43,.24);rough=.49;
  if(v.uv.x>.1&&v.uv.x<.5){color=vec3f(.49,.35,.21);rough=.76;}
  if(v.uv.x>.5){color=vec3f(.022,.031,.032);rough=.73;}
  if(v.uv.x>1.5){color=vec3f(.36,.38,.34);rough=.38;metal=.7;
   let centers=array<f32,6>(.143,.15,.073,.179,.192,.055);let radii=array<f32,6>(.065,.043,.029,.066,.057,.039);let slot=(u32(v.uv.y+.5)-3u)%6u;let bolt=vec2f(v.local.y-centers[slot],v.local.z);let r=radii[slot];let angle=atan2(bolt.y,bolt.x);let hex=length(bolt)*cos(fract(angle/(3.14159265/3)+.5)*(3.14159265/3)-3.14159265/6);
   let recess=max(smoothstep(r*.48-localAA,r*.48+localAA,length(bolt)),1-smoothstep(r*.20-localAA,r*.20+localAA,hex));color=mix(color,vec3f(.025,.034,.033),recess);metal=mix(metal,.35,recess);
   let slotMask=(1-smoothstep(.001,.001+localAA,abs(bolt.y)))*(1-smoothstep(r*.33-localAA,r*.33+localAA,abs(bolt.x)));color*=1-slotMask*.6;
  }
  let bone=u32(v.uv.y+.5);var marker=vec2f(1);var radius=0.0;
  if(v.uv.x<.5){
   // Mold parting line, shell edge bands and recessed instrumentation screws.
   let seam=1-smoothstep(.0007,.0017+localAA,abs(v.local.z+.023));color=mix(color,vec3f(.22,.17,.10),seam*.5);
   let grainCell=vec3u(vec3i(floor(v.local*1100)));let grain=(hash(grainCell.x+grainCell.y*1973u+grainCell.z*9277u)-.5)*clamp(1-localAA*700,0,1);color*=1+grain*.025;rough+=grain*.07;
   if(bone==8u||bone==14u){color=vec3f(.029,.038,.039);rough=.48;let foot=v.local;let toeSeam=abs(foot.z-(.080+.24*foot.x*foot.x));let upper=clamp(v.localNormal.y*2,0,1);let seamMask=(1-smoothstep(.001,.002+localAA,toeSeam))*upper;color=mix(color,vec3f(.008,.013,.014),seamMask*.8);let laceZone=(1-smoothstep(.020,.024+localAA,abs(foot.x)))*(1-smoothstep(.035,.039+localAA,abs(foot.z-.015)))*upper;let lace=1-smoothstep(.001,.002+localAA,abs(fract((foot.z+.06)/.018)-.5)*.018);color=mix(color,vec3f(.095,.102,.092),laceZone*lace*.65);}
   var screw=vec2f(1);
   if(bone==0u&&v.localNormal.z>.65){screw=vec2f(abs(v.local.x)-.039,v.local.y-.156);}
   if((bone==3u||bone==9u)&&abs(v.localNormal.x)>.7){screw=vec2f(v.local.z,v.local.y+.060);}
   if((bone==7u||bone==13u)&&v.localNormal.z>.65){screw=vec2f(v.local.x,v.local.y+.103);}
   let screwMask=1-smoothstep(.005-localAA,.0055+localAA,length(screw));color=mix(color,vec3f(.025,.034,.034),screwMask);rough=mix(rough,.4,screwMask);
   if(bone==6u||bone==12u){let band=1-smoothstep(.001,.0025,abs(v.local.y-.022));color=mix(color,vec3f(.25,.19,.115),band*.6);}
   if(bone==5u||bone==11u){let sign=select(-1.0,1.0,bone==11u);let h=vec3f(cos(.55)*v.local.x-sign*sin(.55)*v.local.z,v.local.y,sign*sin(.55)*v.local.x+cos(.55)*v.local.z);if(h.z>.010&&abs(h.x)<.054&&h.y<-.057){let crease=1-smoothstep(.0005,.0013,min(abs(h.y+.073),abs(h.y+.100)));color*=1-crease*.28;}}
   if(bone==0u&&v.localNormal.z<-.65){let panel=max(abs(v.local.x)-.129,abs(v.local.y+.003)-.137);let seam=1-smoothstep(.001,.0025,abs(panel));color=mix(color,vec3f(.19,.16,.105),seam*.7);let fastener=length(vec2f(abs(v.local.x)-.108,abs(v.local.y+.003)-.116));if(fastener<.0045){color=vec3f(.04,.048,.045);}}
  }
  if(bone==2u&&abs(v.localNormal.x)>.55){marker=v.local.zy-vec2f(-.020,.048);radius=.034;}
  if(bone==0u&&v.localNormal.z>.65){marker=v.local.xy-vec2f(.085,.075);radius=.044;}
  if(radius>0){let distance=length(marker);let quadrants=smoothstep(vec2f(-localAA),vec2f(localAA),marker);let yellow=quadrants.x*quadrants.y+(1-quadrants.x)*(1-quadrants.y);var markerColor=mix(vec3f(.015,.023,.023),vec3f(.92,.67,.15),yellow);markerColor=mix(markerColor,vec3f(.014,.020,.021),smoothstep(radius-.004-localAA,radius-.004+localAA,distance));color=mix(color,markerColor,1-smoothstep(radius-localAA,radius+localAA,distance));}
 }
 if(object.flags.w==8){let radius=max(.001,length(v.local));let grain=hash(u32(abs(v.local.x)*2000)+u32(abs(v.local.z)*3000));color=mix(vec3f(.012,.020,.019),vec3f(.14,.004,.010),grain);rough=.3;metal=.18;}
 if(object.flags.w==5){let id=u32(object.params.x)+u32(v.uv.y+.5);let charred=clamp(f32(work[fractureState(id)+7u])/65536,0,.88);color=mix(color,vec3f(.019,.025,.022),charred);rough=mix(rough,.92,charred);}
 if(object.params.z>=0){let tex=textureSampleLevel(maps,linearSampler,vec2f(v.uv.x,1-v.uv.y),i32(object.params.z),0);color*=pow(tex.rgb,vec3f(2.2));alpha*=tex.a;}
 if(alpha<.02){discard;}
 var receiverID=object.params.y;
 if(object.flags.w==9||object.flags.w==12||object.flags.w==13||object.flags.w==14){let k=header(1).x+u32(object.flags.z)*5u;let local=rotate(inverseQ(constants[k+1u]),v.world-constants[k].xyz);let a=abs(local/constants[k+2u].xyz);if(a.y>a.x&&a.y>a.z){receiverID=select(constants[k+3u].w,constants[k+3u].z,local.y>0);}else if(a.x>a.z){receiverID=select(constants[k+3u].y,constants[k+3u].x,local.x>0);}else{receiverID=select(constants[k+4u].y,constants[k+4u].x,local.z>0);}
  if(constants[k].w==1&&color.r>color.b*1.5){let grain=sin(local.y*117+sin(local.x*5)*2+sin(local.z*21))*.06;let seam=step(.965,fract((local.y+.55)*5.5));color*=1+grain-seam*.35;}
  if(constants[k].w==2&&color.r>color.g*1.8&&abs(local.y)>.30&&abs(local.y)<.42){color=mix(vec3f(.035,.047,.038),vec3f(.75,.49,.10),step(.5,fract(atan2(local.z,local.x)*3+local.y*9)));}
 }
 var stain=vec4f(0);var fresh=0.0;var liquid=vec4f(0);var liquidNormal=normalize(v.normal);
 if(object.params.x>=0&&(object.flags.w==0||object.flags.w==5)){let id=u32(object.params.x)+select(0u,u32(v.uv.y+.5),object.flags.w==5);let b=bodies[id];stain=paintAt(header(0).z+id,skinUV(v.local,v.localNormal,b.half.xyz));fresh=min(b.coat.x,1);}
 else if(object.params.x<0&&receiverID>=0){
  let r=record(u32(receiverID));let d=v.world-r.center.xyz;let metres=vec2f(dot(d,r.u.xyz),dot(d,r.v.xyz));let surfaceUV=metres/r.size.xy+.5;
  stain=paintAt(u32(receiverID),surfaceUV);liquid=filmAt(u32(receiverID),surfaceUV);
  let relief=.002+.004*smoothstep(.04,.45,liquid.x);let slope=liquid.zw*min(1.0,45.0/max(length(liquid.zw),.001));
  liquidNormal=safeNorm(v.normal-(r.u.xyz*slope.x+r.v.xyz*slope.y)*relief);
  // Coarse pigment mobility must not keep an empty, dried patch glossy.
  fresh=smoothstep(.003,.10,liquid.x);
  let aa=max(abs(vec2f(dot(worldDx,r.u.xyz),dot(worldDx,r.v.xyz)))+abs(vec2f(dot(worldDy,r.u.xyz),dot(worldDy,r.v.xyz))),vec2f(.0005));
  let grain=vec2u(vec2i(floor((metres+r.size.xy*.5)*160)));let finish=(hash(grain.x+grain.y*1973u)-.5)*.026;
  color*=1+finish/(1+max(aa.x,aa.y)*160);
  if(receiverID<16){
   let grid=abs(fract((v.world.xz+8)*.5-.5)-.5)*2;let line=1-smoothstep(vec2f(.006),vec2f(.006)+aa,grid);color*=1-max(line.x,line.y)*.18;
   let edge=max(abs(v.world.x),abs(v.world.z));if(edge>7.45){color*=.60;}
   let ring=min(abs(length(v.world.xz-vec2f(-2.4,-2.95))-.68),abs(length(v.world.xz-vec2f(2.55,-2.95))-.68));
   let marking=1-smoothstep(.014,.014+max(aa.x,aa.y),ring);color=mix(color,vec3f(.85,.62,.20),marking*.8);
  }else if(object.flags.w!=9&&object.flags.w!=12&&object.flags.w!=13&&object.flags.w!=14){
   let edge=min(r.size.x*.5-abs(metres.x),r.size.y*.5-abs(metres.y));let bevel=1-smoothstep(.009,.028,edge);color=mix(color,vec3f(.12,.22,.23),bevel*.42);
   if(r.size.x>15){color=mix(vec3f(.055,.19,.21),color,smoothstep(1.16,1.18,v.world.y));}
   else if(abs(r.n.y)<.7){
    color=mix(vec3f(.12,.28,.30),color,smoothstep(.16,.18,v.world.y));
    let band=1-smoothstep(.025,.025+max(aa.x,aa.y),abs(metres.y+r.size.y*.5-.085));
    let stripe=step(.48,fract((metres.x+metres.y)*5));color=mix(color,mix(vec3f(.12,.22,.23),vec3f(.90,.59,.12),stripe),band*.85);
   }
  }
 }
 // Blood is optically dense even in a thin film. A narrow meniscus avoids the
 // airbrush halo produced by mapping thickness directly to broad transparency.
 let wallFilm=object.params.x<0&&receiverID>=16&&abs(v.normal.y)<.65;
 let mobileAlpha=smoothstep(select(.006,.018,wallFilm),select(.027,.12,wallFilm),liquid.x)*.98;let residueAlpha=smoothstep(.003,.022,liquid.y);
 let residue=vec4f(.24,.012,.025,residueAlpha*.85*mix(.25,1.0,smoothstep(.025,.60,stain.a)));stain=over(stain,residue);
 let liquidColor=mix(vec3f(.43,.021,.037),vec3f(.19,.005,.014),1-exp(-liquid.x*1.4));stain=over(stain,vec4f(liquidColor,mobileAlpha));fresh=max(fresh,smoothstep(.002,.05,liquid.x));
 color=mix(color,pow(stain.rgb,vec3f(2.2))*mix(vec3f(.66,.65,.58),vec3f(1.05,1,1),fresh),stain.a);rough=mix(rough,mix(.91,.24,fresh),smoothstep(.07,.86,stain.a));rough=mix(rough,mix(.19,.095,smoothstep(.04,.45,liquid.x)),mobileAlpha);let out=shade(v.world,normalize(mix(v.normal,liquidNormal,mobileAlpha)),color,rough,metal,basic,object.flags.w==7,max(mobileAlpha,fresh*stain.a*.6));return vec4f(out.rgb,alpha);
}
@vertex fn particleVertex(v:Input,@builtin(instance_index) i:u32)->Output {
 let p=particles[i];if(work[64u+i]==0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,0u);}let up=safeNorm(p.v.xyz);let x=safeNorm(cross(up,select(vec3f(0,1,0),vec3f(1,0,0),abs(up.y)>.95)));let z=cross(x,up);let scale=vec3f(p.p.w,p.p.w*clamp(1+length(p.v.xyz)*.21,1,2.7),p.p.w);let local=v.p*scale;let world=p.p.xyz+x*local.x+up*local.y+z*local.z;let n=safeNorm(x*v.n.x+up*v.n.y+z*v.n.z);return Output(frame.vp*vec4f(world,1),world,n,v.uv,v.p,v.n,0u);
}
@fragment fn particleFragment(v:Output)->@location(0) vec4f {return shade(v.world,v.normal,vec3f(.14,.002,.007),.22,0,false,false,1);}
