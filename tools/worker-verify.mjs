import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {inflateSync} from 'node:zlib';
const firefox=process.argv[2]==='firefox',bitmap=process.argv[2]==='bitmap',workerCount=bitmap?1:4,out=resolve('tools/out',firefox?'worker-verify-firefox':bitmap?'worker-verify-bitmap':'worker-verify');await mkdir(out,{recursive:true});
const source=(await readFile('index.html','utf8'))
 .replace('function apply(slot,deadline){','function apply(slot,deadline,maxPatches=Infinity){')
 .replace('if(performance.now()>=deadline)return;','if(performance.now()>=deadline||maxPatches--<=0)return;')
 .replace('return{register,remove,draw,pump,flush,status,snapshotCanvas,',`return{failover:fallback,partialPresent:async()=>{if(!enabled)return;for(let i=0;i<300;i++){const slot=workers.find(s=>s.completed?.patches.length>1);if(slot){const before=slot.completed.patches.length,ops=slot.busy.ops.length;apply(slot,Infinity,1);window.qaPartial={before,after:slot.completed.patches.length-slot.completed.head,removedOps:ops-slot.busy.ops.length};return;}await new Promise(r=>setTimeout(r,8));}throw Error('No multi-record worker result available');},register,remove,draw,pump,flush,status,snapshotCanvas,`);
