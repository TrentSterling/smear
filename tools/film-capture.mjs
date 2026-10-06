// Matched V14-to-current smearing and liquid-film review recordings. GPU performance is measured in separate runs.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
const root=resolve('tools/out/film-pass/recordings');await mkdir(root,{recursive:true});
const version=JSON.parse(await readFile('package.json','utf8')).version,beforeVersion='0.14.0';
const receipt={started:new Date().toISOString(),beforeVersion,afterVersion:version,viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-film-comparison.mp4'};
function encode(args){const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);}
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const build=label==='before'?resolve('tools/out/wet-pass/before/index.html'):resolve('index.html');await copyFile(build,resolve(out,'build.html'));
 const page=await launch({port:9624,width:1280,height:960});
 receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000,label:'dummy capture boot'});
  const actualVersion=await page.eval('__smear.state().then(s=>s.version)');assert.equal(actualVersion,label==='before'?beforeVersion:version);
  receipt.builds.push({label,version:actualVersion,sha256:createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);assert.equal(await page.eval('__smear.compute.audio().state'),'running');
  async function clip(name,seconds,setup,live=true){
   await page.eval(setup);await page.eval('__smear.fly()');await page.shot(resolve(out,name+'-start.png'));
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);${live?'__smear.manual(false);':''}})()`);
   if(name==='smear')await page.eval(`(()=>{window.__wetMoving=true;const started=performance.now();const update=now=>{if(!__wetMoving)return;const t=(now-started)/1000;__smear.target([Math.sin(t*.65)*1.5,.13,.9+Math.cos(t*.55)*1.25]);requestAnimationFrame(update);};requestAnimationFrame(update);})()`);
   if(name==='settle'){await page.mouse('mouseMoved',640,480);await page.mouse('mousePressed',640,480);await sleep(900);await page.mouse('mouseReleased',640,480);await sleep((seconds-.9)*1000);}else if(name==='pool'){await sleep(6000);await page.eval('__smear.grab(0,"Right foot")');await page.eval('__smear.target([2.6,.4,1.5])');await sleep((seconds-6)*1000);}else await sleep(seconds*1000);await page.eval('__wetMoving=false;__smear.manual(true);__smear.release()');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));
   const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=2','-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);
   const contact=await page.eval('__smearGPU.readWork().then(r=>({smears:r[23],pools:r[24],smudges:r[25]}))');if(label==='after'&&name==='pool')assert(contact.pools>0,'Resting contact must deposit pools');receipt.clips.push({label,name,seconds,steps:state.steps,errors:state.errors,contact});console.log('Recorded '+label+'/'+name+'.mp4');
  }
  await clip('settle',8,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.stopBleeding();await __smear.step(0);__smear.wash();await __smear.step(0);__smear.tool(2);__smear.view([.6,1.1,3.4],[0,0,2]);})()`);
  await clip('pool',10,'__smear.reset();__smear.tune({walking:false,recover:false});__smear.tool(0);__smear.view([1.7,1.9,2.4],[0,0,.45]);__smear.step(45)');
  await clip('smear',12,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});__smear.tool(0);__smear.view([2.4,3.5,4.6],[0,0,.6]);await __smear.step(240);await __smear.grab(0,'Right foot');})()`);
  await writeFile(resolve(out,'clips.txt'),"file 'settle.mp4'\nfile 'pool.mp4'\nfile 'smear.mp4'\n");
  encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'film-'+label+'.mp4')]);
  assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
encode(['-i',resolve(root,'before/film-before.mp4'),'-i',resolve(root,'after/film-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE  /  ${beforeVersion}':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='SMEAR + LIQUID FILM  /  ${version}':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
receipt.result='COMPLETE matched finite pooling and contact-smearing MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
