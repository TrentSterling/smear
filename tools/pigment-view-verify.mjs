// Compare actual game pixels with the frozen V8.7 renderer, including blank aliases.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
const firefox=process.argv[2]==='firefox',out=resolve('tools/out','pigment-view-'+(firefox?'firefox':'chrome'));await mkdir(out,{recursive:true});
const baseline=execFileSync('git',['show','daa668f:index.html'],{encoding:'utf8',maxBuffer:2000000}),candidate=await readFile('index.html','utf8');
const fixture=`const pigmentViewQA={
 setup:async which=>{const a=__smear;manual=true;preset('default');applyTuning({walking:false,recover:false});resetWorld();
  if(which!=='room'){a.puddle([0,0,0],.7);a.wallSpill('front');for(const b of dolls[0].parts)for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,b.name,n,.8);renderNow();await a.paintReady();}
  if(which==='smearing'){a.demo();for(let i=0;i<240;i++){physicsStep();if(i%8===7){renderNow();await a.paintReady(false);}}}
  if(which==='clean')a.clean();
  if(which==='wash')a.wash();
  if(which==='clean-repaint'){a.clean();a.puddle([2,0,2],.4);a.bodyPaint(0,'Torso',[0,0,1],.5);}
  if(which==='reset')a.reset();
  renderNow();await a.paintReady();renderNow();},
 pixels:async()=>{renderNow();const gl=renderer.getContext(),data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);const bytes=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));const painted=[...surfaces,...bodies.filter(b=>b.skinPaint).map(b=>b.skinPaint)];return{pixels:btoa(str),textures:renderer.info.memory.textures,blankAliases:painted.filter(s=>s.paintVisible===false).length,records:painted.length};}
};`;
const page=firefox?await launchFirefox({width:1920,height:1080}):await launch({port:9598,width:1920,height:1080});
const receipt={baselineSha256:createHash('sha256').update(baseline).digest('hex'),candidateSha256:createHash('sha256').update(candidate).digest('hex'),browser:firefox?'Firefox':'Chrome',checks:[]};
try{
 for(const which of ['room','paint','smearing','clean','wash','clean-repaint','reset']){
  const runs=[];for(const [label,source]of [['baseline',baseline],['candidate',candidate]]){const file=resolve(out,label+'.html');await writeFile(file,source.replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={pigmentViewQA,state,'));await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear'),{label:'pigment view boot'});await page.eval(`__smear.pigmentViewQA.setup('${which}')`);const r=await page.eval('__smear.pigmentViewQA.pixels()');r.data=inflateSync(Buffer.from(r.pixels,'base64'));delete r.pixels;runs.push(r);}
  const [b,a]=runs;assert.equal(a.data.length,b.data.length);let mismatches=0,maxDelta=0;for(let i=0;i<a.data.length;i++){const d=Math.abs(a.data[i]-b.data[i]);if(d>2)mismatches++;maxDelta=Math.max(maxDelta,d);}assert.equal(mismatches,0,which+': rendered channel differences >2');assert(a.blankAliases>0);if(which==='room'||which==='reset')assert(a.textures<b.textures,'blank room must allocate fewer GPU textures');
  const r={which,mismatches,maxDelta,baselineTextures:b.textures,candidateTextures:a.textures,blankAliases:a.blankAliases,records:a.records,pixelSha256:createHash('sha256').update(a.data).digest('hex')};receipt.checks.push(r);console.log('PASS pigment, blank surfaces and actual game pixels: '+JSON.stringify(r));
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE pigment presentation preservation checks passed';console.log(receipt.result);
}finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
