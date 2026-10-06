// A finite mobile film sits above the permanent high-resolution pigment. Storage
// is shared with wet supply: mass, snapshot, residue, contact velocity, momentum.
// Flux is evaluated from the same snapshot on both sides of every cell edge.
const FILM_SCALE:f32=65536.0;
fn filmDimensions(r:Record)->vec2u {return vec2u(vec2f(r.u.w,r.v.w));}
fn filmCellCount()->u32 {return header(3).x;}
fn filmOffset(bank:u32)->u32 {return header(0).z*3136u+bank*filmCellCount();}
fn filmAddress(r:Record,p:vec2u)->u32 {return u32(r.extra.z)+p.x+p.y*u32(r.u.w);}
fn filmRead(bank:u32,address:u32)->f32 {return f32(atomicLoad(&wet[filmOffset(bank)+address]))/FILM_SCALE;}
fn filmPosition(rec:u32,p:vec2i)->i32 {
 var id=rec;var r=record(id);var cell=p;
 if(any(cell<vec2i(0))||any(cell>=vec2i(filmDimensions(r)))){
  if(id>=16u){return -1;}
  let world=r.center.xyz+r.u.xyz*((f32(cell.x)+.5)/r.u.w-.5)*r.size.x+r.v.xyz*((f32(cell.y)+.5)/r.v.w-.5)*r.size.y;
  if(abs(world.x)>=8||abs(world.z)>=8){return -1;}
  id=floorRecord(world);r=record(id);cell=vec2i(floor(uv(r,world)*vec2f(filmDimensions(r))));
 }
 return i32(filmAddress(r,vec2u(clamp(cell,vec2i(0),vec2i(filmDimensions(r))-1))));
}
fn filmRecordForGroup(group:u32)->u32 {
 var low=0u;var high=header(0).z;
 loop{if(low+1u>=high){break;}let mid=(low+high)/2u;if(u32(record(mid).extra.w)<=group){low=mid;}else{high=mid;}}
 return low;
}
var<workgroup> filmRecordID:u32;
@compute @workgroup_size(256) fn prepareFilm(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=filmCellCount()){return;}atomicStore(&wet[filmOffset(3u)+id.x],0u);atomicStore(&wet[filmOffset(4u)+id.x],0u);
}
@compute @workgroup_size(256) fn snapshotFilm(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=filmCellCount()){return;}atomicStore(&wet[filmOffset(1u)+id.x],atomicLoad(&wet[filmOffset(0u)+id.x]));
}
fn filmPush(address:u32)->vec2f {return vec2f(bitcast<f32>(atomicLoad(&wet[filmOffset(3u)+address])),bitcast<f32>(atomicLoad(&wet[filmOffset(4u)+address])));}
fn filmVelocity(address:u32)->vec2f {return vec2f(bitcast<f32>(atomicLoad(&wet[filmOffset(5u)+address])),bitcast<f32>(atomicLoad(&wet[filmOffset(6u)+address])));}
@compute @workgroup_size(256) fn accelerateFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();
 let r=record(filmRecordID);let dims=filmDimensions(r);let local=(group.x-u32(r.extra.w))*256u+lane;if(local>=dims.x*dims.y){return;}
 let address=u32(r.extra.z)+local;let mass=filmRead(1u,address);let dt=frame.settings.y;var velocity=filmVelocity(address);
 // Viscous drag permits visible acceleration and leaves thin residue pinned.
 let wall=1-smoothstep(.2,.65,abs(r.n.y));
 let mobile=smoothstep(.004,.035,mass);let drag=mix(26.0,7.0,smoothstep(.02,.35,mass))*(1+wall*5);let decay=exp(-drag*dt);
 velocity=velocity*decay-vec2f(r.u.y,r.v.y)*9.81*(1-decay)/drag*mobile;
 let contact=filmPush(address);if(dot(contact,contact)>1e-6){velocity=mix(velocity,contact,1-exp(-38*dt));}
 velocity*=mobile;velocity*=min(1.0,2.5/max(length(velocity),1e-6));
 atomicStore(&wet[filmOffset(5u)+address],bitcast<u32>(velocity.x));atomicStore(&wet[filmOffset(6u)+address],bitcast<u32>(velocity.y));
}
@compute @workgroup_size(256) fn spreadFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();
 let rec=filmRecordID;let r=record(rec);let dims=filmDimensions(r);let local=(group.x-u32(r.extra.w))*256u+lane;if(local>=dims.x*dims.y){return;}
 let cell=vec2i(i32(local%dims.x),i32(local/dims.x));let address=u32(r.extra.z)+local;let mass=filmRead(1u,address);let dt=frame.settings.y;
 let spacing=r.size.xy/vec2f(dims);let velocityHere=filmVelocity(address);let mobility=clamp(sqrt(mass)*1.5,.06,1.0);var change=0.0;
 for(var k=0u;k<4u;k++){
  let axis=select(0u,1u,k>=2u);let direction=select(-1.0,1.0,k==0u||k==2u);var offset=vec2i(0);offset[axis]=i32(direction);
  let adjacent=filmPosition(rec,cell+offset);if(adjacent<0){continue;}let other=filmRead(1u,u32(adjacent));if(mass+other<.00001){continue;}
  let delta=mass-other;let edgeMobility=min(mobility,clamp(sqrt(other)*1.5,.06,1.0))+.12;
  // Nonlinear levelling with a pinned thin contact line. The coefficient is
  // measured in world space, so narrow boxes and floor records spread alike.
  let pressure=sign(delta)*max(0,abs(delta)-.0035)*min(.16,.0016*dt/(spacing[axis]*spacing[axis]))*edgeMobility;
  let velocity=clamp(dot((velocityHere+filmVelocity(u32(adjacent)))*.5,vec2f(offset))*dt/spacing[axis],-.23,.23);let advected=velocity*select(mass,other,velocity<0);
  // Each shared edge uses equal coefficients and upwind supply in both cells.
  change-=clamp(pressure+advected,-other*.24,mass*.24);
 }
 let moved=max(0,mass+change);let dried=moved*(1-exp(-dt*1.5/max(frame.tune.w,1)));let remaining=moved-dried;
 atomicStore(&wet[filmOffset(0u)+address],u32(round(remaining*FILM_SCALE)));
 atomicAdd(&wet[filmOffset(2u)+address],u32(round(dried*FILM_SCALE)));
}
// Mobile supply leaves open edges as actual ballistic droplets. Failed particle
// allocations retain that supply on the receiver, including a saturated pool.
@compute @workgroup_size(256) fn runoffFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();
 let rec=filmRecordID;if(rec<16u){return;}let r=record(rec);let dims=filmDimensions(r);let local=(group.x-u32(r.extra.w))*256u+lane;if(local>=dims.x*dims.y){return;}
 let cell=vec2u(local%dims.x,local/dims.x);let address=u32(r.extra.z)+local;let mass=filmRead(0u,address);if(mass<.025){return;}
 var exitDirection=vec2f(0);let velocity=filmVelocity(address);
 for(var axis=0u;axis<2u;axis++){
  if(cell[axis]!=0u&&cell[axis]+1u!=dims[axis]){continue;}
  let direction=select(1.0,-1.0,cell[axis]==0u);let downhill=-select(r.u.y,r.v.y,axis==1u)*direction;
  if(downhill>.05||r.n.y>.5||velocity[axis]*direction>.04){exitDirection[axis]=direction;}
 }
 let hanging=r.n.y<-.3&&mass>.1;if(!hanging&&dot(exitDirection,exitDirection)==0){return;}
 if((address+atomicLoad(&work[5])/2u)%8u!=0u){return;}
 var point=r.center.xyz+r.u.xyz*((f32(cell.x)+.5)/r.u.w-.5)*r.size.x+r.v.xyz*((f32(cell.y)+.5)/r.v.w-.5)*r.size.y;
 point+=r.n.xyz*.018+(r.u.xyz*exitDirection.x+r.v.xyz*exitDirection.y)*.035;
 if(atomicAdd(&work[30],1u)>=24u){return;}
 let amount=min(mass,max(.025,mass*.22));let volume=amount*r.size.x*r.size.y/f32(dims.x*dims.y);
 if(point.y<.025){returnFilm(floorRecord(point),point,volume);takeWet(filmOffset(0u)+address,u32(round(amount*FILM_SCALE)));atomicAdd(&work[26],1u);return;}
 let motion=r.u.xyz*velocity.x+r.v.xyz*velocity.y+r.n.xyz*.10+vec3f(0,-.35,0);
 if(launchDrop(point,motion,clamp(pow(volume,.333333)*.45,.005,.022),999u,volume)){takeWet(filmOffset(0u)+address,u32(round(amount*FILM_SCALE)));atomicAdd(&work[26],1u);}
}
fn returnFilm(rec:u32,point:vec3f,volume:f32){
 let r=record(rec);let dims=filmDimensions(r);let p=uv(r,point)*vec2f(dims)-.5;let base=vec2i(floor(p));let f=fract(p);
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let cell=vec2u(clamp(base+vec2i(x,y),vec2i(0),vec2i(dims)-1));let weight=select(1-f.x,f.x,x==1)*select(1-f.y,f.y,y==1);
  atomicAdd(&wet[filmOffset(0u)+filmAddress(r,cell)],u32(round(volume*weight*f32(dims.x*dims.y)/(r.size.x*r.size.y)*FILM_SCALE)));
 }}
}
fn depositFilm(rec:u32,pos:vec2u,source:f32,displacement:vec2f){
 if(rec>=header(0).z){return;}let r=record(rec);let dims=filmDimensions(r);let cell=vec2u(clamp(floor((vec2f(pos)+.5)/r.size.zw*vec2f(dims)),vec2f(0),vec2f(dims)-1));
 // Exactly one high-resolution pigment invocation owns each film cell.
 if(any(pos!=vec2u(floor((vec2f(cell)+.5)/vec2f(dims)*r.size.zw)))){return;}
 let address=filmAddress(r,cell);if(source>0){atomicAdd(&wet[filmOffset(0u)+address],u32(round(source*FILM_SCALE)));}
 var push=displacement/max(frame.settings.z,1.0/120.0);push*=min(1.0,2.5/max(length(push),1e-6));
 atomicStore(&wet[filmOffset(3u)+address],bitcast<u32>(push.x));atomicStore(&wet[filmOffset(4u)+address],bitcast<u32>(push.y));
}
