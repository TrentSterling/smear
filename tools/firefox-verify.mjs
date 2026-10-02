import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchFirefox} from './bidi.mjs';
import {sleep,until} from './cdp.mjs';

const target=process.argv[2]||pathToFileURL(resolve('index.html')).href,label=process.argv[3]||'local';
const release=JSON.parse(await readFile('package.json','utf8'));
const out=resolve('tools/out','firefox-'+label);await mkdir(out,{recursive:true});
const receipt={target,browser:'Firefox',checks:[],profiles:[]};
const page=await launchFirefox({width:3000,height:1800});
function pass(name,fn){fn();receipt.checks.push(name);console.log('PASS '+name);}
async function start(){await page.eval('(()=>{const a=__smear;a.preset("default");a.tune({recover:false,walking:false});a.reset();a.perf.show(true);a.perf.clear();})()');}
async function profile(label){const r=await page.eval('__smear.perf.report()');receipt.profiles.push({label,...r});assert(r.frames.length>10);assert(r.frames.every(f=>f.interval>=0&&f.work>=0));return r;}
try{
 await page.goto(target);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'Firefox boot'});await sleep(800);
 const info=await page.eval('({state:__smear.state(),visibility:__smear.visibility(),quality:__smear.quality(),env:__smear.perf.report().environment})');receipt.environment=info.env;receipt.quality=info.quality;
 pass('Firefox boots current release with all spawn sightlines clear',()=>{assert.equal(info.state.version,release.version);assert(info.visibility.every(v=>v.visible));});
 pass('Firefox uses hardware WebGL at 3000 x 1800',()=>{assert(!/swiftshader|llvmpipe|software/i.test(info.env.gpu));assert.deepEqual(info.quality.canvas,[3000,1800]);assert.equal(info.quality.maxDrops,900);});
 await start();await page.eval('__smear.clean();__smear.tool(2);__smear.view([-1,3,5],[-1,0,3])');
 const floorBefore=await page.eval('__smear.sampleFloor(-1,3)');
 await page.mouse('mousePressed',1500,900);await sleep(900);await page.mouse('mouseReleased',1500,900);
 const spilled=await page.eval('__smear.state()'),floorAfter=await page.eval('__smear.sampleFloor(-1,3)');
 pass('native held Spill paints floor without the missing splat crash',()=>{assert.equal(floorBefore[3],0);assert(floorAfter[3]>100);assert(spilled.stats.splats>12);assert(spilled.wetSupply>0);assert(spilled.parts.every(b=>b.p.every(Number.isFinite)));});
 await profile('held floor Spill');await page.shot(resolve(out,'spill-floor.png'));
 await start();await page.eval('__smear.tool(1);__smear.view([3.4,3.3,4.8],[0,.3,1])');
 let p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mousePressed',p.x,p.y);
 for(let i=0;i<16;i++){await sleep(180);p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mouseMoved',p.x,p.y);}
 await page.mouse('mouseReleased',p.x,p.y);
 const shot=await page.eval('__smear.state()');
 pass('native sustained pistol fire creates wounds and landed droplets',()=>{assert(shot.stats.shots>=8);assert(shot.stats.dropletsLanded>0);assert(shot.stats.bodyPaints>0);});
 await profile('held pistol');await page.shot(resolve(out,'pistol.png'));
 await start();await page.eval('(()=>{const a=__smear;a.tool(0);a.view([3.4,3.3,4.8],[0,.1,1]);for(const b of a.state().parts.filter(b=>b.doll===1))for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,b.name,n,.85);})()');
 p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mousePressed',p.x,p.y);
 const held=await page.eval('__smear.state().grab');
 for(let i=1;i<=70;i++){await page.mouse('mouseMoved',p.x+Math.sin(i/70*Math.PI*2)*360,Math.min(1660,p.y+230));await sleep(20);}
 await page.mouse('mouseReleased',p.x,p.y);const dragged=await page.eval('__smear.state()');
 pass('native Firefox drag retains floor smears and releases the body',()=>{assert(held);assert.equal(dragged.grab,null);assert(dragged.stats.smearMeters>.1);});
 await profile('native soaked dummy drag');await page.shot(resolve(out,'drag.png'));
 const healed=await page.eval('(()=>{__smear.manual(true);__smear.heal();__smear.render();return __smear.state();})()');
 pass('healing clears pooled particles from the draw',()=>assert.equal(healed.particles,0));
 const reset=await page.eval('(()=>{const a=__smear;a.reset();a.hit(0,"Torso");a.step(120);return a.state();})()');
 pass('particle pool remains usable after heal and reset',()=>{assert(reset.stats.bodyPaints>0);assert(reset.stats.dropletsLanded>0);assert(reset.parts.every(b=>b.p.every(Number.isFinite)));});
 const glError=await page.eval('document.getElementById("world").getContext("webgl2").getError()');
 pass('Firefox has no WebGL errors after Spill, fire, drag and reset',()=>assert.equal(glError,0));
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));
 pass('Firefox has no gameplay exceptions or error banner',()=>assert.deepEqual(receipt.errors,[]));
 const failure=await page.eval('getComputedStyle(document.getElementById("failure")).display');
 pass('game error banner stays hidden',()=>assert.equal(failure,'none'));
 receipt.result='COMPLETE Firefox gameplay checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
