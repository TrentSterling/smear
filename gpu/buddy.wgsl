// Placement metadata occupies the unused 1006-1023 work words. No pose readback.
// mode, base, validity, point.xyz, yaw, commit result. 1=valid/success.
fn buddyClearance(root:vec3f,q:vec4f,base:u32)->u32 {
 if(abs(root.x)>7.35||abs(root.z)>7.35){return 3u;}
 if(distance(root.xz,frame.camera.xz)<.85){return 7u;}
 for(var k=0u;k<15u;k++){
  let b=bodies[base+k];let bind=header(3).w+(base+k)*2u;
  let p=root+rotate(q,constants[bind].xyz);let orientation=quatMul(q,constants[bind+1u]);
  for(var s=0u;s<u32(b.half.w);s++){
   let sphere=sample(b,s);let point=p+rotate(orientation,sphere.xyz);let radius=sphere.w+.045;
   for(var j=0u;j<header(0).x;j++){
    let box=header(1).x+j*5u;if(!liveBox(box)){continue;}
    let local=rotate(inverseQ(constants[box+1u]),point-constants[box].xyz);let half=constants[box+2u].xyz;
    if(length(local-clamp(local,-half,half))<radius){return 4u;}
   }
   for(var j=0u;j<u32(frame.settings.x);j++){
    if(j>=base&&j<base+15u){continue;}let other=bodies[j];
    if(distance(point,other.p.xyz)>radius+other.invI.w){continue;}
    for(var t=0u;t<u32(other.half.w);t++){let os=sample(other,t);if(distance(point,other.p.xyz+rotate(other.q,os.xyz))<radius+os.w){return 5u;}}
   }
  }
 }
 return 1u;
}
@compute @workgroup_size(1) fn buddyPlacement(){
 let base=u32(frame.goal.w);let adding=base>=u32(frame.settings.x);
 let hit=rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),18,false,-1);
 let root=vec3f(hit.p.x,.025,hit.p.z);let q=yawQ(frame.local.x);
 var valid=2u;
 if(base<180u&&hit.surface>=0&&hit.n.y>.98&&abs(hit.p.y)<.04){valid=buddyClearance(root,q,base);}
 if(base>=180u){valid=6u;}
 atomicStore(&work[1006],select(2u,1u,adding));atomicStore(&work[1007],base);atomicStore(&work[1008],valid);
 for(var k=0u;k<3u;k++){atomicStore(&work[1009u+k],bitcast<u32>(root[k]));}atomicStore(&work[1012],bitcast<u32>(frame.local.x));
 if(frame.action.y!=9){return;}atomicStore(&work[1013],valid);if(valid!=1u){return;}
 for(var k=0u;k<15u;k++){
  let i=base+k;let bind=header(3).w+i*2u;var b=bodies[i];
  b.p=vec4f(root+rotate(q,constants[bind].xyz),b.p.w);b.q=quatMul(q,constants[bind+1u]);b.prevP=b.p;b.prevQ=b.q;
  b.v=vec4f(0);b.w=vec4f(0);b.blood=vec4f(0,0,0,100);
  // Restoration is an explicit reserve refill. Keep coating, paint and pending
  // caught-liquid credits so this action does not clean the selected buddy.
  b.coat=vec4f(b.coat.x+f32(atomicLoad(&work[contactMemory(i)+9u]))/65536.0,0,0,9);
  b.track=vec4f(0);b.status=vec4f(1,f32(k),0,b.status.w);b.recoveryP=b.p;b.recoveryQ=b.q;
  b.motor=vec4f(root.x,frame.local.x,root.z,2);b.nav=vec4f(root.x,0,root.z,frame.camera.w+.8);
  b.targetP=b.p;b.targetQ=b.q;b.targetV=vec4f(0);b.gait=vec4f(0);b.footFrom=vec4f(0);b.footTo=vec4f(0);
  bodies[i]=b;
  for(var n=0u;n<8u;n++){atomicStore(&work[fractureState(i)+n],0u);}
  for(var n=0u;n<16u;n++){atomicStore(&work[contactMemory(i)+n],0u);}
  let pair=header(2).w+header(2).x*128u+i*8u;for(var n=0u;n<8u;n++){atomicStore(&work[pair+n],0u);}
 }
 for(var k=964u;k<1006u;k++){atomicStore(&work[k],0u);}atomicStore(&work[40u+base/15u],0u);
}
