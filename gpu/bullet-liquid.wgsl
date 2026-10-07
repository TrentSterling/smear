// Bullet hits are serial. Collect donors before scattering so a splash cannot
// pick up its own returned liquid again. Only mobile film pays for the spray.
fn bulletLiquid(rec:u32,point:vec3f,ray:vec3f,power:f32,seed:u32){
 let r=record(rec);let dims=filmDimensions(r);let spacing=r.size.xy/vec2f(dims);let radius=mix(.13,.28,power);
 let center=vec2i(floor(uv(r,point)*vec2f(dims)));let extent=min(vec2i(12),vec2i(ceil(vec2f(radius)/spacing)));
 let tangent=vec2f(dot(ray,r.u.xyz),dot(ray,r.v.xyz));let area=spacing.x*spacing.y;var donors:array<f32,625>;var moved=0.0;
 for(var y=-extent.y;y<=extent.y;y++){for(var x=-extent.x;x<=extent.x;x++){
  let cell=center+vec2i(x,y);let delta=(vec2f(cell)+.5)*spacing-r.size.xy*.5-vec2f(dot(point-r.center.xyz,r.u.xyz),dot(point-r.center.xyz,r.v.xyz));
  let distance=length(delta);if(distance>=radius){continue;}let address=filmPosition(rec,cell);if(address<0){continue;}
  let mass=filmRead(0u,u32(address));if(mass<.002){continue;}
  atomicStore(&wet[filmOffset(1u)+u32(address)],u32(round(mass*FILM_SCALE)));
  let amount=takeWet(filmOffset(0u)+u32(address),u32(round(mass*.82*pow(1-distance/radius,.6)*FILM_SCALE)));
  let volume=f32(amount)/FILM_SCALE*area;donors[u32(y+extent.y)*25u+u32(x+extent.x)]=volume;moved+=volume;
 }}
 if(moved<1e-8){return;}var drops=0u;
 for(var y=-extent.y;y<=extent.y;y++){for(var x=-extent.x;x<=extent.x;x++){
  let volume=donors[u32(y+extent.y)*25u+u32(x+extent.x)];if(volume<=0){continue;}
  let cell=center+vec2i(x,y);let offset=(vec2f(cell)+.5)*spacing-r.size.xy*.5;let p=r.center.xyz+r.u.xyz*offset.x+r.v.xyz*offset.y;
  let delta=vec2f(dot(p-point,r.u.xyz),dot(p-point,r.v.xyz));let distance=length(delta);let h=seed+u32(x+12)*1973u+u32(y+12)*977u;
  let radial=delta/max(distance,.008);let force=pow(max(0,1-distance/radius),.55);
  let push=(radial*(.12+.13*power)+tangent*(.13+.15*power))*force*(.8+hash(h)*.4);
  var airborne=0.0;
  if(drops<select(3u,10u,power>.5)&&hash(h+31u)<.09){
   let carried=volume*.45;let motion=(r.u.xyz*push.x+r.v.xyz*push.y)*17+r.n.xyz*(1.1+hash(h+51u)*2.5);
   if(launchDrop(p+r.n.xyz*.025,motion,.005+hash(h+73u)*.009,999u,carried)){airborne=carried;drops++;}
  }
  var destination=p+r.u.xyz*push.x+r.v.xyz*push.y;var receiver=rec;
  if(rec<16u){destination.x=clamp(destination.x,-7.999,7.999);destination.z=clamp(destination.z,-7.999,7.999);receiver=floorRecord(destination);}
  returnFilm(receiver,destination,volume-airborne);
  let destinationRecord=record(receiver);let targetCell=vec2u(clamp(floor(uv(destinationRecord,destination)*vec2f(filmDimensions(destinationRecord))),vec2f(0),vec2f(filmDimensions(destinationRecord))-1));let address=filmAddress(destinationRecord,targetCell);
  atomicStore(&wet[filmOffset(5u)+address],bitcast<u32>(push.x*8));atomicStore(&wet[filmOffset(6u)+address],bitcast<u32>(push.y*8));
 }}
 // This stamp transports existing wet pigment only. It deposits no new blood.
 contactSweep(rec,point,point,vec2f(radius),vec2f(radius),tangent.x,0,1,16,seed,tangent.y);
}
fn bulletPaintVelocity(s:Stamp,r:Record,pixel:vec2f)->vec2f{
 let uvPixel=pixel/r.size.zw;let delta=(uvPixel-s.a.xy)*r.size.xy;let radius=s.a.z*r.size.x;let distance=length(delta);
 let address=filmPosition(u32(s.info.x),vec2i(floor(uvPixel*vec2f(filmDimensions(r)))));if(address<0){return vec2f(0);}
 let wetness=smoothstep(.002,.06,filmRead(1u,u32(address)));let tangent=vec2f(s.color.x,s.color.w);
 return (delta/max(distance,.02)+tangent)*pow(max(0,1-distance/radius),.6)*wetness*2;
}
