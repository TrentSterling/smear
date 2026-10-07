// Destruction lives after the existing pair/contact scratch in work. No CPU poses.
// Per body: incoming cut, accumulated damage, reserved, reserved, bleed phase,
// exposed socket mask, stopped bleeding, char amount. Ordnance is 128 x 24 words.
const BODY_PARENT=array<u32,15>(1u,1u,0u,0u,3u,4u,1u,6u,7u,0u,9u,10u,1u,12u,13u);
const BODY_JOINT=array<u32,15>(0u,0u,1u,2u,3u,4u,5u,6u,7u,8u,9u,10u,11u,12u,13u);

fn cut(i:u32)->bool{return atomicLoad(&work[fractureState(i)])!=0u;}
fn component(i:u32)->u32{
 let base=i/15u*15u;var p=i%15u;
 for(var k=0u;k<5u;k++){if(p==1u||cut(base+p)){break;}p=BODY_PARENT[p];}return base+p;
}
fn heldComponent(i:u32)->bool{return frame.local.w>.5&&frame.goal.w<180&&component(i)==component(u32(frame.goal.w));}
fn rigBroken(base:u32)->bool{for(var k=0u;k<15u;k++){if(cut(base+k)){return true;}}return false;}
fn queueFracture(i:u32,amount:f32){
 if(i%15u==1u||cut(i)||amount<=0){return;}
 atomicAdd(&work[fractureState(i)+1u],u32(amount*constants[header(3).z+1u].w*65536));atomicStore(&work[63],1u);
}
fn damagePart(i:u32,amount:f32){
 if(amount>0){atomicStore(&work[fractureState(i)+6u],0u);}
 if(i%15u!=1u){queueFracture(i,amount);}
 else{queueFracture(i/15u*15u,amount*.6);queueFracture(i+5u,amount*.65);queueFracture(i+11u,amount*.65);}
}
@compute @workgroup_size(1) fn fractures(){
 if(atomicExchange(&work[63],0u)==0u){return;}
 for(var i=0u;i<u32(frame.settings.x);i++){
  let s=fractureState(i);if(i%15u==1u||cut(i)||atomicLoad(&work[s+1u])<65536u){continue;}
  let parent=i/15u*15u+BODY_PARENT[i%15u];atomicStore(&work[s],1u);
  atomicOr(&work[s+5u],1u<<(i%15u));atomicOr(&work[fractureState(parent)+5u],1u<<(i%15u));
  atomicStore(&work[s+6u],0u);atomicStore(&work[fractureState(parent)+6u],0u);
  bodies[i].blood.x=max(bodies[i].blood.x,1.6);bodies[parent].blood.x=max(bodies[parent].blood.x,1.6);
  for(var k=i/15u*15u;k<(i/15u+1u)*15u;k++){bodies[k].motor.w=0;bodies[k].status.x=1;bodies[k].status.z=0;}
  atomicAdd(&work[59],1u);
 }
}
// Every emitted wound drop carries a volume paid from that body's finite supply.
// Severed ends use the real joint sockets and stay open until Stop/Heal or empty.
fn bleedPart(i:u32,input:Body)->Body{
 var b=input;let s=fractureState(i);let mask=atomicLoad(&work[s+5u]);
 if(atomicLoad(&work[s+6u])!=0u||b.blood.x<=.001||b.coat.w<=0||frame.action.z<=0){return b;}
 let serial=atomicLoad(&work[s+4u]);let seed=i*199u+serial*977u;
 let interval=select(.035,.13+hash(seed)*.10,mask!=0u);
 if(b.blood.y<interval){return b;}b.blood.y=0;
 var arm=vec3f(0,0,b.half.z);var normal=vec3f(0,0,1);
 if(mask!=0u){
  let start=serial%15u;for(var n=0u;n<15u;n++){let child=(start+n)%15u;if((mask&(1u<<child))==0u){continue;}
   let j=header(1).y+(i/15u*14u+BODY_JOINT[child])*4u;
   arm=constants[j+select(1u,2u,child==i%15u)].xyz;normal=safeNorm(arm);break;
  }
 }
 let p=b.p.xyz+rotate(b.q,arm+normal*.018);let n=rotate(b.q,normal);
 let pulse=.65+.35*sin(frame.camera.w*7.6+f32(i)*2.1);
 let speed=select(.8+hash(seed+1u)*1.8,1.2+pulse*2.8,mask!=0u)*sqrt(clamp(b.coat.w/3,.15,1));
 let spent=min(b.coat.w,select(.002*b.blood.x,.012+.014*pulse,mask!=0u));let volume=spent*.10;
 let velocity=bounded(b.v.xyz+cross(b.w.xyz,rotate(b.q,arm)),22)+n*speed+vec3f(hash(seed+2u)-.5,hash(seed+3u)-.5,hash(seed+4u)-.5)*.7;
 let retained=min(max(0,1.65-b.coat.x)*.02,volume*.15);
 if(launchDrop(p,velocity,clamp(pow(volume,.333333)*.26,.005,.018),i,volume-retained)){
  b.coat.w-=spent;b.coat.x+=retained/.02;atomicAdd(&work[s+4u],1u);atomicAdd(&work[62],1u);
 }return b;
}
fn ordFloat(i:u32)->f32{return bitcast<f32>(atomicLoad(&work[i]));}
fn ordVector(i:u32)->vec3f{return vec3f(ordFloat(i),ordFloat(i+1u),ordFloat(i+2u));}
fn putVector(i:u32,v:vec3f){for(var k=0u;k<3u;k++){atomicStore(&work[i+k],bitcast<u32>(v[k]));}}
fn spawnOrdnance(kind:u32,p:vec3f,v:vec3f,r:f32,seed:u32)->bool{
 let explosive=kind==1u||kind==4u||kind==6u;let first=select(8u,0u,explosive);let count=select(120u,8u,explosive);
 var chosen=128u;var oldest=-1.0;
 for(var n=0u;n<count;n++){let i=first+(seed+n)%count;let s=ordnanceState(i);let resident=atomicLoad(&work[s+23u]);
  if(resident==0u){chosen=i;break;}
  // Destruction runs serially. Preserve the six readable crate boards even
  // when a barrel chain has already filled every slot with metal flecks.
  let replaceable=(kind==5u&&(resident==2u||resident==3u))||(kind==3u&&resident==2u);
  if(replaceable&&ordFloat(s+7u)>oldest){oldest=ordFloat(s+7u);chosen=i;}
 }
 if(chosen<128u){let s=ordnanceState(chosen);
  putVector(s,p);atomicStore(&work[s+3u],bitcast<u32>(r));putVector(s+4u,v);atomicStore(&work[s+7u],0u);
  putVector(s+8u,p);atomicStore(&work[s+11u],seed);for(var k=12u;k<23u;k++){atomicStore(&work[s+k],0u);}atomicStore(&work[s+19u],kind);atomicStore(&work[s+22u],bitcast<u32>(frame.camera.w));atomicStore(&work[s+23u],kind);return true;
 }return false;
}
fn throwGrenade(){
 let direction=safeNorm(frame.rayD.xyz);let hit=rayHit(frame.rayO.xyz,direction,.55,true,-1);
 let start=frame.rayO.xyz+direction*max(0.0,hit.t-.10);
 if(spawnOrdnance(1u,start,direction*12+vec3f(0,2,0),.065,atomicLoad(&work[5])+77u)){atomicAdd(&work[destructionMeta()+5u],1u);}
}
fn queueBlast(point:vec3f,power:f32){
 let controlAddress=destructionMeta();let slot=atomicAdd(&work[58],1u)%16u;let s=blastState(slot);
 putVector(s,point);atomicStore(&work[s+3u],bitcast<u32>(3.5*sqrt(power)));
 atomicStore(&work[s+4u],bitcast<u32>(frame.camera.w));atomicStore(&work[s+5u],bitcast<u32>(power));
 atomicStore(&work[s+6u],atomicLoad(&work[58])*1973u);atomicStore(&work[s+7u],1u);atomicStore(&work[s+8u],0u);
 atomicOr(&work[controlAddress],1u<<slot);
}
fn blastVisibility(center:vec3f,p:vec3f)->bool{
 let delta=p-center;let d=length(delta);if(d<.035){return true;}
 // Ray distance also blocks unpainted backs/undersides of solid boxes.
 return rayHit(center,delta/d,max(0,d-.025),false,-1).t>=max(0,d-.025);
}
@compute @workgroup_size(64) fn ordnance(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=128u){return;}let s=ordnanceState(i);let kind=atomicLoad(&work[s+23u]);if(kind==0u){return;}
 if(kind==6u&&followSticky(s)){return;}
 let dt:f32=1.0/120;let old=ordVector(s);var velocity=ordVector(s+4u);let age=ordFloat(s+7u)+dt;let radius=ordFloat(s+3u);
 if((kind==3u||kind==5u)&&(atomicLoad(&work[s+20u])&0x80000000u)!=0u){atomicStore(&work[s+7u],bitcast<u32>(age));if(age>select(14.0,30.0,kind==5u)){atomicStore(&work[s+23u],0u);}return;}
 // exp(-drag / 120), pre-evaluated to avoid a Naga/DXC f64 exp overload.
 if(kind!=4u){velocity.y-=9.81*dt;velocity*=select(.99833472f,.99933356f,kind==1u);}var p=old+velocity*dt;
 let delta=p-old;let distance=length(delta);let hit=rayHit(old,safeNorm(delta),distance+radius,false,-1);
 let skip=select(-1,i32(atomicLoad(&work[s+20u]))-1,age<ordFloat(s+21u));let bodyHit=projectileBodyHit(old,delta,radius,skip);
 if(bodyHit.body>=0&&bodyHit.time*distance<hit.t){
  p=old+delta*bodyHit.time+bodyHit.normal*.003;if(kind==6u){attachSticky(s,p,bodyHit.normal,u32(bodyHit.body)+1u);return;}putVector(s,p);atomicStore(&work[s+12u],u32(bodyHit.body)+1u);putVector(s+13u,velocity);putVector(s+16u,bodyHit.normal);atomicStore(&work[s+19u],kind);
  if(kind==1u||kind==4u){atomicStore(&work[s+23u],0u);queueBlast(p,constants[header(3).z+1u].z*select(1.0,1.3,kind==4u));return;}
  velocity-=bodyHit.normal*min(0,dot(velocity,bodyHit.normal))*1.25;velocity*=.5;atomicStore(&work[s+20u],u32(bodyHit.body)+1u);atomicStore(&work[s+21u],bitcast<u32>(age+.12));
 }
 else if(hit.surface>=0){
  p=hit.p+hit.n*(radius+.002);if(kind==6u){let tag=record(u32(hit.surface)).center.w;attachSticky(s,p,hit.n,select(1000u,180u+u32(tag),tag>0));return;}let incoming=max(0,-dot(velocity,hit.n));
  if(kind==4u){hitProp(hit.surface,.8);propSurfaceImpulse(hit.surface,hit.p,velocity*.8);atomicStore(&work[s+23u],0u);queueBlast(p,1.3*constants[header(3).z+1u].z);return;}
  velocity-=hit.n*min(0,dot(velocity,hit.n))*select(1.28,1.46,kind==1u);velocity*=select(.69,.82,kind==1u);
  if((kind==3u||kind==5u)&&hit.n.y>.95&&length(velocity)<.55){velocity=vec3f(0);p=hit.p+hit.n*(radius*select(.28,.16,kind==5u)+.002);atomicStore(&work[s+20u],0x80000000u);}
  if(kind>=2u&&incoming>.5){
   if(incoming>4){hitProp(hit.surface,min(.18,incoming*.009));propSurfaceImpulse(hit.surface,hit.p,-hit.n*incoming*.045);}
   let tangent=safeNorm(velocity-hit.n*dot(velocity,hit.n));let end=hit.p+tangent*clamp(incoming*.016,.025,.26);
   contactSweep(u32(hit.surface),hit.p,end,vec2f(radius*1.6),vec2f(radius*1.6),0,0,clamp(incoming*.09,.12,.8),11,atomicLoad(&work[s+11u]),0);
   let receiver=record(u32(hit.surface));let cell=vec2u(clamp(uv(receiver,hit.p)*vec2f(filmDimensions(receiver)),vec2f(0),vec2f(filmDimensions(receiver))-1));
   if(filmRead(0u,filmAddress(receiver,cell))>.006){contactSweep(u32(hit.surface),hit.p,end,vec2f(radius*3),vec2f(radius*3),0,0,.75,3,atomicLoad(&work[s+11u]),0);}
   atomicAdd(&work[60],1u);
  }
 }
 putVector(s,p);putVector(s+4u,velocity);putVector(s+8u,old);atomicStore(&work[s+7u],bitcast<u32>(age));
 if(kind==1u&&age>=1.45){atomicStore(&work[s+23u],0u);queueBlast(p,constants[header(3).z+1u].z);}
 else if(kind==4u&&age>3){atomicStore(&work[s+23u],0u);queueBlast(p,1.3*constants[header(3).z+1u].z);}
 else if(kind!=1u&&kind!=4u&&kind!=6u&&(age>select(select(6.0,14.0,kind==3u),30.0,kind==5u)||p.y<-.2)){atomicStore(&work[s+23u],0u);}
}
@compute @workgroup_size(1) fn detonate(){
 let controlAddress=destructionMeta();var mask=atomicLoad(&work[controlAddress]);var pending=0u;
 for(var slot=0u;slot<16u;slot++){
  if((mask&(1u<<slot))==0u){continue;}let s=blastState(slot);let age=frame.camera.w-ordFloat(s+4u);
  if(age>.70){mask&=~(1u<<slot);continue;}
  if(atomicExchange(&work[s+7u],0u)==0u){continue;}
  let center=ordVector(s);let radius=ordFloat(s+3u);let power=ordFloat(s+5u);let seed=atomicLoad(&work[s+6u]);
  pending|=1u<<slot;
  for(var j=0u;j<header(0).x;j++){let k=header(1).x+j*5u;let tag=constants[k+2u].w;if(tag<=0||propGone(tag)){continue;}let p=constants[k].xyz;let q=constants[k+1u];let nearest=p+rotate(q,clamp(rotate(inverseQ(q),center-p),-constants[k+2u].xyz,constants[k+2u].xyz));let distance=length(p-center);if(distance<radius&&blastVisibility(center,nearest)){let pressure=pow(max(0,1-distance/radius),1.4)*power;propDamage(tag,pressure*3.2);propImpulse(tag,nearest,safeNorm(p-center+vec3f(0,.15,0))*pressure*85);}}
  for(var debris=8u;debris<128u;debris++){let o=ordnanceState(debris);let kind=atomicLoad(&work[o+23u]);if(kind!=3u&&kind!=5u){continue;}let p=ordVector(o);let distance=length(p-center);if(distance<radius&&blastVisibility(center,p)){atomicStore(&work[o+20u],0u);putVector(o+4u,ordVector(o+4u)+safeNorm(p-center+vec3f(0,.15,0))*(1-distance/radius)*power*13);}}
  for(var k=0u;k<42u;k++){
   let h=seed+k*73u;let direction=safeNorm(vec3f(hash(h)-.5,hash(h+1u)-.35,hash(h+2u)-.5));
   spawnOrdnance(2u,center+direction*.07,direction*(5+hash(h+3u)*12)*sqrt(power),.013+hash(h+4u)*.025,h);
  }
  for(var rec=0u;rec<header(0).z;rec++){
   let r=record(rec);if(propGone(r.center.w)){continue;}let d=dot(center-r.center.xyz,r.n.xyz);if(d<-.01||d>radius*.8){continue;}
   let p=center-r.n.xyz*d;let extent=sqrt(max(0,radius*radius*.64-d*d));let c=uv(r,p);
   if(any(c+vec2f(extent)/r.size.xy<vec2f(0))||any(c-vec2f(extent)/r.size.xy>vec2f(1))){continue;}
   let nearest=r.center.xyz+r.u.xyz*((clamp(c.x,0,1)-.5)*r.size.x)+r.v.xyz*((clamp(c.y,0,1)-.5)*r.size.y);
   if(!blastVisibility(center,nearest)){continue;}
   contactStamp(rec,p,p,vec2f(extent),vec2f(extent),0,0,.85*power,10,seed,0);
  }
  // Detonation runs serially after interaction. Its boom outranks a bat hit
  // in the same frame; preserve the strongest boom when several barrels chain.
  let boom=0x40000000u|(u32(clamp(power*.85,0,1)*4095)<<8u)|255u;let previous=atomicLoad(&work[38]);atomicStore(&work[38],select(boom,max(previous,boom),(previous&0x40000000u)!=0u));atomicAdd(&work[39],1u);
 }
 atomicStore(&work[controlAddress],mask);atomicStore(&work[controlAddress+18u],pending);
 atomicStore(&work[controlAddress+8u],select(0u,header(3).y,mask!=0u));atomicStore(&work[controlAddress+9u],1u);atomicStore(&work[controlAddress+10u],1u);
 atomicStore(&work[controlAddress+12u],select(0u,(filmCellCount()+255u)/256u,mask!=0u));atomicStore(&work[controlAddress+13u],1u);atomicStore(&work[controlAddress+14u],1u);
}
// Each lane owns one body. A shared flag wakes its rig without cross-body
// stores; blast order, occlusion and finite spray debits remain unchanged.
var<workgroup> blastRigWake:atomic<u32>;
@compute @workgroup_size(15) fn blastBodies(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 let mask=atomicLoad(&work[destructionMeta()+18u]);
 let i=group.x*15u+lane;var b=bodies[i];
 if(lane==0u){atomicStore(&blastRigWake,0u);}workgroupBarrier();
 for(var slot=0u;slot<16u;slot++){
  if((mask&(1u<<slot))==0u){continue;}let s=blastState(slot);
  let center=ordVector(s);let radius=ordFloat(s+3u);let power=ordFloat(s+5u);let seed=atomicLoad(&work[s+6u]);
   let delta=b.p.xyz-center;let distance=length(delta);if(distance>radius||!blastVisibility(center,b.p.xyz)){continue;}
   let pressure=pow(max(0,1-distance/radius),1.4)*power;let direction=safeNorm(delta+vec3f(0,.08,0));
   b.v=vec4f(bounded(b.v.xyz+direction*(pressure*22)+vec3f(0,pressure*2,0),21),0);b.w=vec4f(bounded(b.w.xyz+cross(direction,vec3f(hash(seed+i)-.5,hash(seed+i+1u)-.5,hash(seed+i+2u)-.5))*pressure*25,26),0);
   b.motor.w=0;b.status.x=1;b.status.z=0;b.blood.x=min(2,b.blood.x+pressure*frame.rayD.w);b.blood.w=max(0,b.blood.w-pressure*55*frame.rayD.w);
   let volume=min(b.coat.w,pressure*.8*frame.rayD.w*frame.action.z)*.10;
   let retained=min(volume*.15,max(0,1.65-b.coat.x)*.02);let portion=(volume-retained)/18;var spent=retained;
   if(portion>1e-7){for(var drop=0u;drop<18u;drop++){
    let h=seed+i*371u+drop*977u;let spray=safeNorm(direction+vec3f(hash(h)-.5,hash(h+1u)-.5,hash(h+2u)-.5)*1.1);
    if(launchDrop(b.p.xyz+spray*b.invI.w*.8,b.v.xyz+spray*(3+hash(h+3u)*9)*sqrt(pressure),.006+hash(h+4u)*.012,i,portion)){spent+=portion;}
   }}
   b.coat.w=max(0,b.coat.w-spent/.10);b.coat.x+=retained/.02;
   atomicStore(&blastRigWake,1u);damagePart(i,pressure*2.7*frame.rayD.w);atomicMax(&work[fractureState(i)+7u],u32(pressure*40000));

 }
 workgroupBarrier();if(atomicLoad(&blastRigWake)!=0u){b.motor.w=0;b.status.z=0;}bodies[i]=b;
}
// Pressure moves finite mobile film outwards. It cannot move a dry stain or
// cross a solid obstacle. Donors read the snapshot; all writes are atomic sums.
@compute @workgroup_size(256) fn blastFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();
 let rec=filmRecordID;let r=record(rec);if(propGone(r.center.w)){return;}let dims=filmDimensions(r);let local=(group.x-u32(r.extra.w))*256u+lane;if(local>=dims.x*dims.y){return;}
 let cell=vec2u(local%dims.x,local/dims.x);let address=u32(r.extra.z)+local;let mass=filmRead(1u,address);if(mass<.002){return;}
 let p=r.center.xyz+r.u.xyz*((f32(cell.x)+.5)/r.u.w-.5)*r.size.x+r.v.xyz*((f32(cell.y)+.5)/r.v.w-.5)*r.size.y;
 let controlAddress=destructionMeta();let mask=atomicLoad(&work[controlAddress]);var displacement=vec2f(0);var lift=0.0;
 for(var slot=0u;slot<16u;slot++){
  if((mask&(1u<<slot))==0u){continue;}let s=blastState(slot);let age=frame.camera.w-ordFloat(s+4u);if(age<-.02||age>.22){continue;}
  let center=ordVector(s);let delta=p-center;let distance=length(delta);let radius=ordFloat(s+3u);if(distance>=radius||dot(center-p,r.n.xyz)<-.01||!blastVisibility(center,p+r.n.xyz*.003)){continue;}
  let pressure=pow(1-distance/radius,1.4)*ordFloat(s+5u)*exp(-max(0,age)*13);let tangent=vec2f(dot(delta,r.u.xyz),dot(delta,r.v.xyz));
  displacement+=tangent/max(length(tangent),.035)*pressure*6*frame.settings.y;lift=max(lift,pressure);
 }
 if(dot(displacement,displacement)<1e-8){return;}
 let area=r.size.x*r.size.y/f32(dims.x*dims.y);let wanted=u32(round(mass*clamp(lift*.8,0,.7)*FILM_SCALE));let taken=takeWet(filmOffset(0u)+address,wanted);if(taken==0u){return;}
 let volume=f32(taken)/FILM_SCALE*area;var airborne=0.0;
 if(lift>.12&&hash(address*977u+atomicLoad(&work[5])*73u)<.045&&atomicAdd(&work[controlAddress+1u],1u)<72u){
  let carried=volume*.30;let velocity=(r.u.xyz*displacement.x+r.v.xyz*displacement.y)/max(frame.settings.y,.001)+r.n.xyz*(1+lift*3);
  if(launchDrop(p+r.n.xyz*.025,velocity,.006+hash(address)*.008,999u,carried)){airborne=carried;atomicAdd(&work[61],u32(round(carried*65536)));}
 }
 var destination=clamp(uv(r,p)+displacement/r.size.xy,vec2f(.0001),vec2f(.9999));var receiver=rec;
 var point=r.center.xyz+r.u.xyz*((destination.x-.5)*r.size.x)+r.v.xyz*((destination.y-.5)*r.size.y);
 if(rec<16u){point=p+r.u.xyz*displacement.x+r.v.xyz*displacement.y;point.x=clamp(point.x,-7.999,7.999);point.z=clamp(point.z,-7.999,7.999);receiver=floorRecord(point);}
 returnFilm(receiver,point,volume-airborne);
 atomicStore(&wet[filmOffset(5u)+address],bitcast<u32>(displacement.x/max(frame.settings.y,.001)));
 atomicStore(&wet[filmOffset(6u)+address],bitcast<u32>(displacement.y/max(frame.settings.y,.001)));
}
@compute @workgroup_size(1) fn blastBrush(){
 if(frame.settings.z<=0){return;}
 let mask=atomicLoad(&work[destructionMeta()]);if(mask==0u){return;}
 for(var slot=0u;slot<16u;slot++){
  if((mask&(1u<<slot))==0u){continue;}let s=blastState(slot);let age=frame.camera.w-ordFloat(s+4u);if(age<-.05||age>.22){continue;}
  let center=ordVector(s);let radius=ordFloat(s+3u);let strength=ordFloat(s+5u)*exp(-max(0,age)*13);
  for(var rec=0u;rec<header(0).z;rec++){
   let r=record(rec);if(propGone(r.center.w)){continue;}let d=dot(center-r.center.xyz,r.n.xyz);if(d<-.01||d>=radius){continue;}
   let p=center-r.n.xyz*d;let extent=sqrt(radius*radius-d*d);let c=uv(r,p);
   if(any(c+vec2f(extent)/r.size.xy<vec2f(0))||any(c-vec2f(extent)/r.size.xy>vec2f(1))){continue;}
   let nearest=r.center.xyz+r.u.xyz*((clamp(c.x,0,1)-.5)*r.size.x)+r.v.xyz*((clamp(c.y,0,1)-.5)*r.size.y);if(!blastVisibility(center,nearest)){continue;}
   contactStamp(rec,p,p,vec2f(extent),vec2f(extent),0,0,strength,12,atomicLoad(&work[s+6u]),0);
  }
 }
}
fn blastPaintVelocity(s:Stamp,r:Record,pixel:vec2f)->vec2f{
 let p=pixel/r.size.zw;let delta=(p-s.a.xy)*r.size.xy;let distance=length(delta);let radius=s.a.z*r.size.x;
 let force=pow(max(0,1-distance/max(radius,.001)),1.4)*s.b.w;
 let address=filmPosition(u32(s.info.x),vec2i(floor(p*vec2f(filmDimensions(r)))));if(address<0){return vec2f(0);}let wetness=smoothstep(.006,.08,filmRead(1u,u32(address)));
 return delta/max(distance,.03)*force*wetness*2.5;
}

fn paintPushVelocity(s:Stamp,r:Record,p:vec2f)->vec2f{if(s.info.y==12){return blastPaintVelocity(s,r,p);}return contactVelocity(s,r,p);}
