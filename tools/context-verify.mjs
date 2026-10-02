import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until,sleep} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
const firefox=process.argv[2]==='firefox',out=resolve('tools/out','context-'+(firefox?'firefox':'chrome'));await mkdir(out,{recursive:true});
const fixture=`const contextQA={lose:()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_lose_context');if(!e)throw Error('Context-loss extension unavailable');window.__contextRestored=false;canvas.addEventListener('webglcontextrestored',()=>{window.__contextRestored=true;window.__restoredAt=performance.now();},{once:true});canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>e.restoreContext(),180),{once:true});e.loseContext();},paint:()=>({surfaces:surfaces.map(s=>s.canvas.toDataURL()),skins:bodies.map(b=>b.skinCanvas?.toDataURL()||null)}),status:()=>({running,simTime,steps:stats.steps,environment:!!scene.environment,failure:$('failure').style.display,gl:renderer.getContext().getError()})};`;
const rafAudit=`(()=>{const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();window.__maxPendingRAF=0;window.requestAnimationFrame=fn=>{const id=raf(t=>{pending.delete(id);fn(t);});pending.add(id);__maxPendingRAF=Math.max(__maxPendingRAF,pending.size);return id;};window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};})();`;
const file=resolve(out,'runtime.html');await writeFile(file,(await readFile('index.html','utf8')).replace('</head>','<script>'+rafAudit+'</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={contextQA,state,'));
const page=firefox?await launchFirefox({width:1280,height:720}):await launch({port:9598,width:1280,height:720}),receipt={checks:[]};
function pass(name,fn){fn();receipt.checks.push(name);console.log('PASS '+name);}
try{
 await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear'),{label:'native context boot'});await sleep(500);
 for(let cycle=0;cycle<2;cycle++){
  await page.eval(`(async()=>{const a=__smear;a.manual(true);a.perf.show(true);a.puddle([2,0,2],.35);a.bodyPaint(0,'Torso',[0,0,1],.4);a.render();await a.paintReady();})()`);const before=await page.eval('__smear.contextQA.paint()');
  await page.eval('__smear.perf.clear();__smear.contextQA.lose()');await until(()=>page.eval('window.__contextRestored'),{label:'automatic context restore'});await page.eval('(async()=>{__smear.render();await __smear.paintReady();})()');const after=await page.eval('__smear.contextQA.paint()');
  pass('cycle '+cycle+': all surface and skin pigment survives restoration',()=>assert.deepEqual(after,before));
  const first=await page.eval('__smear.contextQA.status()');await page.eval('__smear.manual(false)');await sleep(500);const live=await page.eval('__smear.contextQA.status()'),profile=await page.eval('__smear.perf.report()');
  const raf=await page.eval('({max:__maxPendingRAF,restoredAt:__restoredAt})');
  pass('cycle '+cycle+': actual physics and rendering resume once',()=>{assert(live.running);assert.equal(live.failure,'none');assert(live.environment);assert(live.steps>first.steps);assert.equal(live.gl,0);assert(profile.summary.frames>0);assert(profile.frames.every(f=>f.time>=raf.restoredAt));assert.equal(raf.max,1,'exactly one outstanding animation callback');});
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));pass('no native context lifecycle errors',()=>assert.deepEqual(receipt.errors,[]));receipt.result='COMPLETE native context restoration checks passed';console.log(receipt.result);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
