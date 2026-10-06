import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
const label=process.argv[2]||'after',baseline=label==='before',out=resolve('tools/out/art-pass',label);
await mkdir(out,{recursive:true});
const page=await launch({port:9600,width:1920,height:1080});
const receipt={label,checks:[],samples:[],browserProfile:page.dir,browserPID:page.proc.pid,buildSHA256:createHash('sha256').update(await readFile(resolve(baseline?'tools/out/art-pass/before/build.html':'index.html'))).digest('hex')};
try{
 await page.goto(pathToFileURL(resolve(baseline?'tools/out/art-pass/before/build.html':'index.html')).href);
 await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:60000,label:'art gauntlet boot'});
 await page.eval('__smear.manual(true);__smear.reset();__smear.view([1.8,2.4,4.3],[-1,1,-3]);__smear.step(0)');
 const surfaces=await page.eval(`__smearGPU.surfaces.map((s,i)=>{const r=__smearGPU.records[i],T=__smearGPU.THREE;return {id:i,metres:[s.w,s.h],pixels:[r.width,r.height],density:[r.width/s.w,r.height/s.h],normal:s.n.toArray(),corners:[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]].map(([u,v])=>{const expected=s.center.clone().addScaledVector(s.u,u*s.w).addScaledVector(s.v,v*s.h);const rendered=s.mesh.localToWorld(new T.Vector3(u*s.w,-v*s.h,0));return expected.distanceTo(rendered)})}})`);
 receipt.surfaces=surfaces;
 if(!baseline){for(const s of surfaces){assert(s.pixels.every((pixels,axis)=>Math.abs(pixels-s.metres[axis]*160)<=.500001),'nearest-texel allocation '+s.id);assert(s.corners.every(x=>x<1e-5),'surface basis '+s.id);}receipt.checks.push('All '+surfaces.length+' floor/wall/box/ramp receivers target 160 texels/metre, rounded to the nearest texel, with correct corner mapping');}
 let maxJoint=0;
 for(let i=0;i<480;i++){
  const s=await page.eval('__smear.step(6)');maxJoint=Math.max(maxJoint,s.maxJoint);
  assert.deepEqual(s.errors,[]);assert(s.parts.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)));
  receipt.samples.push({time:s.steps/120,parts:s.parts.map(p=>({name:p.name,doll:p.doll,p:p.p,q:p.q,v:p.v,mode:p.mode,target:p.target,gait:p.gait}))});
  if([79,159,239,319,479].includes(i)){await page.shot(resolve(out,'gait-'+Math.round(s.steps/120)+'s.png'));}
 }
 const walk=receipt.samples.flatMap(s=>s.parts.filter(p=>p.doll>0&&/foot$/.test(p.name)));
 const stance=walk.filter(p=>p.gait&&p.gait[1]<.5),swing=walk.filter(p=>p.gait&&p.gait[1]>.5);
 const q=(a,p)=>a.sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))];
 receipt.gait={maxJoint,stanceSamples:stance.length,swingSamples:swing.length,stanceSpeedP95:q(stance.map(p=>Math.hypot(p.v[0],p.v[2])),.95),footSpeedP95:q(walk.map(p=>Math.hypot(p.v[0],p.v[2])),.95),footHeightRange:[Math.min(...walk.map(p=>p.p[1])),Math.max(...walk.map(p=>p.p[1]))],targetErrorP95:q(walk.filter(p=>p.target).map(p=>Math.hypot(...p.p.map((v,i)=>v-p.target[i]))),.95)};
 const grounded=receipt.samples.slice(80).flatMap(s=>s.parts.filter(p=>p.doll>0&&/foot$/.test(p.name)&&p.p[1]<.09).map(p=>Math.hypot(p.v[0],p.v[2])));
 receipt.gait.groundedFootSpeed={samples:grounded.length,p50:q([...grounded],.5),p95:q([...grounded],.95),mean:grounded.reduce((a,b)=>a+b,0)/grounded.length};
 assert(maxJoint<.15,'joint gap '+maxJoint);
 if(!baseline){assert(stance.length>100&&swing.length>100);assert(receipt.gait.targetErrorP95<.10,'foot motor tracking');assert(receipt.gait.stanceSpeedP95<.30,'planted foot slip');}
 receipt.checks.push('24 seconds of finite articulated walking, turning and recovery');
 // Native Spill onto a vertical obstacle, its top, a wall, and the tilted ramp.
 receipt.spills=[];
 for(const id of [16,20,21,22,23,24,30,31]){
  await page.eval(`__smear.reset();__smear.stopBleeding();__smear.tool(2);(()=>{const s=__smearGPU.surfaces[${id}],p=s.center.clone();__smear.view(p.clone().addScaledVector(s.n,1.1).toArray(),p.toArray())})();__smear.pointer(960,540);__smear.step(0)`);
  await page.mouse('mouseMoved',960,540);await page.mouse('mousePressed',960,540);await page.eval('__smear.step(1)');await page.mouse('mouseReleased',960,540);
  const before=await page.eval('__smear.compute.paintHash('+id+')');await page.eval('__smear.step(360)');const after=await page.eval('__smear.compute.paintHash('+id+')');
  receipt.spills.push({id,before,after});assert(before.painted>0,'native Spill on receiver '+id);
  await page.shot(resolve(out,'receiver-'+id+'.png'));
 }
 receipt.checks.push('Native paint hits on wall, every bench face, barrier and tilted ramp');
 receipt.result='COMPLETE art and locomotion gauntlet';console.log(receipt.result);console.log(JSON.stringify(receipt.gait));
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e);process.exitCode=1;}
finally{receipt.browserLogs=page.logs;await writeFile(resolve(out,'art-gauntlet.json'),JSON.stringify(receipt,null,2));page.kill();}
