// A finite mobile film sits above the permanent high-resolution pigment. Storage
// is shared with the wet-supply buffer: mass, immutable mass, dry residue, push X/Y.
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
@compute @workgroup_size(256) fn spreadFilm(@builtin(workgroup_id) group:vec3u,@builtin(local_invocation_index) lane:u32){
 if(lane==0u){filmRecordID=filmRecordForGroup(group.x);}workgroupBarrier();
 let rec=filmRecordID;let r=record(rec);let dims=filmDimensions(r);let local=(group.x-u32(r.extra.w))*256u+lane;if(local>=dims.x*dims.y){return;}
 let cell=vec2i(i32(local%dims.x),i32(local/dims.x));let address=u32(r.extra.z)+local;let mass=filmRead(1u,address);let dt=frame.settings.y;
 let spacing=r.size.xy/vec2f(dims);let push=filmPush(address);let mobility=clamp(sqrt(mass)*1.5,.06,1.0);var change=0.0;
 for(var k=0u;k<4u;k++){
  let axis=select(0u,1u,k>=2u);let direction=select(-1.0,1.0,k==0u||k==2u);var offset=vec2i(0);offset[axis]=i32(direction);
  let adjacent=filmPosition(rec,cell+offset);if(adjacent<0){continue;}let other=filmRead(1u,u32(adjacent));if(mass+other<.00001){continue;}
  let delta=mass-other;let edgeMobility=min(mobility,clamp(sqrt(other)*1.5,.06,1.0))+.12;
  // Nonlinear levelling with a pinned thin contact line. The coefficient is
  // measured in world space, so narrow boxes and floor records spread alike.
  let pressure=sign(delta)*max(0,abs(delta)-.0035)*min(.16,.0016*dt/(spacing[axis]*spacing[axis]))*edgeMobility;
  let normalY=select(r.u.y,r.v.y,axis==1u);let mean=(mass+other)*.5;
  let gravity=clamp(-normalY*direction*mean*mean*.06*dt/spacing[axis],-.14,.14);
  let contact=clamp(dot((push+filmPush(u32(adjacent)))*.5,vec2f(offset)),-.22,.22);
  let velocity=clamp(gravity+contact,-.22,.22);let advected=velocity*select(mass,other,velocity<0);
  // Each shared edge uses equal coefficients and upwind supply in both cells.
  change-=clamp(pressure+advected,-other*.24,mass*.24);
 }
 let moved=max(0,mass+change);let dried=moved*(1-exp(-dt*1.5/max(frame.tune.w,1)));let remaining=moved-dried;
 atomicStore(&wet[filmOffset(0u)+address],u32(round(remaining*FILM_SCALE)));
 atomicAdd(&wet[filmOffset(2u)+address],u32(round(dried*FILM_SCALE)));
}
fn depositFilm(rec:u32,pos:vec2u,source:f32,displacement:vec2f){
 if(rec>=header(0).z){return;}let r=record(rec);let dims=filmDimensions(r);let cell=vec2u(clamp(floor((vec2f(pos)+.5)/r.size.zw*vec2f(dims)),vec2f(0),vec2f(dims)-1));
 // Exactly one high-resolution pigment invocation owns each film cell.
 if(any(pos!=vec2u(floor((vec2f(cell)+.5)/vec2f(dims)*r.size.zw)))){return;}
 let address=filmAddress(r,cell);if(source>0){atomicAdd(&wet[filmOffset(0u)+address],u32(round(source*FILM_SCALE)));}
 var push=displacement*vec2f(dims)/r.size.xy;push*=min(1.0,.22/max(abs(push.x)+abs(push.y),1e-6));
 atomicStore(&wet[filmOffset(3u)+address],bitcast<u32>(push.x));atomicStore(&wet[filmOffset(4u)+address],bitcast<u32>(push.y));
}
