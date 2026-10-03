@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read_write> bodies:array<Body>;
@group(0) @binding(2) var<storage,read> constants:array<vec4f>;
@group(0) @binding(3) var<storage,read_write> particles:array<Particle>;
@group(0) @binding(4) var<storage,read_write> stamps:array<Stamp>;
@group(0) @binding(5) var<storage,read_write> pigment:array<u32>;
@group(0) @binding(6) var<storage,read_write> work:array<atomic<u32>>;
@group(0) @binding(7) var<storage,read_write> wet:array<atomic<u32>>;
@group(0) @binding(8) var brush:texture_2d_array<f32>;
@group(0) @binding(9) var brushSampler:sampler;
fn header(i:u32)->vec4u { return bitcast<vec4u>(constants[i]); }
fn record(i:u32)->Record { let b=header(1).z+i*7u;return Record(constants[b],constants[b+1u],constants[b+2u],constants[b+3u],constants[b+4u],bitcast<vec4u>(constants[b+5u]),constants[b+6u]); }
fn uv(r:Record,p:vec3f)->vec2f { let d=p-r.center.xyz;return vec2f(dot(d,r.u.xyz)/r.size.x+.5,dot(d,r.v.xyz)/r.size.y+.5); }
fn floorRecord(p:vec3f)->u32 { return u32(clamp(floor((p.z+8)/4),0,3))*4u+u32(clamp(floor((p.x+8)/4),0,3)); }
fn wetCell(r:Record,p:vec2f)->u32 { let c=vec2u(clamp(p*56.0,vec2f(0),vec2f(55)));return u32(r.extra.y)+c.x+c.y*56u; }
fn takeWet(cell:u32,wanted:u32)->u32 {
 var old=atomicLoad(&wet[cell]);loop{let amount=min(old,wanted);let result=atomicCompareExchangeWeak(&wet[cell],old,old-amount);if(result.exchanged){return amount;}old=result.old_value;}
}
fn addWet(cell:u32,amount:u32) {
 var old=atomicLoad(&wet[cell]);loop{let result=atomicCompareExchangeWeak(&wet[cell],old,min(131072u,old+amount));if(result.exchanged){return;}old=result.old_value;}
}
fn stamp(id:u32,a:vec2f,b:vec2f,radius:vec2f,amount:f32,kind:f32,pattern:f32,angle:f32) {
 if(amount<.002||id>=header(0).w){return;}let i=atomicAdd(&work[3],1u);if(i>=8192u){atomicAdd(&work[4],1u);return;}
 stamps[i]=Stamp(vec4f(a,radius),vec4f(b,angle,amount),vec4f(.42,.024,.056,amount),vec4f(f32(id),kind,pattern,0));
}
fn splat(id:u32,p:vec3f,r:f32,amount:f32,seed:u32) {
 let s=record(id);let c=uv(s,p);let radius=vec2f(r)/s.size.xy;
 // Floor events cross record edges; every affected original-resolution tile receives them.
 if(id<16u){let lo=vec2u(clamp(floor((p.xz-vec2f(r*2)+8)/4),vec2f(0),vec2f(3)));let hi=vec2u(clamp(floor((p.xz+vec2f(r*2)+8)/4),vec2f(0),vec2f(3)));for(var z=lo.y;z<=hi.y;z++){for(var x=lo.x;x<=hi.x;x++){let rec=z*4u+x;let other=record(rec);let point=uv(other,p);stamp(rec,point,point,vec2f(r)/other.size.xy,amount,0,f32(seed%18u),hash(seed)*6.283185);}}}
 else{stamp(id,c,c,radius,amount,0,f32(seed%18u),hash(seed)*6.283185);}
 let lo=vec2u(clamp(floor((c-radius)*56),vec2f(0),vec2f(55)));let hi=vec2u(clamp(ceil((c+radius)*56),vec2f(0),vec2f(55)));for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){let d=(vec2f(f32(x)+.5,f32(y)+.5)/56-c)/max(radius,vec2f(.001));if(dot(d,d)<1){addWet(u32(s.extra.y)+x+y*56u,u32(amount*(1-dot(d,d))*.55*65536));}}}
}
@compute @workgroup_size(1) fn bootstrap() {
 splat(floorRecord(vec3f(.06,0,.12)),vec3f(.06,0,.12),.48,.92,17u);splat(floorRecord(vec3f(-.25,0,.57)),vec3f(-.25,0,.57),.35,.85,31u);
 if(frame.action.x==1){for(var i=0u;i<16u;i++){let rec=16u+i%4u;let r=record(rec);let c=vec2f(.15+hash(i+971u)*.7,.38+hash(i+31u)*.24);let p=r.center.xyz+r.u.xyz*((c.x-.5)*r.size.x)+r.v.xyz*((c.y-.5)*r.size.y);splat(rec,p,.15+hash(i+712u)*.18,.7,i*79u);}for(var i=0u;i<8u;i++){let p=vec3f((hash(i+7u)-.5)*12,0,(hash(i+91u)-.5)*12);splat(floorRecord(p),p,.18+hash(i+103u)*.25,.8,i*101u);}}
}
fn emit(p:vec3f,v:vec3f,r:f32,owner:u32) {
 let start=atomicAdd(&work[8],1u)%900u;
 for(var n=0u;n<900u;n++){let i=(start+n)%900u;let result=atomicCompareExchangeWeak(&work[64u+i],0u,1u);if(result.exchanged){particles[i]=Particle(vec4f(p,r),vec4f(v,0),vec4f(p,f32(owner)),vec4f(0));atomicAdd(&work[9],1u);return;}}
}
fn sample(b:Body,i:u32)->vec4f { switch i { case 0u:{return b.s0;}case 1u:{return b.s1;}case 2u:{return b.s2;}default:{return b.s3;} } }
fn skinPoint(b:Body,p:vec3f,n:vec3f)->vec2f {
 let a=abs(n);var face:u32;var c:vec2f;var half:vec2f;if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=p.zy;half=b.half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=p.xz;half=b.half.xz;}else{face=select(5u,4u,n.z>0);c=p.xy;half=b.half.xy;}return (clamp(c/half*.5+.5,vec2f(.01),vec2f(.99))+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);
}
fn worldContact(b:Body)->Body {
 var out=b;
 for(var si=0u;si<u32(b.half.w);si++){
  let s=sample(out,si);var p=rotate(out.q,s.xyz)+out.p.xyz;var n=vec3f(0,1,0);var point=vec3f(p.x,0,p.z);var depth=s.w-p.y;
  if(depth>0){let r=point-out.p.xyz;let lambda=min(depth,.08)/(eff(out,r,n)+1e-5);out.p=vec4f(out.p.xyz+n*lambda*out.p.w,out.p.w);out.q=rotateStep(out.q,invWorld(out,cross(r,n)*lambda));}
  for(var j=0u;j<header(0).x;j++){
   let offset=header(1).x+j*5u;let bp=constants[offset].xyz;let bq=constants[offset+1u];let half=constants[offset+2u].xyz;
   let local=rotate(inverseQ(bq),p-bp);if(any(abs(local)>half+vec3f(s.w+.02))){continue;}
   var closest=clamp(local,-half,half);var d=local-closest;let len=length(d);depth=s.w-len;
   if(len>1e-7){n=d/len;}else{let gaps=half-abs(local);if(gaps.x<gaps.y&&gaps.x<gaps.z){n=vec3f(select(-1.0,1.0,local.x>=0),0,0);depth=s.w+gaps.x;closest.x=n.x*half.x;}else if(gaps.y<gaps.z){n=vec3f(0,select(-1.0,1.0,local.y>=0),0);depth=s.w+gaps.y;closest.y=n.y*half.y;}else{n=vec3f(0,0,select(-1.0,1.0,local.z>=0));depth=s.w+gaps.z;closest.z=n.z*half.z;}}
   if(depth<=0){continue;}n=rotate(bq,n);point=rotate(bq,closest)+bp;let r=point-out.p.xyz;let lambda=min(depth,.08)/(eff(out,r,n)+1e-5);out.p=vec4f(out.p.xyz+n*lambda*out.p.w,out.p.w);out.q=rotateStep(out.q,invWorld(out,cross(r,n)*lambda));
  }
 }return out;
}
var<workgroup> localBodies:array<Body,15>;
fn navFree(p:vec3f)->bool {
 if(abs(p.x)>7.1||abs(p.z)>7.1){return false;}for(var j=0u;j<header(0).x;j++){let k=header(1).x+j*5u;let h=constants[k+2u].xyz;let center=constants[k].xyz;if(h.y>2||center.y-h.y>1.9){continue;}let local=rotate(inverseQ(constants[k+1u]),p-center);if(abs(local.x)<h.x+.48&&abs(local.z)<h.z+.48){return false;}}return true;
}
fn bounded(v:vec3f,limit:f32)->vec3f {return v*min(1.0,limit/max(length(v),1e-7));}
fn poseMotor(b:Body,index:u32)->Body {
 var out=b;if(b.motor.w<.5){return out;}let offset=header(3).w+index*2u;let rest=constants[offset].xyz;let root=vec3f(b.motor.x,0,b.motor.z);let yaw=b.motor.y;let q=vec4f(0,sin(yaw*.5),0,cos(yaw*.5));var goal=root+rotate(q,rest);var orientation=quatMul(q,constants[offset+1u]);let phase=frame.camera.w*4.2+f32(index/15u)*2;let walk=select(0.0,1.0,b.motor.w>1.5&&distance(b.nav.xz,b.motor.xz)>.2&&(u32(frame.settings.w)&1u)!=0u);let lane=index%15u;
 if(lane>=3u){let side=select(-1.0,1.0,lane>=9u);let member=(lane-3u)%6u;let swing=sin(phase+select(0.0,3.141593,side>0));if(member>=3u){goal+=rotate(q,vec3f(0,max(0,swing)*select(.014,.06,member==5u)*walk,swing*.09*walk));}else{goal+=rotate(q,vec3f(0,0,-swing*.055*walk));}}
 var error=quatMul(orientation,inverseQ(b.q));if(error.w<0){error=-error;}let angle=2*atan2(length(error.xyz),error.w);let axis=safeNorm(error.xyz);let strength=frame.rayO.w*select(.32,1.0,b.motor.w>1.5);let acceleration=bounded((goal-b.p.xyz)*select(48.0,95.0,b.motor.w>1.5)-b.v.xyz*14,40)*strength;out.v=vec4f(b.v.xyz+(acceleration+vec3f(0,9.81,0))/120,0);out.w=vec4f(b.w.xyz+bounded(axis*angle*62-b.w.xyz*12,70)*strength/120,0);return out;
}
fn correct(i:u32,n:vec3f,lambda:f32,r:vec3f) { var b=localBodies[i];if(b.status.x<.5){return;}b.p=vec4f(b.p.xyz+n*lambda*b.p.w,b.p.w);b.q=rotateStep(b.q,invWorld(b,cross(r,n)*lambda));localBodies[i]=b; }
fn joint(base:u32,j:u32,angles:bool) {
 let offset=header(1).y+j*4u;let h=constants[offset];let ai=u32(h.x)-base;let bi=u32(h.y)-base;var a=localBodies[ai];var b=localBodies[bi];if(a.status.x<.5&&b.status.x<.5){return;}
 let pa=constants[offset+1u];let pb=constants[offset+2u];let rest=constants[offset+3u];
 let ra=rotate(a.q,pa.xyz);let rb=rotate(b.q,pb.xyz);let error=b.p.xyz+rb-a.p.xyz-ra;let d=length(error);
 if(d>1e-7){let n=error/d;let lambda=min(d,.12)/(eff(a,ra,n)+eff(b,rb,n)+.00004);correct(ai,n,lambda,ra);correct(bi,n,-lambda,rb);}
 if(!angles){return;}a=localBodies[ai];b=localBodies[bi];let rel=quatMul(inverseQ(a.q),b.q);var e=quatMul(rel,inverseQ(rest));if(e.w<0){e=-e;}
 var desired:vec4f;if(h.z>.5){let angle=clamp(2*atan2(e.x,e.w),pa.w,pb.w);desired=quatMul(vec4f(sin(angle*.5),0,0,cos(angle*.5)),rest);}else{let angle=2*acos(clamp(e.w,-1,1));if(angle<=h.w){return;}desired=quatMul(vec4f(safeNorm(e.xyz)*sin(h.w*.5),cos(h.w*.5)),rest);}
 var delta=quatMul(quatMul(a.q,desired),inverseQ(b.q));if(delta.w<0){delta=-delta;}var angle=2*acos(clamp(delta.w,-1,1));if(angle<.0003){return;}let axis=safeNorm(delta.xyz);let ia=select(0.0,dot(axis,invWorld(a,axis)),a.status.x>.5);let ib=select(0.0,dot(axis,invWorld(b,axis)),b.status.x>.5);angle=min(angle*.42,.22);a.q=rotateStep(a.q,axis*(-angle*ia/(ia+ib+.00001)));b.q=rotateStep(b.q,axis*(angle*ib/(ia+ib+.00001)));localBodies[ai]=a;localBodies[bi]=b;
}
@compute @workgroup_size(16) fn physics(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32) {
 let base=group.x*15u;let dt=1.0/120.0;
 if(lane<15u){var b=bodies[base+lane];if(base+lane<u32(frame.settings.x)){
  if(frame.action.x==1){b.status.x=1;b.motor.w=0;b.blood.x=max(b.blood.x,select(.08,.85,lane<3u));b.v=vec4f((vec3f(hash(base+lane+4u),hash(base+lane+51u),hash(base+lane+97u))-.5)*vec3f(4,5,4),0);b.w=vec4f((vec3f(hash(base+lane+25u),hash(base+lane+71u),hash(base+lane+138u))-.5)*8,0);}
  if(frame.local.w>.5&&u32(frame.goal.w)/15u==group.x){b.status.x=1;b.motor.w=0;b.status.z=0;}
 }localBodies[lane]=b;}
 workgroupBarrier();
 if(lane==0u){var hip=localBodies[1];var health=100.0;for(var k=0u;k<15u;k++){health=min(health,localBodies[k].blood.w);}let held=frame.local.w>.5&&u32(frame.goal.w)/15u==group.x;
  if(hip.motor.w<.5){hip.status.z=select(0.0,hip.status.z+dt,length(hip.v.xyz)<.8&&!held);if(hip.status.z>8&&health>25&&(u32(frame.settings.w)&2u)!=0u&&navFree(vec3f(hip.p.x,0,hip.p.z))){hip.motor=vec4f(hip.p.x,0,hip.p.z,1);hip.nav=vec4f(hip.p.x,0,hip.p.z,frame.camera.w+4);}}
  else if(hip.motor.w<1.5){if(frame.camera.w>hip.nav.w){hip.motor.w=2;}}
  else if((u32(frame.settings.w)&1u)!=0u&&!held){let delta=hip.nav.xz-hip.motor.xz;let distance=length(delta);if(distance<.2&&frame.camera.w>hip.nav.w){for(var attempt=0u;attempt<12u;attempt++){let seed=base+u32(frame.camera.w*120)+attempt*97u;let goal=vec3f(hip.motor.x,0,hip.motor.z)+vec3f(hash(seed)-.5,0,hash(seed+29u)-.5)*4;var clear=navFree(goal);for(var n=1u;n<8u;n++){clear=clear&&navFree(mix(vec3f(hip.motor.x,0,hip.motor.z),goal,f32(n)/8));}if(clear){hip.nav=vec4f(goal,frame.camera.w+.4);break;}}}else if(distance>.2&&frame.camera.w>hip.nav.w){let direction=delta/max(distance,.001);let next=vec3f(hip.motor.x,0,hip.motor.z)+vec3f(direction.x,0,direction.y)*dt*.35;if(navFree(next)){hip.motor.xz=next.xz;hip.motor.y=atan2(direction.x,direction.y);}else{hip.nav.xz=hip.motor.xz;hip.nav.w=frame.camera.w+1;}}}
  for(var k=0u;k<15u;k++){localBodies[k].motor=hip.motor;localBodies[k].nav=hip.nav;localBodies[k].status.z=hip.status.z;}
 }workgroupBarrier();
 if(lane<15u){var b=localBodies[lane];b.prevP=b.p;b.prevQ=b.q;if(b.status.x>.5){b=poseMotor(b,base+lane);b.v.y-=9.81*dt;b.v=vec4f(bounded(b.v.xyz*exp(-.075*dt),21),0);b.w=vec4f(bounded(b.w.xyz*exp(-.36*dt),26),0);b.p=vec4f(b.p.xyz+b.v.xyz*dt,b.p.w);b.q=rotateStep(b.q,b.w.xyz*dt);}localBodies[lane]=b;}workgroupBarrier();
 for(var it=0u;it<9u;it++){
  if(lane==0u){for(var j=group.x*14u;j<(group.x+1u)*14u;j++){joint(base,j,(it&1u)==0u);}
   if(frame.local.w>.5&&u32(frame.goal.w)/15u==group.x){let i=u32(frame.goal.w)%15u;let b=localBodies[i];let r=rotate(b.q,frame.local.xyz);let error=frame.goal.xyz-(b.p.xyz+r);let d=length(error);if(d>1e-7){let n=error/d;correct(i,n,min(d,.15)*.86/(eff(b,r,n)+.00008/max(frame.tune.x,.05)),r);}let flags=u32(frame.settings.w);if((flags&12u)!=0u){localBodies[i].q=rotateStep(localBodies[i].q,vec3f(0,select(-.008,.008,(flags&8u)!=0u),0));}}
  }workgroupBarrier();if(lane<15u&&localBodies[lane].status.x>.5){localBodies[lane]=worldContact(localBodies[lane]);}workgroupBarrier();
 }
 if(lane<15u){var b=localBodies[lane];let index=base+lane;
  if(b.status.x>.5){b.v=vec4f((b.p.xyz-b.prevP.xyz)/dt,0);var dq=quatMul(b.q,inverseQ(b.prevQ));if(dq.w<0){dq=-dq;}let l=length(dq.xyz);b.w=vec4f(dq.xyz*(2*atan2(l,dq.w)/(max(l,1e-8)*dt)),0);
   for(var si=0u;si<u32(b.half.w);si++){let s=sample(b,si);let p=rotate(b.q,s.xyz)+b.p.xyz;if(p.y<s.w+.015){b.v.y=max(b.v.y,0);b.v.xz*=exp(-1.8*dt);}}
  }
  b.blood.y+=dt*max(.05,b.blood.x)*frame.action.z;b.blood.z=max(0,b.blood.z-dt);b.coat.y=max(0,b.coat.y-dt);b.coat.x=max(0,b.coat.x-dt*2.3/frame.tune.w);
  let contact=rotate(b.q,b.s0.xyz)+b.p.xyz;var receiver:i32=-1;var p=vec3f(contact.x,0,contact.z);
  if(contact.y<b.s0.w+.02){receiver=i32(floorRecord(p));}
  for(var j=16u;j<header(0).z;j++){let r=record(j);let distance=dot(contact-r.center.xyz,r.n.xyz);let point=contact-r.n.xyz*distance;let c=uv(r,point);if(distance>-.025&&distance<b.s0.w+.02&&all(c>=vec2f(0))&&all(c<=vec2f(1))){receiver=i32(j);p=point;break;}}
  if(receiver>=0&&b.status.x>.5){let rec=u32(receiver);let r=record(rec);let c=uv(r,p);let cell=wetCell(r,c);let pickup=f32(takeWet(cell,u32(dt*.85*frame.tune.z*65536)))/65536.0;b.coat.x=min(1.65,b.coat.x+pickup);
   let abrasion=length(b.v.xyz)*select(.001,.018,frame.local.w>.5&&u32(frame.goal.w)/15u==group.x)*frame.rayD.w;if(abrasion>.03&&b.coat.y<=0){b.blood.x=min(2.0,b.blood.x+abrasion*.3);b.blood.w=max(0,b.blood.w-abrasion*.2);b.coat.y=.18;}
   if(b.coat.x>.004){let previous=select(p,b.track.xyz,b.track.w==f32(rec)+1);let travel=length(p-previous);if(travel>.0007){let a=uv(r,previous);let radius=vec2f(b.half.x*.72,b.half.z*.72)/r.size.xy;if(rec<16u){for(var k=0u;k<16u;k++){let other=record(k);let start=uv(other,previous);let end=uv(other,p);if(all(max(start,end)+radius>=vec2f(0))&&all(min(start,end)-radius<=vec2f(1))){stamp(k,start,end,radius,min(b.coat.x*frame.tune.y,1.65),1,f32(index%256u),atan2(b.v.z,b.v.x));}}}else{stamp(rec,a,c,radius,min(b.coat.x*frame.tune.y,1.65),1,f32(index%256u),atan2(dot(b.v.xyz,r.v.xyz),dot(b.v.xyz,r.u.xyz)));}b.coat.x=max(0,b.coat.x-travel*.035);}b.track=vec4f(p,f32(rec)+1);atomicMax(&wet[cell],u32(b.coat.x*.28*65536));}
  }else{b.track.w=0;}
  if(b.blood.x>.001&&b.blood.y>.035&&b.coat.w>0){b.blood.y=0;b.coat.w=max(0,b.coat.w-.002*b.blood.x);let seed=index*199u+atomicLoad(&work[5]);let p=b.p.xyz+rotate(b.q,vec3f(0,0,b.half.z));emit(p,b.v.xyz*.25+rotate(b.q,vec3f((hash(seed)-.5)*1.6,.4+hash(seed+1u)*1.8,.5+hash(seed+2u))),.006+hash(seed+3u)*.010,index);b.coat.x=min(1.65,b.coat.x+.01*b.blood.x);}
  if(b.coat.x>.005&&(b.blood.z<=0||frame.action.x==1)){b.blood.z=.22;let rec=header(0).z+index;for(var face=0u;face<6u;face++){let c=vec2f((f32(face%3u)+.5)/3,(f32(face/3u)+.5)/2);stamp(rec,c,c,vec2f(.10,.18),min(b.coat.x*.42,.5),0,f32((index+face*3u)%18u),hash(index+face)*6.283185);}}
  bodies[index]=b;
 }if(lane==0u&&group.x==0u){atomicAdd(&work[5],1u);}
}
@compute @workgroup_size(64) fn pairs(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=u32(frame.settings.x)){return;}let a=bodies[i];var correction=vec3f(0);var angular=vec3f(0);if(a.status.x>.5){for(var j=0u;j<u32(frame.settings.x);j++){if(j==i){continue;}let b=bodies[j];if(i/15u==j/15u&&(bitcast<u32>(a.status.w)&(1u<<(j%15u)))!=0u){continue;}if(distance(a.p.xyz,b.p.xyz)>a.invI.w+b.invI.w){continue;}for(var si=0u;si<u32(a.half.w);si++){let s=sample(a,si);let p=a.p.xyz+rotate(a.q,s.xyz);for(var sj=0u;sj<u32(b.half.w);sj++){let t=sample(b,sj);let other=b.p.xyz+rotate(b.q,t.xyz);let delta=p-other;let d=length(delta);let pen=s.w+t.w-d;if(pen>0&&d>1e-7){let n=delta/d;let r=p-a.p.xyz;let e=eff(a,r,n)+eff(b,other-b.p.xyz,n)+1e-5;let lambda=min(pen,.05)/e*.45;correction+=n*lambda*a.p.w;angular+=invWorld(a,cross(r,n)*lambda);}}}}}let scratch=header(2).w+header(2).x*128u+i*8u;for(var k=0u;k<3u;k++){atomicStore(&work[scratch+k],bitcast<u32>(correction[k]));atomicStore(&work[scratch+4u+k],bitcast<u32>(angular[k]));}
}
@compute @workgroup_size(64) fn applyPairs(@builtin(global_invocation_id) id:vec3u) { let i=id.x;if(i>=u32(frame.settings.x)){return;}var b=bodies[i];let scratch=header(2).w+header(2).x*128u+i*8u;var correction:vec3f;var angular:vec3f;for(var k=0u;k<3u;k++){correction[k]=bitcast<f32>(atomicLoad(&work[scratch+k]));angular[k]=bitcast<f32>(atomicLoad(&work[scratch+4u+k]));}b.p=vec4f(b.p.xyz+correction,b.p.w);b.q=rotateStep(b.q,angular);bodies[i]=b; }
struct RayHit { t:f32, p:vec3f, n:vec3f, surface:i32, body:i32 };
fn rayHit(o:vec3f,d:vec3f,limit:f32,includeBodies:bool,ignoreBody:i32)->RayHit {
 var hit=RayHit(limit, o+d*limit,vec3f(0,1,0),-1,-1);
 if(d.y<-.00001){let t=-o.y/d.y;if(t>=0&&t<hit.t){let p=o+d*t;if(abs(p.x)<8&&abs(p.z)<8){hit=RayHit(t,p,vec3f(0,1,0),i32(floorRecord(p)),-1);}}}
 for(var j=0u;j<header(0).x;j++){let k=header(1).x+j*5u;let q=constants[k+1u];let p=rotate(inverseQ(q),o-constants[k].xyz);let v=rotate(inverseQ(q),d);let h=constants[k+2u].xyz;let inv=1.0/select(vec3f(.0000001),v,abs(v)>vec3f(.0000001));let a=(-h-p)*inv;let b=(h-p)*inv;let low=min(a,b);let high=max(a,b);let entry=max(max(low.x,low.y),low.z);let exit=min(min(high.x,high.y),high.z);if(entry<0||entry>exit||entry>=hit.t){continue;}let point=p+v*entry;let axis=abs(point/h);var n:vec3f;var face:i32;if(axis.x>axis.y&&axis.x>axis.z){n=vec3f(select(-1.0,1.0,point.x>0),0,0);face=i32(select(constants[k+3u].y,constants[k+3u].x,point.x>0));}else if(axis.y>axis.z){n=vec3f(0,select(-1.0,1.0,point.y>0),0);face=i32(select(constants[k+3u].w,constants[k+3u].z,point.y>0));}else{n=vec3f(0,0,select(-1.0,1.0,point.z>0));face=i32(select(constants[k+4u].y,constants[k+4u].x,point.z>0));}hit=RayHit(entry,o+d*entry,rotate(q,n),face,-1);}
 if(includeBodies){for(var i=0u;i<u32(frame.settings.x);i++){if(i32(i)==ignoreBody){continue;}let b=bodies[i];for(var j=0u;j<u32(b.half.w);j++){let s=sample(b,j);let center=b.p.xyz+rotate(b.q,s.xyz);let offset=o-center;let projection=dot(offset,d);let disc=projection*projection-dot(offset,offset)+s.w*s.w;if(disc<0){continue;}let t=-projection-sqrt(disc);if(t>0&&t<hit.t){let p=o+d*t;hit=RayHit(t,p,safeNorm(p-center),-1,i32(i));}}}}return hit;
}
@compute @workgroup_size(1) fn interaction() {
 if(frame.action.y<.5){return;}let hit=rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),35,true,-1);atomicStore(&work[6],bitcast<u32>(hit.body));atomicStore(&work[7],bitcast<u32>(hit.t));atomicStore(&work[10],bitcast<u32>(hit.p.x));atomicStore(&work[11],bitcast<u32>(hit.p.y));atomicStore(&work[12],bitcast<u32>(hit.p.z));
 if(hit.body>=0){let i=u32(hit.body);var b=bodies[i];let local=rotate(inverseQ(b.q),hit.p-b.p.xyz);for(var k=0u;k<3u;k++){atomicStore(&work[13u+k],bitcast<u32>(local[k]));}
  if(frame.action.y==2){for(var k=i/15u*15u;k<(i/15u+1u)*15u;k++){bodies[k].status.x=1;bodies[k].motor.w=0;bodies[k].status.z=0;}b=bodies[i];b.v=vec4f(b.v.xyz+frame.rayD.xyz*(14*frame.action.w)*b.p.w,b.v.w);b.w=vec4f(b.w.xyz+invWorld(b,cross(hit.p-b.p.xyz,frame.rayD.xyz*(14*frame.action.w))),0);b.blood.x=min(2,b.blood.x+1.3);b.coat.x=min(1.65,b.coat.x+.7);b.blood.w=max(0,b.blood.w-34*frame.rayD.w);bodies[i]=b;atomicAdd(&work[16],1u);for(var k=0u;k<65u;k++){let h=i*971u+k*179u+atomicLoad(&work[5]);emit(hit.p+hit.n*.02,b.v.xyz*.22+hit.n*(.7+hash(h)*3)+vec3f((hash(h+1u)-.5)*3,hash(h+2u)*2,(hash(h+3u)-.5)*3),.005+hash(h+4u)*.013,i);}}
  if(frame.action.y==2||frame.action.y==3){if(frame.action.y==3){b.coat.x=min(1.65,b.coat.x+.12);bodies[i]=b;}let c=skinPoint(b,local,rotate(inverseQ(b.q),hit.n));stamp(header(0).z+i,c,c,vec2f(.07,.12),.75,0,f32(i%18u),0);}
 }else if(hit.surface>=0){if(frame.action.y==3){let r=record(u32(hit.surface));splat(u32(hit.surface),hit.p,.32,1,atomicLoad(&work[5]));let c=uv(r,hit.p);atomicMax(&wet[wetCell(r,c)],50000u);for(var k=0u;k<10u;k++){let h=k*37u+atomicLoad(&work[5]);emit(hit.p+hit.n*.03,hit.n*(.5+hash(h)*1.2)+vec3f((hash(h+1u)-.5)*2,hash(h+2u)*1.8,(hash(h+3u)-.5)*2),.008+hash(h+4u)*.01,999u);}}}
}
@compute @workgroup_size(64) fn droplets(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=900u||atomicLoad(&work[64u+i])==0u){return;}var p=particles[i];let dt=1.0/120.0;p.previous.xyz=p.p.xyz;p.v.y-=9.81*dt;p.v=vec4f(p.v.xyz*exp(-.08*dt),p.v.w+dt);p.p=vec4f(p.p.xyz+p.v.xyz*dt,p.p.w);let delta=p.p.xyz-p.previous.xyz;let length=length(delta);let h=rayHit(p.previous.xyz,safeNorm(delta),length,true,select(-1,i32(p.previous.w),p.v.w<.22));
 if(h.t<length){if(h.surface>=0){splat(u32(h.surface),h.p,max(.018,p.p.w*3),.7,i+atomicLoad(&work[5]));let r=record(u32(h.surface));atomicMax(&wet[wetCell(r,uv(r,h.p))],12000u);}else if(h.body>=0){let b=bodies[u32(h.body)];let local=rotate(inverseQ(b.q),h.p-b.p.xyz);let n=rotate(inverseQ(b.q),h.n);let a=abs(n);var face:u32;var c:vec2f;var half:vec2f;if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=local.zy;half=b.half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=local.xz;half=b.half.xz;}else{face=select(5u,4u,n.z>0);c=local.xy;half=b.half.xy;}let point=(c/half*.5+.5+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);stamp(header(0).z+u32(h.body),point,point,vec2f(.045,.065),.55,0,f32(i%18u),0);}
  atomicStore(&work[64u+i],0u);atomicSub(&work[9],1u);atomicAdd(&work[17],1u);
 }else if(p.v.w>7||p.p.y<-.15){atomicStore(&work[64u+i],0u);atomicSub(&work[9],1u);}particles[i]=p;
}
@compute @workgroup_size(64) fn dry(@builtin(global_invocation_id) id:vec3u) { if(id.x>=header(0).z*3136u){return;}let old=atomicLoad(&wet[id.x]);atomicStore(&wet[id.x],u32(f32(old)*exp(-2.3/(120*frame.tune.w)))); }
@compute @workgroup_size(64) fn flow(@builtin(global_invocation_id) id:vec3u) {
 if(id.x>=header(0).z*3136u){return;}let rec=id.x/3136u;let r=record(rec);if(abs(r.n.y)>.2||r.v.y>-.8){return;}
 let cell=id.x%3136u;let x=cell%56u;let y=cell/56u;if(y>=55u){return;}let old=atomicLoad(&wet[id.x]);let supply=f32(old)/65536.0;if(supply<.13){return;}
 let col=.35+.65*hash(rec*991u+x*31u);let amount=min(supply*.46,max(0,supply-.12)*(.24+col*.24)/28);if(amount<.0008){return;}
 let passed=f32(takeWet(id.x,u32(amount*65536)))/65536.0;addWet(id.x+56u,u32(passed*.92*65536));
 let a=vec2f(f32(x)+.5,f32(y)+.22)/56;let b=vec2f(a.x+(hash(cell*17u)-.5)*min(.028,r.size.x*.008)/r.size.x,(f32(y)+1.8)/56);
 stamp(rec,a,b,vec2f(max(.55,(.6+passed*8)*r.size.z/r.size.x)/r.size.z,.002),min(1.0,passed*9),2,f32(cell+rec*131u),0);
 if(y>52u&&passed>.038&&hash(cell*97u+rec)>.79){let point=r.center.xyz+r.u.xyz*((b.x-.5)*r.size.x)+r.v.xyz*((b.y-.5)*r.size.y);emit(point+r.n.xyz*.012,r.v.xyz*.25+r.n.xyz*.04,.006,999u);}
}
@compute @workgroup_size(64) fn control(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=u32(frame.settings.x)){return;}var b=bodies[i];
 if(frame.action.x==2){b.coat.x=0;b.track.w=0;}
 if(frame.action.x==3){b.blood=vec4f(0,0,0,100);b.coat.w=9;b.status.z=9;b.coat.x=0;b.track.w=0;}
 if(frame.action.x==4){b.blood.x=0;}
 bodies[i]=b;
}
@compute @workgroup_size(1) fn telemetry() {
 var activeBodies=0u;var wounds=0u;var scraping=0.0;for(var i=0u;i<u32(frame.settings.x);i++){let b=bodies[i];if(b.status.x>.5){activeBodies++;}if(b.blood.x>.001){wounds++;}if(b.track.w>0){scraping=max(scraping,min(1.0,length(b.v.xyz)*b.coat.x*.2));}}
 atomicStore(&work[20],activeBodies);atomicStore(&work[21],wounds);atomicStore(&work[22],bitcast<u32>(scraping));
}
@compute @workgroup_size(64) fn bin(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=min(8192u,atomicLoad(&work[3]))){return;}let s=stamps[i];let r=record(u32(s.info.x));let pad=s.a.zw*2.3+vec2f(3)/r.size.zw;let a=vec2u(clamp(floor((min(s.a.xy,s.b.xy)-pad)*r.size.zw/16),vec2f(0),vec2f(r.address.zw)-1));let b=vec2u(clamp(floor((max(s.a.xy,s.b.xy)+pad)*r.size.zw/16),vec2f(0),vec2f(r.address.zw)-1));let h=header(2);
 for(var y=a.y;y<=b.y;y++){for(var x=a.x;x<=b.x;x++){let tile=r.address.y+x+y*r.address.z;let n=atomicAdd(&work[h.y+tile],1u);if(n==0u){let activeIndex=atomicAdd(&work[0],1u);atomicStore(&work[h.z+activeIndex],tile);}if(n<128u){atomicStore(&work[h.w+tile*128u+n],i);}else{atomicAdd(&work[18],1u);}}}
}
var<workgroup> indices:array<u32,128>;
fn coverage(s:Stamp,point:vec2f)->vec4f {
 let r=record(u32(s.info.x));let p=point/r.size.zw;let radius=max(s.a.zw,vec2f(.0001));var alpha=0.0;var color=vec3f(.42,.025,.06);
 if(s.info.y==1){let seed=u32(s.info.z);let c=cos(s.b.z);let sn=sin(s.b.z);
  for(var j=0u;j<54u;j++){let h=hash(seed*113u+j*977u);let h2=hash(seed*337u+j*199u);let h3=hash(seed*41u+j*57u);let h4=hash(seed*617u+j*521u);let h5=hash(seed*181u+j*881u);if(h4<.10+max(0,.16-s.b.w*.08)){continue;}let angle=h*6.283185;let rr=sqrt(h2)*.98;let fringe=1-rr*.68;let o=vec2f(cos(angle),sin(angle))*rr*radius;let offset=vec2f(o.x*c-o.y*sn,o.x*sn+o.y*c);let a=s.a.xy+offset;let b=s.b.xy+offset;let direction=(b-a)*r.size.zw;let relative=(p-a)*r.size.zw;let t=clamp(dot(relative,direction)/max(dot(direction,direction),1e-8),0,1);let distance=length(relative-direction*t);let core=j==0u||j==7u||j==21u||j==33u;let avgRadius=dot(radius*r.size.xy,vec2f(.5));let travel=length((s.b.xy-s.a.xy)*r.size.xy);let breakup=.5+.5*sin(travel*(29+h*28)+f32(j)*2.3+f32(seed)*.7);let physicalWidth=select(clamp(avgRadius*(.055+h3*.20)*fringe,.0025,.040),clamp(avgRadius*(.33+h3*.42)*1.05*(.62+.42*pow(sin(travel*(15+h5*6)+f32(j)),2)),.010,.12),core);let width=max(.5,physicalWidth*r.size.z/r.size.x)*.5;let strength=clamp(select(.10+h3*.26,.68+h3*.24,core)*s.b.w*fringe*(.42+breakup*.72),.006,.96);let cov=clamp(width+.65-distance,0,1)*strength;alpha=alpha+cov*(1-alpha);}
 }else if(s.info.y==2){let direction=(s.b.xy-s.a.xy)*r.size.zw;let relative=(p-s.a.xy)*r.size.zw;let t=clamp(dot(relative,direction)/max(dot(direction,direction),1e-8),0,1);alpha=clamp(s.a.z*r.size.z+.65-length(relative-direction*t),0,1)*s.b.w;}
 else{let q=(p-s.a.xy)/radius;let c=cos(s.b.z);let sn=sin(s.b.z);let t=vec2f(q.x*c+q.y*sn,-q.x*sn+q.y*c)*.5+.5;if(all(t>=vec2f(0))&&all(t<=vec2f(1))){let tex=textureSampleLevel(brush,brushSampler,t,i32(u32(s.info.z)%18u),0);alpha=tex.a*min(s.b.w,1);color=tex.rgb;}}
 return vec4f(color,alpha);
}
@compute @workgroup_size(8,8) fn paint(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_id) local:vec3u,@builtin(local_invocation_index) lane:u32) {
 let h=header(2);let tile=atomicLoad(&work[h.z+group.x]);let count=atomicLoad(&work[h.y+tile]);let n=min(count,128u);
 for(var j=lane;j<n;j+=64u){indices[j]=atomicLoad(&work[h.w+tile*128u+j]);}workgroupBarrier();
 if(lane==0u){for(var i=1u;i<n;i++){let value=indices[i];var j=i;loop{if(j==0u||indices[j-1u]<=value){break;}indices[j]=indices[j-1u];j--;}indices[j]=value;}}workgroupBarrier();
 var rec=0u;for(var i=0u;i<header(0).w;i++){let r=record(i);if(tile>=r.address.y&&tile<r.address.y+r.address.z*r.address.w){rec=i;break;}}
 let r=record(rec);let t=tile-r.address.y;let origin=vec2u(t%r.address.z,t/r.address.z)*16u;
 for(var y=0u;y<2u;y++){for(var x=0u;x<2u;x++){let pos=origin+local.xy+vec2u(x,y)*8u;if(any(pos>=vec2u(r.size.zw))){continue;}let offset=r.address.x+pos.x+pos.y*u32(r.size.z);var value=unpack(pigment[offset]);let total=select(n,min(8192u,atomicLoad(&work[3])),count>128u);
  for(var j=0u;j<total;j++){let index=select(indices[min(j,127u)],j,count>128u);let s=stamps[index];if(u32(s.info.x)!=rec){continue;}let source=coverage(s,vec2f(pos)+.5);if(source.a>0){value=over(value,source);}}
  pigment[offset]=pack(value);
 }}
}
