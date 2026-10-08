// Shared prop slots 18-21 form one crusher; 22 is the spring pad, 23 the sweeper.
// Moving machine colliders and their paint charts use the same resident poses.
fn machineOwner(id:u32)->u32{return select(id,18u,id>=19u&&id<=21u);}
fn machinePose(id:u32,p:vec3f,q:vec4f,v:vec3f,w:vec3f){let s=propData(id);constants[s+8u]=constants[s];constants[s+9u]=constants[s+1u];constants[s]=vec4f(p,0);constants[s+1u]=q;constants[s+2u]=vec4f(v,0);constants[s+3u]=vec4f(w,0);if(length(v)+length(w)==0){constants[s+8u]=constants[s];constants[s+9u]=q;}syncProp(id);}
fn wakeMachineNeighbors(id:u32){let b=propBody(id);for(var i=8u;i<128u;i++){let s=ordnanceState(i);if(!restingFragment(atomicLoad(&work[s+23u]))){continue;}let p=rotate(inverseQ(b.q),ordVector(s)-b.p.xyz);if(length(max(abs(p)-b.half.xyz,vec3f(0)))<ordFloat(s+3u)+.05){atomicStore(&work[s+20u],0u);}}for(var i=0u;i<18u;i++){if(propGone(f32(i+1u))){continue;}let other=propBody(i);if(boxesOverlap(b.p.xyz,b.q,b.half.xyz+vec3f(.045),other.p.xyz,other.q,other.half.xyz)){constants[propData(i)+14u]=vec4f(0);}}for(var i=0u;i<u32(frame.settings.x);i++){let p=rotate(inverseQ(b.q),bodies[i].p.xyz-b.p.xyz);if(length(max(abs(p)-b.half.xyz,vec3f(0)))<bodies[i].invI.w+.05){bodies[i].status.x=1;bodies[i].status.z=0;}}}
fn activateCrusher(){
 if(propCount()<24u||propGone(19)){return;}let b=propBody(18u);
 for(var id=19u;id<=21u;id++){let s=propData(id);atomicAnd(&work[19],~(1u<<id));constants[s+15u].x=1;for(var k=0u;k<8u;k++){atomicStore(&work[propState(id)+k],0u);atomicStore(&work[utilityProp(id)+k],0u);}}
 machinePose(19u,b.p.xyz+rotate(b.q,vec3f(0,1.86,0)),b.q,vec3f(0),vec3f(0));
 for(var id=20u;id<=21u;id++){machinePose(id,b.p.xyz+rotate(b.q,vec3f(select(-.96,.96,id==21u),1.1,0)),b.q,vec3f(0),vec3f(0));}
}
fn removeMachine(id:u32){let first=machineOwner(id);let count=select(1u,4u,first==18u);for(var n=0u;n<count;n++){let slot=first+n;drainUtilityProp(slot);atomicOr(&work[19],1u<<slot);constants[propData(slot)+15u].x=0;}}
fn machineSound(kind:u32,strength:f32){atomicMax(&work[38],0x08000000u|((kind&3u)<<24u)|(u32(clamp(strength,0,1)*4095)<<8u)|255u);atomicAdd(&work[39],1u);}
fn debrisFilmPush(rec:u32,p:vec3f,velocity:vec3f,radius:f32){
 let r=record(rec);let dims=filmDimensions(r);let center=vec2i(uv(r,p)*vec2f(dims));let area=r.size.x*r.size.y/f32(dims.x*dims.y);let tangent=velocity-r.n.xyz*dot(velocity,r.n.xyz);if(length(tangent)<.18){return;}
 var donors:array<f32,9>;let stride=max(1,i32(radius*40*.65));
 for(var n=0u;n<9u;n++){let cell=center+vec2i(i32(n%3u)-1,i32(n/3u)-1)*stride;let address=filmPosition(rec,cell);if(address<0){continue;}let mass=filmRead(0u,u32(address));let taken=takeWet(filmOffset(0u)+u32(address),u32(max(0,mass-.003)*min(.22,length(tangent)*.015)*FILM_SCALE));donors[n]=f32(taken)/FILM_SCALE*area;}
 for(var n=0u;n<9u;n++){let cell=center+vec2i(i32(n%3u)-1,i32(n/3u)-1)*stride;let point=r.center.xyz+r.u.xyz*((f32(cell.x)+.5)/f32(dims.x)-.5)*r.size.x+r.v.xyz*((f32(cell.y)+.5)/f32(dims.y)-.5)*r.size.y;let destination=point+bounded(tangent*.025,.22);returnFilm(select(rec,floorRecord(destination),rec<16u),destination,donors[n]);}
}
fn crusherInjury(index:u32,pressure:f32){
 var b=bodies[index];let amount=min(min(b.coat.w,max(0,1.65-b.coat.x)/5),pressure*.012*frame.rayD.w*frame.action.z);b.coat.w-=amount;b.coat.x+=amount*5;b.blood.x=min(2,b.blood.x+pressure*.04*frame.rayD.w);b.blood.w=max(0,b.blood.w-pressure*.6*frame.rayD.w);damagePart(index,pressure*.018*frame.rayD.w);b.motor.w=0;b.status.x=1;b.status.z=0;bodies[index]=b;
 // Coating receives exactly the reserve's equivalent volume (one reserve=.1).
 atomicAdd(&work[utilityBase()+22u],1u);
}
@compute @workgroup_size(1) fn machineStep(){
 if(propCount()<24u){return;}let dt=1.0/120;
 if(!propGone(19)){
  let base=propBody(18u);let u=utilityProp(18u);let on=atomicLoad(&work[u+1u])!=0u;var phase=ordFloat(u+2u);if(on){phase+=dt;atomicStore(&work[u+2u],bitcast<u32>(phase));}
  let cycle=phase%4.2;let height=select(select(1.86,mix(1.86,.36,clamp((cycle-.75)/1.35,0,1)),cycle>=.75),mix(.36,1.86,clamp((cycle-2.50)/1.15,0,1)),cycle>=2.50);
  let p=base.p.xyz+rotate(base.q,vec3f(0,height,0));let v=(p-propBody(19u).p.xyz)/dt;machinePose(19u,p,base.q,v,vec3f(0));
  if(on){wakeMachineNeighbors(19u);}
  if(on&&cycle>=.75&&cycle<2.5){
   let bottom=height-.11;for(var i=0u;i<u32(frame.settings.x);i++){let b=bodies[i];let local=rotate(inverseQ(base.q),b.p.xyz-base.p.xyz);if(abs(local.x)>.72||abs(local.z)>.58||local.y<.1||local.y>bottom+.2){continue;}var upper=-100.0;var lower=100.0;for(var k=0u;k<u32(b.half.w);k++){let sphere=sample(b,k);let point=rotate(inverseQ(base.q),b.p.xyz+rotate(b.q,sphere.xyz)-base.p.xyz);upper=max(upper,point.y+sphere.w);lower=min(lower,point.y-sphere.w);}let pressure=clamp((upper-bottom+.035)*12,0,3);if(pressure>.05&&lower<bottom){crusherInjury(i,pressure);}}
   for(var i=0u;i<18u;i++){if(propGone(f32(i+1u))){continue;}let b=propBody(i);let local=rotate(inverseQ(base.q),b.p.xyz-base.p.xyz);let up=rotate(inverseQ(b.q),rotate(base.q,vec3f(0,1,0)));let extent=dot(abs(up),b.half.xyz);if(abs(local.x)<.73&&abs(local.z)<.58&&local.y-extent<bottom&&local.y+extent>bottom-.025){propDamage(f32(i+1u),dt*5.5);}}
   if(cycle>2.10&&cycle<2.10+dt){machineSound(0u,.8);}
  }
 }
 if(!propGone(24)){
  let s=propData(23u);let u=utilityProp(23u);let on=atomicLoad(&work[u+1u])!=0u;var phase=ordFloat(u+2u);if(on){phase+=dt*3.6;atomicStore(&work[u+2u],bitcast<u32>(phase));}let q=quatMul(constants[s+10u],yawQ(phase));machinePose(23u,constants[s].xyz,q,vec3f(0),rotate(constants[s+10u],vec3f(0,select(0.0,3.6,on),0)));if(on){wakeMachineNeighbors(23u);}
 }
 if(!propGone(23)&&atomicLoad(&work[utilityProp(22u)+1u])!=0u){
  let b=propBody(22u);let u=utilityProp(22u);if(frame.camera.w<ordFloat(u+3u)){return;}let normal=rotate(b.q,vec3f(0,1,0));let impulse=rotate(b.q,vec3f(0,3.2,-6));var launched=false;
  for(var rig=0u;rig<u32(frame.settings.x)/15u;rig++){var touching=false;for(var k=0u;k<15u;k++){let actor=bodies[rig*15u+k];for(var n=0u;n<u32(actor.half.w);n++){let sphere=sample(actor,n);let p=rotate(inverseQ(b.q),actor.p.xyz+rotate(actor.q,sphere.xyz)-b.p.xyz);if(abs(p.x)<.675&&abs(p.z)<.55&&p.y-sphere.w>.10&&p.y-sphere.w<.21&&dot(actor.v.xyz,normal)<2){touching=true;}}}if(touching){for(var k=0u;k<15u;k++){let i=rig*15u+k;bodies[i].v=vec4f(bounded(bodies[i].v.xyz+impulse,21),0);bodies[i].motor.w=0;bodies[i].status.x=1;bodies[i].status.z=0;}launched=true;}}
  for(var i=0u;i<18u;i++){if(propGone(f32(i+1u))){continue;}let actor=propBody(i);let p=rotate(inverseQ(b.q),actor.p.xyz-b.p.xyz);let support=dot(abs(rotate(inverseQ(actor.q),normal)),actor.half.xyz);if(abs(p.x)<.675&&abs(p.z)<.55&&p.y-support>.10&&p.y-support<.21&&dot(actor.v.xyz,normal)<2){propImpulse(f32(i+1u),actor.p.xyz,impulse/max(actor.p.w,.01));launched=true;}}
  for(var i=8u;i<128u;i++){let s=ordnanceState(i);if(atomicLoad(&work[s+23u])==0u){continue;}let p=rotate(inverseQ(b.q),ordVector(s)-b.p.xyz);let radius=ordFloat(s+3u);if(abs(p.x)<.675&&abs(p.z)<.55&&p.y-radius>.10&&p.y-radius<.21){putVector(s+4u,ordVector(s+4u)+impulse);atomicStore(&work[s+20u],0u);launched=true;}}
  if(launched){atomicStore(&work[u+3u],bitcast<u32>(frame.camera.w+.9));atomicAdd(&work[utilityBase()+24u],1u);machineSound(1u,.65);}
 }
}
fn demoProp(id:u32,p:vec3f,yaw:f32,on:bool){let s=propData(id);constants[s]=vec4f(p,constants[s].w);constants[s+1u]=yawQ(yaw);constants[s+10u]=yawQ(yaw);constants[s+2u]=vec4f(0);constants[s+3u]=vec4f(0);constants[s+14u]=vec4f(0);constants[s+15u].x=1;atomicAnd(&work[19],~(1u<<id));syncProp(id);resetUtilityProp(id);atomicStore(&work[utilityProp(id)+1u],select(0u,1u,on));}
fn demoPool(center:vec3f,volume:f32){
 var weight=0.0;for(var y=-7;y<=7;y++){for(var x=-11;x<=11;x++){let p=vec2f(f32(x)/11,f32(y)/7);weight+=max(0,1-dot(p,p));}}
 for(var y=-7;y<=7;y++){for(var x=-11;x<=11;x++){let p=vec2f(f32(x)/11,f32(y)/7);let point=center+vec3f(p.x*2.0,0,p.y*1.2);let amount=volume*max(0,1-dot(p,p))/weight;returnFilm(floorRecord(point),point,amount);}}
}
fn buildJunkDemo(mode:u32){
 for(var i=0u;i<propCount();i++){atomicOr(&work[19],1u<<i);constants[propData(i)+15u].x=0;atomicStore(&work[utilityProp(i)],0u);}
 let center=vec3f(-2.6,0,3.3);demoPool(center,1.1);demoPool(vec3f(.3,0,3.3),.65);
 if(mode==0u){demoProp(18u,center+vec3f(0,.15,0),0,false);demoProp(12u,center+vec3f(1.7,.43,.6),0,false);demoProp(14u,center+vec3f(-.55,.66,-.50),0,false);demoProp(16u,vec3f(-.8,.33,3.3),0,false);}
 else if(mode==1u){demoProp(22u,center+vec3f(0,.16,0),0,false);demoProp(14u,center+vec3f(-.29,.71,.1),0,false);demoProp(16u,center+vec3f(.27,.68,0),0,false);demoProp(12u,center+vec3f(0,.43,-2.8),0,false);demoProp(13u,center+vec3f(1.0,.43,-2.8),.3,false);demoProp(10u,vec3f(-4,.55,1.7),1.570796,false);}
 else{demoProp(23u,center+vec3f(0,.165,0),0,false);demoProp(16u,center+vec3f(.70,.33,.45),0,false);demoProp(17u,center+vec3f(-.72,.33,-.42),0,false);demoProp(14u,center+vec3f(.15,.36,-.72),0,false);demoProp(15u,center+vec3f(-.15,.36,.72),0,false);demoProp(12u,center+vec3f(.90,.43,.55),1.57,false);demoProp(22u,vec3f(.2,.16,3.3),0,false);}
 for(var i=0u;i<u32(frame.settings.x);i++){let rig=i/15u;let root=select(select(vec3f(2.4,0,3.3),vec3f(4.5,0,2.3),rig==2u),select(center+vec3f(0,.31,0),vec3f(-2.6,0,5.2),mode!=0u),rig==0u);let bind=header(3).w+i*2u;var b=bodies[i];b.p=vec4f(root+constants[bind].xyz,b.p.w);b.q=constants[bind+1u];if(mode==0u&&rig==0u){let rotation=quatMul(yawQ(.785398),vec4f(0,0,.70710678,.70710678));b.p=vec4f(center+vec3f(0,.48,0)+rotate(rotation,constants[bind].xyz-vec3f(0,.975,0)),b.p.w);b.q=quatMul(rotation,b.q);}b.prevP=b.p;b.prevQ=b.q;b.v=vec4f(0);b.w=vec4f(0);b.motor=vec4f(root.x,0,root.z,0);b.status.x=1;b.status.z=0;bodies[i]=b;}
 atomicStore(&work[utilityBase()+25u],(mode+1u)|65536u);
}

