// Matched native-time throw inputs and weapon resets, separate from profiling.
import fs from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';import {installMomentumFixture} from './momentum-fixture.mjs';
const root=resolve('tools/out/momentum-pass/recordings');fs.mkdirSync(root,{recursive:true});
const scenes=[['torso',5,'LARGE TORSO FLICK - RELEASE AND WALL IMPACT'],['head',5,'STRETCHED HEAD FLICK - FOLLOW THROUGH'],['pistol',3,'SHOOT THEN CHAOS - FLASH AND COOLDOWN RESET']];
const receipt={started:new Date().toISOString(),viewport:[1280,960],browsers:[],builds:[],clips:[],comparison:'smear-v30-v31-momentum-and-pistol.mp4'};
function encode(args){const r=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8',timeout:120000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}
function save(){fs.writeFileSync(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');}
for(const label of ['before','after']){
 const out=resolve(root,label);fs.mkdirSync(out,{recursive:true});const source=label==='before'?'tools/out/momentum-pass/before/index.html':'index.html';fs.copyFileSync(source,resolve(out,'build.html'));
 const page=await launch({port:9694,width:1280,height:960});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});save();
 try{
  await page.init(`(()=>{const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(dest,...a){if(dest instanceof AudioDestinationNode)window.__qaMaster=this;return connect.call(this,dest,...a);};})()`);
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});await installMomentumFixture(page);
  const version=await page.eval('__smear.state().then(s=>s.version)');receipt.builds.push({label,version,sha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex')});
  for(const [name,seconds,caption]of scenes){
   if(name==='pistol'){
    await page.eval('(async()=>{__smear.manual(true);__smear.reset();__smear.tool(1);await __smear.step(0);__smearGPU.steps=2400;__smear.pointer(640,510);__smear.manual(false);})()');await sleep(100);await page.eval('__smear.manual(true)');
   }else{
    await page.eval(`__momentum.setup('${name==='torso'?'Torso':'Head'}')`);
    await page.eval('Object.assign(__smearGPU.input().tune,{damage:1,bleeding:1.35});__smear.view([0,3.4,6],[0,2.5,-4])');
   }
   await page.eval(`(()=>{window.__chunks=[];window.__video=__smearGPU.canvas.captureStream(30);window.__tap=__qaMaster.context.createMediaStreamDestination();__qaMaster.connect(__tap);window.__stream=new MediaStream([...__video.getVideoTracks(),...__tap.stream.getAudioTracks()]);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:14000000,audioBitsPerSecond:192000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);})()`);
   await page.eval('(async()=>{__smear.render();await __smearGPU.device.queue.onSubmittedWorkDone();__video.getVideoTracks()[0].requestFrame();})()');await sleep(500);
   if(name==='pistol')await page.eval('__smear.manual(false);__smear.shoot();__smear.chaos()');
   else await page.eval(`(()=>{const g=__smearGPU,submit=g.submit.bind(g),p=[...__momentum.target];let frame=0;window.__throwInputs=[];g.submit=steps=>{if(!steps)return submit(0);if(frame<8){frame++;__smear.target([p[0]+frame*1.1,p[1],p[2]]);__throwInputs.push({tick:(frame-1)*2,frame});return submit(2);}g.submit=submit;__smear.release();return submit(steps);};__smear.manual(false);})()`);
   await sleep((seconds-.5)*1000);await page.eval('__smear.manual(true)');
   const detail=await page.eval('({flash:__smearGPU.flash.visible,slide:__smearGPU.slide.position.z,inputs:window.__throwInputs||[],audio:__smear.compute.audio()})');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__qaMaster.disconnect(__tap);__stream.getTracks().forEach(t=>t.stop());};__recorder.stop();})`);fs.writeFileSync(resolve(out,name+'.webm'),Buffer.from(data,'base64'));
   const state=await page.eval('__smear.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);assert.equal(state.tileOverflow,0);receipt.clips.push({label,name,seconds,steps:state.steps,...detail});
   if(name==='pistol')assert.equal(detail.flash,label==='before');
   const status=name==='pistol'?`,drawtext=font=Arial:text='FLASH STATE - ${detail.flash?'STUCK':'CLEARED'}':x=24:y=80:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8`:'';
   encode(['-i',resolve(out,name+'.webm'),'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=1,drawtext=font=Arial:text='${caption}':x=24:y=h-45:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8${status}`,'-af','apad','-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(out,name+'.mp4')]);console.log('Recorded '+label+'/'+name);save();
  }
  fs.writeFileSync(resolve(out,'clips.txt'),scenes.map(([n])=>`file '${n}.mp4'`).join('\n')+'\n');encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'momentum-'+label+'.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();save();}
}
encode(['-i',resolve(root,'before/momentum-before.mp4'),'-i',resolve(root,'after/momentum-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE / V30':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='MOMENTUM + PISTOL FIX / V31':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v];[0:a]pan=mono|c0=0.5*c0+0.5*c1[left];[1:a]pan=mono|c0=0.5*c0+0.5*c1[right];[left][right]amerge=inputs=2[audio]`,'-map','[v]','-map','[audio]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(root,receipt.comparison)]);
for(const [name,time]of [['release',.68],['flight',.95],['impact',1.5],['pistol',11.5]])encode(['-ss',String(time),'-i',resolve(root,receipt.comparison),'-frames:v','1',resolve(root,name+'-review.png')]);
for(const name of ['torso','head'])assert.deepEqual(receipt.clips.find(c=>c.label==='before'&&c.name===name).inputs,receipt.clips.find(c=>c.label==='after'&&c.name===name).inputs);
receipt.cadence='The first eight flick frames each advance two shipping 120 Hz physics ticks, presented at native rAF cadence; free flight then uses normal native frame timing.';
receipt.result='COMPLETE matched V30/V31 native gameplay MP4s with stereo game audio (before left, after right)';save();console.log(receipt.result);
