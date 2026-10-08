import fs from 'node:fs';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';import {installBatFixture} from './bat-fixture.mjs';
const label=process.argv[2]||'current',baseline=label==='before',file=baseline?'tools/out/bat-v42-pass/before/index.html':'index.html',out=resolve('tools/out/bat-v42-pass/'+label);fs.mkdirSync(out,{recursive:true});
const receipt={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),checks:[],series:[]};let page;
try{
 page=await launch({port:9792,width:1600,height:1000,headless:true});receipt.profile=page.dir;await page.goto(process.env.SMEAR_TEST_URL||pathToFileURL(resolve(file)).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');await page.mouse('mousePressed',800,120);await page.mouse('mouseReleased',800,120);await installBatFixture(page);
 for(const variant of [0,1,2])for(const part of [2,0,4,1]){
  const scenario={variant,part};await page.eval('__batTest.setup('+JSON.stringify(scenario)+')');const start=await page.eval('__batTest.snapshot()'),hits=[];
  for(let n=0;n<9;n++){const hit=await page.eval('__batTest.hit()');hits.push(hit);assert.equal(hit.hits,n+1,'each swing connects exactly once');if(hit.cuts.length)break;}
  receipt.series.push({scenario,start,hits});console.log('variant '+variant+' part '+part+': first separation at '+hits.length+' hits; cuts '+hits.at(-1).cuts.join(','));
  assert(hits[0].reserve<start.reserve);assert(hits[0].particles>0);assert(hits[0].speeds.slice(variant*15,variant*15+15).every(v=>v>4));assert.deepEqual(hits[0].errors,[]);
  if(!baseline){assert(hits.length>=4&&hits.length<=6,'fresh joint takes 4-6 focused default hits');assert.equal(hits.at(-1).cuts.length,1,'one focused joint separates');assert(hits.slice(0,-1).every(h=>h.cuts.length===0));}
 }
 receipt.checks.push('Focused head, torso, forearm and pelvis hits across all three dummy builds retain knockback, wounds and finite spray; repeated hits accumulate localized joint damage');
 for(const scenario of [{damage:2.5,fragility:2},{damage:0,fragility:2}]){
  await page.eval('__batTest.setup('+JSON.stringify(scenario)+')');const hits=[];for(let n=0;n<3;n++)hits.push(await page.eval('__batTest.hit()'));receipt.series.push({scenario,hits});
  if(!baseline){assert(hits.slice(0,2).every(h=>h.cuts.length===0));assert.equal(hits.at(-1).cuts.length,scenario.damage?1:0);}
 }
 receipt.checks.push('Maximum damage/fragility still needs three hits on a fresh joint; zero damage never severs');
 await page.eval('__batTest.setup()');await page.eval('__smear.manual(false)');await page.mouse('mousePressed',800,500);await page.mouse('mouseReleased',800,500);await sleep(2200);await page.eval('__smear.manual(true)');receipt.native=await page.eval('__batTest.snapshot()');
 assert.equal(receipt.native.swings,1);assert.equal(receipt.native.hits,1);assert.equal(receipt.native.cuts.length,0);assert(receipt.native.maxJoint<.16);await page.shot(resolve(out,'single-whack.png'));receipt.checks.push('One native mouse click applies one strike; the knocked-down rig remains joined after two seconds of real-time collisions');
 receipt.audio=await page.eval('__smear.compute.audio()');assert(receipt.audio.enabled&&receipt.audio.state==='running');receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE bat durability checks';console.log(receipt.result);
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{if(page)page.kill();fs.writeFileSync(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');}