// This is a short, occluded ray to the actual switch, not a remote selected-prop action.
fn machineControlHit()->u32 {
 var controlHit=0u;var nearest=3.0;let direction=safeNorm(frame.rayD.xyz);
 for(var id=0u;id<propCount();id++){
  let s=propData(id);let kind=constants[s+6u].w;
  if(propGone(f32(id+1u))||!machineKind(kind)){continue;}
  var q=constants[s+1u];if(kind==13){q=constants[s+10u];}
  let origin=rotate(inverseQ(q),frame.rayO.xyz-constants[s].xyz);let ray=rotate(inverseQ(q),direction);
  let button=machineControlPoint(kind);if(ray.z>=-.03){continue;}
  let t=(button.z+.065-origin.z)/ray.z;if(t<0||t>nearest){continue;}
  let delta=(origin+ray*t-button).xy;if(any(abs(delta)>vec2f(.105,.125))){continue;}
  let obstruction=rayHit(frame.rayO.xyz,direction,max(0,t-.035),true,-1);
  if(obstruction.t<t-.04){continue;}
  nearest=t;controlHit=id+1u;
 }
 if(controlHit!=0u&&atomicLoad(&work[utilityProp(controlHit-1u)+1u])!=0u){controlHit|=256u;}
 return controlHit;
}
fn pressMachineControl(){
 let controlHit=machineControlHit()&255u;if(controlHit==0u){return;}let id=controlHit-1u;let u=utilityProp(id);
 if((atomicLoad(&work[utilityBase()+25u])&65536u)!=0u){runContraption();}
 else{atomicStore(&work[u+1u],1u-min(1u,atomicLoad(&work[u+1u])));}
 atomicStore(&work[u+4u],bitcast<u32>(frame.camera.w+.20));
}
