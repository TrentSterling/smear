import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {until,sleep} from './cdp.mjs';
import {launchComputeBrowser} from './compute-browser.mjs';
const browser=process.argv.includes('firefox')?'firefox':'chrome';
const out=resolve('tools/out/compute-'+browser);await mkdir(out,{recursive:true});
const page=await launchComputeBrowser({port:9597,width:1920,height:1080});
const receipt={startedAt:new Date().toISOString(),checks:[],muted:true,browserPID:page.proc.pid,browserProfile:page.dir};
const watchdog=setTimeout(()=>{page.kill();console.error('FAIL compute watchdog');process.exit(1);},120000);
try{
 await page.goto(pathToFileURL(resolve('index.html')).href);
 await until(()=>page.eval('!!window.__smearComputeReady||document.getElementById("failure")?.style.display==="block"'),{timeout:60000,label:'GPU game boot'});
 const failure=await page.eval('document.getElementById("failure").style.display==="block"?document.getElementById("failure").textContent:null');if(failure){receipt.gpuErrors=await page.eval('__smearGPU?.errors||[]');console.error(JSON.stringify(receipt.gpuErrors.slice(0,10)));}assert.equal(failure,null,failure);
 console.log('BOOTED hardware WebGPU');
 receipt.browser=await page.eval('navigator.userAgent');
 await page.eval('__smear.manual(true)');const initial=await page.eval('__smear.compute.state()');console.log(JSON.stringify({adapter:initial.adapter,parts:initial.parts.length,gpu:initial.gpu.slice(-3),errors:initial.errors}));receipt.initial=initial;
 assert.equal(initial.backend,'WebGPU compute');assert.equal(initial.adapter.isFallbackAdapter,false);assert.equal(initial.cpuPhysicsTicks,0);assert.equal(initial.normalPaintReadbacks,0);assert.equal(initial.bodyCount,45);assert.deepEqual(initial.errors,[]);receipt.checks.push('Hardware GPU compute and no CPU physics/paint readback');
 if(!process.argv.includes('smoke')){
  const before=initial.steps;const after=await page.eval('__smear.step(120)');assert.equal(after.steps,before+120);assert(after.parts.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)));assert(after.parts.every(p=>p.p[1]>-.1));receipt.checks.push('120 GPU ticks; finite bodies and floor collision');
  await page.eval('__smear.chaos()');await page.eval('__smear.step(240)');const chaos=await page.eval('__smear.compute.state()');assert.equal(chaos.bodyCount,150);assert(chaos.particles>0);assert.equal(chaos.stampOverflow,0);assert.deepEqual(chaos.errors,[]);receipt.chaos=chaos;receipt.checks.push('Chaos: 150 bodies, live GPU droplets and no lost stamps');
  let painted=0;for(let i=0;i<16;i++){const result=await page.eval('__smear.compute.paintHash('+i+')');painted+=result.painted;}assert(painted>0);receipt.paintedFloorPixels=painted;receipt.checks.push('Compute paints persistent floor pigment');
  await page.eval('__smear.clean()');for(let i=0;i<16;i++){const result=await page.eval('__smear.compute.paintHash('+i+')');assert.equal(result.painted,0);}receipt.checks.push('GPU clear erases every floor tile');
  await page.eval('__smear.reset()');await page.eval('__smear.step(120)');const reset=await page.eval('__smear.compute.state()');assert.equal(reset.bodyCount,45);assert.deepEqual(reset.errors,[]);receipt.checks.push('GPU reset restores three dolls');
  await page.eval('__smear.reset();__smear.step(120)');const repeated=await page.eval('__smear.compute.state()');for(let i=0;i<45;i++)for(let k=0;k<3;k++)assert(Math.abs(repeated.parts[i].p[k]-reset.parts[i].p[k])<1e-5);receipt.checks.push('Repeatable GPU simulation after reset');
  for(let i=0;i<12;i++)await page.eval('__smear.add()');await page.eval('__smear.step(720)');const maximum=await page.eval('__smear.compute.state()');receipt.maximum={bodyCount:maximum.bodyCount,maxJoint:maximum.maxJoint};assert.equal(maximum.bodyCount,180);assert(maximum.maxJoint<.15);assert(maximum.parts.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)));assert(maximum.parts.every(p=>Math.abs(p.p[0])<8.5&&Math.abs(p.p[2])<8.5&&p.p[1]>-.1&&p.p[1]<5.5));receipt.checks.push('Twelve-dummy cap, finite physics, arena bounds and joint gaps below 15 cm');
  for(const [width,height]of [[1366,768],[1920,1080],[3000,1800]]){await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(100);await page.eval('__smear.reset();__smear.tool(0);__smear.perf.show(false);__smear.step(45)');for(let d=0;d<3;d++){const point=await page.eval('__smear.project('+d+',"Torso")');assert(point.x>0&&point.x<width&&point.y>0&&point.y<height);await page.eval('__smear.pointer('+point.x+','+point.y+');__smearGPU.inputAction=1;__smear.step(0)');const hit=await page.eval('__smearGPU.readWork().then(r=>new Int32Array(r.buffer)[6])');assert.equal(Math.floor(hit/15),d,'Spawn torso must have a clear GPU ray at '+width);}}receipt.checks.push('All three spawn torso sightlines at 1366, 1920 and 3000 px');
  await page.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await sleep(100);await page.eval('__smear.reset();__smear.step(45)');
  await page.mouse('mousePressed',960,300);await page.mouse('mouseReleased',960,300);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000,label:'Audio activation'});const audio=await page.eval('__smear.compute.audio()');assert.equal(audio.enabled,true);assert.equal(audio.state,'running');receipt.audio=audio;receipt.checks.push('Audio enabled and running, output separately muted');
  await page.eval('__smear.chaos();__smear.perf.show(true);__smear.perf.clear();__smear.manual(false)');await sleep(6000);await page.eval('__smear.manual(true)');receipt.profile=await page.eval('__smear.perf.report()');receipt.final=await page.eval('__smear.compute.state()');console.log(JSON.stringify({fps:receipt.profile.summary.fps,main:receipt.profile.summary.workPercentileMs,gpu:receipt.final.gpu.slice(-5)}));
 }
 await page.shot(resolve(out,'game.png'));receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE compute game checks passed';console.log(receipt.result+' ('+receipt.checks.length+' checks)');
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.message.slice(0,5000));process.exitCode=1;}
finally{clearTimeout(watchdog);receipt.browserLogs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
