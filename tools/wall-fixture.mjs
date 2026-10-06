// Explicit inspection uploads only. Gameplay still uses GPU-resident poses/paint.
export async function installWallFixture(page){
 await page.eval(`(()=>{
 const g=__smearGPU,d=g.device,T=g.THREE;
 async function download(buffer,offset,size){const b=g.buffer('explicit wall impact inspection',size,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,offset,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=b.getMappedRange().slice(0);b.unmap();b.destroy();return a;}
 window.__wallTest={
  async setup(wall=true,speed=8,coat=1.25){
   __smear.manual(true);__smear.reset();__smear.tune({walking:false,recover:false,bleeding:0,damage:0,coverage:1,transfer:1,drying:100});await __smear.step(0);__smear.clean();g.clearDrops();
   const a=new Float32Array(await download(g.bodyBuffer,0,g.bodyBuffer.size));const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),wall?Math.PI/2:0);const offset=new T.Vector3(0,wall?2:.5,wall?-7.6:0);
   for(let i=0;i<15;i++){const o=i*104,p=new T.Vector3(...a.slice(o,o+3)).applyQuaternion(rotation).add(offset),q=rotation.clone().multiply(new T.Quaternion(...a.slice(o+4,o+8)));a.set(p.toArray(),o);a.set(q.toArray(),o+4);a.set(wall?[0,0,-speed]:[0,-speed,0],o+8);a.set([0,0,0],o+12);a.set([coat,0,0,9],o+32);a.set([0,0,0,100],o+36);a[o+44]=1;a[o+75]=0;a[o+55]=0;}
   d.queue.writeBuffer(g.bodyBuffer,0,a);g.bodyCount=15;g.syncCounts();g.action=0;__smear.tool(0);__smear.view(wall?[2.6,2.7,-4.5]:[2.8,3.8,3.8],wall?[0,1.65,-8]:[0,0,.4]);__smear.fly();await d.queue.onSubmittedWorkDone();
  },
  async advance(n){for(let i=0;i<n;i+=2)g.submit(Math.min(2,n-i));await d.queue.onSubmittedWorkDone();},
  async hide(){g.bodyCount=0;g.syncCounts();g.clearDrops();__smear.render();await d.queue.onSubmittedWorkDone();},
  async read(wall=true){
   const ids=typeof wall==='number'?[wall]:wall?[16]:Array.from({length:16},(_,i)=>i);let painted=0,opaque=0,alpha=0,coreAlpha=0,minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,mobile=0,residue=0,coreMobile=0,down=0;
   for(const id of ids){const r=g.records[id],s=g.surfaces[id],a=new Uint32Array(await download(g.paintBuffer,r.pixelOffset*4,r.width*r.height*4));
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const v=a[x+y*r.width]>>>24;if(!v)continue;const u=((x+.5)/r.width-.5)*s.w,w=((y+.5)/r.height-.5)*s.h,p=s.center.clone().addScaledVector(s.u,u).addScaledVector(s.v,w);painted++;if(v>128)opaque++;alpha+=v;if(Math.abs(p.x)<.8&&p.y>1&&p.y<2.5)coreAlpha+=v;if(v>32){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,wall?p.y:p.z);maxY=Math.max(maxY,wall?p.y:p.z);}}
    const count=r.filmWidth*r.filmHeight,base=g.surfaces.length*3136+r.filmOffset,cellArea=s.w*s.h/count,f=new Uint32Array(await download(g.wetBuffer,base*4,count*4)),dry=new Uint32Array(await download(g.wetBuffer,(base+g.filmCells*2)*4,count*4));
    for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const j=x+y*r.filmWidth,m=f[j]/65536*cellArea,dr=dry[j]/65536*cellArea;if(!m&&!dr)continue;const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);mobile+=m;residue+=dr;down+=m*p.y;if(Math.abs(p.x)<.8&&p.y>1&&p.y<2.5)coreMobile+=m;}
   }
   const w=await g.readWork();return {painted,opaque,alpha,coreAlpha,width:maxX-minX,height:maxY-minY,mobile,residue,coreMobile,centroidY:down/Math.max(mobile,1e-9),splats:w[29],overflow:w[4]};
  }
 };
})()`);
}
