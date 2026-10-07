import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
import {installUtilityFixture} from './utility-fixture.mjs';

const baseline=process.argv.includes('baseline'),label=baseline?'before':'after';
const build=baseline?'tools/out/showcase-pass/before/index.html':'index.html';
const out=resolve('tools/out/showcase-pass',label);fs.mkdirSync(out,{recursive:true});
const receipt={at:new Date().toISOString(),buildSHA256:createHash('sha256').update(fs.readFileSync(build)).digest('hex'),checks:[],baseline};
const pass=message=>{receipt.checks.push(message);console.log('PASS '+message);};let page;
try{
 page=await launch({port:9780,width:1600,height:1000,headless:true});receipt.profile=page.dir;
 await page.goto(pathToFileURL(resolve(build)).href+'?defaults=1');
 await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});
 await page.eval('__smear.manual(true)');await page.mouse('mousePressed',800,120);await page.mouse('mouseReleased',800,120);await installUtilityFixture(page);
 await page.eval('__utilityTest.reset();');await page.eval('__utilityTest.pose(0,[-3,.56,3]);__smear.view([-3,1.3,6],[-3,.56,3]);__smear.pointer(800,500);__smear.tool(1)');
 // Reproduce the full metal-debris pool left by simultaneous barrel blasts.
 await page.eval(`(async()=>{const g=__smearGPU,a=new ArrayBuffer(120*96),w=new Uint32Array(a),f=new Float32Array(a);for(let i=0;i<120;i++){f.set([-6,2,-6,.02,0,0,0,0],i*24);w[i*24+11]=i*977;w[i*24+19]=w[i*24+23]=2;}g.device.queue.writeBuffer(g.workBuffer,(g.destructionBase+1440+8*24)*4,a);for(let i=0;i<5;i++){g.shoot();__smear.render();await g.device.queue.onSubmittedWorkDone();}})()`);
 receipt.saturated=await page.eval('__utilityTest.ord()');receipt.broken=(await page.eval('__smear.props()'))[0];
 assert(receipt.broken.broken,'the crate must actually break');
 const boards=receipt.saturated.filter(o=>o.kind===5).length;
 console.log('Saturated crate: '+boards+' large boards');
 if(!baseline){assert.equal(boards,6);pass('A crate broken with all 120 debris slots occupied still produces six large boards');}
 await page.eval('__smear.step(36)');await page.shot(resolve(out,'crate-burst.png'));
 await page.eval('__smear.step(1044);__smear.view([-1,2.7,5],[-3,.1,3]);__smear.render()');receipt.lasting=await page.eval('__utilityTest.ord()');
 if(!baseline){assert.equal(receipt.lasting.filter(o=>o.kind===5).length,6);pass('Visible wood survives nine seconds after breaking a crate in a saturated scene');}
 await page.shot(resolve(out,'crate-aftermath.png'));
 await page.eval('__smear.utility.build();__smear.manual(true);__smear.tool(0);__smear.view([1.6,2.5,4.3],[.1,.65,1.1]);__smear.utility.run();__smear.manual(false)');
 await sleep(6000);await page.eval('__smear.manual(true)');
 receipt.machine={props:await page.eval('__smear.props()'),debris:await page.eval('__utilityTest.ord()')};
 assert(receipt.machine.props.filter(p=>p.kind==='barrel'&&p.broken).length>=3);
 const machineBoards=receipt.machine.debris.filter(o=>o.kind===5).length;
 console.log('Actual barrel chain retained '+machineBoards+' large boards');
 if(!baseline){assert(machineBoards>=6);pass('The actual conveyor/barrel chain retains large wood pieces through real-time explosions');}
 await page.shot(resolve(out,'machine-aftermath.png'));
 await page.eval('__smear.reset();__smear.step(0)');await page.eval('__smear.tool(5);__smear.view([0,1.68,3.8],[0,1.5,-2]);__smearGPU.updateToolPresentation(0,{tool:5,panel:null,time:0,left:false});__smear.render()');
 await page.shot(resolve(out,'launcher.png'));
 await page.eval('__utilityTest.reset()');await page.eval('__smear.view([-3,2,4],[-3,2,-8]);__smear.pointer(800,500);__smear.tool(5);__smear.manual(false)');
 await page.mouse('mousePressed',800,500);await sleep(1550);await page.mouse('mouseReleased',800,500);await page.eval('__smear.manual(true)');
 receipt.rapid=await page.eval('(async()=>{const g=__smearGPU;return Array.from(new Uint32Array(await __destructionFixture.read(g.workBuffer,(g.destructionMeta+16)*4,8)));})()');
 console.log('Native rockets in 1.55 s: '+receipt.rapid[1]);
 if(!baseline){assert(receipt.rapid[1]>=4&&receipt.rapid[1]<=6);pass('Holding native fire launches four to six rockets in 1.55 seconds with bounded ordnance');}
 await page.eval('__smear.controls.pause();__smear.manual(false)');await sleep(500);await page.eval('__smear.manual(true)');
 const paused=await page.eval('(async()=>{const g=__smearGPU;return new Uint32Array(await __destructionFixture.read(g.workBuffer,(g.destructionMeta+17)*4,4))[0];})()');assert.equal(paused,receipt.rapid[1]);pass('Pausing clears held rocket fire');
 await page.eval('__utilityTest.reset()');await page.eval('__smear.tool(0);__smearGPU.updateToolPresentation(0,{tool:0,panel:null,time:0,left:false})');
 for(const point of [[-2,0,2],[0,0,2],[2,0,2],[-2,0,4],[0,0,4],[2,0,4]])await page.eval('__utilityTest.patch('+JSON.stringify({point,radius:1.4,mass:.55})+')');
 await page.eval('__smear.view([4,1.35,6],[0,.05,1]);__smear.render()');await page.shot(resolve(out,'wet-lighting.png'));
 await page.eval('__smear.view([0,2.0,4.2],[0,2.6,-2]);__smear.render()');await page.shot(resolve(out,'room-lighting.png'));
 receipt.scene=await page.eval('({emitters:window.__smearLights?.length||8,shadow:!!__smearGPU.shadowPipeline,adapter:__smearGPU.adapter.info,errors:__smearGPU.errors})');
 assert.deepEqual(receipt.scene.errors,[]);receipt.audio=await page.eval('__smear.compute.audio()');assert(receipt.audio.enabled&&receipt.audio.state==='running');
 if(!baseline){assert(receipt.scene.emitters>8);assert(!receipt.scene.shadow);pass('Hardware WebGPU boots with expanded LTC emitters and no directional shadow pipeline');}
 assert(!page.logs.some(s=>/^error:|^EXCEPTION:/.test(s)));receipt.passed=true;console.log('COMPLETE '+label+' showcase checks');
}catch(e){receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{if(page){receipt.logs=page.logs;page.kill();}fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2));}
