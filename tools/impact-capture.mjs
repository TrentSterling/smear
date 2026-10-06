// Identical clean 15-part launch states; all subsequent movement/painting uses
// the shipping GPU simulation at native speed. Capture is separate from profiling.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';import {installImpactFixture} from './impact-fixture.mjs';
const root=resolve('tools/out/impact-pass/recordings');await mkdir(root,{recursive:true});
const receipt={started:new Date().toISOString(),viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-v27-v28-impacts.mp4'};
function encode(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const source=label==='before'?'tools/out/impact-pass/before/index.html':'index.html';await copyFile(source,resolve(out,'build.html'));
 const page=await launch({port:9684,width:1280,height:960});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2));
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});await installImpactFixture(page);
  const version=await page.eval('__smear.state().then(s=>s.version)');assert.equal(version,label==='before'?'0.27.0':'0.28.0');receipt.builds.push({label,version,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
  for(const pose of ['head','body']){
   await page.eval(`__impactTest.setup({pose:'${pose}',speed:12})`);
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);})()`);
   await sleep(650);await page.eval('__smear.manual(false)');await sleep(17400);await page.eval('__smear.manual(true)');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,pose+'.webm'),Buffer.from(data,'base64'));const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);assert.equal(state.tileOverflow,0);receipt.clips.push({label,pose,seconds:18,steps:state.steps,launch:{speed:12,coat:0,wounds:0,reserve:9}});
   const caption=(label==='before'?'V27':'V28')+'  /  CLEAN '+(pose==='head'?'HEAD':'BODY')+' FIRST  /  12 M/S';
   encode(['-i',resolve(out,pose+'.webm'),'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=2,drawtext=font=Arial:text='${caption}':x=24:y=h-45:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8`,'-t','18','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,pose+'.mp4')]);console.log('Recorded '+label+'/'+pose);
  }
  await writeFile(resolve(out,'clips.txt'),"file 'head.mp4'\nfile 'body.mp4'\n");encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'impact-'+label+'.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2));}
}
encode(['-i',resolve(root,'before/impact-before.mp4'),'-i',resolve(root,'after/impact-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE  /  V27':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='VELOCITY IMPACT SPLATS  /  V28':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
for(const [name,seconds]of [['head-impact',.9],['head-drain',17],['body-impact',18.9],['body-drain',35]])encode(['-ss',String(seconds),'-i',resolve(root,receipt.comparison),'-frames:v','1',resolve(root,name+'-review.png')]);
receipt.result='COMPLETE matched V27/V28 clean impact MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
