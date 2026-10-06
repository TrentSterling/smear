// Matched V16/V17 gravity and smearing review recordings. Performance is measured separately.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
const root=resolve('tools/out/gravity-pass/recordings');await mkdir(root,{recursive:true});
const version=JSON.parse(await readFile('package.json','utf8')).version,beforeVersion='0.16.0';
const receipt={started:new Date().toISOString(),beforeVersion,afterVersion:version,viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-gravity-comparison.mp4'};
function encode(args){const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);}
for(const label of ['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const build=label==='before'?resolve('tools/out/gravity-pass/before/index.html'):resolve('index.html');await copyFile(build,resolve(out,'build.html'));
 const page=await launch({port:9628,width:1280,height:960});
 receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000,label:'dummy capture boot'});
  const actualVersion=await page.eval('__smear.state().then(s=>s.version)');assert.equal(actualVersion,label==='before'?beforeVersion:version);
  receipt.builds.push({label,version:actualVersion,sha256:createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);assert.equal(await page.eval('__smear.compute.audio().state'),'running');
  async function clip(name,seconds,setup,live=true){
   await page.eval(setup);await page.eval('__smear.fly()');await page.shot(resolve(out,name+'-start.png'));
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);${live?'__smear.manual(false);':''}})()`);
   if(name==='smear'||name==='fling')await page.eval(`(()=>{window.__wetMoving=true;const name='${name}';const started=performance.now();const update=now=>{if(!__wetMoving)return;const t=(now-started)/1000;__smear.target(name==='fling'?[Math.sin(t*2)*2.3,1.8+Math.cos(t*1.9)*1.2,.5+Math.sin(t*.9)]:[Math.sin(t*.65)*1.5,.13,.9+Math.cos(t*.55)*1.25]);requestAnimationFrame(update);};requestAnimationFrame(update);})()`);
   if(name==='wall'||name==='edge'){await page.mouse('mouseMoved',640,480);await page.mouse('mousePressed',640,480);await sleep(900);await page.mouse('mouseReleased',640,480);await sleep((seconds-.9)*1000);}else if(name==='pool'){await sleep(6000);await page.eval('__smear.grab(0,"Right foot")');await page.eval('__smear.target([2.6,.4,1.5])');await sleep((seconds-6)*1000);}else await sleep(seconds*1000);await page.eval('__wetMoving=false;__smear.manual(true);__smear.release()');
   const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));
   const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);
   encode(['-i',resolve(out,name+'.webm'),'-vf','fps=30,tpad=stop_mode=clone:stop_duration=2','-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);
   const contact=await page.eval('__smearGPU.readWork().then(r=>({smears:r[23],pools:r[24],smudges:r[25],runoff:r[26],shed:r[27]}))');if(label==='after'&&name==='edge')assert(contact.runoff>0,'Edge runoff must detach drops');if(label==='after'&&name==='fling')assert(contact.shed>0,'Coated moving dummy must shed drops');receipt.clips.push({label,name,seconds,steps:state.steps,errors:state.errors,contact});console.log('Recorded '+label+'/'+name+'.mp4');
  }
  await clip('wall',10,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.heal();await __smear.step(0);__smear.clean();__smear.tool(2);__smear.view([1.7,2.4,-4.7],[0,1.6,-8]);})()`);
  await clip('edge',10,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.heal();await __smear.step(0);__smear.clean();__smear.tool(2);const s=__smearGPU.surfaces.find((s,i)=>i>=16&&s.n.y>.99&&s.center.y>.6&&s.w>1);const p=s.center.clone().addScaledVector(s.u,s.w*.5-.055);const camera=p.clone().addScaledVector(s.u,1.8).addScaledVector(s.n,1.4).addScaledVector(s.v,2.4);__smear.view(camera.toArray(),p.toArray());})()`);
  await clip('smear',12,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});__smear.tool(0);__smear.view([2.4,3.5,4.6],[0,0,.6]);await __smear.step(240);await __smear.grab(0,'Right foot');})()`);
  await clip('fling',8,`(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});__smear.tool(0);__smear.view([4.3,3.2,5.4],[0,1,.3]);await __smear.step(120);await __smear.grab(0,'Right foot');})()`);
  await writeFile(resolve(out,'clips.txt'),"file 'wall.mp4'\nfile 'edge.mp4'\nfile 'smear.mp4'\nfile 'fling.mp4'\n");
  encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'gravity-'+label+'.mp4')]);
  assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
encode(['-i',resolve(root,'before/gravity-before.mp4'),'-i',resolve(root,'after/gravity-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='BEFORE  /  ${beforeVersion}':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='GRAVITY + POOL DRAG  /  ${version}':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
receipt.result='COMPLETE matched gravity, runoff, smearing and fling MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
