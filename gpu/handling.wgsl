// One grab, eight recent mass-weighted velocity samples. This occupies unused
// work words 964-1005, after the 900 particle occupancy words and before tiles.
fn throwVector(address:u32)->vec3f {
 return vec3f(contactFloat(address),contactFloat(address+1u),contactFloat(address+2u));
}
fn storeThrowVector(address:u32,value:vec3f){for(var k=0u;k<3u;k++){atomicStore(&work[address+k],bitcast<u32>(value[k]));}}
fn clearThrowSamples(){for(var k=964u;k<996u;k++){atomicStore(&work[k],0u);}}
// Clamp around the rig's centre of mass, using one scale for every relative
// velocity. Independent part clamps destroy net momentum when stretched joints
// generate equal-and-opposite contraction velocities. This keeps the same 21 m/s
// per-part ceiling without letting internal corrections brake the whole rig.
fn limitRigVelocity(){
 var center=vec3f(0);var mass=0.0;var peak=0.0;
 for(var k=0u;k<15u;k++){let b=localBodies[k];let m=1/max(b.p.w,.001);center+=b.v.xyz*m;mass+=m;peak=max(peak,length(b.v.xyz));}
 if(peak<=21){return;}
 center/=mass;let limited=bounded(center,21);var scale=1.0;
 for(var k=0u;k<15u;k++){
  let relative=localBodies[k].v.xyz-center;let a=dot(relative,relative);
  if(a<1e-8){continue;}
  let b=dot(limited,relative);let c=min(0.0,dot(limited,limited)-441);
  scale=min(scale,max(0.0,(-b+sqrt(max(0.0,b*b-a*c)))/a));
 }
 for(var k=0u;k<15u;k++){localBodies[k].v=vec4f(limited+(localBodies[k].v.xyz-center)*scale,0);}
}
fn rememberThrow(base:u32){
 if(frame.local.w<.5||u32(frame.goal.w)/15u!=base/15u){return;}
 let serial=u32(frame.local.w);let now=frame.camera.w+1.0/120;
 if(atomicLoad(&work[996])!=serial){
  clearThrowSamples();atomicStore(&work[996],serial);storeThrowVector(998u,frame.goal.xyz);
  storeThrowVector(1001u,vec3f(0));atomicStore(&work[1004],0u);atomicStore(&work[1005],0u);
 }
 let movement=frame.goal.xyz-throwVector(998u);let direction=throwVector(1001u);
 if(length(movement)>.002){
  if(dot(safeNorm(movement),direction)<-.25){clearThrowSamples();}
  storeThrowVector(1001u,safeNorm(movement));storeThrowVector(998u,frame.goal.xyz);
  atomicStore(&work[1004],bitcast<u32>(now));
 }
 var velocity=vec3f(0);var mass=0.0;var blocked=false;
 for(var k=0u;k<15u;k++){
  let b=localBodies[k];let m=1/max(b.p.w,.001);velocity+=b.v.xyz*m;mass+=m;
  let hit=worldImpacts[k];blocked=blocked||(hit.closing>2&&dot(hit.normal,throwVector(1001u))<-.4);
 }
 if(blocked){clearThrowSamples();atomicStore(&work[1005],bitcast<u32>(now));return;}
 let slot=964u+(u32(round(frame.camera.w*120))/2u)%8u*4u;
 storeThrowVector(slot,bounded(velocity/mass,21));atomicStore(&work[slot+3u],bitcast<u32>(now));
}
fn releaseThrow(){
 let serial=u32(-frame.local.w);if(serial==0u||atomicLoad(&work[996])!=serial){return;}
 atomicStore(&work[996],0u);
 let now=frame.camera.w;let movedAt=contactFloat(1004u);let blockedAt=contactFloat(1005u);
 if(movedAt<=0||now-movedAt>.115||(blockedAt>0&&now-blockedAt<.10)){return;}
 let base=u32(frame.goal.w)/15u*15u;var current=vec3f(0);var mass=0.0;
 for(var k=0u;k<15u;k++){let b=bodies[base+k];let m=1/max(b.p.w,.001);current+=b.v.xyz*m;mass+=m;}current/=mass;
 var direction=throwVector(1001u);let finalMove=frame.goal.xyz-throwVector(998u);
 // A last input event can arrive between animation frames. Respect its direction,
 // including a deliberate reversal, without inventing unachieved spring energy.
 if(length(finalMove)>.015){direction=safeNorm(finalMove);}
 var best=vec3f(0);var speed=0.0;
 for(var k=0u;k<8u;k++){
  let slot=964u+k*4u;let age=now-contactFloat(slot+3u);let v=throwVector(slot);
  if(age>=-.001&&age<=.10&&dot(safeNorm(v),direction)>.35){
   let retained=length(v)*(1-smoothstep(.075,.115,age));if(retained>speed){speed=retained;best=safeNorm(v)*retained;}
  }
 }
 if(speed<1.2||dot(current,best)<-speed*1.2){return;}
 let axis=safeNorm(best);let gain=max(0,speed-dot(current,axis));let boost=axis*min(gain,12.0);
 for(var k=0u;k<15u;k++){localBodies[k]=bodies[base+k];localBodies[k].v=vec4f(localBodies[k].v.xyz+boost,0);}
 limitRigVelocity();
 for(var k=0u;k<15u;k++){bodies[base+k].v=localBodies[k].v;}
 atomicAdd(&work[52],1u);
}
// A strongest-contact event per rig, independent of injuries or blood supply.
// Only a few bytes cross to Web Audio, asynchronously; poses stay on the GPU.
fn impactSound(base:u32){
 let now=frame.camera.w+1.0/120;let clock=40u+base/15u;
 if(now<contactFloat(clock)){return;}
 var best=0.0;var part=0u;
 for(var k=0u;k<15u;k++){
  let hit=worldImpacts[k];if(hit.receiver<0||hit.closing<1.5){continue;}
  let b=localBodies[k];let outgoing=b.v.xyz+cross(b.w.xyz,hit.point-b.p.xyz);
  let lost=min(hit.closing,max(0,dot(outgoing-hit.velocity,hit.normal)));
  let strength=smoothstep(1.2,12.0,lost)*clamp(sqrt(1/max(b.p.w,.001))*.55,.40,1.25);
  if(strength>best){best=strength;part=base+k;}
 }
 if(best<.045){return;}
 atomicStore(&work[clock],bitcast<u32>(now+.13));atomicAdd(&work[39],1u);
 atomicMax(&work[38],(u32(clamp(best,0,1)*4095)<<8u)|part);
}
