import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {launch,until,sleep} from './cdp.mjs';
import {decodeCanvasPNG} from './png-pixels.mjs';
const out=resolve('tools/out/startup-v45/lights');fs.mkdirSync(out,{recursive:true});
const page=await launch({port:9676,width:1920,height:1080});
const receipt={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),browserProfile:page.dir,checks:[]};
const check=text=>{receipt.checks.push(text);console.log('PASS '+text);};
const tap=async code=>{for(const type of ['keyDown','keyUp'])await page.call('Input.dispatchKeyEvent',{type,code,key:code==='Escape'?'Escape':code.slice(-1).toLowerCase(),windowsVirtualKeyCode:code==='Escape'?27:code.charCodeAt(code.length-1)});};
try{
 await page.goto(pathToFileURL(resolve('index.html')).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
 await page.eval(`__smear.manual(true);__smear.fly();__smearGPU.bodyCount=0;__smearGPU.syncCounts();
 for(let id=0;id<16;id++){const g=__smearGPU,r=g.records[id],s=g.surfaces[id],a=new Uint32Array(r.filmWidth*r.filmHeight);for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);const edge=1-(p.x*p.x/28+(p.z-1.8)**2/24);a[x+y*r.filmWidth]=Math.round(Math.max(0,Math.min(.5,edge))*65536);}g.device.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+r.filmOffset)*4,a);}
 __smear.view([5,2.7,7],[0,2,1.4]);`);
 receipt.poses=[];
 for(const time of [0,4.5,9]){
  const pose=await page.eval(`(async()=>{const g=__smearGPU;g.steps=${time*120};g.submit(0);const d=g.device,b=g.buffer('explicit moving light coordinates',160,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();g.movingLights.forEach((l,i)=>e.copyBufferToBuffer(g.constantBuffer,l.offset,b,i*80,80));d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const data=new Float32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();return g.movingLights.map((l,i)=>{const o=g.renderObjects.find(o=>o.object.userData.ltcEmitter===l.name).object,p=o.geometry.attributes.position;const vertices=Array.from({length:4},(_,k)=>new g.THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(o.matrixWorld).toArray());return{name:l.name,vertices,shader:Array.from({length:4},(_,k)=>Array.from(data.slice(i*20+k*4,i*20+k*4+3)))};});})()`);
  for(const light of pose)for(let k=0;k<4;k++)assert(Math.hypot(...light.vertices[k].map((v,j)=>v-light.shader[k][j]))<.000002);
  receipt.poses.push({time,lights:pose});await page.shot(resolve(out,'rig-'+time+'.png'));
 }
 assert(Math.hypot(...receipt.poses[0].lights[0].vertices[0].map((v,i)=>v-receipt.poses[1].lights[0].vertices[0][i]))>2);
 check('Moving fixture vertices match the actual GPU LTC polygon buffer at three poses');
 receipt.reflection={};
 for(const strength of [0,1]){
  const shots=[];for(const time of [0,4.5]){const uri=await page.eval(`(async()=>{const g=__smearGPU;g.ltcStrength=${strength};g.steps=${time*120};g.submit(0);await g.device.queue.onSubmittedWorkDone();return g.canvas.toDataURL('image/png');})()`);shots.push(decodeCanvasPNG(uri));}
  let delta=0,n=0;for(let y=810;y<1026;y++)for(let x=576;x<1344;x++)for(let k=0;k<3;k++){const i=(y*1920+x)*4+k;delta+=Math.abs(shots[0].pixels[i]-shots[1].pixels[i]);n++;}receipt.reflection[strength]=delta/n;
 }
 assert(receipt.reflection[1]>.1,JSON.stringify(receipt.reflection));assert(receipt.reflection[0]<.001,JSON.stringify(receipt.reflection));
 check('Wet-floor pixels change with moving LTC lighting and stay identical with LTC disabled');
 await page.eval('__smearGPU.ltcStrength=1;__smearGPU.steps=0;__smear.manual(false);__smear.controls.mode("fps")');const enter=await page.eval(`(()=>{const r=document.getElementById('play-resume').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await page.mouse('mousePressed',enter.x,enter.y);await page.mouse('mouseReleased',enter.x,enter.y);await until(()=>page.eval('document.pointerLockElement!==null'));await sleep(250);
 const measure=async()=>{const a=await page.eval('__smearGPU.steps');await sleep(1000);return (await page.eval('__smearGPU.steps'))-a;};
 const normal=await measure();await tap('KeyT');const slow=await measure();await tap('KeyT');
 assert(normal>90&&slow>20&&slow/normal>.20&&slow/normal<.32,{normal,slow});receipt.ticks={normal,slow};
 await tap('Escape');await until(()=>page.eval('__smear.controls.state().paused'));await page.eval('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const paused=await page.eval('({steps:__smearGPU.steps,matrix:__smearGPU.lightRig.matrixWorld.elements})');await sleep(350);assert.deepEqual(await page.eval('({steps:__smearGPU.steps,matrix:__smearGPU.lightRig.matrixWorld.elements})'),paused);
 check('Native slow motion runs the lights at quarter speed and Escape freezes the fixture');
 const resume=await page.eval(`(()=>{const r=document.getElementById('play-resume').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await page.mouse('mousePressed',resume.x,resume.y);await page.mouse('mouseReleased',resume.x,resume.y);await until(()=>page.eval('!__smear.controls.state().paused'));
 if(process.argv.includes('record')){
  await page.eval(`(()=>{window.__chunks=[];const tap=__smear.compute.audioTap();window.__stream=new MediaStream([...__smearGPU.canvas.captureStream(30).getVideoTracks(),...tap.stream.getAudioTracks()]);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);})()`);
  await sleep(10000);const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop());};__recorder.stop();})`);fs.writeFileSync(resolve(out,'moving-ltc.webm'),Buffer.from(data,'base64'));
  const result=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',resolve(out,'moving-ltc.webm'),'-vf','fps=30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',resolve(out,'moving-ltc.mp4')],{encoding:'utf8',windowsHide:true,timeout:120000});assert.ifError(result.error);assert.equal(result.status,0,result.stderr);receipt.video='moving-ltc.mp4';receipt.audio=await page.eval('__smear.compute.audio()');assert(receipt.audio.enabled&&receipt.audio.state==='running');
 }
 assert.deepEqual(await page.eval('__smearGPU.errors'),[]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);receipt.result='COMPLETE moving LTC fixture and reflection checks';console.log(receipt.result);
}catch(e){receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}
finally{await fs.promises.writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
