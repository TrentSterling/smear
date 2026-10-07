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
@group(0) @binding(10) var<storage,read_write> paintBefore:array<u32>;
fn header(i:u32)->vec4u { return bitcast<vec4u>(constants[i]); }
fn record(i:u32)->Record { let b=header(1).z+i*7u;return Record(constants[b],constants[b+1u],constants[b+2u],constants[b+3u],constants[b+4u],bitcast<vec4u>(constants[b+5u]),constants[b+6u]); }
fn uv(r:Record,p:vec3f)->vec2f { let d=p-r.center.xyz;return vec2f(dot(d,r.u.xyz)/r.size.x+.5,dot(d,r.v.xyz)/r.size.y+.5); }
fn floorRecord(p:vec3f)->u32 { return u32(clamp(floor((p.z+8)/4),0,3))*4u+u32(clamp(floor((p.x+8)/4),0,3)); }
fn wetCell(r:Record,p:vec2f)->u32 { let c=vec2u(clamp(p*56.0,vec2f(0),vec2f(55)));return u32(r.extra.y)+c.x+c.y*56u; }
fn takeWet(cell:u32,wanted:u32)->u32 {
 var old=atomicLoad(&wet[cell]);var amount=0u;loop{amount=min(old,wanted);let result=atomicCompareExchangeWeak(&wet[cell],old,old-amount);if(result.exchanged){break;}old=result.old_value;}return amount;
}
fn addWet(cell:u32,amount:u32) {
 var old=atomicLoad(&wet[cell]);loop{let result=atomicCompareExchangeWeak(&wet[cell],old,min(131072u,old+amount));if(result.exchanged){return;}old=result.old_value;}
}
fn stamp(id:u32,a:vec2f,b:vec2f,radius:vec2f,amount:f32,kind:f32,pattern:f32,angle:f32) {
 if(amount<.002||id>=header(0).w){return;}let i=atomicAdd(&work[3],1u);if(i>=8192u){atomicAdd(&work[4],1u);return;}
 stamps[i]=Stamp(vec4f(a,radius),vec4f(b,angle,amount),vec4f(.42,.024,.056,amount),vec4f(f32(id),kind,pattern,0));
}
fn splatKind(id:u32,p:vec3f,r:f32,amount:f32,seed:u32,kind:f32) {
 let s=record(id);let c=uv(s,p);let radius=vec2f(r)/s.size.xy;
 // Floor events cross record edges; every affected original-resolution tile receives them.
 if(id<16u){let lo=vec2u(clamp(floor((p.xz-vec2f(r*2)+8)/4),vec2f(0),vec2f(3)));let hi=vec2u(clamp(floor((p.xz+vec2f(r*2)+8)/4),vec2f(0),vec2f(3)));for(var z=lo.y;z<=hi.y;z++){for(var x=lo.x;x<=hi.x;x++){let rec=z*4u+x;let other=record(rec);let point=uv(other,p);stamp(rec,point,point,vec2f(r)/other.size.xy,amount,kind,f32(seed%18u),hash(seed)*6.283185);}}}
 else{stamp(id,c,c,radius,amount,kind,f32(seed%18u),hash(seed)*6.283185);}
 if(kind==5||kind>=9){return;}
 let lo=vec2u(clamp(floor((c-radius)*56),vec2f(0),vec2f(55)));let hi=vec2u(clamp(ceil((c+radius)*56),vec2f(0),vec2f(55)));for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){let d=(vec2f(f32(x)+.5,f32(y)+.5)/56-c)/max(radius,vec2f(.001));if(dot(d,d)<1){addWet(u32(s.extra.y)+x+y*56u,u32(amount*(1-dot(d,d))*.55*65536));}}}
}
fn splat(id:u32,p:vec3f,r:f32,amount:f32,seed:u32){splatKind(id,p,r,amount,seed,0);}
@compute @workgroup_size(1) fn bootstrap() {
 splat(floorRecord(vec3f(.06,0,.12)),vec3f(.06,0,.12),.48,.92,17u);splat(floorRecord(vec3f(-.25,0,.57)),vec3f(-.25,0,.57),.35,.85,31u);
 if(frame.action.x==1){for(var i=0u;i<16u;i++){let rec=16u+i%4u;let r=record(rec);let c=vec2f(.15+hash(i+971u)*.7,.38+hash(i+31u)*.24);let p=r.center.xyz+r.u.xyz*((c.x-.5)*r.size.x)+r.v.xyz*((c.y-.5)*r.size.y);splat(rec,p,.15+hash(i+712u)*.18,.7,i*79u);}for(var i=0u;i<8u;i++){let p=vec3f((hash(i+7u)-.5)*12,0,(hash(i+91u)-.5)*12);splat(floorRecord(p),p,.18+hash(i+103u)*.25,.8,i*101u);}}
}
fn launchDrop(p:vec3f,v:vec3f,r:f32,owner:u32,volume:f32)->bool {
 // No frees occur in an emission dispatch. Reject saturation before probing
 // occupied slots, especially when many severed sockets emit in one blast.
 if(atomicLoad(&work[9])>=900u){return false;}
 let start=atomicAdd(&work[8],1u)%900u;
 for(var n=0u;n<900u;n++){if((n&15u)==0u&&atomicLoad(&work[9])>=900u){return false;}let i=(start+n)%900u;if(atomicLoad(&work[64u+i])!=0u){continue;}let result=atomicCompareExchangeWeak(&work[64u+i],0u,1u);if(result.exchanged){particles[i]=Particle(vec4f(p,r),vec4f(v,0),vec4f(p,f32(owner)),vec4f(volume,0,0,0));atomicAdd(&work[9],1u);return true;}}
 return false;
}
fn emit(p:vec3f,v:vec3f,r:f32,owner:u32){launchDrop(p,v,r,owner,0);}
fn sample(b:Body,i:u32)->vec4f { switch i { case 0u:{return b.s0;}case 1u:{return b.s1;}case 2u:{return b.s2;}default:{return b.s3;} } }
fn skinPoint(b:Body,p:vec3f,n:vec3f)->vec2f {
 let a=abs(n);var face:u32;var c:vec2f;var half:vec2f;if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=p.zy;half=b.half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=p.xz;half=b.half.xz;}else{face=select(5u,4u,n.z>0);c=p.xy;half=b.half.xy;}return (clamp(c/half*.5+.5,vec2f(.01),vec2f(.99))+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);
}
// Remember a real collision while solving. A rebounding part need not still
// touch the same receiver when the final brush footprint is evaluated.
struct WorldImpact { point:vec3f, closing:f32, normal:vec3f, radius:f32, velocity:vec3f, receiver:i32 };
var<workgroup> worldImpacts:array<WorldImpact,15>;
fn rememberImpact(lane:u32,b:Body,point:vec3f,n:vec3f,radius:f32,receiver:i32) {
 if(receiver<0){return;}
 let velocity=b.v.xyz+cross(b.w.xyz,point-b.prevP.xyz);
 let closing=max(0,-dot(velocity,n));
 if(worldImpacts[lane].receiver<0||closing>worldImpacts[lane].closing){worldImpacts[lane]=WorldImpact(point,closing,n,radius,velocity,receiver);}
}
fn worldContact(b:Body,lane:u32)->Body {
 var out=b;
 for(var si=0u;si<u32(b.half.w);si++){
  let s=sample(out,si);var p=rotate(out.q,s.xyz)+out.p.xyz;var n=vec3f(0,1,0);var point=vec3f(p.x,0,p.z);var depth=s.w-p.y;
  if(depth>0){rememberImpact(lane,b,point,n,s.w,i32(floorRecord(point)));let r=point-out.p.xyz;let lambda=min(depth,.08)/(eff(out,r,n)+1e-5);out.p=vec4f(out.p.xyz+n*lambda*out.p.w,out.p.w);out.q=rotateStep(out.q,invWorld(out,cross(r,n)*lambda));}
  for(var j=0u;j<header(0).x;j++){
   let offset=header(1).x+j*5u;let bp=constants[offset].xyz;let bq=constants[offset+1u];let half=constants[offset+2u].xyz;
   let local=rotate(inverseQ(bq),p-bp);if(any(abs(local)>half+vec3f(s.w+.02))){continue;}
   var closest=clamp(local,-half,half);var d=local-closest;let len=length(d);depth=s.w-len;
   if(len>1e-7){n=d/len;}else{let gaps=half-abs(local);if(gaps.x<gaps.y&&gaps.x<gaps.z){n=vec3f(select(-1.0,1.0,local.x>=0),0,0);depth=s.w+gaps.x;closest.x=n.x*half.x;}else if(gaps.y<gaps.z){n=vec3f(0,select(-1.0,1.0,local.y>=0),0);depth=s.w+gaps.y;closest.y=n.y*half.y;}else{n=vec3f(0,0,select(-1.0,1.0,local.z>=0));depth=s.w+gaps.z;closest.z=n.z*half.z;}}
   if(depth<=0){continue;}
   let axis=abs(n);var receiver:i32;
   if(axis.x>axis.y&&axis.x>axis.z){receiver=i32(select(constants[offset+3u].y,constants[offset+3u].x,n.x>0));}
   else if(axis.y>axis.z){receiver=i32(select(constants[offset+3u].w,constants[offset+3u].z,n.y>0));}
   else{receiver=i32(select(constants[offset+4u].y,constants[offset+4u].x,n.z>0));}
   n=rotate(bq,n);point=rotate(bq,closest)+bp;rememberImpact(lane,b,point,n,s.w,receiver);
   let r=point-out.p.xyz;let lambda=min(depth,.08)/(eff(out,r,n)+1e-5);out.p=vec4f(out.p.xyz+n*lambda*out.p.w,out.p.w);out.q=rotateStep(out.q,invWorld(out,cross(r,n)*lambda));
  }
 }return out;
}
var<workgroup> localBodies:array<Body,15>;
fn navFree(p:vec3f)->bool {
 if(abs(p.x)>7.1||abs(p.z)>7.1){return false;}for(var j=0u;j<header(0).x;j++){let k=header(1).x+j*5u;let h=constants[k+2u].xyz;let center=constants[k].xyz;if(h.y>2||center.y-h.y>1.9){continue;}let local=rotate(inverseQ(constants[k+1u]),p-center);if(abs(local.x)<h.x+.48&&abs(local.z)<h.z+.48){return false;}}return true;
}
fn bounded(v:vec3f,limit:f32)->vec3f {return v*min(1.0,limit/max(length(v),1e-7));}
fn yawQ(angle:f32)->vec4f {return vec4f(0,sin(angle*.5),0,cos(angle*.5));}
fn pitchQ(angle:f32)->vec4f {return vec4f(sin(angle*.5),0,0,cos(angle*.5));}
fn angleDelta(a:f32,b:f32)->f32 {return atan2(sin(a-b),cos(a-b));}
fn fromTo(a:vec3f,b:vec3f)->vec4f {return normalize(vec4f(cross(a,b),max(.00001,1+dot(a,b))));}
fn blendQ(a:vec4f,b:vec4f,t:f32)->vec4f {return normalize(mix(a,select(b,-b,dot(a,b)<0),t));}
fn recoveryRollTime(angle:f32)->f32 {return select(0.0,max(.65,abs(angle)*1.45/3.141593),abs(angle)>.001);}
// All targets share the real joint anchors. Stance feet stay fixed in world space.
fn childTarget(base:u32,j:u32,q:vec4f) {
 let k=header(1).y+j*4u;let h=constants[k];let a=localBodies[u32(h.x)-base];let i=u32(h.y)-base;
 localBodies[i].targetQ=q;localBodies[i].targetP=vec4f(a.targetP.xyz+rotate(a.targetQ,constants[k+1u].xyz)-rotate(q,constants[k+2u].xyz),1);
}
fn legTarget(base:u32,side:u32,q:vec4f) {
 let first=header(1).y+(base/15u*14u+5u+side*6u)*4u;
 let hip=localBodies[1];let thigh=6u+side*6u;let shin=thigh+1u;let foot=thigh+2u;let f=localBodies[foot];
 let start=hip.targetP.xyz+rotate(hip.targetQ,constants[first+1u].xyz);
 let end=f.targetP.xyz+rotate(f.targetQ,constants[first+10u].xyz);
 let la=constants[first+5u].xyz-constants[first+2u].xyz;let lb=constants[first+9u].xyz-constants[first+6u].xyz;
 let l1=length(la);let l2=length(lb);let direction=safeNorm(end-start);let distance=clamp(length(end-start),.035,l1+l2-.0015);
 let forward=rotate(q,vec3f(0,0,1));let bend=safeNorm(forward-direction*dot(forward,direction));
 let along=(l1*l1-l2*l2+distance*distance)/(2*distance);let knee=start+direction*along+bend*sqrt(max(0,l1*l1-along*along));let ankle=start+direction*distance;
 let qa=quatMul(q,fromTo(safeNorm(la),rotate(inverseQ(q),safeNorm(knee-start))));let qb=quatMul(q,fromTo(safeNorm(lb),rotate(inverseQ(q),safeNorm(ankle-knee))));
 localBodies[thigh].targetQ=qa;localBodies[thigh].targetP=vec4f(start-rotate(qa,constants[first+2u].xyz),1);
 localBodies[shin].targetQ=qb;localBodies[shin].targetP=vec4f(knee-rotate(qb,constants[first+6u].xyz),1);
}
// Recovery uses the same real joint anchors as walking, including the supporting arms.
fn recoveryArm(base:u32,side:u32,q:vec4f,p:vec3f,endQ:vec4f) {
 let first=header(1).y+(base/15u*14u+2u+side*6u)*4u;
 let upper=3u+side*6u;let lower=upper+1u;let hand=upper+2u;let chest=localBodies[0];
 let start=chest.targetP.xyz+rotate(chest.targetQ,constants[first+1u].xyz);
 let end=p+rotate(endQ,constants[first+10u].xyz);let la=constants[first+5u].xyz-constants[first+2u].xyz;let lb=constants[first+9u].xyz-constants[first+6u].xyz;
 let l1=length(la);let l2=length(lb);let direction=safeNorm(end-start);let distance=clamp(length(end-start),.035,l1+l2-.0015);
 let hint=rotate(q,vec3f(select(-.25,.25,side==1u),0,-1));let bend=safeNorm(hint-direction*dot(hint,direction));
 let along=(l1*l1-l2*l2+distance*distance)/(2*distance);let elbow=start+direction*along+bend*sqrt(max(0,l1*l1-along*along));let wrist=start+direction*distance;
 let qa=quatMul(q,fromTo(safeNorm(la),rotate(inverseQ(q),safeNorm(elbow-start))));let qb=quatMul(q,fromTo(safeNorm(lb),rotate(inverseQ(q),safeNorm(wrist-elbow))));
 localBodies[upper].targetQ=qa;localBodies[upper].targetP=vec4f(start-rotate(qa,constants[first+2u].xyz),1);
 localBodies[lower].targetQ=qb;localBodies[lower].targetP=vec4f(elbow-rotate(qb,constants[first+6u].xyz),1);
 localBodies[hand].targetQ=endQ;localBodies[hand].targetP=vec4f(wrist-rotate(endQ,constants[first+10u].xyz),1);
}
fn recoveryTargets(base:u32) {
 let hip=localBodies[1];let root=vec3f(hip.motor.x,0,hip.motor.z);let q=yawQ(hip.motor.y);
 let elapsed=frame.camera.w-(hip.nav.w-hip.nav.y);let rollTime=recoveryRollTime(hip.recoveryP.w);let u=max(0,elapsed-rollTime);
 let rollAngle=hip.recoveryP.w*smoothstep(0.0,max(.001,rollTime),elapsed);let axis=rotate(q,vec3f(0,0,1));let roll=vec4f(axis*sin(rollAngle*.5),cos(rollAngle*.5));let pivot=root+vec3f(0,.19,0);
 if(elapsed>=rollTime){
  let rise=smoothstep(1.1,3.8,u);let lean=1.4*(1-rise);let hands=smoothstep(1.65,2.85,u);
  localBodies[1].targetP=vec4f(root+vec3f(0,mix(.46,.975,rise),0),1);localBodies[1].targetQ=quatMul(q,pitchQ(lean*.67));
  let joints=base/15u*14u;childTarget(base,joints,quatMul(q,pitchQ(lean)));childTarget(base,joints+1u,quatMul(q,pitchQ(lean*.65)));
  for(var side=0u;side<2u;side++){
   let sign=select(-1.0,1.0,side==1u);let i=8u+side*6u;
   localBodies[i].targetP=vec4f(root+rotate(q,vec3f(sign*.137,.078,.024+sign*.10*sin(rise*3.141593))),1);localBodies[i].targetQ=q;legTarget(base,side,q);
   let hand=mix(vec3f(sign*.33,.055,.59),vec3f(sign*.38,.773,.01),hands);
   recoveryArm(base,side,q,root+rotate(q,hand),quatMul(q,pitchQ((1-hands)*1.570796)));
  }
 }
 let gather=smoothstep(0.0,.95,u);
 for(var k=0u;k<15u;k++){
  let p=pivot+rotate(roll,localBodies[k].recoveryP.xyz-pivot);let orientation=quatMul(roll,localBodies[k].recoveryQ);
  localBodies[k].targetP=vec4f(mix(p,localBodies[k].targetP.xyz,gather),1);localBodies[k].targetQ=blendQ(orientation,localBodies[k].targetQ,gather);
 }
}
fn gaitTargets(base:u32) {
 var hip=localBodies[1];if(hip.motor.w<.5){for(var k=0u;k<15u;k++){localBodies[k].gait=vec4f(0);localBodies[k].targetP=vec4f(localBodies[k].p.xyz,0);}return;}
 let dt=1.0/120;let root=vec3f(hip.motor.x,0,hip.motor.z);let q=yawQ(hip.motor.y);let blend=hip.gait.y;
 var previous:array<vec4f,15>;for(var k=0u;k<15u;k++){previous[k]=localBodies[k].targetP;}
 if(hip.motor.w<1.5){recoveryTargets(base);for(var k=0u;k<15u;k++){localBodies[k].targetV=vec4f(bounded((localBodies[k].targetP.xyz-previous[k].xyz)/dt,2.8),0);}return;}
 for(var side=0u;side<2u;side++){
  let i=8u+side*6u;var f=localBodies[i];let sign=select(-1.0,1.0,side==1u);let ideal=root+rotate(q,vec3f(sign*.137,.078,.024));
  if(f.gait.z<.5){f.targetP=vec4f(ideal,1);f.targetQ=q;f.footFrom=vec4f(ideal,hip.motor.y);f.footTo=f.footFrom;f.gait=vec4f(0,0,1,0);}
  let other=localBodies[8u+(1u-side)*6u];let error=length(ideal-f.targetP.xyz);let twist=abs(angleDelta(hip.motor.y,f.footTo.w));
  if(f.gait.y<.5&&other.gait.y<.5&&side==u32(hip.gait.w)&&(error>.105||twist>.24)){
   f.gait.x=0;f.gait.y=1;f.footFrom=vec4f(f.targetP.xyz,f.footTo.w);f.footTo=vec4f(ideal+rotate(q,vec3f(0,0,min(.22,hip.gait.x*.34))),hip.motor.y);
  }
  if(f.gait.y>.5){f.gait.x=min(1,f.gait.x+dt/.38);let t=f.gait.x;let ease=t*t*(3-2*t);f.targetP=vec4f(mix(f.footFrom.xyz,f.footTo.xyz,ease)+vec3f(0,sin(t*3.141593)*(.05+.020*blend),0),1);f.targetQ=quatMul(yawQ(f.footFrom.w+angleDelta(f.footTo.w,f.footFrom.w)*ease),pitchQ(.20*sin(t*6.283185)*blend));
   if(t>=1){f.gait.y=0;f.targetP=vec4f(f.footTo.xyz,1);hip.gait.w=f32(1u-side);}
  }
  localBodies[i]=f;
 }
 let forward=rotate(q,vec3f(0,0,1));let stride=clamp(dot(localBodies[8].targetP.xyz-localBodies[14].targetP.xyz,forward)*.82,-.32,.32)*blend;
 hip.gait.z=mix(hip.gait.z,stride,1-exp(-dt*12));
 let lift=max(localBodies[8].targetP.y,localBodies[14].targetP.y)-.078;
 var height=.975-.026*blend+lift*.10;
 // Keep a small knee bend without pulling a planted foot beyond the leg's reach.
 for(var side=0u;side<2u;side++){let first=header(1).y+(base/15u*14u+5u+side*6u)*4u;let foot=localBodies[8u+side*6u];let ankle=foot.targetP.xyz+rotate(foot.targetQ,constants[first+10u].xyz);let hipOffset=rotate(q,constants[first+1u].xyz);let horizontal=(root+hipOffset-ankle).xz;let reach=length(constants[first+5u].xyz-constants[first+2u].xyz)+length(constants[first+9u].xyz-constants[first+6u].xyz)-.008;height=min(height,ankle.y-hipOffset.y+sqrt(max(.01,reach*reach-dot(horizontal,horizontal))));}
 hip.targetP=vec4f(root+vec3f(0,height,0),1);hip.targetQ=quatMul(q,yawQ(hip.gait.z*.10));localBodies[1]=hip;
 let joints=base/15u*14u;childTarget(base,joints,quatMul(q,quatMul(yawQ(-hip.gait.z*.13),pitchQ(.025*blend))));childTarget(base,joints+1u,q);
 for(var side=0u;side<2u;side++){
  legTarget(base,side,q);let sign=select(-1.0,1.0,side==1u);let swing=-sign*hip.gait.z;
  let armQ=quatMul(q,quatMul(pitchQ(swing),vec4f(0,0,sin(sign*.05),cos(sign*.05))));let foreQ=quatMul(armQ,pitchQ(-.13-max(0,-swing)*.35));
  childTarget(base,joints+2u+side*6u,armQ);childTarget(base,joints+3u+side*6u,foreQ);childTarget(base,joints+4u+side*6u,foreQ);
 }
 for(var k=0u;k<15u;k++){localBodies[k].targetV=vec4f(select(vec3f(0),bounded((localBodies[k].targetP.xyz-previous[k].xyz)/dt,2.8),previous[k].w>.5),0);}
}
fn poseMotor(b:Body,index:u32)->Body {
 var out=b;if(b.motor.w<.5){return out;}
 var error=quatMul(b.targetQ,inverseQ(b.q));if(error.w<0){error=-error;}let angle=2*atan2(length(error.xyz),error.w);let axis=safeNorm(error.xyz);
 let strength=frame.rayO.w*select(.55,1.0,b.motor.w>1.5);let foot=index%15u==8u||index%15u==14u;
 let acceleration=bounded((b.targetP.xyz-b.p.xyz)*select(115.0,210.0,foot)+(b.targetV.xyz-b.v.xyz)*select(19.0,26.0,foot),55)*strength;
 out.v=vec4f(b.v.xyz+(acceleration+vec3f(0,9.81,0))/120,0);out.w=vec4f(b.w.xyz+bounded(axis*angle*95-b.w.xyz*17,85)*strength/120,0);return out;
}
fn correct(i:u32,n:vec3f,lambda:f32,r:vec3f) { var b=localBodies[i];if(b.status.x<.5){return;}b.p=vec4f(b.p.xyz+n*lambda*b.p.w,b.p.w);b.q=rotateStep(b.q,invWorld(b,cross(r,n)*lambda));localBodies[i]=b; }
fn joint(base:u32,j:u32,angles:bool) {
 let offset=header(1).y+j*4u;let h=constants[offset];let ai=u32(h.x)-base;let bi=u32(h.y)-base;if(cut(u32(h.y))){return;}var a=localBodies[ai];var b=localBodies[bi];if(a.status.x<.5&&b.status.x<.5){return;}
 let pa=constants[offset+1u];let pb=constants[offset+2u];let rest=constants[offset+3u];
 let ra=rotate(a.q,pa.xyz);let rb=rotate(b.q,pb.xyz);let error=b.p.xyz+rb-a.p.xyz-ra;let d=length(error);
 if(d>1e-7){let n=error/d;let lambda=min(d,.12)/(eff(a,ra,n)+eff(b,rb,n)+.00004);correct(ai,n,lambda,ra);correct(bi,n,-lambda,rb);}
 if(!angles){return;}a=localBodies[ai];b=localBodies[bi];let rel=quatMul(inverseQ(a.q),b.q);var e=quatMul(rel,inverseQ(rest));if(e.w<0){e=-e;}
 var desired:vec4f;if(h.z>.5){let angle=clamp(2*atan2(e.x,e.w),pa.w,pb.w);desired=quatMul(vec4f(sin(angle*.5),0,0,cos(angle*.5)),rest);}else{let angle=2*acos(clamp(e.w,-1,1));if(angle<=h.w){return;}desired=quatMul(vec4f(safeNorm(e.xyz)*sin(h.w*.5),cos(h.w*.5)),rest);}
 var delta=quatMul(quatMul(a.q,desired),inverseQ(b.q));if(delta.w<0){delta=-delta;}var angle=2*acos(clamp(delta.w,-1,1));if(angle<.0003){return;}let axis=safeNorm(delta.xyz);let ia=select(0.0,dot(axis,invWorld(a,axis)),a.status.x>.5);let ib=select(0.0,dot(axis,invWorld(b,axis)),b.status.x>.5);angle=min(angle*.42,.22);a.q=rotateStep(a.q,axis*(-angle*ia/(ia+ib+.00001)));b.q=rotateStep(b.q,axis*(angle*ib/(ia+ib+.00001)));localBodies[ai]=a;localBodies[bi]=b;
}
@compute @workgroup_size(16) fn physics(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32) {
 let base=group.x*15u;let dt=1.0/120.0;
 if(lane<15u){worldImpacts[lane]=WorldImpact(vec3f(0),0,vec3f(0),0,vec3f(0),-1);var b=bodies[base+lane];if(base+lane<u32(frame.settings.x)){
  if(frame.action.x==1){b.status.x=1;b.motor.w=0;b.blood.x=max(b.blood.x,select(.08,.85,lane<3u));b.v=vec4f((vec3f(hash(base+lane+4u),hash(base+lane+51u),hash(base+lane+97u))-.5)*vec3f(4,5,4),0);b.w=vec4f((vec3f(hash(base+lane+25u),hash(base+lane+71u),hash(base+lane+138u))-.5)*8,0);}
  if(frame.local.w>.5&&u32(frame.goal.w)/15u==group.x){b.status.x=1;b.motor.w=0;b.status.z=0;}
 }localBodies[lane]=b;}
 workgroupBarrier();
 if(lane==0u){var hip=localBodies[1];var health=100.0;for(var k=0u;k<15u;k++){health=min(health,localBodies[k].blood.w);}let held=frame.local.w>.5&&u32(frame.goal.w)/15u==group.x;
  if(hip.motor.w<.5){hip.status.z=select(0.0,hip.status.z+dt,length(hip.v.xyz)<.8&&!held);if(!rigBroken(base)&&hip.status.z>8&&health>25&&(u32(frame.settings.w)&2u)!=0u&&navFree(vec3f(hip.p.x,0,hip.p.z))){
   var direction=localBodies[2].p.xyz-hip.p.xyz;direction.y=0;if(length(direction)<.02){direction=rotate(localBodies[0].q,vec3f(0,0,1));direction.y=0;}let yaw=atan2(direction.x,direction.z);
   let axis=rotate(yawQ(yaw),vec3f(0,0,1));let normal=rotate(localBodies[0].q,vec3f(0,0,1));let angle=atan2(-cross(axis,normal).y,-normal.y);let rollAngle=select(angle,0.0,abs(angle)<.35);let duration=4.1+recoveryRollTime(rollAngle);
   for(var k=0u;k<15u;k++){localBodies[k].recoveryP=vec4f(localBodies[k].p.xyz,rollAngle);localBodies[k].recoveryQ=localBodies[k].q;localBodies[k].targetP=vec4f(localBodies[k].p.xyz,1);localBodies[k].targetQ=localBodies[k].q;localBodies[k].gait=vec4f(0);}
   hip.recoveryP=vec4f(hip.p.xyz,rollAngle);hip.recoveryQ=hip.q;hip.targetP=vec4f(hip.p.xyz,1);hip.targetQ=hip.q;hip.gait=vec4f(0);hip.motor=vec4f(hip.p.x,yaw,hip.p.z,1);hip.nav=vec4f(hip.p.x,duration,hip.p.z,frame.camera.w+duration);
  }}
  else if(hip.motor.w<1.5){if(frame.camera.w>hip.nav.w&&hip.p.y>.82&&rotate(localBodies[0].q,vec3f(0,1,0)).y>.85){hip.motor.w=2;hip.nav=vec4f(hip.motor.x,0,hip.motor.z,frame.camera.w+.8);}else if(frame.camera.w>hip.nav.w+2){hip.motor.w=0;hip.status.z=0;}}
  else if(!held){
   let delta=hip.nav.xz-hip.motor.xz;let distance=length(delta);var requested=0.0;
   if((u32(frame.settings.w)&1u)!=0u){
    if(distance<.24&&frame.camera.w>hip.nav.w){for(var attempt=0u;attempt<12u;attempt++){let seed=base+u32(frame.camera.w*120)+attempt*97u;let goal=vec3f(hip.motor.x,0,hip.motor.z)+vec3f(hash(seed)-.5,0,hash(seed+29u)-.5)*4;var clear=navFree(goal);for(var n=1u;n<8u;n++){clear=clear&&navFree(mix(vec3f(hip.motor.x,0,hip.motor.z),goal,f32(n)/8));}if(clear){hip.nav=vec4f(goal,frame.camera.w+.7);break;}}}
    else if(distance>.24&&frame.camera.w>hip.nav.w){let direction=delta/max(distance,.001);let turn=angleDelta(atan2(direction.x,direction.y),hip.motor.y);hip.motor.y+=clamp(turn,-1.7*dt,1.7*dt);requested=.62*clamp(1-abs(turn)/1.1,0,1)*clamp(distance/.65,0,1);
     if(!navFree(vec3f(hip.motor.x,0,hip.motor.z)+vec3f(direction.x,0,direction.y)*.45)){requested=0;hip.nav=vec4f(hip.motor.x,0,hip.motor.z,frame.camera.w+.8);}
     let lag=length(hip.p.xz-hip.motor.xz);requested*=clamp((.32-lag)/.18,0,1);
    }
   }
   hip.gait.x=mix(hip.gait.x,requested,1-exp(-dt*6.5));hip.gait.y=mix(hip.gait.y,clamp(hip.gait.x/.55,0,1),1-exp(-dt*7));
   let next=vec3f(hip.motor.x,0,hip.motor.z)+rotate(yawQ(hip.motor.y),vec3f(0,0,hip.gait.x*dt));if(navFree(next)){hip.motor.x=next.x;hip.motor.z=next.z;}
  }
  localBodies[1]=hip;
  for(var k=0u;k<15u;k++){localBodies[k].motor=hip.motor;localBodies[k].nav=hip.nav;localBodies[k].status.z=hip.status.z;}gaitTargets(base);
 }workgroupBarrier();
 let heldRig=heldComponent(base+min(lane,14u));
 if(lane<15u){var b=localBodies[lane];b.prevP=b.p;b.prevQ=b.q;if(b.status.x>.5){b=poseMotor(b,base+lane);b.v.y-=9.81*dt;b.v=vec4f(b.v.xyz*exp(-.075*dt),0);if(heldRig||b.motor.w>=.5){b.v=vec4f(bounded(b.v.xyz,21),0);}b.w=vec4f(bounded(b.w.xyz*exp(-.36*dt),26),0);}localBodies[lane]=b;}workgroupBarrier();
 if(lane==0u&&localBodies[1].motor.w<.5){limitRigVelocity(base);}workgroupBarrier();
 if(lane<15u){var b=localBodies[lane];if(b.status.x>.5){b.p=vec4f(b.p.xyz+b.v.xyz*dt,b.p.w);b.q=rotateStep(b.q,b.w.xyz*dt);}localBodies[lane]=b;}workgroupBarrier();
 for(var it=0u;it<9u;it++){
  if(lane==0u){for(var j=group.x*14u;j<(group.x+1u)*14u;j++){joint(base,j,(it&1u)==0u);}
   if(frame.local.w>.5&&u32(frame.goal.w)/15u==group.x){let i=u32(frame.goal.w)%15u;let b=localBodies[i];let r=rotate(b.q,frame.local.xyz);let error=frame.goal.xyz-(b.p.xyz+r);let d=length(error);if(d>1e-7){let n=error/d;correct(i,n,min(d,.15)*.86/(eff(b,r,n)+.00008/max(frame.tune.x,.05)),r);}let flags=u32(frame.settings.w);if((flags&12u)!=0u){localBodies[i].q=rotateStep(localBodies[i].q,vec3f(0,select(-.008,.008,(flags&8u)!=0u),0));}}
  }workgroupBarrier();if(lane<15u&&localBodies[lane].status.x>.5){localBodies[lane]=worldContact(localBodies[lane],lane);}workgroupBarrier();
 }
 if(lane<15u){var b=localBodies[lane];let index=base+lane;
  if(b.status.x>.5){b.v=vec4f((b.p.xyz-b.prevP.xyz)/dt,0);var dq=quatMul(b.q,inverseQ(b.prevQ));if(dq.w<0){dq=-dq;}let l=length(dq.xyz);b.w=vec4f(dq.xyz*(2*atan2(l,dq.w)/(max(l,1e-8)*dt)),0);
   for(var si=0u;si<u32(b.half.w);si++){let s=sample(b,si);let p=rotate(b.q,s.xyz)+b.p.xyz;if(p.y<s.w+.015){b.v.y=max(b.v.y,0);let friction=exp(-1.8*dt);b.v.x*=friction;b.v.z*=friction;}}
  }
  b.blood.y+=dt*max(.05,b.blood.x)*frame.action.z;b.blood.z=max(0,b.blood.z-dt);b.coat.y=max(0,b.coat.y-dt);b.coat.x=max(0,b.coat.x-dt*2.3/frame.tune.w);
  b=impactBlood(index,b,worldImpacts[lane]);
  b=paintContact(index,b,dt);
  let flingSpeed=length(b.v.xyz)+length(b.w.xyz)*b.invI.w*.55;
  b.coat.z=min(1.5,b.coat.z+dt*max(0,flingSpeed-1.8)*1.5);
  if(b.coat.x>.22&&b.coat.z>=1){let seed=index*137u+atomicLoad(&work[5]);let arm=rotate(b.q,vec3f((hash(seed)-.5)*b.half.x*1.5,(hash(seed+1u)-.5)*b.half.y*1.5,b.half.z*1.08));let normal=safeNorm(arm);let velocity=bounded(b.v.xyz+cross(b.w.xyz,arm),22)+normal*(.4+hash(seed+2u)*1.3);if(launchDrop(b.p.xyz+arm,velocity,.007+hash(seed+3u)*.007,index,min(b.coat.x,.018)*.02)){b.coat.x=max(0,b.coat.x-.018);b.coat.z-=1;atomicAdd(&work[27],1u);}}

  b=bleedPart(index,b);
  if(b.coat.x>.005&&(b.blood.z<=0||frame.action.x==1)){b.blood.z=.22;let rec=header(0).z+index;for(var face=0u;face<6u;face++){let c=vec2f((f32(face%3u)+.5)/3,(f32(face/3u)+.5)/2);stamp(rec,c,c,vec2f(.10,.18),min(b.coat.x*.42,.5),0,f32((index+face*3u)%18u),hash(index+face)*6.283185);}}
  // Contact lanes still read the solved shared p/q. Publish only velocities
  // here; rewriting the whole shared body would race those footprint reads.
  bodies[index]=b;localBodies[lane].v=b.v;localBodies[lane].w=b.w;
 }
 workgroupBarrier();
 if(lane==0u){rememberThrow(base);impactSound(base);if(group.x==0u){atomicAdd(&work[5],1u);}}
}
@compute @workgroup_size(64) fn pairs(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=u32(frame.settings.x)){return;}let a=bodies[i];var correction=vec3f(0);var angular=vec3f(0);if(a.status.x>.5){for(var j=0u;j<u32(frame.settings.x);j++){if(j==i){continue;}let b=bodies[j];if(i/15u==j/15u&&component(i)==component(j)&&(bitcast<u32>(a.status.w)&(1u<<(j%15u)))!=0u){continue;}if(distance(a.p.xyz,b.p.xyz)>a.invI.w+b.invI.w){continue;}for(var si=0u;si<u32(a.half.w);si++){let s=sample(a,si);let p=a.p.xyz+rotate(a.q,s.xyz);for(var sj=0u;sj<u32(b.half.w);sj++){let t=sample(b,sj);let other=b.p.xyz+rotate(b.q,t.xyz);let delta=p-other;let d=length(delta);let pen=s.w+t.w-d;if(pen>0&&d>1e-7){let n=delta/d;let r=p-a.p.xyz;let e=eff(a,r,n)+eff(b,other-b.p.xyz,n)+1e-5;let lambda=min(pen,.05)/e*.45;correction+=n*lambda*a.p.w;angular+=invWorld(a,cross(r,n)*lambda);}}}}}let scratch=header(2).w+header(2).x*128u+i*8u;for(var k=0u;k<3u;k++){atomicStore(&work[scratch+k],bitcast<u32>(correction[k]));atomicStore(&work[scratch+4u+k],bitcast<u32>(angular[k]));}
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
 if(frame.action.y==4){releaseThrow();return;}
 if(frame.action.y==5){meleeStrike();return;}
 if(frame.action.y==6){throwGrenade();return;}
 if(frame.action.y==7){queueBlast(frame.rayO.xyz,constants[header(3).z+1u].z);return;}
 if(frame.action.y<.5){return;}let hit=rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),35,true,-1);atomicStore(&work[6],bitcast<u32>(hit.body));atomicStore(&work[7],bitcast<u32>(hit.t));atomicStore(&work[10],bitcast<u32>(hit.p.x));atomicStore(&work[11],bitcast<u32>(hit.p.y));atomicStore(&work[12],bitcast<u32>(hit.p.z));
 if(hit.body>=0){let i=u32(hit.body);var b=bodies[i];let local=rotate(inverseQ(b.q),hit.p-b.p.xyz);for(var k=0u;k<3u;k++){atomicStore(&work[13u+k],bitcast<u32>(local[k]));}
  if(frame.action.y==2){
   for(var k=i/15u*15u;k<(i/15u+1u)*15u;k++){bodies[k].status.x=1;bodies[k].motor.w=0;bodies[k].status.z=0;}
   b=bodies[i];b.v=vec4f(b.v.xyz+frame.rayD.xyz*(14*frame.action.w)*b.p.w,0);b.w=vec4f(b.w.xyz+invWorld(b,cross(hit.p-b.p.xyz,frame.rayD.xyz*(14*frame.action.w))),0);
   b.blood.x=min(2,b.blood.x+1.3*frame.rayD.w);b.blood.w=max(0,b.blood.w-34*frame.rayD.w);damagePart(i,.39*frame.rayD.w);
   let spent=min(b.coat.w,.32*frame.rayD.w*frame.action.z);let volume=spent*.10;let retained=min(volume*.2,max(0,1.65-b.coat.x)*.02);b.coat.x+=retained/.02;
   let portion=(volume-retained)/36;var emitted=0.0;
   if(portion>1e-7){for(var k=0u;k<36u;k++){let h=i*971u+k*179u+atomicLoad(&work[5]);let velocity=bounded(b.v.xyz+cross(b.w.xyz,hit.p-b.p.xyz),20)*.85+hit.n*(1.2+hash(h)*5.5)+vec3f((hash(h+1u)-.5)*4.2,hash(h+2u)*3,(hash(h+3u)-.5)*4.2);if(launchDrop(hit.p+hit.n*.02,velocity,.005+hash(h+4u)*.013,i,portion)){emitted+=portion;}}}
   b.coat.w=max(0,b.coat.w-(retained+emitted)/.10);bodies[i]=b;atomicAdd(&work[16],1u);
  }
  if(frame.action.y==2||frame.action.y==3){if(frame.action.y==3){b.coat.x=min(1.65,b.coat.x+.12);bodies[i]=b;}let c=skinPoint(b,local,rotate(inverseQ(b.q),hit.n));stamp(header(0).z+i,c,c,vec2f(.07,.12),.75,0,f32(i%18u),0);}
 }else if(hit.surface>=0){if(frame.action.y==2){splatKind(u32(hit.surface),hit.p,.038,1,atomicLoad(&work[5]),9);for(var k=0u;k<4u;k++){let seed=atomicLoad(&work[5])+k*371u;spawnOrdnance(2u,hit.p+hit.n*.03,hit.n*(1+hash(seed)*3)+vec3f(hash(seed+1u)-.5,hash(seed+2u),hash(seed+3u)-.5)*2,.009+hash(seed+4u)*.008,seed);}}if(frame.action.y==3){let r=record(u32(hit.surface));splat(u32(hit.surface),hit.p,.32,1,atomicLoad(&work[5]));let c=uv(r,hit.p);atomicMax(&wet[wetCell(r,c)],50000u);for(var k=0u;k<10u;k++){let h=k*37u+atomicLoad(&work[5]);emit(hit.p+hit.n*.03,hit.n*(.5+hash(h)*1.2)+vec3f((hash(h+1u)-.5)*2,hash(h+2u)*1.8,(hash(h+3u)-.5)*2),.008+hash(h+4u)*.01,999u);}}}
}
@compute @workgroup_size(64) fn droplets(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=900u||atomicLoad(&work[64u+i])==0u){return;}var p=particles[i];let dt=1.0/120.0;p.previous=vec4f(p.p.xyz,p.previous.w);p.v.y-=9.81*dt;p.v=vec4f(p.v.xyz*exp(-.08*dt),p.v.w+dt);p.p=vec4f(p.p.xyz+p.v.xyz*dt,p.p.w);let delta=p.p.xyz-p.previous.xyz;let travel=length(delta);let h=rayHit(p.previous.xyz,safeNorm(delta),travel,true,select(-1,i32(p.previous.w),p.v.w<.22));
 if(h.t<travel){if(h.surface>=0){let radius=max(.018,p.p.w*(3+min(3,length(p.v.xyz)*.22)));if(p.extra.x>0){returnFilm(u32(h.surface),h.p,p.extra.x);splatKind(u32(h.surface),h.p,radius,.65,i+atomicLoad(&work[5]),5);atomicAdd(&work[28],1u);}else{splat(u32(h.surface),h.p,radius,.7,i+atomicLoad(&work[5]));}let r=record(u32(h.surface));if(p.extra.x==0){atomicMax(&wet[wetCell(r,uv(r,h.p))],12000u);}}else if(h.body>=0){if(p.extra.x>0){atomicAdd(&work[contactMemory(u32(h.body))+9u],u32(round(p.extra.x/.02*65536)));atomicAdd(&work[33],1u);}let b=bodies[u32(h.body)];let local=rotate(inverseQ(b.q),h.p-b.p.xyz);let n=rotate(inverseQ(b.q),h.n);let a=abs(n);var face:u32;var c:vec2f;var half:vec2f;if(a.x>a.y&&a.x>a.z){face=select(1u,0u,n.x>0);c=local.zy;half=b.half.zy;}else if(a.y>a.z){face=select(3u,2u,n.y>0);c=local.xz;half=b.half.xz;}else{face=select(5u,4u,n.z>0);c=local.xy;half=b.half.xy;}let point=(c/half*.5+.5+vec2f(f32(face%3u),f32(face/3u)))/vec2f(3,2);stamp(header(0).z+u32(h.body),point,point,vec2f(.045,.065),.55,0,f32(i%18u),0);}
  atomicStore(&work[64u+i],0u);atomicSub(&work[9],1u);atomicAdd(&work[17],1u);
 }else if(p.v.w>7||p.p.y<-.15){atomicStore(&work[64u+i],0u);atomicSub(&work[9],1u);}particles[i]=p;
}
@compute @workgroup_size(64) fn dry(@builtin(global_invocation_id) id:vec3u) { if(id.x>=header(0).z*3136u){return;}let old=atomicLoad(&wet[id.x]);atomicStore(&wet[id.x],u32(f32(old)*exp(-2.3/(120*frame.tune.w)))); }
@compute @workgroup_size(64) fn flow(@builtin(global_invocation_id) id:vec3u) {
 if(id.x>=header(0).z*3136u){return;}let rec=id.x/3136u;let r=record(rec);if(abs(r.n.y)>.2||r.v.y>-.8){return;}
 let cell=id.x%3136u;let x=cell%56u;let y=cell/56u;if(y>=55u){return;}let old=atomicLoad(&wet[id.x]);let supply=f32(old)/65536.0;let threshold=.13+hash(rec*83u+x*271u)*.18;if(supply<threshold){return;}
 let col=.35+.65*hash(rec*991u+x*31u);let amount=min(supply*.46,max(0,supply-threshold)*(.10+col*.32)/28);if(amount<.0008){return;}
 let passed=f32(takeWet(id.x,u32(amount*65536)))/65536.0;addWet(id.x+56u,u32(passed*.92*65536));
 let a=vec2f(f32(x)+.18+hash(rec*179u+x*37u)*.64,f32(y)+.22)/56;let b=vec2f(a.x+(hash(cell*17u)-.5)*min(.008,r.size.x*.003)/r.size.x,(f32(y)+1.8)/56);
 // Millimetre-scale rivulets; the old .6 was interpreted as metres, making bars.
 let width=max(.7/r.size.z,(.0035+passed*.035)/r.size.x);
 stamp(rec,a,b,vec2f(width,.002),min(1.0,passed*9),2,f32(cell+rec*131u),0);
 if(y>52u&&passed>.038&&hash(cell*97u+rec)>.79){let point=r.center.xyz+r.u.xyz*((b.x-.5)*r.size.x)+r.v.xyz*((b.y-.5)*r.size.y);emit(point+r.n.xyz*.012,r.v.xyz*.25+r.n.xyz*.04,.006,999u);}
}
@compute @workgroup_size(64) fn control(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=u32(frame.settings.x)){return;}var b=bodies[i];
 if(frame.action.x==2){atomicStore(&work[contactMemory(i)+9u],0u);b.coat.x=0;b.track.w=0;}
 if(frame.action.x==3){atomicStore(&work[fractureState(i)+6u],1u);atomicStore(&work[fractureState(i)+7u],0u);for(var face=0u;face<6u;face++){atomicStore(&work[contactMemory(i)+10u+face],0u);}atomicStore(&work[contactMemory(i)+9u],0u);b.blood=vec4f(0,0,0,100);b.coat.w=9;b.status.z=9;b.coat.x=0;b.track.w=0;}
 if(frame.action.x==4){b.blood.x=0;atomicStore(&work[fractureState(i)+6u],1u);}
 bodies[i]=b;
}
@compute @workgroup_size(1) fn telemetry() {
 var activeBodies=0u;var wounds=0u;var scraping=0.0;for(var i=0u;i<u32(frame.settings.x);i++){let b=bodies[i];if(b.status.x>.5){activeBodies++;}if(b.blood.x>.001){wounds++;}if(b.track.w>0){scraping=max(scraping,min(1.0,length(b.v.xyz)*b.coat.x*.2));}}
 atomicStore(&work[20],activeBodies);atomicStore(&work[21],wounds);atomicStore(&work[22],bitcast<u32>(scraping));
}
@compute @workgroup_size(64) fn bin(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=min(8192u,atomicLoad(&work[3]))){return;}let s=stamps[i];let r=record(u32(s.info.x));let extent=max(max(s.a.z*r.size.x,s.a.w*r.size.y),max(s.color.y,s.color.z));let pad=select(s.a.zw*2.3,vec2f(extent*2.3+.025)/r.size.xy,s.info.y==1||s.info.y==3||s.info.y==4||s.info.y==6||s.info.y==8)+vec2f(3)/r.size.zw;let a=vec2u(clamp(floor((min(s.a.xy,s.b.xy)-pad)*r.size.zw/16),vec2f(0),vec2f(r.address.zw)-1));let b=vec2u(clamp(floor((max(s.a.xy,s.b.xy)+pad)*r.size.zw/16),vec2f(0),vec2f(r.address.zw)-1));let h=header(2);
 for(var y=a.y;y<=b.y;y++){for(var x=a.x;x<=b.x;x++){let tile=r.address.y+x+y*r.address.z;let n=atomicAdd(&work[h.y+tile],1u);if(n==0u){let activeIndex=atomicAdd(&work[0],1u);atomicStore(&work[h.z+activeIndex],tile);}if(n<256u){let address=select(destructionMeta()+32u+tile*128u+n-128u,h.w+tile*128u+n,n<128u);atomicStore(&work[address],i);}else{atomicAdd(&work[18],1u);}}}
}
var<workgroup> indices:array<u32,256>;
fn coverage(s:Stamp,point:vec2f)->vec4f {
 let r=record(u32(s.info.x));let p=point/r.size.zw;let radius=max(s.a.zw,vec2f(.0001));var alpha=0.0;var color=vec3f(.42,.025,.06);
 if(s.info.y==9){
  let q=(p-s.a.xy)/radius;let angle=atan2(q.y,q.x);let edge=.72+.12*sin(angle*7+s.info.z);let d=length(q);let rim=1-smoothstep(.17,.32,abs(d-edge));
  alpha=max(1-smoothstep(edge-.08,edge,d),rim*.7)*s.b.w;color=mix(vec3f(.025,.032,.031),vec3f(.23,.27,.26),rim*clamp(q.y+1,0,1));
 }else if(s.info.y==10){
  let q=(p-s.a.xy)/radius;let d=length(q);let a=atan2(q.y,q.x);let edge=.80+.11*sin(a*7+s.info.z)+.07*sin(a*13+s.info.z*.3);
  let grain=hash(u32(point.x)*1973u+u32(point.y)*977u+u32(s.info.z));let streak=pow(max(0,sin(a*39+s.info.z)),8)*.14;
  alpha=(1-smoothstep(.10,edge+streak,d))*s.b.w*(.60+.4*grain);color=vec3f(.030,.036,.033);
 }else if(s.info.y==11){
  let delta=(s.b.xy-s.a.xy)*r.size.xy;let rel=(p-s.a.xy)*r.size.xy;let t=clamp(dot(rel,delta)/max(dot(delta,delta),1e-8),0,1);let distance=length(rel-delta*t);let width=radius.x*r.size.x;
  let grain=hash(u32(point.x)*971u+u32(point.y)*131u+u32(s.info.z));alpha=(1-smoothstep(width*.4,width,distance))*(.4+.6*grain)*s.b.w;color=vec3f(.035,.043,.040);
 }else if(s.info.y==1){
  let seed=u32(s.info.z);let size=radius*r.size.xy;let previousSize=s.color.yz;let travel=s.color.w;var rgb=vec3f(0);
  for(var j=0u;j<54u;j++){
   let h=hash(seed*113u+j*977u);let h2=hash(seed*337u+j*199u);let h3=hash(seed*41u+j*57u);let h4=hash(seed*617u+j*521u);let h5=hash(seed*181u+j*881u);
   let breakup=.5+.5*sin(travel*(29+h*28)+f32(j)*2.3+f32(seed)*.7);
   if((s.b.w<.24&&breakup>s.b.w*2.8+.08)||h4<.10+max(0,.16-s.b.w*.08)){continue;}
   let material=brushMaterial(seed,j);let rr=length(material);let fringe=1-min(.98,rr)*.68;
   let a=s.a.xy+patchOffset(previousSize,s.color.x,material)/r.size.xy;let b=s.b.xy+patchOffset(size,s.b.z,material)/r.size.xy;
   let direction=(b-a)*r.size.xy;let relative=(p-a)*r.size.xy;let t=clamp(dot(relative,direction)/max(dot(direction,direction),1e-8),0,1);let distance=length(relative-direction*t);
   let part=(seed/731u)%15u;let core=(j==0u||j==7u||j==21u||j==33u)&&part!=5u&&part!=11u;let avgRadius=dot(size+previousSize,vec2f(.25));
   let width=select(clamp(avgRadius*(.055+h3*.20)*fringe,.0025,.040),clamp(avgRadius*(.33+h3*.42)*1.05*(.62+.42*pow(sin(travel*(15+h5*6)+f32(j)),2)),.010,.12),core)*.5*select(1.0,.55,part==4u||part==10u);
   let aa=.65*r.size.x/r.size.z;let strength=clamp(select(.10+h3*.26,.68+h3*.24,core)*s.b.w*fringe*(.42+breakup*.72),.006,.96);
   let cov=(1-smoothstep(max(0,width-aa),width+aa,distance))*strength;
   let bristleColor=vec3f((76+floor(h*50))/255,(3+floor(h2*6))/255,(9+floor(h3*8))/255);
   rgb=rgb*(1-cov)+bristleColor*cov;alpha=alpha+cov*(1-alpha);
  }
  // Floors retain the broad fill. Wall coverage comes from the hairs and
  // finite liquid field, never an alpha ellipse behind each brush position.
  let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);let q=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/size;
  let film=select((1-smoothstep(.35,1.08,length(q)))*min(.14,s.b.w*.09),0.0,abs(r.n.y)<.65);rgb=rgb*(1-film)+vec3f(.40,.035,.065)*film;alpha+=film*(1-alpha);color=rgb/max(alpha,1e-6);
 }else if(s.info.y==8){
  let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);let q=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/(radius*r.size.xy);
  let t=q*.26+.5;
  if(all(t>=vec2f(0))&&all(t<=vec2f(1))){let tex=textureSampleLevel(brush,brushSampler,t,i32(u32(s.info.z)%18u),0);alpha=tex.a*min(1.0,s.b.w);color=tex.rgb;}
 }else if(s.info.y==6){
  let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);let q=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/(radius*r.size.xy);let angle=atan2(q.y,q.x);let seed=s.info.z;
  let edge=.86+.10*sin(angle*5+seed)+.07*sin(angle*9+seed*.71)+.16*pow(max(0,sin(angle*7+seed*.13)),6);
  let grain=.88+.12*hash(u32(point.x)+u32(point.y)*271u+u32(seed));alpha=(1-smoothstep(edge-.065,edge+.025,length(q)))*s.b.w*grain;color=vec3f(.39,.019,.045);
 }else if(s.info.y==4){
  let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);let q=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/(radius*r.size.xy);let angle=atan2(q.y,q.x);let seed=s.info.z;
  let edge=.93+.045*sin(angle*5+seed)+.025*sin(angle*9+seed*.71);alpha=(1-smoothstep(edge-.13,edge+.035,length(q)))*s.b.w;color=vec3f(.39,.027,.055);
 }else if(s.info.y==2){let direction=(s.b.xy-s.a.xy)*r.size.zw;let relative=(p-s.a.xy)*r.size.zw;let t=clamp(dot(relative,direction)/max(dot(direction,direction),1e-8),0,1);alpha=clamp(s.a.z*r.size.z+.65-length(relative-direction*t),0,1)*s.b.w;}
 else{let q=(p-s.a.xy)/radius;let c=cos(s.b.z);let sn=sin(s.b.z);let t=vec2f(q.x*c+q.y*sn,-q.x*sn+q.y*c)*.5+.5;if(all(t>=vec2f(0))&&all(t<=vec2f(1))){let tex=textureSampleLevel(brush,brushSampler,t,i32(u32(s.info.z)%18u),0);alpha=tex.a*min(s.b.w,1);color=tex.rgb;}}
 return vec4f(color,alpha);
}
@compute @workgroup_size(8,8) fn paint(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_id) local:vec3u,@builtin(local_invocation_index) lane:u32) {
 let h=header(2);let tile=atomicLoad(&work[h.z+group.x]);let count=atomicLoad(&work[h.y+tile]);let n=min(count,256u);
 for(var j=lane;j<n;j+=64u){let address=select(destructionMeta()+32u+tile*128u+j-128u,h.w+tile*128u+j,j<128u);indices[j]=atomicLoad(&work[address]);}workgroupBarrier();
 if(lane==0u){for(var i=1u;i<n;i++){let value=indices[i];var j=i;loop{if(j==0u||indices[j-1u]<=value){break;}indices[j]=indices[j-1u];j--;}indices[j]=value;}}workgroupBarrier();
 var rec=0u;for(var i=0u;i<header(0).w;i++){let r=record(i);if(tile>=r.address.y&&tile<r.address.y+r.address.z*r.address.w){rec=i;break;}}
 let r=record(rec);let t=tile-r.address.y;let origin=vec2u(t%r.address.z,t/r.address.z)*16u;
 for(var y=0u;y<2u;y++){for(var x=0u;x<2u;x++){let pos=origin+local.xy+vec2u(x,y)*8u;if(any(pos>=vec2u(r.size.zw))){continue;}let offset=r.address.x+pos.x+pos.y*u32(r.size.z);var value=unpack(pigment[offset]);var liquid=0.0;var liquidPush=vec2f(0);let total=select(n,min(8192u,atomicLoad(&work[3])),count>256u);
  var velocities:array<vec2f,9>;var smudging=false;
  for(var j=0u;j<total;j++){
   let index=select(indices[min(j,255u)],j,count>256u);let s=stamps[index];if(u32(s.info.x)!=rec||(s.info.y!=3&&s.info.y!=12)){continue;}smudging=true;
   velocities[0]+=paintPushVelocity(s,r,vec2f(pos)+.5);
   for(var k=0u;k<8u;k++){if(k>=4u&&carryReach()==1){break;}let axis=k%4u;let offset=select(vec2f(select(-1.0,1.0,axis==0u),0),vec2f(0,select(-1.0,1.0,axis==2u)),axis>=2u);velocities[k+1u]+=paintPushVelocity(s,r,vec2f(pos)+.5+offset*(carryReach()-f32(k/4u)));}
   if(s.info.y==3){liquidPush+=contactDisplacement(s,r,vec2f(pos)+.5)*2.2;}
  }
  if(smudging){value=displacedPaint(rec,vec2f(pos)+.5,value,velocities);}
  for(var j=0u;j<total;j++){let index=select(indices[min(j,255u)],j,count>256u);let s=stamps[index];if(u32(s.info.x)!=rec||s.info.y==3||s.info.y==12){continue;}{let source=coverage(s,vec2f(pos)+.5);if(source.a>0){value=over(value,source);let footprintArea=max(.002,s.a.z*s.a.w*r.size.x*r.size.y);var supply=select(select(.18,.036,s.info.y==1),.006/footprintArea,s.info.y==4);if(s.info.y==6||s.info.y==8){supply=s.color.w*.75/(3.2*footprintArea*max(s.b.w,.001));}
  // Contact deposits finite film along the bristles. Raster strokes add pigment only.
  if(s.info.y>=9||s.info.y==5||s.info.y==2||(s.info.y==1&&abs(r.n.y)<.65)){supply=0;}liquid+=source.a*supply;}}}
  pigment[offset]=pack(value);depositFilm(rec,pos,liquid,liquidPush);
 }}
}
