import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';

const fallback=process.argv[2]==='fallback';
const out=resolve('tools/out',fallback?'paint-verify-fallback':'paint-verify');await mkdir(out,{recursive:true});
const audit=`()=>{
 const sc=new T.Scene(),cam=new T.Camera(),geo=new T.PlaneGeometry(2,2);
 const mat=new T.ShaderMaterial({uniforms:{uSource:{value:null}},vertexShader:'varying vec2 vTex;void main(){vTex=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D uSource;varying vec2 vTex;void main(){gl_FragColor=texture2D(uSource,vTex);}',depthTest:false,depthWrite:false,blending:T.NoBlending});
 const quad=new T.Mesh(geo,mat);quad.frustumCulled=false;sc.add(quad);
 const previous=renderer.getRenderTarget(),rt=new T.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
 let pixels=0,mismatches=0,maxDelta=0;const failures=[];
 try{for(const s of surfaces){
  // Rendering this pass uses the existing texture. It does not mark it dirty.
  rt.setSize(s.res,s.res);mat.uniforms.uSource.value=s.tex;renderer.setRenderTarget(rt);renderer.render(sc,cam);
  const actual=new Uint8Array(s.res*s.res*4);renderer.readRenderTargetPixels(rt,0,0,s.res,s.res,actual);
  const expected=s.g.getImageData(0,0,s.res,s.res).data;let missed=0;
  for(let y=0;y<s.res;y++)for(let x=0;x<s.res;x++){
   const a=(y*s.res+x)*4,b=((s.res-1-y)*s.res+x)*4;let d=Math.abs(actual[a+3]-expected[b+3]);
   for(let c=0;c<3;c++)d=Math.max(d,Math.abs(actual[a+c]*actual[a+3]/255-expected[b+c]*expected[b+3]/255));
   if(d>2)missed++;maxDelta=Math.max(maxDelta,d);pixels++;
  }mismatches+=missed;if(missed)failures.push({surface:s.id,missed});
 }}finally{renderer.setRenderTarget(previous);rt.dispose();geo.dispose();mat.dispose();renderNow();}
 return{pixels,mismatches,maxDelta,failures,copyCanvases:paintCopies.size};
}`;
const source=(await readFile('index.html','utf8')).replace('if(s.textureReady&&renderer.capabilities.isWebGL2){',fallback?'if(false){':'if(s.textureReady&&renderer.capabilities.isWebGL2){');
const edgePaint=`()=>{for(const s of surfaces){renderer.initTexture(s.tex);for(let i=0;i<12;i++){const rx=[.023,.04,.14,.34][i%4],ry=i%2?.023:rx,x=i%3===0?.02:i%3===1?s.w-.02:s.w*.5,y=i%2?.02:s.h-.02;const a={x,y,rx,ry,angle:i*.7},b={...a,x:x+.015,y:y-.012,angle:a.angle+.04};s.patchUV(a,b,1.3,5000+i*137,i*.02,1);}uploadPaintRegion(s);}}`;
await writeFile(resolve(out,'runtime.html'),source.replace('window.__smear={state,',`window.__smear={auditPaint:${audit},edgePaint:${edgePaint},state,`));
const page=await launch({port:9592,width:1366,height:768});
const receipt={path:fallback?'WebGL 1-compatible region copies':'WebGL 2 direct subrects',checks:[],audits:[]};
function pass(name,test){test();receipt.checks.push(name);console.log('PASS '+name);}
try{
 await page.init('window.requestAnimationFrame=()=>0');
 await page.goto(pathToFileURL(resolve(out,'runtime.html')).href);
 await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'paint verification boot'});
 await page.eval('window.__smear.manual(true);window.__smear.preset("default")');
 for(const [name,setup]of [
  ['smear demo',`a.trace(60,14);`],
  ['tile seams and borders',`a.reset();a.tune({walking:false,recover:false});a.moveDoll(0,[-1.5,.15,1.7]);for(const name of ['Torso','Hips','Head','Left shin','Right shin'])for(const n of [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,1);a.grab(0,'Torso');for(let i=0;i<480;i++){a.target([-2.5+5*(1-Math.cos(i/60*2.2))*.5,-.24,1.5+Math.sin(i/60*2.8)*.6]);a.rawStep(2);a.render();}a.release();`],
  ['small edge brushes and tall faces',`a.clean();for(let i=0;i<24;i++)a.render();a.edgePaint();`],
  ['wall drips and rotated faces',`a.reset();a.wallSpill('front');a.wallSpill('divider');a.wallSpill('left');a.step(480);`],
  ['clean and repaint',`a.clean();a.puddle([.05,0,.05],.7,1);a.puddle([-7.7,0,7.7],.8,1);a.puddle([7.7,0,-7.7],.8,1);`],
  ['complete clear',`a.clean();`]
 ]){
  await page.eval(`(()=>{const a=window.__smear;${setup}for(let i=0;i<24;i++)a.render();})()`);
  const r=await page.eval('window.__smear.auditPaint()');receipt.audits.push({name,...r});
  pass(`GPU paint matches retained canvas after ${name}`,()=>assert.equal(r.mismatches,0,JSON.stringify(r)));
  await page.shot(resolve(out,name.replaceAll(' ','-')+'.png'));
 }
 pass('region copy canvases are reused within a bounded set',()=>assert(receipt.audits.at(-1).copyCanvases<=32));
 const glError=await page.eval('document.getElementById("world").getContext("webgl2").getError()');pass('no WebGL errors after cropped uploads and wet-map updates',()=>assert.equal(glError,0));
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));pass('no painting browser exceptions or errors',()=>assert.deepEqual(receipt.errors,[]));
 receipt.result='COMPLETE painting checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
