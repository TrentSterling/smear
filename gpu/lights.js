// One source for visible emitter geometry and the unrolled GPU LTC integrals.
// Winding faces into the room. A repeated last vertex represents a triangle.
const rect=(name,c,u,v,radiance,build=false)=>({name,radiance,build,vertices:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>c.map((n,i)=>n+x*u[i]+y*v[i]))});
export const lights=[
 ...[-5,0,5].map(x=>rect('ceiling strip '+x,[x,4.8825,0],[.08,0,0],[0,0,5.85],[24,25,23])),
 ...[-5.8,-2.9,0,2.9,5.8].map(x=>rect('rear softbox '+x,[x,3.88,-7.929],[1.155,0,0],[0,.41,0],[5.4,7.6,8.2])),
];
for(let i=0;i<8;i++){
 const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
 const point=(angle,r)=>[Math.cos(angle)*r,4.70,1.6+Math.sin(angle)*r];
 lights.push({name:'amber halo '+i,radiance:[18,9.5,3.2],build:true,vertices:[point(a,1.55),point(b,1.55),point(b,1.27),point(a,1.27)]});
}
lights.push({name:'cyan triangle',radiance:[2.2,12,17],build:true,vertices:[[-7.925,1.75,-1.4],[-7.925,4.15,0],[-7.925,1.75,1.4],[-7.925,1.75,1.4]]});
// Opposite wall: two violet blades form a chevron, both facing -X.
lights.push(rect('violet chevron upper',[7.925,3.38,.1],[0,.56,.70],[0,.075,-.060],[12,3.2,14],true));
lights.push(rect('violet chevron lower',[7.925,2.26,.1],[0,.56,-.70],[0,-.075,-.060],[12,3.2,14],true));
// A ceiling-mounted rotating crossarm carries two real colored area emitters.
export const lightMotion={pivot:[0,4.32,1.6],speed:.34};
lights.push({...rect('moving violet bar',[-2.4,3.78,1.6],[.11,0,0],[0,0,1.10],[16,2.8,19],true),moving:true});
lights.push({...rect('moving cyan bar',[2.4,3.78,1.6],[.11,0,0],[0,0,1.10],[2,12,20],true),moving:true});


export function lightShader(){
 return `var sum=ltcRingEmitter(basis,transform,p,vec3f(0,4.70,1.6),1.55,1.27,vec3f(18,9.5,3.2),base*(1-metal)*(1-f0),specular);
 let lightBase=u32(constants[header(3).z+2u].y);let count=u32(constants[lightBase].x);
 for(var i=0u;i<count;i++){let s=lightBase+1u+i*5u;
  sum+=ltcPolygonEmitter(basis,transform,p,constants[s].xyz,constants[s+1u].xyz,constants[s+2u].xyz,constants[s+3u].xyz,constants[s+4u].xyz,base*(1-metal)*(1-f0),specular);
 }`;
}

// Adjacent halo segments share radial edges that cancel analytically. Evaluate
// the two octagonal boundaries, instead of shading eight overlapping quads.
export function compoundLightShader(){
 const ids=Array.from({length:8},(_,i)=>i),next=i=>(i+1)%8;
 const edgeSum=ids.map(i=>`ltcEdge(n${i},n${next(i)})`).join('+');
 return `fn ltcOctagon(a:mat3x3f,p:vec3f,center:vec3f,radius:f32)->f32 {
 let c=a*(center-p);let u=a*vec3f(radius,0,0);let v=a*vec3f(0,0,radius);
 ${ids.map(i=>`let p${i}=c+u*${Math.cos(i*Math.PI/4).toFixed(8)}+v*${Math.sin(i*Math.PI/4).toFixed(8)};`).join('\n ')}
 if(${ids.map(i=>`p${i}.z<=0`).join('&&')}){return 0;}
 if(${ids.map(i=>`p${i}.z>0`).join('&&')}){
  ${ids.map(i=>`let n${i}=safeNorm(p${i});`).join('')}
  return min(1.0,abs(${edgeSum}));
 }
 ${ids.map(i=>`let e${i}=ltcClippedEdge(p${i},p${next(i)});`).join('\n ')}
 let entry=${ids.map(i=>`select(e${i}.xyz,vec3f(0),p${i}.z>0)`).join('+')};
 let exit=${ids.map(i=>`select(vec3f(0),e${i}.xyz,p${i}.z>0)`).join('+')};
 return min(1.0,abs(${ids.map(i=>`e${i}.w`).join('+')}+ltcEdge(safeNorm(exit),safeNorm(entry))));
}
fn ltcRingEmitter(basis:mat3x3f,transform:mat3x3f,p:vec3f,c:vec3f,outer:f32,inner:f32,emission:vec3f,diffuse:vec3f,specular:vec3f)->vec3f {
 if(p.y>=c.y){return vec3f(0);}
 let d=max(0,ltcOctagon(basis,p,c,outer)-ltcOctagon(basis,p,c,inner));
 let s=max(0,ltcOctagon(transform,p,c,outer)-ltcOctagon(transform,p,c,inner));
 return emission*(diffuse*d+specular*s);
}`;
}
