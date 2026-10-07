// Serial multi-pellet impacts share the existing finite blood and debris pools.
fn fireShotgun(){
 let direction=safeNorm(frame.rayD.xyz);let right=safeNorm(cross(direction,select(vec3f(0,1,0),vec3f(1,0,0),abs(direction.y)>.95)));let up=cross(right,direction);
 let serial=atomicAdd(&work[destructionMeta()+19u],1u);var chipped=0u;
 for(var pellet=0u;pellet<12u;pellet++){
  let seed=serial*1973u+pellet*977u+atomicLoad(&work[5]);let angle=f32(pellet)*2.399963+hash(seed)*.35;let radius=sqrt((f32(pellet)+.3)/12)*.068;
  let ray=safeNorm(direction+(right*cos(angle)+up*sin(angle))*radius);let hit=rayHit(frame.rayO.xyz,ray,28,true,-1);
  if(hit.body>=0){let i=u32(hit.body);var b=bodies[i];let damage=mix(.19,.07,clamp(hit.t/22,0,1))*frame.rayD.w;
   let impulse=ray*(3.7*frame.action.w);b.v=vec4f(bounded(b.v.xyz+impulse*b.p.w,21),0);b.w=vec4f(bounded(b.w.xyz+invWorld(b,cross(hit.p-b.p.xyz,impulse)),26),0);
   b.blood.x=min(2,b.blood.x+damage*3);b.blood.w=max(0,b.blood.w-damage*34);damagePart(i,damage);
   let volume=min(b.coat.w,damage*.60*frame.action.z)*.10;let retained=min(volume*.18,max(0,1.65-b.coat.x)*.02);var paid=retained;let portion=(volume-retained)/7;
   if(portion>1e-7){for(var j=0u;j<7u;j++){let h=seed+j*73u;let spray=hit.n*(2+hash(h)*5)+right*(hash(h+1u)-.5)*5+up*(hash(h+2u)-.3)*4;if(launchDrop(hit.p+hit.n*.02,bounded(b.v.xyz,20)+spray,.006+hash(h+3u)*.008,i,portion)){paid+=portion;}}}
   b.coat.w=max(0,b.coat.w-paid/.10);b.coat.x+=retained/.02;bodies[i]=b;
   for(var k=i/15u*15u;k<(i/15u+1u)*15u;k++){bodies[k].status.x=1;bodies[k].motor.w=0;bodies[k].status.z=0;}
   let c=skinPoint(b,rotate(inverseQ(b.q),hit.p-b.p.xyz),rotate(inverseQ(b.q),hit.n));stamp(header(0).z+i,c,c,vec2f(.04,.065),.65,0,f32(seed),0);
   atomicAdd(&work[16],1u);atomicAdd(&work[destructionMeta()+20u],1u);
  }else if(hit.surface>=0){
   hitProp(hit.surface,.115*frame.rayD.w);propSurfaceImpulse(hit.surface,hit.p,ray*2.2*frame.action.w);splatKind(u32(hit.surface),hit.p,.026,.85,seed,9);
   let tag=record(u32(hit.surface)).center.w;if(tag>0){let bit=1u<<(u32(tag)-1u);if((chipped&bit)==0u){chipProp(hit.surface,hit.p,hit.n,1.2);chipped|=bit;}}
   else if(pellet%3u==0u){spawnOrdnance(2u,hit.p+hit.n*.03,hit.n*3+up*(hash(seed)-.3)*3,.013,seed);}
  }
 }
}
fn fireSaw(){
 let direction=safeNorm(frame.rayD.xyz);let hit=rayHit(frame.rayO.xyz,direction,.62,true,-1);let start=frame.rayO.xyz+direction*max(0,hit.t-.19);
 if(spawnOrdnance(7u,start,direction*25,.15,atomicLoad(&work[5])+379u)){atomicAdd(&work[destructionMeta()+21u],1u);}
}
