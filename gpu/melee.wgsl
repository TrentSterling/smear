// Kick and shove share an occluded close-range sweep; neither cuts joints.
fn brawlStrike(kick:bool){
 let forward=safeNorm(frame.rayD.xyz);let right=safeNorm(cross(forward,vec3f(0,1,0)));let up=safeNorm(cross(right,forward));let reach=select(1.65,1.9,kick);
 var best=RayHit(reach,frame.rayO.xyz+forward*reach,vec3f(0,1,0),-1,-1);var score=100.0;
 for(var x=-2;x<=2;x++){for(var y=-1;y<=1;y++){let hit=rayHit(frame.rayO.xyz,safeNorm(forward+right*f32(x)*.085+up*f32(y)*.07),reach,true,-1);let rank=hit.t+abs(f32(x))*.03+abs(f32(y))*.015;if(hit.t<reach&&rank<score){best=hit;score=rank;}}}
 atomicAdd(&work[utilityBase()+26u],1u);if(score==100){return;}let direction=safeNorm(forward+vec3f(0,select(.04,.20,kick),0));
 if(best.body>=0){let index=u32(best.body);let base=index/15u*15u;let standing=bodies[base+1u].motor.w>=1.5&&!kick&&!rigBroken(base);let speed=select(2.0,5.5,kick);
  atomicStore(&work[fractureState(base+1u)+2u],bitcast<u32>(frame.camera.w+.8));
  for(var n=0u;n<15u;n++){let i=base+n;if(component(i)!=component(index)){continue;}bodies[i].v=vec4f(bounded(bodies[i].v.xyz+direction*speed,21),0);bodies[i].status.x=1;bodies[i].status.z=0;if(!standing){bodies[i].motor.w=0;}else{bodies[i].motor.x+=direction.x*.18;bodies[i].motor.z+=direction.z*.18;}}
  bodies[index].blood.w=max(0,bodies[index].blood.w-select(4.0,12.0,kick)*frame.rayD.w);atomicAdd(&work[utilityBase()+27u],1u);
 }else if(best.surface>=0){propSurfaceImpulse(best.surface,best.p,direction*select(16.0,38.0,kick));hitProp(best.surface,select(.06,.23,kick));chipProp(best.surface,best.p,best.n,select(.25,.65,kick));if(kick){bulletLiquid(u32(best.surface),best.p,forward,.6,atomicLoad(&work[5]));}}
 atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(select(.42,.72,kick)*4095)<<8u)|select(255u,u32(max(0,best.body)),best.body>=0));
}
// One close-range arc per swing. Every ray tests room occlusion before bodies.
// Work words 54-57 are cumulative melee swings, body hits, spent volume and wall hits.
fn batJointDamage(index:u32,point:vec3f,damage:f32){
 if(damage<=0){return;}atomicStore(&work[fractureState(index)+6u],0u);
 var jointBody=index;
 // The pelvis has three outgoing joints. A blunt strike wears the nearest
 // attached one instead of damaging both hips and the spine simultaneously.
 if(index%15u==1u){
  let base=index/15u*15u;let children=array<u32,3>(0u,6u,12u);var nearest=1e9;jointBody=base;
  for(var n=0u;n<3u;n++){
   let child=base+children[n];if(cut(child)){continue;}
   let joint=header(1).y+(index/15u*14u+BODY_JOINT[children[n]])*4u;
   let anchor=bodies[index].p.xyz+rotate(bodies[index].q,constants[joint+1u].xyz);let distance=length(point-anchor);
   if(distance<nearest){nearest=distance;jointBody=child;}
  }
 }
 if(cut(jointBody)){return;}
 let build=select(select(1.0,1.12,index/15u%3u==1u),.87,index/15u%3u==2u);
 let amount=damage*select(.22,.28,index%15u==2u)*build*constants[header(3).z+1u].w;
 // Keep injury/spray and knockback independent of blunt joint wear. Even high
 // saved tuning needs three strikes to remove a previously undamaged joint.
 atomicAdd(&work[fractureState(jointBody)+1u],u32(min(amount,.34)*65536));atomicStore(&work[63],1u);
}
fn meleeStrike(){
 atomicAdd(&work[54],1u);
 let forward=safeNorm(frame.rayD.xyz);let right=safeNorm(cross(forward,vec3f(0,1,0)));let up=safeNorm(cross(right,forward));
 var best=RayHit(2.15,frame.rayO.xyz+forward*2.15,vec3f(0,1,0),-1,-1);var score=100.0;var wall=false;var propScore=100.0;var propHit:i32=-1;var propContact=best;
 for(var y=-1;y<=1;y++){for(var x=-3;x<=3;x++){
  let direction=safeNorm(forward+right*(f32(x)*.095)+up*(f32(y)*.055));
  let hit=rayHit(frame.rayO.xyz,direction,2.15,true,-1);
  wall=wall||(hit.body<0&&hit.t<2.15);
  let candidate=hit.t+abs(f32(x))*.035+abs(f32(y))*.02;
  if(hit.surface>=0&&record(u32(hit.surface)).center.w>0&&candidate<propScore){propHit=hit.surface;propScore=candidate;propContact=hit;}
  if(hit.body>=0&&candidate<score){best=hit;score=candidate;}
 }}
 if(propHit>=0&&propScore<score){hitProp(propHit,.70*clamp(frame.action.w,.4,2.4));chipProp(propHit,propContact.p,propContact.n,1.3);propSurfaceImpulse(propHit,frame.rayO.xyz+forward*propScore,safeNorm(forward+up*.25)*45*clamp(frame.action.w,.4,2.4));atomicAdd(&work[57],1u);atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(.72*4095)<<8u)|255u);return;}
 if(best.body<0){if(wall){atomicAdd(&work[57],1u);atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(.45*4095)<<8u)|255u);}return;}
 let index=u32(best.body);let base=index/15u*15u;let direction=safeNorm(forward-right*.45+up*.16);let strength=clamp(frame.action.w,.4,2.4);
 for(var k=base;k<base+15u;k++){bodies[k].status.x=1;bodies[k].status.z=0;bodies[k].motor.w=0;if(component(k)==component(index)){bodies[k].v=vec4f(bodies[k].v.xyz+direction*(4.5+strength*2.5),0);}}
 var b=bodies[index];let arm=best.p-b.p.xyz;
 b.v=vec4f(b.v.xyz+direction*(3*strength*b.p.w),0);b.w=vec4f(b.w.xyz+invWorld(b,cross(arm,direction*(14*strength))),0);
 let damage=frame.rayD.w;batJointDamage(index,best.p,damage);b.blood.x=min(2,b.blood.x+damage*.95);b.blood.w=max(0,b.blood.w-damage*select(26.0,42.0,index%15u==2u));
 let reserve=min(b.coat.w,.48*damage*frame.action.z);b.coat.w-=reserve;
 let coating=min(b.coat.x,.18);b.coat.x-=coating;let volume=reserve*.10+coating*.02;
 let retained=min(volume*.15,max(0,1.65-b.coat.x)*.02);b.coat.x+=retained/.02;
 let seed=atomicLoad(&work[54])*619u+index*197u;let portion=(volume-retained)/24.0;var remainder=volume-retained;
 if(portion>.000001){for(var k=0u;k<24u;k++){
  let h=seed+k*79u;let velocity=direction*(3+hash(h)*6)+best.n*(1+hash(h+1u)*2)+right*((hash(h+2u)-.5)*6)+up*((hash(h+3u)-.35)*5);
  if(launchDrop(best.p+best.n*.04,velocity,.007+hash(h+4u)*.011,index,portion)){remainder-=portion;}
 }}
 // If the drop pool is full, return un-emitted fluid to its finite reserve.
 b.coat.w+=max(0,remainder)/.10;
 if(volume>.00001){let local=rotate(inverseQ(b.q),arm);let c=skinPoint(b,local,rotate(inverseQ(b.q),best.n));stamp(header(0).z+index,c,c,vec2f(.075,.11),.85,0,f32(seed%18u),.5);}
 bodies[index]=b;atomicAdd(&work[55],1u);atomicAdd(&work[56],u32(round(volume*65536)));atomicAdd(&work[16],1u);
 atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(clamp(.65+strength*.12,0,1)*4095)<<8u)|index);
}
