import fs from 'node:fs';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launch,until} from './cdp.mjs';import {installUtilityFixture} from './utility-fixture.mjs';
const before=process.argv.includes('--before'),file=resolve(before?'tools/out/usability-pass/before/index.html':'index.html'),out=resolve('tools/out/usability-pass/ceiling-'+(before?'before':'after'));fs.mkdirSync(out,{recursive:true});
const r={buildSHA256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),cases:[],checks:[]};let page;
try{
 page=await launch({port:9791,width:1600,height:1000,headless:true});r.profile=page.dir;await page.goto(pathToFileURL(file).href+'?defaults=1');await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await installUtilityFixture(page);
 await page.eval(`window.__ceiling={
 async props(){return __smear.props();},
 async rig(){await __utilityTest.reset();const g=__smearGPU,d=g.device,a=new Float32Array(await __destructionFixture.read(g.seedBuffer,0,g.seedBuffer.size));for(let i=0;i<15;i++){const o=i*104;a[o]-=3;a[o+1]+=2.35;a[o+2]+=5;a.set([0,21,0,0],o+8);a.fill(0,o+12,o+16);a[o+44]=1;a[o+75]=0;}d.queue.writeBuffer(g.bodyBuffer,0,a);g.bodyCount=15;g.syncCounts();},
 async top(){const g=__smearGPU,a=new Float32Array(await __destructionFixture.read(g.bodyBuffer,0,15*104*4));let top=-Infinity;for(let i=0;i<15;i++){const o=i*104,q=new g.THREE.Quaternion(...a.slice(o+4,o+8));for(let j=0;j<a[o+27];j++){const k=o+56+j*4,p=new g.THREE.Vector3(...a.slice(k,k+3)).applyQuaternion(q);top=Math.max(top,p.y+a[o+1]+a[k+3]);}}return top;}
 };`);
 for(const [kind,id]of [['crate',0],['barrel',3]])for(const angle of [0,.4,.8]){
  await page.eval(`__utilityTest.reset();`);await page.eval(`__utilityTest.pose(${id},[-3,3.55,5],[0,0,${Math.sin(angle/2)},${Math.cos(angle/2)}],[0,21,0])`);
  let peak=0;for(let i=0;i<24;i++){await page.eval('__utilityTest.advance(5)');const s=(await page.eval('__smear.props()'))[id];peak=Math.max(peak,s.p[1]);}
  await page.eval('__utilityTest.advance(300)');const final=(await page.eval('__smear.props()'))[id];r.cases.push({kind,angle,peak,final});console.log(kind,angle,peak,final.p);
 }
 await page.eval('__utilityTest.reset()');await page.eval('__utilityTest.pose(0,[-3,3.7,5])');await page.eval(`window.__originalInput=__smearGPU.input;__smearGPU.input=()=>({...__originalInput(),body:180,held:true,grabID:1,local:[0,0,0],target:[-3,6.3,5]});__utilityTest.advance(360)`);
 r.held=(await page.eval('__smear.props()'))[0];await page.eval('__smearGPU.input=__originalInput;__utilityTest.advance(360)');r.released=(await page.eval('__smear.props()'))[0];await page.eval('__smear.view([-3,2,7],[-3,4.3,5]);__smear.render()');await page.shot(resolve(out,'ceiling-crate.png'));
 await page.eval('__ceiling.rig()');let peak=0;for(let i=0;i<30;i++){await page.eval('__utilityTest.advance(4)');peak=Math.max(peak,await page.eval('__ceiling.top()'));}await page.eval('__utilityTest.advance(360)');r.rig={peak,finalTop:await page.eval('__ceiling.top()'),parts:(await page.eval('__smear.state()')).parts};
 await page.eval('__ceiling.rig()');await page.eval('__smear.grab(0,"Torso")');await page.eval('__smear.target([-3,6.3,5]);__utilityTest.advance(360)');r.rig.heldTop=await page.eval('__ceiling.top()');await page.eval('__smear.release(false);__utilityTest.advance(360)');r.rig.releasedTop=await page.eval('__ceiling.top()');
 r.failures=[];for(const c of r.cases)if(!c.final.active||c.final.p[1]>1.4||c.peak>5.15)r.failures.push(c.kind+' angle '+c.angle+' trapped/escaped');if(r.released.p[1]>1.4)r.failures.push('held crate trapped after release');if(r.rig.finalTop>3||r.rig.peak>5.15)r.failures.push('rig trapped/escaped');
 if(r.rig.releasedTop>3||r.rig.heldTop>5.15)r.failures.push('held rig escaped/stuck');r.errors=page.logs.filter(x=>/^EXCEPTION:|^error:/i.test(x));assert.deepEqual(r.errors,[]);if(!before)assert.deepEqual(r.failures,[]);r.result=before?'Recorded V38 negative control':'COMPLETE ceiling impacts and held-release checks';console.log(JSON.stringify({result:r.result,failures:r.failures,rig:r.rig.peak,final:r.rig.finalTop,held:r.held.p,released:r.released.p,heldRig:r.rig.heldTop,releasedRig:r.rig.releasedTop}));
}catch(e){r.error=e.stack;r.result='FAIL';console.error(e);process.exitCode=1;}finally{fs.writeFileSync(resolve(out,'verification.json'),JSON.stringify(r,null,2));page?.kill();}
