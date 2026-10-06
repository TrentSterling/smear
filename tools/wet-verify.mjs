// Explicit diagnostic body/pigment uploads isolate wet-contact behavior. Normal
// gameplay is exercised separately below and by the native release harness.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';
import {until} from './cdp.mjs';
const label=process.argv.find(v=>/^round-|^final/.test(v))||'round-01',out=resolve('tools/out/wet-pass',label+(process.argv.includes('firefox')?'-firefox':''));
await mkdir(out,{recursive:true});await copyFile('index.html',resolve(out,'build.html'));
const page=await launchComputeBrowser({port:9620,width:1440,height:1080});
const receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid,checks:[],buildSHA256:createHash('sha256').update(await readFile('index.html')).digest('hex')};
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);
 await until(async()=>{const r=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(r.error)throw Error(r.error);return r.ready;},{timeout:90000});
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
 const path=Array.from({length:91},(_,i)=>[-.6+i*.012,.10,2.5,0]);
 await page.eval('__wetProbe.setup({ink:true,coverage:0})');const dryBefore=await page.eval('__wetProbe.pixels()');await page.eval(`__wetProbe.run(${JSON.stringify(path)})`);const dryAfter=await page.eval('__wetProbe.pixels()');assert.equal(dryAfter.hash,dryBefore.hash);receipt.checks.push('Dry pigment remains unchanged under a clean moving contact');receipt.dry={before:dryBefore,after:dryAfter};
 await page.eval('__wetProbe.setup({ink:true,wet:.8,coverage:0})');const wetBefore=await page.eval('__wetProbe.pixels()');await page.eval(`__wetProbe.run(${JSON.stringify(path)})`);const wetAfter=await page.eval('__wetProbe.pixels()');assert(wetAfter.smudges>20);assert.equal(wetAfter.blue,wetAfter.painted,'Disabled deposition must introduce no fresh red paint');assert(wetAfter.carried>wetBefore.carried+30,'Existing blue pigment must move beyond its original footprint');assert.notEqual(wetAfter.hash,wetBefore.hash);assert(Math.abs(wetAfter.sum/wetBefore.sum-1)<.02,'Transport must preserve pigment within quantization tolerance');receipt.checks.push('Wet contact redistributes existing colored pigment with fresh deposition disabled');receipt.wet={before:wetBefore,after:wetAfter};
 await page.eval('__wetProbe.setup({ink:true,wet:.8,coverage:0,x:-.12})');const seamBefore=await page.eval('__wetProbe.pixels()');await page.eval('__wetProbe.run(Array.from({length:65},(_,i)=>[-.12+i*.012,.1,2.5,0]))');const seamAfter=await page.eval('__wetProbe.pixels()');assert(seamAfter.tileSum[10]>seamBefore.tileSum[10]+2000);assert(seamAfter.tileSum[9]<seamBefore.tileSum[9]-2000);assert(Math.abs(seamAfter.sum/seamBefore.sum-1)<.02);assert.equal(seamAfter.blue,seamAfter.painted);receipt.seam={before:seamBefore,after:seamAfter};receipt.checks.push('Pigment crosses a floor-record seam without a gap or duplicated supply');
 await page.eval('__wetProbe.setup({coat:.95})');await page.eval(`__wetProbe.run(${JSON.stringify(Array.from({length:100},(_,i)=>[-.6,.1,2.5,i*Math.PI/198]))})`);const rotation=await page.eval('__wetProbe.pixels()');assert(rotation.smears>12);assert(rotation.painted>300);receipt.checks.push('Rotation around a stationary footprint produces curved material smears');receipt.rotation=rotation;
 await page.eval('__wetProbe.setup({coat:.95,blood:.5})');await page.eval('__wetProbe.run(Array.from({length:72},()=>[-.6,.1,2.5,0]))');const poolEarly=await page.eval('__wetProbe.pixels()');await page.eval('__wetProbe.run(Array.from({length:648},()=>[-.6,.1,2.5,0]))');const poolLate=await page.eval('__wetProbe.pixels()');assert(poolLate.pools>=8);assert(poolLate.painted>poolEarly.painted*1.5);assert(poolLate.sum>poolEarly.sum*2);receipt.checks.push('Resting wet wounds grow a cohesive pool over six seconds');receipt.pool={early:poolEarly,late:poolLate};
 await page.eval('__wetProbe.setup({coat:.95})');await page.eval('__wetProbe.run([[-.6,.1,2.5,0],[-.56,.1,2.5,0],[.8,1.2,2.5,0],[.8,.1,2.5,0],[.84,.1,2.5,0]])');const lift=await page.eval('__wetProbe.pixels()');assert.equal(lift.bridge,0);receipt.checks.push('Lift and recontact break the stroke without bridging airborne travel');receipt.lift=lift;
 await page.eval('__wetProbe.setup({coat:.8,blood:0})');await page.eval('__wetProbe.run(Array.from({length:600},()=>[-.6,.1,2.5,0]))');const coatingPool=await page.eval('__wetProbe.pixels()');const remainingCoat=await page.eval('__smear.compute.state().then(s=>s.parts[0].wet)');assert(coatingPool.pools>=2);assert(remainingCoat<.8);receipt.coatingPool={...coatingPool,remainingCoat};receipt.checks.push('A saturated coating leaves a finite puddle without an active wound and consumes wet supply');
 await page.eval(`(async()=>{await __wetProbe.setup({coat:.95});const g=__smearGPU,r=g.surfaces[16];g.device.queue.writeBuffer(g.bodyBuffer,24*4,new Float32Array([.28,.10,.16,2]));const points=Array.from({length:65},(_,i)=>r.center.clone().addScaledVector(r.n,.10).addScaledVector(r.u,-.5+i*.013).toArray());await __wetProbe.run(points);})()`);const wall=await page.eval('__smear.compute.paintHash(16)');assert(wall.painted>200);receipt.slowWallImpacts=await page.eval('__smearGPU.readWork().then(w=>w[29])');assert.equal(receipt.slowWallImpacts,0,'Slow brushing must not create large impact dabs');receipt.checks.push('Slow wall brushing leaves bristle strokes without firing impact splats');const floorAfterWall=await page.eval('__wetProbe.pixels()');assert.equal(floorAfterWall.painted,0);receipt.wall=wall;receipt.checks.push('Body contact also smears on a vertical wall without leaking onto the floor');
 // Closed wall-coating supply: no wounds or normal physics/airborne emission.
 await page.eval(`(async()=>{const r=__smearGPU.surfaces[16];await __wetProbe.run(Array.from({length:1200},(_,i)=>r.center.clone().addScaledVector(r.n,.10).addScaledVector(r.u,Math.sin(i/80)*.5).toArray()));})()`);
 receipt.wallSupply=await page.eval(`(async()=>{const g=__smearGPU,r=g.records[16],s=g.surfaces[16],size=r.filmWidth*r.filmHeight*4,b=g.buffer('explicit wall supply inspection',size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=g.device.createCommandEncoder();e.copyBufferToBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,b,0,size);g.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);let sum=0;for(const v of new Uint32Array(b.getMappedRange()))sum+=v;b.unmap();b.destroy();return {liquid:sum/65536*s.w*s.h/(size/4),coat:(await g.state()).parts[0].wet};})()`);
 assert(receipt.wallSupply.liquid+receipt.wallSupply.coat*.02<=.95*.02*1.08,'Wall dragging cannot multiply its original finite coating supply');
 assert(receipt.wallSupply.liquid>0);assert(receipt.wallSupply.coat<.4);receipt.checks.push('Ten seconds of closed-supply wall dragging cannot create more liquid than the original coating');
 // Live physics, skin pickup, pooling and floor-seam traversal through normal APIs.
 await page.eval('__smear.reset();__smear.tune({walking:false,recover:false,coverage:1});__smear.step(240)');const stateBefore=await page.eval('__smear.compute.state()');await page.eval('__smear.grab(0,"Right foot")');await page.eval('__smear.target([1.1,.15,2.4]);__smear.step(240)');
 await page.eval('__smear.release();__smear.step(120)');const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);assert(state.maxJoint<.15);assert(Math.hypot(...state.parts[1].p.map((v,i)=>v-stateBefore.parts[1].p[i]))>.5,'Live drag must move the dummy');assert(state.parts.every(p=>[...p.p,...p.q].every(Number.isFinite)));receipt.live={before:stateBefore,after:state,counters:Array.from(await page.eval('__smearGPU.readWork().then(r=>Array.from(r.slice(23,26)))'))};receipt.checks.push('Live articulated dummy drag stays finite, connected and within paint event capacity');
 await page.eval('__smear.view([2.1,3.2,4.2],[.1,0,.65]);__smear.step(0)');await page.shot(resolve(out,'live-smear.png'));
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE wet contact checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,wet:receipt.wet,rotation,pool:receipt.pool,lift},null,2));
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{receipt.logs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
