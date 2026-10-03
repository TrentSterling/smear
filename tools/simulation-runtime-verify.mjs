// Exercise the actual foreground/worker bridge through public gameplay APIs.
// This supplements, rather than replaces, the exact coupled-kernel audit.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {compareCanvasPNG} from './png-pixels.mjs';
import {createSimulationRuntime} from './simulation-runtime.mjs';

const firefox=process.argv.includes('firefox'),out=resolve('tools/out/simulation-runtime-verify-'+(firefox?'firefox':'chrome'));
await mkdir(out,{recursive:true});
const source=await readFile('index.html','utf8');
const inspect=`window.__simulationInspect=()=>({surfaces:surfaces.map(s=>s.canvas.toDataURL()),skins:bodies.map(b=>b.skinCanvas?.toDataURL()||null),camera:camera.position.toArray(),quality:__smear.quality()});`;
const instrumented=source.replace('window.__smear={state,',inspect+'\nwindow.__smear={state,');
const candidate=createSimulationRuntime(instrumented,{pool:true});
const boot='<script>window.requestAnimationFrame=()=>0;</script>';
const files={reference:resolve(out,'reference.html'),candidate:resolve(out,'candidate.html')};
await writeFile(files.reference,instrumented.replace('</head>',boot+'</head>'));
await writeFile(files.candidate,candidate.replace('</head>',boot+'</head>'));
const stages=[
 ['reset',`await a.reset();await a.preset('default');await a.tune({walking:false,recover:false});`],
 ['floor and wall Spill',`await a.puddle([.4,0,1],.65,.8);await a.wallSpill('front');await a.step(24);`],
 ['skin and wound',`await a.bodyPaint(0,'Torso',[0,0,1],.85);await a.moveDoll(0,[0,.24,1]);await a.hit(0,'Torso');await a.step(120);`],
 ['grab and drag',`await a.grab(0,'Right foot');await a.target([1.6,.18,.6]);await a.step(60);await a.release();`],
 ['wash and clean',`await a.wash();await a.clean();`],
 ['repaint after clear',`await a.bodyPaint(0,'Torso',[0,0,-1],.9);await a.puddle([1,0,1],.4,.7);await a.step(12);`],
 ['dry wet supply',`await a.agePaint(30);`],
 ['add',`const before=a.state().dolls;await a.add();if(a.state().dolls!==before+1)throw Error('Awaited add returned stale state');await a.step(24);`],
 ['Chaos topology',`await a.chaos();await a.step(60);`],
 ['reset after Chaos',`await a.reset();await a.tune({walking:false,recover:false});`],
 ['demo input and camera',`await a.demo();await a.step(120);`],
];
function normalize(s){const copy=structuredClone(s);delete copy.renderer;delete copy.stats.frameMS;delete copy.stats.physicsMS;delete copy.stats.paintUploads;return copy;}
const receipt={prototype:true,browser:firefox?'Firefox':'Chrome',muted:true,sourceSha256:createHash('sha256').update(source).digest('hex'),runtimeSha256:createHash('sha256').update(candidate).digest('hex'),checks:[],stages:[],startedAt:new Date().toISOString()};
const page=firefox?await launchFirefox({width:1280,height:720}):await launch({port:9597,width:1280,height:720});
receipt.browserProcessID=page.proc.pid;receipt.browserProfile=page.dir;
const watchdog=setTimeout(()=>{page.kill();console.error('FAIL runtime bridge watchdog');process.exit(1);},180000);
try{
 const captures={};
 for(const kind of ['reference','candidate']){
  await page.goto(pathToFileURL(files[kind]).href);
  await until(()=>page.eval(kind==='candidate'?'!!window.__simulationLive?.status().ready||!!window.__simulationLive?.status().error':'!!window.__smear&&!document.getElementById("loading")'),{timeout:60000,label:kind+' ready'});
  if(kind==='candidate')assert.equal(await page.eval('__simulationLive.status().error'),null);
  await page.eval('__smear.manual(true)');captures[kind]=[];
  for(const [name,actions]of stages){
   const capture=await page.eval(`(async()=>{const a=__smear;${actions}await a.paintReady();a.render();return{state:a.state(),inspection:__simulationInspect(),runtime:window.__simulationLive?.status()};})()`);
   captures[kind].push(capture);assert(!capture.runtime?.error,capture.runtime?.error);console.log('CAPTURE '+kind+': '+name);
  }
 }
 for(let n=0;n<stages.length;n++){
  const before=captures.reference[n],after=captures.candidate[n],name=stages[n][0];
  assert.deepEqual(normalize(after.state),normalize(before.state),name+': exact public authoritative state');
  assert.deepEqual(after.inspection.camera,before.inspection.camera,name+': camera');
  assert.deepEqual(after.inspection.quality,before.inspection.quality,name+': resolution and limits');
  receipt.checks.push(name+': authoritative state, camera and quality');
  const differences=[];
  for(const type of ['surfaces','skins']){
   assert.equal(after.inspection[type].length,before.inspection[type].length,name+': '+type+' count');
   for(let i=0;i<before.inspection[type].length;i++){
    const b=before.inspection[type][i],a=after.inspection[type][i];assert.equal(!!a,!!b,name+': '+type+' '+i+' allocation');
    if(!a)continue;const delta=compareCanvasPNG(b,a);if(delta.changed)differences.push({type,index:i,...delta});
    assert.equal(delta.overTwo,0,name+': '+type+' '+i+' original pigment tolerance '+JSON.stringify(delta));
   }
  }
  receipt.checks.push(name+': all foreground surface and skin canonical pigment');
  receipt.stages.push({name,pigmentDifferences:differences,runtime:after.runtime});console.log('PASS bridge: '+name);
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);
 receipt.result='COMPLETE foreground/worker bridge checks passed';console.log(receipt.result+' ('+receipt.checks.length+' checks)');
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.message.slice(0,2500));process.exitCode=1;}
finally{clearTimeout(watchdog);receipt.browserLogs=page.logs;await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
