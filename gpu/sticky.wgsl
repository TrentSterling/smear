fn throwSticky(){let axis=safeNorm(frame.rayD.xyz);let hit=rayHit(frame.rayO.xyz,axis,.55,true,-1);spawnOrdnance(6u,frame.rayO.xyz+axis*max(0.0,hit.t-.08),axis*11+vec3f(0,1,0),.055,atomicLoad(&work[5])+117u);}
fn attachSticky(s:u32,p:vec3f,n:vec3f,attachment:u32){
 putVector(s,p);putVector(s+4u,vec3f(0));atomicStore(&work[s+20u],attachment);var local=p;var normal=n;
 if(attachment<=180u){let b=bodies[attachment-1u];local=rotate(inverseQ(b.q),p-b.p.xyz);normal=rotate(inverseQ(b.q),n);}
 else if(attachment<1000u){let b=propBody(attachment-181u);local=rotate(inverseQ(b.q),p-b.p.xyz);normal=rotate(inverseQ(b.q),n);}
 putVector(s+13u,local);putVector(s+16u,normal);
}
fn followSticky(s:u32)->bool{
 let attached=atomicLoad(&work[s+20u]);if(attached==0u){return false;}let local=ordVector(s+13u);var p=local;
 if(attached<=180u){let b=bodies[attached-1u];p=b.p.xyz+rotate(b.q,local);}
 else if(attached<1000u){let id=attached-181u;if(propGone(f32(id+1u))){atomicStore(&work[s+20u],0u);return false;}let b=propBody(id);p=b.p.xyz+rotate(b.q,local);}
 putVector(s,p);putVector(s+4u,vec3f(0));return true;
}
fn detonateStickies(){for(var i=0u;i<8u;i++){let s=ordnanceState(i);if(atomicLoad(&work[s+23u])!=6u){continue;}followSticky(s);queueBlast(ordVector(s),.95*constants[header(3).z+1u].z);atomicStore(&work[s+23u],0u);}}
fn buildContraption(){
 for(var i=0u;i<propCount();i++){
  let s=propData(i);var p=constants[s+4u].xyz;var enabled=i<6u||(i>=8u&&i<12u);var yaw=0.0;
  switch i{case 0u:{p=vec3f(-2.95,.96,1.1);}case 1u:{p=vec3f(2.35,.55,1.1);}case 2u:{p=vec3f(3.65,.55,1.1);}case 3u:{p=vec3f(-.6,.58,1.1);}case 4u:{p=vec3f(.35,.58,1.1);}case 5u:{p=vec3f(1.30,.58,1.1);}case 8u:{p=vec3f(2.8,.33,2.2);}case 9u:{p=vec3f(3.65,.33,2.2);}case 10u:{p=vec3f(-4.65,.55,1.1);yaw=1.570796;}case 11u:{p=vec3f(-2.4,.20,1.1);}default:{}}
  constants[s]=vec4f(p,constants[s].w);constants[s+1u]=yawQ(yaw);constants[s+2u]=vec4f(0);constants[s+3u]=vec4f(0);constants[s+14u]=vec4f(0);constants[s+15u].x=select(0.0,1.0,enabled);if(enabled){atomicAnd(&work[19],~(1u<<i));}else{atomicOr(&work[19],1u<<i);}resetUtilityProp(i);if(i>=10u){atomicStore(&work[utilityProp(i)+1u],0u);}syncProp(i);
 }
 for(var i=0u;i<u32(frame.settings.x);i++){let base=i/15u;let bind=header(3).w+i*2u;let root=select(select(vec3f(3.3,0,2.35),vec3f(5.1,0,1.1),base==1u),vec3f(1.1,0,2.6),base==2u);var b=bodies[i];b.p=vec4f(root+constants[bind].xyz,b.p.w);b.q=constants[bind+1u];b.prevP=b.p;b.prevQ=b.q;b.v=vec4f(0);b.w=vec4f(0);b.motor=vec4f(root.x,0,root.z,0);b.status.x=1;b.status.z=0;bodies[i]=b;}
 atomicStore(&work[utilityBase()+18u],1u);atomicStore(&work[utilityBase()+25u],65540u);
}
fn runContraption(){atomicAnd(&work[utilityBase()+25u],65535u);for(var i=8u;i<propCount();i++){if(machineKind(constants[propData(i)+6u].w)){atomicStore(&work[utilityProp(i)+1u],1u);}}atomicStore(&work[utilityBase()+18u],2u);}
