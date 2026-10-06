import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';import {until} from './cdp.mjs';import {installWetFixture} from './wet-fixture.mjs';
const label=process.argv.find(x=>/^(round-|final)/.test(x))||'round-01',out=resolve('tools/out/smudge-pass',label+(process.argv.includes('firefox')?'-firefox':''));await mkdir(out,{recursive:true});
const page=await launchComputeBrowser({port:9671,width:1440,height:1080});const receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,buildSHA256:createHash('sha256').update(await readFile('index.html')).digest('hex'),checks:[]};
const boot=async()=>{await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});await page.eval('__smear.manual(true)');};
try{
 await page.goto(pathToFileURL(resolve('tools/out/smudge-pass/before/index.html')).href);await boot();await installWetFixture(page);
 await page.eval('__wetProbe.setup({ink:true,wet:.8,coverage:0})');await page.eval('__wetProbe.run(Array.from({length:91},(_,i)=>[-.6+i*.012,.1,2.5,0]))');receipt.baselineSmudge=await page.eval('__wetProbe.pixels()');
 await page.goto(pathToFileURL(resolve('index.html')).href);await boot();await page.mouse('mousePressed',720,130);await page.mouse('mouseReleased',720,130);
 await page.eval('localStorage.setItem("smear.tune.v8",JSON.stringify({bleeding:2.2,coverage:1.3,transfer:1.4}))');await page.goto(pathToFileURL(resolve('index.html')).href+'?qa=migration');await boot();
 const migrated=await page.eval('__smear.state().then(s=>s.tune)');assert.equal(migrated.bleeding,2.2);assert.equal(migrated.smudge,1.6);assert.equal(migrated.abrasion,1);receipt.tuning={migrated};
 await page.eval('__smear.panel("tune")');const tab=await page.eval('__smear.ui().find(b=>b.label==="Smudge")');assert(tab);await page.mouse('mousePressed',tab.x+20,tab.y+15);await page.mouse('mouseReleased',tab.x+20,tab.y+15);await page.shot(resolve(out,'tune-smudge.png'));
 const slider=await page.eval('__smear.ui().find(b=>b.label==="Smudge strength")');const sx=slider.x+9+(slider.w-18)*.75,sy=slider.y+16;await page.mouse('mouseMoved',sx,sy);await page.mouse('mousePressed',sx,sy);await page.mouse('mouseReleased',sx,sy);await page.goto(pathToFileURL(resolve('index.html')).href+'?qa=persist');await boot();const saved=await page.eval('__smear.state().then(s=>s.tune)');assert(Math.abs(saved.smudge-3)<.03);assert.equal(saved.bleeding,2.2);receipt.tuning.saved=saved;
 await page.eval('__smear.panel(null);__smear.preset("default")');receipt.checks.push('Existing saved tuning migrates without losing settings; the actual Smudge slider changes and persists across reload');
 await installWetFixture(page);receipt.smudge={};
 for(const strength of [0,.5,1.6,4]){
  await page.eval(`__smear.tune({smudge:${strength},abrasion:0});__wetProbe.setup({ink:true,wet:.8,coverage:0})`);const before=await page.eval('__wetProbe.pixels()');
  await page.eval('__wetProbe.run(Array.from({length:91},(_,i)=>[-.6+i*.012,.1,2.5,0]))');const after=await page.eval('__wetProbe.pixels()');receipt.smudge[strength]={before,after};
  assert(Math.abs(after.sum/before.sum-1)<.02);assert.equal(after.blue,after.painted);if(strength===0)assert.equal(after.hash,before.hash);
 }
 assert(receipt.smudge[1.6].after.carried>receipt.smudge[.5].after.carried*1.2);assert(receipt.smudge[4].after.carried>=receipt.smudge[1.6].after.carried);receipt.checks.push('Smudge strength moves progressively more existing pigment, conserves supply and introduces no fresh paint; zero disables transport');
 assert(receipt.smudge[1.6].after.carried>receipt.baselineSmudge.carried*1.5);receipt.checks.push('Default wet pigment carry extends materially beyond the accepted V26 result under matching inputs');
 await page.eval(`(async()=>{
  const g=__smearGPU,d=g.device;
  const module=d.createShaderModule({code:__smearComputeShaders.common+'\\n'+__smearComputeShaders.compute+'\\n@compute @workgroup_size(1) fn scrapeProbe(){localBodies[0]=bodies[0];var b=bodies[0];b.coat.y=max(0,b.coat.y-1.0/120.0);bodies[0]=paintContact(0u,b,1.0/120.0);}'});
  const pipeline=await d.createComputePipelineAsync({layout:d.createPipelineLayout({bindGroupLayouts:[g.computeLayout]}),compute:{module,entryPoint:'scrapeProbe'}});
  window.__scrapeProbe={
   async setup({abrasion=1,speed=1.5,wet=false,air=false,reserve=9}={}){
    __smear.reset();await __smear.step(0);__smear.clean();g.clearDrops();g.action=0;g.bodyCount=1;g.syncCounts();__smear.tune({walking:false,recover:false,damage:1,bleeding:1.35,smudge:1.6,abrasion});
    const e=d.createCommandEncoder();e.clearBuffer(g.workBuffer);e.clearBuffer(g.wetBuffer);e.clearBuffer(g.paintBuffer);d.queue.submit([e.finish()]);
    const b=new Float32Array(104);b.set([-3.5,2,air?-7.3:-7.9,1],0);b.set([Math.SQRT1_2,0,0,Math.SQRT1_2],4);b.set([speed,0,0,0],8);b.set([.28,.1,.16,4],24);b.set([1,1,1,.4],28);b.set([wet?1:0,0,0,reserve],32);b.set([0,0,0,100],36);b.set([1,0,0,0],44);b.set([-.18,0,0,.1],56);b.set([.18,0,0,.1],60);b.set([0,0,-.08,.1],64);b.set([0,0,.08,.1],68);d.queue.writeBuffer(g.bodyBuffer,0,b);this.tick=0;this.air=air;
   },
   async advance(ticks){
    for(let k=0;k<ticks;k++){
     const x=-3.5+Math.sin(this.tick/120*2)*.5;d.queue.writeBuffer(g.bodyBuffer,0,new Float32Array([x,2,this.air?-7.3:-7.9]));g.uniforms(1);d.queue.writeBuffer(g.uniformBuffer,44*4,new Float32Array([x,2,-8.08,0,0,0,0,1]));
     const e=d.createCommandEncoder();e.copyBufferToBuffer(g.counterSeed,0,g.workBuffer,0,20);const p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(pipeline);p.dispatchWorkgroups(1);p.end();d.queue.submit([e.finish()]);this.tick++;
    }await d.queue.onSubmittedWorkDone();return this.read();
   },
   async read(){
    const mem=g.workWords-180*16,b=g.buffer('explicit face wear inspection',104*4+16*4,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(g.bodyBuffer,0,b,0,104*4);e.copyBufferToBuffer(g.workBuffer,mem*4,b,104*4,16*4);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const f=new Float32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();return {wear:Array.from(f.slice(114,120)),blood:f[36],health:f[39],coat:f[32],reserve:f[35]};
   }
  };
 })()`);
 receipt.scrapes={};for(const [name,setup]of [['normal',{}],['extra',{abrasion:4}],['off',{abrasion:0}],['rest',{speed:0}],['air',{air:true}],['empty',{reserve:0}]]){
  await page.eval(`__scrapeProbe.setup(${JSON.stringify(setup)})`);const early=await page.eval('__scrapeProbe.advance(240)'),late=await page.eval('__scrapeProbe.advance(720)');receipt.scrapes[name]={early,late};
 }
 const normal=receipt.scrapes.normal;assert(Math.max(...normal.late.wear)>Math.max(...normal.early.wear)*2);assert(normal.late.blood>normal.early.blood*3);assert(normal.late.reserve<normal.early.reserve);assert(normal.late.wear.filter(v=>v>0).length===1);
 assert(receipt.scrapes.extra.early.blood>normal.early.blood*2);for(const name of ['off','rest','air'])assert.equal(receipt.scrapes[name].late.blood,0);assert.equal(receipt.scrapes.empty.late.coat,0);receipt.checks.push('Loaded sliding accumulates face-local wear and increasing bleeding; stronger abrasion accelerates it, while resting, hovering, disabled abrasion and empty reserves add no contact supply');
 await page.eval('__scrapeProbe.setup();__scrapeProbe.advance(600)');const beforeWash=await page.eval('__scrapeProbe.read()');await page.eval('__smear.wash();__smearGPU.uniforms(0);(()=>{const g=__smearGPU,e=g.device.createCommandEncoder(),p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.control);p.dispatchWorkgroups(1);p.end();g.device.queue.submit([e.finish()])})()');const washed=await page.eval('__scrapeProbe.read()');assert.deepEqual(washed.wear,beforeWash.wear);
 await page.eval('__smear.heal();__smearGPU.uniforms(0);(()=>{const g=__smearGPU,e=g.device.createCommandEncoder(),p=e.beginComputePass();p.setBindGroup(0,g.computeGroup,[0]);p.setPipeline(g.computePipelines.control);p.dispatchWorkgroups(1);p.end();g.device.queue.submit([e.finish()])})()');const healed=await page.eval('__scrapeProbe.read()');assert(healed.wear.every(v=>v===0));assert.equal(healed.blood,0);receipt.checks.push('Wash preserves accumulated abrasion; Heal clears every face and restores blood reserve');
 receipt.surfaces=await page.eval(`__smearGPU.surfaces.map((s,i)=>{const r=__smearGPU.records[i];return {id:i,normal:s.n.toArray(),center:s.center.toArray(),size:[s.w,s.h],pixels:[r.width,r.height]}})`);
 for(const s of receipt.surfaces)assert(s.pixels.every((n,i)=>Math.abs(n-s.size[i]*160)<=.501));
 const ceiling=receipt.surfaces.find(s=>s.center[1]>4.9&&s.normal[1]<-.9);assert(ceiling);
 receipt.overlays=await page.eval('__smearGPU.paintOverlays.map(({mesh,receiver})=>({receiver,point:mesh.position.toArray(),packed:__smearGPU.renderObjects.some(o=>o.object===mesh&&o.record===receiver)}))');assert(receipt.overlays.length>25);assert(receipt.overlays.every(o=>o.packed));
 receipt.spills=[];
 for(const [name,id,point,camera]of [['ceiling',ceiling.id,[2,4.997,2],[2,3.7,2.5]],['trim',16,[-3.5,1.25,-7.94],[-3.5,1.25,-6.4]],['light',ceiling.id,[0,4.88,2],[0,3.7,2.5]]]){
  await page.eval(`__smear.reset();__smear.tune({walking:false,recover:false});__smear.step(0)`);await page.eval(`__smear.clean();__smear.stopBleeding();__smear.tool(2);__smear.view(${JSON.stringify(camera)},${JSON.stringify(point)});__smear.pointer(720,540);__smear.step(0)`);
  await page.mouse('mouseMoved',720,540);await page.mouse('mousePressed',720,540);await page.eval('__smear.step(1)');await page.mouse('mouseReleased',720,540);await page.eval('__smear.step(120)');const paint=await page.eval(`__smear.compute.paintHash(${id})`);assert(paint.painted>200);await page.shot(resolve(out,name+'-paint.png'));
  if(name==='ceiling'){await page.eval('__smear.step(360)');const runoff=await page.eval('__smearGPU.readWork().then(w=>w[26])');assert(runoff>0);receipt.ceilingRunoff=runoff;await page.shot(resolve(out,'ceiling-drips.png'));}
  receipt.spills.push({name,id,paint});
 }
 receipt.checks.push('Native Spill paints ceiling, trim and ceiling lights; overhead liquid detaches into drops, with 160 texels/metre retained on every receiver');
 const state=await page.eval('__smear.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE smudge, abrasion and receiver checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,smudge:Object.fromEntries(Object.entries(receipt.smudge).map(([k,v])=>[k,v.after.carried])),scrapes:receipt.scrapes,surfaces:receipt.surfaces.length,overlays:receipt.overlays.length,ceilingRunoff:receipt.ceilingRunoff},null,2));
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{receipt.logs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
