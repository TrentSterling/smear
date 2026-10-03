// Isolated architecture probe. This does not change the published entry point.
// A real worker owns the unchanged solver, contacts, droplets and pigment raster.
// The foreground thread owns WebGL, HUD, camera input and WebAudio.
import {createSimulationKernel,replaceIIFE} from './simulation-kernel.mjs';
import {createSimulationPaintPool} from './simulation-paint-pool.mjs';

const simulationRuntimeFixture=String.raw`
let simulationGeneration=0,simulationElapsed=0,simulationTune='';
const simulationActions={chaos:()=>{chaosScene();simulationGeneration++;},reset:(resetCamera=true,clean=true)=>{resetWorld(resetCamera,clean);simulationGeneration++;},clean:cleanSurfaces,wash:washBodies,heal:healAll,stop:stopBleeding,add:addDummy,tool:setTool,shoot,spill,demo:()=>{startDemo();simulationGeneration++;},release:releaseGrab,tune:applyTuning,preset,
 api:async(method,args=[])=>{const fn=window.__smear[method];if(typeof fn!=='function')throw Error('Unknown simulation API '+method);if(['chaos','reset','trace','demo'].includes(method))simulationGeneration++;return await fn(...args);},
 grab:(d,name,local)=>__smear.grab(d,name,local),target:p=>__smear.target(p),hit:(d,name)=>__smear.hit(d,name),view:(p,t)=>__smear.view(p,t),bodyPaint:(...a)=>__smear.bodyPaint(...a),wallSpill:(...a)=>__smear.wallSpill(...a),
 startGrab:(id,p)=>startGrab(bodies.find(b=>b.id===id),new V(...p))};
window.__simulationMethods={
 async advance(n,input,actions=[],full=false){
  const started=performance.now();simulationRasterMS=0;
  if(input){
   for(const ack of input.ack||[]){const s=window.__simulationPaintRecords.get(ack.id);if(s&&s.paintEpoch===ack.epoch)s.simulationBounds=(s.simulationBounds||[]).filter(b=>b.revision>ack.revision);}
   W=input.width;H=input.height;const tuning=JSON.stringify(input.tune);if(tuning!==simulationTune){simulationTune=tuning;applyTuning(input.tune);}camera.aspect=W/H;camera.fov=input.fov;camera.position.fromArray(input.cameraP);camera.quaternion.fromArray(input.cameraQ);camera.updateProjectionMatrix();camera.updateMatrixWorld();mouse.x=input.mouse[0];mouse.y=input.mouse[1];mouse.left=input.left;tool=input.tool;panel=input.panel;paused=input.paused;aimDown=input.aimDown;stickyLook=input.stickyLook;temporaryLook=input.temporaryLook;document.pointerLockElement=input.locked?canvas:null;if(input.player){const p=input.player;player.feet.fromArray(p.feet);player.vel.fromArray(p.vel);for(const key of ['eye','speed','bob','fly','grounded'])player[key]=p[key];}keys.clear();for(const k of input.keys)keys.add(k);if(grab&&input.target)grab.desired.fromArray(input.target);
  }
  const actionResults=[];for(const [name,args]of actions){if(!simulationActions[name])throw Error('Unknown simulation action '+name);actionResults.push(await simulationActions[name](...args));}
  for(let i=0;i<n;i++)physicsStep();
  // Raycasts use the same rendered body hierarchy on the next simulation tick.
  renderNow(input?.dt||0,1);
  const statePacket={generation:simulationGeneration,simTime,seed,stats:{...stats},authoritative:state(),demo:demo?{start:demo.start,phase:demo.phase,oldBlood:demo.oldBlood}:null,bloodScale,toast,toastRemaining:Math.max(0,toastUntil-performance.now()/1000),dolls:dolls.map(d=>({id:d.id,spawn:d.spawn.toArray(),mode:d.mode,active:d.active,health:d.health,root:d.root.toArray()})),
   bodies:bodies.map(b=>({id:b.id,p:b.p.toArray(),q:b.q.toArray(),prevP:b.prevP.toArray(),prevQ:b.prevQ.toArray(),v:b.v.toArray(),w:b.w.toArray(),wet:b.wet,coat:Array.from(b.coat),damage:b.damage,wear:Array.from(b.wear),pressure:b.pressure,reserve:b.bloodReserve,contacts:b.contacts.length,wounds:b.wounds.length,active:b.active})),
   drops:dropList.map(d=>({p:d.p.toArray(),prev:d.prev.toArray(),v:d.v.toArray(),r:d.r,life:d.life,owner:d.owner})),grab:grab?{body:grab.body.id,local:grab.local.toArray(),target:grab.target.toArray(),desired:grab.desired.toArray(),distance:grab.distance,manual:grab.manual}:null,
   shotFlashUntil,hitMarkerUntil,hitMarkerColor,viewKick,recoilPitch,paintRecords:Array.from(window.__simulationPaintRecords.values(),s=>({id:s.paintId,body:s.skinOwner?.id||null,surface:s.skinOwner?null:s.id,epoch:s.paintEpoch,visible:!!s.simulationHasPigment})),
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
  return{state:statePacket,patches,wet,audioCommands,paintCommands,actionResults,workerMS:performance.now()-started,rasterMS,transferMS:performance.now()-transferStart,simulationElapsed,transfer};
 }
};
`;

