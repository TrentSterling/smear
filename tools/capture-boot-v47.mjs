// Browser viewport only. Real elapsed screenshot durations, no desktop capture.
import assert from 'node:assert/strict';import fs from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {launchFirefox} from './bidi.mjs';import {sleep} from './cdp.mjs';
const out=resolve('tools/out/startup-v47/record'),review=resolve('review/v47');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(review,{recursive:true});
const r={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),frames:[],note:'Silent Firefox boot recording. Screenshot durations retain elapsed wall time; profiling is a separate run.'};
const page=await launchFirefox({port:9589,width:1600,height:900,headless:false});r.profile=page.dir;
try{
 await page.goto(pathToFileURL(resolve('index.html')).href+'?defaults=1');let entered=false,finished=0;const start=performance.now();
 while(performance.now()-start<60000){
  const file='frame-'+String(r.frames.length).padStart(4,'0')+'.png',at=performance.now()-start;await page.shot(resolve(out,file));r.frames.push({file,at});
  const s=await page.eval('({ready:!!window.__smearComputeReady,preview:!!window.__smearStartup?.preview,errors:window.__smearGPU?.errors})');assert.deepEqual(s.errors||[],[]);
  if(s.preview&&!entered&&!s.ready){const b=await page.eval('document.getElementById("load-enter")?.getBoundingClientRect().toJSON()');if(b){await page.mouse('mousePressed',b.x+b.width/2,b.y+b.height/2);await page.mouse('mouseReleased',b.x+b.width/2,b.y+b.height/2);entered=true;}}
  if(s.ready){if(!finished)finished=performance.now();if(performance.now()-finished>1600)break;}
  await sleep(350);
 }
 assert(finished,'Boot did not complete');r.startup=await page.eval('__smearStartup');r.errors=page.logs.filter(s=>/^error:/.test(s));assert.deepEqual(r.errors,[]);
 const list=r.frames.map((f,i)=>`file '${f.file}'\nduration ${((r.frames[i+1]?.at??f.at+400)-f.at)/1000}`).join('\n')+`\nfile '${r.frames.at(-1).file}'\n`;fs.writeFileSync(resolve(out,'frames.txt'),list);
 const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',resolve(out,'frames.txt'),'-vf','fps=30','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(review,'firefox-startup.mp4')],{encoding:'utf8',windowsHide:true});assert.equal(ff.status,0,ff.stderr);r.result='COMPLETE Firefox startup MP4';console.log(r.result);
}catch(e){r.error=e.stack;console.error(e);process.exitCode=1;}finally{page.kill();fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(r,null,2));}
