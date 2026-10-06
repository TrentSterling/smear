// Readbacks and field uploads are explicit inspection operations only.
export async function installRivuletFixture(page){
 await page.eval(`(async()=>{
 const g=__smearGPU,d=g.device,id=16,r=g.records[id],s=g.surfaces[id];
 const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(256) fn wallShearProbe(@builtin(global_invocation_id) id:vec3u){let r=record(16u);if(id.x>=u32(r.u.w*r.v.w)){return;}let address=u32(r.extra.z)+id.x;if(filmRead(0u,address)>0){atomicStore(&wet[filmOffset(3u)+address],bitcast<u32>(.6));}}'});
 const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'wallShearProbe'}});
 window.__rivulet={
  async setup(kind='band'){
   __smear.manual(true);__smear.reset();__smear.tune({walking:false,recover:false,drying:100});await __smear.step(0);__smear.clean();g.clearDrops();g.bodyCount=0;g.syncCounts();g.action=0;
   const data=new Uint32Array(r.filmWidth*r.filmHeight);
   for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){
    const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);let h=0;
    if(kind==='thin'){const q=(p.x*p.x+(p.y-1.8)**2)/(.12*.12);h=.040*Math.max(0,1-q);}
    else if(kind==='band'){const q=p.x*p.x/(.55*.55)+(p.y-1.8)**2/(.12*.12);h=.65*Math.max(0,1-q);}
    else{for(const [cx,radius,height] of [[-.5,.07,.075],[.5,.09,1.1]]){const q=((p.x-cx)**2+(p.y-1.8)**2)/(radius*radius);h+=height*Math.max(0,1-q);}}
    data[x+y*r.filmWidth]=Math.round(h*65536);
   }
   d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,data);__smear.tool(0);__smear.view([.6,1.8,-5.4],[0,1.4,-8]);await d.queue.onSubmittedWorkDone();
  },
  async advance(n,chunk=2){for(let i=0;i<n;i+=chunk)g.submit(Math.min(chunk,n-i));await d.queue.onSubmittedWorkDone();},
  async shear(n=120){
   // Apply a finite-duration tangential contact velocity, without adding liquid.
   for(let i=0;i<n;i+=2){g.uniforms(2);const e=d.createCommandEncoder(),p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.prepareFilm);p.dispatchWorkgroups(Math.ceil(g.filmCells/256));p.setPipeline(pipeline);p.dispatchWorkgroups(Math.ceil(r.filmWidth*r.filmHeight/256));p.setPipeline(g.computePipelines.snapshotFilm);p.dispatchWorkgroups(Math.ceil(g.filmCells/256));for(const name of ['accelerateFilm','spreadFilm','runoffFilm']){p.setPipeline(g.computePipelines[name]);p.dispatchWorkgroups(g.filmGroups);}p.end();d.queue.submit([e.finish()]);g.steps+=2;}
   await d.queue.onSubmittedWorkDone();
  },
  async read(){
   const count=r.filmWidth*r.filmHeight,size=count*4,b=g.buffer('explicit rivulet inspection',size*2,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();
   e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,b,0,size);e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset+g.filmCells*2)*4,b,size,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Uint32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();
   let mobile=0,dry=0,core=0,peak=0,cx=0,cy=0;const fronts=[],columns=[],crossSection=[],halves=[{mass:0,y:0},{mass:0,y:0}];const area=s.w*s.h/count;
   for(let x=0;x<r.filmWidth;x++){let front=1.9,col=0,px=0,cut=0;for(let y=0;y<r.filmHeight;y++){
    const j=x+y*r.filmWidth,h=a[j]/65536,res=a[count+j]/65536,p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);px=p.x;
    mobile+=h*area;dry+=res*area;cx+=p.x*h*area;cy+=p.y*h*area;peak=Math.max(peak,h);if(p.y>1.6)core+=h*area;
    const half=halves[p.x<0?0:1];half.mass+=h*area;half.y+=p.y*h*area;
    if(h>.12){front=Math.min(front,p.y);}if(p.y<1.55)col+=h*area;if(p.y>1.29&&p.y<1.32)cut=Math.max(cut,h);
   }if(Math.abs(px)<.60)crossSection.push(cut);if(Math.abs(px)<.48){fronts.push(front);columns.push(col);}}
   let rivulets=0,inside=false;for(const h of crossSection){if(h>.10&&!inside)rivulets++;inside=h>.10;}
   for(const h of halves)h.y/=Math.max(h.mass,1e-10);fronts.sort((a,b)=>a-b);const mean=columns.reduce((a,b)=>a+b,0)/columns.length;
   return {mobile,dry,total:mobile+dry,core,peak,centroidX:cx/Math.max(mobile,1e-10),centroidY:cy/Math.max(mobile,1e-10),halves,rivulets,crossSection,frontLow:fronts[Math.floor(fronts.length*.1)],frontHigh:fronts[Math.floor(fronts.length*.9)],frontSpread:fronts[Math.floor(fronts.length*.9)]-fronts[Math.floor(fronts.length*.1)],columnCV:Math.sqrt(columns.reduce((a,b)=>a+(b-mean)**2,0)/columns.length)/Math.max(mean,1e-10)};
  }
 };
})()`);
}
