import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {launch,until} from './cdp.mjs';
const round=process.argv[2]||'round-01',out=resolve('tools/out/dummy-pass',round);
await mkdir(out,{recursive:true});await copyFile('index.html',resolve(out,'build.html'));
const page=await launch({port:9613,width:1440,height:1440}),receipt={round,started:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid};
try{
 const boot=Date.now();await page.goto(pathToFileURL(resolve(out,'build.html')).href);
 await until(async()=>{const status=await page.eval('({ready:!!window.__smearComputeReady,failure:document.getElementById("failure")?.textContent,failed:document.getElementById("failure")?.style.display==="block"})');if(status.failed)throw Error(status.failure);return status.ready;},{timeout:120000,label:'SDF dummy boot'});
 receipt.bootMS=Date.now()-boot;await page.eval('__smear.manual(true);__smear.reset();__smear.tune({walking:false});__smear.step(1)');
 receipt.model=await page.eval('__smearGPU.dummy');receipt.status=await page.eval('__smear.compute.state()');
 receipt.geometry=await page.eval(`(()=>{const g=__smearGPU.renderObjects.find(o=>o.role===5).object.geometry,a=g.attributes,index=g.index.array,edges=new Map();let badWeights=0,inverted=0,degenerate=0,maxEdge=0;const used=new Set();for(let i=0;i<a.position.count;i++){let sum=0;for(let k=0;k<4;k++){const w=a.skinWeight.array[i*4+k],bone=a.skinIndex.array[i*4+k];sum+=w;if(w>0)used.add(bone);if(!Number.isFinite(w)||w<0||w>1||bone<0||bone>14)badWeights++;}if(Math.abs(sum-1)>1e-6)badWeights++;}const T=__smearGPU.THREE;for(let i=0;i<index.length;i+=3){const ids=Array.from(index.slice(i,i+3)),p=ids.map(j=>new T.Vector3().fromBufferAttribute(a.position,j)),n=ids.map(j=>new T.Vector3().fromBufferAttribute(a.normal,j));const cross=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])),area=cross.length();if(area<1e-12)degenerate++;else if(cross.dot(n[0].add(n[1]).add(n[2]))<-.000000001)inverted++;for(let k=0;k<3;k++){const x=ids[k],y=ids[(k+1)%3],key=Math.min(x,y)+':'+Math.max(x,y);edges.set(key,(edges.get(key)||0)+1);maxEdge=Math.max(maxEdge,p[k].distanceTo(p[(k+1)%3]));}}return {badWeights,inverted,degenerate,maxEdge,bones:[...used].sort((a,b)=>a-b),nonManifoldEdges:[...edges.values()].filter(n=>n!==2).length};})()`);
 assert.equal(receipt.geometry.badWeights,0);assert.equal(receipt.geometry.bones.length,15);assert.equal(receipt.geometry.inverted,0);assert.equal(receipt.geometry.degenerate,0);
 if(receipt.geometry.nonManifoldEdges)receipt.topology=await page.eval(`(()=>{const g=__smearGPU.renderObjects.find(o=>o.role===5).object.geometry,a=g.attributes,index=g.index.array,edges=new Map();for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const x=index[i+k],y=index[i+(k+1)%3],key=Math.min(x,y)+':'+Math.max(x,y);edges.set(key,(edges.get(key)||0)+1);}return [...edges].filter(([e,n])=>n!==2).map(([e,n])=>{const i=Number(e.split(':')[0]);let start=0,spec;for(const s of __smearGPU.dummy.stats){if(i>=start&&i<start+s.vertices){spec=s;break;}start+=s.vertices;}return {edge:e,count:n,spec:spec?.name,bone:a.uv.getY(i),point:[a.position.getX(i),a.position.getY(i),a.position.getZ(i)]};});})()`);
 assert.equal(receipt.geometry.nonManifoldEdges,0);
 if(process.argv.includes('--no-outline'))await page.eval(`(()=>{const g=__smearGPU;g.renderObjects.forEach((o,i)=>{if(o.role===6)g.objectData[i*44+36]=180;});g.device.queue.writeBuffer(g.objectBuffer,0,g.objectData);})()`);
 // Static bind-pose inspection is separate from the live physics pose below.
 await page.eval(`(()=>{const g=__smearGPU,a=new Float32Array(180*104);for(let i=0;i<g.sourceBodies.length;i++){const b=g.sourceBodies[i];a.set([...b.restP.toArray().map((v,k)=>v+(k===0?b.doll.spawn.x:k===2?b.doll.spawn.z:0)),b.im],i*104);a.set(b.restQ.toArray(),i*104+4);}g.device.queue.writeBuffer(g.bodyBuffer,0,a);document.querySelectorAll('body>div').forEach(e=>{if(!e.querySelector('canvas'))e.style.opacity='0';});})()`);
 const views={front:[[-2.4,1.02,-.85],[-2.4,1,-2.95]],side:[[-.30,1.02,-2.95],[-2.4,1,-2.95]],back:[[-2.4,1.02,-5.05],[-2.4,1,-2.95]],threequarter:[[-1.1,1.28,-1.30],[-2.4,1,-2.95]],head:[[-2.05,1.75,-2.48],[-2.4,1.73,-2.95]],hand:[[-2.65,.83,-2.58],[-2.78,.80,-2.95]]};
 for(const[name,[p,t]]of Object.entries(views)){await page.eval(`__smear.view(${JSON.stringify(p)},${JSON.stringify(t)});__smearGPU.device.queue.onSubmittedWorkDone()`);await page.shot(resolve(out,name+'.png'));}
 receipt.poses=[];
 for(const pose of [
  {name:'reach',height:.985,rotations:{0:[.12,0,0],2:[-.10,.5,.12],3:[0,0,-1.05],4:[-1.25,0,0],9:[0,0,.85],10:[-1.10,0,0]}},
  {name:'crouch',height:.80,rotations:{0:[.23,0,0],2:[-.2,0,0],3:[-.45,0,-.1],4:[-1,0,0],9:[-.45,0,.1],10:[-1,0,0],6:[-.68,0,0],7:[1.36,0,0],8:[-.68,0,0],12:[-.68,0,0],13:[1.36,0,0],14:[-.68,0,0]}},
  {name:'neck-waist-flex',height:.985,rotations:{0:[.4,.2,.17],2:[-.5,.55,-.4]}}
 ]){
  const result=await page.eval(`(()=>{const pose=${JSON.stringify(pose)},g=__smearGPU,T=g.THREE,base=15,parts=g.sourceBodies.slice(base,base+15),p=[],q=[],data=new Float32Array(180*104);p[1]=new T.Vector3(-2.4,pose.height,-2.95);q[1]=new T.Quaternion();const pending=g.joints.filter(j=>j.a.id>base&&j.a.id<=base+15).slice();while(pending.length){const at=pending.findIndex(j=>p[j.a.id-base-1]);if(at<0)throw Error('Disconnected inspection rig');const j=pending.splice(at,1)[0],a=j.a.id-base-1,b=j.b.id-base-1,relative=parts[a].restQ.clone().invert().multiply(parts[b].restQ);q[b]=q[a].clone().multiply(relative);if(pose.rotations[b])q[b].multiply(new T.Quaternion().setFromEuler(new T.Euler(...pose.rotations[b])));p[b]=p[a].clone().add(j.pa.clone().applyQuaternion(q[a])).sub(j.pb.clone().applyQuaternion(q[b]));}for(let i=0;i<15;i++){data.set([...p[i].toArray(),parts[i].im],(base+i)*104);data.set(q[i].toArray(),(base+i)*104+4);}g.device.queue.writeBuffer(g.bodyBuffer,0,data);__smear.view([-1.0,1.34,-1.3],[-2.4,1,-2.95]);return {name:pose.name,finite:p.every(v=>v.toArray().every(Number.isFinite)),bones:p.length};})()`);
  assert(result.finite);assert.equal(result.bones,15);receipt.poses.push(result);await page.eval('__smearGPU.device.queue.onSubmittedWorkDone()');await page.shot(resolve(out,pose.name+'.png'));
 }
 await page.eval('__smear.reset();__smear.tune({walking:true});__smear.view([-1,1.9,1.4],[-2.4,1,-2.95]);__smear.step(240)');await page.shot(resolve(out,'walking.png'));
 const state=await page.eval('__smear.compute.state()');assert.deepEqual(state.errors,[]);assert(state.parts.every(p=>p.p.every(Number.isFinite)));
 receipt.result='COMPLETE SDF model views and live rig';console.log(JSON.stringify({result:receipt.result,bootMS:receipt.bootMS,vertices:receipt.model.vertices,triangles:receipt.model.triangles,geometry:receipt.geometry},null,2));
}catch(e){receipt.error=e.stack;process.exitCode=1;console.error(e);}
finally{receipt.logs=page.logs;await writeFile(resolve(out,'inspect.json'),JSON.stringify(receipt,null,2));page.kill();}
