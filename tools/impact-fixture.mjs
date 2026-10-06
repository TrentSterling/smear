// Deterministic launch inspection: upload a clean articulated rest pose once,
// then use the shipping 120 Hz solver, collisions, droplets and paint pipeline.
export async function installImpactFixture(page){
 await page.eval(`(()=>{
 const g=__smearGPU,d=g.device,T=g.THREE;
 async function read(buffer,offset,size){const b=g.buffer('explicit impact inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,offset,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=b.getMappedRange().slice(0);b.unmap();b.destroy();return a;}
 window.__impactTest={
 async setup({speed=12,pose='head',reserve=9,damage=1,bleeding=1.35,tangent=0,spin=0,full=false}={}){
  __smear.manual(true);__smear.release();__smear.reset();__smear.preset('default');__smear.tune({walking:false,recover:false,damage:1,bleeding:1.35});await __smear.step(0);__smear.clean();g.clearDrops();g.action=0;
  Object.assign(g.input().tune,{damage,bleeding});
  const a=new Float32Array(await read(g.seedBuffer,0,g.seedBuffer.size));
  const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),pose==='head'?-Math.PI/2:pose==='floor'?Math.PI:0);
  if(pose==='body')rotation.setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
  const root=new T.Vector3(-3.5,pose==='ceiling'?3.7:2,pose==='floor'||pose==='ceiling'?2:pose==='head'?(tangent?-7.03:-6.5):spin?-7.5:-7.1),hip=g.sourceBodies[1].restP;
  const velocity=pose==='floor'?[tangent,-speed,0]:pose==='ceiling'?[tangent,speed,0]:[tangent,0,-speed];
  for(let i=0;i<15;i++){const o=i*104,src=g.sourceBodies[i],p=src.restP.clone().sub(hip).applyQuaternion(rotation).add(root),q=rotation.clone().multiply(src.restQ),angular=new T.Vector3(-spin,0,0),v=new T.Vector3(...velocity).add(new T.Vector3().crossVectors(angular,p.clone().sub(root)));a.set(p.toArray(),o);a.set(q.toArray(),o+4);a.set(v.toArray(),o+8);a.set(angular.toArray(),o+12);a.set([0,0,0,reserve],o+32);a.set([0,0,0,100],o+36);a.set([0,0,0,0],o+40);a[o+44]=1;a[o+75]=0;}
  const e=d.createCommandEncoder();e.clearBuffer(g.workBuffer);e.clearBuffer(g.paintBuffer);e.clearBuffer(g.wetBuffer);d.queue.submit([e.finish()]);d.queue.writeBuffer(g.bodyBuffer,0,a);g.bodyCount=15;g.syncCounts();
  if(full){const drops=new Float32Array(900*16);for(let i=0;i<900;i++){drops.set([6,3,6,.007],i*16);drops[i*16+11]=999;}d.queue.writeBuffer(g.particleBuffer,0,drops);d.queue.writeBuffer(g.workBuffer,64*4,new Uint32Array(900).fill(1));d.queue.writeBuffer(g.workBuffer,9*4,new Uint32Array([900]));}
  __smear.tool(0);__smear.view(pose==='floor'?[-.8,3.8,4.8]:pose==='ceiling'?[-.8,3,3.5]:[-.6,2.9,-3.8],pose==='floor'?[-3.5,0,2]:pose==='ceiling'?[-3.5,4.9,2]:[-3.5,1.9,-8]);__smear.fly();this.pose=pose;this.receiver=pose==='floor'?null:pose==='ceiling'?g.surfaces.findIndex(s=>s.n.y<-.9&&s.center.y>4.9):16;await d.queue.onSubmittedWorkDone();__smear.render();
 },
 async advance(ticks){for(let i=0;i<ticks;i+=2)g.submit(Math.min(2,ticks-i));await d.queue.onSubmittedWorkDone();__smear.render();},
 async read(){
  const a=new Float32Array(await read(g.bodyBuffer,0,15*104*4)),w=new Uint32Array(await read(g.workBuffer,0,64*4));
  const parts=Array.from({length:15},(_,i)=>({name:g.sourceBodies[i].name,p:Array.from(a.slice(i*104,i*104+3)),v:Array.from(a.slice(i*104+8,i*104+11)),wound:a[i*104+36],health:a[i*104+39],reserve:a[i*104+35],coat:a[i*104+32]}));
  const ids=this.receiver===null?Array.from({length:16},(_,i)=>i):[this.receiver];let painted=0,opaque=0,alpha=0,liquid=0;
  for(const id of ids){const r=g.records[id],s=g.surfaces[id],pixels=new Uint32Array(await read(g.paintBuffer,r.pixelOffset*4,r.width*r.height*4));for(const p of pixels){const v=p>>>24;if(v){painted++;alpha+=v;if(v>128)opaque++;}}
   const f=new Uint32Array(await read(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,r.filmWidth*r.filmHeight*4));liquid+=f.reduce((n,v)=>n+v/65536*s.w*s.h/f.length,0);
  }
  return {parts,painted,opaque,alpha,liquid,impacts:w[34],spray:w[35],volume:w[36]/65536,splats:w[29],overflow:w[4],tileOverflow:w[18],particles:w[9]};
 },
 async hide(){g.bodyCount=0;g.syncCounts();g.clearDrops();__smear.render();await d.queue.onSubmittedWorkDone();}
 };
 })()`);
}
