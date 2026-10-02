import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {launch,until} from './cdp.mjs';

const input=process.argv[2]||'index.html',source=input==='v8.1'?'git:6a23fbe:index.html':resolve(input),label=process.argv[3]||'current';
const out=resolve('tools/out',`paint-${label}`);await mkdir(out,{recursive:true});
// Avoid diagnostic state snapshots in the timed loop; production frames do not make them.
const runtime=resolve(out,'runtime.html');
const html=input==='v8.1'?execFileSync('git',['show','6a23fbe:index.html'],{encoding:'utf8',maxBuffer:2000000}):await readFile(source,'utf8');
await writeFile(runtime,html.replace('window.__smear={state,','window.__smear={advance:n=>{for(let i=0;i<n;i++)physicsStep();renderNow();},state,'));
const page=await launch({port:9591,width:1920,height:1080});
function cpuSummary(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),self=new Map(),total=new Map();
 for(const n of profile.nodes)for(const id of n.children||[])parents.set(id,n.id);
 for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i],ms=profile.timeDeltas[i]/1000;self.set(id,(self.get(id)||0)+ms);for(let p=id;p!==undefined;p=parents.get(p))total.set(p,(total.get(p)||0)+ms);}
 const rows=m=>[...m].map(([id,ms])=>({function:nodes.get(id).callFrame.functionName||'(anonymous)',ms:+ms.toFixed(1)})).sort((a,b)=>b.ms-a.ms).slice(0,24);
 return{self:rows(self),inclusive:rows(total)};
}
const reports=[];
try{
 await page.init(`(()=>{window.__paintRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;})()`);
 await page.call('Profiler.enable');await page.call('Profiler.setSamplingInterval',{interval:1000});
 for(const preset of ['default','wet']){
  await page.goto(pathToFileURL(runtime).href);
  await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'paint workload boot'});
  await page.eval(`(async()=>{
   const a=window.__smear;a.manual(true);a.preset('${preset}');a.tune({recover:false,walking:false});a.reset();
   a.moveDoll(0,[-2.3,.16,1.5]);
   const names=a.state().parts.filter(b=>b.doll===1).map(b=>b.name);
   for(const name of names)for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,.85);
   a.grab(0,'Torso');a.view([3.4,3.3,4.8],[0,.1,1]);
   // Identical physical work per displayed frame, independent of elapsed time.
   window.__paintTarget=i=>[-2.3+4.6*(1-Math.cos(i/60*1.9))*.5,-.24,1.5+Math.sin(i/60*2.4)*.65];
   for(let i=0;i<90;i++){await new Promise(r=>__paintRAF(r));a.target(window.__paintTarget(i));a.advance(2);}await a.paintReady?.(false);
   const gl=document.getElementById('world').getContext('webgl2'),proto=Object.getPrototypeOf(gl);
   let uploads=0,bytes=0,uploadMS=0;
   for(const key of ['texImage2D','texSubImage2D']){const upload=proto[key];proto[key]=function(...args){const c=args.find(x=>x instanceof HTMLCanvasElement),t=performance.now();const r=upload.apply(this,args);if(c){uploadMS+=performance.now()-t;uploads++;const explicit=args.length===9;bytes+=(explicit?args[key==='texSubImage2D'?4:3]*args[key==='texSubImage2D'?5:4]:c.width*c.height)*4;}return r;};}
   window.__paintDone=false;window.__paintStart=()=>{
    const costs=[],frames=[],s0=a.state().stats;let previous=performance.now(),i=90;
    const frame=async now=>{const start=performance.now();a.target(window.__paintTarget(i));a.advance(2);costs.push(performance.now()-start);frames.push(now-previous);previous=now;
     if(++i<690)window.__paintRAF(frame);else{
      const summary=values=>{const s=values.slice(3).sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];return{mean:s.reduce((a,b)=>a+b,0)/s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1),over25:s.filter(x=>x>25).length};};
      await a.paintReady?.();window.__paintReport={paintWorker:a.paintStatus?.(),workMS:summary(costs),frameMS:summary(frames),uploads,uploadMiB:bytes/1048576,uploadMS,state:a.state(),startStats:s0};window.__paintDone=true;
     }};window.__paintRAF(frame);
   };
  })()`);
  await page.call('Profiler.start');await page.eval('window.__paintStart()');
  await until(()=>page.eval('window.__paintDone'),{timeout:120000,every:1000,label:'600 drag frames'});
  const {profile}=await page.call('Profiler.stop'),r=await page.eval('window.__paintReport');
  const gpu=await page.eval('(()=>{const g=document.getElementById("world").getContext("webgl2"),e=g.getExtension("WEBGL_debug_renderer_info");return g.getParameter(e.UNMASKED_RENDERER_WEBGL);})()');
  const {parts,...state}=r.state;const report={preset,label,gpu,...r,cpu:cpuSummary(profile)};reports.push(report);
  await writeFile(resolve(out,`${preset}.cpuprofile`),JSON.stringify(profile));
  await page.shot(resolve(out,`${preset}.png`));
  const dump=await page.eval('window.__smear.paintDump()');await writeFile(resolve(out,`${preset}-paint.png`),Buffer.from(dump.split(',')[1],'base64'));
  console.log(JSON.stringify({preset,workMS:report.workMS,frameMS:report.frameMS,uploads:report.uploads,uploadMiB:report.uploadMiB,uploadMS:report.uploadMS,smearMeters:state.stats.smearMeters,cpu:report.cpu}));
 }
 const result={source,label,reports,errors:page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s))};await writeFile(resolve(out,'summary.json'),JSON.stringify(result,null,2)+'\n');
}finally{page.kill();}
