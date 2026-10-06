// Contact material stays on the GPU. Footprints use the actual contacting sphere
// samples, projected body axes, and continuous distance rather than frame time.
struct Footprint { p:vec3f, radius:vec2f, angle:f32, receiver:i32, face:u32 };
fn contactMemory(index:u32)->u32 { return header(2).w+header(2).x*128u+180u*8u+index*16u; }
fn contactFloat(address:u32)->f32 { return bitcast<f32>(atomicLoad(&work[address])); }
fn footprint(b:Body)->Footprint {
 var rec:i32=-1;var nearest=.022;
 for(var si=0u;si<u32(b.half.w);si++){
  let s=sample(b,si);let center=b.p.xyz+rotate(b.q,s.xyz);
  if(center.y-s.w<nearest){nearest=center.y-s.w;rec=i32(floorRecord(center));}
  for(var j=16u;j<header(0).z;j++){
   let r=record(j);let distance=dot(center-r.center.xyz,r.n.xyz);let c=uv(r,center);
   if(distance>-.025&&distance-s.w<nearest&&all(c>=vec2f(0))&&all(c<=vec2f(1))){nearest=distance-s.w;rec=i32(j);}
  }
 }
 if(rec<0){return Footprint(vec3f(0),vec2f(0),0,-1,0u);}
 let r=record(u32(rec));let n=r.n.xyz;var axis=r.u.xyz;var best=0.0;
 for(var i=0u;i<3u;i++){var local=vec3f(0);local[i]=1;let a=rotate(b.q,local);let projected=a-n*dot(a,n);let score=dot(projected,projected)*b.half[i]*b.half[i];if(score>best){best=score;axis=safeNorm(projected);}}
 let across=safeNorm(cross(n,axis));var lo=vec2f(1e6);var hi=vec2f(-1e6);var count=0u;
 for(var si=0u;si<u32(b.half.w);si++){
  let s=sample(b,si);let center=b.p.xyz+rotate(b.q,s.xyz);let distance=dot(center-r.center.xyz,n);let c=uv(r,center);
  if(distance>s.w+.022||distance<-.025){continue;}
  if(rec>=16&&(any(c<vec2f(0))||any(c>vec2f(1)))){continue;}
  let depth=clamp(s.w-distance+.018,.008,.048);let radius=sqrt(max(.0001,2*s.w*depth-depth*depth))*.92;
  let relative=center-b.p.xyz;let point=vec2f(dot(relative,axis),dot(relative,across));lo=min(lo,point-radius);hi=max(hi,point+radius);count++;
 }
 if(count==0u){return Footprint(vec3f(0),vec2f(0),0,-1,0u);}
 let mid=(lo+hi)*.5;var p=b.p.xyz+axis*mid.x+across*mid.y;p-=n*dot(p-r.center.xyz,n);
 let localN=rotate(inverseQ(b.q),-n);let a=abs(localN);var face=select(5u,4u,localN.z>0);
 if(a.x>a.y&&a.x>a.z){face=select(1u,0u,localN.x>0);}else if(a.y>a.z){face=select(3u,2u,localN.y>0);}
 return Footprint(p,clamp((hi-lo)*.5,vec2f(.025),vec2f(.34)),atan2(dot(axis,r.v.xyz),dot(axis,r.u.xyz)),select(rec,i32(floorRecord(p)),rec<16),face);
}
fn planeWetCell(rec:u32,p:vec3f)->u32 {let id=select(rec,floorRecord(p),rec<16u);let r=record(id);return wetCell(r,uv(r,p));}
fn patchOffset(radius:vec2f,angle:f32,p:vec2f)->vec2f {let v=radius*p;return vec2f(cos(angle)*v.x-sin(angle)*v.y,sin(angle)*v.x+cos(angle)*v.y);}
fn contactStamp(rec:u32,a:vec3f,b:vec3f,oldRadius:vec2f,radius:vec2f,oldAngle:f32,angle:f32,amount:f32,kind:f32,seed:u32,travel:f32){
 if(amount<.002){return;}
 let r=record(rec);let extent=max(max(radius.x,radius.y),max(oldRadius.x,oldRadius.y))*2.3+.025;
 let start=uv(r,a);let end=uv(r,b);
 if(any(max(start,end)+vec2f(extent)/r.size.xy<vec2f(0))||any(min(start,end)-vec2f(extent)/r.size.xy>vec2f(1))){return;}
 let i=atomicAdd(&work[3],1u);if(i>=8192u){atomicAdd(&work[4],1u);return;}
 stamps[i]=Stamp(vec4f(start,radius/r.size.xy),vec4f(end,angle,amount),vec4f(oldAngle,oldRadius,travel),vec4f(f32(rec),kind,f32(seed),0));
}
fn contactSweep(rec:u32,a:vec3f,b:vec3f,oldRadius:vec2f,radius:vec2f,oldAngle:f32,angle:f32,amount:f32,kind:f32,seed:u32,travel:f32){
 if(rec<16u){for(var k=0u;k<16u;k++){contactStamp(k,a,b,oldRadius,radius,oldAngle,angle,amount,kind,seed,travel);}}
 else{contactStamp(rec,a,b,oldRadius,radius,oldAngle,angle,amount,kind,seed,travel);}
}
fn poolDeposit(rec:u32,p:vec3f,radius:vec2f,angle:f32,amount:f32,seed:u32){
 contactSweep(rec,p,p,radius,radius,angle,angle,amount,4,seed,0);
 let r=record(rec);for(var j=0u;j<9u;j++){let offset=patchOffset(radius,angle,vec2f(f32(j%3u)-1,f32(j/3u)-1)*.6);let point=p+r.u.xyz*offset.x+r.v.xyz*offset.y;addWet(planeWetCell(rec,point),u32(amount*.08*65536));}
}
fn wallSplat(foot:Footprint,coat:f32,speed:f32,seed:u32)->f32 {
 let energy=smoothstep(1.2,9.0,speed);let spent=coat*(.18+.22*energy);
 let size=clamp(foot.radius*(1.5+energy),vec2f(.065),vec2f(.52));let rec=u32(foot.receiver);let r=record(rec);
 let strength=min(.96,spent*4.5)*frame.tune.y;
 contactStamp(rec,foot.p,foot.p,size,size,foot.angle,foot.angle,strength,6,seed,spent*.02);
 // The broad contact print and radial flecks remain in the pigment layer after
 // excess liquid drains. Flecks share the same coating expenditure.
 for(var i=0u;i<8u;i++){
  let h=seed+i*197u;let angle=f32(i)*.785398+hash(h)*.55;let offset=patchOffset(size,foot.angle,vec2f(cos(angle),sin(angle))*(1.1+hash(h+1u)*(.6+energy)));
  splatKind(rec,foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y,.018+hash(h+2u)*(.025+energy*.032),strength*(.55+hash(h+3u)*.4),h,5);
 }
 atomicAdd(&work[29],1u);return spent;
}
fn paintContact(index:u32,input:Body,dt:f32)->Body {
 var b=input;let mem=contactMemory(index);let foot=footprint(b);
 let impactClock=max(0,contactFloat(mem+7u)-dt);atomicStore(&work[mem+7u],bitcast<u32>(impactClock));
 if(foot.receiver<0||b.status.x<.5){b.track.w=0;atomicStore(&work[mem+5u],0u);atomicStore(&work[mem+8u],0u);return b;}
 let rec=u32(foot.receiver);let r=record(rec);let radius=foot.radius;let seed=index*731u+foot.face*113u;
 var surfaceWet=0.0;var pickup=0.0;
 for(var j=0u;j<9u;j++){
  let angle=(f32(j)-1)*.785398;let v=select(vec2f(cos(angle),sin(angle))*.65,vec2f(0),j==0u);let offset=patchOffset(radius,foot.angle,v);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;let cell=planeWetCell(rec,point);
  let filmRec=select(rec,floorRecord(point),rec<16u);let filmR=record(filmRec);let filmCell=vec2u(clamp(uv(filmR,point)*vec2f(filmDimensions(filmR)),vec2f(0),vec2f(filmDimensions(filmR))-1));let filmIndex=filmAddress(filmR,filmCell);
  surfaceWet+=max(f32(atomicLoad(&wet[cell]))/65536.0,filmRead(0u,filmIndex)*3)/9;
  // A wet coating deposits onto a drier wall; it must not immediately vacuum
  // its own print back up at the full pickup rate. Floors keep their pickup.
  let equilibrium=select(1.3,min(1.3,filmRead(0u,filmIndex)*3),abs(r.n.y)<.65);
  let wantedCoat=min(dt*2.8*frame.tune.z,max(0,equilibrium-b.coat.x))/9;
  let cellArea=filmR.size.x*filmR.size.y/f32(filmDimensions(filmR).x*filmDimensions(filmR).y);
  // The coarse wet grid controls pigment mobility, not a second blood reserve.
  // One unit of coating corresponds to .02 integrated film units in world area.
  takeWet(cell,u32(wantedCoat*65536));let liquidTaken=takeWet(filmOffset(0u)+filmIndex,u32(wantedCoat*.02/cellArea*65536));
  pickup+=f32(liquidTaken)/65536.0*cellArea/.02;
 }
 b.coat.x=min(1.65,b.coat.x+pickup);
 let abrasion=length(b.v.xyz)*select(.001,.018,frame.local.w>.5&&u32(frame.goal.w)/15u==index/15u)*frame.rayD.w;
 if(abrasion>.03&&b.coat.y<=0){b.blood.x=min(2.0,b.blood.x+abrasion*.3);b.blood.w=max(0,b.blood.w-abrasion*.2);b.coat.y=.18;}
 let oldRec=i32(b.track.w)-1;let samePlane=oldRec==i32(rec)||(oldRec>=0&&oldRec<16&&rec<16u);
 let connected=b.track.w>0&&samePlane&&atomicLoad(&work[mem+4u])==foot.face;
 var previous=b.track.xyz;var oldAngle=contactFloat(mem);var oldRadius=vec2f(contactFloat(mem+1u),contactFloat(mem+2u));var travelled=contactFloat(mem+3u);
 let wall=abs(r.n.y)<.65;let before=bodies[index];let incoming=max(0,-dot(before.v.xyz+cross(before.w.xyz,foot.p-before.p.xyz),r.n.xyz));
 if(wall&&impactClock<=0&&frame.tune.y>.001&&incoming>1.4&&b.coat.x>.10){
  b.coat.x-=wallSplat(foot,b.coat.x,incoming,seed+atomicLoad(&work[5])*31u);atomicStore(&work[mem+7u],bitcast<u32>(.28));
 }
 if(!connected){previous=foot.p;oldAngle=foot.angle;oldRadius=radius;travelled=0;atomicStore(&work[mem+5u],0u);atomicStore(&work[mem+6u],0u);if(!wall&&b.coat.x>.18){let amount=b.coat.x*.055;poolDeposit(rec,foot.p,radius*.7,foot.angle,amount,seed);b.coat.x-=amount*.80;}}
 let da=angleDelta(foot.angle,oldAngle);let angle=oldAngle+da;let movement=distance(foot.p,previous)+abs(da)*max(radius.x,radius.y);
 var resting=contactFloat(mem+5u);var poolClock=contactFloat(mem+6u);
 if(movement<.009){resting+=dt;poolClock+=dt;}else{resting=0;poolClock=0;}
 var save=movement>.7||!connected||b.coat.x<.007;
 if(movement>=.009&&movement<=.7){
  let count=min(24u,u32(ceil(movement/.018)));var a=previous;var ra=oldRadius;var aa=oldAngle;
  for(var j=1u;j<=count;j++){
   let t=f32(j)/f32(count);let p=mix(previous,foot.p,t);let rb=mix(oldRadius,radius,t);let ab=oldAngle+da*t;travelled+=movement/f32(count);
   // Wet pigment is displaced from an immutable GPU snapshot before fresh coating.
   if(surfaceWet>.012){contactSweep(rec,a,p,ra,rb,aa,ab,min(.48,surfaceWet*1.4),3,seed,travelled);atomicAdd(&work[25],1u);}
   if(b.coat.x>.007){contactSweep(rec,a,p,ra,rb,aa,ab,min(1.4,b.coat.x)*frame.tune.y,1,seed,travelled);atomicAdd(&work[23],1u);}
   a=p;ra=rb;aa=ab;
  }
  let spent=select(min(b.coat.x,movement*(.055+sqrt(radius.x*radius.y)*1.2)*frame.tune.z),0.0,wall);b.coat.x-=spent;
  for(var j=0u;j<5u;j++){let offset=patchOffset(radius,angle,vec2f(cos(f32(j)*2.399963),sin(f32(j)*2.399963))*.62);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;addWet(planeWetCell(rec,point),u32(spent*.055*65536));}
  save=true;
 }
 // Wall transfer follows the material bristles, including stationary pressure.
 // Deposit finite volume into their actual tracks instead of alpha pool stamps.
 // Word 8 is only a deposition cadence, not an additional material reservoir.
 // Compression routes a finite wound supply into the contact instead of
 // launching all fresh blood away as tiny drops. Supply stops on release.
 if(wall&&frame.local.w>.5&&u32(frame.goal.w)/15u==index/15u&&b.blood.x>.001&&b.coat.w>0){
  let held=localBodies[u32(frame.goal.w)%15u];let heldPoint=held.p.xyz+rotate(held.q,frame.local.xyz);
  let pressure=clamp(-dot(frame.goal.xyz-heldPoint,r.n.xyz)/.16,0,1);
  let reserve=min(b.coat.w,dt*b.blood.x*frame.action.z*pressure*.16);
  let supplied=min(reserve*5,max(0,1.65-b.coat.x));
  b.coat.w-=supplied*.2;b.coat.x+=supplied;
 }
 var wallClock=contactFloat(mem+8u)+dt;
 if(wall&&wallClock>=.025&&frame.tune.y>.001&&b.coat.x>.008){
  let spent=min(b.coat.x,(.085+min(1.0,b.coat.x)*.8)*wallClock*frame.tune.z);
  // Match the existing brush's stable material coordinates. Half the liquid
  // wets the hairs; squeezed excess collects at the lower contact edge.
  // Every weight sums to one, independent of coverage, frame rate or footprint.
  for(var j=0u;j<54u;j++){
   let h=hash(seed*113u+j*977u);let h2=hash(seed*337u+j*199u);
   let material=vec2f(cos(h*6.283185),sin(h*6.283185))*sqrt(h2)*.98;
   let offset=patchOffset(radius,foot.angle,material);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;
   let volume=spent*.02*.85*(.5/54.0);
   returnFilm(rec,point,volume);
  }
  let down=normalize(-vec2f(r.u.y,r.v.y));let across=vec2f(down.y,-down.x);
  let ca=cos(foot.angle);let sn=sin(foot.angle);
  let localDown=vec2f(ca*down.x+sn*down.y,-sn*down.x+ca*down.y);
  let localAcross=vec2f(ca*across.x+sn*across.y,-sn*across.x+ca*across.y);
  let bottom=length(radius*localDown);let width=length(radius*localAcross);
  for(var j=0u;j<2u;j++){
   let crossPosition=select(-.46,.42,j==1u)+(hash(seed+j*37u)-.5)*.20;
   let offset=across*width*crossPosition+down*bottom*sqrt(1-crossPosition*crossPosition);
   let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;
   returnFilm(rec,point,spent*.02*.85*select(.21,.29,j==1u));
  }
  // A held footprint retains brush grain, without introducing a second shape.
  if(movement<.009){contactStamp(rec,foot.p,foot.p,radius,radius,foot.angle,foot.angle,min(1.4,b.coat.x)*frame.tune.y,1,seed,travelled);}
  for(var j=0u;j<5u;j++){let offset=patchOffset(radius,angle,vec2f(cos(f32(j)*2.399963),sin(f32(j)*2.399963))*.62);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;addWet(planeWetCell(rec,point),u32(spent*.055*65536));}
  b.coat.x=max(0,b.coat.x-spent);wallClock=0;atomicAdd(&work[24],1u);
 }
 atomicStore(&work[mem+8u],bitcast<u32>(min(wallClock,.15)));
 if(!wall&&resting>.35&&poolClock>.55&&(b.blood.x>.001||b.coat.x>.30)&&b.coat.x>.08){
  let spread=1+min(.85,sqrt(resting)*.24);let amount=min(.22,b.coat.x*.18);poolDeposit(rec,foot.p,radius*spread,angle,amount,seed);b.coat.x=max(0,b.coat.x-amount*.80);poolClock=0;atomicAdd(&work[24],1u);
 }
 if(save){b.track=vec4f(foot.p,f32(rec)+1);atomicStore(&work[mem],bitcast<u32>(angle));atomicStore(&work[mem+1u],bitcast<u32>(radius.x));atomicStore(&work[mem+2u],bitcast<u32>(radius.y));atomicStore(&work[mem+3u],bitcast<u32>(travelled));atomicStore(&work[mem+4u],foot.face);}
 atomicStore(&work[mem+5u],bitcast<u32>(resting));atomicStore(&work[mem+6u],bitcast<u32>(poolClock));return b;
}

