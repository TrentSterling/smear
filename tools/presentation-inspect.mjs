import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until,sleep} from './cdp.mjs';
const label=process.argv[2]||'after',out=resolve('tools/out/presentation-pass',label);await mkdir(out,{recursive:true});
const source=label==='before'?resolve(out,'build.html'):resolve('index.html');
let html=await readFile(source,'utf8');
const instrumentation=`window.__bootPhases={};for(const key of ['artDirection','buildDummy','packWorld','packGeometry','textures','pipelines','buildBundles','resize']){const original=SmearCompute.prototype[key];SmearCompute.prototype[key]=function(...args){const start=performance.now();const result=original.apply(this,args);if(result?.then)return result.then(value=>{window.__bootPhases[key]=performance.now()-start;return value;});if(!(key in window.__bootPhases))window.__bootPhases[key]=performance.now()-start;return result;};}`;
html=html.replace('computeBoot().catch(computeFailure);',instrumentation+'computeBoot().catch(computeFailure);');
await writeFile(resolve(out,'inspection.html'),html,'utf8');
const page=await launch({port:9617,width:1920,height:1080});
const receipt={label,startedAt:new Date().toISOString(),browserProfile:page.dir};
const watchdog=setTimeout(()=>{page.kill();process.exit(1);},120000);
try{
 await page.call('Profiler.enable');await page.call('Profiler.start');
 await page.goto(pathToFileURL(resolve(out,'inspection.html')).href);
 await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:60000});
 receipt.readyMS=await page.eval('performance.now()');receipt.phases=await page.eval('__bootPhases');
 const {profile}=await page.call('Profiler.stop');await writeFile(resolve(out,'startup.cpuprofile'),JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();profile.samples.forEach((id,i)=>times.set(id,(times.get(id)||0)+profile.timeDeltas[i]));
 receipt.hotspots=[...times].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([id,time])=>({function:nodes.get(id).callFrame.functionName,line:nodes.get(id).callFrame.lineNumber+1,ms:time/1000}));
 await page.eval('__smear.tool(1);__smear.pointer(960,540)');await sleep(200);await page.eval('__smear.manual(true)');
 receipt.dummy=await page.eval('__smearGPU.dummy');await page.shot(resolve(out,'pistol.png'));
 receipt.geometryHashes=await page.eval(`(async()=>{const result={};for(const role of [5,6]){const g=__smearGPU.renderObjects.find(o=>o.role===role).object.geometry;for(const [name,a]of Object.entries({...g.attributes,index:g.index})){const hash=await crypto.subtle.digest('SHA-256',a.array);result[role+':'+name]=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}}return result;})()`);
 if(label!=='before'){
  receipt.checks=[];
  await page.eval('__smear.manual(false)');await page.eval(`(async()=>{__smear.shoot();await new Promise(requestAnimationFrame);__smear.manual(true);})()`);
  const fire=await page.eval('({flash:__smearGPU.flash.visible,slide:__smearGPU.slide.position.z})');assert(fire.flash&&fire.slide>0);receipt.checks.push('Live muzzle flash and slide recoil');await page.shot(resolve(out,'firing.png'));
  await page.eval('__smear.manual(false)');await sleep(200);assert.equal(await page.eval('__smearGPU.flash.visible'),false);
  await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'l',code:'KeyL',windowsVirtualKeyCode:76});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'l',code:'KeyL',windowsVirtualKeyCode:76});
  await until(()=>page.eval('!!document.pointerLockElement'),{timeout:3000,label:'FPS mouse lock'});
  await page.call('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'right',buttons:2,clickCount:1});await sleep(500);
  receipt.aim=await page.eval('({x:__smearGPU.gun.position.x,fov:__smearGPU.camera.fov})');assert(Math.abs(receipt.aim.x)<.005);await page.shot(resolve(out,'aiming.png'));receipt.checks.push('FPS right-mouse aiming centers the pistol');
  await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'right',buttons:0,clickCount:1});await page.eval('document.exitPointerLock()');
  await page.eval('__smear.tool(2)');await sleep(250);await page.eval('__smear.manual(true)');assert.equal(await page.eval('__smearGPU.spillCan.visible&&!__smearGPU.gun.visible'),true);await page.shot(resolve(out,'spill.png'));receipt.checks.push('Spill bottle replaces the pistol');
  await page.eval('__smear.tool(0);__smear.manual(false)');await sleep(150);assert.equal(await page.eval('!__smearGPU.spillCan.visible&&!__smearGPU.gun.visible'),true);receipt.checks.push('Grab hides both first-person models');
  await page.eval('__smear.tool(1);__smear.view([0,1.7,-7.80],[0,1.7,-8.8])');await sleep(150);await page.eval('__smear.manual(true)');await page.shot(resolve(out,'near-wall.png'));
  const gpu=await page.eval('__smear.compute.state()');assert.deepEqual(gpu.errors,[]);assert.equal(gpu.normalPaintReadbacks,0);receipt.checks.push('No GPU errors or normal-play pigment readback');
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);
 console.log(JSON.stringify({readyMS:receipt.readyMS,phases:receipt.phases,hotspots:receipt.hotspots},null,2));
 receipt.result='COMPLETE startup and presentation inspection';
}catch(e){receipt.error=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(watchdog);await writeFile(resolve(out,'inspection.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
