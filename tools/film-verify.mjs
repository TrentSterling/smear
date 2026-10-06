import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';
import {until} from './cdp.mjs';
const label=process.argv.find(a=>a.startsWith('round-')||a==='final')||'round-01';
const out=resolve('tools/out/film-pass',label+(process.argv.includes('firefox')?'-firefox':''));await mkdir(out,{recursive:true});await copyFile('index.html',resolve(out,'build.html'));
const page=await launchComputeBrowser({port:9623,width:1440,height:1080});const receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid,checks:[],buildSHA256:createHash('sha256').update(await readFile('index.html')).digest('hex')};
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);
 await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});
 await page.eval(`(async()=>{
  __smear.manual(true);__smear.tune({walking:false,recover:false,drying:100});
  const g=__smearGPU,d=g.device;
  const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(1) fn filmContactProbe(){bodies[0]=paintContact(0u,bodies[0],1.0/120.0);}'});
  const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'filmContactProbe'}});
  window.__filmTest={
   async setup({centres=[[-.20,2.0],[.20,2.0]],radius=.13,height=.65,record=-1,drying=100}={}){
    __smear.reset();await __smear.step(0);__smear.clean();g.clearDrops();g.bodyCount=0;g.syncCounts();g.action=0;__smear.tune({drying});
    const data=new Uint32Array(g.filmCells);for(let i=0;i<g.surfaces.length;i++){
     if(record<0?i>=16:i!==record)continue;const s=g.surfaces[i],r=g.records[i];
     for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){
      const u=((x+.5)/r.filmWidth-.5)*s.w,v=((y+.5)/r.filmHeight-.5)*s.h,p=s.center.clone().addScaledVector(s.u,u).addScaledVector(s.v,v);let h=0;
      for(const c of centres){const a=record<0?p.x:u,b=record<0?p.z:v;const dist=Math.hypot(a-c[0],b-c[1])/radius;h+=height*Math.max(0,1-dist*dist);}
      data[r.filmOffset+x+y*r.filmWidth]=Math.round(h*65536);
     }
    }d.queue.writeBuffer(g.wetBuffer,g.surfaces.length*3136*4,data);__smear.view([.6,1.1,3.4],[0,0,2]);await d.queue.onSubmittedWorkDone();
   },
   async advance(ticks,chunk=2){for(let i=0;i<ticks;i+=chunk)g.submit(Math.min(chunk,ticks-i));await d.queue.onSubmittedWorkDone();},
   async contact(){
    // Only the finite film supplies this clean contact: no old wet grid, wound,
    // coating, or fresh pigment deposition can manufacture the measured smear.
    __smear.tune({coverage:0,transfer:1});const b=new Float32Array(104);b.set([-.20,.10,2,1],0);b.set([0,0,0,1],4);b.set([.28,.10,.16,4],24);b.set([1,1,1,.4],28);b.set([0,0,0,100],36);b.set([1,0,0,0],44);b.set([-.18,0,0,.1],56);b.set([.18,0,0,.1],60);b.set([0,0,-.08,.1],64);b.set([0,0,.08,.1],68);d.queue.writeBuffer(g.bodyBuffer,0,b);
    for(let i=0;i<60;i++){
     d.queue.writeBuffer(g.bodyBuffer,0,new Float32Array([-.2+i*.008,.1,2]));g.uniforms(1);d.queue.writeBuffer(g.uniformBuffer,61*4,new Float32Array([0]));
     const e=d.createCommandEncoder();e.copyBufferToBuffer(g.counterSeed,0,g.workBuffer,0,20);e.clearBuffer(g.workBuffer,g.tileCountsOffset*4,g.tileCount*4);
     const p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.prepareFilm);p.dispatchWorkgroups(Math.ceil(g.filmCells/256));p.setPipeline(pipeline);p.dispatchWorkgroups(1);p.setPipeline(g.computePipelines.bin);p.dispatchWorkgroups(128);p.end();e.copyBufferToBuffer(g.workBuffer,0,g.paintDispatch,0,12);
     const raster=e.beginComputePass();raster.setBindGroup(0,g.computeGroup,[0]);for(const name of ['snapshotPaint','paint']){raster.setPipeline(g.computePipelines[name]);raster.dispatchWorkgroupsIndirect(g.paintDispatch,0);}raster.setPipeline(g.computePipelines.snapshotFilm);raster.dispatchWorkgroups(Math.ceil(g.filmCells/256));raster.setPipeline(g.computePipelines.spreadFilm);raster.dispatchWorkgroups(g.filmGroups);raster.end();d.queue.submit([e.finish()]);g.steps++;
    }
    await d.queue.onSubmittedWorkDone();g.bodyCount=1;const state=await g.state();g.bodyCount=0;return {wet:state.parts[0].wet,smudges:(await g.readWork())[25]};
   },
   async read(record=-1){
    const size=g.filmCells*4,b=g.buffer('explicit film inspection',size*2,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),e=d.createCommandEncoder();e.copyBufferToBuffer(g.wetBuffer,g.surfaces.length*3136*4,b,0,size);e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+g.filmCells*2)*4,b,size,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Uint32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();
    let mobile=0,dry=0,area=0,peak=0,mx=0,my=0,moment=0,bridge=0,seam=0;const points=[];
    for(let i=0;i<g.surfaces.length;i++){
     if(record<0?i>=16:i!==record)continue;const s=g.surfaces[i],r=g.records[i];const cellArea=s.w*s.h/(r.filmWidth*r.filmHeight);
     for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){
      const id=r.filmOffset+x+y*r.filmWidth,h=a[id]/65536,residue=a[g.filmCells+id]/65536;if(!h&&!residue)continue;
      const u=((x+.5)/r.filmWidth-.5)*s.w,v=((y+.5)/r.filmHeight-.5)*s.h,p=s.center.clone().addScaledVector(s.u,u).addScaledVector(s.v,v),px=record<0?p.x:u,py=record<0?p.z:v;
      mobile+=h*cellArea;dry+=residue*cellArea;mx+=px*h*cellArea;my+=py*h*cellArea;moment+=(px*px+(py-2)*(py-2))*h*cellArea;peak=Math.max(peak,h);if(h>.01){area+=cellArea;if(Math.abs(px)<.045&&Math.abs(py-2)<.07)bridge++;if(Math.abs(px)<.02)seam++;points.push([px,py,h]);}
     }
    }
    return {mobile,dry,total:mobile+dry,area,peak,centroid:[mx/Math.max(mobile,1e-9),my/Math.max(mobile,1e-9)],moment:moment/Math.max(mobile,1e-9),bridge,seam};
   }
  };
 })()`);
 await page.eval('__filmTest.setup()');const start=await page.eval('__filmTest.read()');await page.shot(resolve(out,'pool-0s.png'));await page.eval('__filmTest.advance(240)');const two=await page.eval('__filmTest.read()');await page.shot(resolve(out,'pool-2s.png'));await page.eval('__filmTest.advance(720)');const eight=await page.eval('__filmTest.read()');await page.shot(resolve(out,'pool-8s.png'));receipt.pool={start,two,eight};
 assert(eight.area>start.area*1.5,'Pool footprint must grow without more deposition');assert(eight.peak<start.peak*.8,'Pool must level instead of inventing thickness');assert(Math.abs(eight.total/start.total-1)<.015,'Finite film volume must be conserved while spreading and drying');receipt.checks.push('Finite isolated pools spread and level after deposition stops, conserving mobile plus dried mass');
 assert.equal(start.bridge,0);assert(eight.bridge>=4,'Separate pools must coalesce across the floor-record seam');receipt.checks.push('Adjacent pools merge across a floor-record seam');
 await page.eval('(async()=>{await __filmTest.setup();await __filmTest.advance(960,4);})()');const thirty=await page.eval('__filmTest.read()');receipt.cadence={sixty:eight,thirty};assert(Math.abs(thirty.area/eight.area-1)<.05);assert(Math.abs(thirty.total/eight.total-1)<.015);receipt.checks.push('30 Hz and 60 Hz submissions produce comparable spreading and supply');
 await page.eval('__filmTest.setup({centres:[[-.2,2]],radius:.25,height:1})');const contactStart=await page.eval('__filmTest.read()');const contact=await page.eval('__filmTest.contact()');const contactEnd=await page.eval('__filmTest.read()');receipt.contact={start:contactStart,after:contactEnd,...contact};assert(contact.wet>.01,'Clean dummy must pick up mobile liquid');assert(contact.smudges>5,'Mobile liquid must activate smudging without old wet supply');assert(contactEnd.centroid[0]>contactStart.centroid[0]+.002,'Contact must redistribute existing mobile liquid along its travel');assert(contactEnd.total<contactStart.total*1.005,'Contact cannot invent liquid');assert(contactEnd.total>contactStart.total*.9,'Film pickup must stay bounded');receipt.checks.push('Clean dummy picks up and redistributes existing liquid with fresh deposition disabled');await page.eval('__smear.render()');await page.shot(resolve(out,'film-contact.png'));
 await page.eval('__filmTest.setup({centres:[[0,2]],radius:.16,height:.65,drying:15})');const dryStart=await page.eval('__filmTest.read()');await page.eval('__filmTest.advance(2400,4)');const dried=await page.eval('__filmTest.read()');receipt.drying={start:dryStart,after:dried};assert(dried.dry>dryStart.mobile*.6);assert(dried.mobile<dryStart.mobile*.35);assert(Math.abs(dried.total/dryStart.total-1)<.02);receipt.checks.push('Drying transfers mobile liquid into persistent residue instead of deleting blood');await page.shot(resolve(out,'dry-residue.png'));
 const slope=await page.eval('__smearGPU.surfaces.map((s,i)=>({id:i,n:s.n.toArray(),u:s.u.toArray(),v:s.v.toArray(),w:s.w,h:s.h})).find(s=>s.n[1]>.3&&s.n[1]<.95&&s.w>.5&&s.h>.5)');assert(slope,'Inclined receiver');await page.eval(`__filmTest.setup({centres:[[0,0]],record:${slope.id},radius:.15,height:1.2})`);const slopeStart=await page.eval(`__filmTest.read(${slope.id})`);await page.eval('__filmTest.advance(480)');const slopeEnd=await page.eval(`__filmTest.read(${slope.id})`);receipt.slope={surface:slope,start:slopeStart,after:slopeEnd};const drop=(slopeEnd.centroid[0]-slopeStart.centroid[0])*slope.u[1]+(slopeEnd.centroid[1]-slopeStart.centroid[1])*slope.v[1];assert(drop<-.001,'Liquid centroid must travel downhill');assert(Math.abs(slopeEnd.total/slopeStart.total-1)<.015);receipt.checks.push('Liquid follows gravity on an inclined receiver without generating supply');
 await page.eval('__smear.clean();__smear.step(0)');const cleared=await page.eval(`__filmTest.read(${slope.id})`);assert.equal(cleared.total,0);receipt.checks.push('Clean clears both mobile pools and settled residue');
 // Run a real ragdoll through the new liquid, using the normal grab path.
 await page.eval('__smear.reset();__smear.tune({walking:false,recover:false,drying:100});__smear.step(720)');await page.eval('__smear.grab(0,"Right foot")');await page.eval('__smear.target([1.6,.15,2.5]);__smear.step(240)');await page.eval('__smear.release();__smear.view([2.4,3.5,4.6],[0,0,.6]);__smear.step(120)');await page.shot(resolve(out,'live-film-drag.png'));receipt.live=await page.eval('__smear.compute.state()');assert.deepEqual(receipt.live.errors,[]);assert.equal(receipt.live.stampOverflow,0);assert(receipt.live.maxJoint<.15);receipt.checks.push('Live GPU ragdoll dragging remains finite with no dropped paint events');
 receipt.resources=await page.eval('({filmCells:__smearGPU.filmCells,filmBytes:__smearGPU.filmCells*20,wetBytes:__smearGPU.wetBuffer.size})');receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE liquid film checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,pool:receipt.pool,drying:receipt.drying,slope:receipt.slope,resources:receipt.resources},null,2));
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.stack);console.error(JSON.stringify(receipt.pool||{}));process.exitCode=1;}
finally{receipt.logs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
