// Six degree-of-freedom rigid props, integrated at the same 120 Hz as the buddy.
// Constants binding is writable only in compute; render reads the final poses.
fn propBody(i:u32)->Body{
 let s=propData(i);var b:Body;b.p=constants[s];b.q=constants[s+1u];b.v=constants[s+2u];b.w=constants[s+3u];b.half=constants[s+6u];b.invI=constants[s+7u];b.status.x=1;return b;
}
fn saveProp(i:u32,b:Body){let s=propData(i);constants[s]=b.p;constants[s+1u]=b.q;constants[s+2u]=b.v;constants[s+3u]=b.w;}
fn propVelocity(tag:f32,p:vec3f)->vec3f{if(tag<=0){return vec3f(0);}let b=propBody(u32(tag)-1u);return b.v.xyz+cross(b.w.xyz,p-b.p.xyz);}
fn surfaceVelocity(rec:i32,p:vec3f)->vec3f{if(rec<0){return vec3f(0);}return propVelocity(record(u32(rec)).center.w,p);}
fn propImpulse(tag:f32,p:vec3f,j:vec3f){
 if(tag<=0||propGone(tag)){return;}let id=u32(tag)-1u;let b=propBody(id);if(b.p.w==0){return;}let torque=cross(p-b.p.xyz,j);let state=propState(id);
 for(var k=0u;k<3u;k++){atomicAdd(&work[state+2u+k],bitcast<u32>(i32(clamp(j[k],-2000,2000)*4096)));atomicAdd(&work[state+5u+k],bitcast<u32>(i32(clamp(torque[k],-2000,2000)*4096)));}
}
fn propSurfaceImpulse(rec:i32,p:vec3f,j:vec3f){if(rec>=0){propImpulse(record(u32(rec)).center.w,p,j);}}
fn syncProp(i:u32){
 let s=propData(i);let b=propBody(i);let box=header(1).x+u32(constants[s+4u].w)*5u;
 constants[box]=vec4f(b.p.xyz,constants[box].w);constants[box+1u]=b.q;
 for(var face=0u;face<6u;face++){
  let source=s+16u+face*4u;let rec=u32(constants[source].w);let destination=header(1).z+rec*7u;
  constants[destination]=vec4f(b.p.xyz+rotate(b.q,constants[source].xyz),f32(i+1u));
  for(var axis=1u;axis<4u;axis++){constants[destination+axis]=vec4f(rotate(b.q,constants[source+axis].xyz),constants[destination+axis].w);}
 }
}
@compute @workgroup_size(1) fn resetProps(){
 atomicStore(&work[19],((1u<<propCount())-1u)&~63u);
 for(var i=0u;i<propCount();i++){for(var k=0u;k<8u;k++){atomicStore(&work[propState(i)+k],0u);}let s=propData(i);constants[s]=vec4f(constants[s+4u].xyz,constants[s].w);constants[s+1u]=constants[s+5u];constants[s+2u]=vec4f(0);constants[s+3u]=vec4f(0);for(var k=8u;k<16u;k++){constants[s+k]=vec4f(0);}constants[s+15u].x=select(0.0,1.0,i<6u);syncProp(i);resetUtilityProp(i);}
}
struct PropContact{point:vec3f,depth:f32,normal:vec3f};
fn pointBox(p:vec3f,center:vec3f,q:vec4f,half:vec3f,kind:f32)->PropContact{
 let local=rotate(inverseQ(q),p-center);var nearest=clamp(local,-half,half);var normal=vec3f(0,1,0);var depth=0.0;
 // The room ceiling bounds the interior. Its visual slab must never offer an
 // upward-facing support contact after a fast vertex crosses its midpoint.
 if(kind== -1){return PropContact(center+rotate(q,vec3f(local.x,-half.y,local.z)),local.y+half.y,rotate(q,vec3f(0,-1,0)));}
 if(kind==2){
  let radius=length(local.xz);let side=vec3f(local.x/max(radius,1e-7),0,local.z/max(radius,1e-7));
  nearest=vec3f(side.x*min(radius,half.x),clamp(local.y,-half.y,half.y),side.z*min(radius,half.x));
  let delta=local-nearest;if(length(delta)>1e-7){return PropContact(p,-length(delta),rotate(q,safeNorm(delta)));}
  if(half.x-radius<half.y-abs(local.y)){normal=select(side,vec3f(1,0,0),radius<1e-7);depth=half.x-radius;}else{normal=vec3f(0,select(-1.0,1.0,local.y>=0),0);depth=half.y-abs(local.y);}
 }else{
  let delta=local-nearest;if(length(delta)>1e-7){return PropContact(p,-length(delta),rotate(q,safeNorm(delta)));}
  let gaps=half-abs(local);if(gaps.x<gaps.y&&gaps.x<gaps.z){normal=vec3f(select(-1.0,1.0,local.x>=0),0,0);depth=gaps.x;}else if(gaps.y<gaps.z){normal=vec3f(0,select(-1.0,1.0,local.y>=0),0);depth=gaps.y;}else{normal=vec3f(0,0,select(-1.0,1.0,local.z>=0));depth=gaps.z;}
 }
 return PropContact(center+rotate(q,local+normal*depth),depth,rotate(q,normal));
}
// Convex support samples form stable face manifolds, including the barrel rims.
fn propVertex(b:Body,index:u32)->vec3f{
 if(b.half.w==2){let angle=f32(index%12u)*6.283185/12;return b.p.xyz+rotate(b.q,vec3f(cos(angle)*b.half.x,select(-b.half.y,b.half.y,index>=12u),sin(angle)*b.half.x));}
 return b.p.xyz+rotate(b.q,b.half.xyz*vec3f(select(-1.0,1.0,(index&1u)!=0u),select(-1.0,1.0,(index&2u)!=0u),select(-1.0,1.0,(index&4u)!=0u)));
}
// Edge/edge overlap has no contained vertex. SAT supplies that missing contact.
fn propEdgeContact(a:Body,b:Body)->PropContact{
 var axes:array<vec3f,15>;for(var k=0u;k<3u;k++){var axis=vec3f(0);axis[k]=1;axes[k]=rotate(a.q,axis);axes[k+3u]=rotate(b.q,axis);}for(var i=0u;i<3u;i++){for(var j=0u;j<3u;j++){axes[6u+i*3u+j]=cross(axes[i],axes[j+3u]);}}
 var depth=1e6;var normal=vec3f(0,1,0);let delta=a.p.xyz-b.p.xyz;
 for(var k=0u;k<15u;k++){if(dot(axes[k],axes[k])<1e-8){continue;}let n=safeNorm(axes[k]);let an=rotate(inverseQ(a.q),n);let bn=rotate(inverseQ(b.q),n);let ra=select(dot(abs(an),a.half.xyz),a.half.x*length(an.xz)+a.half.y*abs(an.y),a.half.w==2);let rb=select(dot(abs(bn),b.half.xyz),b.half.x*length(bn.xz)+b.half.y*abs(bn.y),b.half.w==2);let overlap=ra+rb-abs(dot(delta,n));if(overlap<=0){return PropContact(vec3f(0),-1,normal);}if(overlap<depth){depth=overlap;normal=n*select(-1.0,1.0,dot(delta,n)>=0);}}
 let localA=rotate(inverseQ(a.q),-normal);let localB=rotate(inverseQ(b.q),normal);
 let supportA=a.p.xyz+rotate(a.q,a.half.xyz*sign(localA));let supportB=b.p.xyz+rotate(b.q,b.half.xyz*sign(localB));
 return PropContact((supportA+supportB)*.5,depth,normal);
}
var<private> propOther:Body;
var<private> propOtherID:i32;
var<private> propCurrentID:u32;
fn solvePropContact(input:Body,point:vec3f,n:vec3f,depth:f32)->Body{
 var b=input;let arm=point-b.p.xyz;let otherArm=point-propOther.p.xyz;let otherEff=select(0.0,eff(propOther,otherArm,n),propOtherID>=0);
 let effective=eff(b,arm,n)+otherEff+1e-6;
 var beltA=vec3f(0);var beltB=vec3f(0);if(b.half.w==5&&atomicLoad(&work[utilityProp(propCurrentID)+1u])!=0u&&abs(rotate(inverseQ(b.q),arm).y-b.half.y)<.14){beltA=rotate(b.q,vec3f(8,0,0));}if(propOtherID>=0&&propOther.half.w==5&&atomicLoad(&work[utilityProp(u32(propOtherID))+1u])!=0u&&abs(rotate(inverseQ(propOther.q),otherArm).y-propOther.half.y)<.14){beltB=rotate(propOther.q,vec3f(8,0,0));}
 let relative=b.v.xyz+cross(b.w.xyz,arm)+beltA-select(vec3f(0),propOther.v.xyz+cross(propOther.w.xyz,otherArm)+beltB,propOtherID>=0);
 let closing=dot(relative,n);let normalImpulse=max(0,-closing*select(1.0,1.14,closing< -1.2))/effective;
 var friction=.68;if(b.half.w>=6&&b.half.w<=8&&point.y<.025&&n.y>.9){let r=record(floorRecord(point));let dims=filmDimensions(r);let cell=vec2u(clamp(uv(r,point)*vec2f(dims),vec2f(0),vec2f(dims)-1));if(filmRead(0u,filmAddress(r,cell))>.004){friction=.13;}}
 var impulse=n*normalImpulse;let tangent=relative-n*closing;let speed=length(tangent);
 if(speed>1e-6){let t=tangent/speed;let te=eff(b,arm,t)+select(0.0,eff(propOther,otherArm,t),propOtherID>=0);impulse-=t*min(speed/max(te,1e-6),normalImpulse*friction);}
 b.v=vec4f(b.v.xyz+impulse*b.p.w,0);b.w=vec4f(b.w.xyz+invWorld(b,cross(arm,impulse)),0);
 if(closing< -3.0&&propOtherID>=0&&breakableProp(b.half.w)&&(breakableProp(propOther.half.w)||propOther.half.w==13)){let energy=.5*normalImpulse*(-closing);propDamage(f32(propCurrentID+1u),energy/select(95.0,50.0,b.half.w==2));propDamage(f32(propOtherID+1),energy/select(95.0,50.0,propOther.half.w==2));}
 let correction=max(0,min(depth-.0005,.06))*.62/effective;
 b.p=vec4f(b.p.xyz+n*correction*b.p.w,b.p.w);b.q=rotateStep(b.q,invWorld(b,cross(arm,n*correction)));
 if(propOtherID>=0){propOther.v=vec4f(propOther.v.xyz-impulse*propOther.p.w,0);propOther.w=vec4f(propOther.w.xyz-invWorld(propOther,cross(otherArm,impulse)),0);propOther.p=vec4f(propOther.p.xyz-n*correction*propOther.p.w,propOther.p.w);propOther.q=rotateStep(propOther.q,-invWorld(propOther,cross(otherArm,n*correction)));if(length(impulse)>.06){constants[propData(u32(propOtherID))+14u]=vec4f(0);}saveProp(u32(propOtherID),propOther);syncProp(u32(propOtherID));}
 return b;
}
fn releaseProp(){
 let id=u32(frame.goal.w)-180u;if(id>=propCount()||propGone(f32(id+1u))){return;}let s=propData(id);var b=propBody(id);let peak=constants[s+12u];
 // Keep a brief real-motion grace period; never launch from cursor displacement.
 if(frame.camera.w-peak.w<.10&&dot(b.v.xyz,peak.xyz)>0&&length(b.v.xyz)>length(peak.xyz)*.45){b.v=vec4f(bounded(peak.xyz,21),0);}
 constants[s+11u]=vec4f(0);constants[s+12u]=vec4f(0);saveProp(id,b);
}
@compute @workgroup_size(1) fn propPhysics(){
 let dt=1.0/120;
 for(var i=0u;i<propCount();i++){
  if(propGone(f32(i+1u))||constants[propData(i)].w==0){continue;}let s=propData(i);var b=propBody(i);constants[s+8u]=b.p;constants[s+9u]=b.q;
  var linear=vec3f(0);var angular=vec3f(0);for(var k=0u;k<3u;k++){linear[k]=f32(bitcast<i32>(atomicExchange(&work[propState(i)+2u+k],0u)))/4096;angular[k]=f32(bitcast<i32>(atomicExchange(&work[propState(i)+5u+k],0u)))/4096;}
  let held=frame.local.w>.5&&u32(frame.goal.w)==180u+i;
  if(held||length(linear)>.025||length(angular)>.015){constants[s+14u]=vec4f(0);}
  if(constants[s+14u].y>.5){
   var supported=false;
   for(var vertexID=0u;vertexID<select(8u,24u,b.half.w==2);vertexID++){
    let point=propVertex(b,vertexID);if(point.y<.009){supported=true;break;}
    for(var j=0u;j<header(0).x;j++){let box=header(1).x+j*5u;if(constants[box+2u].w==f32(i+1u)||!liveBox(box)){continue;}if(distance(constants[box].xyz,b.p.xyz)>length(constants[box+2u].xyz)+length(b.half.xyz)+.06){continue;}let hit=pointBox(point,constants[box].xyz,constants[box+1u],constants[box+2u].xyz,constants[box].w);if(hit.depth>-.009&&hit.normal.y>.55){supported=true;break;}}
    if(supported){break;}
   }
   if(supported){continue;}constants[s+14u]=vec4f(0);
  }
  constants[s+14u]=vec4f(constants[s+14u].x,0,0,0);
  b.v=vec4f(b.v.xyz+linear*b.p.w+vec3f(0,-9.81*dt,0),0);b.w=vec4f(b.w.xyz+invWorld(b,angular),0);
  if(held){
   let point=b.p.xyz+rotate(b.q,frame.local.xyz);let error=frame.goal.xyz-point;let velocity=b.v.xyz+cross(b.w.xyz,point-b.p.xyz);
   let wanted=bounded(error*18,21)-velocity;let impulse=bounded(wanted,120*dt)/max(b.p.w,.001);
   b.v=vec4f(b.v.xyz+impulse*b.p.w,0);b.w=vec4f(b.w.xyz+invWorld(b,cross(point-b.p.xyz,impulse))*.35,0);
   let twist=select(0.0,1.0,(u32(frame.settings.w)&8u)!=0u)-select(0.0,1.0,(u32(frame.settings.w)&4u)!=0u);
   b.w=vec4f(mix(b.w.xyz,safeNorm(frame.rayD.xyz)*twist*4,1-exp(-dt*5)),0);
   if(constants[s+11u].w!=frame.local.w){constants[s+12u]=vec4f(0);}
   constants[s+11u]=vec4f(frame.goal.xyz,frame.local.w);
  }
  b.v=vec4f(bounded(b.v.xyz*exp(-.075*dt),21),0);b.w=vec4f(bounded(b.w.xyz*exp(-.36*dt),18),0);
  var previous=b;b.p=vec4f(b.p.xyz+b.v.xyz*dt,b.p.w);b.q=rotateStep(b.q,b.w.xyz*dt);
  if(length(b.p.xyz-previous.p.xyz)+length(b.w.xyz)*length(b.half.xyz)*dt>.025){
   var first=1.0;
   for(var j=0u;j<header(0).x;j++){
    let box=header(1).x+j*5u;if(constants[box+2u].w>0||constants[box].w== -1){continue;}
    let local=rotate(inverseQ(constants[box+1u]),previous.p.xyz-constants[box].xyz);if(length(max(abs(local)-constants[box+2u].xyz,vec3f(0)))>length(b.half.xyz)+length(b.v.xyz)*dt+.03){continue;}
    for(var vertex=0u;vertex<select(8u,24u,b.half.w==2);vertex++){let sweep=sweepStaticSample(propVertex(previous,vertex),propVertex(b,vertex),0,constants[box].xyz,constants[box+1u],constants[box+2u].xyz);first=min(first,sweep.time);}
   }
   if(first<1){b.p=vec4f(mix(previous.p.xyz,b.p.xyz,first),b.p.w);b.q=normalize(mix(previous.q,b.q,first));}
  }
  saveProp(i,b);syncProp(i);
 }
 for(var iteration=0u;iteration<9u;iteration++){
  for(var i=0u;i<propCount();i++){
   if(propGone(f32(i+1u))||constants[propData(i)].w==0||constants[propData(i)+14u].y>.5){continue;}var b=propBody(i);propCurrentID=i;var impact=0.0;
   let count=select(8u,24u,b.half.w==2);
   // Cache broadphase candidates once per body/iteration, not per vertex.
   var candidates:array<u32,64>;var candidateCount=0u;
   for(var j=0u;j<header(0).x;j++){let box=header(1).x+j*5u;if(constants[box+2u].w==f32(i+1u)||!liveBox(box)){continue;}let local=rotate(inverseQ(constants[box+1u]),b.p.xyz-constants[box].xyz);let separation=length(max(abs(local)-constants[box+2u].xyz,vec3f(0)));if(constants[box].w!= -1&&separation>length(b.half.xyz)+.35){continue;}if(candidateCount<64u){candidates[candidateCount]=box;candidateCount++;}}
   for(var corner=0u;corner<count;corner++){
    var point=propVertex(b,corner);propOtherID=-1;propOther.status.x=0;
    if(point.y<.002){constants[propData(i)+14u].z=1;impact=max(impact,max(0,-(b.v.xyz+cross(b.w.xyz,point-b.p.xyz)).y));b=solvePropContact(b,point,vec3f(0,1,0),.002-point.y);}
    for(var candidate=0u;candidate<candidateCount;candidate++){
     let box=candidates[candidate];let tag=constants[box+2u].w;if(tag==f32(i+1u)||!liveBox(box)){continue;}
     if(distance(constants[box].xyz,b.p.xyz)>length(constants[box+2u].xyz)+length(b.half.xyz)+.06){continue;}
     point=propVertex(b,corner);let hit=pointBox(point,constants[box].xyz,constants[box+1u],constants[box+2u].xyz,constants[box].w);if(hit.depth< -.002){continue;}
     propOtherID=i32(tag)-1;propOther.status.x=0;if(propOtherID>=0){propOther=propBody(u32(propOtherID));}
     if(hit.normal.y>.55){constants[propData(i)+14u].z=1;}
     impact=max(impact,max(0,-dot(b.v.xyz+cross(b.w.xyz,point-b.p.xyz)-propVelocity(tag,point),hit.normal)));
     b=solvePropContact(b,point,hit.normal,hit.depth+.002);
    }
   }
   // Room boxes need the same edge/face fallback as movable boxes. A thin
   // rotated platform can intersect a crate with none of its corners inside.
   {for(var candidate=0u;candidate<candidateCount;candidate++){
    let box=candidates[candidate];if(constants[box+2u].w>0||constants[box].w== -1){continue;}
    var room:Body;room.p=vec4f(constants[box].xyz,0);room.q=constants[box+1u];room.half=vec4f(constants[box+2u].xyz,0);
    {let hit=propEdgeContact(b,room);if(hit.depth>.002){
     propOtherID=-1;propOther=room;let local=rotate(inverseQ(room.q),b.p.xyz-room.p.xyz);let point=room.p.xyz+rotate(room.q,clamp(local,-room.half.xyz,room.half.xyz));
     if(hit.normal.y>.55){constants[propData(i)+14u].z=1;}impact=max(impact,max(0,-dot(b.v.xyz,hit.normal)));b=solvePropContact(b,point,hit.normal,hit.depth);
    }}
   }}
   if(b.half.w!=2){for(var otherID=i+1u;otherID<propCount();otherID++){
    if(propGone(f32(otherID+1u))){continue;}let other=propBody(otherID);if(other.half.w==2||distance(b.p.xyz,other.p.xyz)>length(b.half.xyz)+length(other.half.xyz)){continue;}
    var vertexContact=false;for(var k=0u;k<8u;k++){if(pointBox(propVertex(b,k),other.p.xyz,other.q,other.half.xyz,1).depth>=0||pointBox(propVertex(other,k),b.p.xyz,b.q,b.half.xyz,1).depth>=0){vertexContact=true;break;}}
    if(!vertexContact){let hit=propEdgeContact(b,other);if(hit.depth>0){propOtherID=i32(otherID);propOther=other;if(hit.normal.y>.55){constants[propData(i)+14u].z=1;}b=solvePropContact(b,hit.point,hit.normal,hit.depth);}}
   }}
   let s=propData(i);if(iteration==0u&&impact>2&&frame.camera.w>constants[s+13u].w){
    constants[s+13u]=vec4f(0,0,0,frame.camera.w+.15);atomicMax(&work[38],(u32(clamp(impact/14,.12,1.0)*4095)<<8u)|255u);atomicAdd(&work[39],1u);
    propDamage(f32(i+1u),smoothstep(7.0,20.0,impact)*.7);
   }
   saveProp(i,b);syncProp(i);
  }
 }
 for(var i=0u;i<propCount();i++){
  let s=propData(i);if(constants[s].w==0){continue;}let held=frame.local.w>.5&&u32(frame.goal.w)==180u+i;let v=constants[s+2u].xyz;
  if(held){let peak=constants[s+12u];if(frame.camera.w-peak.w>.10||length(v)>length(peak.xyz)||dot(v,peak.xyz)<=0){constants[s+12u]=vec4f(v,frame.camera.w);}}
  else if(constants[s+14u].y<.5){let quiet=length(v)<.08&&length(constants[s+3u].xyz)<.13&&constants[s+14u].z>.5;let age=select(0.0,constants[s+14u].x+dt,quiet);constants[s+14u].x=age;if(age>.35){constants[s+14u].y=1;constants[s+2u]=vec4f(0);constants[s+3u]=vec4f(0);}}
 }
}
// Only the player contact correction returns to JavaScript, never prop poses.
// Contact results are epoch checked and expire before they can affect a later move.
@compute @workgroup_size(1) fn propPlayerContact(){
 let state=constants[propPlayerData()];var p=state.xyz;var ground=0.0;
 if(state.w>0){
  for(var iteration=0u;iteration<3u;iteration++){for(var i=0u;i<propCount();i++){
   if(propGone(f32(i+1u))){continue;}let b=propBody(i);
   let sampleCount=max(2u,u32(ceil((state.w+.12-.46)/.20))+1u);
   for(var sampleID=0u;sampleID<sampleCount;sampleID++){
    let h=mix(.23,max(.23,state.w+.12-.23),f32(sampleID)/f32(sampleCount-1u));
    let hit=pointBox(p+vec3f(0,h,0),b.p.xyz,b.q,b.half.xyz,b.half.w);let depth=.23+hit.depth;
    if(depth>0){p+=hit.normal*min(depth,.24);if(hit.normal.y>.55){ground=1;}}
   }
  }}
 }
 let delta=p-state.xyz;for(var k=0u;k<3u;k++){atomicStore(&work[1014u+k],bitcast<u32>(delta[k]));}atomicStore(&work[1017],bitcast<u32>(ground));
}
