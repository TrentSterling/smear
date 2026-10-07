struct Frame {
 vp:mat4x4f, lightVP:mat4x4f,
 camera:vec4f, rayO:vec4f, rayD:vec4f, goal:vec4f, local:vec4f,
 settings:vec4f, action:vec4f, tune:vec4f,
};
struct Body {
 p:vec4f, q:vec4f, v:vec4f, w:vec4f, prevP:vec4f, prevQ:vec4f,
 half:vec4f, invI:vec4f, coat:vec4f, blood:vec4f,
 track:vec4f, status:vec4f, recoveryP:vec4f, recoveryQ:vec4f,
 s0:vec4f, s1:vec4f, s2:vec4f, s3:vec4f,
 motor:vec4f, nav:vec4f,
 targetP:vec4f, targetQ:vec4f, targetV:vec4f,
 gait:vec4f, footFrom:vec4f, footTo:vec4f,
};
struct Particle { p:vec4f, v:vec4f, previous:vec4f, extra:vec4f };
struct Stamp { a:vec4f, b:vec4f, color:vec4f, info:vec4f };
struct Record { center:vec4f, u:vec4f, v:vec4f, n:vec4f, size:vec4f, address:vec4u, extra:vec4f };
fn quatMul(a:vec4f,b:vec4f)->vec4f { return vec4f(a.w*b.xyz+b.w*a.xyz+cross(a.xyz,b.xyz),a.w*b.w-dot(a.xyz,b.xyz)); }
fn inverseQ(q:vec4f)->vec4f { return vec4f(-q.xyz,q.w); }
fn rotate(q:vec4f,v:vec3f)->vec3f { return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v); }
fn safeNorm(v:vec3f)->vec3f { return v*inverseSqrt(max(dot(v,v),1e-12)); }
fn rotateStep(q:vec4f,theta:vec3f)->vec4f { let t=theta*min(1.0,.2/max(length(theta),1e-8))*.5;return normalize(quatMul(vec4f(t,1),q)); }
fn invWorld(b:Body,n:vec3f)->vec3f { return rotate(b.q,rotate(inverseQ(b.q),n)*b.invI.xyz); }
fn eff(b:Body,r:vec3f,n:vec3f)->f32 { if(b.status.x<.5){return 0;}let a=cross(r,n);return b.p.w+dot(a,invWorld(b,a)); }
fn hash(n:u32)->f32 { var t=(n^0x63d83595u)*0x45d9f3bu;t=(t^(t>>16u))*0x45d9f3bu;return f32(t^(t>>16u))/4294967296.0; }
// Contact seeds encode body index * 731 + face * 113. Pigment and liquid
// share these material points, including finger gaps and sole tread bands.
fn brushMaterial(seed:u32,j:u32)->vec2f {
 let h=hash(seed*113u+j*977u);let h2=hash(seed*337u+j*199u);
 var p=vec2f(cos(h*6.283185),sin(h*6.283185))*sqrt(h2)*.98;
 let part=(seed/731u)%15u;
 if(part==5u||part==11u){
  if(j<30u){let finger=j%5u;let thumb=select(1.0,.52,finger==0u);p=vec2f(-(.25+h2*.73)*thumb,(f32(finger)-2)*.36+(h-.5)*.11);}
  else{p=vec2f(.08+h2*.62,(h-.5)*1.35);}
 }else if(part==8u||part==14u){p=vec2f((f32(j%3u)-1)*.64+(h-.5)*.19,(h2-.5)*1.72);}
 else if(part==4u||part==10u){p.y*=.50;}
 return p;
}
fn pack(c:vec4f)->u32 { let p=vec4u(round(clamp(c,vec4f(0),vec4f(1))*255.0));return p.x|(p.y<<8u)|(p.z<<16u)|(p.w<<24u); }
fn unpack(p:u32)->vec4f { return vec4f(f32(p&255u),f32((p>>8u)&255u),f32((p>>16u)&255u),f32(p>>24u))/255.0; }
fn over(dst:vec4f,src:vec4f)->vec4f { let a=src.a+dst.a*(1-src.a);return vec4f((src.rgb*src.a+dst.rgb*dst.a*(1-src.a))/max(a,1e-8),a); }

// GPU-only destruction scratch follows the established contact history.
fn destructionBase()->u32{return header(2).w+header(2).x*128u+180u*24u;}
fn fractureState(i:u32)->u32{return destructionBase()+i*8u;}
fn ordnanceState(i:u32)->u32{return destructionBase()+1440u+i*24u;}
fn blastState(i:u32)->u32{return destructionBase()+4512u+i*12u;}
fn destructionMeta()->u32{return destructionBase()+4704u;}
fn propState(i:u32)->u32{return destructionMeta()+32u+i*8u;}
fn secondaryPaintBase()->u32{return destructionMeta()+96u;}
// Movable props retain their own GPU rigid state and six rest-space charts.
// No actor transforms are downloaded by the normal frame loop.
fn propData(i:u32)->u32{return header(3).z+3u+i*40u;}
fn propCount()->u32{return u32(constants[header(3).z+2u].x);}
fn propPlayerData()->u32{return header(3).z+3u+propCount()*40u;}
