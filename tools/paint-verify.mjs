import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';

const fallback=process.argv[2]==='fallback';
const firefox=process.argv[2]==='firefox';
const out=resolve('tools/out',firefox?'paint-verify-firefox':fallback?'paint-verify-fallback':'paint-verify');await mkdir(out,{recursive:true});
const audit=`()=>{
 const sc=new T.Scene(),cam=new T.Camera(),geo=new T.PlaneGeometry(2,2);
 const mat=new T.ShaderMaterial({uniforms:{uSource:{value:null}},vertexShader:'varying vec2 vTex;void main(){vTex=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D uSource;varying vec2 vTex;void main(){gl_FragColor=texture2D(uSource,vTex);}',depthTest:false,depthWrite:false,blending:T.NoBlending});
 const quad=new T.Mesh(geo,mat);quad.frustumCulled=false;sc.add(quad);
 const previous=renderer.getRenderTarget(),rt=new T.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
 let pixels=0,mismatches=0,maxDelta=0;const failures=[];
 const textures=[...surfaces.map(s=>({id:s.id,canvas:s.canvas,g:s.g,tex:s.tex})),...bodies.filter(b=>b.skinCanvas).map(b=>({id:'body-'+b.id,canvas:b.skinCanvas,g:b.skinCtx,tex:b.skinTexture}))];
 try{for(const s of textures){const width=s.canvas.width,height=s.canvas.height;
  // Rendering this pass uses the existing texture. It does not mark it dirty.
  rt.setSize(width,height);mat.uniforms.uSource.value=s.tex;renderer.setRenderTarget(rt);renderer.render(sc,cam);
  const actual=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(rt,0,0,width,height,actual);
  const expected=s.g.getImageData(0,0,width,height).data;let missed=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const a=(y*width+x)*4,b=((height-1-y)*width+x)*4;let d=Math.abs(actual[a+3]-expected[b+3]);
   for(let c=0;c<3;c++)d=Math.max(d,Math.abs(actual[a+c]*actual[a+3]/255-expected[b+c]*expected[b+3]/255));
   if(d>2)missed++;maxDelta=Math.max(maxDelta,d);pixels++;
  }mismatches+=missed;if(missed)failures.push({surface:s.id,missed});
 }}finally{renderer.setRenderTarget(previous);rt.dispose();geo.dispose();mat.dispose();renderNow();}
 return{pixels,mismatches,maxDelta,failures,copyCanvases:paintCopies.size};
}`;
const source=(await readFile('index.html','utf8')).replace('if(s.textureReady&&directPaintSubrect){',fallback?'if(false){':'if(s.textureReady&&directPaintSubrect){');
const edgePaint=`()=>{for(const s of surfaces){renderer.initTexture(s.tex);for(let i=0;i<12;i++){const rx=[.023,.04,.14,.34][i%4],ry=i%2?.023:rx,x=i%3===0?.02:i%3===1?s.w-.02:s.w*.5,y=i%2?.02:s.h-.02;const a={x,y,rx,ry,angle:i*.7},b={...a,x:x+.015,y:y-.012,angle:a.angle+.04};s.patchUV(a,b,1.3,5000+i*137,i*.02,1);}uploadPaintRegion(s);}}`;
const markEdges=`()=>{for(const s of surfaces){for(const [x,y] of [[.02,.02],[s.w-.02,s.h-.02],[s.w*.5,s.h*.5]])bulletMark({object:s.mesh,point:s.worldFromUV(x,y,new V())},s.n);}}`;
const spillSeams=`()=>{for(const p of [new V(0,0,0),new V(-4,0,4),new V(7.9,0,-7.9)]){const uv=floorReceiver.uv(p),s=tileMap.get(clamp(Math.floor(uv.x/4),0,3)+','+clamp(Math.floor(uv.y/4),0,3));surfaceSpill(s,p);}}`;
await writeFile(resolve(out,'runtime.html'),source.replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',`window.__smear={auditPaint:${audit},edgePaint:${edgePaint},markEdges:${markEdges},spillSeams:${spillSeams},state,`));
const page=firefox?await launchFirefox({port:9595,width:1366,height:768}):await launch({port:9592,width:1366,height:768});
const receipt={path:firefox?'Firefox/Zen bounded region copies':fallback?'WebGL 1-compatible region copies':'WebGL 2 direct subrects',checks:[],audits:[]};
function pass(name,test){test();receipt.checks.push(name);console.log('PASS '+name);}
try{
 await page.goto(pathToFileURL(resolve(out,'runtime.html')).href);
 await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'paint verification boot'});
 await page.eval('window.__smear.manual(true);window.__smear.preset("default")');
 for(const [name,setup]of [
  ['smear demo',`a.trace(60,14);`],
  ['tile seams and borders',`a.reset();a.tune({walking:false,recover:false});a.moveDoll(0,[-1.5,.15,1.7]);for(const name of ['Torso','Hips','Head','Left shin','Right shin'])for(const n of [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,1);a.grab(0,'Torso');for(let i=0;i<480;i++){a.target([-2.5+5*(1-Math.cos(i/60*2.2))*.5,-.24,1.5+Math.sin(i/60*2.8)*.6]);a.rawStep(2);a.render();}a.release();`],
  ['small edge brushes and tall faces',`a.clean();for(let i=0;i<24;i++)a.render();a.edgePaint();`],
  ['tiny bullet marks at face edges',`a.clean();for(let i=0;i<24;i++)a.render();a.markEdges();`],
  ['Spill across floor seams',`a.clean();for(let i=0;i<24;i++)a.render();a.spillSeams();`],
  ['wall drips and rotated faces',`a.reset();a.wallSpill('front');a.wallSpill('divider');a.wallSpill('left');a.step(480);`],
  ['body atlas edges and washing',`a.wash();a.render();for(const name of a.state().parts.filter(b=>b.doll===1).map(b=>b.name))for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,.7);a.render();a.wash();a.render();a.bodyPaint(0,'Torso',[0,0,1],.5);`],
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
