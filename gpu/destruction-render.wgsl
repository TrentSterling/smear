fn debrisVector(s:u32)->vec3f{return vec3f(bitcast<f32>(work[s]),bitcast<f32>(work[s+1u]),bitcast<f32>(work[s+2u]));}
@vertex fn debrisVertex(v:Input,@builtin(instance_index) i:u32)->Output{
 let s=ordnanceState(i);let kind=work[s+23u];if(kind==0u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let age=bitcast<f32>(work[s+7u]);let seed=work[s+11u];let radius=bitcast<f32>(work[s+3u]);let theta=age*(3+hash(seed)*9);let q=vec4f(safeNorm(vec3f(hash(seed)-.5,.4,hash(seed+1u)-.5))*sin(theta*.5),cos(theta*.5));
 var scale=select(vec3f(.72+hash(seed),.45+hash(seed+2u),.60+hash(seed+3u)),vec3f(1,1.3,1),kind==1u)*radius;if(kind==3u){scale=vec3f(3.2,.28,.42)*radius;}
 let world=debrisVector(s)+rotate(q,v.p*scale);return Output(frame.vp*vec4f(world,1),world,rotate(q,v.n),v.uv,v.p,v.n,i);
}
@fragment fn debrisFragment(v:Output)->@location(0) vec4f{
 let kind=work[ordnanceState(v.index)+23u];var color=vec3f(.016,.024,.024);var rough=.85;var metal=.25;
 if(kind==3u){color=vec3f(.28,.15,.06);rough=.87;metal=0;}
 if(kind==1u){color=vec3f(.13,.17,.055);rough=.50;metal=.50;let seam=step(.87,fract(v.uv.x*8))+step(.84,fract(v.uv.y*6));color*=1-min(1.0,seam)*.75;if(v.local.y>.70){color=vec3f(.75,.28,.015);}}
 return shade(v.world,v.normal,color,rough,metal,false,false,0);
}
// Short luminous pressure core followed by offset, fading smoke lobes.
@vertex fn blastVertex(v:Input,@builtin(instance_index) i:u32)->Output{
 let slot=i/5u;let lobe=i%5u;let s=blastState(slot);let age=frame.camera.w-bitcast<f32>(work[s+4u]);
 if((work[destructionMeta()]&(1u<<slot))==0u||age<0||age>.7){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let seed=work[s+6u]+lobe*977u;let offset=vec3f(hash(seed)-.5,hash(seed+1u)-.2,hash(seed+2u)-.5);let radius=bitcast<f32>(work[s+3u]);let size=(.10+sqrt(age)*.65)*radius*(.5+hash(seed+3u)*.3);
 let world=debrisVector(s)+offset*radius*age+vec3f(0,age*.3,0)+v.p*size;return Output(frame.vp*vec4f(world,1),world,v.n,v.uv,v.p,v.n,i);
}
@fragment fn blastFragment(v:Output)->@location(0) vec4f{
 let s=blastState(v.index/5u);let age=frame.camera.w-bitcast<f32>(work[s+4u]);let hot=exp(-age*21);let edge=pow(max(0,dot(v.normal,safeNorm(frame.camera.xyz-v.world))),.5);
 return vec4f(mix(vec3f(.065,.075,.069),vec3f(1,.64,.15),hot),edge*(1-smoothstep(.1,.7,age))*.52);
}
