import {installImpactFixture} from './impact-fixture.mjs';
export async function installHandlingFixture(page){
 await installImpactFixture(page);
 await page.eval(`(()=>{
 const g=__smearGPU,d=g.device,T=g.THREE;
 async function read(buffer,offset,size){const b=g.buffer('explicit handling inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,offset,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=b.getMappedRange().slice(0);b.unmap();b.destroy();return a;}
 window.__handling={
 async throwSetup(){await __impactTest.setup({speed:0,damage:0,bleeding:0});this.target=await __smear.grab(0,'Torso');this.target[2]=-4;__smear.target(this.target);await __impactTest.advance(120);},
 async flick(pause=8,reverse=false){for(let i=0;i<9;i++){this.target[0]+=.15;__smear.target(this.target);await __impactTest.advance(2);}if(reverse){for(let i=0;i<5;i++){this.target[0]-=.15;__smear.target(this.target);await __impactTest.advance(2);}}await __impactTest.advance(pause);},
 async momentum(){const a=new Float32Array(await read(g.bodyBuffer,0,15*104*4));let mass=0;const v=[0,0,0];for(let i=0;i<15;i++){const m=1/a[i*104+3];mass+=m;for(let k=0;k<3;k++)v[k]+=a[i*104+8+k]*m;}return v.map(x=>x/mass);},
 async poolSetup({smudge=1.6,wet=true,hover=false,clean=false}={}){
  __smear.manual(true);__smear.release(false);__smear.reset();__smear.preset('default');__smear.tune({walking:false,recover:false,abrasion:0,smudge,drying:1000});await __smear.step(0);g.clearDrops();g.action=0;Object.assign(g.input().tune,{damage:0,bleeding:0,coverage:0});
  const a=new Float32Array(await read(g.seedBuffer,0,g.seedBuffer.size));const root=new T.Vector3(0,hover?1.4:.14,2.5),hip=g.sourceBodies[1].restP,rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
  for(let i=0;i<15;i++){const o=i*104,src=g.sourceBodies[i],p=src.restP.clone().sub(hip).applyQuaternion(rotation).add(root);a.set(p.toArray(),o);a.set(rotation.clone().multiply(src.restQ).toArray(),o+4);a.fill(0,o+8,o+16);a.set([0,0,0,0],o+32);a.set([0,0,0,100],o+36);a.set([0,0,0,0],o+40);a[o+44]=1;a[o+75]=0;}
  const e=d.createCommandEncoder();e.clearBuffer(g.workBuffer);e.clearBuffer(g.paintBuffer);e.clearBuffer(g.wetBuffer);d.queue.submit([e.finish()]);d.queue.writeBuffer(g.bodyBuffer,0,a);g.bodyCount=15;g.syncCounts();
  for(let id=0;id<16;id++){
   const r=g.records[id],s=g.surfaces[id],film=new Uint32Array(r.filmWidth*r.filmHeight),paint=new Uint32Array(r.width*r.height);
   const profile=(x,z)=>{const dx=x,dz=z-2.5;return Math.max(0,1-(dx*dx+dz*dz)/1.45**2);};
   for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);film[x+y*r.filmWidth]=wet&&!clean?Math.round(profile(p.x,p.z)*.32*65536):0;}
   for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.width-.5)*s.w).addScaledVector(s.v,((y+.5)/r.height-.5)*s.h),alpha=clean?0:Math.round(Math.min(1,profile(p.x,p.z)*6)*130);paint[x+y*r.width]=(alpha<<24)|(14<<16)|(8<<8)|100;}
   d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,film);d.queue.writeBuffer(g.paintBuffer,r.pixelOffset*4,paint);
  }
  this.target=await __smear.grab(0,'Torso');this.target[1]=hover?1.4:.08;__smear.target(this.target);__smear.view([2,4.6,5],[0,0,2.5]);__smear.fly();__smear.render();
 },
 twist(value){window.dispatchEvent(new KeyboardEvent(value?'keydown':'keyup',{code:'KeyE',key:'e',bubbles:true}));},
 async poolRead(){
  const w=new Uint32Array(await read(g.workBuffer,0,256)),a=new Uint32Array(await read(g.wetBuffer,g.surfaces.length*3136*4,g.filmCells*3*4)),body=new Float32Array(await read(g.bodyBuffer,0,15*104*4));
  let mobile=0,residue=0,outer=0,peak=0,coat=0,thin=0;const field=[];
  for(let id=0;id<16;id++){const r=g.records[id],s=g.surfaces[id],area=s.w*s.h/(r.filmWidth*r.filmHeight);for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){
   const k=r.filmOffset+x+y*r.filmWidth,m=a[k]/65536;mobile+=m*area;residue+=a[g.filmCells*2+k]/65536*area;peak=Math.max(peak,m);
   const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);const radius=Math.hypot(p.x,p.z-2.5);if(radius<1.45){field.push(m);if(radius<1&&m<.08)thin++;}if(radius>1.1)outer+=m*area;
  }}for(let i=0;i<15;i++)coat+=body[i*104+32]*.02;
  const drops=new Float32Array(await read(g.particleBuffer,0,900*64)),slots=new Uint32Array(await read(g.workBuffer,64*4,900*4));let airborne=0;for(let i=0;i<900;i++)if(slots[i])airborne+=drops[i*16+12];
  return {mobile,residue,coat,airborne,total:mobile+residue+coat+airborne,outer,peak,thin,squeezed:w[53],thudEvents:w[39],field};
 },
 async isolateSqueeze(){
  await this.poolSetup();const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(1) fn isolatedSqueegee(){var b=bodies[0];b.p=vec4f(0,.1,2.5,1);b.v=vec4f(1.2,0,0,0);b.w=vec4f(0,5,0,0);localBodies[0]=b;let p=vec3f(0,0,2.5);squeegeeFloor(b,Footprint(p,vec2f(.34,.18),frame.camera.w*2,i32(floorRecord(p)),4u),.025,1.6,.8);}'});
  const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'isolatedSqueegee'}});
  const before=await this.poolRead();for(let i=0;i<120;i++){g.uniforms(3);const e=d.createCommandEncoder(),p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(pipeline);p.dispatchWorkgroups(1);p.end();d.queue.submit([e.finish()]);g.steps+=3;}await d.queue.onSubmittedWorkDone();return {before,after:await this.poolRead()};
 },
 async hide(){this.twist(false);__smear.release(false);g.bodyCount=0;g.syncCounts();__smear.render();await d.queue.onSubmittedWorkDone();}
 };
 })()`);
}
