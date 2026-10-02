import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';

const out=resolve('tools/out/runtime-overhead');await mkdir(out,{recursive:true});
const html=await readFile('index.html','utf8'),runtime=resolve(out,'instrumented.html');
await writeFile(runtime,html.replace('window.__smear={state,',`window.__smear={advanceProfile:now=>{const t=performance.now();runtimeProfiler.begin(now,t);physicsStep();physicsStep();renderNow();runtimeProfiler.finish(t);},state,`));
const page=await launch({port:9594,width:1920,height:1080});
const reports=[];
try{
 await page.init('window.__benchmarkRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0');
 for(const mode of ['disabled','recording','panel','panel-window']){
  await page.goto(pathToFileURL(runtime).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'overhead benchmark boot'});
  await page.eval(`(async()=>{const a=window.__smear;a.manual(true);a.preset('default');a.chaos();a.perf.clear();a.perf.show(${mode.startsWith('panel')});a.perf.capture(${mode!=='disabled'});for(let i=0;i<60;i++){await new Promise(r=>__benchmarkRAF(r));a.advanceProfile(performance.now());}await a.paintReady?.(false);a.perf.clear();window.__benchDone=false;window.__benchStart=()=>{let i=0,previous=0;const work=[],gaps=[];const frame=async now=>{const t=performance.now();a.advanceProfile(now);work.push(performance.now()-t);if(previous)gaps.push(now-previous);previous=now;if(++i<${mode==='panel-window'?1080:240})__benchmarkRAF(frame);else{const summarize=v=>{const s=v.slice(3).sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.ceil(s.length*p)-1)];return{mean:s.reduce((a,b)=>a+b,0)/s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};};await a.paintReady?.(false);window.__benchReport={paintWorker:a.paintStatus?.(),work:summarize(work),intervals:summarize(gaps),telemetry:a.perf.report(),state:a.state()};window.__benchDone=true;}};__benchmarkRAF(frame);};})()`);
  await page.eval('window.__benchStart()');await until(()=>page.eval('window.__benchDone'),{timeout:180000,every:500,label:'fixed-work profiling frames'});
  const r=await page.eval('window.__benchReport');reports.push({mode,...r});console.log(JSON.stringify({mode,work:r.work,intervals:r.intervals,profilerCPU:r.telemetry.summary.phases.profiler,gpu:r.telemetry.gpu}));
 }
 const state=r=>{const s=structuredClone(r.state);delete s.stats.physicsMS;delete s.stats.frameMS;delete s.renderer;return s;};
 const {default:assert}=await import('node:assert/strict');for(const r of reports.slice(1,3))assert.deepEqual(state(reports[0]),state(r));
 console.log('PASS fixed-work simulation states match with profiling disabled, recording and panel open');
 const long=reports.at(-1).telemetry;assert(long.totalFrames>1000);assert(long.frames.length<long.totalFrames);assert(long.frames.every(r=>r.time+r.interval>=long.last.time-long.windowMs));console.log('PASS long-session UI keeps only the rolling window and bounded history');
 const result={reports,errors:page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s))};assert.deepEqual(result.errors,[]);await writeFile(resolve(out,'summary.json'),JSON.stringify(result,null,2)+'\n');
}finally{page.kill();}
