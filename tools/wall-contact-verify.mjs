import {launchComputeBrowser} from './compute-browser.mjs';
import {until} from './cdp.mjs';
import {installWallFixture} from './wall-fixture.mjs';
import {installWallContactFixture} from './wall-contact-fixture.mjs';
import {writeFile,mkdir,readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const before=process.argv.includes('before'),label=before?'before':process.argv.find(x=>/^(round-|final)/.test(x))||'round-01';
const out=resolve('tools/out/wall-contact-pass',label+(process.argv.includes('firefox')?'-firefox':''));await mkdir(out,{recursive:true});
const source=before?'tools/out/wall-contact-pass/before/index.html':'index.html';if(!before)await copyFile(source,resolve(out,'build.html'));
const p=await launchComputeBrowser({port:9651,width:1440,height:1080});const result={startedAt:new Date().toISOString(),browserProfile:p.dir,browserPID:p.proc.pid,buildSHA256:createHash('sha256').update(await readFile(source)).digest('hex'),checks:[],scenes:{}};
try {
 await p.goto(pathToFileURL(resolve(source)).href);await until(async()=>{const s=await p.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});await p.eval('__smear.manual(true)');
 await p.mouse('mousePressed',720,130);await p.mouse('mouseReleased',720,130);await until(()=>p.eval('__smear.compute.audio().state==="running"'),{timeout:5000});
 await installWallFixture(p);await installWallContactFixture(p);
 await p.eval(`(()=>{const g=__smearGPU;window.__readContactPatch=async()=>{const id=__contactPlay.receiver,r=g.records[id],s=g.surfaces[id],d=g.device;const buffer=g.buffer('explicit contact coverage inspection',r.width*r.height*4,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);const e=d.createCommandEncoder();e.copyBufferToBuffer(g.paintBuffer,r.pixelOffset*4,buffer,0,buffer.size);d.queue.submit([e.finish()]);await buffer.mapAsync(GPUMapMode.READ);const data=new Uint32Array(buffer.getMappedRange());let opaque=0,alpha=0,painted=0;const occupied=new Set();for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.width-.5)*s.w).addScaledVector(s.v,((y+.5)/r.height-.5)*s.h);if(id===16&&(p.x< -4.6||p.x> -2.4||p.y<1.4||p.y>2.6))continue;const a=data[x+y*r.width]>>>24;alpha+=a;if(a>0)painted++;if(a>128){opaque++;occupied.add(x+y*r.width);}}let largest=0;while(occupied.size){const start=occupied.values().next().value;occupied.delete(start);const q=[start];for(let i=0;i<q.length;i++)for(const n of [q[i]-1,q[i]+1,q[i]-r.width,q[i]+r.width])if(occupied.delete(n))q.push(n);largest=Math.max(largest,q.length);}buffer.unmap();buffer.destroy();return {opaque,alpha,painted,largest,opaqueM2:opaque/25600,connectedM2:largest/25600};};})()`);
 for(const mode of ['press','drag','block','dry']){
  await p.eval(`__contactPlay.setup('${mode}')`);const samples=[];
  for(let sec=1;sec<=8;sec++){await p.eval('__contactPlay.advance(120)');if([2,4,8].includes(sec)){const state=await p.eval('__smear.state()'),wall=await p.eval('__wallTest.read(__contactPlay.receiver)'),patch=await p.eval('__readContactPatch()');samples.push({sec,body:state.parts[0],wall,patch,maxJoint:state.maxJoint,work:await p.eval('__smearGPU.readWork().then(w=>Array.from(w.slice(23,30)))')});assert.deepEqual(state.errors,[]);assert(state.maxJoint<.15);assert.equal(state.stampOverflow,0);assert.equal(state.tileOverflow,0);await p.shot(resolve(out,mode+'-'+sec+'s.png'));}}
  result.scenes[mode]=samples;await p.eval('__smear.release();__wallTest.hide()');await p.shot(resolve(out,mode+'-paint.png'));console.log(mode+' '+JSON.stringify(samples.map(s=>({sec:s.sec,patch:s.patch,wet:s.body.wet,pools:s.work[1],mobile:s.wall.mobile}))));
 }
 assert.equal(result.scenes.dry.at(-1).wall.painted,0);result.checks.push('Uncoated unwounded real dummy creates no wall paint through eight seconds of dragging');
 if(!before){const base=JSON.parse(await readFile('tools/out/wall-contact-pass/before/verification.json'));
 for(const mode of ['press','drag','block']){const early=result.scenes[mode][1],old=base.scenes[mode][1];assert(early.patch.connectedM2>.045,mode+' must build a cohesive wall patch within two contact seconds');assert(early.patch.opaque>old.patch.opaque*(mode==='block'?1.25:1.5),mode+' improves early opaque wall coverage');assert(early.work[1]>0);result.checks.push('Default '+mode+' produces a broad connected wet wall patch in two contact seconds');}}
 result.checks.push('Actual grab physics remain finite, connected and within paint event capacity');result.errors=p.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(result.errors,[]);result.result='COMPLETE real wall-contact checks';
}catch(e){result.result='FAIL';result.error=e.stack;process.exitCode=1;console.error(e.stack);}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(result,null,2));p.kill();}
