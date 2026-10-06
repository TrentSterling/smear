// Real-time paired recordings with one shared camera path. Separate from profiling.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
const root=resolve('tools/out/motion-pass/recordings');await mkdir(root,{recursive:true});
const before=JSON.parse(await readFile('tools/out/motion-pass/before/motion.json','utf8'));
const path=before.cases.find(c=>c.name==='walk').samples.map(s=>({t:s.time,p:s.parts[16].p}));
const version=JSON.parse(await readFile('package.json','utf8')).version;
const receipt={started:new Date().toISOString(),viewport:[1280,1440],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-motion-comparison.mp4'};
function encode(args){const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});await copyFile(label==='before'?'tools/out/motion-pass/before/build.html':'index.html',resolve(out,'build.html'));
 const page=await launch({port:9616,width:1280,height:1440});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');
  await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);assert.equal(await page.eval('__smear.compute.audio().state'),'running');
  const actualVersion=await page.eval('__smear.state().then(s=>s.version)');assert.equal(actualVersion,label==='before'?'0.11.1':version);
  receipt.builds.push({label,version:actualVersion,sha256:createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex')});
  for(const [name,seconds]of [['walk',18],['recovery',10]]){
   await page.eval(`__smear.reset();__smear.tune({walking:${name==='walk'},recover:true});__smear.tool(0);__smear.step(0)`);
   if(name==='walk'){
    await page.eval('__smear.step(240)');
    await page.eval(`(()=>{window.__motionPath=${JSON.stringify(path)};window.__motionCamera=()=>{const t=__smearGPU.steps/120,a=__motionPath[Math.min(__motionPath.length-2,Math.max(0,Math.floor(t*10)-1))],b=__motionPath[Math.min(__motionPath.length-1,Math.max(1,Math.floor(t*10)))],f=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),p=a.p.map((v,i)=>v+(b.p[i]-v)*f);__smear.view([p[0]+1.8,1.5,p[2]+2.6],[p[0],.95,p[2]]);};__motionCamera();})()`);
   }else await page.eval('__smear.heal();__smear.view([2.1,1.25,2.8],[0,.80,.45]);__smear.step(0)');
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);window.__motionActive=${name==='walk'};if(__motionActive){const follow=()=>{if(!__motionActive)return;__motionCamera();requestAnimationFrame(follow);};requestAnimationFrame(follow);}__smear.manual(false);})()`);
   await sleep(seconds*1000);await page.eval('__smear.manual(true);__motionActive=false');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));
   const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=2','-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);
   receipt.clips.push({label,name,seconds,steps:state.steps,errors:state.errors});console.log('Recorded '+label+'/'+name+'.mp4');
  }
  await writeFile(resolve(out,'clips.txt'),"file 'walk.mp4'\nfile 'recovery.mp4'\n");encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'motion-'+label+'.mp4')]);
  assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
encode(['-i',resolve(root,'before/motion-before.mp4'),'-i',resolve(root,'after/motion-after.mp4'),'-filter_complex',`[0:v]scale=960:1080,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE  /  0.11.1':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:1080,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='MOTION PASS  /  ${version}':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
receipt.result='COMPLETE paired walking and recovery MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
