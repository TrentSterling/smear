import assert from 'node:assert/strict';
import fs from 'node:fs';import {createHash} from 'node:crypto';
const baselineV42=process.argv.includes('baseline-v42'),buildFile=baselineV42?'tools/out/junk-v43-pass/before/index.html':'index.html';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {until,sleep} from './cdp.mjs';
import {launchComputeBrowser} from './compute-browser.mjs';
import {installWallContactFixture} from './wall-contact-fixture.mjs';
import {installHandlingFixture} from './handling-fixture.mjs';
import {installImpactFixture} from './impact-fixture.mjs';
import {installUtilityFixture} from './utility-fixture.mjs';
const browser=process.argv.includes('firefox')?'firefox':'chrome';
const wallMode=process.argv.includes('wall-contact');
const floorMode=process.argv.includes('floor-squeegee');
const blastMode=process.argv.includes('destruction');
const propMode=process.argv.includes('props');
const toyMode=process.argv.includes('toybox');
const buddyMode=process.argv.includes('buddy');
const utilityMode=process.argv.includes('utility');
const bulletMode=process.argv.includes('bullet-liquid');
const arsenalMode=process.argv.includes('arsenal');
const junkMode=process.argv.includes('junk');
const rocketMode=process.argv.includes('rockets');
const width=3000,height=1800,out=resolve('tools/out/compute-native-'+(junkMode?'junk-':bulletMode?'bullet-liquid-':arsenalMode?'arsenal-':rocketMode?'rockets-':utilityMode?'utility-':toyMode?'toybox-':buddyMode?'buddy-':propMode?'props-':blastMode?'destruction-':floorMode?'squeegee-':wallMode?'wall-':'')+browser+(baselineV42?'-baseline-v42':''));await mkdir(out,{recursive:true});
const page=await launchComputeBrowser({port:9598,width,height});
const receipt={sha256:createHash('sha256').update(fs.readFileSync(buildFile)).digest('hex'),startedAt:new Date().toISOString(),viewport:[width,height],audioOutputMuted:true,browserProfile:page.dir,checks:[],profiles:[]};
const watchdog=setTimeout(()=>{page.kill();process.exit(1);},180000);
try{
 await page.init(`if(globalThis.GPUBuffer){window.__gpuAudit={active:false,reads:{},writes:{},canvasReads:0,webGLContexts:0};
 const map=GPUBuffer.prototype.mapAsync;GPUBuffer.prototype.mapAsync=function(...args){if(__gpuAudit.active)__gpuAudit.reads[this.label]=(__gpuAudit.reads[this.label]||0)+1;return map.apply(this,args);};
 const write=GPUQueue.prototype.writeBuffer;GPUQueue.prototype.writeBuffer=function(buffer,offset,data,...args){if(__gpuAudit.active)__gpuAudit.writes[buffer.label]=(__gpuAudit.writes[buffer.label]||0)+(data.byteLength||0);return write.call(this,buffer,offset,data,...args);};
 const read=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){if(__gpuAudit.active)__gpuAudit.canvasReads++;return read.apply(this,args);};
 const ctx=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/^webgl/.test(type))__gpuAudit.webGLContexts++;return ctx.call(this,type,...args);};}`);
 await page.goto(pathToFileURL(resolve(buildFile)).href);
 await until(()=>page.eval('!!window.__smearComputeReady||document.getElementById("failure")?.style.display==="block"'),{timeout:60000,label:'GPU boot'});
 assert.equal(await page.eval('document.getElementById("failure").style.display==="block"?document.getElementById("failure").textContent:null'),null);
 receipt.browser=await page.eval('navigator.userAgent');
 await page.eval('__smear.manual(true);__smear.perf.show(true)');
 await page.mouse('mousePressed',width/2,200);await page.mouse('mouseReleased',width/2,200);
 await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000,label:'Audio activation'});
 receipt.audio=await page.eval('__smear.compute.audio()');assert.equal(receipt.audio.enabled,true);assert.equal(receipt.audio.state,'running');
 receipt.quality=await page.eval('__smear.quality()');assert.deepEqual(receipt.quality.canvas,[width,height]);assert.equal(receipt.quality.maxDrops,900);
 async function profile(label,start,stop=()=>page.eval('void 0')){
  await start();await page.eval('__smearGPU.device.queue.onSubmittedWorkDone()');await sleep(300);
  const began=await page.eval('(()=>{__smear.perf.clear();__smearGPU.gpuSamples.length=0;__gpuAudit.reads={};__gpuAudit.writes={};__gpuAudit.canvasReads=0;__gpuAudit.active=true;__smear.manual(false);return {tick:__smearGPU.steps,time:performance.now()};})()');
  await sleep(6000);const ended=await page.eval('(()=>{__smear.manual(true);__gpuAudit.active=false;return {tick:__smearGPU.steps,time:performance.now()};})()');await stop();
  const report=await page.eval('__smear.perf.report()'),state=await page.eval('__smear.compute.state()'),audit=await page.eval('__gpuAudit');
  receipt.lastAttempt={label,summary:report.summary,gpu:report.compute?.summary,audit};
  assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);assert.equal(audit.canvasReads,0);assert.equal(audit.webGLContexts,0);assert(!Object.keys(audit.reads).some(k=>/body inspection|prop inspection|pigment/.test(k)));assert(!Object.keys(audit.writes).some(k=>/pigment|droplet|ragdoll/.test(k)));
  assert(report.summary.fps>55,`${label}: ${report.summary.fps} FPS`);assert(report.summary.workPercentileMs.p99<5,`${label}: CPU p99 ${report.summary.workPercentileMs.p99}`);
  // Stop the timing window before explicit diagnostic downloads and teardown.
  const ticksPerSecond=(state.steps-began.tick)/((ended.time-began.time)/1000);assert.equal(state.steps,ended.tick);assert(ticksPerSecond>110&&ticksPerSecond<125,label+' actual GPU tick rate '+ticksPerSecond);receipt.profiles.push({label,report,state,audit,ticksPerSecond,window:{began,ended}});console.log(JSON.stringify({label,fps:report.summary.fps,main:report.summary.workPercentileMs,gpu:report.compute.summary,particles:state.particles,hits:state.hits,ticksPerSecond,audit}));await page.shot(resolve(out,label+'.png'));return state;
 }
 if(junkMode){
  for(const name of ['crusher','glass','pinball'])await profile('junk-'+name,()=>page.eval("__smear.utility.demo('"+name+"');__smear.manual(true);__smear.utility.run()"));
  await profile('junk-ten-buddies',()=>page.eval("__smear.utility.demo('pinball');__smear.manual(true);for(let i=0;i<7;i++)__smearGPU.add();__smear.utility.run();__smear.tool(5);__smear.view([-2.7,2.1,6.4],[-2.6,.4,3.3]);__smear.pointer(1500,900)").then(()=>page.mouse('mousePressed',1500,900)),()=>page.mouse('mouseReleased',1500,900));
  receipt.checks.push('Three machinery demos and ten-buddy rapid rockets retain the native frame budget without actor or paint downloads');
 }else if(bulletMode){
  await installUtilityFixture(page);
  for(const [tool,label]of [[1,'wet-pistol'],[12,'wet-shotgun']])await profile(label,async()=>{await page.eval(`(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(90);await __utilityTest.patch({point:[-3,0,5],radius:1.5,mass:.65});__smear.view([-3,1.68,6.8],[-3,0,5]);__smear.pointer(1500,900);__smear.tool(${tool});})()`);await page.mouse('mousePressed',1500,900);},()=>page.mouse('mouseReleased',1500,900));
  receipt.checks.push('Native sustained pistol and shotgun impacts push wet film in ten-buddy scenes without body or pigment downloads');
 }else if(arsenalMode){
  for(const [tool,label]of [[12,'shotgun'],[13,'sawblades']])await profile(label,async()=>{await page.eval(`(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(90);__smear.view([4,2.2,3.6],[-2.4,1,-2.95]);__smear.pointer(1500,900);__smear.tool(${tool});window.__arsenalTarget=0;window.__arsenalAim=setInterval(()=>__smear.view([4,2.2,3.6],[[-2.4,1,-2.95],[2.55,1,-2.95],[0,.25,.6]][__arsenalTarget++%3]),950);})()`);await page.mouse('mousePressed',1500,900);},async()=>{await page.mouse('mouseReleased',1500,900);await page.eval('clearInterval(__arsenalAim)');});
  receipt.checks.push('Native held shotgun and sawblade fire in ten-buddy scenes retain the frame budget with no body or pigment downloads');
 }else if(rocketMode){
  await profile('rapid-rockets',async()=>{await page.eval("(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(90);__smear.view([4,2.2,3.6],[-2.4,1,-2.95]);__smear.pointer(1500,900);__smear.tool(5);window.__rocketTarget=0;window.__rocketAim=setInterval(()=>__smear.view([4,2.2,3.6],[[-2.4,1,-2.95],[2.55,1,-2.95],[0,.5,.6]][__rocketTarget++%3]),1100);})()");await page.mouse('mousePressed',1500,900);},async()=>{await page.mouse('mouseReleased',1500,900);await page.eval('clearInterval(__rocketAim)');});
  receipt.checks.push('Native held rapid rockets in a ten-buddy scene retain the frame budget without body or pigment downloads');
 }else if(utilityMode){
  for(const [tool,label]of (process.argv.includes('machine-only')?[]:[[6,'mop'],[7,'blower'],[8,'washer'],[9,'vacuum'],[10,'magnet']])){
   await profile(label,async()=>{await page.eval(`(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(90);__smear.view([-3,1.68,6.5],[-3,0,5]);__smear.pointer(1500,900);for(let i=0;i<12;i++){__smearGPU.spill();__smearGPU.submit(2);}__smear.tool(${tool});})()`);await page.mouse('mousePressed',1500,900);},()=>page.mouse('mouseReleased',1500,900));
  }
  await profile('accident-line',()=>page.eval('__smear.utility.build();__smear.manual(true);window.__machineTimer=setTimeout(()=>__smearGPU.runContraption(),1400)'),()=>page.eval('clearTimeout(__machineTimer)'));
  receipt.checks.push('Five active utility tools in ten-buddy wet scenes and the complete physical accident line preserve the native frame budget');
 }else if(toyMode){
  await page.eval("(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(120);__smear.toybox.place(1);__smear.view([-3,3,7],[-3,0,5]);__smear.pointer(1500,900);__smear.render();await __smear.buddy.confirm();__smear.toybox.place(2);__smear.view([-1.8,3,7],[-1.8,0,5]);__smear.pointer(1500,900);__smear.render();await __smear.buddy.confirm();})()");
  assert.equal((await page.eval('__smear.props()')).filter(p=>p.active).length,8);
  await page.eval('__smear.tool(0);__smear.view([-6.45,2,1.5],[-6.45,.55,-1.8]);__smear.pointer(1500,900)');await page.mouse('mousePressed',1500,900);await page.eval('__smear.render()');await until(()=>page.eval('__smearGPU.input().body===180&&__smearGPU.input().held'),{label:'native crate pick'});
  let moving=true;const move=(async()=>{let n=0;while(moving){await page.mouse('mouseMoved',1500+Math.sin(n*.055)*360,770+Math.cos(n*.05)*100);n++;await sleep(16);}})();
  try{await profile('full-toybox',()=>page.eval('void 0'),()=>page.mouse('mouseReleased',1500,770));}finally{moving=false;await move;}
  receipt.checks.push('Eight props, ten buddies, native crate dragging and active player collision retain the native frame budget without prop/body/pigment downloads');
 }else if(buddyMode){
  await profile('buddy-preview',()=>page.eval("(async()=>{__smear.chaos();__smear.preset('default');await __smear.step(120);__smear.view([-3,2,7],[-3,0,3]);__smear.pointer(1500,900);__smear.buddy.begin(false);__smear.key('KeyE',true);})()"),()=>page.eval("__smear.key('KeyE',false)"));
  assert(await page.eval('!!__smear.buddy.state().placement'));receipt.checks.push('A rotating GPU placement preview in the ten-buddy scene keeps the native frame budget without pose or paint downloads');
 }else if(blastMode||propMode){
  const result=await profile(propMode?'prop-destruction':'destruction',()=>page.eval(`(async()=>{__smear.preset('default');__smear.chaos();__smear.tool(4);__smear.view([4,3,6],[0,1,0]);await __smear.step(120);window.__blastIndex=0;window.__blastTimer=setInterval(()=>{const p=${JSON.stringify(propMode?[[5.65,.58,-6.7],[6.6,.58,5.8],[-6.45,.55,-1.8],[-6.4,.55,6.4]]:[[-.12,.35,.3],[-2.4,.35,-2.95],[2.55,.35,-2.95],[0,.35,2.5]])}[__blastIndex++%4];__smear.blast(p);},750);})()`),()=>page.eval('clearInterval(__blastTimer)'));
  if(propMode){assert((await page.eval('__smear.props()')).filter(p=>p.broken).length>=3);}else assert(result.parts.some(p=>p.severed));receipt.checks.push('Repeated blasts in the ten-dummy scene retain 120 Hz simulation and native frame budget without body, fracture or pigment readbacks');
 }else if(floorMode){
  await installHandlingFixture(page);
  await profile('floor-squeegee',async()=>{await page.eval('__handling.poolSetup();');await page.eval('__handling.twist(true)');},()=>page.eval('__handling.twist(false)'));
  const pool=await page.eval('__handling.poolRead()');assert(pool.squeezed>0);const {field,...stats}=pool;receipt.pool=stats;
  receipt.checks.push('Native E-key floor squeegeeing stays above 55 FPS at 3000x1800, with 120 Hz physics, active audio and no body/pigment transfers');
 }else if(!wallMode){
 await profile('idle',()=>page.eval('__smear.reset();__smear.step(120)'));
 await installImpactFixture(page);
 const bat=await profile('bat',async()=>{await page.eval('__impactTest.setup({speed:0})');const h=(await page.eval('__smear.state()')).parts[2].p;await page.eval(`__smear.view([${h[0]},${h[1]},${h[2]+1.4}],${JSON.stringify(h)});__smear.tool(3);__smear.pointer(1500,900);__smear.step(0)`);await page.mouse('mousePressed',1500,900);},()=>page.mouse('mouseReleased',1500,900));assert(bat.hits>0);receipt.checks.push('Native spiked-bat swings hit and animate at 3000x1800 without pose or pigment transfers');
 // The isolated impact fixture disables walking/recovery; later workloads use defaults.
 await page.eval('__smear.preset("default")');
 const pistol=await profile('pistol',async()=>{await page.eval('__smear.reset();__smear.step(45);__smear.tool(1);__smear.view([2.55,1.5,1],[2.55,1.25,-2.95]);__smear.step(0)');await page.mouse('mouseMoved',width/2,height/2);await page.mouse('mousePressed',width/2,height/2);},()=>page.mouse('mouseReleased',width/2,height/2));assert(pistol.hits>0);receipt.checks.push('Native pistol hits and spawns GPU particles');
 const spill=await profile('spill',async()=>{await page.eval('__smear.reset();__smear.stopBleeding();__smear.tool(2);__smear.view([0,1.6,0],[0,2.5,-8]);__smear.step(0)');await page.mouse('mouseMoved',width/2,height/2);await page.mouse('mousePressed',width/2,height/2);},()=>page.mouse('mouseReleased',width/2,height/2));
 const wallBefore=await page.eval('__smear.compute.paintHash(16)');assert(wallBefore.painted>0);await page.eval('__smear.stopBleeding();__smear.step(480)');const wallAfter=await page.eval('__smear.compute.paintHash(16)');assert(wallAfter.painted>wallBefore.painted);receipt.wall={before:wallBefore,after:wallAfter};receipt.checks.push('Native Spill paints walls; GPU gravity drips extend paint');
 await page.eval('__smear.reset();__smear.tool(0);__smear.step(45)');const target=await page.eval('__smear.project(0,"Right foot")');await page.mouse('mouseMoved',target.x,target.y);await page.mouse('mousePressed',target.x,target.y);await page.eval('__smear.step(0)');await until(()=>page.eval('__smearGPU.readbacks>0'),{label:'GPU pick'});await sleep(100);
 const held=await page.eval('__smearGPU.input().held');assert(held,'Native GPU pick must grab the visible foot');receipt.checks.push('Native grabbing resolves from GPU body poses');
 let moving=true;const move=(async()=>{let n=0;while(moving){await page.mouse('mouseMoved',target.x+Math.sin(n*.08)*450,target.y+Math.cos(n*.09)*110);n++;await sleep(16);}})();
 try{await profile('drag',()=>page.eval('void 0'),()=>page.mouse('mouseReleased',target.x,target.y));}finally{moving=false;await move;}
 let floorPaint=0;for(let i=0;i<16;i++)floorPaint+=(await page.eval('__smear.compute.paintHash('+i+')')).painted;assert(floorPaint>200);receipt.checks.push('Native drag creates persistent floor smears');
 const chaos=await profile('chaos',()=>page.eval('__smear.chaos();__smear.tool(0);__smear.step(120)'));assert.equal(chaos.bodyCount,150);assert(chaos.particles>0);
 await page.eval('__smear.wash();__smear.step(0)');const washed=await page.eval('__smear.compute.state()');assert(washed.parts.every(p=>p.wet===0));for(let i=0;i<150;i++){assert.equal((await page.eval('__smear.compute.paintHash('+i+'+__smearGPU.surfaces.length)')).painted,0);}receipt.checks.push('GPU wash clears all 150 body coatings and pigment');
 await page.eval('__smear.heal();__smear.step(0)');const healed=await page.eval('__smear.compute.state()');assert(healed.parts.every(p=>p.bleeding===0&&p.damage===0&&p.reserve===9));assert.equal(healed.particles,0);receipt.checks.push('GPU heal restores reserves and clears airborne drops');
 await page.eval('__smear.step(2400)');const recovered=await page.eval('__smear.compute.state()');assert(recovered.parts.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)));assert(recovered.parts.some(p=>p.mode>1.5));receipt.checks.push('Finite long GPU simulation and recovery');
 }else{
  await installWallContactFixture(page);
  await profile('wall-contact',async()=>{await page.eval("__contactPlay.setup('drag')");await page.eval("__smear.grab(0,'Torso',[0,0,.125])");await page.eval('(async()=>{await __contactPlay.advance(240);__contactPlay.startTick=__smearGPU.steps-240;__contactPlay.timer=setInterval(()=>__smear.target(__contactTarget((__smearGPU.steps-__contactPlay.startTick)/120,"drag")),8);})()');},()=>page.eval('__contactPlay.stop();__smear.release()'));
  receipt.checks.push('Sustained native wall contact remains above 55 FPS with GPU simulation and no body or pigment readbacks');
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE native GPU gameplay and 3000x1800 profiles passed';console.log(receipt.result+' ('+receipt.checks.length+' checks)');
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.stack);process.exitCode=1;await page.shot(resolve(out,'failure.png')).catch(()=>{});}
finally{clearTimeout(watchdog);receipt.browserLogs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n','utf8');page.kill();}
