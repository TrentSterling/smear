import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {inflateSync} from 'node:zlib';
const firefox=process.argv[2]==='firefox',out=resolve('tools/out',firefox?'worker-verify-firefox':'worker-verify');await mkdir(out,{recursive:true});
const source=(await readFile('index.html','utf8')).replace('return{register,remove,draw,pump,flush,status,snapshotCanvas,','return{failover:fallback,register,remove,draw,pump,flush,status,snapshotCanvas,');
const fixture=`let qaGPUReads=0;const qaReadPixels=renderer.getContext().readPixels.bind(renderer.getContext());renderer.getContext().readPixels=(...args)=>{qaGPUReads++;return qaReadPixels(...args);};const workerQA={gpuReads:()=>qaGPUReads,fail:()=>paintEngine.failover('QA worker failure'),
 restore:()=>new Promise((resolve,reject)=>{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return reject(Error('Context loss extension unavailable'));canvas.addEventListener('webglcontextrestored',()=>{renderNow();resolve();},{once:true});canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>ext.restoreContext(),100),{once:true});ext.loseContext();}),
 pixels:async()=>{const arrays=surfaces.map(s=>s.g.getImageData(0,0,s.canvas.width,s.canvas.height).data),stream=new Blob(arrays).stream().pipeThrough(new CompressionStream('deflate')),bytes=new Uint8Array(await new Response(stream).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);},
 spam:(n=4200)=>{for(let i=0;i<n;i++)tileMap.get('1,1').splatUV(2,2,.015,.01,0,1,5000+i,0);renderNow();},
};`;
const file=resolve(out,'runtime.html');await writeFile(file,source.replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={workerQA,state,'));
const page=firefox?await launchFirefox({port:9595,width:1280,height:720}):await launch({port:9597,width:1280,height:720}),receipt={checks:[]};
const pass=(name,fn)=>{fn();receipt.checks.push(name);console.log('PASS '+name);};
async function boot(sync=false){await page.goto(pathToFileURL(file).href+(sync?'?paintSync=1':''));await until(()=>page.eval('!!window.__smear'),{label:'paint lifecycle boot'});await page.eval(`(async()=>{__smear.manual(true);__smear.tune({walking:false,recover:false});__smear.reset();await __smear.paintReady();})()`);}
const cases=[
 ['graphics context restoration retains pigment',`a.puddle([0,0,0],.7);a.bodyPaint(0,'Torso',[0,0,1],.8);a.render();await a.paintReady(false);await a.workerQA.restore();a.render();`],
 ['clear while paint is in flight',`a.puddle([0,0,0],.7);a.render();a.clean();a.puddle([2,0,2],.35);a.render();`],
 ['body removal while paint is in flight',`a.bodyPaint(0,'Torso',[0,0,1],1);a.render();a.reset();a.bodyPaint(0,'Head',[1,0,0],.5);a.puddle([-1,0,1],.4);a.render();`],
 ['wash while paint is in flight',`a.bodyPaint(0,'Torso',[0,0,1],1);a.render();a.wash();a.bodyPaint(0,'Torso',[0,1,0],.3);a.render();`],
 ['worker failure with outstanding paint',`a.puddle([0,0,0],.5);a.render();await a.paintReady(false);a.puddle([1,0,1],.35);a.render();a.puddle([-1,0,-1],.3);a.workerQA.fail();a.render();`],
 ['bounded overload preserves paint',`a.workerQA.spam();`],
 ['overload followed by clear while recovering',`a.workerQA.spam();a.clean();a.puddle([2,0,2],.35);a.render();`],
 ['overload followed by worker restart and more paint',`a.puddle([-1,0,-1],.5);a.render();await a.paintReady(false);a.workerQA.spam();await a.paintReady(false);a.puddle([1,0,1],.45);a.render();`],
 ['second overload after restarted worker painted',`a.workerQA.spam();await a.paintReady(false);a.puddle([1,0,1],.45);a.render();await a.paintReady(false);a.workerQA.spam();`],
 ['graphics loss during overload recovery',`a.puddle([-1,0,-1],.5);a.render();await a.paintReady(false);a.workerQA.spam();await a.workerQA.restore();a.render();`],
 ['overload recovery remains bounded during a 12000-event burst',`a.workerQA.spam(12000);`],
];
try{
 for(const [name,setup]of cases){const results=[];for(const sync of [true,false]){await boot(sync);await page.eval(`(async()=>{const a=__smear;${setup}await a.paintReady();a.render();})()`);
  const data=await page.eval(`(async()=>{const a=__smear,s=a.state();delete s.renderer;delete s.stats.physicsMS;delete s.stats.frameMS;delete s.stats.paintUploads;return{state:s,status:a.paintStatus(),gpuReads:a.workerQA.gpuReads(),pixels:await a.workerQA.pixels(),gl:document.getElementById('world').getContext('webgl2').getError()};})()`);data.pixels=inflateSync(Buffer.from(data.pixels,'base64'));results.push(data);}
  const [b,a]=results;pass(name+': exact simulation and wet transfer',()=>assert.deepEqual(a.state,b.state));
  assert.equal(a.pixels.length,b.pixels.length);let mismatches=0,max=0;for(let i=0;i<a.pixels.length;i+=4){let d=Math.abs(a.pixels[i+3]-b.pixels[i+3]);for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a.pixels[i+c]*a.pixels[i+3]/255-b.pixels[i+c]*b.pixels[i+3]/255));max=Math.max(max,d);if(d>2)mismatches++;}
  pass(name+': all retained pigment preserved',()=>assert.equal(mismatches,0,'max delta '+max));
  pass(name+': no GPU errors and bounded resources',()=>{assert.equal(a.gl,0);assert.equal(a.status.queued,0);assert.equal(a.status.inFlight,0);assert(a.status.maxQueued<=4096);assert((a.status.maxRecoveryPending||0)<=8192);assert(a.status.canvases<=260);});
  if(firefox)pass(name+': zero synchronous GPU pigment readbacks',()=>assert.equal(a.gpuReads,0));
  if(name.includes('failure')||name.includes('overload'))pass(name+': explicit completed recovery',()=>{assert.equal(a.status.recoveryPending||0,0);if(firefox&&name.includes('overload')&&!name.includes('second overload')){assert.equal(a.status.backend,'OffscreenCanvas worker');assert.equal(a.status.restarts,1);}else assert.equal(a.status.backend,'Canvas2D fallback');});
  else pass(name+': worker retained',()=>assert.equal(a.status.backend,'OffscreenCanvas worker'));
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));pass('no lifecycle browser errors',()=>assert.deepEqual(receipt.errors,[]));receipt.result='COMPLETE worker lifecycle checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
