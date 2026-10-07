// Placement shares the one-shot buddy acknowledgement and preview storage.
// Preview mode 3 is a crate, 4 is a barrel. Actions 10/11 remove/restore props.
fn boxesOverlap(p:vec3f,q:vec4f,h:vec3f,otherP:vec3f,otherQ:vec4f,otherH:vec3f)->bool{
 var axes:array<vec3f,15>;for(var i=0u;i<3u;i++){var axis=vec3f(0);axis[i]=1;axes[i]=rotate(q,axis);axes[i+3u]=rotate(otherQ,axis);}
 for(var i=0u;i<3u;i++){for(var j=0u;j<3u;j++){axes[6u+i*3u+j]=cross(axes[i],axes[j+3u]);}}
 let delta=p-otherP;
 for(var i=0u;i<15u;i++){let axis=axes[i];if(dot(axis,axis)<1e-8){continue;}let ra=dot(abs(rotate(inverseQ(q),axis)),h);let rb=dot(abs(rotate(inverseQ(otherQ),axis)),otherH);if(abs(dot(delta,axis))>=ra+rb-.008*length(axis)){return false;}}
 return true;
}
fn propClearance(p:vec3f,q:vec4f,h:vec3f)->u32{
 if(abs(p.x)>7.35||abs(p.z)>7.35||p.y+h.y>4.95){return 3u;}
 if(distance(p.xz,frame.camera.xz)<length(h.xz)+.35&&abs(p.y-frame.camera.y)<2){return 7u;}
 for(var i=0u;i<header(0).x;i++){let box=header(1).x+i*5u;if(!liveBox(box)){continue;}if(boxesOverlap(p,q,h,constants[box].xyz,constants[box+1u],constants[box+2u].xyz)){return 4u;}}
 for(var i=0u;i<u32(frame.settings.x);i++){let b=bodies[i];if(distance(b.p.xyz,p)>length(h)+b.invI.w){continue;}for(var j=0u;j<u32(b.half.w);j++){let sphere=sample(b,j);let local=rotate(inverseQ(q),b.p.xyz+rotate(b.q,sphere.xyz)-p);if(length(local-clamp(local,-h,h))<sphere.w+.035){return 5u;}}}
 return 1u;
}
fn propEmpty(id:u32)->bool{
 let s=propData(id);for(var face=0u;face<6u;face++){let r=record(u32(constants[s+16u+face*4u].w));let count=u32(r.u.w*r.v.w);for(var k=0u;k<count;k++){if(atomicLoad(&wet[filmOffset(0u)+u32(r.extra.z)+k])>0u){return false;}}}return true;
}
@compute @workgroup_size(1) fn propPlacement(){
 let kind=u32(frame.goal.w);var slot=999u;
 for(var i=0u;i<propCount();i++){if(u32(constants[propData(i)+6u].w)==kind&&propGone(f32(i+1u))&&propEmpty(i)){slot=i;break;}}
 var half=vec3f(.54,.55,.54);for(var i=0u;i<propCount();i++){if(u32(constants[propData(i)+6u].w)==kind){half=constants[propData(i)+6u].xyz;break;}}
 let hit=rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),18,false,-1);let p=hit.p+vec3f(0,half.y+.008,0);let q=yawQ(frame.local.x);
 var valid=2u;if(hit.surface>=0&&hit.n.y>.9){valid=propClearance(p,q,half);}if(slot==999u){valid=6u;}
 atomicStore(&work[1006],kind+2u);atomicStore(&work[1007],slot);atomicStore(&work[1008],valid);atomicStore(&work[1012],bitcast<u32>(frame.local.x));
 for(var k=0u;k<3u;k++){atomicStore(&work[1009u+k],bitcast<u32>(p[k]));}
 if(frame.action.y!=9){return;}atomicStore(&work[1013],valid);if(valid!=1u){return;}
 let s=propData(slot);constants[s]=vec4f(p,constants[s].w);constants[s+1u]=q;constants[s+2u]=vec4f(0);constants[s+3u]=vec4f(0);for(var k=8u;k<16u;k++){constants[s+k]=vec4f(0);}constants[s+15u].x=1;
 for(var k=0u;k<8u;k++){atomicStore(&work[propState(slot)+k],0u);}atomicAnd(&work[19],~(1u<<slot));syncProp(slot);
 resetUtilityProp(slot);
}
@compute @workgroup_size(1) fn removeProp(){
 let hit=rayHit(frame.rayO.xyz,safeNorm(frame.rayD.xyz),18,true,-1);var slot=999u;
 if(frame.goal.w>=180){slot=u32(frame.goal.w)-180u;}else if(hit.body<0&&hit.surface>=0){let tag=record(u32(hit.surface)).center.w;if(tag>0){slot=u32(tag)-1u;}}
 if(slot<propCount()&&!propGone(f32(slot+1u))){drainUtilityProp(slot);atomicOr(&work[19],1u<<slot);constants[propData(slot)+15u].x=0;atomicStore(&work[1013],1u);}else{atomicStore(&work[1013],2u);}
}
@compute @workgroup_size(1) fn retireProps(){for(var i=8u;i<propCount();i++){drainUtilityProp(i);}atomicStore(&work[19],(1u<<propCount())-1u);}
// Clear only a recycled prop's surfaces after its old mobile supply has drained.
// Layout restore drains at the previous locations before invoking this kernel.
@compute @workgroup_size(256) fn clearPropPaint(@builtin(global_invocation_id) id:vec3u){
 let allProps=frame.action.y==11;let slot=select(atomicLoad(&work[1007]),id.x/(6u*65536u),allProps);if(slot>=propCount()){return;}
 if(!allProps&&atomicLoad(&work[1013])!=1u){return;}let pixel=id.x%(6u*65536u);let face=pixel/65536u;let cell=pixel%65536u;
 let r=record(u32(constants[propData(slot)+16u+face*4u].w));if(cell<u32(r.size.z*r.size.w)){pigment[r.address.x+cell]=0u;paintBefore[r.address.x+cell]=0u;}
 if(cell<3136u){atomicStore(&wet[u32(r.extra.y)+cell],0u);}if(cell<u32(r.u.w*r.v.w)){for(var bank=0u;bank<7u;bank++){atomicStore(&wet[filmOffset(bank)+u32(r.extra.z)+cell],0u);}}
}
