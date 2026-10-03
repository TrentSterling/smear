// Isolated architecture probe. This does not change the published entry point.
// A real worker owns the unchanged solver, contacts, droplets and pigment raster.
// The foreground thread owns WebGL, HUD, camera input and WebAudio.
import {createSimulationKernel,replaceIIFE} from './simulation-kernel.mjs';
import {createSimulationPaintPool} from './simulation-paint-pool.mjs';

const simulationRuntimeFixture=String.raw`
let simulationGeneration=0,simulationElapsed=0,simulationTune='';
const simulationActions={chaos:()=>{chaosScene();simulationGeneration++;},reset:()=>{resetWorld(true);simulationGeneration++;},clean:cleanSurfaces,wash:washBodies,heal:healAll,stop:stopBleeding,add:addDummy,tool:setTool,shoot,spill,demo:startDemo,release:releaseGrab,tune:applyTuning,preset,
 grab:(d,name,local)=>__smear.grab(d,name,local),target:p=>__smear.target(p),hit:(d,name)=>__smear.hit(d,name),view:(p,t)=>__smear.view(p,t),bodyPaint:(...a)=>__smear.bodyPaint(...a),wallSpill:(...a)=>__smear.wallSpill(...a),
 startGrab:(id,p)=>startGrab(bodies.find(b=>b.id===id),new V(...p))};
window.__simulationMethods={
 async advance(n,input,actions=[],full=false){
  const started=performance.now();simulationRasterMS=0;
  if(input){
   for(const ack of input.ack||[]){const s=window.__simulationPaintRecords.get(ack.id);if(s&&s.paintEpoch===ack.epoch)s.simulationBounds=(s.simulationBounds||[]).filter(b=>b.revision>ack.revision);}
   W=input.width;H=input.height;const tuning=JSON.stringify(input.tune);if(tuning!==simulationTune){simulationTune=tuning;applyTuning(input.tune);}camera.aspect=W/H;camera.fov=input.fov;camera.position.fromArray(input.cameraP);camera.quaternion.fromArray(input.cameraQ);camera.updateProjectionMatrix();camera.updateMatrixWorld();mouse.x=input.mouse[0];mouse.y=input.mouse[1];mouse.left=input.left;tool=input.tool;panel=input.panel;paused=input.paused;aimDown=input.aimDown;keys.clear();for(const k of input.keys)keys.add(k);if(grab&&input.target)grab.desired.fromArray(input.target);
  }
  for(const [name,args]of actions){if(!simulationActions[name])throw Error('Unknown simulation action '+name);simulationActions[name](...args);}
  for(let i=0;i<n;i++)physicsStep();
  // Raycasts use the same rendered body hierarchy on the next simulation tick.
  renderNow(input?.dt||0,1);
  const statePacket={generation:simulationGeneration,simTime,seed,stats:{...stats},dolls:dolls.map(d=>({id:d.id,spawn:d.spawn.toArray(),mode:d.mode,active:d.active,health:d.health,root:d.root.toArray()})),
   bodies:bodies.map(b=>({id:b.id,p:b.p.toArray(),q:b.q.toArray(),prevP:b.prevP.toArray(),prevQ:b.prevQ.toArray(),v:b.v.toArray(),w:b.w.toArray(),wet:b.wet,coat:Array.from(b.coat),damage:b.damage,wear:Array.from(b.wear),pressure:b.pressure,reserve:b.bloodReserve,contacts:b.contacts.length,wounds:b.wounds.length,active:b.active})),
   drops:dropList.map(d=>({p:d.p.toArray(),prev:d.prev.toArray(),v:d.v.toArray(),r:d.r,life:d.life,owner:d.owner})),grab:grab?{body:grab.body.id,local:grab.local.toArray(),target:grab.target.toArray(),desired:grab.desired.toArray(),distance:grab.distance,manual:grab.manual}:null,
   shotFlashUntil,hitMarkerUntil,hitMarkerColor,viewKick,recoilPitch,
   traces:traces.map(t=>({positions:Array.from(t.line.geometry.attributes.position.array),t:t.t})),
   shells:shells.map(s=>({p:s.p.toArray(),v:s.v.toArray(),rot:s.rot.toArray(),life:s.life}))};
  const rasterMS=simulationRasterMS,transferStart=performance.now(),patches=[],transfer=[];
  for(const s of window.__simulationPaintRecords.values()){
   const bounds=s.simulationBounds||(s.simulationBounds=[]),union=(a,b)=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});
   if(s.simulationDirty||full){const next=full?{x0:0,y0:0,x1:s.canvas.width,y1:s.canvas.height}:s.dirtyRect||{x0:0,y0:0,x1:s.canvas.width,y1:s.canvas.height};bounds.push({revision:s.simulationRevision||0,rect:{...next}});s.simulationDirty=false;s.dirtyRect=null;}
   // At most sixteen versioned regions per record. Merging an older pair may
   // retain extra pixels until both are acknowledged, but cannot lose pigment.
   while(bounds.length>16){const a=bounds.shift(),b=bounds.shift();bounds.unshift({revision:b.revision,rect:union(a.rect,b.rect)});}
   if(!bounds.length)continue;const r=bounds.map(b=>b.rect).reduce(union);
   if(r.x1>r.x0&&r.y1>r.y0){const w=r.x1-r.x0,h=r.y1-r.y0,pixels=s.g.getImageData(r.x0,r.y0,w,h).data,row=new Uint8ClampedArray(w*4);
    for(let y=0;y<Math.floor(h/2);y++){const a=y*w*4,b=(h-1-y)*w*4;row.set(pixels.subarray(a,a+w*4));pixels.copyWithin(a,b,b+w*4);pixels.set(row,b);}
    patches.push({id:s.paintId,revision:s.simulationRevision||0,surface:s.skinOwner?null:s.id,body:s.skinOwner?.id||null,epoch:s.paintEpoch,rect:{...r},pixels});transfer.push(pixels.buffer);}
   // A later snapshot covers all unacknowledged revisions, so presentation can
   // replace an older pending snapshot without retaining an event queue.
  }
  const wet=surfaces.filter(s=>full||s.simulationWetDirty).map(s=>{s.simulationWetDirty=false;return{id:s.id,pixels:s.wetData.slice()};});for(const s of wet)transfer.push(s.pixels.buffer);
  const audioCommands=simulationAudio.splice(0),paintCommands=simulationPaint.length;simulationPaint.length=0;
  simulationElapsed+=performance.now()-started;
  return{state:statePacket,patches,wet,audioCommands,paintCommands,workerMS:performance.now()-started,rasterMS,transferMS:performance.now()-transferStart,simulationElapsed,transfer};
 }
};
`;

