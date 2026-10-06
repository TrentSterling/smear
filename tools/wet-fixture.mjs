// Explicit uploads isolate pigment transport from deposition and native physics.
export async function installWetFixture(page){
 await page.eval(`(async()=>{
  __smear.manual(true);__smear.tune({walking:false,recover:false,coverage:1,transfer:1});await __smear.step(0);
  const g=__smearGPU,d=g.device;const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(1) fn contactProbe(){bodies[0]=paintContact(0u,bodies[0],1.0/120.0);}'});
  const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'contactProbe'}});
  window.__wetProbe={
   async setup({wet=0,coat=0,blood=0,ink=false,x=-.6,z=2.5,coverage=1}={}){
    __smear.reset();await __smear.step(0);__smear.clean();__smear.stopBleeding();await __smear.step(0);g.action=0;g.clearDrops();__smear.tune({coverage});window.__wetProbeCoverage=coverage;
    const e=d.createCommandEncoder();e.clearBuffer(g.workBuffer);e.clearBuffer(g.paintBuffer);e.clearBuffer(g.wetBuffer);d.queue.submit([e.finish()]);
    const b=new Float32Array(104);b.set([x,.10,z,1],0);b.set([0,0,0,1],4);b.set([.28,.10,.16,4],24);b.set([1,1,1,.4],28);b.set([coat,0,0,9],32);b.set([blood,0,0,100],36);b.set([1,0,0,0],44);
    b.set([-.18,0,0,.10],56);b.set([.18,0,0,.10],60);b.set([0,0,-.08,.10],64);b.set([0,0,.08,.10],68);d.queue.writeBuffer(g.bodyBuffer,0,b);
    for(let id=0;id<16;id++){
     const r=g.records[id],s=g.surfaces[id],pixels=new Uint32Array(r.width*r.height);const supply=new Uint32Array(3136);supply.fill(Math.round(wet*65536));
     if(ink)for(let py=0;py<r.height;py++)for(let px=0;px<r.width;px++){
      const p=s.center.clone().addScaledVector(s.u,((px+.5)/r.width-.5)*s.w).addScaledVector(s.v,((py+.5)/r.height-.5)*s.h);
      if(p.x>x-.22&&p.x<x+.16&&Math.abs(p.z-z)<.21){pixels[px+py*r.width]=(220<<24)|(200<<16)|(125<<8)|20;}
     }
     d.queue.writeBuffer(g.paintBuffer,r.pixelOffset*4,pixels);d.queue.writeBuffer(g.wetBuffer,id*3136*4,supply);
    }
    await d.queue.onSubmittedWorkDone();
   },
   async run(points){
    for(const [x,y,z,angle=0] of points){
     d.queue.writeBuffer(g.bodyBuffer,0,new Float32Array([x,y,z]));d.queue.writeBuffer(g.bodyBuffer,16,new Float32Array([0,Math.sin(angle/2),0,Math.cos(angle/2)]));g.uniforms(1);d.queue.writeBuffer(g.uniformBuffer,61*4,new Float32Array([__wetProbeCoverage]));
     const e=d.createCommandEncoder();e.copyBufferToBuffer(g.counterSeed,0,g.workBuffer,0,20);e.clearBuffer(g.workBuffer,g.tileCountsOffset*4,g.tileCount*4);
     const p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(pipeline);p.dispatchWorkgroups(1);p.setPipeline(g.computePipelines.bin);p.dispatchWorkgroups(128);p.end();e.copyBufferToBuffer(g.workBuffer,0,g.paintDispatch,0,12);
     const raster=e.beginComputePass();raster.setBindGroup(0,g.computeGroup,[0]);for(const name of ['snapshotPaint','paint']){raster.setPipeline(g.computePipelines[name]);raster.dispatchWorkgroupsIndirect(g.paintDispatch,0);}raster.end();d.queue.submit([e.finish()]);g.steps++;
    }await d.queue.onSubmittedWorkDone();
   },
   async pixels(){
    const last=g.records[15],size=(last.pixelOffset+last.width*last.height)*4,b=g.buffer('explicit wet-contact pigment inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(g.paintBuffer,0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(b.getMappedRange().slice(0));b.unmap();b.destroy();window.__wetPixels=bytes;
    let sum=0,painted=0,blue=0,carried=0,bridge=0;const tileSum=Array(16).fill(0);for(let id=0;id<16;id++){const r=g.records[id],s=g.surfaces[id];for(let py=0;py<r.height;py++)for(let px=0;px<r.width;px++){const o=(r.pixelOffset+py*r.width+px)*4,a=bytes[o+3];if(!a)continue;sum+=a;tileSum[id]+=a;painted++;if(bytes[o+2]>bytes[o]*2)blue++;const wx=s.center.x+((px+.5)/r.width-.5)*s.w*s.u.x+((py+.5)/r.height-.5)*s.h*s.v.x;if(wx>-.41&&bytes[o+2]>bytes[o]*2)carried++;if(wx>.10&&wx<.50)bridge++;}}
    const digest=await crypto.subtle.digest('SHA-256',bytes);const counters=await g.readWork();return {hash:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),sum,tileSum,painted,blue,carried,bridge,smears:counters[23],pools:counters[24],smudges:counters[25]};
   }
  };
 })()`);
}
