// Prototype a worker-owned simulation from the same offline engine source.
// Rendering, raster expansion and WebAudio remain outside this kernel.
import assert from 'node:assert/strict';

export function replaceIIFE(source, start, replacement) {
 const at=source.indexOf(start),end=source.indexOf('\n})();',at);
 assert(at>=0&&end>at,'Missing engine block: '+start);
 return source.slice(0,at)+replacement+source.slice(end+7);
}

export function createSimulationKernel(html,{width=1280,height=720,fixture='',raster=false}={}) {
 const scripts=Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>m[1]);
 const engine=scripts.find(s=>s.includes('const T=THREE, V=T.Vector3'));
 const three=scripts.find(s=>s!==engine&&s.includes('REVISION'));
 assert(engine&&three,'Offline Three.js and simulation engine required');
 let core=replaceIIFE(engine,'const runtimeProfiler=(()=>{',`const runtimeProfiler={active:false,visible:false,capturing:false,show(){},clear(){},refresh(){},breakInterval(){},gpuBegin(){},gpuEnd(){},begin(){},finish(){},add(){},event(){},action:(name,fn)=>fn(),badge:()=>'',snapshot:()=>({}),report:()=>({})};`);
 core=replaceIIFE(core,'const paintEngine=(()=>{',`const paintEngine=(()=>{
  let serial=0;const records=new Map();
  window.__simulationPaintRecords=records;
  return{enabled:true,register:s=>{s.paintId=++serial;s.paintEpoch=0;s.canvasCurrent=true;s.paintCanvasDirty=false;records.set(s.paintId,s);},remove:s=>records.delete(s.paintId),draw:(s,kind,args)=>{if(kind==='clear')s.paintEpoch++;simulationCommandTotal++;s.simulationDirty=true;s.simulationRevision=(s.simulationRevision||0)+1;const op=[s.paintId,s.paintEpoch,kind,args];op.revision=s.simulationRevision;simulationPaint.push(op);${raster?'const t=performance.now();rasterCommand(s,kind,args);simulationRasterMS+=performance.now()-t;':''}},pump(){},snapshotCanvas(){},flush:async()=>{},status:()=>({backend:'Simulation command producer',canvases:records.size})};
 })();`);
 core=core.replace('environment();','scene.environment={dispose(){}};');
 if(raster)core=core.replaceAll('dirtyWet.add(this);','dirtyWet.add(this);this.simulationWetDirty=true;');
 assert(core!==engine);
 const bridge=`
 drawUI=()=>{};startAudio=()=>{};drawDrops=()=>{};syncDollDetails=()=>{};
 noiseSound=(...args)=>simulationAudio.push(['noise',...args]);
 tone=(...args)=>simulationAudio.push(['tone',...args]);
 updateScrape=(...args)=>simulationAudio.push(['scrape',...args]);
 ${fixture}
 `;
 assert(core.includes('window.__smear={'),'Simulation inspection entry point required');
 core=core.replace('window.__smear={',bridge+'\nwindow.__smear={');
 const prelude=`
 const simulationPaint=[],simulationAudio=[];let simulationRasterMS=0,simulationCommandTotal=0;
 const noop=()=>{};
 const window={addEventListener:noop,open:noop};
 const storage=new Map();const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const innerWidth=${width},innerHeight=${height},devicePixelRatio=1;
 const requestAnimationFrame=()=>0,cancelAnimationFrame=noop;
 const body={append:noop,insertBefore:noop};
 function virtualCanvas(){const c=new OffscreenCanvas(1,1);${raster?"const context=c.getContext.bind(c);c.getContext=(type,options)=>context(type,options||{willReadFrequently:/Firefox\\//.test(navigator.userAgent)});":''}c.style={};c.parentNode=body;c.setAttribute=noop;c.remove=noop;c.focus=noop;return c;}
 const elements=new Map();
 const document={body,head:body,hidden:false,visibilityState:'visible',pointerLockElement:null,addEventListener:noop,exitPointerLock:noop,createElement:type=>type==='canvas'?virtualCanvas():{style:{},append:noop,remove:noop,setAttribute:noop},getElementById:id=>{if(!elements.has(id))elements.set(id,id==='world'||id==='hud'?virtualCanvas():{style:{},remove:noop});return elements.get(id);}};
 Object.defineProperty(globalThis,'__smear',{get:()=>window.__smear});
 class SimulationRenderer{
  constructor(){this.shadowMap={};this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>8};this.info={programs:[],memory:{geometries:0,textures:0},render:{calls:0,triangles:0}};const props=new WeakMap();this.properties={get:o=>{if(!props.has(o))props.set(o,{});return props.get(o);}};}
  setPixelRatio(){} setSize(){} compile(){} render(scene){scene.updateMatrixWorld();}
 }
 `;
 return prelude+'\n'+three+'\nTHREE.WebGLRenderer=SimulationRenderer;\n'+core+`
 onmessage=async e=>{try{const {id,method,args=[]}=e.data;const result=await window.__simulationMethods[method](...args);postMessage({id,result});}catch(error){postMessage({id:e.data.id,error:String(error),stack:error.stack});}};
 postMessage({ready:true,state:window.__smear.state()});
 `;
}
