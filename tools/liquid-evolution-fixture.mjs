// Explicit diagnostic uploads isolate transfers. Normal gameplay is tested separately.
export async function installLiquidEvolutionFixture(page){
 await page.eval(`(async()=>{
 const g=__smearGPU,d=g.device,id=16,r=g.records[id],s=g.surfaces[id];
 const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(1) fn evolutionContact(){localBodies[0]=bodies[0];bodies[0]=paintContact(0u,bodies[0],1.0/120.0);atomicAdd(&work[5],1u);}'});
 const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'evolutionContact'}});
 window.__evolution={
 async setup({coat=0,height=.5,spin=0,pressure=0,saturated=false}={}){
  __smear.manual(true);__smear.reset();__smear.tune({walking:false,recover:false,drying:100});await __smear.step(0);__smear.clean();g.clearDrops();g.bodyCount=0;g.syncCounts();g.action=0;
  const e=d.createCommandEncoder();e.clearBuffer(g.workBuffer);e.clearBuffer(g.wetBuffer);e.clearBuffer(g.paintBuffer);d.queue.submit([e.finish()]);
  this.spin=spin;this.pressure=pressure;this.tick=0;this.coat=coat;
  const b=new Float32Array(104);b.set([-3.5,2,-7.9,1],0);b.set([Math.SQRT1_2,0,0,Math.SQRT1_2],4);b.set([0,0,spin,0],12);b.set([.28,.10,.16,4],24);b.set([1,1,1,.4],28);b.set([coat,0,0,0],32);b.set([0,0,0,100],36);b.set([1,0,0,0],44);b.set([-.18,0,0,.10],56);b.set([.18,0,0,.10],60);b.set([0,0,-.08,.10],64);b.set([0,0,.08,.10],68);d.queue.writeBuffer(g.bodyBuffer,0,b);
  const data=new Uint32Array(r.filmWidth*r.filmHeight);
  for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){
   const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);
   data[x+y*r.filmWidth]=Math.round(height*Math.max(0,1-((p.x+3.5)**2+(p.y-2)**2)/(.27*.27))*65536);
  }
  d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,data);
  if(saturated){const occupied=new Uint32Array(900);occupied.fill(1);d.queue.writeBuffer(g.workBuffer,64*4,occupied);}
  __smear.view([-2.9,2.2,-5.8],[-3.5,1.7,-8]);await d.queue.onSubmittedWorkDone();
 },
 async advance(n,{film=true,contact=true,coverage=1}={}){
  for(let i=0;i<n;i+=2){g.uniforms(2);d.queue.writeBuffer(g.uniformBuffer,61*4,new Float32Array([coverage]));
   d.queue.writeBuffer(g.uniformBuffer,44*4,new Float32Array([-3.5,2,-7.9-this.pressure*.26,0,0,0,0,this.pressure>0?1:0]));
   const angle=this.spin*this.tick/120,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle).multiply(new THREE.Quaternion(Math.SQRT1_2,0,0,Math.SQRT1_2));d.queue.writeBuffer(g.bodyBuffer,16,new Float32Array(q.toArray()));
   const e=d.createCommandEncoder();e.copyBufferToBuffer(g.counterSeed,0,g.workBuffer,0,20);e.clearBuffer(g.workBuffer,g.tileCountsOffset*4,g.tileCount*4);
   const p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.prepareFilm);p.dispatchWorkgroups(Math.ceil(g.filmCells/256));
   if(contact){p.setPipeline(pipeline);p.dispatchWorkgroups(1);p.dispatchWorkgroups(1);}p.setPipeline(g.computePipelines.bin);p.dispatchWorkgroups(128);p.end();e.copyBufferToBuffer(g.workBuffer,0,g.paintDispatch,0,12);
   const raster=e.beginComputePass();raster.setBindGroup(0,g.computeGroup,[0]);for(const name of ['snapshotPaint','paint']){raster.setPipeline(g.computePipelines[name]);raster.dispatchWorkgroupsIndirect(g.paintDispatch,0);}raster.end();
   if(film){const f=e.beginComputePass();f.setBindGroup(0,g.computeGroup,[0]);f.setPipeline(g.computePipelines.snapshotFilm);f.dispatchWorkgroups(Math.ceil(g.filmCells/256));for(const name of ['accelerateFilm','spreadFilm','runoffFilm']){f.setPipeline(g.computePipelines[name]);f.dispatchWorkgroups(g.filmGroups);}f.end();}
   d.queue.submit([e.finish()]);this.tick+=2;g.steps+=2;
  }await d.queue.onSubmittedWorkDone();await __smear.render();
 },
 async read(){
  const count=r.filmWidth*r.filmHeight,bytes=count*4,b=g.buffer('explicit evolution inspection',bytes*2+900*64+104*4+1024*4,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();
  e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,b,0,bytes);e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset+2*g.filmCells)*4,b,bytes,bytes);e.copyBufferToBuffer(g.particleBuffer,0,b,bytes*2,900*64);e.copyBufferToBuffer(g.bodyBuffer,0,b,bytes*2+900*64,104*4);e.copyBufferToBuffer(g.workBuffer,0,b,bytes*2+900*64+104*4,1024*4);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Uint32Array(b.getMappedRange().slice(0)),f=new Float32Array(a.buffer);b.unmap();b.destroy();const work=a.subarray(count*2+900*16+104);
  let mobile=0,dry=0,outer=0,center=0,moment=0,peak=0;const area=s.w*s.h/count;
  for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const j=x+y*r.filmWidth,h=a[j]/65536,p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h),q=(p.x+3.5)**2+(p.y-2)**2;mobile+=h*area;dry+=a[count+j]/65536*area;moment+=q*h*area;if(q>.24**2)outer+=h*area;if(q<.12**2)center+=h*area;peak=Math.max(peak,h);}
  let airborne=0;const drops=[];for(let j=0;j<900;j++)if(work[64+j]){const k=count*2+j*16;airborne+=f[k+12];drops.push({p:Array.from(f.slice(k,k+3)),v:Array.from(f.slice(k+4,k+7)),volume:f[k+12]});}
  const coat=f[count*2+900*16+32];return {mobile,dry,outer,center,moment:moment/Math.max(mobile,1e-9),peak,coat,airborne,total:mobile+dry+coat*.02+airborne,drops,squeezed:work[31],sprayed:work[32],errors:await g.state().then(s=>s.errors)};
 }
 };
})()`);
}
