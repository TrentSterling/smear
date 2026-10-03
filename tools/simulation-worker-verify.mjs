// Preserve the complete coupled solver while moving it to a real worker.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {createSimulationKernel} from './simulation-kernel.mjs';
import {compareCanvasPNG,decodeCanvasPNG} from './png-pixels.mjs';
import {createSimulationPaintPool} from './simulation-paint-pool.mjs';

const firefox=process.argv.includes('firefox'),pool=process.argv.includes('pool'),raster=pool||process.argv.includes('raster'),filter=process.argv.slice(2).find(s=>!['firefox','raster','pool'].includes(s)),out=resolve('tools/out/simulation-worker-'+(firefox?'firefox':'chrome')+(pool?'-pool':raster?'-raster':''));
await mkdir(out,{recursive:true});
const source=await readFile('index.html','utf8'),auditSource=await readFile('tools/physics-verify.mjs','utf8');
let audit=auditSource.match(/const fixture=`([\s\S]*?)`;\nconst sources=/)?.[1];
assert(audit,'Existing six-scenario physics audit required');
audit=audit.replace('const snapshots=[];','simulationPaint.length=simulationAudio.length=0;const snapshots=[];');
audit=audit.replace('renderNow();await __smear.paintReady();return{snapshots,pigment:surfaces.map(s=>s.canvas.toDataURL()),skins:bodies.map(b=>b.skinCanvas?.toDataURL()||null)};',`renderNow();await __smear.paintReady(false);const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))),n=>n.toString(16).padStart(2,'0')).join('');return{snapshots,paintCommands:simulationPaint.length,paintSha256:await digest(simulationPaint),audioCommands:simulationAudio.length,audioSha256:await digest(simulationAudio)};`);
assert(audit.includes('paintSha256:'));
const pigmentFixture=`async function simulationPigment(){const png=async c=>!c?null:c.toDataURL?c.toDataURL():new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/png'}));const pool=window.__simulationPaintPool,images=pool?await pool.snapshot():null;const record=s=>images?.get(s.paintId)||png(s.canvas);return{surfaces:await Promise.all(surfaces.map(s=>record(s))),skins:await Promise.all(bodies.map(b=>b.skinCanvas?record(b.skinPaint):null))};}`;
if(raster)audit=audit.replace('await __smear.paintReady(false);const digest','await __smear.paintReady();const digest').replace('audioSha256:await digest(simulationAudio)','audioSha256:await digest(simulationAudio),backend:paintEngine.status(),pigment:await simulationPigment()');
let workerFixture=pigmentFixture+'\n'+audit+`\nwindow.__simulationMethods={audit:physicsAudit};`;
if(pool){
 const setup=`let simulationGeneration=0;${createSimulationPaintPool(source)}window.__simulationPaintPool=simulationPaintPool;
 const simulationAuditCommands=[];const simulationAuditDraw=paintEngine.draw;paintEngine.draw=(...a)=>{simulationAuditDraw(...a);simulationAuditCommands.push(simulationPaint.at(-1));};
 let simulationAuditDispatch=Promise.resolve();paintEngine.pump=()=>{simulationAuditDispatch=simulationAuditDispatch.then(()=>simulationPaintPool.enqueue());};paintEngine.flush=async()=>{await simulationAuditDispatch;await simulationPaintPool.enqueue();await simulationPaintPool.drain();};`;
 workerFixture=setup+'\n'+pigmentFixture+'\n'+audit.replaceAll('simulationPaint','simulationAuditCommands')+`\nwindow.__simulationMethods={audit:physicsAudit};`;
}
const kernel=createSimulationKernel(source,{fixture:workerFixture,raster:raster&&!pool});
await writeFile(resolve(out,'worker.js'),kernel);
const referenceHook=`const simulationPaint=[],simulationAudio=[];
 const nativeSimulationDraw=paintEngine.draw;paintEngine.draw=(s,kind,args)=>{nativeSimulationDraw(s,kind,args);simulationPaint.push([s.paintId,s.paintEpoch,kind,args]);};
 const nativeSimulationNoise=noiseSound,nativeSimulationTone=tone,nativeSimulationScrape=updateScrape;
 noiseSound=(...args)=>{simulationAudio.push(['noise',...args]);nativeSimulationNoise(...args);};tone=(...args)=>{simulationAudio.push(['tone',...args]);nativeSimulationTone(...args);};updateScrape=(...args)=>{simulationAudio.push(['scrape',...args]);nativeSimulationScrape(...args);};
 ${pigmentFixture}
 ${audit}
 window.__simulationReference=physicsAudit;
 `;
