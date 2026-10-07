import fs from 'node:fs';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
const out=resolve('tools/out/showcase-pass/recordings');fs.mkdirSync(out,{recursive:true});const receipt={at:new Date().toISOString(),clips:[]};
function encode(args){const p=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',windowsHide:true,timeout:120000});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);}
async function start(page){await page.eval(`(()=>{window.__chunks=[];const tap=__smear.compute.audioTap();window.__stream=new MediaStream([...__smearGPU.canvas.captureStream(30).getVideoTracks(),...tap.stream.getAudioTracks()]);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);__smear.manual(false);})()`);}
async function finish(page,name){await page.eval('__smear.manual(true)');const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop());};__recorder.stop();})`);fs.writeFileSync(resolve(out,name+'.webm'),Buffer.from(data,'base64'));encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(out,name+'.mp4')]);}
for(const label of ['before','after']){
 const build=label==='before'?'tools/out/showcase-pass/before/index.html':'index.html';
 for(const scene of ['machine','lighting','rockets']){
  const page=await launch({port:9781,width:1600,height:1000,headless:true});const name=label+'-'+scene,clip={name,profile:page.dir,buildSHA256:createHash('sha256').update(fs.readFileSync(build)).digest('hex')};receipt.clips.push(clip);
  try{
   await page.goto(pathToFileURL(resolve(build)).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.controls.mode("cursor");__smear.manual(true)');await page.mouse('mousePressed',800,140);await page.mouse('mouseReleased',800,140);
   await page.eval('(async()=>{await __smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.fly();})()');
   if(scene==='machine'){
    await page.eval('__smear.utility.build();__smear.manual(true);__smear.tool(0);__smear.view([-.3,3.4,6.9],[.1,.65,1.1])');await start(page);await sleep(1200);await page.eval('__smear.utility.run()');await sleep(750);await page.shot(resolve(out,name+'-burst.png'));await sleep(2200);await page.eval('__smear.view([1.6,2.5,4.3],[.1,.25,1.1])');await sleep(2500);
   }else if(scene==='lighting'){
    // Use ordinary Spill simulation to prepare the same wet scene in both builds.
    await page.eval('(async()=>{for(const p of [[-2,0,2],[0,0,2],[-2,0,4]]){__smear.view([p[0],1.68,p[2]+1.5],p);__smear.pointer(800,500);for(let i=0;i<14;i++){__smearGPU.spill();__smearGPU.submit(2);}await __smear.step(90);}__smear.tool(0);})()');
    await start(page);for(let i=0;i<100;i++){const a=i/99;await page.eval('__smear.view('+JSON.stringify([4-a*.6,1.15,6-a*.2])+','+JSON.stringify([0,.05,2])+')');await sleep(35);}await page.shot(resolve(out,name+'-wet.png'));await page.eval('__smear.view([1.7,1.8,4.7],[0,4.3,1.6])');await sleep(1700);await page.shot(resolve(out,name+'-fixtures.png'));await page.eval('__smear.view([-1,1.7,3.8],[7.9,2.8,0])');await sleep(1700);
   }else{
    await page.eval('__smear.view([-4.1,1.68,1.0],[-6.45,.7,-1.8]);__smear.pointer(800,500);__smear.tool(5)');await start(page);await sleep(650);await page.shot(resolve(out,name+'-pose.png'));await page.mouse('mousePressed',800,500);await sleep(1750);await page.mouse('mouseReleased',800,500);await sleep(1200);await page.eval('__smear.view([-3.6,2.1,.3],[-6.4,.2,-1.8])');await sleep(1700);
   }
   await page.shot(resolve(out,name+'-end.png'));await finish(page,name);clip.audio=await page.eval('__smear.compute.audio()');assert(clip.audio.enabled&&clip.audio.state==='running');assert.deepEqual((await page.eval('__smear.state()')).errors,[]);assert(!page.logs.some(s=>/^error:|^EXCEPTION:/.test(s)));console.log('Recorded '+name);
  }finally{clip.logs=page.logs;page.kill();fs.writeFileSync(resolve(out,'capture.json'),JSON.stringify(receipt,null,2));}
 }
}
for(const scene of ['machine','lighting','rockets'])encode(['-i',resolve(out,'before-'+scene+'.mp4'),'-i',resolve(out,'after-'+scene+'.mp4'),'-filter_complex',"[0:v]scale=800:500,setpts=PTS-STARTPTS,drawtext=font=Arial:text='V37.1':x=18:y=18:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7[a];[1:v]scale=800:500,setpts=PTS-STARTPTS,drawtext=font=Arial:text='V38':x=18:y=18:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7[b];[a][b]hstack=inputs=2:shortest=1[v];[0:a]pan=stereo|c0=c0|c1=0*c0[al];[1:a]pan=stereo|c0=0*c0|c1=c0[ar];[al][ar]amix=inputs=2:normalize=0[a]",'-map','[v]','-map','[a]','-shortest','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(out,'compare-'+scene+'.mp4')]);
receipt.passed=true;fs.writeFileSync(resolve(out,'capture.json'),JSON.stringify(receipt,null,2));console.log('COMPLETE V37.1/V38 matched gameplay footage');
