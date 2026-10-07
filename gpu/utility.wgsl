// Finite tool/bucket reservoirs use volume units, not film-cell thickness.
const VOLUME_SCALE:f32=16777216.0;
fn toolID()->u32{return (u32(frame.settings.w)>>8u)&15u;}
fn toolLeft()->bool{return (u32(frame.settings.w)&65536u)!=0u;}
fn toolRight()->bool{return (u32(frame.settings.w)&131072u)!=0u;}
// Return after the CAS loop so Naga sees an explicit value on every exit path.
fn takeStored(address:u32,wanted:u32)->u32{var old=atomicLoad(&work[address]);var amount=0u;loop{amount=min(old,wanted);let r=atomicCompareExchangeWeak(&work[address],old,old-amount);if(r.exchanged){break;}old=r.old_value;}return amount;}
fn storeVolume(address:u32,volume:f32,capacity:f32)->f32{let wanted=u32(max(0,volume)*VOLUME_SCALE);let limit=u32(capacity*VOLUME_SCALE);var old=atomicLoad(&work[address]);var added=0u;loop{added=min(wanted,limit-min(old,limit));let r=atomicCompareExchangeWeak(&work[address],old,old+added);if(r.exchanged){break;}old=r.old_value;}return f32(added)/VOLUME_SCALE;}
fn resetUtilityProp(i:u32){let u=utilityProp(i);for(var k=0u;k<8u;k++){atomicStore(&work[u+k],0u);}if(propGone(f32(i+1u))){return;}let kind=u32(constants[propData(i)+6u].w);if(kind==3u){atomicStore(&work[u],u32(.5*VOLUME_SCALE));}if(kind>=4u){atomicStore(&work[u+1u],1u);}}
fn drainUtilityProp(i:u32){let u=utilityProp(i);let volume=f32(atomicExchange(&work[u],0u))/VOLUME_SCALE;if(volume>0){let p=constants[propData(i)].xyz;returnFilm(floorRecord(p),vec3f(p.x,0,p.z),volume);}}
fn utilityVisible(origin:vec3f,p:vec3f)->bool{let delta=p-origin;let d=length(delta);let hit=rayHit(origin,safeNorm(delta),max(0,d-.06),false,-1);if(hit.t>=d-.07){return true;}if(hit.surface>=0){let tag=record(u32(hit.surface)).center.w;if(tag>0){let b=propBody(u32(tag)-1u);return pointBox(p,b.p.xyz,b.q,b.half.xyz,b.half.w).depth>=-.03;}}return false;}
fn coneForce(origin:vec3f,axis:vec3f,p:vec3f,lengthLimit:f32,width:f32)->f32{let delta=p-origin;let along=dot(delta,axis);if(along<0||along>lengthLimit){return 0;}let radial=length(delta-axis*along);let radius=.18+along*width;if(radial>radius){return 0;}let distance=length(delta);if(distance>.04&&!utilityVisible(origin,p)){return 0;}return (1-radial/radius)*(1-along/lengthLimit);}
fn fanForce(p:vec3f)->vec3f{var force=vec3f(0);for(var i=8u;i<propCount();i++){if(propGone(f32(i+1u))||constants[propData(i)+6u].w!=4||atomicLoad(&work[utilityProp(i)+1u])==0u){continue;}let b=propBody(i);let axis=rotate(b.q,vec3f(0,0,1));let origin=b.p.xyz+rotate(b.q,vec3f(0,.14,.36));force+=axis*coneForce(origin,axis,p,7,.35)*32;}return force;}
fn beltVelocity(p:vec3f,radius:f32)->vec3f{var velocity=vec3f(0);for(var i=8u;i<propCount();i++){if(propGone(f32(i+1u))||constants[propData(i)+6u].w!=5||atomicLoad(&work[utilityProp(i)+1u])==0u){continue;}let b=propBody(i);let local=rotate(inverseQ(b.q),p-b.p.xyz);if(abs(local.x)<b.half.x+.06&&abs(local.z)<b.half.z+.04&&abs(local.y-b.half.y-radius)<.12){velocity=rotate(b.q,vec3f(8,0,0));}}return velocity;}
fn utilityWind(p:vec3f)->vec3f{var force=vec3f(0);if(atomicLoad(&work[utilityBase()+31u])!=0u){force=fanForce(p);}if(toolLeft()&&(toolID()==7u||toolID()==8u)){let axis=safeNorm(frame.rayD.xyz);force+=axis*coneForce(frame.rayO.xyz,axis,p,7,select(.30,.09,toolID()==8u))*25;}return force;}
fn utilityAim()->RayHit{return rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),select(8.0,2.6,toolID()==6u),true,-1);}
@compute @workgroup_size(1) fn utilityForces(){
 let u=utilityBase();let tool=toolID();let left=toolLeft();let right=toolRight();let axis=safeNorm(frame.rayD.xyz);let origin=frame.rayO.xyz;let dt=1.0/120;
 if(left&&tool>=6u&&tool<=9u){let hit=utilityAim();putVector(u+4u,hit.p);atomicStore(&work[u+7u],u32(hit.surface+1));}else{atomicStore(&work[u+7u],0u);}
 var devices=false;for(var i=8u;i<propCount();i++){if(!propGone(f32(i+1u))&&constants[propData(i)+6u].w>=4&&atomicLoad(&work[utilityProp(i)+1u])!=0u){devices=true;}}
 let enabled=(left&&tool>=6u&&tool<=9u)||devices;atomicStore(&work[u+28u],select(0u,header(3).y,enabled));atomicStore(&work[u+29u],1u);atomicStore(&work[u+30u],1u);atomicStore(&work[u+31u],select(0u,1u,devices));
 // Wring only into an aimed bucket. Transfers return any capacity overflow.
 if(right&&tool==6u){let hit=utilityAim();if(hit.surface>=0){let tag=record(u32(hit.surface)).center.w;if(tag>0&&constants[propData(u32(tag)-1u)+6u].w==3){let amount=f32(takeStored(u,u32(.8*dt*VOLUME_SCALE)))/VOLUME_SCALE;let kept=storeVolume(utilityProp(u32(tag)-1u),amount,1);storeVolume(u,amount-kept,.25);}}}
 if(right&&tool==9u&&atomicLoad(&work[5])%3u==0u){let amount=f32(takeStored(u+1u,u32(.004*VOLUME_SCALE)))/VOLUME_SCALE;if(amount>0&&!launchDrop(origin+axis*.5,axis*12,.012,999u,amount)){storeVolume(u+1u,amount,2);}let wood=atomicLoad(&work[u+3u])>0u;if(atomicLoad(&work[u+2u])>0u&&spawnOrdnance(select(2u,3u,wood),origin+axis*.55,axis*14,.028,atomicLoad(&work[5]))){atomicSub(&work[u+2u],1u);if(wood){atomicSub(&work[u+3u],1u);}}}
 // Tilting or throwing a bucket spills its finite payload from its actual rim.
 for(var i=8u;i<propCount();i++){if(propGone(f32(i+1u))||constants[propData(i)+6u].w!=3){continue;}let b=propBody(i);let up=rotate(b.q,vec3f(0,1,0));let motion=length(b.v.xyz);if(up.y>.72&&motion<3){continue;}let rate=select(.14,.45,motion>3);let amount=f32(takeStored(utilityProp(i),u32(rate*dt*VOLUME_SCALE)))/VOLUME_SCALE;if(amount<=0){continue;}let rim=b.p.xyz+up*b.half.y+safeNorm(vec3f(up.x,-.25,up.z))*.22;if(!launchDrop(rim,b.v.xyz+safeNorm(vec3f(up.x,-1,up.z))*.5,.015,999u,amount)){storeVolume(utilityProp(i),amount,1);}}
}
@compute @workgroup_size(1) fn utilityBrush(){
 if(frame.settings.z<=0||!toolLeft()||toolID()<6u||toolID()>9u){return;}let tool=toolID();let hit=utilityAim();if(hit.surface<0){return;}let u=utilityBase();let rec=u32(hit.surface);var previous=hit.p;if(atomicLoad(&work[u+11u])==rec+1u){previous=ordVector(u+8u);if(distance(previous,hit.p)>.65){previous=hit.p;}}
 let radius=select(vec2f(.18),vec2f(.38,.16),tool==6u);if(tool==6u||tool==9u||tool==8u){contactSweep(rec,previous,hit.p,radius,radius,0,0,min(1.0,frame.settings.z*12),select(15.0,14.0,tool==8u),71u,frame.camera.w);}
 if(tool==6u){contactSweep(rec,previous,hit.p,radius,radius,0,0,1.2,3,71u,frame.camera.w);if(atomicLoad(&work[u])>u32(.225*VOLUME_SCALE)){contactSweep(rec,previous,hit.p,radius,radius,0,0,.20,13,71u,frame.camera.w);}}
 putVector(u+12u,hit.p-previous);putVector(u+8u,hit.p);atomicStore(&work[u+11u],rec+1u);
}
@compute @workgroup_size(256) fn utilityFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();let rec=filmRecordID;let r=record(rec);if(propGone(r.center.w)){return;}let dims=filmDimensions(r);let k=(group.x-u32(r.extra.w))*256u+lane;if(k>=dims.x*dims.y){return;}let cell=vec2u(k%dims.x,k/dims.x);let address=u32(r.extra.z)+k;
 let p=r.center.xyz+r.u.xyz*((f32(cell.x)+.5)/r.u.w-.5)*r.size.x+r.v.xyz*((f32(cell.y)+.5)/r.v.w-.5)*r.size.y;let area=r.size.x*r.size.y/f32(dims.x*dims.y);let mass=filmRead(1u,address);let dt=min(.05,frame.settings.z);let tool=toolID();let u=utilityBase();var wind=vec3f(0);if(atomicLoad(&work[u+31u])!=0u&&mass>.003){wind=fanForce(p)*.17;}
 if(toolLeft()&&tool==7u&&mass>.003){wind+=safeNorm(frame.rayD.xyz)*coneForce(frame.rayO.xyz,safeNorm(frame.rayD.xyz),p,7,.30)*7;}
 if(length(wind)>.02){let tangent=wind-r.n.xyz*dot(wind,r.n.xyz);let amount=takeWet(filmOffset(0u)+address,u32(mass*min(.65,length(wind)*dt)*FILM_SCALE));let volume=f32(amount)/FILM_SCALE*area;var spray=0.0;
  if(length(wind)>1.5&&hash(address+atomicLoad(&work[5])*73u)<.004&&atomicAdd(&work[destructionMeta()+1u],1u)<72u){if(launchDrop(p+r.n.xyz*.025,tangent+r.n.xyz*.7,.007,999u,volume*.18)){spray=volume*.18;}}
  let destination=p+tangent*dt;returnFilm(select(rec,floorRecord(destination),rec<16u),destination,volume-spray);
 }
 if(!toolLeft()||(tool!=6u&&tool!=8u&&tool!=9u)){return;}let hitID=i32(atomicLoad(&work[u+7u]))-1;if(hitID<0||(u32(hitID)!=rec&&!(rec<16u&&hitID<16))){return;}let d=p-ordVector(u+4u);let footprint=select(length(d)<.24,abs(dot(d,r.u.xyz))<.38&&abs(dot(d,r.v.xyz))<.16&&abs(dot(d,r.n.xyz))<.04,tool==6u);if(!footprint){return;}
 if(tool==8u){let a=takeWet(filmOffset(0u)+address,u32(mass*min(.9,dt*22)*FILM_SCALE));let dry=takeWet(filmOffset(2u)+address,u32(filmRead(2u,address)*min(.7,dt*9)*FILM_SCALE));var down=vec3f(0,-1,0)+r.n.xyz*r.n.y;if(length(down)<.05){down=safeNorm(d+r.u.xyz*.03);}let destination=p+safeNorm(down)*.32;returnFilm(select(rec,floorRecord(destination),rec<16u),destination,f32(a+dry)/FILM_SCALE*area);return;}
 if(tool==6u){let motion=ordVector(u+12u);if(length(motion)>.001){let pushed=takeWet(filmOffset(0u)+address,u32(mass*min(.6,length(motion)*5)*FILM_SCALE));let destination=p+safeNorm(motion)*min(.30,length(motion)*constants[header(3).z+1u].x);let dest=select(rec,floorRecord(destination),rec<16u);returnFilm(dest,destination,f32(pushed)/FILM_SCALE*area);}}
 let tank=u+select(0u,1u,tool==9u);let capacity=select(.25,2.0,tool==9u);let taken=takeWet(filmOffset(0u)+address,u32(mass*min(.8,dt*10)*FILM_SCALE));let volume=f32(taken)/FILM_SCALE*area;let stored=storeVolume(tank,volume,capacity);if(volume>stored){returnFilm(rec,p,volume-stored);}
 if(tool==6u&&atomicLoad(&work[u])>u32(.225*VOLUME_SCALE)&&mass<.02){let v=f32(takeStored(u,u32(area*dt*.025*VOLUME_SCALE)))/VOLUME_SCALE;returnFilm(rec,p,v);}
}
fn utilitySecondary(){
 let tool=toolID();if(tool==10u){let axis=safeNorm(frame.rayD.xyz);let origin=frame.rayO.xyz;for(var i=0u;i<propCount();i++){let b=propBody(i);if(!propGone(f32(i+1u))&&b.half.w==2&&distance(b.p.xyz,origin+axis*1.9)<2.1){propImpulse(f32(i+1u),b.p.xyz,axis*18/max(b.p.w,.01));}}for(var i=8u;i<128u;i++){let s=ordnanceState(i);if(atomicLoad(&work[s+23u])==2u&&distance(ordVector(s),origin+axis*1.6)<2.1){putVector(s+4u,axis*27);}}}
}
fn toggleUtilityProp(){let hit=utilityAim();var id=999u;if(frame.goal.w>=180){id=u32(frame.goal.w)-180u;}else if(hit.surface>=0){let tag=record(u32(hit.surface)).center.w;if(tag>0){id=u32(tag)-1u;}}if(id<propCount()&&constants[propData(id)+6u].w>=4){let u=utilityProp(id)+1u;atomicStore(&work[u],1u-min(1u,atomicLoad(&work[u])));}}

