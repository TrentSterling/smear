// Fixed-tick movement inspection. Explicit pose reads are confined to this harness.
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {launch,until} from './cdp.mjs';
const label=process.argv[2]||'candidate',out=resolve('tools/out/motion-pass',label);
await mkdir(out,{recursive:true});await copyFile('index.html',resolve(out,'build.html'));
const page=await launch({port:9615,width:1440,height:1080}),receipt={label,started:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid,cases:[]};
const rotate=(q,p)=>{const [x,y,z,w]=q,[a,b,c]=p,tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const corr=(a,b)=>{const mean=v=>v.reduce((s,x)=>s+x,0)/v.length,ma=mean(a),mb=mean(b);return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)*b.reduce((s,x)=>s+(x-mb)**2,0));};
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
 await page.eval('__smear.manual(true)');await page.mouse('mousePressed',720,130);await page.mouse('mouseReleased',720,130);
 for(const scenario of process.argv.includes('--gauntlet')?['walk','recover','prone','side','turned','interrupt']:['walk','recover']){
  await page.eval(`__smear.reset();__smear.tune({walking:${scenario==='walk'},recover:true});__smear.view(${scenario==='walk'?'[-.8,1.6,.6],[-2.3,1,-2.7]':'[2.6,1.35,2.7],[0,.65,0]'});__smear.step(0)`);
  if(['prone','side','turned'].includes(scenario))await page.eval(`(async()=>{const g=__smearGPU,T=g.THREE,b=g.buffer('explicit motion fixture',g.bodyBuffer.size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=g.device.createCommandEncoder();e.copyBufferToBuffer(g.bodyBuffer,0,b,0,b.size);g.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Float32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();const tilt=new T.Quaternion().setFromAxisAngle(new T.Vector3(${scenario==='side'?'0,0,1':'1,0,0'}),${scenario==='turned'?'-Math.PI/2':'Math.PI/2'}),yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),${scenario==='turned'?'1.37':scenario==='prone'?'-1.1':'.7'}),q=yaw.multiply(tilt),origin=g.sourceBodies[1].restP;for(let i=0;i<15;i++){const s=g.sourceBodies[i],p=s.restP.clone().sub(origin).applyQuaternion(q).add(new T.Vector3(-.12,.25,.45)),r=q.clone().multiply(s.restQ);a.set(p.toArray(),i*104);a.set(r.toArray(),i*104+4);a.fill(0,i*104+8,i*104+16);a[i*104+75]=0;a[i*104+46]=0;}g.device.queue.writeBuffer(g.bodyBuffer,0,a);await g.device.queue.onSubmittedWorkDone();})()`);
  if(['prone','side','turned'].includes(scenario))await page.eval('__smear.tune({recover:false});__smear.step(120);__smear.tune({recover:true})');
  if(scenario!=='walk')await page.eval('__smear.heal();__smear.step(0)');
  const initial=await page.eval('__smear.compute.state()'),heading=sub(initial.parts[2].p,initial.parts[1].p),expectedYaw=Math.atan2(heading[0],heading[2]);
  const samples=[];let maxJoint=0;
  for(let i=0;i<240;i++){
   if(scenario==='interrupt'&&i===18)await page.eval('__smear.grab(0,"Torso")');
   if(scenario==='interrupt'&&i===28)await page.eval('__smear.release()');
   const s=await page.eval('__smear.step(12)');assert.deepEqual(s.errors,[]);assert(s.parts.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)));maxJoint=Math.max(maxJoint,s.maxJoint);
   if(scenario==='interrupt'&&i>=18&&i<28)assert(s.parts.slice(0,15).every(p=>p.mode===0),'Held dummy must release its recovery motors');
   samples.push({time:(s.steps-initial.steps)/120,parts:s.parts});
   if(scenario==='walk'&&[40,43,46,49,52,55,58,61,70,90,120,170,230].includes(i)||scenario==='recover'&&i<65&&i%5===0||scenario!=='walk'&&[10,20,30,50,100,150,230].includes(i))await page.shot(resolve(out,scenario+'-'+String(i).padStart(3,'0')+'.png'));
  }
  const result={name:scenario,maxJoint,samples};
  if(scenario==='walk'){
   const a=[],b=[];for(const s of samples){const p=s.parts.slice(15,30),f=rotate(p[1].q,[0,0,1]);if(Math.hypot(p[1].v[0],p[1].v[2])>.3){a.push(dot(sub(p[8].p,p[14].p),f));b.push(dot(sub(p[5].p,p[11].p),f));}}
   result.armLegCorrelation=corr(a,b);result.movingSamples=a.length;
   if(process.argv.includes('--gauntlet'))assert(result.armLegCorrelation<-.8,'Opposite arm and leg must stay synchronized');
  }else{
   result.recoveredAt=samples.find(s=>s.parts[1].p[1]>.85&&rotate(s.parts[0].q,[0,1,0])[1]>.9)?.time??null;
   result.peakSpeed=Math.max(...samples.flatMap(s=>s.parts.slice(0,15).map(p=>Math.hypot(...p.v))));
   result.supportSamples=samples.filter(s=>s.parts[1].p[1]<.65&&s.parts[1].p[1]>.2&&s.parts[5].p[1]<.14&&s.parts[11].p[1]<.14).length;
   const final=samples.at(-1).parts,forward=rotate(final[1].q,[0,0,1]),finalYaw=Math.atan2(forward[0],forward[2]);result.headingError=Math.abs(Math.atan2(Math.sin(finalYaw-expectedYaw),Math.cos(finalYaw-expectedYaw)));
   result.timeline=samples.filter((_,i)=>i%5===0&&i<65).map(s=>({t:s.time,mode:s.parts[1].mode,hip:s.parts[1].p,chestUp:rotate(s.parts[0].q,[0,1,0])[1],hands:[s.parts[5].p[1],s.parts[11].p[1]]}));
   if(process.argv.includes('--gauntlet')){assert(result.recoveredAt!==null,'Recovery must finish: '+scenario);assert(final[1].p[1]>.9&&final[1].mode===2,'Final upright pose: '+scenario);if(scenario!=='interrupt')assert(result.headingError<.15,'Recovery must preserve fallen heading: '+scenario);if(scenario==='recover')assert(result.supportSamples>=3,'Hands must reach the floor before rising');}
  }
  receipt.cases.push(result);console.log(JSON.stringify({...result,samples:undefined,timeline:undefined}));
 }
 receipt.result='COMPLETE motion inspection';console.log(receipt.result+' ('+receipt.cases.length+' scenarios)');
}catch(e){receipt.error=e.stack;process.exitCode=1;console.error(e);}
finally{receipt.logs=page.logs;await writeFile(resolve(out,'motion.json'),JSON.stringify(receipt,null,2)+'\n','utf8');page.kill();}
