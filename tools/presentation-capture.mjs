// Matched real-time tool captures. Run separately from performance profiling.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
const root=resolve('tools/out/presentation-pass/recordings');await mkdir(root,{recursive:true});
const version=JSON.parse(await readFile('package.json','utf8')).version;
const receipt={startedAt:new Date().toISOString(),viewport:[1920,1080],browsers:[],builds:[],clips:[],output:'smear-presentation-comparison.mp4'};
const encode=args=>{const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);};
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});await copyFile(label==='before'?'tools/out/presentation-pass/before/build.html':'index.html',resolve(out,'build.html'));
 const page=await launch({port:9618,width:1920,height:1080});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:60000});
  await page.mouse('mousePressed',960,190);await page.mouse('mouseReleased',960,190);assert.equal(await page.eval('__smear.compute.audio().state'),'running');
  const actualVersion=await page.eval('__smear.state().then(s=>s.version)');assert.equal(actualVersion,label==='before'?'0.12.0':version);receipt.builds.push({label,version:actualVersion,sha256:createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex')});
  for(const name of ['pistol','spill','near-wall']){
   await page.eval('__smear.manual(true);__smear.reset();__smear.tune({walking:false,recover:false});__smear.step(1)');
   await page.eval(`__smear.tool(${name==='spill'?2:1});__smear.pointer(960,540);__smear.manual(false)`);await sleep(300);
   if(name==='near-wall')await page.eval('__smear.view([0,1.7,-7.80],[0,1.7,-8.8])');
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:16000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data);};__recorder.start(1000);})()`);
   await sleep(1800);
   if(name==='pistol'){const p=await page.eval('__smear.project(1,"Torso")');await page.eval(`__smear.pointer(${p.x},${p.y});window.__fireLoop=setInterval(()=>__smear.shoot(),500)`);}
   if(name==='spill')await page.mouse('mousePressed',960,520);
   await sleep(4200);await page.eval('clearInterval(window.__fireLoop);__smear.manual(true)');if(name==='spill')await page.mouse('mouseReleased',960,520);
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop());};__recorder.stop();})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'.png'));
   const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert(state.steps>650);receipt.clips.push({label,name,seconds:6,steps:state.steps});
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=1','-t','6','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',resolve(out,name+'.mp4')]);console.log('Recorded '+label+'/'+name);
  }
  await writeFile(resolve(out,'clips.txt'),"file 'pistol.mp4'\nfile 'spill.mp4'\nfile 'near-wall.mp4'\n");encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy',resolve(out,'presentation.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
encode(['-i',resolve(root,'before/presentation.mp4'),'-i',resolve(root,'after/presentation.mp4'),'-filter_complex',`[0:v]scale=960:540,pad=960:600:0:60:color=0x14282c,drawtext=font=Arial:text='BEFORE  /  0.12.0':x=24:y=18:fontsize=24:fontcolor=white[a];[1:v]scale=960:540,pad=960:600:0:60:color=0x14282c,drawtext=font=Arial:text='TOOLS PASS  /  ${version}':x=24:y=18:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.output)]);
receipt.result='COMPLETE paired first-person MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