const foreground=String.raw`
const simulationProbe={ready:false,busy:false,error:null,jobs:0,workerMS:0,maxWorkerMS:0,rasterTotal:0,transferTotal:0,workerTotal:0,paintCommands:0,patches:0,steps:0,ticksSinceFrame:0,discardedSimMS:0,started:performance.now(),generation:0,inputCommands:[]};
let simulationPeer=null,simulationQueue=new Map(),simulationFuture=new Map(),simulationAck=new Map(),simulationID=0,simulationPending=new Map(),simulationLastDispatch=performance.now(),simulationAccumulator=0,simulationBuilding=false,simulationTimer=0;
const simulationNativeReset=resetWorld,simulationNativeNewDoll=newDoll,simulationNativeStartGrab=startGrab,simulationNativeRelease=releaseGrab;
function simulationInvoke(name,...args){if(!simulationBuilding)simulationProbe.inputCommands.push([name,args]);}
function simulationSnapshotInput(dt){const ack=Array.from(simulationAck.values());simulationAck.clear();return{width:W,height:H,fov:camera.fov,cameraP:camera.position.toArray(),cameraQ:camera.quaternion.toArray(),mouse:[mouse.x,mouse.y],left:mouse.left,tool,panel,paused,aimDown,keys:Array.from(keys),target:grab?.desired.toArray()||null,tune:{...tune},dt,ack,manual};}
function simulationApplyState(s){
 if(s.generation!==simulationProbe.generation){simulationProbe.generation=s.generation;for(const p of simulationQueue.values())p.bitmap?.close();simulationQueue.clear();simulationAck.clear();simulationBuilding=true;try{simulationNativeReset(false,true);}finally{simulationBuilding=false;}for(const [id,p]of simulationFuture)if(p.generation===s.generation){simulationQueue.set(id,p);simulationFuture.delete(id);}else if(p.generation<s.generation){p.bitmap?.close();simulationFuture.delete(id);}}
 while(dolls.length<s.dolls.length){const d=s.dolls[dolls.length];simulationNativeNewDoll(d.spawn[0],d.spawn[2],false,false);}
 if(bodies.length!==s.bodies.length)throw Error('Simulation topology mismatch');
 for(let i=0;i<dolls.length;i++){const d=dolls[i],q=s.dolls[i];d.mode=q.mode;d.active=q.active;d.health=q.health;d.root.fromArray(q.root);}
 for(let i=0;i<bodies.length;i++){const b=bodies[i],q=s.bodies[i];if(b.id!==q.id)throw Error('Simulation body order mismatch');b.p.fromArray(q.p);b.q.fromArray(q.q);b.iq.copy(b.q).conjugate();b.prevP.fromArray(q.prevP);b.prevQ.fromArray(q.prevQ);b.v.fromArray(q.v);b.w.fromArray(q.w);b.wet=q.wet;b.coat.set(q.coat);b.damage=q.damage;b.wear.set(q.wear);b.pressure=q.pressure;b.bloodReserve=q.reserve;b.contacts.length=q.contacts;b.wounds.length=q.wounds;b.active=q.active;}
 clearDrops();for(const q of s.drops){const d=dropPool.pop()||{p:new V(),prev:new V(),v:new V()};d.p.fromArray(q.p);d.prev.fromArray(q.prev);d.v.fromArray(q.v);d.r=q.r;d.life=q.life;d.owner=q.owner;dropList.push(d);}dropsChanged=true;
 simTime=s.simTime;seed=s.seed;Object.assign(stats,s.stats);
 const g=s.grab;if(g){const b=bodies.find(b=>b.id===g.body);grab={body:b,local:new V(...g.local),target:new V(...g.target),desired:new V(...g.desired),distance:g.distance,manual:g.manual};selected=b;}else{grab=null;selected=null;}
 shotFlashUntil=s.shotFlashUntil;hitMarkerUntil=s.hitMarkerUntil;hitMarkerColor=s.hitMarkerColor;viewKick=s.viewKick;recoilPitch=s.recoilPitch;
 for(const t of traces)releaseTrace(t);traces.length=0;for(const q of s.traces){const t=takeTrace();t.line.geometry.attributes.position.array.set(q.positions);t.line.geometry.attributes.position.needsUpdate=true;t.line.geometry.computeBoundingSphere();t.t=q.t;scene.add(t.line);traces.push(t);}
 shells.length=0;for(const q of s.shells)shells.push({p:new V(...q.p),v:new V(...q.v),rot:new V(...q.rot),life:q.life});
}
function simulationAccept(packet){
 const t=performance.now();if(packet.state.generation===simulationProbe.generation)simulationProbe.ticksSinceFrame+=Math.max(0,packet.state.stats.steps-simulationProbe.steps);simulationApplyState(packet.state);
 for(const q of packet.wet){const s=surfaces[q.id];s.wetData.set(q.pixels);s.wetTex.needsUpdate=true;}
 for(const [kind,...a]of packet.audioCommands)({noise:noiseSound,tone,scrape:updateScrape})[kind](...a);
 for(const p of packet.patches){simulationQueue.get(p.id)?.bitmap?.close();simulationQueue.set(p.id,p);}simulationProbe.jobs++;simulationProbe.workerMS=packet.workerMS;simulationProbe.maxWorkerMS=Math.max(simulationProbe.maxWorkerMS,packet.workerMS);simulationProbe.rasterTotal+=packet.rasterMS;simulationProbe.transferTotal+=packet.transferMS;simulationProbe.workerTotal+=packet.workerMS;simulationProbe.paintCommands+=packet.paintCommands;simulationProbe.steps=packet.state.stats.steps;
 simulationProbe.mirrorMS=performance.now()-t;
 if(packet.paintPool)simulationProbe.paintPool=packet.paintPool;
}
function simulationAcceptPaint(packet){if(packet.generation<simulationProbe.generation){for(const p of packet.patches)p.bitmap?.close();return;}const target=packet.generation>simulationProbe.generation?simulationFuture:simulationQueue;for(const p of packet.patches){target.get(p.id)?.bitmap?.close();target.set(p.id,p);}}
function simulationPresent(){
 const deadline=performance.now()+2,gl=renderer.getContext();
 for(const [id,p]of simulationQueue){if(performance.now()>=deadline)break;simulationQueue.delete(id);const s=p.body?(ensureSkin(bodies.find(b=>b.id===p.body)),bodies.find(b=>b.id===p.body).skinPaint):surfaces[p.surface],r=p.rect;
  if(!s)throw Error('Missing simulation paint target');
  if(s.paintEpoch!==p.epoch){s.paintEpoch=p.epoch;if(s.paintUniform)s.paintUniform.value=blankPigment;s.tex.dispose();s.textureReady=false;}
  initializePaintTexture(s);renderer.state.activeTexture(gl.TEXTURE0);renderer.state.bindTexture(gl.TEXTURE_2D,renderer.properties.get(s.tex).__webglTexture);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  try{if(p.pixels)gl.texSubImage2D(gl.TEXTURE_2D,0,r.x0,s.canvas.height-r.y1,r.x1-r.x0,r.y1-r.y0,gl.RGBA,gl.UNSIGNED_BYTE,p.pixels);else gl.texSubImage2D(gl.TEXTURE_2D,0,r.x0,s.canvas.height-r.y1,gl.RGBA,gl.UNSIGNED_BYTE,p.bitmap);}finally{p.bitmap?.close();renderer.state.unbindTexture();}s.paintVisible=true;if(s.paintUniform)s.paintUniform.value=s.tex;s.uploadedEpoch=s.paintEpoch;s.canvasCurrent=false;simulationProbe.patches++;simulationAck.set(p.id,{id:p.id,epoch:p.epoch,revision:p.revision});
 }
}
function simulationSend(n,input,actions=[],full=false){simulationProbe.busy=true;return new Promise((resolve,reject)=>{const id=++simulationID;simulationPending.set(id,{resolve,reject});simulationPeer.postMessage({id,method:'advance',args:[n,input,actions,full]});});}
function simulationDispatch(){
 clearTimeout(simulationTimer);simulationTimer=0;
 if(!running||manual||!simulationProbe.ready||simulationProbe.busy)return;
 const wall=performance.now(),since=(wall-simulationLastDispatch)/1000,rate=slow?.25:1;
 if(paused||document.hidden){simulationAccumulator=0;simulationLastDispatch=wall;if(!simulationProbe.inputCommands.length)return;}
 else if(simulationAccumulator+since*rate<STEP&&!simulationProbe.inputCommands.length){simulationTimer=setTimeout(simulationDispatch,Math.max(1,(STEP-simulationAccumulator-since*rate)/rate*1000));return;}
 simulationLastDispatch=wall;if(!paused&&!document.hidden){simulationProbe.discardedSimMS+=Math.max(0,since-.075)*rate*1000;simulationAccumulator+=Math.min(.075,since)*rate;}
 const n=Math.min(10,Math.floor(simulationAccumulator/STEP));simulationAccumulator-=n*STEP;
 simulationSend(n,simulationSnapshotInput(Math.min(.075,since)),simulationProbe.inputCommands.splice(0)).then(packet=>{simulationAccept(packet);simulationDispatch();}).catch(e=>{simulationProbe.error=e.stack;});
}
async function simulationBarrier(){while(simulationProbe.busy)await new Promise(r=>setTimeout(r,1));if(simulationProbe.ready){const input=simulationSnapshotInput(0);input.manual=true;simulationAccept(await simulationSend(0,input));}while(simulationQueue.size)simulationPresent();}
async function simulationRun(n,actions=[],full=false){await simulationBarrier();const p=await simulationSend(n,simulationSnapshotInput(0),actions,full);simulationAccept(p);while(simulationQueue.size)simulationPresent();return state();}
window.__simulationLive={status:()=>({...simulationProbe,pendingPatches:simulationQueue.size,inputCommands:simulationProbe.inputCommands.length,elapsed:(performance.now()-simulationProbe.started)/1000}),run:simulationRun,barrier:simulationBarrier,invoke:simulationInvoke};
async function simulationBoot(){
 const url=URL.createObjectURL(new Blob([window.__simulationKernel],{type:'text/javascript'}));simulationPeer=new Worker(url);URL.revokeObjectURL(url);
 await new Promise((resolve,reject)=>{simulationPeer.onerror=e=>{simulationProbe.error=e.message;reject(Error(e.message));};simulationPeer.onmessage=e=>{const m=e.data;if(m.paint){simulationAcceptPaint(m);return;}if(m.ready){resolve();return;}const p=simulationPending.get(m.id);if(!p)return;simulationPending.delete(m.id);simulationProbe.busy=false;if(m.error){simulationProbe.error=m.stack;p.reject(Error(m.stack));}else p.resolve(m.result);};});
 physicsStep=()=>{};
 chaosScene=()=>simulationInvoke('chaos');resetWorld=()=>simulationInvoke('reset');cleanSurfaces=()=>simulationInvoke('clean');washBodies=()=>simulationInvoke('wash');healAll=()=>simulationInvoke('heal');stopBleeding=()=>simulationInvoke('stop');addDummy=()=>simulationInvoke('add');shoot=()=>simulationInvoke('shoot');spill=()=>simulationInvoke('spill');startDemo=()=>simulationInvoke('demo');
 startGrab=(b,p)=>{simulationNativeStartGrab(b,p);simulationInvoke('startGrab',b.id,p.toArray());};releaseGrab=()=>{simulationNativeRelease();simulationInvoke('release');};
 __smear.bodyPaint=(...a)=>simulationInvoke('bodyPaint',...a);__smear.grab=(...a)=>simulationInvoke('grab',...a);__smear.target=(...a)=>simulationInvoke('target',...a);__smear.hit=(...a)=>simulationInvoke('hit',...a);__smear.wallSpill=(...a)=>simulationInvoke('wallSpill',...a);__smear.step=n=>simulationRun(n,simulationProbe.inputCommands.splice(0));__smear.rawStep=__smear.step;
 await simulationRun(0,[],true);simulationProbe.ready=true;simulationProbe.started=performance.now();simulationLastDispatch=performance.now();lastHUDKey='';
}
frame=function(now){
 frameRequest=0;if(!running)return;
 const wall=performance.now(),elapsed=Math.max(0,(wall-last)/1000),dt=clamp(elapsed,0,.075);last=wall;stats.frameMS=mix(stats.frameMS,dt*1000,.035);
 if(manual){simulationLastDispatch=wall;simulationAccumulator=0;simulationProbe.ticksSinceFrame=0;runtimeProfiler.breakInterval();drawUI();runtimeProfiler.refresh();frameRequest=requestAnimationFrame(frame);return;}
 runtimeProfiler.begin(now,wall);runtimeProfiler.add('steps',simulationProbe.ticksSinceFrame);simulationProbe.ticksSinceFrame=0;let t=runtimeProfiler.active?performance.now():0;moveCamera(dt);updateGrab();if(runtimeProfiler.active)runtimeProfiler.add('input',performance.now()-t);
 simulationDispatch();
 hoverClock+=dt;if(hoverClock>.04&&!panel&&!grab){hoverClock=0;currentHit=cast();hovered=currentHit?.object.userData.body||null;}
 renderNow(dt,1);runtimeProfiler.finish(wall);frameRequest=requestAnimationFrame(frame);
};
simulationBoot().catch(e=>{simulationProbe.error=e.stack;});
`;

