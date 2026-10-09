import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
const firefox=process.argv.includes('firefox'),label=process.argv[3]||'candidate',source=process.argv[4]||'index.html';
const out=resolve('tools/out/startup-v47',label+'-'+(firefox?'firefox':'chrome'));await mkdir(out,{recursive:true});
const html=await readFile(source,'utf8'),r={at:new Date().toISOString(),sha256:createHash('sha256').update(html).digest('hex'),source,runs:[]};
const page=await (firefox?launchFirefox({port:9597,width:1920,height:1080,headless:false}):launch({port:9597,width:1920,height:1080}));r.profile=page.dir;
const watchdog=setTimeout(()=>{page.kill();process.exit(1);},180000);
try{
 for(let run=0;run<2;run++){
  await page.goto(pathToFileURL(resolve(source)).href+'?defaults=1');
  let bootShot=false,previewShot=false,previewEntered=false;const samples=[];
  await until(async()=>{
   if(page.logs.some(s=>/^error:|^EXCEPTION:/.test(s)))throw Error(page.logs.join('\n'));
   const s=await page.eval(`(()=>{const l=document.getElementById('loading'),r=l?.getBoundingClientRect(),menu=document.getElementById('play-menu');return {time:performance.now(),ready:!!window.__smearComputeReady,preview:!!window.__smearStartup?.preview,loader:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,menu:menu?getComputedStyle(menu).display:'none',stage:document.getElementById('load-stage')?.textContent};})()`);samples.push(s);
   if(!bootShot&&!s.ready){await page.shot(resolve(out,'loading-'+run+'.png'));bootShot=true;}
   if(!previewShot&&s.preview&&!s.ready){
    await sleep(180);await page.shot(resolve(out,'preview-'+run+'.png'));previewShot=true;
    const b=await page.eval('document.getElementById("load-enter")?.getBoundingClientRect().toJSON()');if(b){await page.mouse('mousePressed',b.x+b.width/2,b.y+b.height/2);await page.mouse('mouseReleased',b.x+b.width/2,b.y+b.height/2);
    await until(()=>page.eval('!!document.pointerLockElement'),{timeout:3000,label:'capture during background loading'});previewEntered=true;await page.shot(resolve(out,'exploring-'+run+'.png'));}
   }
   if(s.loader&&source==='index.html'){assert.equal(s.loader.x,0);assert.equal(s.loader.y,0);assert.equal(s.menu,'none');assert.equal(s.loader.w,1920);}
   return s.ready;
  },{timeout:90000,every:150,label:'staged startup'});
  const data=await page.eval('({...__smearStartup,adapter:{fallback:__smearGPU.adapter.info.isFallbackAdapter},locked:!!document.pointerLockElement,errors:__smearGPU.errors})');assert.equal(data.adapter.fallback,false);assert.deepEqual(data.errors,[]);if(previewEntered)assert(data.locked,'Loading completion must preserve deliberate mouse capture');r.runs.push({...data,samples});
  console.log(JSON.stringify({run,ready:data.ready,preview:data.preview,meshReady:data.meshReady,frames:data.frames,gap:data.maxFrameMS,slowest:data.programs?.sort((a,b)=>b.ms-a.ms).slice(0,8)}));
  await page.eval('__smear.toybox.open()');await sleep(400);await page.shot(resolve(out,'toybox-'+run+'.png'));
 }
 r.result='COMPLETE startup and boot-layout checks';
}catch(e){r.error=e.stack;r.logs=page.logs;process.exitCode=1;console.error(e);}
finally{clearTimeout(watchdog);page.kill();await writeFile(resolve(out,'receipt.json'),JSON.stringify(r,null,2));}
