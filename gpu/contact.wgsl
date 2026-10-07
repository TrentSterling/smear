// Contact material stays on the GPU. Footprints use the actual contacting sphere
// samples, projected body axes, and continuous distance rather than frame time.
struct Footprint { p:vec3f, radius:vec2f, angle:f32, receiver:i32, face:u32 };
fn contactMemory(index:u32)->u32 { return header(2).w+header(2).x*128u+180u*8u+index*16u; }
fn materialTune()->vec4f {return constants[header(3).z];}
fn carryReach()->f32 {return 1+round((constants[header(3).z+1u].x-1)*2);}
fn contactFloat(address:u32)->f32 { return bitcast<f32>(atomicLoad(&work[address])); }
fn receiveCoating(address:u32,capacity:f32)->f32 {
 var old=atomicLoad(&work[address]);var amount=0u;loop{
  amount=min(old,u32(max(0,capacity)*65536));let result=atomicCompareExchangeWeak(&work[address],old,old-amount);
  if(result.exchanged){break;}old=result.old_value;
 }
 return f32(amount)/65536;
}
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
fn wallSplat(foot:Footprint,coat:f32,speed:f32,seed:u32,velocity:vec3f)->f32 {
 let energy=smoothstep(1.2,9.0,speed);let spent=coat*(.18+.22*energy);
 let rec=u32(foot.receiver);let r=record(rec);let tangent=vec2f(dot(velocity,r.u.xyz),dot(velocity,r.v.xyz));
 let slip=smoothstep(.5,8.0,length(tangent));let direction=tangent/max(length(tangent),.0001);
 let angle=foot.angle+angleDelta(atan2(direction.y,direction.x),foot.angle)*slip;
 let size=clamp(foot.radius*(1.5+energy)*vec2f(1+slip*.45,1-slip*.18),vec2f(.065),vec2f(.58))*materialTune().z;
 let center=foot.p+(r.u.xyz*direction.x+r.v.xyz*direction.y)*slip*.09;
 let strength=min(.96,spent*4.5)*frame.tune.y;
 contactStamp(rec,center,center,size,size,angle,angle,strength,6,seed,spent*.02);
 // The broad contact print and radial flecks remain in the pigment layer after
 // excess liquid drains. Flecks share the same coating expenditure.
 for(var i=0u;i<8u;i++){
  let h=seed+i*197u;let fan=mix(f32(i)*.785398+hash(h)*.55,(hash(h)-.5)*2.3,slip);let offset=patchOffset(size,angle,vec2f(cos(fan),sin(fan))*(1.1+hash(h+1u)*(.6+energy+slip*.6)));
  splatKind(rec,center+r.u.xyz*offset.x+r.v.xyz*offset.y,.018+hash(h+2u)*(.025+energy*.032),strength*(.55+hash(h+3u)*.4),h,5);
 }
 atomicAdd(&work[29],1u);return spent;
}
// Impact injury spends the internal reserve immediately, without waiting for
// abrasion or a pre-existing coating. Normal velocity loss rejects glancing
// travel, free flight and steady pressure; angular contact speed counts too.
fn impactBlood(index:u32,input:Body,hit:WorldImpact)->Body {
 var b=input;
 // Pair corrections use xyz in each of two vec4s; their two padding words
 // retain the collision episode. Brief solver separation must not turn held
 // scraping/chatter into a fresh explosion every time the cooldown expires.
 let episode=header(2).w+header(2).x*128u+index*8u;
 if(hit.receiver<0){let air=contactFloat(episode+7u)+1.0/120;atomicStore(&work[episode+7u],bitcast<u32>(air));if(air>.055){atomicStore(&work[episode+3u],0u);}return b;}
 atomicStore(&work[episode+7u],0u);let receiver=u32(hit.receiver)+1u;
 let sameContact=atomicLoad(&work[episode+3u])==receiver;
 if(sameContact){return b;}
 if(hit.receiver<0||hit.closing<3.0||b.status.x<.5||frame.rayD.w<=0||contactFloat(contactMemory(index)+7u)>0){return b;}
 let outgoing=b.v.xyz+cross(b.w.xyz,hit.point-b.p.xyz);
 let lost=min(hit.closing,max(0,dot(outgoing-hit.velocity,hit.normal)));
 // A held limb can rotate rapidly as the positional grab solver presses it
 // against the wall. Require a real fast approach of the held rig; ordinary
 // loaded scraping already has its own accepted abrasion response.
 let held=heldComponent(index);
 if(held&&-dot(bodies[index].v.xyz,hit.normal)<7){return b;}
 let severity=smoothstep(2.8,13.0,lost)*frame.rayD.w;
 if(severity<.015){return b;}
 atomicStore(&work[episode+3u],receiver);
 let seed=index*731u+atomicLoad(&work[5])*31u;
 let rec=u32(hit.receiver);let r=record(rec);let n=r.n.xyz;
 let point=hit.point-n*dot(hit.point-r.center.xyz,n);
 atomicStore(&work[fractureState(index)+6u],0u);b.blood.x=min(2.0,b.blood.x+severity*1.4);b.blood.w=max(0,b.blood.w-severity*32);
 atomicStore(&work[contactMemory(index)+7u],bitcast<u32>(.32));
 atomicAdd(&work[34],1u);
 let local=rotate(inverseQ(b.q),point-b.p.xyz);let normal=rotate(inverseQ(b.q),-n);let c=skinPoint(b,local,normal);
 stamp(header(0).z+index,c,c,vec2f(.045,.07)*(1+min(1.0,severity)),min(.95,.35+severity),0,f32(seed%18u),0);
 // Reserve units match pressure feeding: one reserve becomes five coating
 // units, each carrying .02 film volume. Empty parts cannot create fresh fluid.
 let reserve=min(b.coat.w,(.10+severity*.75)*frame.action.z);
 b.coat.w-=reserve;
 let oldCoat=min(b.coat.x,b.coat.x*(.15+min(1.0,severity)*.30));b.coat.x-=oldCoat;
 let volume=reserve*.10+oldCoat*.02;
 if(volume<.00001){return b;}
 let retained=min(max(0,1.65-b.coat.x)*.02,volume*.08);b.coat.x+=retained/.02;
 var surfaceVolume=volume-retained;
 let energy=clamp(severity,0,1);let tangent=hit.velocity-n*dot(hit.velocity,n);let slip=smoothstep(.5,10.0,length(tangent));
 let angle=atan2(dot(tangent,r.v.xyz),dot(tangent,r.u.xyz))+hash(seed)*.4;
 let radius=(.12+sqrt(energy)*.46+hit.radius*.40)*sqrt(min(1.0,volume/.035))*materialTune().z;
 let size=vec2f(radius*(1+slip*.45),radius*(1-slip*.20));
 let count=6u+u32(energy*18);let portion=surfaceVolume*.20/f32(count);
 for(var j=0u;j<count;j++){
  let h=seed+j*197u;let a=f32(j)*2.399963+hash(h)*.6;
  let radial=r.u.xyz*cos(a)+r.v.xyz*sin(a);
  let speed=(1.4+energy*6.5)*(.5+hash(h+1u)*.9);
  let velocity=bounded(tangent*.55+radial*speed+n*(.5+hash(h+2u)*2.2),18);
  // Eject just beyond the skin silhouette so the owning dummy doesn't swallow
  // the entire burst. Failed allocations remain in the attached print budget.
  if(launchDrop(point+radial*hit.radius*.7+n*.035,velocity,clamp(pow(portion,.333333)*.28,.006,.025),index,portion)){
   surfaceVolume-=portion;atomicAdd(&work[35],1u);
  }
 }
 let strength=min(.98,volume*40)*frame.tune.y;
 contactSweep(rec,point,point,size,size,angle,angle,strength,8,seed,surfaceVolume);
 // Broken radial jets and satellite splatter are pigment from the same burst,
 // not overlapping soft alpha dabs and not additional liquid reservoirs.
 for(var j=0u;j<10u;j++){
  let h=seed+j*313u;let a=f32(j)*2.399963+hash(h)*.65;
  let offset=patchOffset(size,angle,vec2f(cos(a),sin(a)));
  let end=point+(r.u.xyz*offset.x+r.v.xyz*offset.y)*(1.15+hash(h+1u)*(.5+energy))+tangent*.012;
  splatKind(rec,end,.018+hash(h+4u)*(.035+energy*.04),strength*.75,h,5);
 }
 atomicAdd(&work[29],1u);atomicAdd(&work[36],u32(volume*65536));return b;
}
// Squeeze a finite liquid layer out of the contact and fling a small part of
// the coating from its moving edge. These are transfers, never extra paint.
fn squeezeContact(index:u32,b:Body,foot:Footprint,duration:f32,pressure:f32)->f32 {
 let rec=u32(foot.receiver);let r=record(rec);let dims=filmDimensions(r);
 let area=r.size.x*r.size.y/f32(dims.x*dims.y);let seed=index*731u+foot.face*113u;
 let centerMotion=b.v.xyz+cross(b.w.xyz,foot.p-b.p.xyz);
 let sliding=centerMotion-r.n.xyz*dot(centerMotion,r.n.xyz);
 let spin=abs(dot(b.w.xyz,r.n.xyz));let activity=length(sliding)+spin*max(foot.radius.x,foot.radius.y);
 if(activity<.06&&pressure<.05){return 0;}
 for(var j=0u;j<18u;j++){
  let h=hash(seed+j*977u);let a=h*6.283185;
  let material=vec2f(cos(a),sin(a))*sqrt(hash(seed+j*199u))*.90;
  let offset=patchOffset(foot.radius,foot.angle,material);
  let radial=r.u.xyz*offset.x+r.v.xyz*offset.y;
  let point=foot.p+radial;let cell=vec2u(clamp(uv(r,point)*vec2f(dims),vec2f(0),vec2f(dims)-1));
  let address=filmAddress(r,cell);let mass=filmRead(0u,address);
  let motion=sliding+cross(r.n.xyz*dot(b.w.xyz,r.n.xyz),radial);
  let outward=safeNorm(radial);let push=motion*.30+outward*(pressure*.42+spin*length(radial)*.16);
  let fraction=min(.30,duration*(pressure*4.0+length(motion)*2.0));
  let taken=takeWet(filmOffset(0u)+address,u32(max(0,mass-.012)*fraction*FILM_SCALE));
  if(taken==0u){continue;}
  let edgeOffset=patchOffset(foot.radius,foot.angle,vec2f(cos(a),sin(a))*(1.06+hash(seed+j*71u)*.09));
  let edge=foot.p+r.u.xyz*edgeOffset.x+r.v.xyz*edgeOffset.y+bounded(motion*duration*.3,.035);
  let destination=mix(point+bounded(push*duration,.055),edge,pressure*.80);
  returnFilm(rec,destination,f32(taken)/FILM_SCALE*area);
  atomicAdd(&work[31],taken);
 }
 let fast=smoothstep(1.4,6.5,activity);if(fast<=0||b.coat.x<.12){return 0;}
 var spent=0.0;
 for(var j=0u;j<2u;j++){
  let h=seed+atomicLoad(&work[5])*31u+j*173u;let a=hash(h)*6.283185;
  let offset=patchOffset(foot.radius,foot.angle,vec2f(cos(a),sin(a))*(1.03+hash(h+1u)*.22));
  let radial=r.u.xyz*offset.x+r.v.xyz*offset.y;
  let edgeMotion=sliding+cross(r.n.xyz*dot(b.w.xyz,r.n.xyz),radial);
  let spray=bounded(edgeMotion*.90+safeNorm(radial)*(.6+pressure*1.8),13.0);
  // Alternate outward drops and shallow wall-bound jets to spread beyond the
  // rubbed ring. Both travel through the normal ballistic collision path.
  let velocity=spray+r.n.xyz*select(-.35-hash(h+2u)*.55,.35+hash(h+2u)*.8,j==0u);
  let coat=min(max(0,b.coat.x-spent)*.03,duration*fast*(.035+hash(h+3u)*.08));
  if(coat>.0001&&launchDrop(foot.p+radial+r.n.xyz*.022,velocity,clamp(pow(coat*.02,.333333)*.35,.004,.013),index,coat*.02)){
   spent+=coat;atomicAdd(&work[32],1u);
  }
 }
 return spent;
}
// Loaded floor contacts sweep the whole wet footprint toward its leading edge.
// Bristles still handle the high-resolution stain. These atomic debits move the
// actual mobile layer, including rotation about a stationary grabbed torso.
fn squeegeeFloor(b:Body,foot:Footprint,duration:f32,strength:f32,pressure:f32){
 let rec=u32(foot.receiver);let r=record(rec);let dims=filmDimensions(r);
 let spacing=r.size.xy/vec2f(dims);let area=spacing.x*spacing.y;
 let ca=cos(foot.angle);let sn=sin(foot.angle);let radius=foot.radius;
 let extent=vec2f(abs(ca)*radius.x+abs(sn)*radius.y,abs(sn)*radius.x+abs(ca)*radius.y);
 let center=uv(r,foot.p)*vec2f(dims);let lo=vec2i(floor(center-extent/spacing));let hi=vec2i(ceil(center+extent/spacing));
 for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){
  let delta=(vec2f(f32(x)+.5,f32(y)+.5)-center)*spacing;
  let local=vec2f(ca*delta.x+sn*delta.y,-sn*delta.x+ca*delta.y)/radius;
  if(dot(local,local)>.94){continue;}
  let address=filmPosition(rec,vec2i(x,y));if(address<0){continue;}
  let mass=filmRead(0u,u32(address));if(mass<.006){continue;}
  let point=foot.p+r.u.xyz*delta.x+r.v.xyz*delta.y;
  let velocity=b.v.xyz+cross(b.w.xyz,point-b.p.xyz);
  let pivot=localBodies[u32(frame.goal.w)%15u];let arm=point-(pivot.p.xyz+rotate(pivot.q,frame.local.xyz));
  // A rotating loaded rig sheds its gathered ridge away from the grab pivot.
  // Pure tangential transport only circulates the same ring beneath the limbs.
  let spin=abs(dot(b.w.xyz,r.n.xyz));let outward=vec2f(dot(arm,r.u.xyz),dot(arm,r.v.xyz))*spin*.85;
  let motion=vec2f(dot(velocity,r.u.xyz),dot(velocity,r.v.xyz))+outward;let speed=length(motion);
  if(speed<.12){continue;}
  let direction=motion/speed;
  let localDir=vec2f(ca*direction.x+sn*direction.y,-sn*direction.x+ca*direction.y)/radius;
  let along=dot(local,localDir);let square=dot(localDir,localDir);
  let edge=(-along+sqrt(max(0,along*along+square*(1-dot(local,local)))))/square;
  let carry=constants[header(3).z+1u].x;
  let distance=edge+.025+min(.15,speed*duration*.6*(carry-1));
  let fraction=min(.65,1-exp(-duration*speed*strength*(4+pressure*3)/max(.06,sqrt(radius.x*radius.y))));
  let taken=takeWet(filmOffset(0u)+u32(address),u32(max(0,mass-.003)*fraction*FILM_SCALE));
  if(taken==0u){continue;}
  let destination=point+(r.u.xyz*direction.x+r.v.xyz*direction.y)*distance;
  returnFilm(rec,destination,f32(taken)/FILM_SCALE*area);atomicAdd(&work[53],taken);
 }}
}
fn paintContact(index:u32,input:Body,dt:f32)->Body {
 var b=input;let mem=contactMemory(index);b.coat.x+=receiveCoating(mem+9u,1.65-b.coat.x);let foot=footprint(b);
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
  // A loaded squeegee routes most wet floor supply around the body rather than
  // immediately soaking it all up. Unheld pickup and wall transfer stay intact.
  let pushing=rec<16u&&heldComponent(index);
  let pickupRate=select(1.0,1/(1+materialTune().x*2),pushing);
  let wantedCoat=min(dt*2.8*frame.tune.z*pickupRate,max(0,equilibrium-b.coat.x))/9;
  let cellArea=filmR.size.x*filmR.size.y/f32(filmDimensions(filmR).x*filmDimensions(filmR).y);
  // The coarse wet grid controls pigment mobility, not a second blood reserve.
  // One unit of coating corresponds to .02 integrated film units in world area.
  takeWet(cell,u32(wantedCoat*65536));let liquidTaken=takeWet(filmOffset(0u)+filmIndex,u32(wantedCoat*.02/cellArea*65536));
  pickup+=f32(liquidTaken)/65536.0*cellArea/.02;
 }
 b.coat.x=min(1.65,b.coat.x+pickup);
 // Wear belongs to the contacting body face, survives washing and clears on Heal.
 // Tangential travel under load includes rotation; hovering/resting does no work.
 let held=heldComponent(index);var pressure=0.0;
 if(held){let part=localBodies[u32(frame.goal.w)%15u];let point=part.p.xyz+rotate(part.q,frame.local.xyz);pressure=clamp(-dot(frame.goal.xyz-point,r.n.xyz)/.16,0,1);}
 let contactMotion=b.v.xyz+cross(b.w.xyz,foot.p-b.p.xyz);
 let slip=length(contactMotion-r.n.xyz*dot(contactMotion,r.n.xyz))+abs(dot(b.w.xyz,r.n.xyz))*sqrt(radius.x*radius.y)*.6;
 let load=clamp(max(0,r.n.y)*.35+pressure+.10,0,1);
 let scrape=max(0,slip-.12)*dt*load*select(.08,1.0,held)*frame.rayD.w*materialTune().y;
 let wearAddress=mem+10u+foot.face;let wear=min(1.0,contactFloat(wearAddress)+scrape*.035);
 atomicStore(&work[wearAddress],bitcast<u32>(wear));
 if(scrape>0){
  atomicStore(&work[fractureState(index)+6u],0u);
  b.blood.x=min(2.0,b.blood.x+scrape*(.035+wear*.16));b.blood.w=max(0,b.blood.w-scrape*(.20+wear*.60));
  if(b.coat.y<=0&&wear>.015){
   let local=rotate(inverseQ(b.q),foot.p-b.p.xyz);let normal=rotate(inverseQ(b.q),-r.n.xyz);let c=skinPoint(b,local,normal);
   stamp(header(0).z+index,c,c,vec2f(.018,.027)*(1+sqrt(wear)*2),min(.7,.15+wear*.55),0,f32(seed%18u),foot.angle);b.coat.y=.18;
  }
 }
 let smudge=materialTune().x*(1+wear*1.25);
 let oldRec=i32(b.track.w)-1;let samePlane=oldRec==i32(rec)||(oldRec>=0&&oldRec<16&&rec<16u);
 let connected=b.track.w>0&&samePlane&&atomicLoad(&work[mem+4u])==foot.face;
 var previous=b.track.xyz;var oldAngle=contactFloat(mem);var oldRadius=vec2f(contactFloat(mem+1u),contactFloat(mem+2u));var travelled=contactFloat(mem+3u);
 let wall=abs(r.n.y)<.65;let before=bodies[index];let incoming=max(0,-dot(before.v.xyz+cross(before.w.xyz,foot.p-before.p.xyz),r.n.xyz));
 if(wall&&impactClock<=0&&frame.tune.y>.001&&incoming>1.4&&b.coat.x>.10){
  b.coat.x-=wallSplat(foot,b.coat.x,incoming,seed+atomicLoad(&work[5])*31u,before.v.xyz+cross(before.w.xyz,foot.p-before.p.xyz));atomicStore(&work[mem+7u],bitcast<u32>(.28));
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
   if(surfaceWet>.012&&smudge>0){contactSweep(rec,a,p,ra,rb,aa,ab,min(.95,surfaceWet*1.8)*smudge,3,seed,travelled);atomicAdd(&work[25],1u);}
   if(b.coat.x>.007){contactSweep(rec,a,p,ra,rb,aa,ab,min(1.4,select(b.coat.x,.4*sqrt(b.coat.x)+.7*b.coat.x,wall))*frame.tune.y,1,seed,travelled);atomicAdd(&work[23],1u);}
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
 let woundContact=select(0.0,pressure*.16,wall)+wear*smoothstep(.08,.8,slip)*(.020+pressure*.035);
 if(woundContact>0&&b.blood.x>.001&&b.coat.w>0){
  let reserve=min(b.coat.w,dt*b.blood.x*frame.action.z*woundContact);
  let supplied=min(reserve*5,max(0,1.65-b.coat.x));
  b.coat.w-=supplied*.2;b.coat.x+=supplied;
 }
 var wallClock=contactFloat(mem+8u)+dt;
 if(!wall&&rec<16u&&held&&wallClock>=.025&&smudge>0&&surfaceWet>.012&&slip>.12){squeegeeFloor(b,foot,wallClock,smudge,pressure);}
 if(wall&&wallClock>=.025){b.coat.x=max(0,b.coat.x-squeezeContact(index,b,foot,wallClock,pressure));}
 if(wall&&wallClock>=.025&&frame.tune.y>.001&&b.coat.x>.008){
  let spent=min(b.coat.x,(.085+min(1.0,b.coat.x)*.8)*wallClock*frame.tune.z);
  // Match the existing brush's stable material coordinates. Half the liquid
  // wets the hairs; squeezed excess collects at the lower contact edge.
  // Every weight sums to one, independent of coverage, frame rate or footprint.
  for(var j=0u;j<54u;j++){
   let material=brushMaterial(seed,j);
   let offset=patchOffset(radius,foot.angle,material);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;
   let volume=spent*.02*.85*(.5/54.0);
   returnFilm(rec,point,volume);
  }
  let contactMotion=b.v.xyz+cross(b.w.xyz,foot.p-b.p.xyz);
  let tangent=vec2f(dot(contactMotion,r.u.xyz),dot(contactMotion,r.v.xyz));
  let down=normalize(-vec2f(r.u.y,r.v.y)+tangent*min(.65,pressure+.15));let across=vec2f(down.y,-down.x);
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
  if(movement<.009){contactStamp(rec,foot.p,foot.p,radius,radius,foot.angle,foot.angle,min(1.4,select(b.coat.x,.4*sqrt(b.coat.x)+.7*b.coat.x,wall))*frame.tune.y,1,seed,travelled);}
  for(var j=0u;j<5u;j++){let offset=patchOffset(radius,angle,vec2f(cos(f32(j)*2.399963),sin(f32(j)*2.399963))*.62);let point=foot.p+r.u.xyz*offset.x+r.v.xyz*offset.y;addWet(planeWetCell(rec,point),u32(spent*.055*65536));}
  b.coat.x=max(0,b.coat.x-spent);wallClock=0;atomicAdd(&work[24],1u);
 }
 if(wallClock>=.025){wallClock=0;}
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
 let reach=carryReach();return shift*min(1.0,.8*reach/max(abs(shift.x)+abs(shift.y),1e-6))*mask/reach;
}
fn boundedPaintVelocity(v:vec2f)->vec2f {return v*min(1.0,.8/max(abs(v.x)+abs(v.y),1e-6));}
fn displacedPaint(id:u32,pixel:vec2f,dst:vec4f,velocities:array<vec2f,9>)->vec4f {
 let r=record(id);let pos=vec2i(floor(pixel));let center=snapshotPixel(id,pos);let velocity=boundedPaintVelocity(velocities[0]);var change=vec4f(0);
 // Sum overlapping contacts first. One conservative edge flux per pixel keeps
 // vigorous rubbing from repeatedly cloning or clipping the snapshot pigment.
  for(var k=0u;k<8u;k++){
  let reach=carryReach();if(k>=4u&&reach==1){break;}let axis=k%4u;
  // Adjacent link lengths share the transfer. A single long stride separates
  // the grid into independent lattices and leaves comb-like bands in the smear.
  let blend=select(1.0,select(.65,.35,k>=4u),reach>1);
  let direction=select(vec2i(select(-1,1,axis==0u),0),vec2i(0,select(-1,1,axis==2u)),axis>=2u);let offset=direction*(i32(reach)-i32(k/4u));
  if(id>=16u&&(any(pos+offset<vec2i(0))||any(pos+offset>=vec2i(r.size.zw)))){continue;}
  let otherVelocity=boundedPaintVelocity(velocities[k+1u]);let flux=dot((velocity+otherVelocity)*.5,vec2f(direction));
  if(abs(flux)>.00001){
   let other=snapshotPixel(id,pos+offset);let donor=select(center,other,flux<0);let receiver=select(other,center,flux<0);
   // Longer links must not pile opaque paint above alpha=1 and then lose it
   // through clipping. Both endpoints calculate the same bounded transfer.
   let donorVelocity=select(velocity,otherVelocity,flux<0);let receiverVelocity=select(otherVelocity,velocity,flux<0);let travel=vec2f(direction)*sign(flux);
   let donorShare=max(0,dot(donorVelocity,travel))/max(abs(donorVelocity.x)+abs(donorVelocity.y),1e-6);
   let receiverShare=max(0,dot(receiverVelocity,travel))/max(abs(receiverVelocity.x)+abs(receiverVelocity.y),1e-6);
   let amount=min(min(abs(flux),donorShare*.95),max(0,1-receiver.a)*receiverShare/max(donor.a,1e-6));
   change-=donor*sign(flux)*amount*blend;
  }
 }
 let moved=clamp(premultiplied(dst)+change,vec4f(0),vec4f(1));return straight(vec4f(min(moved.rgb,vec3f(moved.a)),moved.a));
}
