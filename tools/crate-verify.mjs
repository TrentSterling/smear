import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until} from './cdp.mjs';

const baseline=process.argv.includes('baseline');
const source=baseline?'tools/out/crate-v47-1/before/index.html':'index.html';
const out=resolve('tools/out/crate-v47-1',baseline?'baseline':'fixed');
fs.mkdirSync(out,{recursive:true});
const receipt={at:new Date().toISOString(),sha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),views:[]};
let page;

// Intersect coplanar triangles from different pieces, ignoring shared edges.
// Equal-depth overlapping surfaces are unstable regardless of draw order.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function overlap(a,b){
 const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),m=cross(sub(b[1],b[0]),sub(b[2],b[0]));
 const nl=Math.hypot(...n),ml=Math.hypot(...m);
 if(nl<1e-10||ml<1e-10||dot(n,m)/(nl*ml)<1-1e-7)return 0;
 if(b.some(p=>Math.abs(dot(n,sub(p,a[0]))/nl)>1e-6))return 0;
 const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
 const project=p=>p.filter((_,i)=>i!==axis),clip=b.map(project);
 let polygon=a.map(project);
 const side=(p,u,v)=>(v[0]-u[0])*(p[1]-u[1])-(v[1]-u[1])*(p[0]-u[0]);
 const winding=Math.sign(side(clip[2],clip[0],clip[1]));
 for(let i=0;i<3&&polygon.length;i++){
  const u=clip[i],v=clip[(i+1)%3],next=[];
  for(let j=0;j<polygon.length;j++){
   const p=polygon[j],q=polygon[(j+1)%polygon.length],dp=side(p,u,v)*winding,dq=side(q,u,v)*winding;
   if(dp>=0)next.push(p);
   if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push(p.map((x,k)=>x+(q[k]-x)*t));}
  }
  polygon=next;
 }
 return Math.abs(polygon.reduce((s,p,i)=>{const q=polygon[(i+1)%polygon.length];return s+p[0]*q[1]-p[1]*q[0];},0))*.5;
}

try{
 page=await launch({port:9798,width:1600,height:1000});receipt.profile=page.dir;
 await page.goto(pathToFileURL(resolve(source)).href+'?defaults=1');
 await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});
 await page.eval('__smear.manual(true);__smear.tool(0)');
 const meshes=await page.eval(`(()=>{const g=__smearGPU,T=g.THREE,origin=g.props[0].box.p;g.scene.updateMatrixWorld(true);return g.scene.children.filter(m=>m.userData.prop?.id===0).map(m=>{const geo=m.geometry,p=geo.attributes.position,idx=geo.index.array,triangles=[];for(let i=0;i<idx.length;i+=3)triangles.push([0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx[i+k]).applyMatrix4(m.matrixWorld).sub(origin).toArray()));return triangles;});})()`);
 const overlaps=[];
 for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++)for(const a of meshes[i])for(const b of meshes[j]){
  const area=overlap(a,b);if(area>1e-8)overlaps.push({pieces:[i,j],area});
 }
 receipt.coplanarOverlaps=overlaps;
 if(baseline)assert(overlaps.length>0,'The released crate must reproduce the equal-depth overlap');
 else assert.equal(overlaps.length,0,'Crate pieces must not have overlapping coplanar outward faces');
 for(const [name,offset]of [['front',[1,.75,1.95]],['back',[-1,.75,-1.95]],['top',[.8,2,.8]],['grazing',[1.75,.3,.7]]]){
  await page.eval(`(async()=>{const p=__smearGPU.props[0].position,o=${JSON.stringify(offset)};__smear.view(p.map((x,i)=>x+o[i]),p);await __smear.step(0);})()`);
  const uri=await page.eval('(async()=>{await __smearGPU.device.queue.onSubmittedWorkDone();return __smearGPU.canvas.toDataURL("image/png");})()');
  fs.writeFileSync(resolve(out,name+'.png'),Buffer.from(uri.split(',')[1],'base64'));receipt.views.push(name);
 }
 assert.deepEqual(await page.eval('__smearGPU.errors'),[]);
 assert(!page.logs.some(x=>/^error:|^EXCEPTION:/.test(x)),page.logs.join('\n'));
 receipt.result=`COMPLETE ${baseline?'baseline reproduces '+overlaps.length+' coplanar overlaps':'crate has zero coplanar overlaps'}; four hardware GPU inspection views`;
 console.log(receipt.result);
}catch(e){receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}
finally{page?.kill();fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
