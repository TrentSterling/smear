// Swept projectile spheres against the same collision samples as the ragdoll.
// Events stay in each projectile's existing 24-word slot, then apply serially.
struct ProjectileHit { time:f32, body:i32, normal:vec3f };
fn projectileBodyHit(origin:vec3f,delta:vec3f,radius:f32,skip:i32)->ProjectileHit{
 var best=ProjectileHit(1.001,-1,vec3f(0,1,0));
 for(var i=0u;i<u32(frame.settings.x);i++){
  if(i32(i)==skip){continue;}let b=bodies[i];let relative=delta-b.v.xyz/120;
  let reach=b.invI.w+radius+length(relative);if(distance(origin,b.p.xyz)>reach){continue;}
  for(var j=0u;j<u32(b.half.w);j++){
   let sphere=sample(b,j);let arm=rotate(b.q,sphere.xyz);let center=b.p.xyz+arm;
   let path=relative-cross(b.w.xyz,arm)/120;let offset=origin-center;let r=sphere.w+radius;
   let a=dot(path,path);let c=dot(offset,offset)-r*r;var t=0.0;
   if(c>0){if(a<1e-10){continue;}let h=dot(offset,path);let disc=h*h-a*c;if(disc<0){continue;}t=(-h-sqrt(disc))/a;}
   if(t<0||t>1||t>=best.time){continue;}best=ProjectileHit(t,i32(i),safeNorm(offset+path*t));
  }
 }return best;
}
fn fireRocket(){
 let direction=safeNorm(frame.rayD.xyz);let hit=rayHit(frame.rayO.xyz,direction,.60,true,-1);
 let start=frame.rayO.xyz+direction*max(0.0,hit.t-.09);
 if(spawnOrdnance(4u,start,direction*38,.075,atomicLoad(&work[5])+479u)){atomicAdd(&work[destructionMeta()+17u],1u);}
}
@compute @workgroup_size(1) fn projectileImpacts(){
 for(var i=0u;i<128u;i++){
  let s=ordnanceState(i);let event=atomicExchange(&work[s+12u],0u);if(event==0u){continue;}if(event>=256u&&atomicLoad(&work[s+19u])==7u){let rec=i32(event-256u);let point=ordVector(s);let n=ordVector(s+16u);if(record(u32(rec)).center.w>0){chipProp(rec,point,n,.8);}else{for(var k=0u;k<3u;k++){let seed=atomicLoad(&work[5])*1973u+i*719u+k*73u;spawnOrdnance(2u,point+n*.02,n*(1+hash(seed)*3)+vec3f(hash(seed+1u)-.5,hash(seed+2u),hash(seed+3u)-.5)*3,.011,seed);}}continue;}
  let index=event-1u;if(index>=u32(frame.settings.x)){continue;}
  let kind=atomicLoad(&work[s+19u]);let incoming=ordVector(s+13u);let n=ordVector(s+16u);var b=bodies[index];let point=ordVector(s);let relative=incoming-b.v.xyz;
  let closing=max(0,-dot(relative,n));let mass=select(select(.055,.18,kind==5u),select(.40,.9,kind==4u),kind==1u||kind==4u);
  let impulse=safeNorm(relative)*min(32.0,length(relative)*mass);let damage=select(clamp(closing*mass*.022,.025,1.2),1.15,kind==7u)*frame.rayD.w;
  b.v=vec4f(bounded(b.v.xyz+impulse*b.p.w,21),0);b.w=vec4f(bounded(b.w.xyz+invWorld(b,cross(point-b.p.xyz,impulse)),26),0);
  b.status.x=1;b.status.z=0;b.motor.w=0;b.blood.x=min(2,b.blood.x+damage);b.blood.w=max(0,b.blood.w-damage*34);damagePart(index,damage);
  let spent=min(b.coat.w,damage*.24*frame.action.z);let portion=spent*.1/10;var emitted=0.0;
  if(portion>1e-7){for(var drop=0u;drop<10u;drop++){let seed=i*977u+drop*73u+atomicLoad(&work[5]);let spray=safeNorm(n+vec3f(hash(seed)-.5,hash(seed+1u)-.5,hash(seed+2u)-.5));if(launchDrop(point+n*.02,b.v.xyz+spray*(2+hash(seed+3u)*5),.006+hash(seed+4u)*.005,index,portion)){emitted+=portion;}}}
  b.coat.w=max(0,b.coat.w-emitted/.1);bodies[index]=b;
  for(var k=index/15u*15u;k<(index/15u+1u)*15u;k++){bodies[k].motor.w=0;bodies[k].status.x=1;bodies[k].status.z=0;}
  atomicAdd(&work[16],1u);atomicAdd(&work[destructionMeta()+16u],1u);atomicAdd(&work[39],1u);atomicMax(&work[38],select(0u,0x20000000u,kind==7u)|(u32(clamp(closing*.055,.15,1)*4095)<<8u)|index);
 }
}
