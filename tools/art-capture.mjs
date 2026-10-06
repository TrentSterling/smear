// Matched, real-time GPU recordings. Performance is measured separately, without capture.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launch,sleep,until} from './cdp.mjs';
const label=process.argv[2]||'before',out=resolve('tools/out/art-pass',label);
const only=process.argv.find(a=>a.startsWith('--clip='))?.slice(7);
await mkdir(out,{recursive:true});
if(!process.argv.includes('--keep-build'))await copyFile('index.html',resolve(out,'build.html'));
const page=await launch({port:9599,width:1920,height:1080});
const receipt={label,startedAt:new Date().toISOString(),viewport:[1920,1080],clips:[],audioOutputMuted:true,browserProfile:page.dir,browserPID:page.proc.pid};
if(only)receipt.clips=(JSON.parse(await readFile(resolve(out,'capture.json'),'utf8'))).clips;
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);
 await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:60000,label:'GPU capture boot'});
 receipt.version=await page.eval('__smear.state().then(s=>s.version)');receipt.buildSHA256=createHash('sha256').update(await readFile(resolve(out,'build.html'))).digest('hex');
 await page.eval('__smear.manual(true)');
 await page.mouse('mousePressed',960,150);await page.mouse('mouseReleased',960,150);
 receipt.audio=await page.eval('__smear.compute.audio()');
 assert.equal(receipt.audio.state,'running');
 async function clip(name,setup,seconds,during){
  if(only&&only!==name)return;
  await page.eval(setup);await page.eval('__smear.step(1)');
  await page.shot(resolve(out,name+'-start.png'));
  await page.eval(`(()=>{const c=__smearGPU.canvas;window.__captureChunks=[];window.__captureStream=c.captureStream(30);window.__captureRecorder=new MediaRecorder(__captureStream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});__captureRecorder.ondataavailable=e=>{if(e.data.size)__captureChunks.push(e.data)};__captureRecorder.start(1000);__smear.manual(false)})()`);
  if(during)await during(seconds);else await sleep(seconds*1000);
  await page.eval('__smear.manual(true)');
  const data=await page.eval(`new Promise(resolve=>{__captureRecorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(__captureChunks,{type:'video/webm'}));__captureStream.getTracks().forEach(t=>t.stop())};__captureRecorder.stop()})`);
  await writeFile(resolve(out,name+'.webm'),Buffer.from(data,'base64'));
  await page.shot(resolve(out,name+'-end.png'));
  const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);
  const resultClip={name,seconds,steps:state.steps,state},existing=receipt.clips.findIndex(c=>c.name===name);if(existing>=0)receipt.clips[existing]=resultClip;else receipt.clips.push(resultClip);
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',resolve(out,name+'.webm'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-r','30',resolve(out,name+'.mp4')],{windowsHide:true,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  console.log('Recorded '+label+'/'+name+'.mp4');
 }
 await clip('walk','__smear.reset();__smear.view([1.8,2.4,4.3],[-1,1,-3]);__smear.tool(0)',16);
 await clip('drag','__smear.reset();__smear.demo()',14);
 await clip('surfaces','__smear.reset();__smear.view([6.7,3.2,6.7],[-1,.8,-1]);__smear.tool(2);__smear.chaos()',8);
 const list=receipt.clips.map(c=>`file '${c.name}.mp4'`).join('\n');await writeFile(resolve(out,'clips.txt'),list+'\n');
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',resolve(out,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(out,'smear-'+label+'.mp4')],{windowsHide:true,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 receipt.result='COMPLETE matched MP4 capture';console.log(receipt.result);
}catch(e){receipt.error=e.stack;console.error(e);process.exitCode=1;}
finally{receipt.browserLogs=page.logs;await writeFile(resolve(out,'capture.json'),JSON.stringify(receipt,null,2));page.kill();}
