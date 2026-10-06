// Matched real grab/target inputs; no preloaded coating or posed dummy uploads.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
import {installWallContactFixture} from './wall-contact-fixture.mjs';
const root=resolve('tools/out/liquid-evolution/recordings');await mkdir(root,{recursive:true});
const receipt={started:new Date().toISOString(),viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-liquid-evolution-comparison.mp4'};
function encode(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}
for(const label of ['before','v23','v24','v25','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const source=label==='before'?'tools/out/liquid-evolution/baseline/index.html':label==='after'?'index.html':'tools/out/liquid-evolution/'+label+'/index.html';await copyFile(source,resolve(out,'build.html'));
 const page=await launch({port:9652,width:1280,height:960});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2));
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
  const version=await page.eval('__smear.state().then(s=>s.version)');assert.equal(version,label==='before'?'0.22.0':label==='after'?'0.26.0':'0.'+label.slice(1)+'.0');receipt.builds.push({label,version,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});await installWallContactFixture(page);
  for(const name of (label.startsWith('v')?['drag']:['press','drag'])){
   await page.eval(`__contactPlay.setup('${name}')`);await page.eval("__smear.grab(0,'Torso',[0,0,.125])");
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);__contactPlay.start();})()`);
   await sleep(8000);await page.eval('__contactPlay.stop();__smear.release();__smear.view([-3.1,2.3,-4.4],[-3.5,1.4,-8]);__smear.manual(false)');await sleep(10000);await page.eval(`(()=>{const start=performance.now();window.__reviewOrbit=setInterval(()=>{const t=Math.min(1,(performance.now()-start)/4500);__smear.view([-3.1-.8*t,2.3-1.25*t,-4.4-.6*t],[-3.5,1.4+.4*t,-8]);},25);})()`);await sleep(5000);await page.eval('clearInterval(__reviewOrbit)');
   await page.eval('__smear.manual(true)');const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);assert.equal(state.tileOverflow,0);
   const caption=(label==='before'?'V22':label==='after'?'V26':label.toUpperCase())+'  /  '+(name==='press'?'PRESS + RELEASE':'DRAG + RELEASE');
   encode(['-i',resolve(out,name+'.webm'),'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=2,drawtext=font=Arial:text='${caption}':x=24:y=h-45:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8`,'-t','23','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);const contact=await page.eval(`(async()=>{const g=__smearGPU,d=g.device,b=g.buffer('explicit contact counters',12,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=d.createCommandEncoder();e.copyBufferToBuffer(g.workBuffer,31*4,b,0,12);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=Array.from(new Uint32Array(b.getMappedRange()));b.unmap();b.destroy();return {squeezed:a[0],sprayed:a[1],caught:a[2]};})()`);if(label==='after'){assert(contact.squeezed>0);assert(contact.sprayed>0);}receipt.clips.push({label,name,seconds:23,steps:state.steps,contact});console.log('Recorded '+label+'/'+name);
  }
  await writeFile(resolve(out,'clips.txt'),(label.startsWith('v')?"file 'drag.mp4'\n":"file 'press.mp4'\nfile 'drag.mp4'\n"));encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'wall-'+label+'.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2));}
}
encode(['-i',resolve(root,'before/wall-before.mp4'),'-i',resolve(root,'after/wall-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='ACCEPTED BRUSH + DRIPS  /  V22':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='SQUEEZE + SPRAY + JOINING  /  V26':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,receipt.comparison)]);
for(const [name,seconds]of [['press',7],['press-drain',22],['drag',30],['drag-drain',45]])encode(['-ss',String(seconds),'-i',resolve(root,receipt.comparison),'-frames:v','1',resolve(root,name+'-review.png')]);
await writeFile(resolve(root,'stages.txt'),['before','v23','v24','v25','after'].map(label=>"file '"+label+"/drag.mp4'").join('\n')+'\n');
encode(['-f','concat','-safe','0','-i',resolve(root,'stages.txt'),'-c','copy','-movflags','+faststart',resolve(root,'smear-v22-through-v26.mp4')]);
receipt.progression='smear-v22-through-v26.mp4';receipt.result='COMPLETE cumulative V22 through V26 and paired final comparison MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
