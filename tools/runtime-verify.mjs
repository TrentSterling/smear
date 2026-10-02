import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,sleep,until} from './cdp.mjs';

const target=process.argv[2]||pathToFileURL(resolve('index.html')).href;
const label=process.argv[3]||'local';
const release=JSON.parse(await readFile('package.json','utf8'));
const out=resolve('tools/out',`runtime-${label}`);await mkdir(out,{recursive:true});
const receipts={target,checks:[],reports:[]};
function pass(name,fn){fn();receipts.checks.push(name);console.log('PASS '+name);}
const page=await launch({port:9593,width:1366,height:768});
async function key(code,key){await page.call('Input.dispatchKeyEvent',{type:'keyDown',code,key});await page.call('Input.dispatchKeyEvent',{type:'keyUp',code,key});}
async function click(id){const p=await page.eval(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await page.mouse('mouseMoved',p.x,p.y);await page.mouse('mousePressed',p.x,p.y);await page.mouse('mouseReleased',p.x,p.y);}
function valid(s){
 assert(s.frames.length>0);const intervals=s.frames.map(r=>r.interval).sort((a,b)=>a-b),n=intervals.length;
 assert.equal(s.histogram.reduce((n,b)=>n+b.count,0),n);
 for(const p of [50,95,99])assert.equal(s.summary.intervalMs['p'+p],intervals[Math.min(n-1,Math.ceil(n*p/100)-1)]);
 const meanFPS=1000*n/intervals.reduce((a,b)=>a+b,0);assert(Math.abs(s.summary.fps-meanFPS)<1e-6);
 for(const r of s.frames){
  for(const k of ['interval','work','physics','paint','drops','uploadPrep','render','hud','profiler','input','other','uploadCPU','uploadBytes','steps'])assert(Number.isFinite(r[k])&&r[k]>=0,k);
  const sum=['physics','paint','drops','uploadPrep','render','hud','profiler','input','other'].reduce((sum,k)=>sum+r[k],0);
  assert(Math.abs(sum-r.work)<.1,`exclusive phases ${sum} vs work ${r.work}`);
 }
 assert(s.frames.length<=s.capacity);assert(s.spikes.length<=64);assert(s.events.length<=96);assert(s.gpu.pending<=8);
}
try{
 await page.goto(target);await until(()=>page.eval('!!window.__smear?.perf&&!document.getElementById("loading")'),{label:'runtime profiler boot'});
 await sleep(1300);
 const first=await page.eval('window.__smear.perf.report()');
 pass('live telemetry starts before opening the profiler',()=>{assert.equal(first.version,release.version);assert(first.frames.length>20);valid(first);});
 receipts.gpu=first.environment.gpu;
 pass('runtime profiler uses real hardware WebGL',()=>assert(!/swiftshader|llvmpipe|software/i.test(receipts.gpu)));
 const button=await page.eval('window.__smear.ui().find(b=>b.label==="Perf")');
 await page.mouse('mouseMoved',button.x+button.w/2,button.y+button.h/2);await page.mouse('mousePressed',button.x+button.w/2,button.y+button.h/2);await page.mouse('mouseReleased',button.x+button.w/2,button.y+button.h/2);
 pass('native Perf button opens the live panel without pausing gameplay',()=>assert(button));
 await sleep(1300);
 const open=await page.eval('({hidden:document.getElementById("runtime-profile").hidden,s:window.__smear.perf.snapshot(),state:window.__smear.state(),hist:Array.from(document.getElementById("perf-histogram").getContext("2d").getImageData(0,0,432,95).data).some(x=>x>0),history:Array.from(document.getElementById("perf-history").getContext("2d").getImageData(0,0,432,112).data).some(x=>x>0)})');
 pass('FPS histogram, frame history, percentiles and CPU phases render live',()=>{assert(!open.hidden);assert(open.hist&&open.history);assert(!open.state.paused);valid(open.s);});
 await page.shot(resolve(out,'room.png'));
 await click('perf-clear');await sleep(700);
 // A real task outside the game's callback must produce an unclamped rAF gap.
 await page.eval('new Promise(resolve=>setTimeout(()=>{const t=performance.now();while(performance.now()-t<115){}resolve();},0))');
 await sleep(500);
 const hitch=await page.eval('window.__smear.perf.report()');valid(hitch);
 pass('a 115 ms main-thread stall appears unclamped in the histogram and spike log',()=>{assert(hitch.summary.intervalMs.max>90);assert(hitch.spikes.some(s=>s.interval>90));assert(hitch.histogram[0].count>0);assert(hitch.summary.droppedSimMs>0);});
 pass('external stall is paired with the preceding frame work instead of blamed on catch-up physics',()=>{const r=hitch.spikes.find(r=>r.interval>90);assert(r.interval>r.work+50);assert(hitch.frames.some(r=>r.steps>=8));});
 pass('supported browser long tasks are retained with duration and timestamps',()=>{if(hitch.observerTypes.includes('longtask'))assert(hitch.events.some(e=>e.kind==='longtask'&&e.duration>=90));});
 await page.shot(resolve(out,'hitch.png'));receipts.reports.push({scenario:'injected-external-stall',...hitch});
 await page.eval('(()=>{const b=document.getElementById("perf-budget");b.value="120";b.dispatchEvent(new Event("change"));})()');
 const highBudget=await page.eval('window.__smear.perf.snapshot()');
 pass('changing the target budget recalculates spike history for the retained window',()=>{assert.equal(highBudget.budgetMs,1000/120);assert(highBudget.spikes.length>hitch.spikes.length);assert(highBudget.spikes.every(r=>r.interval>highBudget.budgetMs*1.5));});
 await page.eval('(()=>{const b=document.getElementById("perf-budget");b.value="60";b.dispatchEvent(new Event("change"));})()');
 await click('perf-capture');const frozen=await page.eval('({s:window.__smear.perf.snapshot(),time:window.__smear.state().simTime})');await sleep(700);
 const later=await page.eval('({s:window.__smear.perf.snapshot(),time:window.__smear.state().simTime})');
 pass('freeze holds the captured history while the game keeps simulating',()=>{assert(!later.s.capturing);assert.equal(later.s.totalFrames,frozen.s.totalFrames);assert.deepEqual(later.s.frames,frozen.s.frames);assert(later.time>frozen.time);});
 await click('perf-capture');await click('perf-clear');await sleep(500);
 // Drag beside the panel using browser mouse events, rather than a synthetic smear.
 const drag=await page.eval(`(()=>{const a=window.__smear;a.reset();a.tune({recover:false,walking:false});a.view([3.4,3.3,4.8],[0,.1,1]);for(const name of ['Torso','Hips','Head'])for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,.85);return{p:a.project(0,'Torso'),meters:a.state().stats.smearMeters};})()`);
 await page.mouse('mouseMoved',drag.p.x,drag.p.y);await page.mouse('mousePressed',drag.p.x,drag.p.y);
 const held=await page.eval('window.__smear.state().grab');
 for(let i=1;i<=60;i++){await page.mouse('mouseMoved',drag.p.x+Math.sin(i/60*Math.PI)*250,Math.min(710,drag.p.y+75));await sleep(16);}
 await page.mouse('mouseReleased',drag.p.x,drag.p.y);await sleep(400);
 const painted=await page.eval('({s:window.__smear.perf.report(),meters:window.__smear.state().stats.smearMeters})');valid(painted.s);
 pass('native dragging with the profiler open keeps smears and upload telemetry',()=>{assert(held);assert(painted.meters>drag.meters+.1);assert(painted.s.summary.uploadCalls>0);assert(painted.s.summary.uploadMiB>0);assert(painted.s.frames.some(r=>r.held&&r.paint>0&&r.uploadCalls>0));});
 await page.shot(resolve(out,'drag.png'));receipts.reports.push({scenario:'native-drag',...painted.s});
 await page.eval('window.__smear.chaos();window.__smear.perf.clear()');await sleep(2200);
 const chaos=await page.eval('window.__smear.perf.report()');valid(chaos);
 pass('Chaos reports actual workload, solver, paint, render and HUD costs',()=>{assert(chaos.frames.every(r=>r.dolls===10));for(const k of ['physics','paint','render','hud','profiler'])assert(chaos.summary.phases[k]>0,k);assert(chaos.last.activeBodies>0);assert(chaos.last.calls>0);assert(chaos.last.triangles>0);});
 pass('GPU results are asynchronous and unavailable timers remain explicitly unavailable',()=>{if(chaos.gpu.supported)assert(chaos.gpu.samples>0||chaos.gpu.disjoints>0);else assert.equal(chaos.summary.gpuMs,null);assert(chaos.gpu.pending<=8);});
 await page.shot(resolve(out,'chaos.png'));receipts.reports.push({scenario:'chaos',...chaos});
 // A hidden document must start a new rAF sequence, excluding the suspended gap.
 await page.eval('window.__smear.perf.clear();Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');await sleep(160);
 await page.eval('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))');await sleep(500);
 const resumed=await page.eval('window.__smear.perf.snapshot()');
 pass('visibility changes exclude background gaps from FPS and spike history',()=>{assert(resumed.excludedGaps>=1);assert(!resumed.frames.some(r=>r.interval>150));valid(resumed);});
 const exportable=await page.eval('JSON.parse(JSON.stringify(window.__smear.perf.report()))');
 pass('export includes bounded raw frames, spikes, browser events and environment',()=>{assert.equal(exportable.schema,1);assert.equal(exportable.version,release.version);assert(exportable.environment.gpu);assert(exportable.exportedAt);valid(exportable);});
 const {readdir}=await import('node:fs/promises'),beforeDownloads=new Set(await readdir(out));
 await page.call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out,eventsEnabled:true});await click('perf-export');
 let file;for(let i=0;i<30;i++){file=(await readdir(out)).find(p=>/^smear-profile-.*\.json$/.test(p)&&!beforeDownloads.has(p));if(file)break;await sleep(100);}
 pass('Export JSON button downloads a valid profiling capture',()=>assert(file));const downloaded=JSON.parse(await readFile(resolve(out,file),'utf8'));assert.equal(downloaded.schema,1);
 await key('F3','F3');const closed=await page.eval('document.getElementById("runtime-profile").hidden');pass('F3 closes the panel',()=>assert(closed));
 await key('F3','F3');assert(!(await page.eval('document.getElementById("runtime-profile").hidden')));
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await sleep(500);
 const mobile=await page.eval('(()=>{const e=document.getElementById("runtime-profile"),r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth,scroll:e.scrollWidth,client:e.clientWidth};})()');
 pass('profiling panel remains readable and contained at 390 px',()=>{assert(mobile.left>=0&&mobile.right<=mobile.width);assert(mobile.scroll<=mobile.client+1);});await page.shot(resolve(out,'mobile.png'));
 await page.eval('document.getElementById("runtime-profile").querySelector("details").open=true;document.getElementById("runtime-profile").scrollTop=0');
 const wheel=await page.eval('(()=>{const r=document.getElementById("runtime-profile").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await page.mouse('mouseMoved',wheel.x,wheel.y);await page.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:wheel.x,y:wheel.y,deltaX:0,deltaY:400});await sleep(200);
 const scrolled=await page.eval('document.getElementById("runtime-profile").scrollTop');pass('mouse wheel scrolls profiler details instead of being consumed by the game',()=>assert(scrolled>0));
 await page.init(`(()=>{const original=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){return name==='EXT_disjoint_timer_query_webgl2'?null:original.call(this,name);};})()`);
 await page.goto(target);await until(()=>page.eval('!!window.__smear?.perf&&!document.getElementById("loading")'),{label:'unavailable GPU timer boot'});await sleep(600);
 const noTimer=await page.eval('window.__smear.perf.report()');
 pass('unavailable GPU timer keeps CPU telemetry working without reporting an estimated GPU duration',()=>{assert(!noTimer.gpu.supported);assert.equal(noTimer.summary.gpuMs,null);assert.equal(noTimer.gpu.samples,0);valid(noTimer);});
 const error=await page.eval('document.getElementById("world").getContext("webgl2").getError()');
 pass('profiling leaves WebGL state valid and the browser error-free',()=>{assert.equal(error,0);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);});
 receipts.result='COMPLETE runtime profiling checks passed';console.log(receipts.result+' ('+receipts.checks.length+' checks)');
}catch(error){receipts.result='FAIL';receipts.error=error.stack;receipts.logs=page.logs;await page.shot(resolve(out,'failure.png')).catch(()=>{});throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipts,null,2)+'\n');page.kill();}