const fixture=`let qaGPUReads=0;const qaReadPixels=renderer.getContext().readPixels.bind(renderer.getContext());renderer.getContext().readPixels=(...args)=>{qaGPUReads++;return qaReadPixels(...args);};const workerQA={gpuReads:()=>qaGPUReads,fail:()=>paintEngine.failover('QA worker failure'),
 restore:()=>new Promise((resolve,reject)=>{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return reject(Error('Context loss extension unavailable'));canvas.addEventListener('webglcontextrestored',()=>{renderNow();resolve();},{once:true});canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>ext.restoreContext(),100),{once:true});ext.loseContext();}),
 pixels:async()=>{const arrays=[...surfaces,...bodies.filter(b=>b.skinPaint).map(b=>b.skinPaint)].map(s=>s.g.getImageData(0,0,s.canvas.width,s.canvas.height).data),stream=new Blob(arrays).stream().pipeThrough(new CompressionStream('deflate')),bytes=new Uint8Array(await new Response(stream).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);},
 spam:(n=4200)=>{for(let i=0;i<n;i++)tileMap.get('1,1').splatUV(2,2,.015,.01,0,1,5000+i,0);renderNow();},
 partial:async()=>{for(const s of tileMap.values())for(let i=0;i<3;i++)s.splatUV(1+i*.2,1,.12,.6,0,1,6000+i,0);renderNow();await paintEngine.partialPresent();},
 swarm:()=>{const tiles=Array.from(tileMap.values());for(let i=0;i<1800;i++)tiles[i%tiles.length].splatUV(1+(i%7)*.1,1+(i%11)*.1,.015,.01,0,1,8000+i,0);for(const b of dolls[0].parts)wetBody(b,new V(0,0,1),.7,new V(0,0,b.half.z),.15);renderNow();window.qaSwarm=paintEngine.status();for(let i=0;i<4200;i++)tiles[i%tiles.length].splatUV(1+(i%13)*.1,1+(i%5)*.1,.015,.01,0,1,10000+i,0);renderNow();},
};`;
const file=resolve(out,'runtime.html');await writeFile(file,source.replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={workerQA,state,'));
const page=firefox?await launchFirefox({port:9595,width:1280,height:720}):await launch({port:9597,width:1280,height:720}),receipt={checks:[],browser:firefox?'Firefox':'Chrome',transport:bitmap?'ImageBitmap':'RGBA buffers',workerCount,experimental:!firefox&&!bitmap};
const pass=(name,fn)=>{fn();receipt.checks.push(name);console.log('PASS '+name);};
async function boot(sync=false){const query=new URLSearchParams();if(!firefox&&!bitmap)query.set('paintRGBA','1');if(sync)query.set('paintSync','1');await page.goto(pathToFileURL(file).href+'?'+query);await until(()=>page.eval('!!window.__smear'),{label:'paint lifecycle boot'});await page.eval(`(async()=>{__smear.manual(true);__smear.tune({walking:false,recover:false});__smear.reset();await __smear.paintReady();})()`);}
const cases=[
 ['graphics context restoration retains pigment',`a.puddle([0,0,0],.7);a.bodyPaint(0,'Torso',[0,0,1],.8);a.render();await a.paintReady(false);await a.workerQA.restore();a.render();`],
 ['clear while paint is in flight',`a.puddle([0,0,0],.7);a.render();a.clean();a.puddle([2,0,2],.35);a.render();`],
 ['body removal while paint is in flight',`a.bodyPaint(0,'Torso',[0,0,1],1);a.render();a.reset();a.bodyPaint(0,'Head',[1,0,0],.5);a.puddle([-1,0,1],.4);a.render();`],
 ['wash while paint is in flight',`a.bodyPaint(0,'Torso',[0,0,1],1);a.render();a.wash();a.bodyPaint(0,'Torso',[0,1,0],.3);a.render();`],
 ['worker failure with outstanding paint',`a.puddle([0,0,0],.5);a.render();await a.paintReady(false);a.puddle([1,0,1],.35);a.render();a.puddle([-1,0,-1],.3);a.workerQA.fail();a.render();`],
 ['worker failure after partial pigment presentation',`await a.workerQA.partial();a.workerQA.fail();a.render();`],
 ['worker failure before restored pigment presentation',`a.puddle([0,0,0],.5);a.bodyPaint(0,'Torso',[0,0,1],.8);a.render();await a.paintReady(false);await a.workerQA.restore();a.workerQA.fail();a.puddle([1,0,1],.35);a.render();`],
 ['bounded overload preserves paint',`a.workerQA.spam();`],
 ['overload followed by clear while recovering',`a.workerQA.spam();a.clean();a.puddle([2,0,2],.35);a.render();`],
 ['overload followed by worker restart and more paint',`a.puddle([-1,0,-1],.5);a.render();await a.paintReady(false);a.workerQA.spam();await a.paintReady(false);a.puddle([1,0,1],.45);a.render();`],
 ['second overload after restarted worker painted',`a.workerQA.spam();await a.paintReady(false);a.puddle([1,0,1],.45);a.render();await a.paintReady(false);a.workerQA.spam();`],
 ['graphics loss during overload recovery',`a.puddle([-1,0,-1],.5);a.render();await a.paintReady(false);a.workerQA.spam();await a.workerQA.restore();a.render();`],
 ['overload recovery remains bounded during a 12000-event burst',`a.workerQA.spam(12000);`],
 ['overload with every worker in flight',`a.workerQA.swarm();`],
 ['overload and graphics loss with every worker in flight',`a.workerQA.swarm();await a.workerQA.restore();a.render();`],
].filter(([name])=>!process.argv[3]||name.includes(process.argv[3]));
try{
 for(const [name,setup]of cases){const results=[];for(const sync of [true,false]){await boot(sync);await page.eval(`(async()=>{const a=__smear;${setup}await a.paintReady();a.render();})()`);
  const data=await page.eval(`(async()=>{const a=__smear,s=a.state();delete s.renderer;delete s.stats.physicsMS;delete s.stats.frameMS;delete s.stats.paintUploads;return{state:s,status:a.paintStatus(),partial:window.qaPartial,swarm:window.qaSwarm,gpuReads:a.workerQA.gpuReads(),pixels:await a.workerQA.pixels(),gl:document.getElementById('world').getContext('webgl2').getError()};})()`);data.pixels=inflateSync(Buffer.from(data.pixels,'base64'));results.push(data);}
  const [b,a]=results;pass(name+': exact simulation and wet transfer',()=>assert.deepEqual(a.state,b.state));
  assert.equal(a.pixels.length,b.pixels.length);let mismatches=0,max=0;for(let i=0;i<a.pixels.length;i+=4){let d=Math.abs(a.pixels[i+3]-b.pixels[i+3]);for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a.pixels[i+c]*a.pixels[i+3]/255-b.pixels[i+c]*b.pixels[i+3]/255));max=Math.max(max,d);if(d>2)mismatches++;}
  pass(name+': all retained pigment preserved',()=>assert.equal(mismatches,0,'max delta '+max));
  pass(name+': no GPU errors and bounded resources',()=>{assert.equal(a.gl,0);assert.equal(a.status.queued,0);assert.equal(a.status.inFlight,0);assert(a.status.maxQueued<=4096);assert((a.status.maxRecoveryPending||0)<=8192);assert(a.status.canvases<=260);});
  if(!bitmap)pass(name+': zero synchronous GPU pigment readbacks',()=>assert.equal(a.gpuReads,0));
  else pass(name+': reference transport retains its bounded inspection readbacks',()=>assert(a.gpuReads<=a.status.canvases*4));
  if(name.includes('every worker'))pass(name+': all worker batches actually in flight',()=>{assert.equal(a.swarm.workerCount,workerCount);assert.equal(a.swarm.activeWorkers,a.swarm.workerCount);});
  if(name.includes('partial pigment'))pass(name+': exactly one record presented before failure',()=>{assert(a.partial.before>1);assert.equal(a.partial.after,a.partial.before-1);assert(a.partial.removedOps>0);});
  if(name.includes('failure')||name.includes('overload'))pass(name+': explicit completed recovery',()=>{assert.equal(a.status.recoveryPending||0,0);if(!bitmap&&name.includes('overload')&&!name.includes('second overload')){assert.equal(a.status.backend,'OffscreenCanvas worker');assert.equal(a.status.restarts,1);assert.equal(a.status.workerCount,workerCount);}else assert.equal(a.status.backend,'Canvas2D fallback');});
  else pass(name+': worker retained',()=>assert.equal(a.status.backend,'OffscreenCanvas worker'));
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));pass('no lifecycle browser errors',()=>assert.deepEqual(receipt.errors,[]));receipt.result='COMPLETE worker lifecycle checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
