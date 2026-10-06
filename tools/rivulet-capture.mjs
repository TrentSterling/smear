// Matched V19 sheet flow and V20 partial-wetting wall film.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,until,sleep} from './cdp.mjs';
import {installWallFixture} from './wall-fixture.mjs';
import {installRivuletFixture} from './rivulet-fixture.mjs';
const root=resolve('tools/out/rivulet-pass/recordings');await mkdir(root,{recursive:true});
const receipt={started:new Date().toISOString(),viewport:[1280,960],audioOutputMuted:true,builds:[],browsers:[],clips:[],comparison:'smear-rivulet-comparison.mp4'};
const afterOnly=process.argv.includes('--after');
if(afterOnly){
 const previous=JSON.parse(await readFile(resolve(root,'capture.json'),'utf8'));assert(previous.result.startsWith('COMPLETE'));
 const baseline=previous.builds.find(b=>b.label==='before');assert.equal(baseline.sha256,createHash('sha256').update(await readFile('tools/out/rivulet-pass/before/index.html')).digest('hex'));
 receipt.builds.push(baseline);receipt.browsers.push(...previous.browsers.filter(b=>b.label==='before'));receipt.clips.push(...previous.clips.filter(c=>c.label==='before'));
}
function encode(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}
for(const label of afterOnly?['after']:['before','after']){
 const out=resolve(root,label);await mkdir(out,{recursive:true});const source=label==='before'?'tools/out/rivulet-pass/before/index.html':'index.html';await copyFile(source,resolve(out,'build.html'));
 const page=await launch({port:9631,width:1280,height:960});receipt.browsers.push({label,profile:page.dir,pid:page.proc.pid});
 try{
  await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
  const version=await page.eval('__smear.state().then(s=>s.version)');assert.equal(version,label==='before'?'0.19.0':'0.20.0');receipt.builds.push({label,version,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
  await page.eval('__smear.manual(true)');await page.mouse('mousePressed',640,130);await page.mouse('mouseReleased',640,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});await installWallFixture(page);
  await installRivuletFixture(page);
  for(const name of ['wall-impact','wall-drips','finite-patch','unequal-beads']){
   const seconds=name==='finite-patch'||name==='unequal-beads'?16:12;
   if(name==='wall-impact')await page.eval('__wallTest.setup()');
   else if(name==='wall-drips')await page.eval('(async()=>{__smear.reset();__smear.tune({walking:false,recover:false});await __smear.step(0);__smear.heal();await __smear.step(0);__smear.clean();__smear.tool(2);__smear.view([1.7,2.4,-4.7],[0,1.6,-8]);__smear.fly();})()');
   else await page.eval(`__rivulet.setup('${name==='finite-patch'?'band':'beads'}')`);
   await page.eval(`(()=>{window.__chunks=[];window.__stream=__smearGPU.canvas.captureStream(30);window.__recorder=new MediaRecorder(__stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__recorder.ondataavailable=e=>{if(e.data.size)__chunks.push(e.data)};__recorder.start(1000);__smear.manual(false);})()`);
   if(name==='wall-drips'){await page.mouse('mouseMoved',640,480);await page.mouse('mousePressed',640,480);await sleep(900);await page.mouse('mouseReleased',640,480);await sleep(seconds*1000-900);}else await sleep(seconds*1000);
   await page.eval('__smear.manual(true)');const data=await page.eval(`new Promise(resolve=>{__recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__chunks,{type:'video/webm'}));__stream.getTracks().forEach(t=>t.stop())};__recorder.stop()})`);
   await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));await page.shot(resolve(out,name+'-end.png'));const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert.equal(state.stampOverflow,0);
   const counters=await page.eval('__smearGPU.readWork().then(w=>({splats:w[29],runoff:w[26]}))');if(label==='after'&&name==='wall-impact')assert(counters.splats>0);
   const caption=name==='finite-patch'?'FINITE PATCH TEST':name==='unequal-beads'?'SMALL AND HEAVY DEPOSIT TEST':name==='wall-drips'?'SPILL PULSE':'DUMMY WALL IMPACT';
   encode(['-i',resolve(out,name+'.webm'),'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=2,drawtext=font=Arial:text='${caption}':x=24:y=h-45:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8`,'-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,name+'.mp4')]);receipt.clips.push({label,name,seconds,steps:state.steps,counters});console.log('Recorded '+label+'/'+name);
  }
  await writeFile(resolve(out,'clips.txt'),"file 'wall-impact.mp4'\nfile 'wall-drips.mp4'\nfile 'finite-patch.mp4'\nfile 'unequal-beads.mp4'\n");encode(['-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'wall-'+label+'.mp4')]);assert.deepEqual(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)),[]);
 }finally{page.kill();}
}
for(const [label,title,name] of [['before','PREVIOUS FLOW  /  V19',receipt.comparison]]){
 encode(['-i',resolve(root,label+'/wall-'+label+'.mp4'),'-i',resolve(root,'after/wall-after.mp4'),'-filter_complex',`[0:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='${title}':x=24:y=16:fontsize=24:fontcolor=white[a];[1:v]scale=960:720,drawbox=x=0:y=0:w=iw:h=55:color=black@0.75:t=fill,drawtext=font=Arial:text='PINNING + RIVULETS  /  V20':x=24:y=16:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`,'-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,name)]);
}
receipt.result='COMPLETE matched V19 and V20 wall-flow MP4s';await writeFile(resolve(root,'capture.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.result);
