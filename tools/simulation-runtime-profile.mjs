// Native rAF profiling of the isolated simulation/raster worker architecture.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,sleep,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {createSimulationRuntime} from './simulation-runtime.mjs';
const firefox=process.argv.includes('firefox'),smoke=process.argv.includes('smoke'),pool=process.argv.includes('pool'),out=resolve('tools/out/simulation-runtime-'+(firefox?'firefox':'chrome')+(pool?'-pool':''));
await mkdir(out,{recursive:true});const source=await readFile('index.html','utf8');
const fixture=`const simulationAudioState=()=>({enabled:soundOn,unlocked:audioUnlocked,state:audio?.state||'uninitialized'});`;
const runtime=createSimulationRuntime(source.replace('window.__smear={state,',fixture+'\nwindow.__smear={simulationAudioState,state,'),{width:3000,height:1800,pool});
const file=resolve(out,'runtime.html');await writeFile(file,runtime);
const receipt={prototype:true,pool,browser:firefox?'Firefox':'Chrome',sourceSha256:createHash('sha256').update(source).digest('hex'),runtimeSha256:createHash('sha256').update(runtime).digest('hex'),muted:true,reports:[],startedAt:new Date().toISOString()};
const page=firefox?await launchFirefox({width:3000,height:1800}):await launch({port:9597,width:3000,height:1800});
receipt.browserProcessID=page.proc.pid;receipt.browserProfile=page.dir;
const watchdog=setTimeout(async()=>{receipt.result='FAIL native worker profile watchdog';receipt.browserLogs=page.logs;await writeFile(resolve(out,'timeout.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();process.exit(1);},180000);
async function reset(){await page.eval(`__smear.manual(true);__smear.preset('default');__smear.tune({walking:false,recover:false});__simulationLive.invoke('release');__simulationLive.invoke('reset');`);await page.eval(`__smear.step(0)`);}
async function start(){await page.eval(`__smear.perf.show(true);__smear.perf.clear();__smear.manual(false);window.__probeBefore={time:performance.now(),state:__smear.state()}`);}
async function capture(stage){await page.eval('__smear.manual(true)');await page.eval('__simulationLive.barrier()');const r=await page.eval(`({stage:'${stage}',telemetry:__smear.perf.report(),runtime:__simulationLive.status(),state:__smear.state(),audio:__smear.simulationAudioState(),before:__probeBefore,at:performance.now()})`);r.simulationTicksPerSecond=(r.state.stats.steps-r.before.state.stats.steps)/((r.at-r.before.time)/1000);receipt.reports.push(r);console.log(JSON.stringify({stage,fps:r.telemetry.summary.fps,summary:r.telemetry.summary,simulationTicksPerSecond:r.simulationTicksPerSecond,runtime:r.runtime,audio:r.audio}));assert(!r.runtime.error);assert.equal(r.audio.enabled,true);assert.equal(r.audio.state,'running');}
try{
 await page.goto(pathToFileURL(file).href);console.log('NAVIGATED worker prototype');await until(()=>page.eval('!!window.__simulationLive?.status().ready||!!window.__simulationLive?.status().error'),{timeout:60000,label:'worker runtime boot'});receipt.boot=await page.eval('__simulationLive.status()');assert(!receipt.boot.error,receipt.boot.error);console.log('READY worker prototype');
 await page.mouse('mousePressed',1500,300);await page.mouse('mouseReleased',1500,300);
 console.log('BOOTED live simulation/raster worker');if(smoke){await sleep(1200);receipt.smoke=await page.eval('({runtime:__simulationLive.status(),state:__smear.state()})');console.log(JSON.stringify(receipt.smoke.runtime));}
 else{
  await reset();await page.eval(`__smear.clean();__smear.tool(2);__smear.view([-1,3,5],[-1,0,3]);`);await page.eval('__smear.step(0)');await start();await page.mouse('mousePressed',1500,900);await sleep(1500);await page.mouse('mouseReleased',1500,900);await capture('Spill');
  await reset();await page.eval(`__smear.tool(1);__smear.view([3.4,3.3,4.8],[0,.3,1])`);await page.eval('__smear.step(0)');await start();let p=await page.eval(`__smear.project(0,'Torso')`);await page.mouse('mousePressed',p.x,p.y);for(let i=0;i<35;i++){await sleep(150);p=await page.eval(`__smear.project(0,'Torso')`);await page.mouse('mouseMoved',p.x,p.y);}await page.mouse('mouseReleased',p.x,p.y);await capture('pistol');
  await reset();await page.eval(`(()=>{const a=__smear;a.tool(0);a.view([3.4,3.3,4.8],[0,.1,1]);for(const b of a.state().parts.filter(b=>b.doll===1))for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,b.name,n,.85);})()`);await page.eval('__smear.step(0)');await start();p=await page.eval(`__smear.project(0,'Torso')`);await page.mouse('mousePressed',p.x,p.y);for(let i=1;i<=160;i++){await page.mouse('mouseMoved',p.x+Math.sin(i/40*Math.PI*2)*360,Math.min(1660,p.y+230));await sleep(20);}await page.mouse('mouseReleased',p.x,p.y);await capture('soaked drag');
  await reset();await page.eval('__smear.chaos()');await page.eval('__smear.step(0)');await start();await sleep(6000);await capture('Chaos');await page.shot(resolve(out,'chaos.png'));
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE worker runtime architecture profile';console.log(receipt.result);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{clearTimeout(watchdog);receipt.browserLogs=page.logs;await writeFile(resolve(out,'summary.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
