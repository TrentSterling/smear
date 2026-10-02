import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';

const input=process.argv[2]||'index.html',source=input==='v8.3'?'git:3129459:index.html':resolve(input),label=process.argv[3]||'current',browser=process.argv[4]||'firefox';
const out=resolve('tools/out',`particles-${label}-${browser}`);await mkdir(out,{recursive:true});
const html=input==='v8.3'?execFileSync('git',['show','3129459:index.html'],{encoding:'utf8',maxBuffer:2000000}):await readFile(source,'utf8');
const fixture=`const particleBench=(()=>{
 let updateMs=0,buildMs=0,seen=0,updates=0,scenario='',frameIndex=0;
 const oldUpdate=updateDrops,oldDraw=drawDrops;
 updateDrops=function(dt){const t=performance.now();seen+=dropList.length;updates++;oldUpdate(dt);updateMs+=performance.now()-t;};
 drawDrops=function(){const t=performance.now();oldDraw();buildMs+=performance.now()-t;};
 function cloud(){for(let i=0;i<900;i++){const k=i+frameIndex*17;emitDrop(new V(-5.6+hash(k*31)*11.2,1.4+hash(k*53)*3,-5.7+hash(k*71)*11.4),new V((hash(k*113)-.5)*3,hash(k*29)*3,(hash(k*43)-.5)*3),.004+hash(k*17)*.008);}}
 function setup(which,hide=false){scenario=which;manual=true;preset('default');applyTuning({recover:false,walking:false});resetWorld(true);runtimeProfiler.show(false);runtimeProfiler.capture(true);runtimeProfiler.clear();
  if(which==='air'){for(let i=0;i<7;i++)addDummy();cloud();}
  if(which==='chaos')chaosScene();
  if(which==='pistol'||which.startsWith('drag-')){viewAt(new V(3.4,3.3,4.8),new V(0,.3,1));const b=dolls[0].byName.Torso;for(const d of dolls)knockDown(d,60);
   if(which.startsWith('drag-')){for(const part of dolls[0].parts){for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])wetBody(part,new V(...n),.85,new V(...n).multiply(part.half),.15);if(which==='drag-floor')addWound(part,new V(0,0,part.half.z),new V(0,0,1),null,true);}for(let i=0;i<12;i++){const n=new V(0,0,1);addWound(b,new V(0,0,b.half.z),n,null,true);}const p=b.p.clone();grab={body:b,local:new V(),target:p.clone(),desired:p.clone(),distance:4,manual:true};}}
  dropMesh.visible=!hide;frameIndex=0;updateMs=buildMs=seen=updates=0;
 }
 function advance(now){const t=performance.now();runtimeProfiler.begin(now,t);
  if(scenario==='air'&&frameIndex%30===0)cloud();
  if(scenario==='pistol'&&frameIndex%14===0){const p=dolls[0].byName.Torso.p.clone().project(camera);mouse.x=(p.x*.5+.5)*W;mouse.y=(.5-p.y*.5)*H;shoot();}
  if(scenario==='drag-air'&&grab)grab.desired.set(Math.sin(frameIndex*.045)*1.4,1.65+Math.sin(frameIndex*.09)*.45,.6+Math.cos(frameIndex*.035)*.8);
  if(scenario==='drag-floor'&&grab)grab.desired.set(-2.3+4.6*(1-Math.cos(frameIndex/60*1.9))*.5,-.24,1.5+Math.sin(frameIndex/60*2.4)*.65);
  physicsStep();physicsStep();renderNow();runtimeProfiler.finish(t);frameIndex++;
 }
 function resetCounters(){updateMs=buildMs=seen=updates=0;runtimeProfiler.clear();}
 function result(){return{updateMs,buildMs,seen,updates,telemetry:runtimeProfiler.report(),paintWorker:window.__smear.paintStatus?.(),state:state(),drops:dropList.map(d=>({p:d.p.toArray(),prev:d.prev.toArray(),v:d.v.toArray(),r:d.r,life:d.life,owner:d.owner})),paint:surfaces.map(s=>({id:s.id,image:s.canvas.toDataURL(),supply:Array.from(s.supply)})),matrices:Array.from(dropMesh.instanceMatrix.array.slice(0,dropList.length*16))};}
 return{setup,advance,resetCounters,result};
})();`;
const runtime=resolve(out,'runtime.html');await writeFile(runtime,html.replace('</head>','<script>window.__benchRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={particleBench,state,'));
const page=browser==='firefox'?await launchFirefox({width:3000,height:1800,port:9595}):await launch({width:3000,height:1800,port:9596});
const reports=[];
try{
 const cases=[['air',false],['air',true],['pistol',false],['drag-air',false],['drag-floor',false],['chaos',false]].filter(([scenario])=>!process.argv[5]||scenario===process.argv[5]);
 for(const [scenario,hide] of cases){
  await page.goto(pathToFileURL(runtime).href);await until(()=>page.eval('!!window.__smear?.particleBench&&!document.getElementById("loading")'),{label:'particle fixture boot'});
  await page.eval(`(async()=>{const b=window.__smear.particleBench;b.setup('${scenario}',${hide});for(let i=0;i<60;i++){await new Promise(r=>__benchRAF(r));b.advance(performance.now());}await window.__smear.paintReady?.();b.resetCounters();window.__benchDone=false;window.__benchStart=()=>{const work=[],gaps=[];let i=0,previous=0;const frame=async now=>{const t=performance.now();b.advance(now);work.push(performance.now()-t);if(previous)gaps.push(now-previous);previous=now;if(++i<240)__benchRAF(frame);else{const summary=v=>{const s=v.slice(3).sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.ceil(s.length*p)-1)];return{mean:s.reduce((a,b)=>a+b,0)/s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};};await window.__smear.paintReady?.();window.__benchReport={work:summary(work),intervals:summary(gaps),...b.result()};window.__benchDone=true;}};__benchRAF(frame);};})()`);
  await page.eval('window.__benchStart()');await until(()=>page.eval('window.__benchDone'),{timeout:120000,every:500,label:'particle workload'});
  const r=await page.eval('window.__benchReport');reports.push({scenario,hide,...r});
  console.log(JSON.stringify({scenario,hide,work:r.work,intervals:r.intervals,updateMsPerFrame:r.updateMs/240,buildMsPerFrame:r.buildMs/240,meanDropsPerTick:r.seen/r.updates,phases:r.telemetry.summary.phases,paintWorker:r.paintWorker}));
  await page.shot(resolve(out,scenario+(hide?'-hidden':'')+'.png'));
 }
 const result={source,sourceSha256:createHash('sha256').update(html).digest('hex'),browser,label,reports,errors:page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s))};
 await writeFile(resolve(out,'summary.json'),JSON.stringify(result,null,2)+'\n');
 console.log('COMPLETE particle workload profiles recorded');
}finally{page.kill();}