const foreground=String.raw`
function simulationRelease(p){if(!p||p.released)return;p.released=true;if(p.atlas){if(--p.atlas.remaining===0)p.atlas.bitmap.close();}else p.bitmap?.close();}
function simulationCommitPixels(s,p){const r=p.rect,w=r.x1-r.x0,h=r.y1-r.y0,y0=s.canvas.height-r.y1;
 if(p.pixels){if(!s.paintPixels)s.paintPixels=new Uint8ClampedArray(s.canvas.width*s.canvas.height*4);for(let y=0;y<h;y++)s.paintPixels.set(p.pixels.subarray(y*w*4,(y+1)*w*4),((y0+y)*s.canvas.width+r.x0)*4);s.canvasCurrent=false;}
 else if(p.atlas){const a=p.atlas,g=s.g;g.save();g.setTransform(1,0,0,-1,0,s.canvas.height);g.clearRect(r.x0,y0,w,h);g.drawImage(a.bitmap,p.atlasX,a.height-p.atlasY-h,w,h,r.x0,y0,w,h);g.restore();s.canvasCurrent=true;s.paintCanvasDirty=true;}
 s.paintRevision=p.revision;
}
function simulationSnapshotCanvas(s){if(s.canvasCurrent)return;if(!s.paintPixels)throw Error('Missing canonical pigment mirror');const w=s.canvas.width,h=s.canvas.height,image=s.g.createImageData(w,h);for(let y=0;y<h;y++)image.data.set(s.paintPixels.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);s.g.putImageData(image,0,0);s.paintCanvasDirty=true;s.canvasCurrent=true;}
const simulationProbe={ready:false,busy:false,error:null,jobs:0,workerMS:0,maxWorkerMS:0,rasterTotal:0,transferTotal:0,workerTotal:0,paintCommands:0,patches:0,steps:0,ticksSinceFrame:0,discardedSimMS:0,started:performance.now(),generation:0,inputCommands:[]};
let simulationPeer=null,simulationQueue=new Map(),simulationFuture=new Map(),simulationAck=new Map(),simulationExpectedEpoch=new Map(),simulationID=0,simulationPending=new Map(),simulationLastDispatch=performance.now(),simulationAccumulator=0,simulationBuilding=false,simulationTimer=0,simulationAuthoritative=null,simulationAPIPromise=Promise.resolve(),simulationDesired=null;
const simulationNativeReset=resetWorld,simulationNativeNewDoll=newDoll,simulationNativeStartGrab=startGrab,simulationNativeRelease=releaseGrab,simulationNativeState=state,simulationNativeUpdateGrab=updateGrab;
function simulationInvoke(name,...args){if(!simulationBuilding)simulationProbe.inputCommands.push([name,args]);}
function simulationSnapshotInput(dt){const ack=Array.from(simulationAck.values());simulationAck.clear();return{width:W,height:H,fov:camera.fov,cameraP:camera.position.toArray(),cameraQ:camera.quaternion.toArray(),mouse:[mouse.x,mouse.y],left:mouse.left,tool,panel,paused,aimDown,stickyLook,temporaryLook,locked:document.pointerLockElement===canvas,player:{feet:player.feet.toArray(),vel:player.vel.toArray(),eye:player.eye,speed:player.speed,bob:player.bob,fly:player.fly,grounded:player.grounded},keys:Array.from(keys),target:grab?.desired.toArray()||null,tune:{...tune},dt,ack,manual};}
function simulationApplyState(s){
 if(s.generation!==simulationProbe.generation){simulationProbe.generation=s.generation;for(const p of simulationQueue.values())simulationRelease(p);simulationQueue.clear();simulationAck.clear();simulationExpectedEpoch.clear();simulationDesired=null;simulationBuilding=true;try{simulationNativeReset(false,true);}finally{simulationBuilding=false;}for(const [id,p]of simulationFuture)if(p.generation===s.generation){simulationQueue.set(id,p);simulationFuture.delete(id);}else if(p.generation<s.generation){simulationRelease(p);simulationFuture.delete(id);}}
 while(dolls.length<s.dolls.length){const d=s.dolls[dolls.length];simulationNativeNewDoll(d.spawn[0],d.spawn[2],false,false);}
 if(bodies.length!==s.bodies.length)throw Error('Simulation topology mismatch');
 for(const q of s.paintRecords||[]){simulationExpectedEpoch.set(q.id,q.epoch);const p=simulationQueue.get(q.id);if(p&&p.epoch<q.epoch){simulationRelease(p);simulationQueue.delete(q.id);}const record=q.body?bodies.find(b=>b.id===q.body)?.skinPaint:surfaces[q.surface];if(record){record.simulationSourceID=q.id;if(record.paintEpoch!==q.epoch){record.paintEpoch=q.epoch;record.paintPixels=null;if(record.paintCanvasDirty)record.g.clearRect(0,0,record.canvas.width,record.canvas.height);record.paintCanvasDirty=false;record.canvasCurrent=true;record.paintVisible=false;if(record.paintUniform)record.paintUniform.value=blankPigment;record.tex.dispose();record.textureReady=false;record.tex.needsUpdate=true;}}}
 for(let i=0;i<dolls.length;i++){const d=dolls[i],q=s.dolls[i];d.mode=q.mode;d.active=q.active;d.health=q.health;d.root.fromArray(q.root);}
 for(let i=0;i<bodies.length;i++){const b=bodies[i],q=s.bodies[i];if(b.id!==q.id)throw Error('Simulation body order mismatch');b.p.fromArray(q.p);b.q.fromArray(q.q);b.iq.copy(b.q).conjugate();b.prevP.fromArray(q.prevP);b.prevQ.fromArray(q.prevQ);b.v.fromArray(q.v);b.w.fromArray(q.w);b.wet=q.wet;b.coat.set(q.coat);b.damage=q.damage;b.wear.set(q.wear);b.pressure=q.pressure;b.bloodReserve=q.reserve;b.contacts.length=q.contacts;b.wounds.length=q.wounds;b.active=q.active;}
 clearDrops();for(const q of s.drops){const d=dropPool.pop()||{p:new V(),prev:new V(),v:new V()};d.p.fromArray(q.p);d.prev.fromArray(q.prev);d.v.fromArray(q.v);d.r=q.r;d.life=q.life;d.owner=q.owner;dropList.push(d);}dropsChanged=true;
 simTime=s.simTime;seed=s.seed;const foregroundFrameMS=stats.frameMS;Object.assign(stats,s.stats);stats.frameMS=foregroundFrameMS;simulationAuthoritative=s.authoritative;demo=s.demo;bloodScale=s.bloodScale;toast=s.toast;toastUntil=performance.now()/1000+s.toastRemaining;
 const g=s.grab;if(g){const b=bodies.find(b=>b.id===g.body);grab={body:b,local:new V(...g.local),target:new V(...g.target),desired:new V(...(!g.manual&&simulationDesired?simulationDesired:g.desired)),distance:g.distance,manual:g.manual};selected=b;}else{grab=null;selected=null;simulationDesired=null;}
 shotFlashUntil=s.shotFlashUntil;hitMarkerUntil=s.hitMarkerUntil;hitMarkerColor=s.hitMarkerColor;viewKick=s.viewKick;recoilPitch=s.recoilPitch;
 for(const t of traces)releaseTrace(t);traces.length=0;for(const q of s.traces){const t=takeTrace();t.line.geometry.attributes.position.array.set(q.positions);t.line.geometry.attributes.position.needsUpdate=true;t.line.geometry.computeBoundingSphere();t.t=q.t;scene.add(t.line);traces.push(t);}
 shells.length=0;for(const q of s.shells)shells.push({p:new V(...q.p),v:new V(...q.v),rot:new V(...q.rot),life:q.life});
}
function simulationAccept(packet){
 const t=performance.now();if(packet.state.generation===simulationProbe.generation)simulationProbe.ticksSinceFrame+=Math.max(0,packet.state.stats.steps-simulationProbe.steps);simulationApplyState(packet.state);
 for(const q of packet.wet){const s=surfaces[q.id];s.wetData.set(q.pixels);s.wetTex.needsUpdate=true;}
 for(const [kind,...a]of packet.audioCommands)({noise:noiseSound,tone,scrape:updateScrape})[kind](...a);
 for(const p of packet.patches){simulationRelease(simulationQueue.get(p.id));simulationQueue.set(p.id,p);}simulationProbe.jobs++;simulationProbe.workerMS=packet.workerMS;simulationProbe.maxWorkerMS=Math.max(simulationProbe.maxWorkerMS,packet.workerMS);simulationProbe.rasterTotal+=packet.rasterMS;simulationProbe.transferTotal+=packet.transferMS;simulationProbe.workerTotal+=packet.workerMS;simulationProbe.paintCommands+=packet.paintCommands;simulationProbe.steps=packet.state.stats.steps;
 simulationProbe.mirrorMS=performance.now()-t;
 if(packet.paintPool)simulationProbe.paintPool=packet.paintPool;
}
function simulationAcceptPaint(packet){if(packet.generation<simulationProbe.generation){for(const p of packet.patches)simulationRelease(p);return;}const target=packet.generation>simulationProbe.generation?simulationFuture:simulationQueue;for(const p of packet.patches){if(packet.generation===simulationProbe.generation&&p.epoch<(simulationExpectedEpoch.get(p.id)||0)){simulationRelease(p);continue;}simulationRelease(target.get(p.id));target.set(p.id,p);}}
function simulationPresent(){
 const deadline=performance.now()+2,gl=renderer.getContext();
 for(const [id,p]of simulationQueue){if(performance.now()>=deadline)break;const expected=simulationExpectedEpoch.get(id);if(expected!==undefined&&p.epoch>expected)continue;simulationQueue.delete(id);if(expected!==undefined&&p.epoch<expected){simulationRelease(p);continue;}const s=p.body?(ensureSkin(bodies.find(b=>b.id===p.body)),bodies.find(b=>b.id===p.body).skinPaint):surfaces[p.surface],r=p.rect;
  if(!s)throw Error('Missing simulation paint target');s.simulationSourceID=p.id;
  if(s.paintEpoch!==p.epoch){s.paintEpoch=p.epoch;if(s.paintUniform)s.paintUniform.value=blankPigment;s.tex.dispose();s.textureReady=false;}
  initializePaintTexture(s);renderer.state.activeTexture(gl.TEXTURE0);renderer.state.bindTexture(gl.TEXTURE_2D,renderer.properties.get(s.tex).__webglTexture);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  try{if(p.pixels)gl.texSubImage2D(gl.TEXTURE_2D,0,r.x0,s.canvas.height-r.y1,r.x1-r.x0,r.y1-r.y0,gl.RGBA,gl.UNSIGNED_BYTE,p.pixels);
   else if(p.atlas){const a=p.atlas;gl.pixelStorei(gl.UNPACK_ROW_LENGTH,a.width);gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,p.atlasX);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,a.height-p.atlasY-(r.y1-r.y0));gl.texSubImage2D(gl.TEXTURE_2D,0,r.x0,s.canvas.height-r.y1,r.x1-r.x0,r.y1-r.y0,gl.RGBA,gl.UNSIGNED_BYTE,a.bitmap);}
   else gl.texSubImage2D(gl.TEXTURE_2D,0,r.x0,s.canvas.height-r.y1,gl.RGBA,gl.UNSIGNED_BYTE,p.bitmap);
   simulationCommitPixels(s,p);
  }finally{gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);simulationRelease(p);renderer.state.unbindTexture();}s.paintVisible=true;if(s.paintUniform)s.paintUniform.value=s.tex;s.uploadedEpoch=s.paintEpoch;simulationProbe.patches++;simulationAck.set(p.id,{id:p.id,epoch:p.epoch,revision:p.revision});
 }
}
function simulationSend(n,input,actions=[],full=false){simulationProbe.busy=true;return new Promise((resolve,reject)=>{const id=++simulationID;simulationPending.set(id,{resolve,reject,actions});try{simulationPeer.postMessage({id,method:'advance',args:[n,input,actions.map(([name,args])=>[name,args]),full]});}catch(error){simulationPending.delete(id);simulationProbe.busy=simulationPending.size>0;for(const a of actions)a.reject?.(error);reject(error);}});}
function simulationDispatch(){
 clearTimeout(simulationTimer);simulationTimer=0;
 if(!running||manual||!simulationProbe.ready||simulationProbe.busy||simulationAPIActive)return;
 const wall=performance.now(),since=(wall-simulationLastDispatch)/1000,rate=slow?.25:1;
 if(paused||document.hidden){simulationAccumulator=0;simulationLastDispatch=wall;if(!simulationProbe.inputCommands.length)return;}
 else if(simulationAccumulator+since*rate<STEP&&!simulationProbe.inputCommands.length){simulationTimer=setTimeout(simulationDispatch,Math.max(1,(STEP-simulationAccumulator-since*rate)/rate*1000));return;}
 simulationLastDispatch=wall;if(!paused&&!document.hidden){simulationProbe.discardedSimMS+=Math.max(0,since-.075)*rate*1000;simulationAccumulator+=Math.min(.075,since)*rate;}
 const n=Math.min(10,Math.floor(simulationAccumulator/STEP));simulationAccumulator-=n*STEP;
 simulationSend(n,simulationSnapshotInput(Math.min(.075,since)),simulationProbe.inputCommands.splice(0)).then(packet=>{simulationAccept(packet);simulationComplete(packet);simulationDispatch();}).catch(e=>{simulationProbe.error=e.stack;});
}
async function simulationBarrier(){while(simulationProbe.busy)await new Promise(r=>setTimeout(r,1));if(simulationProbe.ready){const input=simulationSnapshotInput(0);input.manual=true;simulationAccept(await simulationSend(0,input));}while(simulationQueue.size)simulationPresent();}
let simulationAPIActive=0,simulationAPIQueued=false;
function simulationComplete(packet){for(let i=0;i<(packet.tickets?.length||0);i++)packet.tickets[i].resolve?.(packet.actionResults?.[i]);}
function simulationRun(n,actions=null,full=false){simulationAPIActive++;const run=simulationAPIPromise.then(async()=>{await simulationBarrier();const p=await simulationSend(n,simulationSnapshotInput(0),actions||simulationProbe.inputCommands.splice(0),full);simulationAccept(p);while(simulationQueue.size)simulationPresent();simulationComplete(p);return state();});simulationAPIPromise=run.then(()=>{},()=>{});return run.finally(()=>{simulationAPIActive--;});}
function simulationAPI(method,...args){const command=['api',[method,args]],promise=new Promise((resolve,reject)=>{command.resolve=resolve;command.reject=reject;});simulationProbe.inputCommands.push(command);if(manual&&!simulationAPIQueued){simulationAPIQueued=true;queueMicrotask(()=>{simulationAPIQueued=false;simulationRun(0).catch(e=>{simulationProbe.error=e.stack;});});}else if(!manual)simulationDispatch();return promise;}
window.__simulationLive={status:()=>({...simulationProbe,pendingPatches:simulationQueue.size,inputCommands:simulationProbe.inputCommands.length,elapsed:(performance.now()-simulationProbe.started)/1000}),run:simulationRun,barrier:simulationBarrier,invoke:simulationInvoke};
async function simulationBoot(){
 const url=URL.createObjectURL(new Blob([window.__simulationKernel],{type:'text/javascript'}));simulationPeer=new Worker(url);URL.revokeObjectURL(url);
 await new Promise((resolve,reject)=>{simulationPeer.onerror=e=>{simulationProbe.error=e.message;reject(Error(e.message));};simulationPeer.onmessage=e=>{const m=e.data;if(m.paint){simulationAcceptPaint(m);return;}if(m.ready){resolve();return;}const p=simulationPending.get(m.id);if(!p)return;simulationPending.delete(m.id);simulationProbe.busy=simulationPending.size>0;if(m.error){simulationProbe.error=m.stack;const error=Error(m.stack);for(const a of p.actions)a.reject?.(error);p.reject(error);}else{m.result.tickets=p.actions;p.resolve(m.result);}};});
 physicsStep=()=>{};
 chaosScene=()=>simulationInvoke('chaos');resetWorld=(resetCamera=true,clean=true)=>{if(resetCamera)defaultView();simulationInvoke('reset',resetCamera,clean);};cleanSurfaces=()=>simulationInvoke('clean');washBodies=()=>simulationInvoke('wash');healAll=()=>simulationInvoke('heal');stopBleeding=()=>simulationInvoke('stop');addDummy=()=>simulationInvoke('add');shoot=()=>simulationInvoke('shoot');spill=()=>simulationInvoke('spill');startDemo=()=>{tool=0;viewAt(new V(4.3,4.2,6.1),new V(.1,.25,.6));simulationInvoke('demo');};
 startGrab=(b,p)=>{simulationNativeStartGrab(b,p);simulationDesired=grab.desired.toArray();simulationInvoke('startGrab',b.id,p.toArray());};releaseGrab=()=>{simulationNativeRelease();simulationDesired=null;simulationInvoke('release');};updateGrab=()=>{simulationNativeUpdateGrab();if(grab&&!grab.manual)simulationDesired=grab.desired.toArray();};
 state=()=>{if(!simulationAuthoritative)return simulationNativeState();const s=structuredClone(simulationAuthoritative);s.renderer={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};s.stats.frameMS=stats.frameMS;s.player={mode:player.fly?'fly':'walk',p:player.feet.toArray(),grounded:player.grounded,locked:document.pointerLockElement===canvas,sticky:stickyLook};s.tool=tool;s.paused=paused;s.slow=slow;return s;};__smear.state=state;
 const apiNames=['velocity','agePaint','clearance','wash','knock','bodyPaint','puddle','moveDoll','pose','chaos','clean','heal','wallSpill','grab','target','release','hit','add','paintFaces','shoot'];for(const name of apiNames)__smear[name]=(...args)=>simulationAPI(name,...args);
 __smear.reset=(...args)=>{defaultView();return simulationAPI('reset',...args);};__smear.demo=(...args)=>{tool=0;viewAt(new V(4.3,4.2,6.1),new V(.1,.25,.6));return simulationAPI('demo',...args);};
 // The synchronous trace helper would run the dormant foreground simulation.
 // Keep the prototype explicit until its bounded worker equivalent is ready.
 __smear.trace=()=>{throw Error('Threaded preview does not support trace; use await __smear.step(n).');};
 const nativeTune=__smear.tune,nativePreset=__smear.preset,nativeWalkers=__smear.walkers;__smear.tune=(...a)=>{nativeTune(...a);return simulationAPI('tune',...a);};__smear.preset=(...a)=>{nativePreset(...a);return simulationAPI('preset',...a);};__smear.walkers=(...a)=>{nativeWalkers(...a);return simulationAPI('walkers',...a);};
 __smear.step=n=>simulationRun(n);__smear.rawStep=__smear.step;
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
 const paintEngine={enabled:true,register:s=>{s.paintId=++simulationMirrorSerial;s.paintEpoch=0;s.canvasCurrent=true;s.paintCanvasDirty=false;simulationMirrorRecords.set(s.paintId,s);},remove:s=>simulationMirrorRecords.delete(s.paintId),draw:(s,kind)=>{if(kind==='clear'){s.paintEpoch++;if(s.paintCanvasDirty)s.g.clearRect(0,0,s.canvas.width,s.canvas.height);s.paintCanvasDirty=false;}},pump:()=>{if(window.__simulationLive)simulationPresent();},snapshotCanvas:simulationSnapshotCanvas,flush:async(inspect=true)=>{if(!window.__simulationLive)return;await simulationBarrier();if(inspect)for(const s of simulationMirrorRecords.values())simulationSnapshotCanvas(s);},status:()=>{const p=window.__simulationLive?.status(),r=p?.paintPool;return{backend:'Worker simulation and pigment prototype',workerCount:r?r.workerCount+1:1,queued:r?.pending||0,inFlight:0,recoveryPending:0,readyBitmaps:p?.pendingPatches||0,workerMS:r?.jobs?r.totalRaster/r.jobs:p?.workerMS||0,bitmapMS:r?.jobs?r.totalTransfer/r.jobs:0,simulationWorkerMS:p?.workerMS||0,simulationSteps:p?.steps||0,discardedSimMS:p?.discardedSimMS||0,mainReplayCommands:0,batchLimit:1024,maxQueued:r?.maxPending||0};}};paintTelemetry=paintEngine.status;`);
 // Show independent worker cost alongside the foreground histogram.
 root=root.replace("nodes['spike-count'].textContent","if(s.paintWorker?.simulationWorkerMS!==undefined)nodes.context.textContent+='\\nSimulation '+fmt(s.paintWorker.simulationWorkerMS)+' ms worker / '+fmt(s.paintWorker.discardedSimMS)+' ms discarded sim';nodes['spike-count'].textContent");
 // Add the hook before adding serialized source, which contains the same tokens.
 root=root.replace('frameRequest=requestAnimationFrame(frame);\n})();',foreground+'\nframeRequest=requestAnimationFrame(frame);\n})();');
 const boot=`window.__simulationKernel=${JSON.stringify(kernel).replaceAll('<','\u003c')};`;
 return root.replace('</head>','<script>'+boot+'</script></head>');
}
