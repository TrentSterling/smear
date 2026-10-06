// Matched V17 preferred flow, V18 static regression and V19 restored motion.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
import {installWallFixture} from './wall-fixture.mjs';
const root=resolve('tools/out/wall-motion-pass/recordings');await mkdir(root,{recursive:true});
const receipt={started:new Date().toISOString(),viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-preferred-drips-comparison.mp4'};
function encode(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}
for(const label of ['preferred','before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const source=label==='preferred'?'tools/out/wall-pass/before/index.html':label==='before'?'tools/out/wall-motion-pass/before/index.html':'index.html';await copyFile(source,resolve(out,'build.html'));
 const page=await launch({port:9631,width:1280,height:960});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
  const version=await page.eval('__smear.state().then(s=>s.version)');assert.equal(version,label==='preferred'?'0.17.0':label==='before'?'0.18.0':'0.19.0');receipt.builds.push({label,version,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});await installWallFixture(page);
  for(const name of ['wall-impact','wall-drips']){
   if(name==='wall-impact')await page.eval('__wallTest.setup()');
   else await page.eval('(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.heal();await __smear.step(0);__smear.clean();__smear.tool(2);__smear.view([1.7,2.4,-4.7],[0,1.6,-8]);__smear.fly();})()');
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);__smear.manual(false);})()`);
   if(name==='wall-drips'){await page.mouse('mouseMoved',640,480);await page.mouse('mousePressed',640,480);await sleep(900);await page.mouse('mouseReleased',640,480);await sleep(11100);}else await sleep(12000);
   await page.eval('__smear.manual(true)');const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);
   const counters=await page.eval('__smearGPU.readWork().then(w=>({splats:w[29],runoff:w[26]}))');if(label==='after'&&name==='wall-impact')assert(counters.splats>0);
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=2','-t','12','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);receipt.clips.push({label,name,seconds:12,steps:state.steps,counters});console.log('Recorded '+label+'/'+name);
  }
  await writeFile(resolve(out,'clips.txt'),"file 'wall-impact.mp4'\nfile 'wall-drips.mp4'\n");encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'wall-'+label+'.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
for(const [label,title,name] of [['preferred','PREFERRED DRIPS  /  V17',receipt.comparison],['before','PREVIOUS  /  V18','smear-restored-motion-comparison.mp4']]){
 encode(['-i',resolve(root,label+'/wall-'+label+'.mp4'),'-i',resolve(root,'after/wall-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='${title}':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='SPLATS + RESTORED FLOW  /  V19':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,name)]);
}
receipt.result='COMPLETE matched preferred, previous and restored wall-motion MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
