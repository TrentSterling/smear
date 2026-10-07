// Explicit inspection only. Normal gameplay never downloads these GPU fields.
export async function installDestructionFixture(page){
 await page.eval(`(()=>{const g=__smearGPU,d=g.device;
 window.__destructionFixture={
 async read(buffer,offset,size){const b=g.buffer('explicit destruction fixture',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,offset,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=b.getMappedRange().slice(0);b.unmap();b.destroy();return a;},
 async ceiling(rate=1){
  __smear.manual(true);__smear.reset();__smear.preset('default');__smear.tune({ceilingDrips:rate});await __smear.step(0);__smear.clean();g.clearDrops();g.bodyCount=0;g.syncCounts();g.action=0;
  this.ceilingID=g.surfaces.findIndex(s=>s.n.y<-.9&&s.center.y>4.9);const id=this.ceilingID,r=g.records[id],s=g.surfaces[id],a=new Uint32Array(r.filmWidth*r.filmHeight);
  for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const u=((x+.5)/r.filmWidth-.5)*s.w,v=((y+.5)/r.filmHeight-.5)*s.h,t=(u*u+v*v)/(.45*.45);if(t<1)a[x+y*r.filmWidth]=Math.round((1-t)*1.4*65536);}
  d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,a);__smear.tool(0);__smear.view([1.4,2,2.8],[0,3.5,0]);await d.queue.onSubmittedWorkDone();
 },
 async liquid(){
  const a=new Uint32Array(await this.read(g.wetBuffer,g.surfaces.length*3136*4,g.filmCells*3*4)),slots=new Uint32Array(await this.read(g.workBuffer,64*4,900*4)),p=new Float32Array(await this.read(g.particleBuffer,0,900*64)),w=new Uint32Array(await this.read(g.workBuffer,0,256));let mobile=0,residue=0,retained=0,airborne=0;const drops=[];
  for(let id=0;id<g.surfaces.length;id++){const s=g.surfaces[id],r=g.records[id],area=s.w*s.h/(r.filmWidth*r.filmHeight);for(let k=0;k<r.filmWidth*r.filmHeight;k++){const v=a[r.filmOffset+k]/65536*area;mobile+=v;residue+=a[g.filmCells*2+r.filmOffset+k]/65536*area;if(id===this.ceilingID)retained+=v;}}
  for(let i=0;i<900;i++)if(slots[i]){airborne+=p[i*16+12];drops.push({p:Array.from(p.slice(i*16,i*16+3)),radius:p[i*16+3],age:p[i*16+7],v:Array.from(p.slice(i*16+4,i*16+7))});}
  return {mobile,residue,retained,airborne,total:mobile+residue+airborne,runoff:w[26],drops};
 },
 async advance(ticks){for(let k=0;k<ticks;k+=2)g.submit(Math.min(2,ticks-k));await d.queue.onSubmittedWorkDone();}
 };})()`);
}