const bootHook=`window.requestAnimationFrame=()=>0;window.__simulationKernel=${JSON.stringify(kernel).replaceAll('<','\\u003c')};`;
const file=resolve(out,'runtime.html');await writeFile(file,source.replace('window.__smear={state,',referenceHook+'\nwindow.__smear={state,').replace('</head>','<script>'+bootHook+'</script></head>'));
const cases=['room','chaos','pile','boundary','overflow','recovery'].filter(c=>!filter||c.includes(filter));
const receipt={sourceSha256:createHash('sha256').update(source).digest('hex'),kernelSha256:createHash('sha256').update(kernel).digest('hex'),browser:firefox?'Firefox':'Chrome',checks:[],cases:[],prototype:true,raster,pool,muted:true};
const page=firefox?await launchFirefox({width:1280,height:720}):await launch({port:9597,width:1280,height:720});
try{
 for(const which of cases){
  await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'simulation reference boot'});
  await page.eval(`window.__simulationWorkerBoot=(async()=>{const url=URL.createObjectURL(new Blob([__simulationKernel],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);window.__simulationWorker=worker;const pending=new Map();let seq=0;const boot=await new Promise((resolve,reject)=>{worker.onerror=e=>reject(Error(e.message));worker.onmessage=e=>{if(e.data.paint){for(const b of new Set(e.data.patches.map(p=>p.bitmap||p.atlas?.bitmap).filter(Boolean)))b.close();return;}if(e.data.ready){resolve(e.data);return;}const p=pending.get(e.data.id);if(p){pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.stack)):p.resolve(e.data.result);}};});window.__simulationRPC=(method,...args)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});});return boot;})()`);
  console.log('BOOTED worker '+which);
  const reference=await page.eval(`__simulationReference('${which}')`);
  const candidate=await page.eval(`__simulationRPC('audit','${which}')`);
  assert.deepEqual(candidate.snapshots,reference.snapshots,which+': exact coupled simulation, contact forces and droplets');receipt.checks.push(which+': exact coupled simulation, contact forces and droplets');
  assert.equal(candidate.paintCommands,reference.paintCommands,which+': paint command count');assert.equal(candidate.paintSha256,reference.paintSha256,which+': every ordered paint command');receipt.checks.push(which+': every ordered paint command');
  assert.equal(candidate.audioCommands,reference.audioCommands,which+': audio command count');assert.equal(candidate.audioSha256,reference.audioSha256,which+': every ordered audio recipe');receipt.checks.push(which+': every ordered audio recipe');
  if(raster){const differences=[];for(const type of ['surfaces','skins']){assert.equal(candidate.pigment[type].length,reference.pigment[type].length);for(let i=0;i<candidate.pigment[type].length;i++){const b=reference.pigment[type][i],a=candidate.pigment[type][i];assert.equal(!!a,!!b,which+': '+type+' '+i+' allocation');if(a){const d=compareCanvasPNG(b,a);if(d.changed)differences.push({type,index:i,...d});if(d.overTwo){const bp=decodeCanvasPNG(b),ap=decodeCanvasPNG(a),pixels=[];for(let n=0;n<bp.pixels.length;n+=4){let delta=Math.abs(bp.pixels[n+3]-ap.pixels[n+3]);for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(bp.pixels[n+c]*bp.pixels[n+3]/255-ap.pixels[n+c]*ap.pixels[n+3]/255));if(delta>2)pixels.push({x:(n/4)%bp.width,y:Math.floor(n/4/bp.width),before:Array.from(bp.pixels.slice(n,n+4)),after:Array.from(ap.pixels.slice(n,n+4)),delta});}receipt.failure={which,type,index:i,pixels,referenceBackend:reference.backend,candidateBackend:candidate.backend};}assert.equal(d.overTwo,0,which+': '+type+' '+i+' original pigment tolerance '+JSON.stringify(d));}}}receipt.checks.push(which+': all persistent surfaces and skin pigment');receipt.cases.push({which,pigmentDifferences:differences,referenceBackend:reference.backend,candidateBackend:candidate.backend});}
  receipt.cases.push({which,ticks:600,paintCommands:candidate.paintCommands,paintSha256:candidate.paintSha256,audioCommands:candidate.audioCommands,audioSha256:candidate.audioSha256,snapshotSha256:createHash('sha256').update(JSON.stringify(candidate.snapshots)).digest('hex')});
  await page.eval('__simulationWorker.terminate()');console.log('PASS exact worker simulation, paint and audio commands: '+which);
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE coupled simulation worker checks passed';console.log(receipt.result+' ('+receipt.checks.length+' checks / '+cases.length*1200+' ticks)');
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{receipt.browserLogs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
