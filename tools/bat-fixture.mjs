// Test-only uploads/readbacks. Hits use the shipping melee arc and fracture pass.
export async function installBatFixture(page){
 await page.eval(`(()=>{const g=__smearGPU,T=g.THREE;async function read(buffer,offset,size){const copy=g.buffer('explicit bat inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=g.device.createCommandEncoder();e.copyBufferToBuffer(buffer,offset,copy,0,size);g.device.queue.submit([e.finish()]);await copy.mapAsync(GPUMapMode.READ);const a=copy.getMappedRange().slice(0);copy.unmap();copy.destroy();return a;}
 window.__batTest={
 async setup({variant=0,part=2,damage=1,fragility=1}={}){
  __smear.manual(true);__smear.reset();__smear.preset('default');__smear.tune({walking:false,recover:false,damage,fragility});await __smear.step(0);__smear.controls.mode('cursor');Object.assign(g.input().tune,{damage});
  const a=new Float32Array(await read(g.seedBuffer,0,g.seedBuffer.size));this.index=variant*15+part;
  for(let i=0;i<45;i++){const base=Math.floor(i/15)*15,src=g.sourceBodies[i],root=new T.Vector3(-3+Math.floor(i/15)*3,.975,4),p=src.restP.clone().sub(g.sourceBodies[base+1].restP).add(root);a.set(p.toArray(),i*104);a.set(src.restQ.toArray(),i*104+4);a.fill(0,i*104+8,i*104+16);a[i*104+44]=1;a[i*104+75]=0;}
  g.device.queue.writeBuffer(g.bodyBuffer,0,a);this.pose=a;__smear.tool(3);this.aim();await g.device.queue.onSubmittedWorkDone();
 },
 aim(){const p=Array.from(this.pose.slice(this.index*104,this.index*104+3)),part=this.index%15;const eye=[...p];if(part>=3&&part<=5)eye[0]-=1.35;else if(part>=9&&part<=11)eye[0]+=1.35;else eye[2]+=1.4;__smear.view(eye,p);__smear.pointer(800,500);},
 async hit(){this.aim();g.melee();g.submit(0);await g.device.queue.onSubmittedWorkDone();return this.snapshot();},
 async snapshot(){const state=await __smear.state(),f=await g.inspectDestruction(),w=new Uint32Array(await read(g.workBuffer,0,256));return {cuts:state.parts.flatMap((p,i)=>p.severed?[i]:[]),jointDamage:Array.from({length:45},(_,i)=>f[i*8+1]/65536),wounds:state.parts.map(p=>p.damage),reserve:state.parts.reduce((n,p)=>n+p.reserve,0),speeds:state.parts.map(p=>Math.hypot(...p.v)),swings:w[54],hits:w[55],particles:state.particles,maxJoint:state.maxJoint,errors:state.errors};}
 };})()`);
}
