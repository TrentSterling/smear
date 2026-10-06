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
fn pack(c:vec4f)->u32 { let p=vec4u(round(clamp(c,vec4f(0),vec4f(1))*255.0));return p.x|(p.y<<8u)|(p.z<<16u)|(p.w<<24u); }
fn unpack(p:u32)->vec4f { return vec4f(f32(p&255u),f32((p>>8u)&255u),f32((p>>16u)&255u),f32(p>>24u))/255.0; }
fn over(dst:vec4f,src:vec4f)->vec4f { let a=src.a+dst.a*(1-src.a);return vec4f((src.rgb*src.a+dst.rgb*dst.a*(1-src.a))/max(a,1e-8),a); }
