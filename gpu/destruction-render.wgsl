fn debrisVector(s:u32)->vec3f{return vec3f(bitcast<f32>(work[s]),bitcast<f32>(work[s+1u]),bitcast<f32>(work[s+2u]));}
fn debrisOutput(v:Input,i:u32,boards:bool)->Output{
 let s=ordnanceState(i);let kind=work[s+23u];if(kind==0u||kind==7u||boards!=restingFragment(kind)){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let age=bitcast<f32>(work[s+7u]);let seed=work[s+11u];let radius=bitcast<f32>(work[s+3u]);let theta=age*(3+hash(seed)*9);var q=vec4f(safeNorm(vec3f(hash(seed)-.5,.4,hash(seed+1u)-.5))*sin(theta*.5),cos(theta*.5));if(restingFragment(kind)&&(work[s+20u]&0x80000000u)!=0u){let yaw=hash(seed)*6.283185;q=vec4f(0,sin(yaw*.5),0,cos(yaw*.5));}
 var scale=select(vec3f(.72+hash(seed),.45+hash(seed+2u),.60+hash(seed+3u)),vec3f(1,1.3,1),kind==1u)*radius;if(kind==3u||kind==5u){scale=select(vec3f(3.2,.28,.42),vec3f(3.0,.16,.68),kind==5u)*radius;}
 if(kind==8u){scale=vec3f(1.9,.08,1.1)*radius;}if(kind==9u){scale=vec3f(1.3,.28,.9)*radius;}if(kind==10u){scale=vec3f(1.6,.18,1.2)*radius;}
 if(kind==2u&&age<.20){let velocity=debrisVector(s+4u);let direction=safeNorm(velocity);let stretch=max(0,length(velocity)*.004)*(1-age/.20);let world=debrisVector(s)+rotate(q,v.p*scale)+direction*v.p.z*stretch;return Output(frame.vp*vec4f(world,1),world,rotate(q,v.n),v.uv,v.p,v.n,i);}
 if(kind==4u){let forward=safeNorm(debrisVector(s+4u));let right=safeNorm(cross(forward,select(vec3f(0,1,0),vec3f(1,0,0),abs(forward.y)>.95)));let up=cross(right,forward);let p=v.p*vec3f(.8,.8,3.1)*radius;let world=debrisVector(s)+right*p.x+up*p.y+forward*p.z;return Output(frame.vp*vec4f(world,1),world,right*v.n.x+up*v.n.y+forward*v.n.z,v.uv,v.p,v.n,i);}
 var shape=v.p;if(kind==8u){shape.x*=mix(.18,1.0,(1-shape.z)*.5);shape.z+=shape.x*(hash(seed+3u)-.5)*.45;}if(kind==9u){shape.x*=mix(.55,1.0,(1-shape.z)*.5);shape.y+=shape.x*shape.x*.30;shape.z+=shape.x*(hash(seed+4u)-.5)*.5;}if(kind==10u){shape.y+=abs(shape.x)*.85;shape.z*=.75+shape.x*.20;}let world=debrisVector(s)+rotate(q,shape*scale);return Output(frame.vp*vec4f(world,1),world,rotate(q,v.n),v.uv,v.p,v.n,i);
}
@vertex fn debrisVertex(v:Input,@builtin(instance_index) i:u32)->Output{return debrisOutput(v,i,false);}
@vertex fn sawVertex(v:Input,@builtin(instance_index) i:u32)->Output{
 let s=ordnanceState(i);if(work[s+23u]!=7u){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let forward=safeNorm(debrisVector(s+4u));let right=safeNorm(cross(forward,select(vec3f(0,1,0),vec3f(1,0,0),abs(forward.y)>.95)));let up=cross(right,forward);let age=bitcast<f32>(work[s+7u]);let angle=age*58;let q=vec4f(0,sin(angle*.5),0,cos(angle*.5));let p=rotate(q,v.p)*bitcast<f32>(work[s+3u]);let n=rotate(q,v.n);let world=debrisVector(s)+up*p.x+right*p.y+forward*p.z;
 return Output(frame.vp*vec4f(world,1),world,up*n.x+right*n.y+forward*n.z,v.uv,v.p,v.n,i);
}
@vertex fn boardVertex(v:Input,@builtin(instance_index) i:u32)->Output{return debrisOutput(v,i,true);}
@fragment fn debrisFragment(v:Output)->@location(0) vec4f{
 let geometric=safeNorm(cross(dpdx(v.world),dpdy(v.world)));let facet=geometric*select(-1.0,1.0,dot(geometric,v.normal)>=0);let grainAA=1.0/(1+fwidth(v.local.z)*65);let kind=work[ordnanceState(v.index)+23u];var color=vec3f(.016,.024,.024);var rough=.85;var metal=.25;
 if(kind==3u||kind==5u){let phase=v.local.z*34+sin(v.local.x*2.3+f32(v.index))*.9;let grain=.86+(.09*sin(phase)+.04*sin(v.local.z*105+v.local.x*.9))*grainAA;color=vec3f(.49,.30,.13)*grain;rough=.87;metal=0;}
 if(kind==8u){color=vec3f(.15,.61,.56);rough=.085;metal=.32;}if(kind==9u){color=select(vec3f(.55,.24,.09),vec3f(.80,.73,.58),v.localNormal.y>0);rough=select(.8,.22,v.localNormal.y>0);metal=0;}if(kind==10u){color=select(vec3f(.58,.63,.61),vec3f(.65,.08,.03),v.local.x>.2);rough=.25;metal=.85;}
 if(kind==7u){let r=length(v.local.xz);let ring=1-smoothstep(.018,.035,abs(r-.57));color=mix(vec3f(.44,.49,.48),vec3f(.045,.075,.073),ring);rough=.25;metal=.86;if(r<.14){color=vec3f(.10,.13,.12);rough=.38;}}
 if(kind==6u){color=mix(vec3f(.09,.12,.16),vec3f(.95,.28,.025),select(.15,.8,fract(frame.camera.w*3)>.65));rough=.4;metal=.5;}
 if(kind==4u){color=select(vec3f(.16,.22,.21),vec3f(.72,.37,.04),v.local.z>.40);rough=.35;metal=.6;}
 if(kind==2u){let age=bitcast<f32>(work[ordnanceState(v.index)+7u]);let hot=1-smoothstep(.02,.24,age);if(hot>0){return mix(shade(v.world,v.normal,color,rough,metal,false,false,0),vec4f(1,.64+.30*hot,.15+.70*hot,1),hot);}}
 if(kind==1u){color=vec3f(.13,.17,.055);rough=.50;metal=.50;let seam=step(.87,fract(v.uv.x*8))+step(.84,fract(v.uv.y*6));color*=1-min(1.0,seam)*.75;if(v.local.y>.70){color=vec3f(.75,.28,.015);}}
 return shade(v.world,select(v.normal,facet,junkFragment(kind)),color,rough,metal,false,false,0);
}
// Eight short plumes per explosive slot. The last plume lingers after impact.
@vertex fn rocketTrailVertex(v:Input,@builtin(instance_index) i:u32)->Output{
 let slot=i/8u;let lobe=i%8u;let s=ordnanceState(slot);let since=frame.camera.w-bitcast<f32>(work[s+22u])-bitcast<f32>(work[s+7u]);
 if(work[s+19u]!=4u||since>.50||bitcast<f32>(work[s+7u])<.001){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let age=bitcast<f32>(work[s+7u]);let back=min(f32(lobe)*.30,age*38);let seed=work[s+11u]+lobe*173u;
 let offset=vec3f(hash(seed)-.5,hash(seed+1u)-.5,hash(seed+2u)-.5)*(.02+back*.05);
 let p=debrisVector(s)-safeNorm(debrisVector(s+4u))*back+offset+vec3f(0,max(0,since)*.3,0);let radius=.045+back*.07+max(0,since)*.16;
 let world=p+v.p*radius;return Output(frame.vp*vec4f(world,1),world,v.n,v.uv,v.p,v.n,i);
}
@fragment fn rocketTrailFragment(v:Output)->@location(0) vec4f{
 let s=ordnanceState(v.index/8u);let since=max(0,frame.camera.w-bitcast<f32>(work[s+22u])-bitcast<f32>(work[s+7u]));let hot=select(0.0,1.0,v.index%8u==0u&&work[s+23u]==4u);
 let edge=pow(max(0,dot(v.normal,safeNorm(frame.camera.xyz-v.world))),.65);return vec4f(mix(vec3f(.23,.25,.22),vec3f(1,.57,.12),hot),edge*(1-smoothstep(.05,.5,since))*.35);
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
// Visual pressure jets use the cached GPU hit; they do not allocate blood.
@vertex fn utilityJetVertex(v:Input,@builtin(instance_index) i:u32)->Output{
 let tool=(u32(frame.settings.w)>>8u)&15u;let enabled=(u32(frame.settings.w)&65536u)!=0u&&(tool==7u||tool==8u||(tool==10u&&work[utilityBase()+16u]==0u));
 if(!enabled){return Output(vec4f(0,0,2,1),vec3f(0),vec3f(0,1,0),v.uv,v.p,v.n,i);}
 let axis=safeNorm(frame.rayD.xyz);let right=safeNorm(cross(axis,vec3f(0,1,0)));let up=cross(right,axis);let nozzle=frame.rayO.xyz+axis*.70+right*.20-up*.13;
 if(tool==10u){let phase=fract(f32(i)/32-frame.camera.w*1.5);let angle=f32(i)*2.39996+frame.camera.w*3;let radius=.10+phase*.42;let world=frame.rayO.xyz+axis*(1.6+phase*1.8)+(right*cos(angle)+up*sin(angle))*radius+right*v.p.x*.018+up*v.p.y*.018+axis*v.p.z*.035;return Output(frame.vp*vec4f(world,1),world,v.n,v.uv,vec3f(phase,10,0),v.n,i);}
 let hit=vec3f(bitcast<f32>(work[utilityBase()+4u]),bitcast<f32>(work[utilityBase()+5u]),bitcast<f32>(work[utilityBase()+6u]));let end=select(frame.rayO.xyz+axis*5,hit,work[utilityBase()+7u]!=0u);let path=end-nozzle;let direction=safeNorm(path);let phase=fract(f32(i)/32+frame.camera.w*select(1.6,3.1,tool==8u));let lengthLimit=select(min(length(path),2.8),length(path),tool==8u);
 let radius=select(.02+phase*.09,.008+phase*.014,tool==8u);let flutter=vec3f(hash(i*173u)-.5,hash(i*197u)-.5,hash(i*257u)-.5)*radius;
 let world=nozzle+direction*phase*lengthLimit+flutter+right*v.p.x*radius+up*v.p.y*radius+direction*v.p.z*select(.07,.12,tool==8u);
 return Output(frame.vp*vec4f(world,1),world,v.n,v.uv,vec3f(phase,f32(tool),0),v.n,i);
}
@fragment fn utilityJetFragment(v:Output)->@location(0) vec4f{if(v.local.y==10){return vec4f(.23,.89,1,.65*(1-v.local.x));}return vec4f(select(vec3f(.70,.78,.74),vec3f(.78,.90,.96),v.local.y==8),select(.055,.28,v.local.y==8)*(1-v.local.x));}
