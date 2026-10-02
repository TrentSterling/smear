// Force worker starvation in both releases while keeping the same simulation ticks.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchFirefox} from './bidi.mjs';
import {until} from './cdp.mjs';

const out=resolve('tools/out/recovery-profile');await mkdir(out,{recursive:true});
const baseline=execFileSync('git',['show','fe1f200:index.html'],{encoding:'utf8',maxBuffer:2000000});
const candidate=await readFile('index.html','utf8'),reports=[];
const hook=`<script>window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.paintDelay=0;const OriginalWorker=Worker;window.Worker=class extends OriginalWorker{postMessage(message,transfers){const send=()=>super.postMessage(message,transfers);if(window.paintDelay&&message.ops?.length)setTimeout(send,window.paintDelay);else send();}};</script>`;
const fixture=`const recoveryBench={
 setup:()=>{manual=true;preset('default');applyTuning({recover:false,walking:false});resetWorld(true);runtimeProfiler.show(false);runtimeProfiler.clear();viewAt(new V(3.4,3.3,4.8),new V(0,.3,1));for(const d of dolls)knockDown(d,60);for(const part of dolls[0].parts){for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])wetBody(part,new V(...n),.85,new V(...n).multiply(part.half),.15);addWound(part,new V(0,0,part.half.z),new V(0,0,1),null,true);}const b=dolls[0].byName.Torso,p=b.p.clone();grab={body:b,local:new V(),target:p.clone(),desired:p.clone(),distance:4,manual:true};},
 tick:(i,now)=>{const t=performance.now();runtimeProfiler.begin(now,t);grab.desired.set(-2.3+4.6*(1-Math.cos(i/60*1.9))*.5,-.24,1.5+Math.sin(i/60*2.4)*.65);physicsStep();physicsStep();renderNow();runtimeProfiler.finish(t);},
 result:()=>({telemetry:runtimeProfiler.report(),status:paintEngine.status(),state:state(),paint:surfaces.map(s=>s.canvas.toDataURL()),skin:bodies.filter(b=>b.skinCanvas).map(b=>b.skinCanvas.toDataURL())})};`;
const host=()=>cpus().map(c=>({idle:c.times.idle,total:Object.values(c.times).reduce((a,b)=>a+b,0)}));
const summary=v=>{const s=v.slice(3).sort((a,b)=>a-b);return{mean:s.reduce((a,b)=>a+b,0)/s.length,p95:s[Math.ceil(s.length*.95)-1],p99:s[Math.ceil(s.length*.99)-1],max:s.at(-1)};};
const page=await launchFirefox({port:9595,width:3000,height:1800});
try{
 for(const [label,source]of [['v8.6',baseline],['candidate',candidate]]){
  const file=resolve(out,label+'.html');await writeFile(file,source.replace('</head>',hook+'</head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={recoveryBench,state,'));
  await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'));
  await page.eval(`(async()=>{const a=__smear,b=a.recoveryBench;b.setup();for(let i=0;i<100;i++){await new Promise(r=>nativeRAF(r));b.tick(i,performance.now());}await a.paintReady(false);a.render();a.perf.clear();window.paintDelay=3000;window.captureDone=false;let i=100;window.captureStart=()=>nativeRAF(function frame(now){b.tick(i++,now);if(i<520)nativeRAF(frame);else{window.paintDelay=0;window.captureDone=true;}});})()`);
  const start=host();await page.eval('window.captureStart()');await until(()=>page.eval('window.captureDone'),{timeout:120000,every:250});
  const finish=host();await page.eval('(async()=>{await __smear.paintReady();__smear.render();})()');
  const data=await page.eval('__smear.recoveryBench.result()');
  const frames=data.telemetry.frames,r={label,sourceSha256:createHash('sha256').update(source).digest('hex'),capturedAt:new Date().toISOString(),cpuMeanBusyFraction:finish.reduce((n,c,i)=>n+1-(c.idle-start[i].idle)/(c.total-start[i].total),0)/finish.length,work:summary(frames.map(f=>f.work)),intervals:summary(frames.map(f=>f.interval)),...data};
  await writeFile(resolve(out,label+'-capture.json'),JSON.stringify(r,null,2)+'\n');assert.equal(frames.length,419);assert.equal(r.status.maxQueued,4096,'worker must actually reach its queue limit');reports.push(r);
  console.log(JSON.stringify({label,work:r.work,intervals:r.intervals,cpuMeanBusyFraction:r.cpuMeanBusyFraction,status:r.status}));
 }
 const state=s=>{s=structuredClone(s);delete s.version;delete s.renderer;for(const k of ['physicsMS','frameMS','paintUploads'])delete s.stats[k];return s;};
 assert.deepEqual(state(reports[1].state),state(reports[0].state),'exact simulation and wet transfer');
 assert.deepEqual(reports[1].paint,reports[0].paint,'exact persistent surface pigment');
 assert.deepEqual(reports[1].skin,reports[0].skin,'exact skin pigment');
 assert(reports[1].work.max<reports[0].work.max/3,'recovery must remove the old long main-thread hitch');
 const errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(errors,[]);
 const receipt={reports,checks:['both workers reached 4096-event queue cap','exact simulation and wet transfer','exact persistent surface pigment','exact skin pigment','main-thread worst frame reduced by at least 3x','no browser errors'],result:'COMPLETE forced worker-starvation checks passed'};
 await writeFile(resolve(out,'summary.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
}finally{page.kill();}
