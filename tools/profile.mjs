import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, sleep, until } from './cdp.mjs';

const source = resolve(process.argv[2] || 'index.html');
const label = process.argv[3] || 'current';
const out = resolve('tools/out', `profile-${label}`);
await mkdir(out, {recursive:true});
const page = await launch({port:9588,width:1920,height:1080});
function summarize(profile) {
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
  const parents=new Map();
  for(const n of profile.nodes)for(const child of n.children||[])parents.set(child,n.id);
  const self=new Map(),inclusive=new Map();
  for(let i=0;i<(profile.samples||[]).length;i++){
    const id=profile.samples[i],ms=(profile.timeDeltas?.[i]||1000)/1000;
    self.set(id,(self.get(id)||0)+ms);
    for(let current=id;current!==undefined;current=parents.get(current))inclusive.set(current,(inclusive.get(current)||0)+ms);
  }
  const duration=(profile.endTime-profile.startTime)/1000;
  const row=(id,ms)=>({function:nodes.get(id).callFrame.functionName||'(anonymous)',line:nodes.get(id).callFrame.lineNumber+1,ms:+ms.toFixed(1),percent:+(ms/duration*100).toFixed(1)});
  return {durationMs:+duration.toFixed(1),self:[...self].sort((a,b)=>b[1]-a[1]).slice(0,18).map(([id,ms])=>row(id,ms)),inclusive:[...inclusive].filter(([id])=>!['(root)','(idle)'].includes(nodes.get(id).callFrame.functionName)).sort((a,b)=>b[1]-a[1]).slice(0,18).map(([id,ms])=>row(id,ms))};
}
const reports=[];
try{
  await page.call('Profiler.enable');
  await page.call('Profiler.setSamplingInterval',{interval:1000});
  for(const [scenario,seconds] of [['room',8],['demo',14],['chaos',10]]){
    await page.goto(pathToFileURL(source).href);
    await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'game boot'});
    await sleep(1500);
    await page.eval(`(()=>{
      const a=window.__smear;
      a.preset('default');
      ${scenario==='demo'?'a.demo();':scenario==='chaos'?'a.chaos();':''}
      const samples=[],heap=[];let previous=performance.now(),collect=true;
      const frame=now=>{if(!collect)return;samples.push(now-previous);previous=now;if(samples.length%60===0&&performance.memory)heap.push(performance.memory.usedJSHeapSize);requestAnimationFrame(frame);};
      requestAnimationFrame(frame);
      window.__profileStop=()=>{collect=false;const sorted=samples.slice(3).sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];return {frames:sorted.length,frameMs:{p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)},over25ms:sorted.filter(x=>x>25).length,heap,state:a.state()};};
    })()`);
    await page.call('Profiler.start');
    await sleep(seconds*1000);
    const {profile}=await page.call('Profiler.stop');
    const telemetry=await page.eval('window.__profileStop()');
    const gpu=await page.eval('(()=>{const g=document.getElementById("world").getContext("webgl2"),e=g.getExtension("WEBGL_debug_renderer_info");return g.getParameter(e.UNMASKED_RENDERER_WEBGL);})()');
    const report={scenario,label,gpu,frameMs:telemetry.frameMs,frames:telemetry.frames,over25ms:telemetry.over25ms,heap:telemetry.heap,dolls:telemetry.state.dolls,simTime:telemetry.state.simTime,renderer:telemetry.state.renderer,stats:telemetry.state.stats,cpu:summarize(profile)};
    reports.push(report);
    await writeFile(resolve(out,`${scenario}.cpuprofile`),JSON.stringify(profile));
    await page.shot(resolve(out,`${scenario}.png`));
    console.log(JSON.stringify(report));
  }
  await writeFile(resolve(out,'summary.json'),JSON.stringify({source,label,reports,errors:page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s))},null,2)+'\n');
}finally{page.kill();}
