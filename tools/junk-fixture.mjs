// Explicit test-only uploads and downloads; shipping play keeps all actors on GPU.
import {installUtilityFixture} from './utility-fixture.mjs';
export async function installJunkFixture(page){
 await installUtilityFixture(page);
 await page.eval(`(()=>{const g=__smearGPU,d=g.device,read=__destructionFixture.read.bind(__destructionFixture);window.__junkTest={
 async place(kind,point=[-3,0,5],yaw=0){g.beginToy(kind);g.placement.yaw=yaw;__smear.view([point[0],3,point[2]+2],point);__smear.pointer(800,500);return g.confirmBuddy();},
 async word(address,value){d.queue.writeBuffer(g.workBuffer,address*4,new Uint32Array([value]));},
 async damage(id){d.queue.writeBuffer(g.workBuffer,(g.destructionMeta+32+id*8)*4,new Uint32Array([65536]));g.submit(1);await d.queue.onSubmittedWorkDone();},
 async fragment(kind,{p=[-3,.095,5],v=[3,0,0],radius=.08,slot=8,settled=false}={}){const a=new Float32Array(24),w=new Uint32Array(a.buffer);a.set(p);a[3]=radius;a.set(v,4);w[11]=277+slot;w[20]=settled?0x80000000:0;w[23]=kind;d.queue.writeBuffer(g.workBuffer,(g.destructionBase+1440+slot*24)*4,a);},
 async field(){const a=new Uint32Array(await read(g.wetBuffer,g.surfaces.length*3136*4,g.filmCells*4));return Array.from(a);},
 async bodies(){return Array.from(new Float32Array(await read(g.bodyBuffer,0,g.bodyCount*104*4)));},
 async stats(){const w=new Uint32Array(await read(g.workBuffer,g.utilityBase*4,(32+g.props.length*8)*4));return{injuries:w[22],launches:w[24],brawls:w[26],hits:w[27],power:Array.from({length:g.props.length},(_,i)=>w[32+i*8+1])};},
 async surfaceWet(id,face='zp',mass=.10){const rec=g.records[g.props[id].faces[face]],a=new Uint32Array(rec.filmWidth*rec.filmHeight).fill(Math.round(mass*65536));d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+rec.filmOffset)*4,a);},
 async standing(){const a=new Float32Array(await read(g.bodyBuffer,0,g.bodyCount*104*4));for(let i=0;i<15;i++){a.set([-3,0,4,2],i*104+72);a.set([-3,0,4,10000],i*104+76);a[i*104+75]=2;}d.queue.writeBuffer(g.bodyBuffer,0,a);},
 async injureLeg(){const a=new Float32Array(await read(g.bodyBuffer,0,g.bodyCount*104*4));for(const i of [6,7,8])a[i*104+39]=40;d.queue.writeBuffer(g.bodyBuffer,0,a);},
 async fillDrops(){d.queue.writeBuffer(g.workBuffer,9*4,new Uint32Array([900]));d.queue.writeBuffer(g.workBuffer,64*4,new Uint32Array(900).fill(1));},
 async directMachine(){g.uniforms(1);const e=d.createCommandEncoder(),p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.machineStep);p.dispatchWorkgroups(1);p.end();d.queue.submit([e.finish()]);await d.queue.onSubmittedWorkDone();}
 };})()`);
}