// Independent actors share read-only fan poses; impulses and reservoirs are atomic.
@compute @workgroup_size(64) fn utilityActors(@builtin(global_invocation_id) thread:vec3u){
 let u=utilityBase();let tool=toolID();let left=toolLeft();let powered=left&&tool>=7u&&tool<=10u;let devices=atomicLoad(&work[u+31u])!=0u;if(!powered&&!devices){return;}
 let axis=safeNorm(frame.rayD.xyz);let origin=frame.rayO.xyz;let dt=1.0/120;let index=thread.x;
 if(index<180u){let i=index;if(i>=u32(frame.settings.x)){return;}var b=bodies[i];var acceleration=fanForce(b.p.xyz);let belt=beltVelocity(b.p.xyz,b.invI.w*.65);if(length(belt)>0){acceleration+=(belt-b.v.xyz)*10;}
  if(left&&(tool==7u||tool==8u)){acceleration+=axis*coneForce(origin,axis,b.p.xyz,select(7.0,5.0,tool==8u),select(.30,.09,tool==8u))*select(20.0,32.0,tool==8u);}
  if(length(acceleration)>.05){b.v=vec4f(bounded(b.v.xyz+acceleration*dt,21),0);b.motor.w=0;b.status.x=1;b.status.z=0;bodies[i]=b;}return;
 }
 if(index<180u+propCount()){let i=index-180u;if(propGone(f32(i+1u))){return;}let b=propBody(i);var force=fanForce(b.p.xyz)*2;let belt=beltVelocity(b.p.xyz,b.half.y);if(length(belt)>0){force+=(belt-b.v.xyz)*18/max(b.p.w,.01);}
  if(left&&(tool==7u||tool==8u)){force+=axis*coneForce(origin,axis,b.p.xyz,7,select(.3,.09,tool==8u))*65;}
  if(left&&tool==10u&&b.half.w==2&&distance(origin,b.p.xyz)<7&&utilityVisible(origin,b.p.xyz)){force+=(bounded((origin+axis*1.9-b.p.xyz)*12,18)-b.v.xyz)*12/max(b.p.w,.01);}
  if(length(force)>.01){propImpulse(f32(i+1u),b.p.xyz,force*dt);}return;
 }
 let i=index-180u-propCount()+8u;if(i>=128u){return;}let state=ordnanceState(i);let kind=atomicLoad(&work[state+23u]);if(kind!=2u&&kind!=3u&&kind!=5u){return;}let p=ordVector(state);let v=ordVector(state+4u);var force=fanForce(p);
 if(left&&tool==9u&&kind!=5u&&coneForce(origin,axis,p,5,.25)>.1){var old=atomicLoad(&work[u+2u]);loop{if(old>=80u){break;}let result=atomicCompareExchangeWeak(&work[u+2u],old,old+1u);if(result.exchanged){atomicStore(&work[state+23u],0u);if(kind==3u){atomicAdd(&work[u+3u],1u);}return;}old=result.old_value;}}
 if(left&&tool==10u&&kind==2u&&distance(origin,p)<7&&blastVisibility(origin,p)){force+=(origin+axis*1.6-p)*25-v*7;}
 if(left&&(tool==7u||tool==8u)){force+=axis*coneForce(origin,axis,p,7,.3)*32;}let belt=beltVelocity(p,ordFloat(state+3u));if(length(belt)>0){force+=(belt-v)*12;}
 if(length(force)>.1){atomicStore(&work[state+20u],0u);putVector(state+4u,bounded(v+force*dt,32));}
}
fn utilityCollectDrop(i:u32)->bool{if(!toolLeft()||toolID()!=9u){return false;}let drop=particles[i];if(coneForce(frame.rayO.xyz,safeNorm(frame.rayD.xyz),drop.p.xyz,4,.24)<.08){return false;}let kept=storeVolume(utilityBase()+1u,drop.extra.x,2);particles[i].extra.x=max(0,drop.extra.x-kept);if(kept>=drop.extra.x&&atomicExchange(&work[64u+i],0u)!=0u){atomicSub(&work[9],1u);return true;}return false;}
