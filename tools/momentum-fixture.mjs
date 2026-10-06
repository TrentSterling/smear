import {installImpactFixture} from './impact-fixture.mjs';
export async function installMomentumFixture(page){
 await installImpactFixture(page);
 await page.eval(`(()=>{
 const g=__smearGPU,d=g.device;
 async function read(buffer,size){const b=g.buffer('explicit momentum inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=b.getMappedRange().slice(0);b.unmap();b.destroy();return a;}
 window.__momentum={
 async setup(part='Head'){
  await __impactTest.setup({speed:0,damage:0,bleeding:0});
  const a=new Float32Array(await read(g.bodyBuffer,15*104*4));
  for(let i=0;i<15;i++){a[i*104]-=.5;a[i*104+1]+=.9;a[i*104+2]+=2.5;}
  d.queue.writeBuffer(g.bodyBuffer,0,a);this.target=await __smear.grab(0,part);await __impactTest.advance(60);
  __smear.view([1.5,4.1,3],[-.5,2.5,-4]);__smear.render();
 },
 async flick({frames=8,step=.65,pause=0,axis=0}={}){for(let i=0;i<frames;i++){this.target[axis]+=step;__smear.target(this.target);await __impactTest.advance(2);}await __impactTest.advance(pause);},
 async read(){
  const a=new Float32Array(await read(g.bodyBuffer,15*104*4)),w=new Uint32Array(await read(g.workBuffer,1024*4));
  let mass=0;const v=[0,0,0],p=[0,0,0],parts=[];
  for(let i=0;i<15;i++){const o=i*104,m=1/a[o+3];mass+=m;for(let k=0;k<3;k++){v[k]+=a[o+8+k]*m;p[k]+=a[o+k]*m;}parts.push({name:g.sourceBodies[i].name,p:Array.from(a.slice(o,o+3)),v:Array.from(a.slice(o+8,o+11))});}
  return {v:v.map(x=>x/mass),p:p.map(x=>x/mass),gap:g.jointError(a),parts,assists:w[52],history:Array.from(new Float32Array(w.buffer).slice(964,1024)),impacts:w[34],thuds:w[39]};
 },
 async flight(ticks=[1,2,4,8,16,24,32,48]){const samples=[];let previous=0;for(const tick of ticks){await __impactTest.advance(tick-previous);samples.push({tick,...await this.read()});previous=tick;}return samples;}
 };
 })()`);
}