// Paint snapshot dispatch completes before rasterization. Only binned tiles are
// copied; the bin halo includes every backtrace tap, including adjacent floor tiles.
fn tileRecord(tile:u32)->u32 {for(var i=0u;i<header(0).w;i++){let r=record(i);if(tile>=r.address.y&&tile<r.address.y+r.address.z*r.address.w){return i;}}return 0u;}
@compute @workgroup_size(8,8) fn snapshotPaint(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_id) local:vec3u){
 let tile=atomicLoad(&work[header(2).z+group.x]);let r=record(tileRecord(tile));let t=tile-r.address.y;let origin=vec2u(t%r.address.z,t/r.address.z)*16u;
 for(var y=0u;y<2u;y++){for(var x=0u;x<2u;x++){let pos=origin+local.xy+vec2u(x,y)*8u;if(all(pos<vec2u(r.size.zw))){let address=r.address.x+pos.x+pos.y*u32(r.size.z);paintBefore[address]=pigment[address];}}}
}
fn premultiplied(c:vec4f)->vec4f {return vec4f(c.rgb*c.a,c.a);}
fn straight(c:vec4f)->vec4f {return vec4f(c.rgb/max(c.a,1e-6),c.a);}
fn snapshotPixel(rec:u32,pos:vec2i)->vec4f {
 var id=rec;var r=record(id);var p=pos;
 if(id<16u&&(any(p<vec2i(0))||any(p>=vec2i(r.size.zw)))){
  let world=r.center.xyz+r.u.xyz*((f32(p.x)+.5)/r.size.z-.5)*r.size.x+r.v.xyz*((f32(p.y)+.5)/r.size.w-.5)*r.size.y;id=floorRecord(world);r=record(id);p=vec2i(floor(uv(r,world)*r.size.zw));
 }
 p=clamp(p,vec2i(0),vec2i(r.size.zw)-1);return premultiplied(unpack(paintBefore[r.address.x+u32(p.x)+u32(p.y)*u32(r.size.z)]));
}
fn contactDisplacement(s:Stamp,r:Record,pixel:vec2f)->vec2f {
 let p=pixel/r.size.zw;let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);let local=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/(s.a.zw*r.size.xy);
 let mask=(1-smoothstep(.4,1.2,length(local)))*s.b.w;let previous=s.a.xy+patchOffset(s.color.yz,s.color.x,local)/r.size.xy;return (p-previous)*r.size.xy*mask;
}
fn contactVelocity(s:Stamp,r:Record,pixel:vec2f)->vec2f {
 let p=pixel/r.size.zw;let delta=(p-s.b.xy)*r.size.xy;let ca=cos(s.b.z);let sn=sin(s.b.z);
 let local=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/(s.a.zw*r.size.xy);
 let mask=(1-smoothstep(.50,1.15,length(local)))*s.b.w;
 let previous=s.a.xy+patchOffset(s.color.yz,s.color.x,local)/r.size.xy;let shift=(p-previous)*r.size.zw;
 return shift*min(1.0,.8/max(abs(shift.x)+abs(shift.y),1e-6))*mask;
}
fn displacedPaint(s:Stamp,pixel:vec2f,dst:vec4f)->vec4f {
 let id=u32(s.info.x);let r=record(id);let pos=vec2i(floor(pixel));let center=snapshotPixel(id,pos);let velocity=contactVelocity(s,r,pixel);var change=vec4f(0);
 // Equal and opposite upwind flux across each pixel edge moves pigment rather
 // than repeatedly cloning a sampled colour. The CFL bound keeps flux positive.
 for(var k=0u;k<4u;k++){
  let offset=select(vec2i(select(-1,1,k==0u),0),vec2i(0,select(-1,1,k==2u)),k>=2u);
  let otherVelocity=contactVelocity(s,r,pixel+vec2f(offset));let flux=dot((velocity+otherVelocity)*.5,vec2f(offset));
  if(abs(flux)>.00001){let other=snapshotPixel(id,pos+offset);change-=select(center,other,flux<0)*flux;}
 }
 let moved=clamp(premultiplied(dst)+change,vec4f(0),vec4f(1));return straight(vec4f(min(moved.rgb,vec3f(moved.a)),moved.a));
}
