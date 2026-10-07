// A prop stays a paintable static obstacle until its GPU damage crosses one.
// 8 props x 8 words: damage, broken tick, reserved. Word 19 is the broken mask.
fn propGone(tag:f32)->bool{return tag>0&&(atomicLoad(&work[19])&(1u<<(u32(tag)-1u)))!=0u;}
fn liveBox(k:u32)->bool{return !propGone(constants[k+2u].w);}
fn propDamage(tag:f32,amount:f32){if(tag<=0||propGone(tag)||amount<=0){return;}atomicAdd(&work[propState(u32(tag)-1u)],u32(min(amount,4.0)*65536));}
fn hitProp(rec:i32,amount:f32){if(rec>=0){propDamage(record(u32(rec)).center.w,amount);}}
fn impactProp(hit:WorldImpact){if(hit.receiver<0||hit.closing<5){return;}hitProp(hit.receiver,smoothstep(5.0,16.0,hit.closing)*.6);}
@compute @workgroup_size(1) fn breakProps(){
 if(frame.settings.z<=0&&frame.action.y<.5){return;}
 for(var j=0u;j<header(0).x;j++){
  let k=header(1).x+j*5u;let tag=constants[k+2u].w;if(tag<=0||propGone(tag)){continue;}
  let id=u32(tag)-1u;let state=propState(id);if(atomicLoad(&work[state])<65536u){continue;}
  atomicOr(&work[19],1u<<id);atomicStore(&work[state+1u],atomicLoad(&work[5])+1u);
  let center=constants[k].xyz;let half=constants[k+2u].xyz;let kind=u32(constants[k].w);let seed=id*1973u+atomicLoad(&work[5])*83u;
  for(var n=0u;n<16u;n++){let h=seed+n*977u;let direction=safeNorm(vec3f(hash(h)-.5,hash(h+1u)*.75+.1,hash(h+2u)-.5));let offset=vec3f((hash(h+3u)-.5)*half.x*1.7,(hash(h+4u)-.5)*half.y*1.7,(hash(h+5u)-.5)*half.z*1.7);spawnOrdnance(select(3u,2u,kind==2u),center+offset,direction*(2+hash(h+6u)*4),.045+hash(h+7u)*.045,h);}
  if(kind==2u){queueBlast(center,1.15*constants[header(3).z+1u].z);}
  else{atomicAdd(&work[39],1u);atomicMax(&work[38],(u32(.78*4095)<<8u)|255u);}
 }
}
// Cylinder entry is used for the curved barrel; paint still projects to five
// world-density planar charts, which also cover its bands and cap details.
fn barrelEntry(p:vec3f,v:vec3f,h:vec3f)->f32{
 var best=1e6;let a=dot(v.xz,v.xz);let b=dot(p.xz,v.xz);let c=dot(p.xz,p.xz)-h.x*h.x;let disc=b*b-a*c;
 if(a>1e-8&&disc>=0){let t=(-b-sqrt(disc))/a;if(t>=0&&abs(p.y+v.y*t)<=h.y){best=t;}}
 if(abs(v.y)>1e-7){for(var side=-1;side<=1;side+=2){let t=(f32(side)*h.y-p.y)/v.y;let q=p.xz+v.xz*t;if(t>=0&&dot(q,q)<=h.x*h.x){best=min(best,t);}}}return best;
}
