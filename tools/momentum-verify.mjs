import assert from 'node:assert/strict';import fs from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';import {until,sleep} from './cdp.mjs';import {installMomentumFixture} from './momentum-fixture.mjs';
const label=process.argv.find(v=>/^(round-|final)/.test(v))||'round-01',browser=process.argv.includes('firefox')?'firefox':'chrome',out=resolve('tools/out/momentum-pass',label+'-'+browser);fs.mkdirSync(out,{recursive:true});
const page=await launchComputeBrowser({port:9693,width:1440,height:1080}),receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,buildSHA256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks:[]};
async function boot(path='index.html'){await page.goto(pathToFileURL(resolve(path)).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await installMomentumFixture(page);}
async function fling(part,step,pause=0){await page.eval(`__momentum.setup('${part}')`);await page.eval(`__momentum.flick({step:${step},pause:${pause}})`);const held=await page.eval('__momentum.read()');await page.eval('__smear.release()');const released=await page.eval('__momentum.read()'),flight=await page.eval('__momentum.flight()');return {held,released,flight};}
async function pistol(action){
 await page.eval('(async()=>{__smear.manual(true);__smear.reset();__smear.tool(1);await __smear.step(0);__smearGPU.steps=2400;__smear.manual(false);})()');await sleep(100);
 await page.eval(`__smear.shoot();${action}`);await sleep(350);
 return page.eval('(()=>{const flash=__smearGPU.flash.visible,slide=__smearGPU.slide.position.z;__smear.shoot();return {flash,slide,nextShot:__smearGPU.inputAction};})()');
}
try{
 await boot('tools/out/momentum-pass/before/index.html');receipt.before=await fling('Torso',1.1);receipt.beforePistol=await pistol('__smear.chaos()');assert(receipt.beforePistol.flash);assert.equal(receipt.beforePistol.nextShot,0);
 await boot();receipt.throws={};
 for(const part of ['Head','Torso'])for(const step of [.15,.65,1.1]){
  const result=await fling(part,step);receipt.throws[part+step]=result;
  for(const state of [result.held,result.released,...result.flight])for(const body of state.parts)assert([...body.p,...body.v].every(Number.isFinite));
  const end=result.flight.find(s=>s.tick===16);assert(end.v[0]/result.released.v[0]>.98,`${part}/${step} lost momentum during contraction`);assert(end.gap<.06);
 }
 const heavy=receipt.throws['Torso1.1'];assert(heavy.held.gap>3);assert(heavy.flight[3].v[0]>receipt.before.flight[3].v[0]*8);
 receipt.checks.push('Head and torso throws preserve at least 98% of release momentum for 133 ms in free flight, including joint gaps over 3 m; joints close below 6 cm');
 assert(heavy.flight.at(-1).v[0]<1);assert(heavy.flight.at(-1).thuds>heavy.released.thuds);assert(heavy.flight.at(-1).p[0]<8);
 receipt.checks.push('The formerly stalled stretched throw reaches the far wall, emits an impact event, and stops at the collision instead of preserving speed through it');
 receipt.delays={};for(const pause of [2,4,8]){const r=await fling('Torso',1.1,pause);receipt.delays[pause]=r;assert(r.released.v[0]>15);assert(r.flight[3].v[0]>r.released.v[0]*.97);}
 receipt.checks.push('Large flicks retain flight speed with 17, 33 and 67 ms release delays');
 // Mouse picking and mouseup use the shipping input path, including its ray target.
 await page.eval('__momentum.setup("Torso")');await page.eval('__smear.release(false);__smear.view([0,3,4],[0,3,-4])');const p=await page.eval('__smear.project(0,"Torso")');
 await page.mouse('mouseMoved',p.x,p.y);await page.mouse('mousePressed',p.x,p.y);await page.eval('__smear.render()');await until(()=>page.eval('__smearGPU.input().held'),{timeout:5000});
 for(let i=1;i<=8;i++){await page.mouse('mouseMoved',p.x+i*72,p.y);await page.eval('__impactTest.advance(2)');}
 receipt.pointerHeld=await page.eval('__momentum.read()');await page.mouse('mouseReleased',p.x+576,p.y);assert.equal(await page.eval('__smearGPU.input().held'),false);receipt.pointerReleased=await page.eval('__momentum.read()');receipt.pointerFlight=await page.eval('__momentum.flight([1,8,16])');
 assert(receipt.pointerReleased.v[0]>12);assert(receipt.pointerFlight.at(-1).v[0]>receipt.pointerReleased.v[0]*.98);
 receipt.checks.push('A real pointer-picked rapid sweep and mouseup retain at least 98% of horizontal flight speed after 133 ms');
 receipt.pistol={};for(const [name,action]of Object.entries({chaos:'__smear.chaos()',chaosSpam:'for(let i=0;i<12;i++)__smear.chaos()',addDummy:'for(let i=0;i<12;i++)__smear.add()',switch:'__smear.tool(2);__smear.tool(0);__smear.tool(1)',reset:'__smear.reset()',demo:'__smear.demo();__smear.tool(1)'})){
  const r=await pistol(action);receipt.pistol[name]=r;assert.equal(r.flash,false,name+' retained flash');assert(r.slide<.0001,name+' retained recoil');assert.equal(r.nextShot,2,name+' blocked new shot');
 }
 receipt.checks.push('Pistol flash and slide settle within 350 ms after Chaos, repeated Chaos, Add dummy spam, rapid weapon switches, Reset and demo; firing remains available');
 await page.eval('__smear.manual(true)');await page.shot(resolve(out,'pistol-recovered.png'));receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE momentum and weapon lifecycle checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,beforeSpeed:receipt.before.flight[3].v[0],afterSpeed:heavy.flight[3].v[0],pistol:receipt.pistol},null,2));
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{receipt.logs=page.logs;fs.writeFileSync(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
