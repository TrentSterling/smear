// Isolate replay rasterization from transport, scheduling, and simulation changes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';

const out=resolve('tools/out/recovery-raster-probe');await mkdir(out,{recursive:true});
let source=execFileSync('git',['show','4c5289a:index.html'],{encoding:'utf8',maxBuffer:2000000});
const hook=`window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.paintDelay=0;const NativeWorker=Worker;window.Worker=class extends NativeWorker{postMessage(m,t){if(paintDelay&&m.ops?.length)setTimeout(()=>super.postMessage(m,t),paintDelay);else super.postMessage(m,t);}};`;
const before=`for(const s of records.values())snapshotCanvas(s);
  if(!window.replayProbe){const ids=new Set(pending.map(o=>o[0]));window.replayProbe={ops:structuredClone(pending),records:Array.from(ids,id=>{const s=records.get(id);return{id,width:s.canvas.width,height:s.canvas.height,w:s.w,h:s.h,res:s.res,seed:s.g.getImageData(0,0,s.canvas.width,s.canvas.height).data};})};}`;
source=source.replace('for(const s of records.values())snapshotCanvas(s);',before);
source=source.replace('settle();\n }\n function apply(',`if(window.replayProbe&&!window.replayProbe.expected){window.replayProbe.expected=window.replayProbe.records.map(d=>({id:d.id,pixels:records.get(d.id).g.getImageData(0,0,d.width,d.height).data}));}\n  settle();\n }\n function apply(`);
assert(source.includes('window.replayProbe.expected='));
const fixture=`const replayRasterQA={
 setup:()=>{manual=true;preset('default');applyTuning({walking:false,recover:false});resetWorld(true);for(const d of dolls)knockDown(d,60);for(const part of dolls[0].parts){for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])wetBody(part,new V(...n),.85,new V(...n).multiply(part.half),.15);addWound(part,new V(0,0,part.half.z),new V(0,0,1),null,true);}const b=dolls[0].byName.Torso,p=b.p.clone();grab={body:b,local:new V(),target:p.clone(),desired:p.clone(),distance:4,manual:true};},
 tick:i=>{grab.desired.set(-2.3+4.6*(1-Math.cos(i/60*1.9))*.5,-.24,1.5+Math.sin(i/60*2.4)*.65);physicsStep();physicsStep();renderNow();},
 compare:async options=>{const rasterOptions={willReadFrequently:false},code='const PI=Math.PI,TAU=PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rasterOptions={willReadFrequently:false};const document={createElement:()=>new OffscreenCanvas(160,160)},brushes=[],bristleCache=new Map();'+[hash,patchBristles,createBrushes,rasterSplat,rasterPatch,rasterDrip,rasterSkin,rasterBullet,rasterCommand].map(f=>f.toString()).join('\\n')+';createBrushes(rasterOptions);onmessage=e=>{const {ops,records,options}=e.data,map=new Map();for(const d of records){const canvas=new OffscreenCanvas(d.width,d.height),g=options===null?canvas.getContext("2d"):canvas.getContext("2d",options);g.putImageData(new ImageData(d.seed,d.width,d.height),0,0);map.set(d.id,{...d,canvas,g});}for(const [id,epoch,kind,args]of ops){if(kind!=="present")rasterCommand(map.get(id),kind,args);}const images=records.map(d=>({id:d.id,pixels:map.get(d.id).g.getImageData(0,0,d.width,d.height).data}));postMessage({images},images.map(d=>d.pixels.buffer));};';
 const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new NativeWorker(url);URL.revokeObjectURL(url);
 try{const result=await new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(Error(e.message));worker.postMessage({...replayProbe,options});});let changed=0,overTwo=0,maxDelta=0;const images=[];for(let k=0;k<result.images.length;k++){const a=result.images[k].pixels,b=replayProbe.expected[k].pixels;let count=0,over=0,max=0;for(let i=0;i<a.length;i+=4){let d=Math.abs(a[i+3]-b[i+3]);for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255));if(d){count++;changed++;}if(d>2){over++;overTwo++;}max=Math.max(max,d);maxDelta=Math.max(maxDelta,d);}if(count)images.push({id:result.images[k].id,changed:count,overTwo:over,maxDelta:max});}return{options,events:replayProbe.ops.length,records:result.images.length,changed,overTwo,maxDelta,images};}finally{worker.terminate();}}
};`;
const file=resolve(out,'runtime.html');await writeFile(file,source.replace('</head>','<script>'+hook+'</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={replayRasterQA,state,'));
const page=await launch({port:9597,width:1280,height:720});
try{
 await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'));
 await page.eval(`(async()=>{const a=__smear,b=a.replayRasterQA;b.setup();for(let i=0;i<100;i++){await new Promise(r=>nativeRAF(r));b.tick(i);}await a.paintReady(false);paintDelay=3000;for(let i=100;i<600&&!window.replayProbe;i++){await new Promise(r=>nativeRAF(r));b.tick(i);}paintDelay=0;})()`);
 assert(await page.eval('!!window.replayProbe?.expected'),'reference must reach actual overload and capture replay');
 const results=[];for(const options of [null,{willReadFrequently:false},{willReadFrequently:true}]){const result=await page.eval('__smear.replayRasterQA.compare('+JSON.stringify(options)+')');results.push(result);console.log(JSON.stringify(result));}
 const errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(errors,[]);await writeFile(resolve(out,'summary.json'),JSON.stringify({results,errors},null,2)+'\n');console.log('COMPLETE isolated recovery raster probes recorded');
}finally{page.kill();}
