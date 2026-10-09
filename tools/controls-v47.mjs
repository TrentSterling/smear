import assert from 'node:assert/strict';
import fs from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';import {installUtilityFixture} from './utility-fixture.mjs';
const out=resolve('tools/out/startup-v47/controls');fs.mkdirSync(out,{recursive:true});const r={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks:[]};let page;
const check=name=>{console.log('PASS '+name);r.checks.push(name);};
const key=async(code,type)=>page.call('Input.dispatchKeyEvent',{type,code,key:code.replace('Key','').toLowerCase()});
try{
 page=await launch({port:9792,width:1920,height:1080});r.profile=page.dir;await page.goto(pathToFileURL(resolve('index.html')).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
 assert.equal(await page.eval('document.querySelectorAll("#toy-items button").length'),0);check('Toybox builds no hidden item buttons at startup');
 await page.eval('__smear.controls.mode("cursor");__smear.manual(true)');await installUtilityFixture(page);
 r.grabs=[];
 for(let tool=0;tool<14;tool++){
  await page.eval(`__utilityTest.reset();`);await page.eval(`__utilityTest.pose(3,[-3,.6,5]);`);
  await page.eval(`__smear.view([-3,1.2,7],[-3,.6,5]);__smear.pointer(960,540);__smear.tool(${tool});`);
  await page.mouse('mousePressed',960,540,'right');await page.eval('__smear.step(1)');
  await until(()=>page.eval('__smearGPU.input().held'),{timeout:3000,label:'right grab with tool '+tool});
  const input=await page.eval('__smearGPU.input()');assert.equal(input.body,183);assert.equal(input.tool,tool);assert.equal(input.right,false);assert.equal((await page.eval('__smear.controls.state()')).aimDown,false);
  // Releasing the other button must not let go of a right-held prop.
  await page.mouse('mouseReleased',960,540,'left');assert(await page.eval('__smearGPU.input().held'));
  await page.mouse('mouseReleased',960,540,'right');assert(!(await page.eval('__smearGPU.input().held')));r.grabs.push({tool,body:input.body});
 }
 check('All fourteen tools right-grab and release a GPU barrel without firing alternate actions');
 await page.eval('__smear.tool(5)');await page.mouse('mousePressed',960,540,'right');await page.mouse('mouseReleased',960,540,'right');await page.eval('__smear.step(1)');await sleep(50);assert(!(await page.eval('__smearGPU.input().held')));check('A quick released click cannot attach a late GPU picking result');
 await page.eval('__smear.reset();__smear.step(0);__smear.tool(1);__smear.manual(false)');await key('KeyY','keyDown');assert((await page.eval('__smear.controls.state()')).aimDown);await key('KeyY','keyUp');assert(!(await page.eval('__smear.controls.state()')).aimDown);check('Y preserves pistol alternate aim and releases cleanly');
 await page.eval('__smear.controls.mode("fps")');const b=await page.eval('document.getElementById("play-resume").getBoundingClientRect().toJSON()');await page.mouse('mousePressed',b.x+40,b.y+20);await page.mouse('mouseReleased',b.x+40,b.y+20);await until(()=>page.eval('__smear.controls.state().locked'));
 await page.eval('__smear.tool(5)');await sleep(200);await page.shot(resolve(out,'hud-hints.png'));
 r.hud=await page.eval('({r:document.getElementById("tool-readout").getBoundingClientRect().toJSON(),ammo:document.getElementById("weapon-ammo").textContent,hint:document.getElementById("play-state").textContent})');assert(r.hud.r.x>960&&r.hud.r.x<1030);assert(Math.abs(r.hud.r.y-540)<40);assert.equal(r.hud.ammo,'Unlimited ammo');assert(r.hud.hint.includes('RMB'));
 await sleep(3600);assert.equal(await page.eval('document.getElementById("play-state").textContent'),'');await page.shot(resolve(out,'hud-clean.png'));check('Weapon/ammo stays beside the reticle and equip hints disappear after 3.5 seconds');
 await key('KeyR','keyDown');await key('KeyR','keyUp');await sleep(150);assert((await page.eval('document.getElementById("weapon-ammo").textContent')).startsWith('Reloading'));await sleep(1900);assert.equal(await page.eval('document.getElementById("weapon-ammo").textContent'),'Unlimited ammo');check('Center ammo readout reports manual reload then restores the unlimited supply');
 await key('KeyB','keyDown');await key('KeyB','keyUp');await sleep(200);assert.equal(await page.eval('document.querySelectorAll("#toy-items button").length'),14);
 const props=await page.eval('document.querySelector("#toy-items span").getBoundingClientRect().toJSON()');assert(props.height>=24);assert.equal(await page.eval('getComputedStyle(document.querySelector("#toy-items span")).fontSize'),'16px');await page.shot(resolve(out,'toybox.png'));
 await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1.5,mobile:false});await sleep(250);await page.shot(resolve(out,'toybox-125-percent.png'));assert(await page.eval('document.getElementById("gpu-glyphs").width>parseFloat(document.getElementById("gpu-glyphs").style.width)'));check('Menu uses readable body text and GPU glyphs render at device-pixel density');
 r.errors=page.logs.filter(s=>/^error:|^EXCEPTION:/.test(s));assert.deepEqual(r.errors,[]);r.result='COMPLETE '+r.checks.length+' V47 input and readability checks';console.log(r.result);
}catch(e){r.error=e.stack;r.logs=page?.logs;process.exitCode=1;console.error(e);}finally{page?.kill();fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(r,null,2));}