export function createSimulationRuntime(html,{width=1280,height=720,pool=false}={}) {
 let fixture=simulationRuntimeFixture;
 if(pool){
  fixture=fixture.replace('const started=performance.now();simulationRasterMS=0;', 'const started=performance.now(),commandStart=simulationCommandTotal;simulationRasterMS=0;');
  fixture=fixture.replace('for(let i=0;i<n;i++)physicsStep();', 'for(let i=0;i<n;i++){physicsStep();if(i%8===7)await simulationPaintPool.enqueue();}');
  const a=fixture.indexOf('const rasterMS=simulationRasterMS,transferStart='),b=fixture.indexOf('const wet=surfaces.filter',a);
  if(a<0||b<a)throw Error('Missing paint transport for pool probe');
  fixture=fixture.slice(0,a)+'await simulationPaintPool.enqueue(full);if(full||input?.manual)await simulationPaintPool.drain();const rasterMS=0,transferStart=performance.now(),patches=[],transfer=[];\n'+fixture.slice(b);
  fixture=fixture.replace('paintCommands=simulationPaint.length;simulationPaint.length=0;', 'paintCommands=simulationCommandTotal-commandStart;');
  fixture=fixture.replace('simulationElapsed,transfer};', 'simulationElapsed,paintPool:simulationPaintPool.status(),transfer};');
  fixture=createSimulationPaintPool(html)+'\n'+fixture;
 }
 let kernel=createSimulationKernel(html,{width,height,fixture,raster:!pool});
 if(pool)kernel=kernel.replaceAll('dirtyWet.add(this);','dirtyWet.add(this);this.simulationWetDirty=true;');
 // Transfer the actual cropped buffers rather than copying them through JSON.
 kernel=kernel.replace('postMessage({id,result});','const transfer=result?.transfer||[];if(result?.transfer)delete result.transfer;postMessage({id,result},transfer);');
 let root=replaceIIFE(html,'const paintEngine=(()=>{',`const simulationMirrorRecords=new Map();let simulationMirrorSerial=0;
 const paintEngine={enabled:true,register:s=>{s.paintId=++simulationMirrorSerial;s.paintEpoch=0;s.canvasCurrent=true;s.paintCanvasDirty=false;simulationMirrorRecords.set(s.paintId,s);},remove:s=>simulationMirrorRecords.delete(s.paintId),draw:(s,kind)=>{if(kind==='clear'){s.paintEpoch++;if(s.paintCanvasDirty)s.g.clearRect(0,0,s.canvas.width,s.canvas.height);s.paintCanvasDirty=false;}},pump:()=>{if(window.__simulationLive)simulationPresent();},snapshotCanvas(){},flush:async()=>{},status:()=>{const p=window.__simulationLive?.status(),r=p?.paintPool;return{backend:'Worker simulation and pigment prototype',workerCount:r?r.workerCount+1:1,queued:r?.pending||0,inFlight:0,recoveryPending:0,readyBitmaps:p?.pendingPatches||0,workerMS:r?.jobs?r.totalRaster/r.jobs:p?.workerMS||0,bitmapMS:r?.jobs?r.totalTransfer/r.jobs:0,simulationWorkerMS:p?.workerMS||0,simulationSteps:p?.steps||0,discardedSimMS:p?.discardedSimMS||0,mainReplayCommands:0,batchLimit:1024,maxQueued:r?.maxPending||0};}};paintTelemetry=paintEngine.status;`);
 // Show independent worker cost alongside the foreground histogram.
 root=root.replace("nodes['spike-count'].textContent","if(s.paintWorker?.simulationWorkerMS!==undefined)nodes.context.textContent+='\\nSimulation '+fmt(s.paintWorker.simulationWorkerMS)+' ms worker / '+fmt(s.paintWorker.discardedSimMS)+' ms discarded sim';nodes['spike-count'].textContent");
 // Add the hook before adding serialized source, which contains the same tokens.
 root=root.replace('frameRequest=requestAnimationFrame(frame);\n})();',foreground+'\nframeRequest=requestAnimationFrame(frame);\n})();');
 const boot=`window.__simulationKernel=${JSON.stringify(kernel).replaceAll('<','\u003c')};`;
 return root.replace('</head>','<script>'+boot+'</script></head>');
}
