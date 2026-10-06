// Matched model review recordings. GPU performance is measured in separate runs.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
const refined=process.argv.includes('--refined'),finish=process.argv.includes('--finish'),full=process.argv.includes('--full'),root=resolve('tools/out/dummy-pass',full?'full-review':finish?'finish':refined?'refinement':'');await mkdir(root,{recursive:true});
const version=JSON.parse(await readFile('package.json','utf8')).version,beforeVersion=finish?'0.13.0':refined?'0.11.0':'0.10.0';
const receipt={started:new Date().toISOString(),beforeVersion,afterVersion:version,viewport:[1280,1440],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-dummy-comparison.mp4'};
function encode(args){const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const build=label==='before'?resolve('tools/out/dummy-pass',finish?'v13-checkpoint/build.html':refined?'v11-checkpoint/build.html':'before.html'):resolve('index.html');await copyFile(build,resolve(out,'build.html'));
 const page=await launch({port:9614,width:1280,height:1440});
 receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000,label:'dummy capture boot'});
  const actualVersion=await page.eval('__smear.state().then(s=>s.version)');assert.equal(actualVersion,label==='before'?beforeVersion:version);
  receipt.builds.push({label,version:actualVersion,sha256:createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);assert.equal(await page.eval('__smear.compute.audio().state'),'running');
  async function clip(name,seconds,setup,live=true){
   await page.eval(setup);await page.shot(resolve(out,name+'-start.png'));
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);${live?'__smear.manual(false);':''}})()`);
   if(name==='orbit')await page.eval(`(()=>{const start=performance.now();window.__orbitDone=false;const frame=now=>{const t=Math.min(1,(now-start)/12000),a=t*Math.PI*2;__smear.view([-2.4+Math.sin(a)*2.1,1.05,-2.95+Math.cos(a)*2.1],[-2.4,1,-2.95]);if(t<1)requestAnimationFrame(frame);else __orbitDone=true;};requestAnimationFrame(frame);})()`);
   await sleep(seconds*1000);if(name==='orbit')await until(()=>page.eval('__orbitDone'),{timeout:5000});await page.eval('__smear.manual(true)');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));
   const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=2','-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);
   receipt.clips.push({label,name,seconds,steps:state.steps,errors:state.errors});console.log('Recorded '+label+'/'+name+'.mp4');
  }
  await clip('orbit',12,`(async()=>{__smear.reset();__smear.tune({walking:false});__smear.tool(0);await __smear.step(1);const g=__smearGPU,a=new Float32Array(180*104);for(let i=0;i<g.sourceBodies.length;i++){const b=g.sourceBodies[i];a.set([...b.restP.toArray().map((v,k)=>v+(k===0?b.doll.spawn.x:k===2?b.doll.spawn.z:0)),b.im],i*104);a.set(b.restQ.toArray(),i*104+4);}g.device.queue.writeBuffer(g.bodyBuffer,0,a);__smear.view([-2.4,1.05,-.85],[-2.4,1,-2.95]);await g.device.queue.onSubmittedWorkDone();})()`,false);
  await clip('walk',12,'__smear.reset();__smear.tune({walking:true});__smear.view([1.8,2.4,4.3],[-1,1,-3]);__smear.tool(0);__smear.step(1)');
  await clip('drag',10,'__smear.reset();__smear.tune({walking:true});__smear.demo();__smear.step(1)');
  await writeFile(resolve(out,'clips.txt'),"file 'orbit.mp4'\nfile 'walk.mp4'\nfile 'drag.mp4'\n");
  encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'dummy-'+label+'.mp4')]);
  assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
encode(['-i',resolve(root,'before/dummy-before.mp4'),'-i',resolve(root,'after/dummy-after.mp4'),'-filter_complex',`[0:v]scale=960:1080,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE  /  ${beforeVersion}':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:1080,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='SDF DUMMY  /  ${version}':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
receipt.result='COMPLETE before/after orbit, walk and drag MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
