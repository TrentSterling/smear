// One close-range arc per swing. Every ray tests room occlusion before bodies.
// Work words 54-57 are cumulative melee swings, body hits, spent volume and wall hits.
fn meleeStrike(){
 atomicAdd(&work[54],1u);
 let forward=safeNorm(frame.rayD.xyz);let right=safeNorm(cross(forward,vec3f(0,1,0)));let up=safeNorm(cross(right,forward));
 var best=RayHit(2.15,frame.rayO.xyz+forward*2.15,vec3f(0,1,0),-1,-1);var score=100.0;var wall=false;var propScore=100.0;var propHit:i32=-1;
 for(var y=-1;y<=1;y++){for(var x=-3;x<=3;x++){
  let direction=safeNorm(forward+right*(f32(x)*.095)+up*(f32(y)*.055));
  let hit=rayHit(frame.rayO.xyz,direction,2.15,true,-1);
  wall=wall||(hit.body<0&&hit.t<2.15);
  let candidate=hit.t+abs(f32(x))*.035+abs(f32(y))*.02;
  if(hit.surface>=0&&record(u32(hit.surface)).center.w>0&&candidate<propScore){propHit=hit.surface;propScore=candidate;}
  if(hit.body>=0&&candidate<score){best=hit;score=candidate;}
 }}
 if(propHit>=0&&propScore<score){hitProp(propHit,.70*clamp(frame.action.w,.4,2.4));atomicAdd(&work[57],1u);atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(.72*4095)<<8u)|255u);return;}
 if(best.body<0){if(wall){atomicAdd(&work[57],1u);atomicAdd(&work[39],1u);atomicMax(&work[38],0x80000000u|(u32(.45*4095)<<8u)|255u);}return;}
 let index=u32(best.body);let base=index/15u*15u;let direction=safeNorm(forward-right*.45+up*.16);let strength=clamp(frame.action.w,.4,2.4);
 for(var k=base;k<base+15u;k++){bodies[k].status.x=1;bodies[k].status.z=0;bodies[k].motor.w=0;if(component(k)==component(index)){bodies[k].v=vec4f(bodies[k].v.xyz+direction*(4.5+strength*2.5),0);}}
 var b=bodies[index];let arm=best.p-b.p.xyz;
 b.v=vec4f(b.v.xyz+direction*(3*strength*b.p.w),0);b.w=vec4f(b.w.xyz+invWorld(b,cross(arm,direction*(14*strength))),0);
 let damage=frame.rayD.w;damagePart(index,damage*select(.48,.68,index%15u==2u));b.blood.x=min(2,b.blood.x+damage*.95);b.blood.w=max(0,b.blood.w-damage*select(26.0,42.0,index%15u==2u));
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
