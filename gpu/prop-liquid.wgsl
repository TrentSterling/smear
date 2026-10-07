// Contact transfer between real moving charts and the receiver they touch.
// Both pickup and deposition debit the donor; brush pigment has no liquid source.
@compute @workgroup_size(64) fn propLiquid(@builtin(global_invocation_id) id:vec3u){
 let prop=id.x/96u;let face=(id.x%96u)/16u;let probe=id.x%16u;
 if(prop>=propCount()||propGone(f32(prop+1u))||atomicLoad(&work[5])%3u!=0u){return;}
 let s=propData(prop);let b=propBody(prop);let r=record(u32(constants[s+16u+face*4u].w));
 let c=(vec2f(f32(probe%4u),f32(probe/4u))+.5)/4;let point=r.center.xyz+r.u.xyz*((c.x-.5)*r.size.x)+r.v.xyz*((c.y-.5)*r.size.y);
 let local=rotate(inverseQ(b.q),point-b.p.xyz);if(b.half.w==2&&length(local.xz)>b.half.x+.012){return;}
 let hit=rayHit(point-r.n.xyz*.035,r.n.xyz,.075,false,i32(180u+prop));if(hit.surface<0||hit.t>=.075||dot(hit.n,r.n.xyz)>-.45){return;}
 let rec=u32(hit.surface);let other=record(rec);let motion=propVelocity(f32(prop+1u),point)-surfaceVelocity(hit.surface,hit.p);let tangent=motion-hit.n*dot(motion,hit.n);let speed=length(tangent);
 let dims=filmDimensions(r);let pixel=vec2i(c*vec2f(dims));let otherDims=filmDimensions(other);let otherPixel=vec2i(uv(other,hit.p)*vec2f(otherDims));
 let area=r.size.x*r.size.y/f32(dims.x*dims.y);let otherArea=other.size.x*other.size.y/f32(otherDims.x*otherDims.y);
 var transferred=0.0;var pushed=0.0;
 for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){
  let cell=vec2u(clamp(pixel+vec2i(x,y),vec2i(0),vec2i(dims)-1));let donor=filmAddress(r,cell);let otherCell=vec2u(clamp(otherPixel+vec2i(x,y),vec2i(0),vec2i(otherDims)-1));let receiver=filmAddress(other,otherCell);
  let mass=filmRead(0u,donor);let targetMass=filmRead(0u,receiver);let difference=mass-targetMass;
  if(abs(difference)>.0003){
   let fraction=min(.28,.04+speed*.04);var volume=0.0;
   if(difference>0){volume=f32(takeWet(filmOffset(0u)+donor,u32(difference*fraction*FILM_SCALE)))/FILM_SCALE*area;returnFilm(rec,hit.p,volume);transferred+=volume;}
   else{volume=f32(takeWet(filmOffset(0u)+receiver,u32(-difference*fraction*FILM_SCALE)))/FILM_SCALE*otherArea;returnFilm(u32(constants[s+16u+face*4u].w),point,volume);}
  }
  if(speed>.10&&materialTune().x>0){let moved=takeWet(filmOffset(0u)+receiver,u32(filmRead(0u,receiver)*min(.38,speed*.05)*min(2.0,materialTune().x)*FILM_SCALE));let volume=f32(moved)/FILM_SCALE*otherArea;let to=hit.p+bounded(tangent*.035*constants[header(3).z+1u].x,.25);returnFilm(rec,to,volume);pushed+=volume;}
 }}
 let previous=constants[s+8u].xyz+rotate(constants[s+9u],local);let radius=vec2f(r.size.x,r.size.y)*.145;let angle=atan2(dot(r.u.xyz,other.v.xyz),dot(r.u.xyz,other.u.xyz));let seed=prop*419u+face*73u+probe*977u;
 if(transferred>1e-7){contactSweep(rec,previous,hit.p,radius,radius,angle,angle,min(.9,transferred/(area*25)*8),13,seed,frame.camera.w*speed);}
 if(pushed>1e-7){contactSweep(rec,previous,hit.p,radius,radius,angle,angle,min(2.5,materialTune().x),3,seed,frame.camera.w*speed);}
}
