// Fresh-profile hardware Chrome startup, including CPU work before GPU init.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until} from './cdp.mjs';
const label=process.argv[2]||'candidate',source=resolve(process.argv[3]||'index.html');
const out=resolve('tools/out/startup-v45',label);await mkdir(out,{recursive:true});
const original=await readFile(source,'utf8');
const hook=`window.__startup.bootCall=performance.now();
for(const key of ['init','artDirection','buildTools','prepareDummyVariants','buildDummy','buildProps','packWorld','packGeometry','textures','pipelines','bindGroups','buildBundles','resize','submit','render']){
 const original=SmearCompute.prototype[key];if(!original)continue;
 SmearCompute.prototype[key]=function(...args){const start=performance.now();const finish=()=>{if(!(__startup.phases[key]))__startup.phases[key]={start,ms:performance.now()-start};};const result=original.apply(this,args);if(result?.then)return result.then(value=>{finish();return value;});finish();return result;};
}
`;
assert(original.includes('computeBoot().catch(computeFailure);'));
await writeFile(resolve(out,'instrumented.html'),original.replace('computeBoot().catch(computeFailure);',hook+'computeBoot().catch(computeFailure);'));
const page=await launch({port:9675,width:1920,height:1080});
const receipt={startedAt:new Date().toISOString(),source,sha256:createHash('sha256').update(original).digest('hex'),browserProfile:page.dir,runs:[]};
const watchdog=setTimeout(()=>{page.kill();process.exit(1);},180000);
try{
 await page.init(`window.__startup={phases:{},gpu:[],firstScript:performance.now()};
 for(const [proto,keys]of [[GPU,['requestAdapter']],[GPUAdapter,['requestDevice']],[GPUDevice,['createShaderModule','createComputePipelineAsync','createRenderPipelineAsync']],[GPUQueue,['onSubmittedWorkDone']]])for(const key of keys){const original=proto.prototype[key];proto.prototype[key]=function(...args){const start=performance.now(),row={key,label:args[0]?.label,start};__startup.gpu.push(row);const result=original.apply(this,args);row.callMS=performance.now()-start;if(result?.then)return result.then(value=>{row.ms=performance.now()-start;return value;});row.ms=row.callMS;return result;};}`);
 for(let run=0;run<2;run++){
  if(run===0){await page.call('Profiler.enable');await page.call('Profiler.start');}
  await page.goto(pathToFileURL(resolve(out,'instrumented.html')).href+'?defaults=1');
  await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000,label:'hardware startup'});
  const data=await page.eval('({...__startup,observedReady:performance.now(),navigation:performance.getEntriesByType("navigation")[0].toJSON(),adapter:__smearGPU.status().adapter,errors:__smearGPU.errors})');
  assert.deepEqual(data.errors,[]);receipt.runs.push(data);
  if(run===0){const {profile}=await page.call('Profiler.stop');await writeFile(resolve(out,'startup.cpuprofile'),JSON.stringify(profile));const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();profile.samples.forEach((id,i)=>times.set(id,(times.get(id)||0)+profile.timeDeltas[i]));receipt.hotspots=[...times].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([id,time])=>({function:nodes.get(id).callFrame.functionName,line:nodes.get(id).callFrame.lineNumber+1,ms:time/1000}));}
  console.log(JSON.stringify({run,ready:data.observedReady,bootCall:data.bootCall,phases:data.phases,gpu:data.gpu.filter(x=>x.ms>100).sort((a,b)=>b.ms-a.ms).slice(0,12)},null,2));
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE hardware startup profile';
 console.log(JSON.stringify({hotspots:receipt.hotspots.slice(0,15)},null,2));
}catch(e){receipt.error=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(watchdog);await writeFile(resolve(out,'profile.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
