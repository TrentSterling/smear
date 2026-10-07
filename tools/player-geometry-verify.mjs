import fs from 'node:fs';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
const out=resolve('tools/out/player-geometry-pass/'+(process.argv[2]||'current'));fs.mkdirSync(out,{recursive:true});const file=process.env.SMEAR_TEST_FILE||'index.html';
const receipt={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),checks:[],walks:[]};let page;
const pass=s=>{receipt.checks.push(s);console.log('PASS '+s);};
try{
 page=await launch({port:9790,width:1600,height:1000,headless:true});receipt.profile=page.dir;await page.goto(process.env.SMEAR_TEST_URL||pathToFileURL(resolve(file)).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');await page.mouse('mousePressed',800,120);await page.mouse('mouseReleased',800,120);
 const key=(code,down)=>page.call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code==='KeyW'?'w':code==='Space'?' ':code});
 async function walk(name,eye,aim,milliseconds,{jump=false,run=false,crouch=false}={}){
  await page.eval(`(async()=>{__smear.reset();await __smear.step(0);__smearGPU.bodyCount=0;__smearGPU.syncCounts();__smear.controls.mode('cursor');__smear.view(${JSON.stringify(eye)},${JSON.stringify(aim)});__smear.tool(0);__smear.manual(false);})()`);
  if(crouch)await key('ControlLeft',true);if(run)await key('ShiftLeft',true);if(jump)await key('Space',true);await key('KeyW',true);await sleep(milliseconds);await key('KeyW',false);if(jump)await key('Space',false);if(run)await key('ShiftLeft',false);if(crouch)await key('ControlLeft',false);await page.eval('__smear.manual(true)');
  const result=await page.eval('({camera:__smearGPU.camera.position.toArray(),control:__smear.controls.state(),player:__smearGPU.input().playerFeet})');receipt.walks.push({name,result});await page.shot(resolve(out,name+'.png'));return result;
 }
 let s=await walk('ramp-up',[4.25,1.68,-4.2],[4.25,1.68,-2],920);assert(s.player[2]>-2.15,'walk reaches ramp middle');assert(s.player[1]>.6,'walk ascends tilted surface');pass('Native W walks onto the low ramp lip and up the slope without jumping');
 s=await walk('stairs-up',[4.25,1.68,.25],[4.25,1.68,-2],790);assert(s.player[2]<-1.3,'walk climbs both steps');assert(s.player[1]>.8,'walk reaches raised end');pass('Native W climbs the two access steps and joins the high end of the ramp');
 s=await walk('ramp-down',[4.25,2.66,-1.38],[4.25,2.66,-4],1000);assert(s.player[2]<-3.7);assert(s.player[1]<.2);pass('Walking down the ramp returns to the floor without snagging');
 s=await walk('bench-block',[-3.65,1.68,1.5],[-3.65,1.68,-.35],1100,{run:true});assert(s.player[2]>.44);assert(s.player[1]<.05);pass('Sprinting into a tall bench stops outside its front face instead of clipping or auto-climbing');
 s=await walk('pillar-block',[-5.55,1.68,2.5],[-5.55,1.68,1.1],700,{run:true});assert(s.player[2]>1.72);assert(s.player[1]<.05);pass('Sprinting into the pillar preserves player and camera clearance');
 s=await walk('jump-bench',[-3.65,1.68,1.25],[-3.65,1.68,-.35],660,{jump:true});assert(s.player[2]<.3);assert(s.player[1]>.70);pass('A jump lands on a bench top instead of passing through it');
 s=await walk('crouch-divider',[.15,1.68,7.3],[.15,1.68,5.8],1100,{crouch:true});assert(s.player[2]>6.18);pass('Crouched movement remains blocked by the divider');
 s=await walk('ramp-side',[2.7,1.68,-1.6],[4.25,1.68,-1.6],600,{run:true});assert(s.player[0]<3.13);pass('The raised side of the ramp blocks the whole player torso');
 receipt.audio=await page.eval('__smear.compute.audio()');assert(receipt.audio.enabled&&receipt.audio.state==='running');receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE '+receipt.checks.length+' player geometry checks';console.log(receipt.result);
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{if(page)page.kill();fs.writeFileSync(resolve(out,'verification.json'),JSON.stringify(receipt,null,2));}
